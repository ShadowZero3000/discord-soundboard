import { SlashCommandBuilder } from 'discord.js'

import FileManager from '../FileManager.js'
const fm = FileManager.getInstance()

import VoiceQueueManager from '../VoiceQueueManager.js'
const vqm = VoiceQueueManager.getInstance()

import AdminUtils from '../AdminUtils.js'
const utils = AdminUtils.getInstance()

import AccessManager from '../AccessManager.js'
const am = AccessManager.getInstance()

import nconf from 'nconf'
const prefix = nconf.get('COMMAND_PREFIX') || ''

export let data = new SlashCommandBuilder()
  .setName(prefix+'phrase')
  .setDescription('Control the hotphrase features')
  .addSubcommand(subcommand => 
    subcommand
      .setName('remove')
      .setDescription('Remove a hotphrase')
      .addStringOption(option =>
        option
          .setName('phrase')
          .setDescription('Which phrase to remove')
          .setAutocomplete(true)
          .setRequired(true)
      )
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('add')
      .setDescription('Trigger a particular clip when a phrase is heard')
      .addStringOption(option =>
        option
          .setName('phrase')
          .setDescription('Which phrase to listen for')
          .setRequired(true)
      )
      .addStringOption(option =>
        option
          .setName('clipname')
          .setDescription('Which random clip to play')
          .setRequired(true)
          .setAutocomplete(true)
      )
      .addBooleanOption(option =>
        option
          .setName('random')
          .setDescription('Use a random clip that matches the clip name')
      )
  )
  .addSubcommand(subcommand => 
    subcommand
      .setName('list')
      .setDescription('List phrases the bot listens for')
    )

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand()

  if (subcommand == "add") { return add(interaction) }
  if (subcommand == "remove") { return remove(interaction) }
  if (subcommand == "list") { return list(interaction) }

  return await interaction.reply({content: 'Invalid subcommand', ephemeral: true})
}

async function remove(interaction) {
  const toremove = interaction.options.getString('phrase')
  const phrase = utils.hotPhrases.filter(p => p.phraseId == toremove)[0]
  utils.hotPhrases = utils.hotPhrases.filter(phrase => phrase.phraseId != toremove)
  utils.HotPhraseStore.set('hotphrases', utils.hotPhrases)

  return await interaction.reply({content: `'${phrase.phrase} (${phrase.clip})' removed.`, ephemeral: true})
}

async function add(interaction) {
  const hotPhrase = interaction.options.getString('phrase')
  const clipName = interaction.options.getString('clipname')
  const randomInput = interaction.options.getBoolean('random')
  var random = false
  if (randomInput !== null) {
    random = randomInput
  }

  if ((!random && !fm.inLibrary(clipName)) || (random && !fm.inRandoms(clipName))) {
    return await interaction.reply({content: `Clip not found: ${clipName}`, ephemeral: true})
  }

  utils.hotPhrases.push({clip: clipName, phrase: hotPhrase, random: random, phraseId: new Date().getTime()})
  utils.HotPhraseStore.set('hotphrases', utils.hotPhrases)
  return await interaction.reply({content: `I'll be listening.`, ephemeral: true})
}

async function list(interaction) {
  var result = utils.hotPhrases.map(phrase => {
    return `${phrase.phraseId}: ${phrase.phrase} (${phrase.random?'random - ':''}\`${phrase.clip}\`)`
  })
  return await interaction.reply({content: "Hot phrases: \n" + result.join('\n'), split: true, ephemeral: true})
}

export async function handleAutocomplete(interaction) {
  // If we need to filter based on subcommand:
  // const subcommand = interaction.options.getSubcommand()

  const focusedOption = interaction.options.getFocused(true);

  let choices

  if (focusedOption.name === 'clipname') {
    choices = Object.keys(fm.getAll())
  }
  if (focusedOption.name === 'phrase') {
    choices = utils.hotPhrases.map(p => { return {'name':`${p.phrase} (${p.clip})`, 'value': `${p.phraseId}`}})
    const filtered = choices.filter(choice => choice['name'].startsWith(focusedOption.value)).slice(0,25) // Only 25 options may be returned

    return await interaction.respond(filtered);
  }

  const filtered = choices.filter(choice => choice.startsWith(focusedOption.value)).slice(0,25) // Only 25 options may be returned

  return await interaction.respond(
    filtered.map(choice => ({ name: choice, value: choice })),
  );
}