const log = require('./logger.js').errorLog;
const VoiceQueue = require('./VoiceQueue.js');

const files = {};
const fs = require('fs');
const items = fs.readdirSync('./Uploads/');
const queues = {}

items.forEach(item => {
  const matches = item.match(/^([^-]+)--(.*)$/);
  if (matches) {
    files[matches[1]] = `./Uploads/${matches[0]}`;
  }
});

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

function selectRandom(collection) {
  if (!collection.length) {
    return;
  }

  return collection[Math.floor(Math.random() * collection.length)];
}

module.exports = {
  files: files,
  queues: queues,
  getQueueFromUser: getQueueFromUser,
  selectRandom: selectRandom
}

