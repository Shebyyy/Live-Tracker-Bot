// Dartotsu Hybrid Tracker - Discord RPC + Heartbeat System
const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

// Discord Client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildPresences,
  ]
});

const app = express();
const PORT = process.env.PORT || 3000;
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

const DARTOTSU_APP_ID = '1163925779692912771';
const DARTOTSU_EMOJI_ID = '1305525420938100787'; // dart emoji

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// State Management
const activeUsers = new Map();
let discordWatchingCount = 0;
let discordBrowsingCount = 0;
let lastDiscordUpdate = Date.now();

// Config
const ACTIVE_THRESHOLD = 120000; 
const CLEANUP_INTERVAL = 60000; 
const DISCORD_UPDATE_INTERVAL = 30000; 

// ========= HEARTBEAT =========
function getHeartbeatCount() {
  const now = Date.now();
  let count = 0;

  activeUsers.forEach(user => {
    if (now - user.lastSeen < ACTIVE_THRESHOLD) count++;
  });

  return count;
}

function cleanupInactiveUsers() {
  const now = Date.now();
  const toDelete = [];

  activeUsers.forEach((user, id) => {
    if (now - user.lastSeen > ACTIVE_THRESHOLD * 2)
      toDelete.push(id);
  });

  toDelete.forEach(id => activeUsers.delete(id));

  if (toDelete.length > 0)
    console.log(`[${new Date().toISOString()}] Cleaned ${toDelete.length} stale users`);
}

setInterval(cleanupInactiveUsers, CLEANUP_INTERVAL);

// ========= DARTOTSUS VS DANTOTSU FILTER =========
function isDartotsuActivity(activity) {
  if (!activity) return false;
  if (activity.applicationId !== DARTOTSU_APP_ID) return false;

  const assets = activity.assets || {};

  const smallText =
    assets.smallText ||
    assets.small_text ||
    '';

  const smallImage =
    assets.smallImage ||
    assets.small_image ||
    '';

  return (
    smallText === 'Dartotsu' ||
    smallImage.includes(DARTOTSU_EMOJI_ID)
  );
}

// ========= DISCORD RPC TRACKING =========
function updateDiscordCount() {
  try {
    const guilds = client.guilds.cache;
    const uniqueWatching = new Set();
    const uniqueBrowsing = new Set();

    guilds.forEach(guild => {
      guild.members.cache.forEach(member => {
        const activities = member.presence?.activities || [];

        activities.forEach(activity => {
          if (!isDartotsuActivity(activity)) return;

          const state = activity.state || '';
          const details = activity.details || '';

          if (state.includes('Episode:') || state.includes('Chapter:')) {
            uniqueWatching.add(member.id);
          } else if (details.includes('Browsing') || activity.name === 'Dartotsu') {
            uniqueBrowsing.add(member.id);
          }
        });
      });
    });

    discordWatchingCount = uniqueWatching.size;
    discordBrowsingCount = uniqueBrowsing.size;
    lastDiscordUpdate = Date.now();

    console.log(
      `[${new Date().toISOString()}] Discord: ${discordWatchingCount} watching, ${discordBrowsingCount} browsing`
    );
  } catch (err) {
    console.error('Error updating Discord count:', err);
  }
}

// ========= DISCORD EVENTS =========
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`📊 Monitoring ${client.guilds.cache.size} servers`);

  updateDiscordCount();
  setInterval(updateDiscordCount, DISCORD_UPDATE_INTERVAL);
});

client.on('presenceUpdate', (oldP, newP) => {
  const had = oldP?.activities?.some(isDartotsuActivity);
  const has = newP?.activities?.some(isDartotsuActivity);

  if (had !== has) updateDiscordCount();
});

// ========= API =========
app.post('/api/heartbeat', (req, res) => {
  const { userId, username } = req.body;

  if (!userId)
    return res.status(400).json({ error: 'userId required' });

  activeUsers.set(userId, {
    lastSeen: Date.now(),
    username: username || 'Anonymous'
  });

  const heartbeatCount = getHeartbeatCount();
  const totalDiscord = discordWatchingCount + discordBrowsingCount;

  res.json({
    success: true,
    totalActive: heartbeatCount,
    watching: discordWatchingCount,
    browsing: totalDiscord
  });
});

app.get('/api/live-count', (req, res) => {
  const heartbeatCount = getHeartbeatCount();
  const totalDiscord = discordWatchingCount + discordBrowsingCount;

  res.json({
    total: heartbeatCount,
    watching: discordWatchingCount,
    browsing: totalDiscord,
    timestamp: Date.now(),
    lastDiscordUpdate
  });
});

app.get('/api/live-count/total', (req, res) => {
  res.json({
    count: getHeartbeatCount(),
    timestamp: Date.now()
  });
});

app.get('/api/live-count/watching', (req, res) => {
  res.json({
    count: discordWatchingCount,
    timestamp: Date.now()
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    discord: {
      ready: client.isReady(),
      guilds: client.guilds.cache.size,
      watching: discordWatchingCount,
      browsing: discordBrowsingCount
    },
    heartbeat: {
      tracked: activeUsers.size,
      active: getHeartbeatCount()
    }
  });
});

app.get('/api/debug/stats', (req, res) => {
  const now = Date.now();
  const heartbeatUsers = [];

  activeUsers.forEach((user, id) => {
    heartbeatUsers.push({
      userId: id.substring(0, 12) + '...',
      username: user.username,
      lastSeen: new Date(user.lastSeen).toISOString(),
      isActive: now - user.lastSeen < ACTIVE_THRESHOLD
    });
  });

  res.json({
    heartbeat: {
      totalTracked: activeUsers.size,
      currentlyActive: getHeartbeatCount(),
      users: heartbeatUsers
    },
    discord: {
      watching: discordWatchingCount,
      browsing: discordBrowsingCount,
      total: discordWatchingCount + discordBrowsingCount,
      lastUpdate: new Date(lastDiscordUpdate).toISOString()
    }
  });
});

// ========= START =========
app.listen(PORT, () => {
  console.log(`🚀 Hybrid tracker running on port ${PORT}`);
  console.log(`📊 Heartbeat threshold: ${ACTIVE_THRESHOLD / 1000}s`);
  console.log(`🎮 Discord tracking: Watching + Browsing`);
});

if (DISCORD_TOKEN) {
  client.login(DISCORD_TOKEN);
} else {
  console.warn('⚠️ No DISCORD_TOKEN — Discord tracking disabled');
}

process.on('SIGINT', () => {
  console.log('\n⏹️ Shutting down...');
  client.destroy();
  process.exit(0);
});
