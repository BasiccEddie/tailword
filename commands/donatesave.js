const { SlashCommandBuilder } = require("discord.js");
const { getGlobalSaves, setGlobalSaves, getGuildSaves, setGuildSaves } = require("../src/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("donatesave")
    .setDescription("Donate 1 of your Saves to the server-wide Save Pool"),

  async execute(interaction) {
    const userId = interaction.user.id;
    const guildId = interaction.guildId;

    const personal = getGlobalSaves(userId);
    if (personal <= 1) {
      return interaction.reply({ content: "You have **0** Saves to donate. Use `/vote` to get the vote link.", ephemeral: true });
    }

    setGlobalSaves(userId, personal - 1);

    const pool = getGuildSaves(guildId);
    setGuildSaves(guildId, pool + 1);

    await interaction.reply({ content: `🏦 ${interaction.user} donated **1 Save** to the server pool! (Pool: **${pool + 1}**)` });
  }
};
