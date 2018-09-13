const log = require('./logger.js').errorLog;
const VoiceQueue = require('./VoiceQueue.js');

const queues = {}

function getQueueFromUser(discord, userId) {
  const vc = getVCFromUserid(discord, userId);
  if (!vc) {
    throw new Error("No queue found")
  }

  if (!queues[vc.id]) {
    queues[vc.id] = new VoiceQueue(vc);
  }

  return queues[vc.id];
}

function getVCFromUserid(discord, userId) {
  log.debug(`Looking for an active voice channel for ${userId}`);
  const voiceChannel =
    discord.guilds.map(guild => guild.voiceStates.get(userId))
      .filter(voiceState => voiceState !== undefined)
      .map(user => user.guild.channels.get(user.channelID))[0];
  log.debug(`Found voice channel ${voiceChannel}`);
  return voiceChannel;
}

module.exports = {
  queues: queues,
  getQueueFromUser: getQueueFromUser
}

