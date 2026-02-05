// commands/leaderboard.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const { q } = require("../src/db");

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Top players in this server (by score)"),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const rows = q.topUsersByScore.all(guildId);

    if (!rows.length) {
      return interaction.reply({ content: "No stats yet.", ephemeral: true });
    }

    const lines = rows.map((r, i) => {
      const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`;
      return (
        `${medal} <@${r.user_id}> — ` +
        `✅ **${fmt(r.valid_count)}** | ` +
        `❌ **${fmt(r.fail_count)}** | ` +
        `Score **${fmt(r.score)}**`
      );
    });

    const embed = new EmbedBuilder()
      .setTitle("🏆 Server Leaderboard")
      .setDescription(lines.join("\n"))
      .setFooter({ text: "Ranked by Score = ✅ - ❌" });

    await interaction.reply({ embeds: [embed] });
  },
};
