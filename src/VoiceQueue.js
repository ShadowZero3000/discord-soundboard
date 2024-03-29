import FileManager from './FileManager.js'
const fm = FileManager.getInstance()
import { errorLog } from './logger.js'
const log = errorLog;

import { joinVoiceChannel } from '@discordjs/voice'
import { createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice'

export default class VoiceQueue {
  constructor(channel) {
    this.channel = channel;
    this.playQueue = [];
    this.playing = false;
    this.silenced = false;
    this.timeout = null;
    this.bailtimeout = null;
    this.dc_after_next = false;
    this.player = createAudioPlayer();

    // These were used to debug an issue where we would never return to the idle event
    // https://github.com/discordjs/discord.js/issues/9185
    // Solved by updating the voice dependency
    // this.player.on(AudioPlayerStatus.Playing, ()=>{
    //   this.log(`I'm presently playing. Queue length: ${this.playQueue.length}`)
    // })
    // this.player.on(AudioPlayerStatus.AutoPaused, ()=>{
    //   this.log(`I'm presently AutoPaused. Queue length: ${this.playQueue.length}`)
    // })
    // this.player.on(AudioPlayerStatus.Buffering , ()=>{
    //   this.log(`I'm presently Buffering . Queue length: ${this.playQueue.length}`)
    // })
    // this.player.on(AudioPlayerStatus.Paused , ()=>{
    //   this.log(`I'm presently Paused . Queue length: ${this.playQueue.length}`)
    // })

    // This is what causes the queue to process more requests
    this.player.on(AudioPlayerStatus.Idle, () => {
      // this.log(`I'm presently Idle . Queue length: ${this.playQueue.length}`)
      this.playing=false
      // this.log(`Finished playing a clip, queue length now: ${this.playQueue.length}`)
      if(!this.dc_after_next){
        this.play()
      }
    });
    this.connection = null;
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
      this.log("Still playing during disconnect request");
      return;
    }

    this.playQueue = []; // Clear the queue on leaving
    // Play a goodbye clip
    this.play_clip('bot_powerdown', true)
    // Give it time to finish playing, then leave, or catch errors
    setTimeout(() => {
      try {
        if(this.playQueue.length == 0) {
          clearTimeout(this.timeout)
          this.connection.destroy()
          this.dc_after_next = false
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
      this.log("Request to play, but still playing a previous clip.")
      this.bailtimeout = setTimeout(() => {this.playing = false}, 15*1000); // Bail on playing if we're still playing the same clip after 15s
      return;
    }
    // The bail timeout may not be necessary, but it can fix runaway queues
    if(this.bailtimeout) {
      clearTimeout(this.bailtimeout);
    }

    this.playing = true;
    const keyword = this.playQueue.pop();

    if (!keyword) {
      this.log("Queue empty");
      this.playing = false;
      this.timeout = setTimeout(() => {this.playing = false; this.disconnect()}, 15*60*1000); // 15m unless he moves
      return;
    }
    this.play_clip(keyword)
  }

  play_clip(keyword, stop_after=false) {
    this.connection = joinVoiceChannel({
      channelId: this.channel.id,
      guildId: this.channel.guild.id,
      adapterCreator: this.channel.guild.voiceAdapterCreator,
    });

    const file = fm.get(keyword)
    if (file !== undefined) {
      const resource = createAudioResource(file.fileName); //'/home/user/voice/track.mp3');
      this.connection.subscribe(this.player);

      if(stop_after){
        this.dc_after_next = true
      }
      this.player.play(resource);
    } else {
      log.debug(`Request to play invalid file: ${keyword}`)
    }
  }
}
