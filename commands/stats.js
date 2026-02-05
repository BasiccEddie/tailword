// commands/stats.js
const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const {
  getOrCreateUser,
  getGlobalSaves,
  getGuildSaves,
  q,
} = require("../src/db");

function pct(valid, fails) {
  const total = valid + fails;
  if (total <= 0) return "0.000%";
  return ((valid / total) * 100).toFixed(3) + "%";
}

function fmt(n) {
  return Number(n || 0).toLocaleString("en-US");
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Show wordchain stats (you or another user)")
    .addUserOption((o) => o.setName("user").setDescription("User to check")),

  async execute(interaction) {
    const guildId = interaction.guildId;
    const target = interaction.options.getUser("user") ?? interaction.user;

    // Local (this server)
    const local = getOrCreateUser(guildId, target.id);
    const localValid = local.valid_count ?? 0;
    const localFails = local.fail_count ?? 0;
    const localScore = localValid - localFails;

    // Global (across all servers)
    const global = q.globalUserTotals.get(target.id);
    const globalValid = global?.valid ?? 0;
    const globalFails = global?.fails ?? 0;
    const globalScore = globalValid - globalFails;

    // Rank in this server by score
    const rankRow = q.guildUserRankByScore.get(guildId, localScore);
    const rank = rankRow?.rank ?? 1;

    // Saves
    const personalSaves = getGlobalSaves(target.id);
    const serverPool = getGuildSaves(guildId);

    const channelName = interaction.channel?.name ? `#${interaction.channel.name}` : "this server";

    const embed = new EmbedBuilder()
      .setAuthor({
        name: target.username,
        iconURL: target.displayAvatarURL({ size: 128 }),
      })
      .addFields(
        {
          name: "Global Stats",
          value:
            `Correct Rate: **${pct(globalValid, globalFails)}**\n` +
            `✅ **${fmt(globalValid)}**\n` +
            `❌ **${fmt(globalFails)}**\n` +
            `Score: **${fmt(globalScore)}**`,
          inline: true,
        },
        {
          name: `Stats in ${channelName}`,
          value:
            `Correct Rate: **${pct(localValid, localFails)}**\n` +
            `✅ **${fmt(localValid)}**\n` +
            `❌ **${fmt(localFails)}**\n` +
            `Score: **${fmt(localScore)}** (**#${rank}**)\n` +
            `Saves: **${fmt(personalSaves)}**\n` +
            `Server Pool: **${fmt(serverPool)}**`,
          inline: true,
        }
      )
      .setFooter({ text: "Tip: Vote to earn Saves • /vote • Donate with /donatesave" });

    await interaction.reply({ embeds: [embed], ephemeral: true });
  },
};
