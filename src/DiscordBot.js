import AdminUtils from './AdminUtils.js'
const adminUtils = AdminUtils.getInstance()

import AccessManager from './AccessManager.js'
const am = AccessManager.getInstance()

import { Client, Collection, GatewayIntentBits, Routes } from 'discord.js'

import FileManager from './FileManager.js'
const fm = FileManager.getInstance()

import { errorLog } from './logger.js'
const log = errorLog

import nconf from 'nconf'

import VoiceQueueManager from './VoiceQueueManager.js'
const vqm = VoiceQueueManager.getInstance()

// import ListenerManager from './ListenerManager.js'
// const lm = new ListenerManager()

export default class DiscordBot {
  constructor() {
    throw new Error('Use DiscordBot.getInstance()');
  }
  static getInstance() {
    if (!DiscordBot.instance) {
      DiscordBot.instance = new PrivateDiscordBot();
    }
    return DiscordBot.instance;
  }
}

import path from 'path'
import fs from 'fs'
import * as url from 'url';
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

class PrivateDiscordBot {
  constructor() {
    this.token = nconf.get('TOKEN');
    this.adminWords = nconf.get('ADMIN_KEYS').split(',');
    this.symbol = nconf.get('KEY_SYMBOL');
    this.safeSymbol = this.symbol;
    // Must escape some special regex chars
    if (['$','^','(','['].indexOf(this.symbol) > -1) {
      this.safeSymbol = `\\${this.symbol}`;
    }
    this.adminWordRegex = new RegExp(`^${this.safeSymbol}(${this.adminWords.join('|')})(.*)$`)
    this.keyWordRegex = new RegExp(`${this.safeSymbol}([a-z0-9_]+)(.*)`)
  
    // Can probably drop the messagecontent in the future if we use slash commands
    this.client = new Client({ intents: [
      GatewayIntentBits.Guilds, //GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates
      ]});

    this.client.commands = new Collection()

    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      import(filePath).then(command =>{

      // Set a new item in the Collection
      // With the key as the command name and the value as the exported module
      this.client.commands.set(command.data.name, command);
      })
    }

  }

  async register_commands() {
    // This should only happen once. So we need to check if they already are registered, and update them only when needed I guess
    const commands = [];
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = await import(filePath)

      commands.push(command.data.toJSON());
    }

    const rest = this.client.rest
    var cid = this.client.application.id
    var [gid] = this.client.guilds.cache.keys()
    rest.put(Routes.applicationGuildCommands(cid, gid), { body: commands })
      .then((data) => log.debug(`Successfully registered ${data.length} application commands.`))
      .catch(log.error);
  }

  async register_self_update() {
    // This should only happen once, if the self-updating command isn't registered.
    // Basically this lets us bootstrap on the fly, and only update our commands when we want to
    // On initial bootstrap, this will add the 'update_commands' command.
    const commands = [];
    const commandsPath = path.join(__dirname, 'commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file == 'updatecommands.js');
    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      const command = await import(filePath)

      commands.push(command.data.toJSON());
    }

    const rest = this.client.rest
    var cid = this.client.application.id
    var [gid] = this.client.guilds.cache.keys()

    rest.get(Routes.applicationGuildCommands(cid, gid))
      .then((data) => {
        var command = data.filter(item => item.name == 'update_commands')
        if (command.length == 0) {
          rest.put(Routes.applicationGuildCommands(cid, gid), { body: commands })
            .then((data) => {
              log.debug(`Successfully registered ${data.length} application commands.`)
              log.debug(`You will need to run 'update_commands' to add commands to the server`)
            })
            .catch(log.error);
        }
      })
  }

  listen_to_commands() {
    this.client.on('interactionCreate', async interaction => {
      if (!interaction.isChatInputCommand()) return;

      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (error) {
        log.error(error.message);
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
      }
    });

    this.client.on('interactionCreate', async interaction => {
      if (!interaction.isModalSubmit()) return;

      const commandName = interaction.customId.split('Modal')[0]
      const command = interaction.client.commands.get(commandName);

      if (!command) return;

      try {
        await command.handleModal(interaction);
      } catch (error) {
        log.error(error.message);
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
      }
    });

    this.client.on('interactionCreate', async interaction => {
      if (!interaction.isSelectMenu()) return;
      const commandName = interaction.customId.split('SelectMenu')[0]
      const command = interaction.client.commands.get(commandName);

      if (!command) return;

      try {
        await command.handleSubmission(interaction);
      } catch (error) {
        log.error(error.message);
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
      }
    });

    this.client.on('interactionCreate', async interaction => {
      if (!interaction.isAutocomplete()) return;

      const command = interaction.client.commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.handleAutocomplete(interaction);
      } catch (error) {
        log.error(error.message);
      }
    });
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

  connect() {
    this.client.once('ready', (client) => {
      nconf.set('CLIENT_ID', client.application.id); //Overrides environment variables
      var startup = nconf.get('startup');
      client.application.fetch().then(app => {
        adminUtils._setImmuneUser(app.owner.id);
        if (startup.enabled) {
          const vc = this.getVCFromUserid(app.owner.id)
          if (vc !== undefined) {
            vqm.getQueueFromChannel(vc)
               .add(startup.clip);
          }
        }
      })

      // You should need to run this once during initial bot creation. Probably need better logic for that
      // this.register_commands()
      this.register_self_update()
      this.listen_to_commands()
    });

    this.client.on('messageCreate', message => {
      this.handleMessage(message);
    });
    this.client.login(this.token).catch(err => {
      log.debug(`Connection error in DiscordBot: ${err}`)
    });
    // if(nconf.get('LISTEN_ENABLED')){
    //   log.debug("Listening enabled")
    //   this.client.on('guildMemberSpeaking', this.handleSpeaking.bind(this))
    // }
    return this.client;
  }

  processVoiceRecognition(userid, data) {
    if (data == undefined || data == '' || data == 'Too long') {
      return
    }
    log.debug(`Voice message: ${data}`)
    const voiceQueue = vqm.getQueueFromUser(userid);
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
        .map(voiceState => voiceState.channel)
    if (voiceChannel.length > 0) {
      log.debug(`Found voice channel ${voiceChannel[0].id}`);
      return voiceChannel[0];
    } else {
      log.debug(`No voice channel located for ${userId}`)
      return undefined
    }
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
      voiceQueue = vqm.getQueueFromUser(message.member.id);
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

  // handleSpeaking(member, speaking) {
  //   if(!am.checkAccess(member.user, member.guild, 'vocalist') ||
  //       !lm.amIListeningTo(member.user.id)
  //     ) {
  //     return
  //   }

  //   try{
  //     var memberVoiceState = member.guild.voiceStates.cache.get(member.id)
  //     var voiceChannel = member.guild.channels.cache.get(memberVoiceState.channelID);
  //     if(speaking.bitfield) {
  //       var currentConnection = this.client.voice.connections.get(memberVoiceState.guild.id)
  //       lm.listen(member.user.id, currentConnection)
  //     }
  //     // Close the writeStream when a member stops speaking
  //     if (!speaking.bitfield && voiceChannel) {
  //       lm.finish(member.user.id, this.processVoiceRecognition.bind(this, member.id))
  //     }
  //   } catch(e) {log.debug(`Error handling speech: ${e.message}`)}
  // }

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

