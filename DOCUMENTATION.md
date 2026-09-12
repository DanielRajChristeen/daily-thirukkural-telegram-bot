# Daily Thirukkural Telegram Bot & Management Platform
## End-to-End System Documentation & Technical Specification

---

## 1. Executive Summary

The **Daily Thirukkural Telegram Bot & Management Platform** is a full-stack, zero-cost, dual-mode application designed to deliver ancient Tamil wisdom from the timeless classic **Thirukkural** (1,330 couplets across 133 chapters) directly to users via Telegram and an interactive web console.

### Key Capabilities
- **Automated Daily Thirukkural Delivery**: Sends daily curated couplets to subscribers at their individualized preferred time (with India Standard Time - IST support).
- **Dual Runtime Architecture**:
  - **Live Telegram Bot**: Long-polling or webhook integration with the official Telegram Bot API via `TELEGRAM_BOT_TOKEN`.
  - **Interactive Web Playground / Simulator**: Fully functional web sandbox allowing real-time testing and simulation without requiring a live Telegram account.
- **Multilingual Content Delivery**: Couplet text in Tamil with transliteration and multiple commentary perspectives (Mu. Varadarajanar, Mu. Karunanidhi, Solomon Pappaiah) along with English translation and explanations by Rev. G.U. Pope.
- **Zero-Cost Design**: Operates entirely on lightweight file-backed persistent storage (`data/bot_users.json`, `data/bot_logs.json`, `data/bot_status.json`) without recurring database or infrastructure expenses.
- **Full Admin & Analytics Dashboard**: Real-time activity logs, subscriber management, broadcast announcement engine, and graphical insights.

---

## 2. System Architecture

```
+-----------------------------------------------------------------------------------+
|                                 CLIENT SURFACES                                   |
|                                                                                   |
|  +--------------------------------+       +------------------------------------+  |
|  |     Telegram Messenger App     |       |    Web Management Console (React)  |  |
|  |  (Mobile / Desktop / Web Client) |     |  - Bot Playground (Simulator)      |  |
|  |                                |       |  - User Management & Scheduling    |  |
|  +---------------+----------------+       |  - Message Broadcaster             |  |
|                  |                        |  - Analytics & Activity Logs       |  |
|                  | HTTPS                  |  - Gateway & Bot Controls          |  |
|                  v                        +-----------------+------------------+  |
|        [ Telegram Bot API ]                                 | HTTP / REST         |
|                  |                                          v                     |
+------------------|------------------------------------------|---------------------+
                   |                                          |
                   v                                          v
+-----------------------------------------------------------------------------------+
|                            APPLICATION SERVER (Node.js / Express)                 |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | REST API Router (/api/bot/*, /api/users, /api/stats, /api/logs, etc.)       |  |
|  +-----------------------------------------------------------------------------+  |
|  +-----------------------------------+   +-------------------------------------+  |
|  | Telegram Poller / Bot Controller  |   | IST Daily Reminder Scheduler        |  |
|  | - Command Parser & Handler        |   | - 60-second Cron Loop               |  |
|  | - Inline Keyboard Callbacks       |   | - Exact Time Matcher (HH:MM AM/PM)  |  |
|  | - Message Formatter (HTML/Text)   |   | - Automated Couplet Dispatcher      |  |
|  +-----------------------------------+   +-------------------------------------+  |
|  +-----------------------------------------------------------------------------+  |
|  | Thirukkural Query Engine (1,330 Kurals, 133 Chapters, Search & Randomizers) |  |
|  +-----------------------------------------------------------------------------+  |
|  +-----------------------------------------------------------------------------+  |
|  | Data Layer & Local Cache (JSON Storage Engine with Auto-Sync)               |  |
|  +-----------------------------------------------------------------------------+  |
+-----------------------------------------------------------------------------------+
                                          |
                                          v
+-----------------------------------------------------------------------------------+
|                            PERSISTENT STORAGE LAYER                               |
|                                                                                   |
|  - data/bot_users.json   : Subscriber preferences, languages, scheduled times    |
|  - data/bot_logs.json    : Real-time traffic, delivery audits, system telemetry   |
|  - data/bot_status.json  : Service state (Running / Stopped)                      |
|  - src/kurals.ts         : Full 1,330 Thirukkural repository with commentary      |
|  - src/chapters.ts       : 133 Chapters categorized into 3 Paals                  |
+-----------------------------------------------------------------------------------+
```

---

## 3. Core Modules & Directory Layout

