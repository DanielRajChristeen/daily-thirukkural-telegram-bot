# Daily Thirukkural Telegram Bot & Management Platform
## End-to-End System Documentation & Technical Specification

---

## 1. Executive Summary

The **Daily Thirukkural Telegram Bot & Management Platform** is a full-stack, resilient, dual-mode application engineered to deliver ancient Tamil wisdom from the timeless classic **Thirukkural** (1,330 couplets across 133 chapters) to subscribers via Telegram and an interactive web management console.

### Key Capabilities
- **Automated Daily Thirukkural Delivery**: Schedules and delivers daily couplets to individual subscribers at their preferred time, synchronized strictly with **India Standard Time (IST - Asia/Kolkata, UTC+5:30)**.
- **Dual Runtime Architecture**:
  - **Live Telegram Bot**: Long-polling or webhook integration with the official Telegram Bot API via `TELEGRAM_BOT_TOKEN`.
  - **Interactive Web Playground / Simulator**: Fully functional web sandbox allowing real-time testing, command execution, and inline keyboard simulation without requiring a live Telegram account.
- **Authoritative Distributed Persistence**: Powered by **Google Cloud Firestore** as the primary source of truth, complemented by a zero-dependency local disk snapshot fallback (`data/`) for offline execution.
- **Idempotent Scheduler with Catch-Up Tolerance**: High-precision evaluation window featuring exact minute matching, +1 minute and +2 minute catch-up windows, and >= +3 minute rejection to eliminate duplicate or stale deliveries across serverless container restarts.
- **Interactive Visual Time Picker**: Built-in visual clock interface (`/time-picker`) supporting 12-hour/24-hour modes, dynamic analog clock hand animations, and instant presets, embeddable directly inside Telegram WebApps or web iframes.
- **Multilingual Content Delivery**: Couplet text in Tamil with transliteration and multiple commentary perspectives (Mu. Varadarajanar, Mu. Karunanidhi, Solomon Pappaiah) alongside English translations and explanations by Rev. G.U. Pope.
- **Zero-Cost & Serverless-Ready Architecture**: Engineered to run permanently within Google Cloud Run / container free tiers with $0 operational costs.
- **Full Administrative Dashboard**: Protected admin console featuring subscriber management, real-time streaming audit logs, broadcast announcement engine, and visual analytics.

---

## 2. System Architecture

