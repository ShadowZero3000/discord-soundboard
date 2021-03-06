const adminUtils = require('./AdminUtils.js');
const am = require('./AccessManager');
const Discord = require('discord.js');
const fm = require('./FileManager');
const log = require('./logger.js').errorLog;
const nconf = require('nconf');
const VoiceQueue = require('./VoiceQueue.js');
const vqm = require('./VoiceQueueManager');
const lm = require('./ListenerManager');

class DiscordBot {
  constructor() {
    this.client = new Discord.Client();
  }

  botHelp() {
    const selections = Object.keys(fm.getAll()).sort(() => 0.5 - Math.random()).slice(1,5);
    return `I'm a bot!\n` +
      `You can ask me to make sounds by saying one of the following:\n` +
      `\`${this.symbol}${selections.join(`\`, \`${this.symbol}`)}\`\n`;
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
    this.keyWordRegex = new RegExp(`([^@]|^)${this.safeSymbol}([a-z0-9_]+)(.*)`)
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
    if(nconf.get('LISTEN_ENABLED')){
      log.debug("Listening enabled")
      this.client.on('guildMemberSpeaking', this.handleSpeaking.bind(this))
    }
    return this.client;
  }

  processVoiceRecognition(userid, data) {
    if (data == undefined || data == '' || data == 'Too long') {
      return
    }
    log.debug(`Voice message: ${data}`)
    const voiceQueue = vqm.getQueueFromUser(this.client, userid);
    if (!voiceQueue) {
      return;
    }

    adminUtils._getHotPhrases()
      .filter(hotPhrase => hotPhrase.random)
      .every(hotPhrase => {
        if (` ${data} `.includes(` ${hotPhrase.phrase} `)) {
          voiceQueue.add(fm.random(hotPhrase.clip));
          return false
        }
        return true
      })
    adminUtils._getHotPhrases()
      .filter(hotPhrase => !hotPhrase.random)
      .every(hotPhrase => {
        if (` ${data} `.includes(` ${hotPhrase.phrase} `)) {
          voiceQueue.add(hotPhrase.clip);
          return false
        }
        return true
      })
  }

  getVCFromUserid(userId) {
    log.debug(`Looking for an active voice channel for ${userId}`);
    const voiceChannel =
      this.client.guilds.cache.map(guild => guild.voiceStates.cache.get(userId))
        .filter(voiceState => voiceState !== undefined)
        .map(user => user.guild.channels.cache.get(user.channelID))[0];
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
        + this.botAdminHelp(adminUtils.getUserActions(message)),
        {split: true});
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
    var voiceQueue
    try{
      voiceQueue = vqm.getQueueFromUser(this.client, message.member.id);
    } catch(e) {
      return message.reply(e.message)
    }
    if (!voiceQueue) {
      return;
    }

    // Access check for guilds with it turned on
    if (!am.checkAccess(message.author, message.guild, 'play')) {
      return;
    }

    if (fm.inLibrary(keyword)) {
      voiceQueue.add(keyword);
      return;
    }

    if (keyword == 'random') {
      if (!extraArgs) { // Play a random clip if there's no extra args
        voiceQueue.add(fm.random());
        return;
      }

      const clip = extraArgs.trim().split(' ')[0]; //.match(/(\b[\w,]+)/g);
      voiceQueue.add(fm.random(clip));
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
    return this.handleKeywordMessage(message, keyWordMatches[2], keyWordMatches[3]);
  }

  handleSpeaking(member, speaking) {
    if(!am.checkAccess(member.user, member.guild, 'vocalist') ||
        !lm.amIListeningTo(member.user.id)
      ) {
      return
    }

    try{
      var memberVoiceState = member.guild.voiceStates.cache.get(member.id)
      var voiceChannel = member.guild.channels.cache.get(memberVoiceState.channelID);
      if(speaking.bitfield) {
        var currentConnection = this.client.voice.connections.get(memberVoiceState.guild.id)
        lm.listen(member.user.id, currentConnection)
      }
      // Close the writeStream when a member stops speaking
      if (!speaking.bitfield && voiceChannel) {
        lm.finish(member.user.id, this.processVoiceRecognition.bind(this, member.id))
      }
    } catch(e) {log.debug(`Error handling speech: ${e.message}`)}
  }
  initialize(session) {
    //TODO: Make this not choke if you provide an invalid admin_id or aren't in a channel
    var startup = nconf.get('startup');
    this.client.fetchApplication().then(app => {
      nconf.set('CLIENT_ID', app.id); //Overrides environment variables
      var startup = nconf.get('startup');
      adminUtils._setImmuneUser(app.owner.id);
      if (startup.enabled) {
        var queue = undefined
        var vc = this.getVCFromUserid(app.owner.id)
        if(vc) {
          queue = vqm.getQueueFromChannel(vc)
        }
        if(queue) {
           queue.add(startup.clip);
        } else {
          log.debug(`No startup noise, you're not online.`)
        }
      }
    }).catch(err => {
      log.debug(`Error fetching application: ${err}`)
    })
  }
}

module.exports =  new DiscordBot();