```
.
├── server.ts                    # Express backend, Vite SSR/Dev middleware, API routes, poller
├── src/
│   ├── main.tsx                 # React application entry point
│   ├── App.tsx                  # Root layout, navigation tabs, global state handlers
│   ├── types.ts                 # TypeScript interfaces (BotUser, ActivityLog, Kural, etc.)
│   ├── kurals.ts                # Master Thirukkural dataset (1,330 couplets)
│   ├── chapters.ts              # Athigaram (Chapter) metadata & section groupings
│   ├── index.css                # Global Tailwind CSS styles
│   ├── components/
│   │   ├── BotPlayground.tsx    # Live interactive Telegram simulator & chat widget
│   │   ├── UserManager.tsx      # Subscriber directory, edit dialog, reminder preferences
│   │   ├── Broadcaster.tsx      # Mass announcement engine with preview & delivery metrics
│   │   ├── KuralExplorer.tsx    # Search, filter, and study interface for all 1,330 kurals
│   │   ├── AnalyticsHub.tsx     # Language distributions, trigger times, traffic graphs
│   │   ├── ActivityLogs.tsx     # Real-time event monitor with log filtering & export
│   │   └── GatewayManager.tsx   # Telegram bot connectivity status, webhook/polling control
│   └── server/
│       ├── bot.ts               # Bot logic, message generators, IST reminder scheduler, poller
│       └── db.ts                # File-backed persistence layer for users and activity logs
├── data/
│   ├── bot_users.json           # User profiles and reminder schedules
│   ├── bot_logs.json            # Audit and execution logs
│   └── bot_status.json         # Persistent service power status
├── metadata.json                # Project identification and capabilities
├── package.json                 # Dependencies and build scripts
└── .env.example                 # Environment configuration template
```

---

## 4. Bot Features & Command Reference

The bot supports both direct slash commands and interactive inline button keyboards:

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `/start` | None | Welcome greeting, language selection menu, quick feature buttons, and automatic user profile creation. |
| `/today` | None | Delivers the current day's Thirukkural based on the Julian Day formula. |
| `/random` | None | Fetches an unpredictably chosen Thirukkural across all 133 chapters. |
| `/kural` | `<number>` (1-1330) | Retrieves an exact Thirukkural by its chronological sequence number. |
| `/search` | `<keyword>` | Full-text query against Tamil verses, English translations, transliterations, and meanings. |
| `/time` | `<HH:MM AM/PM>` | Sets the subscriber's preferred daily delivery time (e.g., `/time 07:00 AM`, `/time 06:30 PM`, `/time none`). |
| `/language` | None | Displays inline toggle buttons for **Tamil**, **English**, or **Both (Bilingual)**. |
| `/help` | None | Complete usage manual and command glossary. |
| `/about` | None | Historical background on Thiruvalluvar, the 3 sections (Aram, Porul, Inbam), and project details. |

### Inline Interactive Buttons
- **Language Switchers**: `lang_tamil`, `lang_english`, `lang_both`
- **Daily Actions**: `cmd_today`, `cmd_random`, `cmd_schedule`, `cmd_help`
- **Time Selection Presets**: Quick pickers for 06:00 AM, 08:00 AM, 12:00 PM, 06:00 PM, 09:00 PM, and Disabled.

---

## 5. Daily Reminder Engine & IST Time Matching

### Timezone Synchronization
To prevent discrepancies caused by cloud container hosting locations (which typically run in UTC), the scheduler explicitly executes in **Asia/Kolkata (India Standard Time - UTC+5:30)** using `Intl.DateTimeFormat`.

### Scheduling Mechanism
1. **Ticker Loop**: An active background timer fires every 60 seconds (`setInterval` in `src/server/bot.ts`).
2. **Time Normalization**: Current time is computed into strict 12-hour formatted strings (`HH:MM:AM` or `HH:MM:PM`, e.g., `07:00:AM`).
3. **Subscriber Matching**: The scheduler iterates through `data/bot_users.json` to find users whose `triggerTime` matches the current timestamp.
4. **Adaptive Delivery**:
   - For **Simulated Users** (Chat ID < 10,000,000): Recorded directly to activity logs and the simulator.
   - For **Live Telegram Subscribers** (Real numeric Telegram chat IDs): Sent immediately via the Telegram Bot API (`sendMessage` with HTML formatting).
5. **Audit Logging**: Each successful dispatch creates an entry in `data/bot_logs.json`.

---

## 6. Zero-Cost Architecture & Persistence Strategy

The system is engineered to run permanently with **$0 monthly operational cost**:
- **No Third-Party Database Fees**: Instead of requiring paid managed databases (MongoDB Atlas, Cloud SQL, Redis, DynamoDB), data is stored in transactional local JSON records with in-memory caching and disk flushing.
- **Efficient Memory Footprint**: Couplet data is compiled into static TypeScript structures, requiring minimal RAM during runtime.
- **Serverless / Container Ready**: Runs seamlessly on free-tier containers such as Cloud Run, Render, Railway, Fly.io, or VPS instances.

