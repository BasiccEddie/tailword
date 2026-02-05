const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { getOrCreateGuild, q } = require("../src/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup-channel")
    .setDescription("Set the wordchain channel and enable the game (admin)")
    .addChannelOption(o => o.setName("channel").setDescription("Wordchain channel").setRequired(true))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const channel = interaction.options.getChannel("channel", true);
    const g = getOrCreateGuild(interaction.guildId);

    g.channel_id = channel.id;
    g.enabled = 1;

    // Reset state on setup
    g.last_word = null;
    g.required_start = null;
    g.last_user_id = null;
    g.streak_current = 0;
    g.last_fail_message_id = null;

    q.clearUsedWords.run(interaction.guildId);
    q.upsertGuild.run(g);

    await interaction.reply({ content: `✅ Wordchain enabled in <#${channel.id}>`, ephemeral: true });
  }
};
