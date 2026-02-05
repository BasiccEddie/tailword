const { SlashCommandBuilder } = require("discord.js");
const { getBankSaves, setBankSaves, getGlobalSaves, setGlobalSaves } = require("../src/db");

function isOwner(interaction) {
  return interaction.user.id === process.env.OWNER_ID;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("givesaves")
    .setDescription("Owner: give saves to a user from your giveaway bank")
    .addUserOption(o => o.setName("user").setDescription("User").setRequired(true))
    .addIntegerOption(o =>
      o.setName("amount").setDescription("Amount").setRequired(true).setMinValue(1)
    ),

  async execute(interaction) {
    if (!isOwner(interaction)) {
      return interaction.reply({ content: "❌ You can't use this command.", ephemeral: true });
    }

    const target = interaction.options.getUser("user", true);
    const amount = interaction.options.getInteger("amount", true);

    const bank = getBankSaves(interaction.user.id);
    if (bank < amount) {
      return interaction.reply({ content: `❌ Not enough in bank. Bank: **${bank}**`, ephemeral: true });
    }

    // Deduct from bank
    setBankSaves(interaction.user.id, bank - amount);

    // Credit to user's personal (global) saves
    const current = getGlobalSaves(target.id);
    setGlobalSaves(target.id, current + amount);

    return interaction.reply({
      content: `🎁 Gave **${amount}** saves to ${target}. (Bank now: **${bank - amount}**)`,
      ephemeral: false,
    });
  }
};
