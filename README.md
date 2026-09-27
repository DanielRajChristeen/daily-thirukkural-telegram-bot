# Daily Thirukkural Telegram Bot Companion

A zero-cost, resilient, full-stack Daily Thirukkural Telegram Bot and Web Management Console with custom delivery time scheduling (India Standard Time - IST), full-text search, bilingual commentary (Tamil & English), interactive web playground, visual time picker, and administrative analytics.

---

## 📖 Full Technical Documentation
For the complete technical specification, architectural diagrams, persistence model, scheduler catch-up tolerance logic, REST API reference, and setup manual, please refer to **[DOCUMENTATION.md](./DOCUMENTATION.md)**.

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Supply your Telegram Bot Token if running a live bot:
```env
TELEGRAM_BOT_TOKEN="your_bot_token_from_botfather"
```
*(Note: If no token is provided, the application runs seamlessly in simulated mode using the built-in Web Playground).*

### 3. Run Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### 4. Run Automated Tests
```bash
npm test
```
Executes the comprehensive 19-stage reminder architecture test suite verifying exact matching, catch-up tolerances (+1m/+2m), stale rejection (+3m), atomic claim idempotency, and restart recovery.

### 5. Build for Production
```bash
npm run build
npm start
```

---

## 🌟 Key Features

- **1,330 Thirukkurals**: Complete offline database across all 133 chapters with Tamil text, transliteration, and commentary by Mu. Varadarajanar, Mu. Karunanidhi, Solomon Pappaiah, and Rev. G.U. Pope.
- **Accurate IST Reminder Scheduler**: Strict India Standard Time (Asia/Kolkata) scheduler with exact-minute matching, +1m/+2m tolerance catch-up windows, and atomic delivery claim idempotency.
- **Dual Persistence Architecture**: Google Cloud Firestore as the authoritative remote source of truth with local disk snapshot caching for offline reliability.
- **Interactive Visual Time Picker**: Built-in clock face (`/time-picker`) supporting 12-hour/24-hour modes and dynamic analog clock hands, embeddable in Telegram WebApps or web iframes.
- **Interactive Simulator**: Test commands (`/start`, `/today`, `/random`, `/time`, `/search`) and inline buttons right inside the web console.
- **Admin Dashboard**: Manage subscribers, send targeted broadcasts, inspect live activity logs, and analyze usage trends.
- **External Scheduler Endpoints**: Lightweight `/api/scheduler/tick` and `/api/scheduler/daily-init` endpoints compatible with cron-job.org or Google Cloud Scheduler.
- **Zero-Cost & Serverless Ready**: Engineered for permanent $0 operational cost on Google Cloud Run and free-tier containers.
