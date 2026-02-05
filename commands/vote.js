const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vote")
    .setDescription("Get the top.gg vote link (earns 1 Save per vote)"),

  async execute(interaction) {
    // We can derive your bot ID at runtime, so you don't have to hardcode it
    const botId = interaction.client.user.id;
    const voteUrl = `https://top.gg/bot/${botId}/vote`;

    const embed = new EmbedBuilder()
      .setTitle("Vote on top.gg")
      .setDescription(`Voting gives you **+1 Save**.\n\nClick here: ${voteUrl}`)
      .setFooter({ text: "Thanks for supporting the bot!" });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
};
