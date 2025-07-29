import { SlashCommandBuilder, MessageFlags } from 'discord.js'

import DiscordBot from '../DiscordBot.js'

import AdminUtils from '../AdminUtils.js'

import nconf from 'nconf'
const bot = DiscordBot.getInstance()
const utils = AdminUtils.getInstance()
const prefix = nconf.get('COMMAND_PREFIX') || ''

export const data = new SlashCommandBuilder()
  .setName(prefix + 'update_commands')
  .setDescription('Administrative command to update commands')
export async function execute (interaction) {
  if (!utils.check_interaction(interaction, 'administer')) {
    return await interaction.reply({ content: 'You do not have permission to perform this operation', flags: MessageFlags.Ephemeral })
  }
  bot.register_commands()
  await interaction.reply({ content: 'Commands re-registering', flags: MessageFlags.Ephemeral })
}
