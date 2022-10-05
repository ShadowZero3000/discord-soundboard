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
    .setName('access')
    .setDescription('Control access to soundboard features')
    .addSubcommand(subcommand => 
      subcommand
        .setName('get')
        .setDescription('Info about user access')
        .addUserOption(option => option.setName('user').setDescription('The user'))
        .addRoleOption(option => option.setName('role').setDescription('The role'))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('grant')
        .setDescription('Grant a user or role access')
        .addStringOption(option => 
          option
            .setName('privilege')
            .setDescription('What privilege to grant')
            .setAutocomplete(true)
            .setRequired(true)
        )
        .addUserOption(option => option.setName('user').setDescription('The user'))
        .addRoleOption(option => option.setName('role').setDescription('The role'))
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('revoke')
        .setDescription('Revoke a user access')
        .addStringOption(option => 
          option
            .setName('privilege')
            .setDescription('What privilege to revoke')
            .setAutocomplete(true)
            .setRequired(true)
        )
        .addUserOption(option => option.setName('user').setDescription('The user'))
        .addRoleOption(option => option.setName('role').setDescription('The role'))
    )

export async function execute(interaction) {

  const subcommand = interaction.options.getSubcommand()

  if (subcommand == "get") {

    const user = interaction.options.getUser('user')
    const role = interaction.options.getRole('role')

    if (user !== null) {
      let response = `${user.username} has: `
      response += am.getUserAccess(user).sort().join(', ')
      return await interaction.reply({content: response, ephemeral: true})
    }
    if (role !== null) {
      let response = `${role.name} has: `
      response += am.getRolePrivileges(role).sort().join(', ')
      return await interaction.reply({content: response, ephemeral: true})
    }
  }

  if (subcommand == "grant") {
    if (!utils.check_interaction(interaction, 'grant')) { 
      return await interaction.reply({content: "You do not have permission to perform this operation", ephemeral: true})
    }

    const user = interaction.options.getUser('user')
    const role = interaction.options.getRole('role')
    const privilege = interaction.options.getString('privilege')

    if (user !== null) {
      am.grantUserAccessById(user.id, privilege)
    }

    if (role !== null) {
      am.grantRoleAccessById(role.id, role.guild.id, privilege)
    }

    return await interaction.reply({content: 'Access granted', ephemeral: true})
  }

  if (subcommand == "revoke") {
    if (!utils.check_interaction(interaction, 'revoke')) { 
      return await interaction.reply({content: "You do not have permission to perform this operation", ephemeral: true})
    }

    const user = interaction.options.getUser('user')
    const role = interaction.options.getRole('role')
    const privilege = interaction.options.getString('privilege')

    if (user !== null) {
      am.revokeUserAccessById(user.id, privilege)
    }

    if (role !== null) {
      am.revokeRoleAccessById(role.id, role.guild.id, privilege)
    }
    return await interaction.reply({content: 'Access revoked', ephemeral: true})
  }

  return await interaction.reply({content: 'Invalid subcommand', ephemeral: true})
}

export async function handleAutocomplete(interaction) {
  // If we need to filter based on subcommand:
  // const subcommand = interaction.options.getSubcommand()

  const focusedOption = interaction.options.getFocused(true);

  let choices

  if (focusedOption.name === 'privilege') {
    choices = Object.keys(utils.accessMap)
  }

  const filtered = choices.filter(choice => choice.startsWith(focusedOption.value));

  await interaction.respond(
    filtered.map(choice => ({ name: choice, value: choice })),
  );
}