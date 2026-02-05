// src/db.js
const Database = require("better-sqlite3");

const db = new Database("wordchain.sqlite");

// --------------------
// Tables
// --------------------
db.exec(`
CREATE TABLE IF NOT EXISTS guild_config (
  guild_id TEXT PRIMARY KEY,
  channel_id TEXT,
  enabled INTEGER NOT NULL DEFAULT 0,
  last_word TEXT,
  required_start TEXT,
  last_user_id TEXT,
  streak_current INTEGER NOT NULL DEFAULT 0,
  streak_best INTEGER NOT NULL DEFAULT 0,
  last_fail_message_id TEXT,
  fail_role_id TEXT
);

CREATE TABLE IF NOT EXISTS used_words (
  guild_id TEXT NOT NULL,
  word TEXT NOT NULL,
  PRIMARY KEY (guild_id, word)
);

CREATE TABLE IF NOT EXISTS user_stats (
  guild_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  valid_count INTEGER NOT NULL DEFAULT 0,
  fail_count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (guild_id, user_id)
);

-- Personal saves earned from top.gg (global, decimals allowed)
CREATE TABLE IF NOT EXISTS global_saves (
  user_id TEXT PRIMARY KEY,
  saves REAL NOT NULL DEFAULT 0
);

-- Server-wide pool of saves (from /donatesave) (decimals allowed)
CREATE TABLE IF NOT EXISTS guild_saves (
  guild_id TEXT PRIMARY KEY,
  saves REAL NOT NULL DEFAULT 0
);

-- Owner giveaway bank (for minting / giveaways) (decimals allowed)
CREATE TABLE IF NOT EXISTS global_bank (
  user_id TEXT PRIMARY KEY,
  saves REAL NOT NULL DEFAULT 0
);
`);

// --------------------
// Prepared queries
// --------------------
const q = {
  // Guild config
  getGuild: db.prepare(`SELECT * FROM guild_config WHERE guild_id = ?`),
  upsertGuild: db.prepare(`
    INSERT INTO guild_config (
      guild_id, channel_id, enabled, last_word, required_start, last_user_id,
      streak_current, streak_best, last_fail_message_id, fail_role_id
    )
    VALUES (
      @guild_id, @channel_id, @enabled, @last_word, @required_start, @last_user_id,
      @streak_current, @streak_best, @last_fail_message_id, @fail_role_id
    )
    ON CONFLICT(guild_id) DO UPDATE SET
      channel_id=excluded.channel_id,
      enabled=excluded.enabled,
      last_word=excluded.last_word,
      required_start=excluded.required_start,
      last_user_id=excluded.last_user_id,
      streak_current=excluded.streak_current,
      streak_best=excluded.streak_best,
      last_fail_message_id=excluded.last_fail_message_id,
      fail_role_id=excluded.fail_role_id
  `),

  // Used words (per guild round)
  clearUsedWords: db.prepare(`DELETE FROM used_words WHERE guild_id = ?`),
  hasUsedWord: db.prepare(`SELECT 1 FROM used_words WHERE guild_id = ? AND word = ?`),
  addUsedWord: db.prepare(`INSERT OR IGNORE INTO used_words (guild_id, word) VALUES (?, ?)`),

  // User stats (per guild)
  getUser: db.prepare(`SELECT * FROM user_stats WHERE guild_id = ? AND user_id = ?`),
  upsertUser: db.prepare(`
    INSERT INTO user_stats (guild_id, user_id, valid_count, fail_count)
    VALUES (@guild_id, @user_id, @valid_count, @fail_count)
    ON CONFLICT(guild_id, user_id) DO UPDATE SET
      valid_count=excluded.valid_count,
      fail_count=excluded.fail_count
  `),

  // Global totals across all servers (for /stats)
  globalUserTotals: db.prepare(`
    SELECT
      COALESCE(SUM(valid_count), 0) AS valid,
      COALESCE(SUM(fail_count), 0) AS fails
    FROM user_stats
    WHERE user_id = ?
  `),

  // Rank in server by score = valid - fails
  guildUserRankByScore: db.prepare(`
    SELECT 1 + COUNT(*) AS rank
    FROM user_stats
    WHERE guild_id = ?
      AND (valid_count - fail_count) > ?
  `),

  // Leaderboard in server by score
  topUsersByScore: db.prepare(`
    SELECT user_id, valid_count, fail_count, (valid_count - fail_count) AS score
    FROM user_stats
    WHERE guild_id = ?
    ORDER BY score DESC, valid_count DESC
    LIMIT 10
  `),

  // ✅ For giveaway drops: list all enabled guild channels
  listEnabledChannels: db.prepare(`
    SELECT guild_id, channel_id
    FROM guild_config
    WHERE enabled = 1 AND channel_id IS NOT NULL
  `),

  // Global saves (personal)
  getGlobalSaves: db.prepare(`SELECT saves FROM global_saves WHERE user_id = ?`),
  setGlobalSaves: db.prepare(`
    INSERT INTO global_saves (user_id, saves) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET saves=excluded.saves
  `),

  // Guild save pool
  getGuildSaves: db.prepare(`SELECT saves FROM guild_saves WHERE guild_id = ?`),
  setGuildSaves: db.prepare(`
    INSERT INTO guild_saves (guild_id, saves) VALUES (?, ?)
    ON CONFLICT(guild_id) DO UPDATE SET saves=excluded.saves
  `),

  // Owner giveaway bank
  bankGet: db.prepare(`SELECT saves FROM global_bank WHERE user_id = ?`),
  bankSet: db.prepare(`
    INSERT INTO global_bank (user_id, saves) VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET saves=excluded.saves
  `),
};

// --------------------
// Helper functions
// --------------------
function getOrCreateGuild(guildId) {
  let g = q.getGuild.get(guildId);
  if (!g) {
    g = {
      guild_id: guildId,
      channel_id: null,
      enabled: 0,
      last_word: null,
      required_start: null,
      last_user_id: null,
      streak_current: 0,
      streak_best: 0,
      last_fail_message_id: null,
      fail_role_id: null,
    };
    q.upsertGuild.run(g);
  }
  return g;
}

function getOrCreateUser(guildId, userId) {
  let u = q.getUser.get(guildId, userId);
  if (!u) {
    u = { guild_id: guildId, user_id: userId, valid_count: 0, fail_count: 0 };
    q.upsertUser.run(u);
  }
  return u;
}

// Global personal saves
function getGlobalSaves(userId) {
  const row = q.getGlobalSaves.get(userId);
  return row ? Number(row.saves) : 0;
}

function setGlobalSaves(userId, saves) {
  q.setGlobalSaves.run(userId, Number(saves));
}

// Guild pool saves
function getGuildSaves(guildId) {
  const row = q.getGuildSaves.get(guildId);
  return row ? Number(row.saves) : 0;
}

function setGuildSaves(guildId, saves) {
  q.setGuildSaves.run(guildId, Number(saves));
}

// Owner giveaway bank
function getBankSaves(userId) {
  const row = q.bankGet.get(userId);
  return row ? Number(row.saves) : 0;
}

function setBankSaves(userId, saves) {
  q.bankSet.run(userId, Number(saves));
}

module.exports = {
  db,
  q,
  getOrCreateGuild,
  getOrCreateUser,
  getGlobalSaves,
  setGlobalSaves,
  getGuildSaves,
  setGuildSaves,
  getBankSaves,
  setBankSaves,
};
