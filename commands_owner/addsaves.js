const { SlashCommandBuilder } = require("discord.js");
const { getBankSaves, setBankSaves } = require("../src/db");

function isOwner(interaction) {
  return interaction.user.id === process.env.OWNER_ID;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("addsaves")
    .setDescription("Owner: add saves to your giveaway bank")
    .addIntegerOption(o =>
      o.setName("amount").setDescription("Amount to add").setRequired(true).setMinValue(1)
    ),

  async execute(interaction) {
    if (!isOwner(interaction)) {
      return interaction.reply({ content: "❌ You can't use this command.", ephemeral: true });
    }

    const amount = interaction.options.getInteger("amount", true);
    const current = getBankSaves(interaction.user.id);
    const next = current + amount;
    setBankSaves(interaction.user.id, next);

    return interaction.reply({ content: `✅ Added **${amount}** saves to your bank. Bank: **${next}**`, ephemeral: true });
  }
};