```
+---------------------------------------------------------------------------------------------------+
|                                          CLIENT SURFACES                                          |
|                                                                                                   |
|  +-------------------------------+   +---------------------------------+   +-------------------+  |
|  |     Telegram Messenger App    |   |  Web Management Console (React) |   | Visual TimePicker |  |
|  | (Mobile / Desktop / Web App)  |   |  - Bot Playground (Simulator)   |   | (Telegram WebApp  |  |
|  |                               |   |  - User Management & Schedules  |   |  or Web iFrame)   |  |
|  +---------------+---------------+   |  - Announcement Broadcaster     |   +---------+---------+  |
|                  |                   |  - Analytics & Activity Logs    |             |            |
|                  | HTTPS             |  - Gateway & Connectivity Hub   |             | HTTP       |
|                  v                   +----------------+----------------+             |            |
|        [ Telegram Bot API ]                           | HTTP / REST                  |            |
|                  |                                    v                              v            |
+------------------|------------------------------------+------------------------------+------------+
                   |                                    |                              |
                   v                                    v                              v
+---------------------------------------------------------------------------------------------------+
|                               APPLICATION SERVER (Node.js / Express)                              |
|                                                                                                   |
|  +---------------------------------------------------------------------------------------------+  |
|  | REST API Router (/api/bot/*, /api/users/*, /api/stats, /api/logs, /api/admin/*)             |  |
|  +---------------------------------------------------------------------------------------------+  |
|  | Scheduler Endpoints (/api/scheduler/tick, /api/scheduler/daily-init, /api/scheduler/status) |  |
|  +---------------------------------------------------------------------------------------------+  |
|  | API 404 Catch-All Handler (Protects /api/* from falling through to React SPA)                |  |
|  +---------------------------------------------------------------------------------------------+  |
|  +-------------------------------------+   +---------------------------------------------------+  |
|  | Telegram Poller / Bot Controller    |   | IST Daily Reminder Scheduler                      |  |
|  | - Command Parser (/start, /today..) |   | - Multi-Trigger (Cron, Periodic, Traffic, Boot)   |  |
|  | - Inline Keyboard Callbacks         |   | - Asia/Kolkata Time Normalization                 |  |
|  | - Webhook Receiver & Poller Fallback|   | - Exact Match, +1m/+2m Catch-Up, +3m Rejection    |  |
|  | - Token-Redacted Safe Logging       |   | - Idempotent Claim & Concurrency Locking          |  |
|  +-------------------------------------+   +---------------------------------------------------+  |
|  +---------------------------------------------------------------------------------------------+  |
|  | Thirukkural Query Engine (1,330 Couplets, 133 Chapters, Full-Text Search & Julian Day Match)|  |
|  +---------------------------------------------------------------------------------------------+  |
|  +---------------------------------------------------------------------------------------------+  |
|  | Database Persistence Manager (Cloud Firestore Client + Local Disk Fallback Engine)          |  |
|  +---------------------------------------------------------------------------------------------+  |
+---------------------------------------------------------------------------------------------------+
                                   |                                     |
                  Authoritative    |                    Fallback         |
                  Remote State     v                    Local State      v
+---------------------------------------------------+ +---------------------------------------------+
|                 GOOGLE CLOUD FIRESTORE            | |               LOCAL DISK CACHE              |
|                                                   | |                                             |
| - users/{chatId}          : Subscriber preferences| | - data/kurals_all.json: 1,330 couplets DB   |
| - activity_logs/{logId}   : Audit logs & telemetry| | - data/bot_users.json : Offline user cache  |
| - reminder_deliveries/{id}: Idempotent claim lease| | - data/bot_logs.json  : Offline log cache   |
|                             & delivery records    | | - data/bot_status.json: Bot runtime state   |
+---------------------------------------------------+ +---------------------------------------------+
                                   ^
                                   | HTTP Periodic Ping (1 minute)
+----------------------------------+----------------------------------------------------------------+
|                 EXTERNAL SCHEDULER (cron-job.org / Cloud Scheduler)                               |
|                                                                                                   |
|  - GET/POST /api/scheduler/tick                                                                   |
|  - Optional Secret Validation: Header 'X-Scheduler-Secret', '?secret=', or 'Authorization: Bearer'|
+---------------------------------------------------------------------------------------------------+
```

---

## 3. Core Modules & Directory Layout

