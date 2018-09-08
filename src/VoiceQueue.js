const fs = require('fs');
const log = require('./logger.js').errorLog;
class VoiceQueue {
  constructor(channel) {
    this.channel = channel;
    this.playQueue = [];
    this.playing = false;
    this.silenced = false;
    this.timeout = null;
  }

  log(message, level='verbose') {
    log[level](`${this.channel.guild.name} (${this.channel.name}): ${message}`);
  }

  add(file) {
    if (this.silenced) {
      return;
    }

    if (this.playQueue.length > 2) {
      this.log(`Too many requests in queue: ${this.playQueue.length}`, 'error');
      this.play(); // Ensure that the bot is still alive
      return;
    }

    this.log(`Queued: ${file}`);
    this.playQueue.unshift(file);
    this.play();
  }

  silence() {
    this.silenced = true;
    this.playQueue = [];
    this.disconnect();
  }

  unsilence() {
    this.silenced = false;
  }

  disconnect(force = false) {
    if (this.playing && !force) {
      this.log("Still playing");
      return;
    }

    this.playQueue = []; // Clear the queue on leaving
    this.log("Leaving");
    this.channel.leave();
  }

  play() {
    if(this.timeout) {
      clearTimeout(this.timeout);
    }
    if (this.playing) {
      return;
    }

    this.playing = true;
    const file = this.playQueue.pop();

    if (!file) {
      this.log("Queue empty");
      this.playing = false;
      this.timeout = setTimeout(() => this.disconnect(), 3000);
      return;
    }

    this.channel.join()
      // TODO: send play event to Play Bus
      .then(conn => {
        const stream = fs.createReadStream(file);
        this.log(`Playing: ${file}`);
        const dispatcher = conn.play(stream);
        dispatcher.on("end", end => {
          // TODO: send end event to Play Bus
          this.log(`Finished with: ${file}`);
          this.playing = false;
          this.play();
        })
      })
      .catch(err => {
        this.log(err)
        this.playing = false;
        this.play();
      });
  }
}

module.exports = VoiceQueue
