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
    .setName(prefix+'addclip')
    .setDescription('Adds a clip to the soundboard')
    .addAttachmentOption(
      new SlashCommandAttachmentOption()
        .setDescription("Clip to upload")
        .setRequired(true)
        .setName('clip')
    )

export async function execute(interaction) {
  if (!utils.check_interaction(interaction, 'add')) { // Permission scheme uses 'add', not 'addclip'
    return await interaction.reply({content: "You do not have permission to perform this operation", ephemeral: true})
  }
  
  var requestUUID = uuid()
  pendingUploads[requestUUID] = interaction.options.getAttachment('clip')

  const modal = new ModalBuilder()
    .setCustomId(`${prefix}addclipModal${requestUUID}`)
    .setTitle('Add clip to Soundboard')
  const clipNameInput = new TextInputBuilder()
    .setCustomId('clipNameInput')
    .setLabel('Name of the clip')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(32)
    .setMinLength(2)
    .setRequired(true)
    .setValue('test')
  const categoryInput = new TextInputBuilder()
    .setCustomId('categoryInput')
    .setLabel('Category for clip')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(32)
    .setMinLength(4)
    .setRequired(true)
    .setValue('test')
  const subCategoryinput = new TextInputBuilder()
    .setCustomId('subcategoryInput')
    .setLabel('Sub-category for clip')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(32)
    .setMinLength(4)
    .setRequired(true)
    .setValue('test')
  const firstActionRow = new ActionRowBuilder().addComponents(clipNameInput)
  const secondActionRow = new ActionRowBuilder().addComponents(categoryInput)
  const thirdActionRow = new ActionRowBuilder().addComponents(subCategoryinput)
  modal.addComponents(firstActionRow,secondActionRow,thirdActionRow)
  await interaction.showModal(modal)
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