```
.
├── server.ts                             # Production Express server, Vite middleware, REST & scheduler routing
├── index.html                            # HTML entry point with metadata and Tailwind styling
├── metadata.json                         # AI Studio application metadata and capabilities
├── package.json                          # Node.js dependencies, build, and test scripts
├── tsconfig.json                         # TypeScript compiler configuration
├── vite.config.ts                        # Vite build configuration with React & Tailwind plugins
├── firestore.rules                       # Firestore security rules
├── firebase-blueprint.json               # Firestore schema specifications
├── firebase-applet-config.example.json   # Template configuration for Firebase credentials
├── .env.example                          # Environment variable template
├── .gitignore                            # Hardened ignore rules (secrets, subscriber data, build artifacts)
├── DOCUMENTATION.md                      # Comprehensive technical specification (this document)
├── README.md                             # Project overview and quick start guide
├── scripts/
│   ├── migrate-to-firestore.ts          # One-time migration script (local JSON -> Cloud Firestore)
│   └── seed_kurals.ts                    # Couplet ingestion and validation utility
├── tests/
│   └── reminder-logic.test.ts            # 19-stage automated test suite for scheduler & reminder architecture
├── data/
│   └── kurals_all.json                   # Complete static database of 1,330 Thirukkurals (tracked in Git)
│   ├── (bot_users.json)                  # Local runtime subscriber cache (ignored from Git)
│   ├── (bot_logs.json)                   # Local runtime activity logs (ignored from Git)
│   ├── (admin_auth.json)                 # Local admin credentials (ignored from Git)
│   └── (bot_status.json)                 # Local bot power state (ignored from Git)
└── src/
    ├── main.tsx                          # React DOM entry point
    ├── App.tsx                           # Master dashboard shell, tabs, and global state
    ├── types.ts                          # Shared TypeScript interfaces (BotUser, ActivityLog, etc.)
    ├── kurals.ts                         # Embedded master Thirukkural dataset with commentaries
    ├── chapters.ts                       # 133 Chapters categorized into 3 Paals (Aram, Porul, Inbam)
    ├── index.css                         # Tailwind CSS global import directives
    ├── components/
    │   ├── BotPlayground.tsx             # Interactive Telegram phone simulator & chat widget
    │   ├── UserManager.tsx               # Subscriber management directory & preference editor
    │   ├── Broadcaster.tsx               # Mass announcement engine with live preview & counters
    │   ├── KuralExplorer.tsx             # Verses exploration, search, and audio pronunciation guides
    │   ├── AnalyticsHub.tsx              # Graphical charts for languages, times, and traffic
    │   ├── ActivityLogs.tsx              # Real-time event monitor with log filtering & JSON export
    │   ├── GatewayManager.tsx            # Connectivity status, webhook / poller toggle, diagnostics
    │   ├── AdminAuthGate.tsx             # Security gate enforcing authentication for admin controls
    │   └── ChangePasswordModal.tsx       # Modal dialog for updating administrative password
    └── server/
        ├── bot.ts                        # Bot dispatcher, command parsers, reminder engine, poller
        ├── db.ts                         # Dual-layer persistence (Cloud Firestore + local fallback)
        └── flaskTimePickerUi.ts          # Standalone visual HTML/JS analog & digital time picker
```

---

## 4. Dual Persistence & Storage Architecture

The application implements a **Dual-Layer Persistence Pattern** ensuring continuous availability and zero data loss.

### 4.1 Cloud Firestore (Authoritative Source)

When configured with `firebase-applet-config.json` or environment credentials, Google Cloud Firestore serves as the primary distributed database:

1. **`/users/{chatId}`**:
   - `chatId` (number): Telegram subscriber unique identifier.
   - `username` (string, optional): Telegram handle.
   - `firstName` (string, optional): Subscriber display name.
   - `language` (enum: `"tamil" | "english" | "both"`): Preferred couplet language.
   - `triggerTime` (string): Daily recurring scheduled time in `HH:MM AM` format (e.g., `"07:30 AM"`) or `"none"`.
   - `lastActive` (number): Epoch timestamp (ms) of the most recent interaction.

2. **`/activity_logs/{logId}`**:
   - `id` (string): UUID or timestamped identifier.
   - `timestamp` (number): Event epoch time in milliseconds.
   - `chatId` (number): Associated subscriber ID (or 0 for system events).
   - `username` (string, optional): Sender username or system label.
   - `type` (enum: `"incoming" | "outgoing" | "system"`): Log category.
   - `text` (string): Log message payload.
   - `status` (enum: `"success" | "info" | "error"`): Operational status.

3. **`/reminder_deliveries/{deliveryId}`**:
   - `id` (string): Idempotency key formatted as `YYYY-MM-DD_chatId_triggerTime` (e.g., `2026-09-27_5164666817_07:30`).
   - `date` (string): Date in `YYYY-MM-DD` format.
   - `chatId` (number): Recipient Telegram chat ID.
   - `triggerTime` (string): Scheduled reminder time.
   - `status` (enum: `"CLAIMED" | "DELIVERED" | "FAILED"`): Atomic commitment state.
   - `claimedAt` (number): Timestamp when delivery lease was acquired.
   - `deliveredAt` (number, optional): Timestamp when Telegram API confirmed delivery.
   - `lastAttemptAt` (number): Timestamp of latest attempt.
   - `attempts` (number): Total dispatch attempts.
   - `kuralNumber` (number): Sequence number of Thirukkural delivered.
   - `lastError` (string, optional): Error details if Telegram dispatch failed.

### 4.2 Local Disk Snapshot Fallback

If Firestore is unavailable or during local offline development:
- State is buffered in memory (`usersCache`, `logsCache`) and synced to local JSON files (`data/bot_users.json`, `data/bot_logs.json`).
- When Firestore reconnects, local records are non-destructively merged into the remote collection.

