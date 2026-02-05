// src/wordchain.js
const { q, getOrCreateGuild, getOrCreateUser } = require("./db");
const { EmbedBuilder } = require("discord.js");

function normalizeWord(raw) {
  const w = raw.trim().toLowerCase();
  if (!/^[a-z]+$/.test(w)) return null; // A–Z only
  return w;
}

function lastLetter(word) {
  return word[word.length - 1];
}

async function handleWordchainMessage(message) {
  if (!message.guild || message.author.bot) return;

  const guildId = message.guild.id;
  const g = q.getGuild.get(guildId);
  if (!g || !g.enabled || !g.channel_id) return;
  if (message.channel.id !== g.channel_id) return;

  // Ignore attachments/stickers/embeds (so gifs/emojis don't "ruin" it)
  if (message.attachments.size > 0 || message.stickers.size > 0 || message.embeds.length > 0) return;

  const raw = message.content.trim();
  if (!raw || raw.includes(" ")) return; // ignore multi-word chatter

  const word = normalizeWord(raw);
  if (!word) return; // ignore emojis/symbols/etc.

  const fail = async (expectedStartLetter = null) => {
    await message.react("❌").catch(() => {});

    // Clear used words so everything becomes usable again
    q.clearUsedWords.run(guildId);

    // Reset round state (AUTO NEW ROUND)
    const gu = getOrCreateGuild(guildId);
    const updated = {
      ...gu,
      last_word: null,
      required_start: null,
      last_user_id: null,
      streak_current: 0,
      last_fail_message_id: message.id,
      // keep streak_best as-is
    };
    q.upsertGuild.run(updated);

    // Stats
    const u = getOrCreateUser(guildId, message.author.id);
    u.fail_count += 1;
    q.upsertUser.run(u);

    // Fail text + embed
    const failText = expectedStartLetter
      ? `💥 Oh no, **${message.author.username}** ruined the chain!\nThe word should have begun with **${expectedStartLetter.toUpperCase()}**.`
      : `💥 Oh no, **${message.author.username}** ruined the chain!`;

    const botId = message.client?.user?.id;
    const voteUrl = botId ? `https://top.gg/bot/${botId}/vote` : null;

    const embed = new EmbedBuilder()
      .setDescription(
        [
          "Vote to earn **Saves** so you can continue next time.",
          "Use **/vote** for the link.",
          voteUrl ? `\n🔗 ${voteUrl}` : "",
        ].join(" ")
      )
      .setFooter({ text: "New round started • Start with any A–Z word" });

    await message.channel.send({ content: failText }).catch(() => {});
    await message.channel.send({ embeds: [embed] }).catch(() => {});
    await message.channel.send("🔄 **New round!** Start with any **A–Z** word.").catch(() => {});

    // Fail role
    if (gu.fail_role_id) {
      const member = await message.guild.members.fetch(message.author.id).catch(() => null);
      if (member) await member.roles.add(gu.fail_role_id).catch(() => {});
    }
  };

  // Fail cases (only for valid single words)
  if (g.last_user_id && g.last_user_id === message.author.id) return fail(g.required_start);
  if (g.required_start && word[0] !== g.required_start) return fail(g.required_start);
  if (q.hasUsedWord.get(guildId, word)) return fail(g.required_start);

  // Valid
  await message.react("✅").catch(() => {});
  q.addUsedWord.run(guildId, word);

  const newStreak = (g.streak_current || 0) + 1;
  const best = Math.max(g.streak_best || 0, newStreak);

  q.upsertGuild.run({
    ...g,
    last_word: word,
    required_start: lastLetter(word),
    last_user_id: message.author.id,
    streak_current: newStreak,
    streak_best: best,
    last_fail_message_id: null,
  });

  const u = getOrCreateUser(guildId, message.author.id);
  u.valid_count += 1;
  q.upsertUser.run(u);
}

module.exports = { handleWordchainMessage };
