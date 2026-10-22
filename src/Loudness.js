import fs from 'fs'
import { execFile } from 'child_process'
import prism from 'prism-media'
import Store from 'data-store'
import { createAudioResource, StreamType } from '@discordjs/voice'
import Config from './Config.js'
import { errorLog } from './logger.js'
const log = errorLog

// Peak ceiling for the limiter, so boosted clips can't clip
const CEILING_DB = -1
// Clips shorter than one 400ms EBU R128 block measure as -inf, so loop them until they're long enough
const SHORT_CLIP_LOOPS = 10

// ffmpeg prints -inf for unmeasurable clips, which Number() can't read
function toNumber (value) {
  return value === '-inf' ? -Infinity : Number(value)
}

// Pull the integrated loudness and true peak out of ffmpeg's loudnorm JSON summary
export function parseLoudnorm (stderr) {
  const json = stderr.slice(stderr.lastIndexOf('{'), stderr.lastIndexOf('}') + 1)
  try {
    const stats = JSON.parse(json)
    return {
      integrated: toNumber(stats.input_i),
      truePeak: toNumber(stats.input_tp)
    }
  } catch (err) {
    return null
  }
}

// dB of gain to bring a clip to the target loudness. Silent or unmeasurable clips are left alone.
export function computeGain (measurement, { target, maxBoost }) {
  if (!measurement || !Number.isFinite(measurement.integrated)) {
    return 0
  }
  return Math.min(target - measurement.integrated, maxBoost)
}

export function filterChain (gain) {
  const limit = Math.pow(10, CEILING_DB / 20).toFixed(4)
  // level=0 stops alimiter from auto-raising everything up to the ceiling
  return `volume=${gain.toFixed(2)}dB,alimiter=limit=${limit}:level=0`
}

function settings () {
  return {
    enabled: String(Config.get('NORMALIZE_VOLUME')) !== 'false',
    target: Number(Config.get('LOUDNESS_TARGET')),
    maxBoost: Number(Config.get('LOUDNESS_MAX_BOOST'))
  }
}

export class LoudnessManager {
  constructor (storePath = 'config/loudness.json') {
    this.store = new Store({ name: 'loudness', path: storePath, defaults: {} })
    this.queued = new Set()
    this.pending = Promise.resolve()
  }

  // Stored measurements are keyed by path, and are only trusted if the file hasn't changed since
  lookup (fileName) {
    const entry = this.store.get(fileName)
    if (!entry) { return undefined }
    try {
      const stat = fs.statSync(fileName)
      if (stat.size === entry.size && stat.mtimeMs === entry.mtimeMs) {
        return entry
      }
    } catch (err) {}
    return undefined
  }

  // Measure in the background, one file at a time, so a big library doesn't hog the CPU at startup
  enqueue (fileName) {
    if (!settings().enabled || this.queued.has(fileName) || this.lookup(fileName)) {
      return this.pending
    }
    this.queued.add(fileName)
    this.pending = this.pending
      .then(() => this.analyze(fileName))
      .catch(err => log.error(`Failed to measure loudness of ${fileName}: ${err.message}`))
      .finally(() => this.queued.delete(fileName))
    return this.pending
  }

  async analyze (fileName) {
    const stat = fs.statSync(fileName)
    let measurement = await this.measure(fileName)
    if (measurement && !Number.isFinite(measurement.integrated)) {
      measurement = await this.measure(fileName, SHORT_CLIP_LOOPS)
    }
    if (!measurement) {
      throw new Error('could not parse ffmpeg output')
    }
    log.debug(`Loudness of ${fileName}: ${measurement.integrated} LUFS, peak ${measurement.truePeak} dBTP`)
    this.store.set(fileName, { ...measurement, size: stat.size, mtimeMs: stat.mtimeMs })
    return measurement
  }

  measure (fileName, loops = 1) {
    const args = ['-hide_banner', '-nostats']
    if (loops > 1) {
      args.push('-stream_loop', String(loops - 1))
    }
    args.push('-i', fileName, '-af', 'loudnorm=print_format=json', '-f', 'null', '-')
    return new Promise((resolve, reject) => {
      execFile(prism.FFmpeg.getInfo().command, args, { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
        if (err) { return reject(err) }
        resolve(parseLoudnorm(stderr))
      })
    })
  }

  forget (fileName) {
    this.store.del(fileName)
  }

  move (oldFileName, newFileName) {
    const entry = this.store.get(oldFileName)
    if (entry) {
      this.store.set(newFileName, entry)
      this.store.del(oldFileName)
    }
  }

  gainFor (fileName) {
    const config = settings()
    const entry = this.lookup(fileName)
    if (!entry) {
      // Not measured yet (or changed since), play it as-is this time
      this.enqueue(fileName)
      return 0
    }
    return computeGain(entry, config)
  }

  createResource (fileName) {
    if (!settings().enabled) {
      return createAudioResource(fileName)
    }
    const gain = this.gainFor(fileName)
    log.debug(`Applying ${gain.toFixed(2)}dB to ${fileName}`)
    const transcoder = new prism.FFmpeg({
      args: [
        '-analyzeduration', '0',
        '-loglevel', '0',
        '-i', fileName,
        '-af', filterChain(gain),
        '-f', 's16le',
        '-ar', '48000',
        '-ac', '2'
      ]
    })
    return createAudioResource(transcoder, { inputType: StreamType.Raw })
  }
}

export default class Loudness {
  constructor () {
    throw new Error('Use Loudness.getInstance()')
  }

  static getInstance () {
    if (!Loudness.instance) {
      Loudness.instance = new LoudnessManager()
    }
    return Loudness.instance
  }
}