### 4.3 Data Privacy & Git Sanitization

All files in `data/` containing user information (`bot_users.json`, `bot_logs.json`, `admin_auth.json`, `bot_status.json`) and `firebase-applet-config.json` are excluded from version control via `.gitignore`. The static public couplet dataset (`data/kurals_all.json`) is safely tracked.

---

## 5. Daily Reminder Engine & Evaluation Architecture

### 5.1 Timezone Normalization (IST - Asia/Kolkata)

Because cloud container instances commonly operate in UTC, all scheduler operations are explicitly bound to **India Standard Time (IST - UTC+5:30)** using `Intl.DateTimeFormat`:

```typescript
const istFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Asia/Kolkata',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true
});
```

### 5.2 Trigger Time Format Specification

- `triggerTime` is strictly date-independent and formatted as `HH:MM AM` or `HH:MM PM` (e.g. `07:40 AM`, `06:30 PM`) or `"none"`.
- Backward-compatible normalization converts legacy formats (`"07:40:AM"`, `"7:40 am"`, 24-hour `"19:40"`) into standardized `HH:MM AM/PM`.

### 5.3 Catch-Up Window & Tolerance Model

To guarantee reliable delivery in serverless container environments (which may experience cold starts, wake-up delays, or missed seconds):

| Condition | Calculation | Action | Result |
| :--- | :--- | :--- | :--- |
| **Exact Match** | `currentMinutes === targetMinutes` (`lagMinutes === 0`) | Dispatches reminder | Marked `DELIVERED`, `isCatchUp: false` |
| **+1m Catch-Up** | `currentMinutes === targetMinutes + 1` (`lagMinutes === 1`) | Dispatches if not claimed today | Marked `DELIVERED`, `isCatchUp: true` |
| **+2m Catch-Up** | `currentMinutes === targetMinutes + 2` (`lagMinutes === 2`) | Dispatches if not claimed today | Marked `DELIVERED`, `isCatchUp: true` |
| **>= +3m Stale** | `currentMinutes >= targetMinutes + 3` | Delivery rejected | Marked `SKIPPED` (Exceeds tolerance window) |

### 5.4 Concurrency Protection & Atomic Leases

1. **In-Flight Memory Lock**: Prevents overlapping execution ticks if an external cron triggers while an existing tick is actively processing.
2. **Firestore Atomic Lease**: Each user delivery attempts to claim an atomic delivery document in `/reminder_deliveries/{YYYY-MM-DD_chatId_triggerTime}`. If a concurrent worker or subsequent tick inspects the same candidate, the claim is rejected and duplicate delivery is prevented.
3. **Midnight Boundary Roll-Over**: Schedule comparisons compute relative minute distance modulo 1440, ensuring reminders set for `11:59 PM` evaluated at `12:01 AM` the next day calculate a +2 minute lag correctly rather than a negative duration.

### 5.5 Scheduler Execution Triggers

The reminder evaluation engine is invoked via four distinct pathways:
1. **Periodic Background Loop**: A local 60-second `setInterval` loop in `src/server/bot.ts`.
2. **External Scheduler Webhook**: HTTP requests to `GET/POST /api/scheduler/tick` from external services (e.g., **cron-job.org** or **Google Cloud Scheduler**).
3. **Opportunistic Traffic Tick**: Evaluation piggybacking on incoming web or bot interactions.
4. **Startup Initialization**: Auto-trigger on server boot via `/api/scheduler/daily-init`.

### 5.6 Scheduler Authentication (`validateSchedulerAuth`)

Scheduler endpoints (`/api/scheduler/*`) can be secured using an optional secret:
- Supports verification via:
  - Header: `X-Scheduler-Secret: <secret>`
  - Query parameter: `?secret=<secret>`
  - Authorization header: `Authorization: Bearer <secret>`
  - JSON body: `{"secret": "<secret>"}`
- **Open Default**: If `SCHEDULER_SECRET` is unset or blank in the server environment, access is permitted by default to enable immediate zero-config operation.

---

## 6. Bot Features & Command Reference

