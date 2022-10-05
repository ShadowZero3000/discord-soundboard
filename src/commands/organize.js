import { SlashCommandBuilder } from 'discord.js'

import FileManager from '../FileManager.js'
const fm = FileManager.getInstance()

import VoiceQueueManager from '../VoiceQueueManager.js'
const vqm = VoiceQueueManager.getInstance()

import AdminUtils from '../AdminUtils.js'
const utils = AdminUtils.getInstance()

import AccessManager from '../AccessManager.js'
const am = AccessManager.getInstance()

export let data = new SlashCommandBuilder()
    .setName('organize')
    .setDescription('Organize soundboard clips')
    .addSubcommand(subcommand => 
      subcommand
        .setName('rename')
        .setDescription('Rename a clip')
        .addStringOption(option => 
          option.setName('clipname')
            .setDescription('Name of the clip to rename')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption(option =>
          option.setName('newname')
            .setDescription('What to rename it to')
            .setRequired(true)
          )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('move')
        .setDescription('Change the category/subcategory of a clip')
        .addStringOption(option => 
          option.setName('clipname')
            .setDescription('Name of the clip to move')
            .setRequired(true)
            .setAutocomplete(true)
        )
        .addStringOption(option => 
          option
            .setName('category')
            .setDescription('What category to set the clip to')
            .setAutocomplete(true)
            .setRequired(true)
        )
        .addStringOption(option => 
          option
            .setName('subcategory')
            .setDescription('What subcategory to set the clip to')
            .setAutocomplete(true)
            .setRequired(true)
        )
    )

export async function execute(interaction) {

  const subcommand = interaction.options.getSubcommand()
  console.log(interaction)
  console.log(interaction.options)
  if (subcommand == "move") {
    const clip = interaction.options.getString('clipname')
    const category = interaction.options.getString('category')
    const subcategory = interaction.options.getString('subcategory')
    if (!category.match(/^[a-z0-9_]+$/)) {
      return await interaction.reply({content: `${category} is a bad category name`, ephemeral: true});
    }
    if (!subcategory.match(/^[a-z0-9_]+$/)) {
      return await interaction.reply({content: `${subcategory} is a bad subcategory name`, ephemeral: true});
    }

    if(fm.inLibrary(clip)) {
      fm.rename(clip, clip, category, subcategory);
      return await interaction.reply({content: `'${clip}'s category is now: ${category} - ${subcategory}`, ephemeral: true});
    } else {
      return await interaction.reply({content: `I don't recognize '${clip}'`, ephemeral: true});
    }
  }
  
  if (subcommand == "rename") {
    const clip = interaction.options.getString('clipname')
    const newName = interaction.options.getString('newname')
    if (!newName.match(/^[a-z0-9_]+$/)) {
      return await interaction.reply({content: `'${newName}' is a bad clip name`, ephemeral: true});
    }

    if(fm.inLibrary(clip)) {
      fm.rename(clip, newName);
      return await interaction.reply({content: `'${clip}' has been renamed to '${newName}'`, ephemeral: true});
    } else {
      return await interaction.reply({content: `I don't recognize ${clip}`, ephemeral: true});
    }
  }

  return await interaction.reply({content: 'Invalid subcommand', ephemeral: true})
}

export async function handleAutocomplete(interaction) {
  // If we need to filter based on subcommand:
  // const subcommand = interaction.options.getSubcommand()

  const focusedOption = interaction.options.getFocused(true);

  let choices

  if (focusedOption.name === 'clipname') {
    choices = Object.keys(fm.getAll())
  }
  if (focusedOption.name === 'category') {
    choices = Object.keys(fm.categories)
  }
  if (focusedOption.name === 'subcategory') {
    const category = interaction.options.getString('category')
    if (category != null) {
      choices = Object.keys(fm.categories[category])
    } else {
      choices = []
    }
  }

  const filtered = choices.filter(choice => choice.startsWith(focusedOption.value));

  await interaction.respond(
    filtered.map(choice => ({ name: choice, value: choice })),
  );
}