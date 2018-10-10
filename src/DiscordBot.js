const adminUtils = require('./AdminUtils.js');
const am = require('./AccessManager');
const Discord = require('discord.js');
const fm = require('./FileManager');
const log = require('./logger.js').errorLog;
const nconf = require('nconf');
const VoiceQueue = require('./VoiceQueue.js');
const vqm = require('./VoiceQueueManager');

class DiscordBot {
  constructor() {
    this.client = new Discord.Client();
  }

  botHelp() {
    return `I'm a bot!\n` +
      `You can ask me to make sounds by saying one of the following:\n` +
      `\`${this.symbol}${Object.keys(fm.getAll()).sort().join(`\`, \`${this.symbol}`)}\`\n`;
  }

  botAdminHelp(permissions) {
    if (permissions == []) {
      return '';
    }
    return '----\n' +
      'You can also use:\n'  +
      `\`${this.symbol}${this.adminWords[0]} ` +
      permissions.join(`\`, \`${this.symbol}${this.adminWords[0]} `) + '`';
  }

  configure(token) {
    this.token = token;
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

  connect() {
    this.client.on('message', message => {
      this.handleMessage(message);
    });
    this.client.login(this.token).then(session => {
      this.initialize(session)
    }).catch(err => {
      log.debug(`Connection error in DiscordBot: ${err}`)
    });
    return this.client;
  }

  getVCFromUserid(userId) {
    log.debug(`Looking for an active voice channel for ${userId}`);
    const voiceChannel =
      this.client.guilds.map(guild => guild.voiceStates.get(userId))
        .filter(voiceState => voiceState !== undefined)
        .map(user => user.guild.channels.get(user.channelID))[0];
    log.debug(`Found voice channel ${voiceChannel}`);
    return voiceChannel;
  }

  getVoiceChannel(message) {
    if (!message.member) {
      message.reply("You don't appear to be in a voice channel!");
      return null;
    }
    return this.getVCFromUserid(message.member.id);
  }

  handleAdminMessage(message, command) {
    const commandArray = command.split(' ')
    if (!command || commandArray.indexOf("help") == 0) { // bot help
      return message.reply(this.botHelp()
        + this.botAdminHelp(adminUtils.getUserActions(message)));
    }

    if (commandArray.indexOf("leave") == 0) { // bot leave
      const voiceChannel = this.getVoiceChannel(message);
      if (voiceChannel) {
        voiceChannel.leave();
      }
      return;
    }

    // POTENTIAL PROBLEM: If you haven't joined a voice channel, some admin commands might not work
    // Will have to ensure that we add check logic lower down
    if (commandArray[0] in adminUtils.reverseAccessMap
         && adminUtils.check(message, commandArray[0])) {
      return adminUtils[commandArray.shift()](message, commandArray);
    }

    return;
  }

  handleKeywordMessage(message, keyword, extraArgs) {
    // Time for some audio!
    //var botRole=am.getRoleByName('Bot Interactions', message.guild)
    const voiceChannel = this.getVoiceChannel(message);
    if (!voiceChannel) {
      return;
    }

    // Access check for guilds with it turned on
    if (!am.checkAccess(message.author, message.guild, 'play')) {
      return;
    }

    if (fm.inLibrary(keyword)) {
      vqm.getQueueFromChannel(voiceChannel).add(keyword);
      return;
    }

    if (keyword == 'random') {
      if (!extraArgs) { // Play a random clip if there's no extra args
        vqm.getQueueFromChannel(voiceChannel).add(fm.random());
        return;
      }

      const clip = extraArgs.trim().split(' ')[0]; //.match(/(\b[\w,]+)/g);
      vqm.getQueueFromChannel(voiceChannel).add(fm.random(clip));
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

    message.dclient=this.client;

    if (adminMatches) {
      log.silly("Admin match");
      return this.handleAdminMessage(message, adminMatches[2].trim());
    }

    log.silly("Regular match")
    return this.handleKeywordMessage(message, keyWordMatches[1], keyWordMatches[2]);
  }

  initialize(session) {
    //TODO: Make this not choke if you provide an invalid admin_id or aren't in a channel
    var startup = nconf.get('startup');
    this.client.fetchApplication().then(app => {
      nconf.set('CLIENT_ID', app.id); //Overrides environment variables
      var startup = nconf.get('startup');
      adminUtils._setImmuneUser(app.owner.id);
      if (startup.enabled) {
        vqm.getQueueFromChannel(this.getVCFromUserid(app.owner.id))
           .add(startup.clip);
      }
    }).catch(err => {
      log.debug(`Error fetching application: ${err}`)
    })
  }
}

module.exports =  new DiscordBot();
