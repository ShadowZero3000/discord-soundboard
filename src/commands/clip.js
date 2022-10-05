import { SlashCommandBuilder, ModalBuilder, TextInputStyle, TextInputBuilder, ActionRowBuilder, SlashCommandAttachmentOption} from 'discord.js'
import { v1 as uuid } from 'uuid'
import { _extend } from 'util'

import FileManager from '../FileManager.js'
const fm = FileManager.getInstance()

import AdminUtils from '../AdminUtils.js'
const utils = AdminUtils.getInstance()

import nconf from 'nconf'
const prefix = nconf.get('COMMAND_PREFIX') || ''

var pendingUploads = {}

export let data = new SlashCommandBuilder()
    .setName(prefix+'clip')
    .setDescription('Manage soundboard clips')
    .addSubcommand(subcommand => 
      subcommand
        .setName('add')
        .setDescription('Add a clip')
        .addAttachmentOption(
          new SlashCommandAttachmentOption()
            .setDescription("Clip to upload")
            .setRequired(true)
            .setName('clip')
        )
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a clip')
        .addStringOption(option => 
          option.setName('clipname')
            .setDescription('Name of the clip to remove')
            .setRequired(true)
            .setAutocomplete(true)
        )
    )
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

async function move(interaction) {
  if (!utils.check_interaction(interaction, 'categorize')) { // Permission scheme uses 'categorize', not 'move'
    return await interaction.reply({content: "You do not have permission to perform this operation", ephemeral: true})
  }

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

async function rename(interaction) {
  if (!utils.check_interaction(interaction, 'rename')) { 
    return await interaction.reply({content: "You do not have permission to perform this operation", ephemeral: true})
  }

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

async function add(interaction) {
  if (!utils.check_interaction(interaction, 'add')) { // Permission scheme uses 'add', not 'addclip'
    return await interaction.reply({content: "You do not have permission to perform this operation", ephemeral: true})
  }
  
  var requestUUID = uuid()
  pendingUploads[requestUUID] = interaction.options.getAttachment('clip')

  const modal = new ModalBuilder()
    .setCustomId(`${prefix}clipModal${requestUUID}`)
    .setTitle('Add clip to Soundboard')
  const clipNameInput = new TextInputBuilder()
    .setCustomId('clipNameInput')
    .setLabel('Name of the clip')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(32)
    .setMinLength(2)
    .setRequired(true)
  const categoryInput = new TextInputBuilder()
    .setCustomId('categoryInput')
    .setLabel('Category for clip')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(32)
    .setMinLength(4)
    .setRequired(true)
    .setValue('misc')
  const subCategoryinput = new TextInputBuilder()
    .setCustomId('subcategoryInput')
    .setLabel('Sub-category for clip')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(32)
    .setMinLength(4)
    .setRequired(true)
    .setValue('misc')
  const firstActionRow = new ActionRowBuilder().addComponents(clipNameInput)
  const secondActionRow = new ActionRowBuilder().addComponents(categoryInput)
  const thirdActionRow = new ActionRowBuilder().addComponents(subCategoryinput)
  modal.addComponents(firstActionRow,secondActionRow,thirdActionRow)
  await interaction.showModal(modal)
}

async function remove(interaction) {
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

export async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand()


  if (subcommand == "move") { return move(interaction) }
  
  if (subcommand == "rename") { return rename(interaction) }
  
  if (subcommand == "add") { return add(interaction) }
  
  if (subcommand == "remove") { return remove(interaction) }

  return await interaction.reply({content: 'Invalid subcommand', ephemeral: true})
}

export async function handleModal(modalSubmission) {
  const uuid = modalSubmission.customId.split('Modal')[1]

  const clipName = modalSubmission.fields.getTextInputValue('clipNameInput')
  const category = modalSubmission.fields.getTextInputValue('categoryInput')
  const subcategory = modalSubmission.fields.getTextInputValue('subcategoryInput')
  const upload = _extend({}, pendingUploads[uuid]) // So we can delete the hash ref

  delete pendingUploads[uuid]

  if (!clipName.match(/^[a-z0-9_]+$/)) {
    return await modalSubmission.reply({content: `${clipName} is a bad short name`, ephemeral: true})
  }
  if (!category.match(/^[a-z0-9_]+$/)) {
    return await modalSubmission.reply({content: `${category} is a bad category name`, ephemeral: true})
  }
  if (!subcategory.match(/^[a-z0-9_]+$/)) {
    return await modalSubmission.reply({content: `${subcategory} is a bad subcategory name`, ephemeral: true})
  }
  if (fm.inLibrary(clipName)) {
    return await modalSubmission.reply({content: "That sound effect already exists", ephemeral: true})
  }
  if (!upload) {
    return await modalSubmission.reply({content: "Could not find upload", ephemeral: true})
  }

  fm.create(clipName, category, subcategory, upload);
  return await modalSubmission.reply({content: `${clipName} is now available`, ephemeral: true})
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

  const filtered = choices.filter(choice => choice.startsWith(focusedOption.value)).slice(0,25) // Only 25 options may be returned

  await interaction.respond(
    filtered.map(choice => ({ name: choice, value: choice })),
  );
}