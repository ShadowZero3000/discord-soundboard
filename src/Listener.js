const decode = require('./decodeOpus.js');
const ffmpeg = require('fluent-ffmpeg');
const fm = require('./FileManager');
const fs = require('fs');
const log = require('./logger.js').errorLog;
const nconf = require('nconf');
const path = require('path');
const WitSpeech = require('node-witai-speech');

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
  // Sourced from: https://github.com/XianhaiC/Voice-Bot
  processRawToWav(filepath, outputpath, cb) {
    fs.closeSync(fs.openSync(outputpath, 'w'));
    var command = ffmpeg(filepath)
      .addInputOptions([
        '-f s32le',
        '-ar 48k',
        '-ac 1'
      ])
      .on('end', function() {
        // Stream the file to be sent to the wit.ai
        var stream = fs.createReadStream(outputpath);

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
          //return data;
        })
        .catch((err) => {
          console.log(err)
          log.debug(err.message);
          cb(null);
          //return null;
        })
      })
      .on('error', function(err) {
          log.debug('an error happened: ' + err.message);
      })
      .addOutput(outputpath)
      .run();
  }
  handleTextFromSpeech(data, file, stream, callback) {
    let basename = path.basename(file, '.opus_string');
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
      callback(data._text)
    }
  }
  finish(callback) {
    var runTime = new Date().getTime() - this.startTimestamp
    if (runTime > this.maxRunTime) {
      // Don't bother shipping long messages
      return callback('Too long')
    }
    try{
      let basename = path.basename(this.currentFile, '.opus_string');
      var listener = this

      var fileWhenRun = this.currentFile
      var streamWhenRun = this.outputStream
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
