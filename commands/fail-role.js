const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const { getOrCreateGuild, q } = require("../src/db");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("fail-role")
    .setDescription("Set (or clear) the role given to users when they fail (admin)")
    .addRoleOption(o => o.setName("role").setDescription("Role to assign on fail"))
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction) {
    const role = interaction.options.getRole("role"); // optional
    const g = getOrCreateGuild(interaction.guildId);

    g.fail_role_id = role ? role.id : null;
    q.upsertGuild.run(g);

    await interaction.reply({
      content: role
        ? `✅ Fail role set to ${role}`
        : `✅ Fail role cleared (no role will be assigned on fail).`,
      ephemeral: true
    });
  }
};
