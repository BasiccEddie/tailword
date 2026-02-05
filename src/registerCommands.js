const fs = require("fs");
const path = require("path");
const { REST, Routes } = require("discord.js");

function loadCommandsJSON(dirName) {
  const commandsPath = path.join(__dirname, "..", dirName);
  if (!fs.existsSync(commandsPath)) return [];

  const files = fs.readdirSync(commandsPath).filter(f => f.endsWith(".js"));
  return files.map(file => require(path.join(commandsPath, file)).data.toJSON());
}

async function registerCommands(token, clientId) {
  const rest = new REST({ version: "10" }).setToken(token);

  // Public/global commands
  const publicCommands = loadCommandsJSON("commands");
  await rest.put(Routes.applicationCommands(clientId), { body: publicCommands });
  console.log("✅ Public slash commands registered (global)");

  // Owner-only commands (guild-only)
  const ownerGuildId = process.env.OWNER_GUILD_ID; // your private server id
  if (ownerGuildId) {
    const ownerCommands = loadCommandsJSON("commands_owner");
    await rest.put(Routes.applicationGuildCommands(clientId, ownerGuildId), { body: ownerCommands });
    console.log("✅ Owner commands registered (guild-only)");
  }
}

module.exports = { registerCommands };