The bot supports both slash commands and interactive inline keyboards:

| Command | Arguments | Description |
| :--- | :--- | :--- |
| `/start` | None | Welcome greeting, language selection menu, quick action buttons, and automatic user profile creation. |
| `/today` | None | Delivers the current day's Thirukkural based on the Julian Day formula. |
| `/random` | None | Fetches an unpredictably chosen Thirukkural across all 1,330 couplets. |
| `/kural` | `<number>` (1-1330) | Retrieves an exact Thirukkural by its sequence number. |
| `/search` | `<keyword>` | Full-text query against Tamil verses, English translations, transliterations, and commentaries. |
| `/time` | `<HH:MM AM/PM>` | Sets the subscriber's preferred daily delivery time (e.g., `/time 07:00 AM`, `/time 06:30 PM`, `/time none`). |
| `/language` | None | Displays inline toggle buttons for **Tamil**, **English**, or **Both (Bilingual)**. |
| `/help` | None | Complete usage manual and command glossary. |
| `/about` | None | Historical background on Thiruvalluvar, the 3 sections (Aram, Porul, Inbam), and project details. |

### Interactive Inline Buttons
- **Language Switchers**: `lang_tamil`, `lang_english`, `lang_both`
- **Navigation Actions**: `cmd_today`, `cmd_random`, `cmd_schedule`, `cmd_help`, `btn_menu`
- **Time Selection Presets**: Quick pickers for 06:00 AM, 08:00 AM, 12:00 PM, 06:00 PM, 09:00 PM, and Disabled.
- **Web App Time Picker**: Opens the visual clock selector via Telegram WebApp integration.

---

## 7. Interactive Visual Time Picker (`/time-picker`)

Accessible at `/time-picker`, this dedicated visual clock interface provides:
- **Interactive Analog Clock**: SVG clock face with dynamic animated hour and minute hand positioning.
- **Dual Mode Switching**: Seamless toggle between Hour and Minute selection.
- **AM / PM Selector**: Instant meridiem switching with real-time preview.
- **Quick Preset Badges**: 06:00 AM (Early Bird), 08:00 AM (Morning), 12:00 PM (Noon), 06:00 PM (Evening), 09:00 PM (Night).
- **Direct Text Input**: Free-form time entry supporting `HH:MM AM/PM` with real-time format validation.
- **Telegram WebApp Integration**: Integrates with `window.Telegram.WebApp` to automatically apply user theme settings and send selected time back to Telegram.
- **iFrame Embedding**: Dispatches `postMessage` events (`TIME_PICKER_SAVED`) to communicate seamlessly with parent management windows.

---

## 8. Web Management Console & Admin Hub

The React management console provides 8 operational modules:

1. **Bot Playground / Simulator (`BotPlayground.tsx`)**:
   - Realistic mobile phone viewport for live testing.
   - Interactive command submission and inline keyboard callback handling.
   - Multi-user switcher simulating different subscriber profiles.

2. **User Management (`UserManager.tsx`)**:
   - Subscriber table with live pagination and search.
   - Filters for language preferences and reminder schedules.
   - Modals for adding, editing, or removing subscribers.

3. **Broadcaster Engine (`Broadcaster.tsx`)**:
   - Mass announcement dispatcher targeting all subscribers or specific language cohorts.
   - Markdown and HTML live preview.
   - Real-time success, failure, and delivery counters.

4. **Thirukkural Explorer (`KuralExplorer.tsx`)**:
   - Browse all 133 Chapters grouped by Section (Arathuppaal, Porutpaal, Kaamathuppaal).
   - Instant search across all 1,330 couplets.
   - Complete multi-commentary view with audio pronunciation cues.

5. **Analytics Hub (`AnalyticsHub.tsx`)**:
   - Subscriber language distribution pie charts.
   - Reminder time frequency histograms.
   - Traffic volume metrics (Incoming vs Outgoing vs System).

6. **Activity Logs (`ActivityLogs.tsx`)**:
   - Live streaming system audit logs with severity filtering (Info, Success, Error).
   - One-click export to formatted JSON.

