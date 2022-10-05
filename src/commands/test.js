import { SlashCommandBuilder } from 'discord.js'

export let data = new SlashCommandBuilder()
  .setName('test')
  .setDescription('Test a clip to the soundboard')
export async function execute(interaction) {
  await interaction.reply('Bingo!');
}


// import { SlashCommandBuilder, ModalBuilder, SelectMenuBuilder, TextInputStyle, TextInputBuilder, ActionRowBuilder, SlashCommandAttachmentOption} from 'discord.js'

// // import FileManager from '../FileManager.js'
// // const fm = FileManager.getInstance()

// // import AdminUtils from '../AdminUtils.js'
// // const utils = AdminUtils.getInstance()

// export let data = new SlashCommandBuilder()
//         .setName('example')
//         .setDescription('Removes a clip from the soundboard')

// export async function execute(interaction) {
//     // TODO: Add the access check here
//     if (!utils.check_interaction(interaction, 'remove')) { // Permission scheme uses 'remove', not 'removeclip'
//         return await interaction.reply({content: "You do not have permission to perform this operation", ephemeral: true})
//     }
//     return

//     const options = Object.keys(fm.getAll()).map(key => {
//         return {
//             'label': key,
//             'value': key
//         }
//     })
//     const clipNameInput = new SelectMenuBuilder()
//         .setCustomId('removeclipSelectMenu') // Must match command name
//         .setPlaceholder('Select clip...')
//         .addOptions(options)
//     const firstActionRow = new ActionRowBuilder().addComponents(clipNameInput)
//     await interaction.reply({content: "Select a clip", components:[firstActionRow]})
// }

// export async function handleSubmission(submission) {
//   //   const clipName = params[0];
//   //   if (!fm.inLibrary(clipName)) {
//   //     return log.debug(`File not found: ${params}`);
//   //   }
//   //   if(fm.delete(clipName)) {
//   //     message.reply(`${clipName} removed`);
//   //   }
//   // }

//     const clipName = submission.values[0]
//     console.log(`Removing: ${clipName}`)
//     return await submission.reply({content: `${clipName} has been removed`, ephemeral: true})
//     return null
//     if (!clipName.match(/^[a-z0-9_]+$/)) {
//         return await modalSubmission.reply({content: `${clipName} is a bad short name`, ephemeral: true})
//     }
//     if (!category.match(/^[a-z0-9_]+$/)) {
//         return await modalSubmission.reply({content: `${category} is a bad category name`, ephemeral: true})
//     }
//     if (!subcategory.match(/^[a-z0-9_]+$/)) {
//         return await modalSubmission.reply({content: `${subcategory} is a bad subcategory name`, ephemeral: true})
//     }
//     if (fm.inLibrary(clipName)) {
//         return await modalSubmission.reply({content: "That sound effect already exists", ephemeral: true})
//     }
//     if (!upload) {
//         return await modalSubmission.reply({content: "Could not find upload", ephemeral: true})
//     }

//     fm.create(clipName, category, subcategory, upload);
//     return await modalSubmission.reply({content: `${clipName} is now available`, ephemeral: true})
// }