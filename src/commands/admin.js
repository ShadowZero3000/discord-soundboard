import { SlashCommandBuilder } from 'discord.js'

import AdminUtils from '../AdminUtils.js'
const utils = AdminUtils.getInstance()

import nconf from 'nconf'
const prefix = nconf.get('COMMAND_PREFIX') || ''

import VoiceQueueManager from '../VoiceQueueManager.js'
const vqm = VoiceQueueManager.getInstance()

import FileManager from '../FileManager.js'
const fm = FileManager.getInstance()

export let data = new SlashCommandBuilder()
  .setName(prefix+'admin')
  .setDescription('Administrative commands')
  .addSubcommand(subcommand => 
    subcommand
      .setName('silence')
      .setDescription('Silence the bot')
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('startup_config')
      .setDescription('Configure startup settings')
      .addBooleanOption(option =>
        option
          .setName('enabled')
          .setDescription('Make noise on startup?')
      )
      .addStringOption(option =>
        option
          .setName('clipname')
          .setDescription('What clip to play on startup?')
          .setAutocomplete(true)
      )
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('unmute')
      .setDescription('Un-silence the bot')
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('whereareyou')
      .setDescription('Find out what servers this bot is available in')
  )

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand()


  if (subcommand == "silence") { return silence(interaction) }
  if (subcommand == "unmute") { return unmute(interaction) }
  if (subcommand == "startup_config") { return startup_config(interaction) }
  if (subcommand == "whereareyou") { return whereareyou(interaction) }

  return await interaction.reply({content: 'Invalid subcommand', ephemeral: true})
}

async function silence(interaction) {
  if (!utils.check_interaction(interaction, 'silence')) { 
    return await interaction.reply({content: "You do not have permission to perform this operation", ephemeral: true})
  }

  try {
    var queue = vqm.getQueueFromMessage(interaction)
    if(queue){
      queue.silence();
    }
    return await interaction.reply({content: "Oooooh kaaaaay. I'll go sit in a corner for a while and think about what I did.", ephemeral: true})
  } catch (e) {
    return await interaction.reply({content: e.message, ephemeral: true})
  }
}

async function startup_config(interaction) {
  if (!utils.check_interaction(interaction, 'togglestartup')) { 
    return await interaction.reply({content: "You do not have permission to perform this operation", ephemeral: true})
  }

  let startup = nconf.get('startup');
  const enabled = interaction.options.getBoolean('enabled')
  const clipname = interaction.options.getString('clipname')

  if (enabled !== null) {
    startup['enabled'] = enabled;
  }
  if (clipname !== null) {
    startup['clip'] = clipname
  }
  utils.saveConfig('startup', startup);

  return await interaction.reply({content: `Startup audio set: ${startup['enabled']} - ${startup['clip']}`, ephemeral: true})
}

async function unmute(interaction) {
  if (!utils.check_interaction(interaction, 'unmute')) { 
    return await interaction.reply({content: "You do not have permission to perform this operation", ephemeral: true})
  }

  try {
    var queue = vqm.getQueueFromMessage(interaction)
    if(queue) {
      queue.unsilence()
    }
    return await interaction.reply({content: "Ok, ready to make some noise.", ephemeral: true})
  } catch (e) {
    return await interaction.reply({content: e.message, ephemeral: true})
  }
}

async function whereareyou(interaction) {
  if (!utils.check_interaction(interaction, 'whereareyou')) { 
    return await interaction.reply({content: "You do not have permission to perform this operation", ephemeral: true})
  }

  return await interaction.reply({content: `I'm available in the following servers: \n`+
    interaction.client.guilds.cache.map(guild => guild.name).join('\n'), ephemeral: true});
}

export async function handleAutocomplete(interaction) {
  // If we need to filter based on subcommand:
  // const subcommand = interaction.options.getSubcommand()

  const focusedOption = interaction.options.getFocused(true);

  let choices

  if (focusedOption.name === 'clipname') {
    choices = Object.keys(fm.getAll())
  }

  const filtered = choices.filter(choice => choice.startsWith(focusedOption.value)).slice(0,25) // Only 25 options may be returned

  await interaction.respond(
    filtered.map(choice => ({ name: choice, value: choice })),
  );
}