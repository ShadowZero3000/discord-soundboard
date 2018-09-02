const fs = require('fs');

class VoiceQueue {
  constructor(channel) {
    this.channel = channel;
    this.playQueue = [];
    this.playing = false;
    this.silenced = false;
  }

  log(message) {
    console.log(`${this.channel.guild.name} (${this.channel.name}): ${message}`);
  }

  add(file) {
    if (this.silenced) {
      return;
    }

    if (this.playQueue.length > 2) {
      this.log(`Too many requests in queue: ${this.playQueue.length}`);
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

    this.log("Leaving");
    this.channel.leave();
  }

  play() {
    if (this.playing) {
      return;
    }

    this.playing = true;
    const file = this.playQueue.pop();

    if (!file) {
      this.log("Queue empty");
      this.playing = false;
      setTimeout(() => this.disconnect(), 3000);
      return;
    }

    this.channel.join()
      // TODO: send play event to Play Bus
      .then(conn => {
        const stream = fs.createReadStream(file);
        this.log(`Playing: ${file}`);
        const dispatcher = conn.playStream(stream, {type: 'opus'});
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
