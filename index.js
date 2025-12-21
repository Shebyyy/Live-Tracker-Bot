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

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// State Management
const activeUsers = new Map(); // Heartbeat tracking: { userId: { lastSeen, username } }
let discordWatchingCount = 0; // Users with "watching" RPC
let discordBrowsingCount = 0; // Users with "browsing" RPC
let lastDiscordUpdate = Date.now();

// Configuration
const ACTIVE_THRESHOLD = 120000; // 2 minutes
const CLEANUP_INTERVAL = 60000; // 1 minute
const DISCORD_UPDATE_INTERVAL = 30000; // 30 seconds

// ============= HEARTBEAT SYSTEM =============

function getHeartbeatCount() {
  const now = Date.now();
  let count = 0;
  
  activeUsers.forEach((user) => {
    if (now - user.lastSeen < ACTIVE_THRESHOLD) {
      count++;
    }
  });
  
  return count;
}

function cleanupInactiveUsers() {
  const now = Date.now();
  const toDelete = [];
  
  activeUsers.forEach((user, userId) => {
    if (now - user.lastSeen > ACTIVE_THRESHOLD * 2) {
      toDelete.push(userId);
    }
  });
  
  toDelete.forEach(userId => activeUsers.delete(userId));
  
  if (toDelete.length > 0) {
    console.log(`[${new Date().toISOString()}] Cleaned up ${toDelete.length} inactive users`);
  }
}

setInterval(cleanupInactiveUsers, CLEANUP_INTERVAL);

// ============= DISCORD RPC TRACKING =============

function updateDiscordCount() {
  try {
    const guilds = client.guilds.cache;
    const uniqueWatching = new Set();
    const uniqueBrowsing = new Set();

    guilds.forEach(guild => {
      guild.members.cache.forEach(member => {
        const activities = member.presence?.activities || [];
        
        activities.forEach(activity => {
          if (activity.applicationId === DARTOTSU_APP_ID) {
            const state = activity.state || '';
            const details = activity.details || '';
            
            // Check if watching/reading (has episode/chapter info)
            if (state.includes('Episode:') || state.includes('Chapter:')) {
              uniqueWatching.add(member.id);
            } 
            // Otherwise browsing
            else if (details.includes('Browsing') || activity.name === 'Dartotsu') {
              uniqueBrowsing.add(member.id);
            }
          }
        });
      });
    });

    discordWatchingCount = uniqueWatching.size;
    discordBrowsingCount = uniqueBrowsing.size;
    lastDiscordUpdate = Date.now();
    
    console.log(`[${new Date().toISOString()}] Discord: ${discordWatchingCount} watching, ${discordBrowsingCount} browsing`);
  } catch (error) {
    console.error('Error updating Discord count:', error);
  }
}

// ============= DISCORD BOT EVENTS =============

client.once('ready', () => {
  console.log(`✅ Discord bot logged in as ${client.user.tag}`);
  console.log(`📊 Monitoring ${client.guilds.cache.size} servers`);
  
  updateDiscordCount();
  setInterval(updateDiscordCount, DISCORD_UPDATE_INTERVAL);
});

client.on('presenceUpdate', (oldPresence, newPresence) => {
  const hadDartotsu = oldPresence?.activities?.some(
    activity => activity.applicationId === DARTOTSU_APP_ID
  );
  const hasDartotsu = newPresence?.activities?.some(
    activity => activity.applicationId === DARTOTSU_APP_ID
  );

  if (hadDartotsu !== hasDartotsu) {
    updateDiscordCount();
  }
});

// ============= API ENDPOINTS =============

// Heartbeat endpoint
app.post('/api/heartbeat', (req, res) => {
  const { userId, username } = req.body;
  
  if (!userId) {
    return res.status(400).json({ error: 'userId required' });
  }
  
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

// Get live counts (all metrics)
app.get('/api/live-count', (req, res) => {
  const heartbeatCount = getHeartbeatCount();
  const totalDiscord = discordWatchingCount + discordBrowsingCount;
  
  res.json({
    total: heartbeatCount,           // Total app users (heartbeat)
    watching: discordWatchingCount,  // Users watching/reading (Discord RPC)
    browsing: totalDiscord,          // Total Discord users (browsing + watching)
    timestamp: Date.now(),
    lastDiscordUpdate: lastDiscordUpdate
  });
});

// Backward compatible - returns total
app.get('/api/live-count/total', (req, res) => {
  res.json({
    count: getHeartbeatCount(),
    timestamp: Date.now()
  });
});

// Get only watching count
app.get('/api/live-count/watching', (req, res) => {
  res.json({
    count: discordWatchingCount,
    timestamp: Date.now()
  });
});

// Health check
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

// Debug endpoint
app.get('/api/debug/stats', (req, res) => {
  const now = Date.now();
  const heartbeatUsers = [];
  
  activeUsers.forEach((user, userId) => {
    heartbeatUsers.push({
      userId: userId.substring(0, 12) + '...',
      username: user.username,
      lastSeen: new Date(user.lastSeen).toISOString(),
      isActive: (now - user.lastSeen) < ACTIVE_THRESHOLD
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

// ============= START SERVICES =============

// Start Express server
app.listen(PORT, () => {
  console.log(`🚀 Hybrid tracker running on port ${PORT}`);
  console.log(`📊 Heartbeat threshold: ${ACTIVE_THRESHOLD/1000}s`);
  console.log(`🎮 Discord tracking: Watching + Browsing`);
});

// Start Discord bot
if (DISCORD_TOKEN) {
  client.login(DISCORD_TOKEN);
} else {
  console.warn('⚠️  No DISCORD_TOKEN provided - Discord tracking disabled');
  console.log('💡 Heartbeat tracking will still work!');
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n⏹️  Shutting down gracefully...');
  client.destroy();
  process.exit(0);
});
