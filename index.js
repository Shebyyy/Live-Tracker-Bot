// Dartotsu Live User Tracker Bot
// Lightweight bot to track users with active Dartotsu RPC

const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildPresences,
  ]
});

const app = express();
const PORT = process.env.PORT || 3000;

// Configuration
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const DARTOTSU_APP_ID = '1163925779692912771';
const UPDATE_INTERVAL = 30000; // 30 seconds

// State
let liveUserCount = 0;
let lastUpdate = Date.now();

// Track unique users with Dartotsu RPC active
function updateLiveCount() {
  try {
    const guilds = client.guilds.cache;
    const uniqueUsers = new Set();

    guilds.forEach(guild => {
      guild.members.cache.forEach(member => {
        // Check if user has Dartotsu RPC active
        const hasDartotsuRPC = member.presence?.activities?.some(
          activity => activity.applicationId === DARTOTSU_APP_ID
        );

        if (hasDartotsuRPC) {
          uniqueUsers.add(member.id);
        }
      });
    });

    liveUserCount = uniqueUsers.size;
    lastUpdate = Date.now();
    
    console.log(`[${new Date().toISOString()}] Live users: ${liveUserCount}`);
  } catch (error) {
    console.error('Error updating live count:', error);
  }
}

// Bot events
client.once('ready', () => {
  console.log(`✅ Bot logged in as ${client.user.tag}`);
  console.log(`📊 Monitoring ${client.guilds.cache.size} servers`);
  
  // Initial count
  updateLiveCount();
  
  // Update count periodically
  setInterval(updateLiveCount, UPDATE_INTERVAL);
});

// Update when presence changes
client.on('presenceUpdate', (oldPresence, newPresence) => {
  const hadDartotsu = oldPresence?.activities?.some(
    activity => activity.applicationId === DARTOTSU_APP_ID
  );
  const hasDartotsu = newPresence?.activities?.some(
    activity => activity.applicationId === DARTOTSU_APP_ID
  );

  // Only update if Dartotsu RPC status changed
  if (hadDartotsu !== hasDartotsu) {
    updateLiveCount();
  }
});

// API endpoints
app.get('/api/live-count', (req, res) => {
  res.json({
    count: liveUserCount,
    lastUpdate: lastUpdate,
    timestamp: Date.now()
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    botReady: client.isReady(),
    guilds: client.guilds.cache.size
  });
});

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 API server running on port ${PORT}`);
});

// Start bot
client.login(DISCORD_TOKEN);

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Shutting down gracefully...');
  client.destroy();
  process.exit(0);
});
