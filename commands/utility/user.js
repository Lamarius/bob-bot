const { userMention, SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder().setName('user').setDescription('Provides information about the user.'),
    async execute(interaction) {
        const mention = userMention(interaction.user.id);
        await interaction.reply(
            `This command was run by ${mention}, who joined on ${interaction.member.joinedAt}.`,
        );
    },
};