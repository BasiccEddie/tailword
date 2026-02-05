// src/giveawayDrops.js
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ComponentType,
} = require("discord.js");
const { q, getGlobalSaves, setGlobalSaves } = require("./db");

const activeDrops = new Map(); // messageId -> claimed boolean

function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function getDropAmount(guildId) {
  // Your main server gets 2, all others 1
  return guildId === process.env.MAIN_GUILD_ID ? 2 : 1;
}

async function sendDropToGuild(client, guildId, channelId, amount) {
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setTitle("🎁 Save Drop!")
    .setDescription(`First person to claim wins **${amount} Save${amount === 1 ? "" : "s"}**.`)
    .setFooter({ text: "Votes earn saves too • /vote" });

  const btn = new ButtonBuilder()
    .setCustomId(`claim_drop_${Date.now()}_${Math.floor(Math.random() * 9999)}`)
    .setLabel("Claim")
    .setStyle(ButtonStyle.Success);

  const row = new ActionRowBuilder().addComponents(btn);

  const msg = await channel.send({ embeds: [embed], components: [row] }).catch(() => null);
  if (!msg) return;

  activeDrops.set(msg.id, false);

  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 60_000, // 60s to claim
    max: 1,
  });

  collector.on("collect", async (i) => {
    if (activeDrops.get(msg.id)) {
      return i.reply({ content: "Too late — already claimed!", ephemeral: true }).catch(() => {});
    }

    activeDrops.set(msg.id, true);

    // Give saves (GLOBAL) to the user
    const current = getGlobalSaves(i.user.id);
    setGlobalSaves(i.user.id, current + amount);

    // Disable button
    const disabledRow = new ActionRowBuilder().addComponents(
      ButtonBuilder.from(btn).setDisabled(true).setLabel("Claimed")
    );

    await i.reply({
      content: `✅ ${i.user} claimed **${amount}** Save${amount === 1 ? "" : "s"}!`,
      ephemeral: false,
    }).catch(() => {});

    await msg.edit({ components: [disabledRow] }).catch(() => {});
  });

  collector.on("end", async () => {
    // If nobody claimed, disable the button
    if (!activeDrops.get(msg.id)) {
      const disabledRow = new ActionRowBuilder().addComponents(
        ButtonBuilder.from(btn).setDisabled(true).setLabel("Expired")
      );
      await msg.edit({ components: [disabledRow] }).catch(() => {});
    }
    activeDrops.delete(msg.id);
  });
}

async function runGlobalDrop(client) {
  const rows = q.listEnabledChannels.all();

  // Send sequentially with small delay to reduce rate-limit risk
  for (const r of rows) {
    const amount = getDropAmount(r.guild_id);
    await sendDropToGuild(client, r.guild_id, r.channel_id, amount);
    await sleep(900); // ~1 sec between guilds
  }
}

function startGiveawayDrops(client) {
  const minutes = Number(process.env.DROP_INTERVAL_MINUTES || 180); // default 3 hours
  const intervalMs = Math.max(5, minutes) * 60_000;

  // Start after a short delay so client is ready
  setTimeout(() => runGlobalDrop(client).catch(console.error), 20_000);

  setInterval(() => {
    runGlobalDrop(client).catch(console.error);
  }, intervalMs);

  console.log(`✅ Giveaway drops enabled: every ${minutes} minutes`);
}

module.exports = { startGiveawayDrops };
