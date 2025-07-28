import { SlashCommandBuilder, MessageFlags } from 'discord.js'

import FileManager from '../FileManager.js'

import VoiceQueueManager from '../VoiceQueueManager.js'

import AdminUtils from '../AdminUtils.js'

import nconf from 'nconf'
const fm = FileManager.getInstance()
const vqm = VoiceQueueManager.getInstance()
const utils = AdminUtils.getInstance()
const prefix = nconf.get('COMMAND_PREFIX') || ''

export const data = new SlashCommandBuilder()
  .setName(prefix + 'play')
  .setDescription('Play a clip from the soundboard')
  .addStringOption(option =>
    option.setName('clipname')
      .setDescription('Name of the clip to play')
      .setRequired(true)
      .setAutocomplete(true)
  )

export async function execute (interaction) {
  if (!utils.check_interaction(interaction, 'play')) {
    return await interaction.reply({ content: 'You do not have permission to perform this operation', flags: MessageFlags.Ephemeral })
  }
  const clipName = interaction.options.getString('clipname')

  if (!fm.inLibrary(clipName)) {
    return await interaction.reply({ content: `I don't recognize ${clipName}`, flags: MessageFlags.Ephemeral })
  }

  try {
    const voiceQueue = await vqm.getQueueFromUser(interaction.user.id)
    voiceQueue.add(clipName)
  } catch (error) {
    console.log(error)
    return await interaction.reply({ content: 'You don\'t appear to be in a voice channel', flags: MessageFlags.Ephemeral })
  }
  return await interaction.reply({ content: 'Ok', flags: MessageFlags.Ephemeral })
}

export async function handleAutocomplete (interaction) {
  const focusedValue = interaction.options.getFocused()
  const choices = Object.keys(fm.getAll())
  const filtered = choices.filter(choice => choice.startsWith(focusedValue))
  await interaction.respond(
    filtered.map(choice => ({ name: choice, value: choice }))
  )
}
