const fs = require('fs');
const log = require('./logger.js').errorLog;
const fm = require('./FileManager');
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

  add(keyword) {
    if (this.silenced || !fm.inLibrary(keyword)) {
      return;
    }

    if (this.playQueue.length > 2) {
      this.log(`Too many requests in queue: ${this.playQueue.length}`, 'error');
      this.play(); // Ensure that the bot is still alive
      return;
    }

    this.log(`Queued: ${keyword}`);
    this.playQueue.unshift(keyword);
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
    const keyword = this.playQueue.pop();

    if (!keyword) {
      this.log("Queue empty");
      this.playing = false;
      this.timeout = setTimeout(() => this.disconnect(), 3000);
      return;
    }

    this.channel.join()
      // TODO: send play event to Play Bus
      .then(conn => {
        this.log(`Playing: ${keyword}`);
        const dispatcher = conn.play(fm.getStream(keyword));
        dispatcher.on("end", end => {
          // TODO: send end event to Play Bus
          this.log(`Finished with: ${keyword}`);
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
