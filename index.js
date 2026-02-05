// index.js (project root)
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { Client, Collection, GatewayIntentBits } = require("discord.js");

const { registerCommands } = require("./src/registerCommands");
const { handleWordchainMessage } = require("./src/wordchain");
const { startTopggServer } = require("./src/topggWebhook");

// ✅ Giveaway drops
const { startGiveawayDrops } = require("./src/giveawayDrops");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();

/**
 * Loads all command modules from a folder into client.commands.
 * Folder must contain .js files exporting: { data, execute }
 */
function loadCommandsFromFolder(folderName) {
  const folderPath = path.join(__dirname, folderName);
  if (!fs.existsSync(folderPath)) {
    console.log(`ℹ️ Command folder not found, skipping: ${folderName}`);
    return;
  }

  const files = fs.readdirSync(folderPath).filter((f) => f.endsWith(".js"));
  for (const file of files) {
    const fullPath = path.join(folderPath, file);

    // Clear require cache so restarts after edits always load fresh code
    delete require.cache[require.resolve(fullPath)];

    const cmd = require(fullPath);
    if (!cmd?.data?.name || typeof cmd.execute !== "function") {
      console.log(`⚠️ Invalid command file (missing data/execute): ${folderName}/${file}`);
      continue;
    }

    client.commands.set(cmd.data.name, cmd);
  }

  console.log(`✅ Loaded ${files.length} commands from /${folderName}`);
}

// Load public commands always
loadCommandsFromFolder("commands");

// Load owner-only commands only if OWNER_GUILD_ID is set (Option A)
if (process.env.OWNER_GUILD_ID) {
  loadCommandsFromFolder("commands_owner");
} else {
  console.log("ℹ️ OWNER_GUILD_ID not set → not loading /commands_owner");
}

client.once("ready", async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  try {
    // Registers global commands from /commands,
    // and registers guild-only owner commands from /commands_owner (if OWNER_GUILD_ID is set)
    await registerCommands(process.env.DISCORD_BOT_TOKEN, client.user.id);
  } catch (err) {
    console.error("❌ Failed to register slash commands:", err);
  }

  // ✅ Start global giveaway drops
  startGiveawayDrops(client);
});

// Slash commands
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const cmd = client.commands.get(interaction.commandName);
  if (!cmd) return;

  try {
    await cmd.execute(interaction);
  } catch (err) {
    console.error(`❌ Error running /${interaction.commandName}:`, err);

    const msg = "Something went wrong running that command.";
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: msg, ephemeral: true }).catch(() => {});
    } else {
      await interaction.reply({ content: msg, ephemeral: true }).catch(() => {});
    }
  }
});

// Wordchain logic
client.on("messageCreate", handleWordchainMessage);

// Start top.gg webhook server (Express)
startTopggServer();

// Login
client.login(process.env.DISCORD_BOT_TOKEN);