7. **Gateway Manager (`GatewayManager.tsx`)**:
   - Telegram Bot API connectivity health monitor.
   - Long-polling vs Webhook toggle with webhook URL tester.
   - Service start/stop controls with persistent state.

8. **Admin Security Gate (`AdminAuthGate.tsx`, `ChangePasswordModal.tsx`)**:
   - Session-based authentication protecting management interfaces.
   - Change password dialog with secure local credential hashing.

---

## 9. Backend REST API Specification

### 9.1 Service & Health Endpoints

| Method | Route | Description | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Server uptime, boot timestamp, and health status | None |
| `GET` | `/api/status` | Bot connectivity, power state, and subscriber count | None |
| `POST` | `/api/bot/status` | Start or stop the bot service (`{ stopped: boolean }`) | Admin |

### 9.2 Scheduler & Cron Endpoints

| Method | Route | Description | Auth |
| :--- | :--- | :--- | :--- |
| `ALL` | `/api/scheduler/tick` | Evaluates due reminders, dispatches couplets, returns sanitized metrics | `validateSchedulerAuth` |
| `ALL` | `/api/scheduler/daily-init` | Triggers daily initialization and due reminders on startup/cron | `validateSchedulerAuth` |
| `GET` | `/api/scheduler/status` | Detailed telemetry (uptime, boot timestamp, memory, scheduler status) | None |

#### Sample `/api/scheduler/tick` Response:
```json
{
  "success": true,
  "timestamp": "2026-09-27T02:00:00.000Z",
  "currentTimeIST": "07:30 AM",
  "evaluatedCount": 5,
  "dueCount": 1,
  "deliveredCount": 1,
  "skippedCount": 0,
  "failedCount": 0,
  "source": "external_trigger"
}
```

### 9.3 Telegram Webhook & Messaging

| Method | Route | Description | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/webhook` | Telegram update receiver | `X-Telegram-Bot-Api-Secret-Token` |
| `POST` | `/api/bot/message` | Sends user message to simulator or bot | None |
| `POST` | `/api/bot/callback` | Simulates or handles inline keyboard callback | None |

### 9.4 User Management & Broadcasts

| Method | Route | Description | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/users` | List all registered subscribers | None |
| `POST` | `/api/users` | Add or update subscriber preferences | None |
| `POST` | `/api/users/update` | Updates preferred reminder time for a subscriber | None |
| `DELETE`| `/api/users/:chatId` | Remove a subscriber | Admin |
| `POST` | `/api/broadcast` | Broadcast message to all or language-specific subscribers | Admin |

### 9.5 Logs & Analytics

| Method | Route | Description | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/stats` | Aggregated analytics (languages, schedule distributions, counts) | None |
| `GET` | `/api/logs` | Fetch real-time activity and audit logs | None |
| `DELETE`| `/api/logs` | Clear audit logs | Admin |

### 9.6 Administrative Authentication

| Method | Route | Description | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/admin/login` | Validates admin username and password | None |
| `POST` | `/api/admin/change-password` | Updates administrative credentials | Admin |

### 9.7 API Catch-All Protection

All unmatched `/api/*` requests are captured by:
```typescript
app.all('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `API route not found: ${req.method} ${req.path}`
  });
});
```
This guarantees that missing API endpoints never fall through to the React SPA (`index.html`) returning HTTP 200.

---

## 10. Environment Configuration

Define the following environment variables in `.env` (or via Cloud Run Secrets):