---

## 7. Web Console & Administrative Dashboard

The web management console provides 7 comprehensive operational interfaces:

1. **Bot Playground / Simulator**:
   - Realistic mobile phone viewport.
   - Live interactive message testing.
   - Inline keyboard interaction simulation.
   - Dynamic user switcher.

2. **User Management**:
   - Table view of all subscribers.
   - Filters for language preferences and reminder schedules.
   - Search by chat ID or username.
   - Add new user, edit existing preferences, or remove subscribers.

3. **Broadcaster Engine**:
   - Send one-time announcements to all subscribers or targeted language groups.
   - Markdown and HTML support with live preview.
   - Real-time success/failure counter.

4. **Thirukkural Explorer**:
   - Browse all 133 Chapters (Athigarams) grouped by Paal (Arathuppaal, Porutpaal, Kaamathuppaal).
   - Instant search across all 1,330 verses.
   - Detailed commentary views with audio pronunciation cues.

5. **Analytics Hub**:
   - Language distribution pie charts.
   - Reminder time frequency histograms.
   - Traffic volume metrics (Incoming vs Outgoing vs System).

6. **Activity Logs**:
   - Live streaming system audit logs.
   - Severity filtering (Info, Success, Error).
   - Export logs to JSON.

7. **Gateway Manager**:
   - Telegram Bot connectivity health checker.
   - Service start / stop toggle with persistent state.
   - Webhook URL inspection and error diagnostic tools.

---

## 8. Backend REST API Specification

| Method | Route | Description | Payload / Query |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Service uptime and status | None |
| `GET` | `/api/status` | Bot connection & service status | None |
| `POST` | `/api/bot/status` | Start or stop the bot service | `{ stopped: boolean }` |
| `POST` | `/api/bot/message` | Send message to simulator or bot | `{ chatId, message }` |
| `POST` | `/api/bot/callback` | Trigger inline button callback | `{ chatId, data }` |
| `GET` | `/api/users` | Retrieve all registered users | None |
| `POST` | `/api/users` | Add or update a user | `Partial<BotUser>` |
| `DELETE`| `/api/users/:chatId` | Delete a registered user | None |
| `POST` | `/api/broadcast` | Broadcast message to users | `{ message, targetLanguage }` |
| `GET` | `/api/stats` | Retrieve aggregated analytics | None |
| `GET` | `/api/logs` | Fetch activity and audit logs | None |
| `DELETE`| `/api/logs` | Clear activity logs | None |
| `POST` | `/api/webhook` | Telegram Webhook Receiver | Telegram Update Object |

---

## 9. Telegram Setup Guide (Step-by-Step)

To connect your live Telegram bot:

1. Open Telegram and search for **[@BotFather](https://t.me/BotFather)**.
2. Send `/newbot` and follow the prompts to choose a bot name and username (e.g. `MyThirukkuralBot`).
3. Copy the generated **HTTP API Token** (e.g. `7123456789:AAH...`).
4. Set the token in your environment or Secret settings:
   ```env
   TELEGRAM_BOT_TOKEN="7123456789:AAH..."
   ```
5. *(Optional)* Set up bot commands in BotFather by sending `/setcommands`:
   ```text
   start - Start the Thirukkural bot
   today - Today's Thirukkural couplet
   random - Read a random couplet
   kural - Get specific kural (e.g. /kural 1)
   search - Search couplets by keyword
   time - Set daily reminder time
   language - Set language preference
   help - Show user instructions
   about - About Thirukkural
   ```
6. Start the server — the bot will immediately begin polling and responding to incoming Telegram messages!

---

## 10. Local Development & Deployment

### Prerequisites
- Node.js 18+ or Bun
- npm or yarn

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd daily-thirukkural-bot

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env and supply your TELEGRAM_BOT_TOKEN if connecting a live bot

# Start development server (Port 3000)
npm run dev
```

### Production Build
```bash
# Compile client bundle and server binary
npm run build

# Start production server
npm start
```

---

## 11. Security & Best Practices

- **Token Protection**: `TELEGRAM_BOT_TOKEN` is never sent to the browser client and is accessed solely within `server.ts` and `src/server/bot.ts`.
- **Fault-Tolerant Poller**: Includes auto-reconnect backoff logic to handle intermittent network interruptions gracefully.
- **Sanitized HTML Output**: All dynamic couplet text and commentary are safely formatted before being dispatched to the Telegram API.
