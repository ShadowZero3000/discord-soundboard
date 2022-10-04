import FileManager from './FileManager.js'
const fm = new FileManager()
import * as fs from 'fs'
import { errorLog } from './logger.js'
const log = errorLog;

export default class VoiceQueue {
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
    // Play a goodbye clip
    this.play_clip('bot_powerdown', true)
    // Give it time to finish playing, then leave, or catch errors
    setTimeout(() => {
      try {
        if(this.playQueue.length == 0) {
          this.channel.leave()
        } else {
          this.log(`Was leaving channel, but there were still things to play`)
        }
      } catch(err) {
        this.log(`Error leaving channel: ${err.message}`)
      }
    }, 2*1000);
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
      this.timeout = setTimeout(() => this.disconnect(), 15*60*1000); // 15m unless he moves
      return;
    }
    this.play_clip(keyword)
  }

  play_clip(keyword, stop_after=false) {
    this.channel.join()
      // TODO: send play event to Play Bus
      .then(conn => {
        const dispatcher = conn.play(fm.getStream(keyword));
        dispatcher.on("finish", end => {
          // TODO: send end event to Play Bus
          this.log(`Finished with: ${keyword}`);
          this.playing = false;
          if(!stop_after){
            this.play();
          }
        });
      })
      .catch(err => {
        this.log(`Error in channel join: ${err}`);
        this.playing = false;
        if(!stop_after){
          this.play();
        }
      });
  }
}
