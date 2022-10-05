import { SlashCommandBuilder } from 'discord.js'

import DiscordBot from '../DiscordBot.js'
const bot = DiscordBot.getInstance()

import AdminUtils from '../AdminUtils.js'
const utils = AdminUtils.getInstance()

export let data = new SlashCommandBuilder()
  .setName('update_commands')
  .setDescription('Administrative command to update commands')
export async function execute(interaction) {
  if (!utils.check_interaction(interaction, 'administer')) { 
    return await interaction.reply({content: "You do not have permission to perform this operation", ephemeral: true})
  }
  bot.register_commands()
  await interaction.reply({content: 'Commands re-registering', ephemeral: true});
}