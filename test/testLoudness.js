import { expect } from 'chai'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { execFileSync, spawnSync } from 'child_process'
import prism from 'prism-media'

process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test'
const { parseLoudnorm, computeGain, filterChain, LoudnessManager } = await import('../src/Loudness.js')

const ffmpeg = prism.FFmpeg.getInfo().command
const settings = { target: -18, maxBoost: 12 }

function makeClip (dir, name, filter) {
  const file = path.join(dir, name)
  execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', filter, '-y', file])
  return file
}

describe('Loudness', function () {
  describe('parseLoudnorm', function () {
    it('reads the trailing JSON block from ffmpeg output', function () {
      const stderr = 'Input #0, wav\n[Parsed_loudnorm_0 @ 0x1]\n{\n\t"input_i" : "-23.50",\n\t"input_tp" : "-4.10"\n}\nsize=N/A'
      expect(parseLoudnorm(stderr)).to.deep.equal({ integrated: -23.5, truePeak: -4.1 })
    })

    it('reads -inf for clips too short to measure', function () {
      expect(parseLoudnorm('{"input_i" : "-inf", "input_tp" : "-18.06"}').integrated).to.equal(-Infinity)
    })

    it('returns null when there is no summary', function () {
      expect(parseLoudnorm('No such file or directory')).to.equal(null)
    })
  })

  describe('computeGain', function () {
    it('turns loud clips down to the target', function () {
      expect(computeGain({ integrated: -6 }, settings)).to.equal(-12)
    })

    it('turns quiet clips up to the target', function () {
      expect(computeGain({ integrated: -26 }, settings)).to.equal(8)
    })

    it('caps how much a clip can be boosted', function () {
      expect(computeGain({ integrated: -50 }, settings)).to.equal(12)
    })

    it('leaves silent or unmeasured clips alone', function () {
      expect(computeGain({ integrated: -Infinity }, settings)).to.equal(0)
      expect(computeGain(undefined, settings)).to.equal(0)
    })
  })

  describe('end to end', function () {
    this.timeout(30000)
    let dir, manager

    before(function () {
      dir = fs.mkdtempSync(path.join(os.tmpdir(), 'loudness-'))
      manager = new LoudnessManager(path.join(dir, 'loudness.json'))
    })

    after(function () {
      fs.rmSync(dir, { recursive: true, force: true })
    })

    // Measure a clip, apply the playback filter, and check where it lands
    async function normalizedLoudness (file) {
      await manager.enqueue(file)
      const gain = computeGain(manager.lookup(file), settings)
      const out = file.replace(/\.\w+$/, '-out.wav')
      execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-i', file, '-af', filterChain(gain), '-y', out])
      return manager.measure(out)
    }

    it('brings loud and quiet clips to about the same loudness', async function () {
      const loud = makeClip(dir, 'loud.wav', 'sine=f=440:d=2,volume=14dB')
      const quiet = makeClip(dir, 'quiet.mp3', 'sine=f=440:d=2,volume=-8dB')
      const loudOut = await normalizedLoudness(loud)
      const quietOut = await normalizedLoudness(quiet)
      expect(loudOut.integrated).to.be.closeTo(-18, 1)
      expect(quietOut.integrated).to.be.closeTo(-18, 1)
    })

    it('measures clips shorter than one loudness block', async function () {
      const short = makeClip(dir, 'short.wav', 'sine=f=440:d=0.2')
      await manager.enqueue(short)
      expect(manager.lookup(short).integrated).to.be.a('number').and.satisfy(Number.isFinite)
    })

    it('keeps boosted peaks from clipping', async function () {
      // A quiet clip with one loud burst: the boost would push the burst past 0dBFS without the limiter
      const spiky = makeClip(dir, 'spiky.wav', 'aevalsrc=0.02*sin(2*PI*440*t)+if(between(t\\,1\\,1.005)\\,0.9*sin(2*PI*440*t)\\,0):d=2')
      await normalizedLoudness(spiky)
      const { stderr } = spawnSync(ffmpeg, ['-hide_banner', '-i', spiky.replace('.wav', '-out.wav'), '-af', 'volumedetect', '-f', 'null', '-'])
      const maxVolume = Number(stderr.toString().match(/max_volume: (\S+) dB/)[1])
      expect(maxVolume).to.be.below(0)
    })

    it('re-measures a clip once the file changes', async function () {
      const clip = makeClip(dir, 'changing.wav', 'sine=f=440:d=1')
      await manager.enqueue(clip)
      expect(manager.lookup(clip)).to.not.equal(undefined)
      makeClip(dir, 'changing.wav', 'sine=f=440:d=1.5')
      expect(manager.lookup(clip)).to.equal(undefined)
    })

    it('keeps measurements across a rename', async function () {
      const clip = makeClip(dir, 'before.wav', 'sine=f=440:d=1')
      await manager.enqueue(clip)
      const renamed = path.join(dir, 'after.wav')
      fs.renameSync(clip, renamed)
      manager.move(clip, renamed)
      expect(manager.lookup(renamed)).to.not.equal(undefined)
      expect(manager.lookup(clip)).to.equal(undefined)
    })
  })
})
