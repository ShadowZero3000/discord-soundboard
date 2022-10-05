import { SlashCommandBuilder } from 'discord.js'

import FileManager from '../FileManager.js'
const fm = FileManager.getInstance()

import VoiceQueueManager from '../VoiceQueueManager.js'
const vqm = VoiceQueueManager.getInstance()

import AdminUtils from '../AdminUtils.js'
const utils = AdminUtils.getInstance()

export let data = new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a clip from the soundboard')
    .addStringOption(option => 
      option.setName('clipname')
        .setDescription('Name of the clip to play')
        .setRequired(true)
        .setAutocomplete(true)
    )

export async function execute(interaction) {
  if (!utils.check_interaction(interaction, 'play')) { 
    return await interaction.reply({content: "You do not have permission to perform this operation", ephemeral: true})
  }
  const clipName = interaction.options.getString('clipname')


  if (!fm.inLibrary(clipName)) {
    return await interaction.reply({content: `I don't recognize ${clipName}`, ephemeral: true})
  }

  const voiceQueue = vqm.getQueueFromUser(interaction.user.id);
  voiceQueue.add(clipName);
  return await interaction.reply({content: 'Ok', ephemeral: true})
}

export async function handleAutocomplete(interaction) {
  const focusedValue = interaction.options.getFocused();
  const choices = Object.keys(fm.getAll())
  const filtered = choices.filter(choice => choice.startsWith(focusedValue));
  await interaction.respond(
    filtered.map(choice => ({ name: choice, value: choice })),
  );
}