// commands_owner/givesaves.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  WebhookClient,
  MessageFlags,
} = require("discord.js");

const {
  getBankSaves,
  setBankSaves,
  getGlobalSaves,
  setGlobalSaves,
} = require("../src/db");

function isOwner(interaction) {
  return interaction.user.id === process.env.OWNER_ID;
}

function fmt(n) {
  const num = Number(n || 0);
  // keep .5 visible if you use half-saves
  return Number.isInteger(num) ? num.toString() : num.toFixed(1);
}

async function sendGiveLog(client, embed) {
  const webhookUrl = process.env.GIVESAVES_LOG_WEBHOOK_URL?.trim();
  const channelId = process.env.GIVESAVES_LOG_CHANNEL_ID?.trim();

  // Prefer webhook if present
  if (webhookUrl) {
    const wh = new WebhookClient({ url: webhookUrl });
    await wh.send({ embeds: [embed] });
    return true;
  }

  // Otherwise send to a channel
  if (channelId) {
    const ch = await client.channels.fetch(channelId).catch(() => null);
    if (ch && ch.isTextBased()) {
      await ch.send({ embeds: [embed] });
      return true;
    }
  }

  return false;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("givesaves")
    .setDescription("Owner: give saves to a user (logged for transparency)")
    .addUserOption((o) =>
      o.setName("user").setDescription("User to receive saves").setRequired(true)
    )
    .addNumberOption((o) =>
      o
        .setName("amount")
        .setDescription("Amount of saves to give (e.g. 1 or 0.5)")
        .setRequired(true)
        .setMinValue(0.5)
    )
    .addStringOption((o) =>
      o
        .setName("reason")
        .setDescription("Reason for the giveaway (shown in logs)")
        .setRequired(true)
        .setMaxLength(200)
    ),

  async execute(interaction) {
    if (!isOwner(interaction)) {
      return interaction.reply({
        content: "❌ You can't use this command.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const target = interaction.options.getUser("user", true);
    const amount = interaction.options.getNumber("amount", true);
    const reason = interaction.options.getString("reason", true).trim();

    // Bank check
    const bank = getBankSaves(interaction.user.id);
    if (bank < amount) {
      return interaction.reply({
        content: `❌ Not enough in bank.\nBank: **${fmt(bank)}** • Needed: **${fmt(amount)}**`,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Transfer
    setBankSaves(interaction.user.id, bank - amount);

    const before = getGlobalSaves(target.id);
    setGlobalSaves(target.id, before + amount);
    const after = before + amount;

    // Log embed
    const embed = new EmbedBuilder()
      .setTitle("🎁 Saves Given")
      .addFields(
        { name: "Given By", value: `${interaction.user} (\`${interaction.user.id}\`)`, inline: false },
        { name: "Given To", value: `${target} (\`${target.id}\`)`, inline: false },
        { name: "Amount", value: `**${fmt(amount)}**`, inline: true },
        { name: "Reason", value: reason || "—", inline: true },
        { name: "Recipient Balance", value: `${fmt(before)} → **${fmt(after)}**`, inline: true },
        { name: "Owner Bank Remaining", value: `**${fmt(bank - amount)}**`, inline: true }
      )
      .setTimestamp(new Date());

    // Send transparency log (webhook or channel)
    const logged = await sendGiveLog(interaction.client, embed).catch(() => false);

    // Confirm to owner (private)
    await interaction.reply({
      content:
        `✅ Gave **${fmt(amount)}** saves to ${target}.\n` +
        `Reason: **${reason}**\n` +
        `Bank remaining: **${fmt(bank - amount)}**` +
        (logged ? "" : `\n⚠️ Log not sent (set GIVESAVES_LOG_WEBHOOK_URL or GIVESAVES_LOG_CHANNEL_ID).`),
      flags: MessageFlags.Ephemeral,
    });
  },
};
