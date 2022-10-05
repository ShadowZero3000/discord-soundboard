import { SlashCommandBuilder } from 'discord.js'

import FileManager from '../FileManager.js'
const fm = FileManager.getInstance()

import AdminUtils from '../AdminUtils.js'
const utils = AdminUtils.getInstance()

import nconf from 'nconf'
const prefix = nconf.get('COMMAND_PREFIX') || ''

export let data = new SlashCommandBuilder()
    .setName(prefix+'removeclip')
    .setDescription('Remove a clip from the soundboard')
    .addStringOption(option => 
      option.setName('clipname')
        .setDescription('Name of the clip to remove')
        .setRequired(true)
        .setAutocomplete(true)
    )

export async function execute(interaction) {
  if (!utils.check_interaction(interaction, 'remove')) { // Permission scheme uses 'remove', not 'removeclip'
    return await interaction.reply({content: "You do not have permission to perform this operation", ephemeral: true})
  }

  const clipName = interaction.options.getString('clipname')

  if (!fm.inLibrary(clipName)) {
    return await interaction.reply({content: `'${clipName}' not found. Did you typo it?`, ephemeral: true})
  }
  if(fm.delete(clipName)) {
    return await interaction.reply({content: `'${clipName}' removed.`, ephemeral: true})
  }
}

export async function handleAutocomplete(interaction) {
  const focusedValue = interaction.options.getFocused();
  const choices = Object.keys(fm.getAll())
  const filtered = choices.filter(choice => choice.startsWith(focusedValue));
  await interaction.respond(
    filtered.map(choice => ({ name: choice, value: choice })),
  );
}