| Variable | Description | Required | Example |
| :--- | :--- | :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | Bot API Token issued by [@BotFather](https://t.me/BotFather) | Optional (Simulator mode if blank) | `8654860985:AA...` |
| `SCHEDULER_SECRET` | Secret token required to invoke `/api/scheduler/*` | Optional (Open by default if unset) | `my-secret-key-123` |
| `TELEGRAM_WEBHOOK_SECRET`| Secret token validated on incoming Telegram webhook updates | Optional | `webhook-secret-456` |
| `PUBLIC_APP_URL` | Public production HTTPS domain (used for Telegram Webhooks) | Optional | `https://daily-thirukkural.ai.studio` |
| `APP_URL` | Cloud Run container self-referential URL | Injected by Cloud Run | `https://app.run.app` |
| `GEMINI_API_KEY` | Google Gemini API key for smart commentary features | Optional | `AIzaSy...` |
| `PORT` | HTTP server port | Optional (Default: `3000`) | `3000` |

---

## 11. Automated Test Suite (19 Stages)

The application includes an end-to-end automated test suite verifying all reminder, concurrency, security, and scheduling invariants:

```bash
npm test
```

### Test Suite Stages:
1. **Stage 0**: User document recurring time format verification (date-independent format).
2. **Stage 1**: Authorized tick authentication (Header, query param, Bearer token, open default).
3. **Stage 2**: Unauthorized tick rejection when secret is configured.
4. **Stage 3**: Exact trigger time (07:40 AM tick for 07:40 AM schedule) -> Immediate delivery.
5. **Stage 4**: +1 minute catch-up window (07:41 AM tick for 07:40 AM schedule) -> Catches up.
6. **Stage 5**: +2 minutes catch-up window (07:42 AM tick for 07:40 AM schedule) -> Catches up.
7. **Stage 6**: +3 minutes stale rejection (07:43 AM tick for 07:40 AM schedule) -> Rejected.
8. **Stage 7**: Duplicate tick prevention (second tick on same schedule is skipped).
9. **Stage 8**: Concurrent tick race condition (`Promise.all` simultaneous dispatch test).
10. **Stage 9**: Server restart recovery (reconstructs state and preserves trigger schedules).
11. **Stage 10**: Previous-day delivery record does not block today's delivery.
12. **Stage 11**: Multi-user staggered schedule evaluation (07:40 AM vs 08:45 AM).
13. **Stage 12**: Multi-user shared schedule batch evaluation.
14. **Stage 13**: Midnight boundary rollover (11:59 PM evaluated at 12:01 AM next day).
15. **Stage 14**: 12:00 AM (00:00) reminder delivery across consecutive days.
16. **Stage 15**: Firestore atomic delivery claim collision handling.
17. **Stage 16**: Telegram API failure handling (marked `FAILED`, not `DELIVERED`).
18. **Stage 17**: Service stopped state enforcement (delivers 0 messages while stopped).
19. **Stage 18**: Response structure privacy verification (zero leakage of subscriber chat IDs, usernames, or secrets).
20. **Stage 19**: Telegram webhook command parser & user preference update verification.

---

## 12. Local Development & Deployment

### 12.1 Prerequisites
- Node.js 18+ or Bun
- npm or yarn

### 12.2 Local Development
```bash
# 1. Clone repository
git clone <repository-url>
cd daily-thirukkural-bot

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
# Edit .env with your TELEGRAM_BOT_TOKEN

# 4. Start development server (Port 3000)
npm run dev
```

### 12.3 Production Build & Execution
```bash
# Build frontend bundle and standalone server binary
npm run build

# Start production server
npm start
```

### 12.4 Setting Up External Cron (cron-job.org / Cloud Scheduler)
To ensure reminders trigger reliably when running in serverless environments that sleep between requests:
1. Register a job at [cron-job.org](https://cron-job.org).
2. Set URL to: `https://<YOUR_DOMAIN>/api/scheduler/tick`
3. Set Method: `GET` (or `POST`).
4. Set Schedule: Every 1 minute (`* * * * *`).
5. (Optional) If `SCHEDULER_SECRET` is set in your environment, add header:
   `X-Scheduler-Secret: <your_secret>`

---

## 13. Security & Operational Hardening

- **Token Protection & Redaction**: `TELEGRAM_BOT_TOKEN` is never sent to client browsers. Internal loggers automatically redact bot tokens and credentials before persisting logs.
- **Git & Repository Sanitization**: Hardened `.gitignore` prevents inadvertent tracking of credentials, subscriber records, API keys, or private audit logs. A sanitized `firebase-applet-config.example.json` template is provided for open-source distributions.
- **Fault-Tolerant Poller**: Includes exponential backoff and error retry mechanisms to recover from network disconnects or Telegram API rate limits.
- **HTML Sanitization**: All dynamic couplet text and commentary are safely encoded before dispatching to the Telegram Bot API to avoid injection vulnerabilities.
