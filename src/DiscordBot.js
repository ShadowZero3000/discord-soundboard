const Discord = require('discord.js');
const nconf = require('nconf');
const adminUtils = require('./AdminUtils.js')
const utils = require('./utils.js')
const files = utils.files
const queues = utils.queues;
const log = require('./logger.js').errorLog;
const VoiceQueue = require('./VoiceQueue.js');

class DiscordBot {
  constructor() {
    this.client = new Discord.Client();
  }

  botHelp() {
    return `I'm a bot!\n` +
      `You can ask me to make sounds by saying one of the following:\n` +
      `\`${this.symbol}${Object.keys(files).sort().join(`\`, \`${this.symbol}`)}\`\n` +
      '----\n' +
      'Admins can also use:\n'  +
      `\`${this.symbol}${this.adminWords[0]} ` +
      adminUtils.getActions().sort().join(`\`, \`${this.symbol}${this.adminWords[0]} `) +
      '`';
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

  getVoiceChannel(message) {
    if (message.member && message.member.voiceChannel) {
      return message.member.voiceChannel;
    }
    message.reply("You don't appear to be in a voice channel!");
    return null;
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
        const clip = utils.selectRandom(Object.keys(files));
        this.getQueue(voiceChannel).add(files[clip]);
        return;
      }

      const parameters = extraArgs.trim().split(' '); //.match(/(\b[\w,]+)/g);

      const filenames = Object.keys(files).filter(key => key.includes(parameters[0]));
      const clip = utils.selectRandom(filenames);
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

  initialize(session) {
    //TODO: Make this not choke if you provide an invalid admin_id or aren't in a channel
    var startup = nconf.get('startup');
    this.client.fetchApplication().then(app => {
      nconf.set('CLIENT_ID', app.id); //Overrides environment variables
      var startup = nconf.get('startup');
      const adminList = nconf.get('adminList');
      adminList[app.owner.id] = {
        'access': adminUtils.getActions(),
        'immune': true
      };
      nconf.set('adminList', adminList);
      if (startup.enabled) {
        utils.getQueueFromUser(this.client, app.owner.id)
          .add(files[startup.clip]);
      }
    }).catch(err => {
      log.debug(`Error fetching application: ${err}`)
    })
  }
}
const bot = new DiscordBot();
module.exports = bot;