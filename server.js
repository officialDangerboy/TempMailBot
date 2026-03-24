const express = require("express");
const app = express();

// Load bot
require("./bot");

// Render requires a web server — this keeps the service alive
app.get("/", (req, res) => {
  res.send("🤖 Temp Mail Bot is running!");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Web server running on port ${PORT}`);
});
