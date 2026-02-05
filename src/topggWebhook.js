const express = require("express");
const Topgg = require("@top-gg/sdk");
const { getGlobalSaves, setGlobalSaves } = require("./db");

function startTopggServer() {
  const app = express();
  const webhook = new Topgg.Webhook(process.env.TOPGG_WEBHOOK_AUTH);

  app.post("/topgg", webhook.listener(async (vote) => {
    const current = getGlobalSaves(vote.user);
    setGlobalSaves(vote.user, current + 0.5);
    console.log(`✅ top.gg vote from ${vote.user} → +0.5 save`);
  }));

  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`✅ Webhook server listening on ${port}`));
}

module.exports = { startTopggServer };
