import { errorLog } from './logger.js'
const log = errorLog;
import VoiceQueue from './VoiceQueue.js'
import DiscordBot from './DiscordBot.js'

export default class VoiceQueueManager {
    constructor() {
        throw new Error('Use VoiceQueueManager.getInstance()');
    }
    static getInstance() {
        if (!VoiceQueueManager.instance) {
            VoiceQueueManager.instance = new PrivateVoiceQueueManager();
        }
        return VoiceQueueManager.instance;
    }
}

class PrivateVoiceQueueManager {
  constructor() {
    this.queues = {};
  }
  getQueueFromChannel(voiceChannel) {
    if (!voiceChannel) {
      // TODO: This will misbehave, need to throw?
      return null;
    }

    if (!this.queues[voiceChannel.id]) {
      this.queues[voiceChannel.id] = new VoiceQueue(voiceChannel);
      log.info(`New voice queue created: ${voiceChannel.id}`);
    }
    return this.queues[voiceChannel.id];
  }

  getQueueFromUser(userId) {
    const voiceChannel = this.getVCFromUserid(userId);
    if (!voiceChannel) {
      throw new Error("No queue found")
    }
    return this.getQueueFromChannel(voiceChannel);
  }

  getQueueFromMessage(message) {
    log.debug(`Looking for an active voice channel for ${message.member.id}`);
    const user = message.guild.voiceStates.cache.get(message.member.id);
    if (!user) {
      return null;
      throw new Error(`You don't appear to be in a voice channel in this server`);
    }
    const voiceChannel = user.guild.channels.cache.get(user.channelID);
    log.debug(`getQueueFromMessage found voice channel ${voiceChannel}`);
    if(voiceChannel == undefined) {
      throw new Error(`Couldn't find channel`)
    }
    return this.getQueueFromChannel(voiceChannel);
  }

  getVCFromUserid(userId) {
    const discord = DiscordBot.getInstance().client
    log.debug(`Looking for an active voice channel for ${userId}`);
    const voiceChannels =
      discord.guilds.cache
        .map(guild => guild.voiceStates.cache.get(userId))
        .filter(voiceState => voiceState !== undefined)
        .map(voiceState => voiceState.channel)
        .filter(channel => channel !== undefined);
    if (!voiceChannels.length > 0) {
      log.debug("Not in a channel")
      throw new Error(`You don't appear to be in a voice channel in this server`);
    }
    log.debug(`Found voice channels ${voiceChannels}`);
    return voiceChannels[0];
  }
}