import AdminUtils from './AdminUtils.js'
const adminUtils = AdminUtils.getInstance()

// Used in commented out hotphrase code
// import AccessManager from './AccessManager.js'
// const am = AccessManager.getInstance()

import { Client, Collection, GatewayIntentBits, Routes } from 'discord.js'

// Used in commented out hotphrase code
// import FileManager from './FileManager.js'
// const fm = FileManager.getInstance()

import { errorLog } from './logger.js'
const log = errorLog

import nconf from 'nconf'

import VoiceQueueManager from './VoiceQueueManager.js'
const vqm = VoiceQueueManager.getInstance()

// import ListenerManager from './ListenerManager.js'
// const lm = new ListenerManager()

export default class DiscordBot {
  constructor() {
    throw new Error('Use DiscordBot.getInstance()')
  }
  static getInstance() {
    if (!DiscordBot.instance) {
      DiscordBot.instance = new PrivateDiscordBot()
    }
    return DiscordBot.instance
  }
}

import path from 'path'
import fs from 'fs'
import * as url from 'url'
const __filename = url.fileURLToPath(import.meta.url)
const __dirname = url.fileURLToPath(new URL('.', import.meta.url))

class PrivateDiscordBot {
  constructor() {
    this.token = nconf.get('TOKEN')
  
    // Can probably drop the messagecontent in the future if we use slash commands
    this.client = new Client({ intents: [
      GatewayIntentBits.Guilds, //GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildVoiceStates
      ]})

    this.client.commands = new Collection()

    const commandsPath = path.join(__dirname, 'commands')
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'))

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file)
      import(filePath).then(command =>{
        // Set a new item in the Collection
        // With the key as the command name and the value as the exported module
        this.client.commands.set(command.data.name, command)
      })
    }
  }

  async register_commands() {
    // This should only happen once. So we need to check if they already are registered, and update them only when needed I guess
    const commands = []
    const commandsPath = path.join(__dirname, 'commands')
    const commandFiles = fs.readdirSync(commandsPath)
      .filter(file => file.endsWith('.js'))
      .filter(file => file != 'updatecommands.js')
      .filter(file => file != 'phrases.js') // Disable phrases for now

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file)
      const command = await import(filePath)

      commands.push(command.data.toJSON())
    }

    const rest = this.client.rest
    var cid = this.client.application.id
    var [gid] = this.client.guilds.cache.keys()

    rest.put(Routes.applicationCommands(cid), { body: commands })
      .then((data) => log.debug(`Successfully registered ${data.length} application commands.`))
      .catch(log.error)
  }

  async register_self_update() {
    // This should only happen once, if the self-updating command isn't registered.
    // Basically this lets us bootstrap on the fly, and only update our commands when we want to
    // On initial bootstrap, this will add the 'update_commands' command.
    const commands = []
    const commandsPath = path.join(__dirname, 'commands')
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file == 'updatecommands.js')

    for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file)
      const command = await import(filePath)

      commands.push(command.data.toJSON())
    }

    const rest = this.client.rest
    var cid = this.client.application.id
    var [gid] = this.client.guilds.cache.keys()

    rest.get(Routes.applicationGuildCommands(cid, gid))
      .then((data) => {
        var command = data.filter(item => item.name == commands[0].name)
        if (command.length == 0) {
          rest.put(Routes.applicationGuildCommands(cid, gid), { body: commands })
            .then((data) => {
              log.debug(`Successfully registered ${data.length} application commands.`)
              log.debug(`You will need to run 'update_commands' to add commands to the server`)
            })
            .catch(log.error)
        }
      })
  }

  listen_to_commands() {
    this.client.on('interactionCreate', async interaction => {
      if (!interaction.isChatInputCommand()) return

      const command = interaction.client.commands.get(interaction.commandName)

      if (!command) return

      try {
        await command.execute(interaction)
      } catch (error) {
        log.error(error.message)
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true })
      }
    })

    this.client.on('interactionCreate', async interaction => {
      if (!interaction.isModalSubmit()) return

      const commandName = interaction.customId.split('Modal')[0]
      const command = interaction.client.commands.get(commandName)

      if (!command) return

      try {
        await command.handleModal(interaction)
      } catch (error) {
        log.error(error.message)
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true })
      }
    })

    this.client.on('interactionCreate', async interaction => {
      if (!interaction.isSelectMenu()) return
      const commandName = interaction.customId.split('SelectMenu')[0]
      const command = interaction.client.commands.get(commandName)

      if (!command) return

      try {
        await command.handleSubmission(interaction)
      } catch (error) {
        log.error(error.message)
        await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true })
      }
    })

    this.client.on('interactionCreate', async interaction => {
      if (!interaction.isAutocomplete()) return

      const command = interaction.client.commands.get(interaction.commandName)
      if (!command) return

      try {
        await command.handleAutocomplete(interaction)
      } catch (error) {
        log.error(error.message)
      }
    })
  }

  connect() {
    this.client.once('ready', (client) => {
      nconf.set('CLIENT_ID', client.application.id); //Overrides environment variables
      const startup = nconf.get('startup')
      client.application.fetch().then(app => {
        adminUtils.setImmuneUser(app.owner.id)
        if (startup.enabled) {
          try {
            const vc = vqm.getVCFromUserid(app.owner.id)
            if (vc !== undefined) {
              vqm.getQueueFromChannel(vc)
                 .add(startup.clip)
            }
          } catch(e) {
            log.debug(e.message)
          }
        }
      })

      this.register_self_update()
      this.listen_to_commands()
    })

    this.client.login(this.token).catch(err => {
      log.debug(`Connection error in DiscordBot: ${err}`)
    })

    // if(nconf.get('LISTEN_ENABLED')){
    //   log.debug("Listening enabled")
    //   this.client.on('guildMemberSpeaking', this.handleSpeaking.bind(this))
    // }

    return this.client
  }

  // processVoiceRecognition(userid, data) {
  //   if (data == undefined || data == '' || data == 'Too long') {
  //     return
  //   }
  //   log.debug(`Voice message: ${data}`)
  //   const voiceQueue = vqm.getQueueFromUser(userid)
  //   if (!voiceQueue) {
  //     return
  //   }

  //   adminUtils.getHotPhrases()
  //     .filter(hotPhrase => hotPhrase.random)
  //     .every(hotPhrase => {
  //       if (` ${data} `.includes(` ${hotPhrase.phrase} `)) {
  //         voiceQueue.add(fm.random(hotPhrase.clip))
  //         return false
  //       }
  //       return true
  //     })
  //   adminUtils.getHotPhrases()
  //     .filter(hotPhrase => !hotPhrase.random)
  //     .every(hotPhrase => {
  //       if (` ${data} `.includes(` ${hotPhrase.phrase} `)) {
  //         voiceQueue.add(hotPhrase.clip)
  //         return false
  //       }
  //       return true
  //     })
  // }

  // handleSpeaking(member, speaking) {
  //   if(!am.checkAccess(member.user, member.guild, 'vocalist') ||
  //       !lm.amIListeningTo(member.user.id)
  //     ) {
  //     return
  //   }

  //   try{
  //     var memberVoiceState = member.guild.voiceStates.cache.get(member.id)
  //     var voiceChannel = member.guild.channels.cache.get(memberVoiceState.channelID)
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
}

