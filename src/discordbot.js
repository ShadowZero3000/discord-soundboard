
const Discord = require('discord.js');
const nconf = require('nconf');
const adminUtils = require('./adminUtils.js')
const files = require('./utils.js').files
const queues = require('./utils.js').queues;
const log = require('./logger.js').errorLog;
const VoiceQueue = require('./VoiceQueue.js');

class DiscordBot {
  constructor(token) {
    this.token = token;
    this.discord = new Discord.Client();
  }

  loadConfig() {
    this.adminWords = nconf.get('ADMIN_KEYS').split(',');
    this.symbol = nconf.get('KEY_SYMBOL');
    this.safeSymbol = this.symbol;
    // Must escape some special regex chars
    if (['$','^','(','['].indexOf(this.symbol) > -1) {
      this.safeSymbol = `\\${this.symbol}`;
    }
    this.adminWordRegex = new RegExp(`^${this.safeSymbol}(${this.adminWords.join('|')})(.*)$`)
    this.keyWordRegex = new RegExp(`${this.safeSymbol}([a-z0-9_]+)(.*)`)
  }

  botHelp() {
    return `I'm a bot!\n` +
      `You can ask me to make sounds by saying one of the following:\n` +
      `\`${this.symbol}${Object.keys(files).sort().join(`\`, \`${this.symbol}`)}\`\n` +
      '----\n' +
      'Admins can also use:\n'  +
      `\`${this.symbol}${this.adminWords[0]} ${adminUtils.getActions().sort().join(`\`, \`!${this.adminWords[0]} `)}\``;
  }

  getVoiceChannel(message) {
    if (message.member && message.member.voiceChannel) {
      return message.member.voiceChannel;
    }
    message.reply("You don't appear to be in a voice channel!");
    return null;
  }

  getQueue(vc) {
    if (!vc) {
      // TODO: This will misbehave, need to throw?
      return;
    }

    if (!queues[vc.id]) {
      queues[vc.id] = new VoiceQueue(vc);
    }

    return queues[vc.id];
  }
  selectRandom(collection) {
    if (!collection.length) {
      return;
    }

    return collection[Math.floor(Math.random() * collection.length)];
  }
  handleAdminMessage(message, command) {
    const commandArray = command.split(' ')
    if (!command || commandArray.indexOf("help") == 0) { // bot help
      return message.reply(this.botHelp());
    }

    if (commandArray.indexOf("leave") == 0) { // bot leave
      const voiceChannel = getVoiceChannel(message);
      if (voiceChannel) {
        voiceChannel.leave();
      }
      return;
    }

    // POTENTIAL PROBLEM: If you haven't joined a voice channel, some admin commands might not work
    // Will have to ensure that we add check logic lower down
    if (adminUtils.getActions().indexOf(commandArray[0]) > -1
         && adminUtils.check(message, commandArray[0])) {
      return adminUtils[commandArray.shift()](message, commandArray);
    }

    return;
  }

  handleKeywordMessage(message, keyword, extraArgs) {
    // Time for some audio!
    const voiceChannel = this.getVoiceChannel(message);
    if (!voiceChannel) {
      return;
    }

    if (Object.keys(files).indexOf(keyword) > -1) {
      this.getQueue(voiceChannel).add(files[keyword]);
      return;
    }

    if (keyword == 'random') {
      if (!extraArgs) { // Play a random clip if there's no extra args
        const clip = this.selectRandom(Object.keys(files));
        this.getQueue(voiceChannel).add(files[clip]);
        return;
      }

      const parameters = extraArgs.trim().split(' '); //.match(/(\b[\w,]+)/g);

      const filenames = Object.keys(files).filter(key => key.includes(parameters[0]));
      const clip = this.selectRandom(filenames);
      this.getQueue(voiceChannel).add(files[clip]);
      return;
    }
    // Err.. They asked for something we don't have
    log.debug(`Unrecognized command: ${message.content.toLowerCase()}`);
  }

  handleMessage(message) {
    const messageText = message.content.toLowerCase();
    const adminMatches = messageText.match(this.adminWordRegex);
    const keyWordMatches = messageText.match(this.keyWordRegex);

    if ((message.author.id == nconf.get('CLIENT_ID')) ||
        (!adminMatches && !keyWordMatches)) {
      // Don't talk to yourself, and only care about messages addressed to us
      return;
    }

    if (adminMatches) {
      log.silly("Admin match");
      return this.handleAdminMessage(message, adminMatches[2].trim());
    }

    log.silly("Regular match")
    return this.handleKeywordMessage(message, keyWordMatches[1], keyWordMatches[2]);
  }

  getVCFromUserid(userId) {
    log.debug(`Looking for an active voice channel for ${userId}`);
    const voiceChannel = this.discord.guilds.map(guild => guild.members.get(userId))
      .find(member => !!member && !!member.voiceChannel)
      .voiceChannel;
    log.debug(`Found voice channel ${voiceChannel}`);
    return voiceChannel;
  }

  initialize(session) {
    //TODO: Make this not choke if you provide an invalid admin_id or aren't in a channel
    var startup = nconf.get('startup');
    this.discord.fetchApplication().then(app => {
      nconf.set('CLIENT_ID', app.id); //Overrides environment variables
      var startup = nconf.get('startup');
      const adminList = nconf.get('adminList');
      adminList[app.owner.id] = {
        'access': adminUtils.getActions(),
        'immune': true
      };
      nconf.set('adminList', adminList);
      if (startup.enabled) {
        this.getQueue(this.getVCFromUserid(app.owner.id))
          .add(files[startup.clip]);
      }
    })
  }

  connect() {
    this.loadConfig();
    this.discord.on('message', message => {
      this.handleMessage(message);
    });
    this.discord.login(this.token).then(session => {
      this.initialize(session)
    });
    return this.discord;
  }
}

module.exports = DiscordBot