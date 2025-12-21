# Dartotsu Hybrid Tracker Bot

Tracks live Dartotsu app users using Discord RPC + Heartbeat system.

## Features

- 🟢 **Heartbeat Tracking**: Counts all users with app open
- 🟠 **Discord RPC Tracking**: Counts users watching/reading
- 📊 **Real-time Updates**: Updates every 30 seconds
- 🌐 **REST API**: Easy integration with Flutter app
- 🚀 **Lightweight**: ~50-80MB RAM usage

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env` file:

```env
DISCORD_TOKEN=your_discord_bot_token_here
PORT=3000
```

### 3. Run Bot

```bash
# Development
npm run dev

# Production
npm start
```

### 4. Test

```bash
# Health check
curl http://localhost:3000/api/health

# Live count
curl http://localhost:3000/api/live-count
```

## API Endpoints

### GET `/api/live-count`

Returns current live user counts.

**Response:**
```json
{
  "total": 42,
  "watching": 15,
  "browsing": 28,
  "timestamp": 1234567890123,
  "lastDiscordUpdate": 1234567890000
}
```

### POST `/api/heartbeat`

Receive heartbeat from app.

**Request:**
```json
{
  "userId": "android_abc123",
  "username": "User"
}
```

**Response:**
```json
{
  "success": true,
  "totalActive": 42,
  "watching": 15,
  "browsing": 28
}
```

### GET `/api/health`

Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "uptime": 3600,
  "discord": {
    "ready": true,
    "guilds": 5,
    "watching": 15,
    "browsing": 13
  },
  "heartbeat": {
    "tracked": 50,
    "active": 42
  }
}
```

## Discord Bot Setup

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Create new application
3. Go to Bot tab → Add Bot
4. **Enable these intents:**
   - ✅ PRESENCE INTENT (Required!)
   - ✅ SERVER MEMBERS INTENT (Required!)
5. Copy bot token
6. Invite bot to your server:
   ```
   https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=0&scope=bot
   ```

## Deployment

### Railway (Recommended)

1. Push to GitHub
2. Connect to Railway
3. Add `DISCORD_TOKEN` environment variable
4. Deploy automatically

### Render

1. Create Web Service
2. Connect GitHub repo
3. Build: `npm install`
4. Start: `npm start`
5. Add `DISCORD_TOKEN` environment variable

### Oracle Cloud

See deployment guide for VPS setup.

## Configuration

Edit `index.js` to adjust:

```javascript
const ACTIVE_THRESHOLD = 120000;      // 2 minutes = active user
const CLEANUP_INTERVAL = 60000;       // Clean every 1 minute
const DISCORD_UPDATE_INTERVAL = 30000; // Update Discord every 30s
```

## Monitoring

View debug stats (development only):

```bash
curl http://localhost:3000/api/debug/stats
```

## Troubleshooting

**Bot shows "Used disallowed intents":**
- Enable PRESENCE INTENT and SERVER MEMBERS INTENT in Discord Developer Portal

**Discord count always 0:**
- Make sure bot is in at least one server
- Check users have Discord RPC enabled in Dartotsu app

**Heartbeat count always 0:**
- Verify Flutter app is sending heartbeats
- Check `API_BASE_URL` is correct in Flutter app
- Test with: `curl -X POST http://localhost:3000/api/heartbeat -H "Content-Type: application/json" -d '{"userId":"test","username":"Test"}'`

## License

MIT
