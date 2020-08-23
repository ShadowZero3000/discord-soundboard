const AV = require('av')
const decode = require('./decodeOpus.js');
const Ds = require('deepspeech')
const Duplex = require("stream").Duplex;
const ffmpeg = require('fluent-ffmpeg');
const fm = require('./FileManager');
const fs = require('fs');
const log = require('./logger.js').errorLog;
const MemoryStream = require("memory-stream");
const nconf = require('nconf');
const path = require('path');
const Sox = require('sox-stream')
const WitSpeech = require('node-witai-speech');

require('vorbis.js')

class Listener {
  constructor(memberid) {
    this.memberid = memberid;
    this.recordingsPath = './recordings';
    if (!fs.existsSync(this.recordingsPath)){
        fs.mkdirSync(this.recordingsPath, {recursive: true});
    }
    this.currentFile = null
    this.outputStream = null
    this.inputStream = null
    this.listenerEvent = this.pipeData.bind(this)
    this.startTimestamp = null
    this.maxRunTime = 4000 // This might need to come from a config
    this.stt_enabled = false

    this.loadStt()
  }

  loadStt() {
    var listener = this
    var stt_dir = './stt'
    fs.readdir(stt_dir, (err, files)=>{
      if(!files) {
        return
      }
      files.every((file)=>{
        if(path.extname(file) == '.pbmm'){
          log.debug('Model available, enabling speech to text')
          listener.model = new Ds.Model(path.join(stt_dir,file))
          listener.stt_enabled = true
          return false // Break the loop
        }
      })
    })
  }

  generateOutputFile(connection) {
    // use IDs instead of username cause some people have stupid emojis in their name
    const fileName = `./recordings/${connection.channel.id}-${this.memberid}-${Date.now()}.opus`;
    this.currentFile = fileName
    this.outputStream = fs.createWriteStream(fileName);
    return this.outputStream
  }

  log(message, level='verbose') {
    log[level](`${this.channel.guild.name} (${this.channel.name}): ${message}`);
  }
  pipeData(data) {
    // Will write data to the most current file, which changes over time
    this.outputStream.write(`,${data.toString('hex')}`)
  }
  listen(connection) {
    const outputStream = this.generateOutputFile(connection)
    this.startTimestamp = new Date().getTime()

    try {
      const stream = connection.receiver.createStream(this.memberid)
      this.inputStream = stream
      if(stream._events['data'] == null) {
        stream.on("data", this.listenerEvent)
      }
    } catch(e) {log.debug(e.message)}
  }
  handleTranscodeError(error, stage, cb){
    log.debug(`Error in transcode (${stage}): ${e}`)
    return cb(null)
  }
  // Sourced from: https://github.com/XianhaiC/Voice-Bot
  processRawToWav(filepath, outputpath, cb) {
    var listener = this
    fs.closeSync(fs.openSync(outputpath, 'w'));

    if (!fs.existsSync(filepath)) {
      log.debug('Recording missing:', filepath);
      return cb(null)
    }

    var command = ffmpeg(filepath)
      .addInputOptions([
        '-f s32le',
        '-ar 48k',
        '-ac 1'
      ])
      .on('end', function() {
        // Stream the file to be sent to the wit.ai
        try{
          var stream = fs.createReadStream(outputpath);
          stream.on('error', (e)=>{listener.handleTranscodeError(e,'stream',cb)})
        } catch(e){
          log.debug(`Error with readstream: ${e.message}`)
          return cb(null)
        }
        if(!listener.stt_enabled){
          return cb(null)
        }

        if(nconf.get("USE_WIT") == undefined || !nconf.get("USE_WIT")) {
          const transcode = Sox({
            output: {
              bits: 16,
              rate: 16000,
              channels: 1,
              type: 'raw'
            }
          })

          let audioStream = new MemoryStream();
          audioStream.on('finish', ()=>{
            let audioBuffer = audioStream.toBuffer();
            let buffer = new Int16Array(audioBuffer.buffer, audioBuffer.byteOffset, audioBuffer.length / Int16Array.BYTES_PER_ELEMENT)
            let result = listener.model.stt(buffer)
            return cb({text: result})
          })
          transcode.on('error', (e)=>{listener.handleTranscodeError(e,'transcode',cb)})
          audioStream.on('error', (e)=>{listener.handleTranscodeError(e,'audioStream',cb)})
          stream.pipe(transcode).pipe(audioStream)
        } else {
          if(nconf.get("WIT_API_KEY") != undefined) {
            // Its best to return a promise
            var parseSpeech =  new Promise((ressolve, reject) => {
              // call the wit.ai api with the created stream
              WitSpeech.extractSpeechIntent(nconf.get("WIT_API_KEY"), stream, "audio/wav",
              (err, res) => {
                  if (err) return reject(err);
                  ressolve(res);
                });
            });

            // check in the promise for the completion of call to witai
            parseSpeech.then((data) => {
              cb(data);
            })
            .catch((err) => {
              console.log(err)
              log.debug(err.message);
              return cb(null);
            })
          }
          // End of wit processing
        }
      })
      .on('error', function(err) {
          log.debug('an error happened: ' + err.message);
      })
      .addOutput(outputpath)
      .run();
  }
  handleTextFromSpeech(data, file, stream, callback) {
    let basename = path.basename(file, '.opus');
    // Create a new file for new streams to deal with
    // Delete all the temp files and streams
    try {
      fs.unlinkSync(file)
      fs.unlinkSync(path.join('./recordings', basename + '.raw_pcm'))
      fs.unlinkSync(path.join('./recordings', basename + '.wav'))
    } catch(e) {
      log.debug('Some file you want to delete failed')
    }
    if (data != null) {
      callback(data.text)
    }
  }
  finish(callback) {
    if(!this.stt_enabled) {
      return callback('Speech to text disabled')
    }
    // return
    var runTime = new Date().getTime() - this.startTimestamp
    if (runTime > this.maxRunTime) {
      // Don't bother shipping long messages
      return callback('Too long')
    }
    try{
      let basename = path.basename(this.currentFile, '.opus');
      var listener = this

      var fileWhenRun = this.currentFile
      var streamWhenRun = this.outputStream
      streamWhenRun.end()
      log.debug("Sending captured voice message for translation")
      decode.convertOpusStringToRawPCM(this.currentFile,
        basename,
        (function() {
          listener.processRawToWav(
            path.join('./recordings', basename + '.raw_pcm'),
            path.join('./recordings', basename + '.wav'),
            (function(data) {
              listener.handleTextFromSpeech(data, fileWhenRun, streamWhenRun, callback)
            }))
        }))
    } catch(e){log.debug("Gothere");log.debug(e.message)}
  }
}

module.exports = Listener
