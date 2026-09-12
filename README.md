# Daily Thirukkural Telegram Bot Companion

A zero-cost, full-stack Daily Thirukkural Telegram Bot and Web Management Console with custom delivery time scheduling, search, bilingual commentary (Tamil & English), interactive playground, and analytics.

---

## 📖 Full Documentation
For the complete technical specification, architectural diagrams, REST API reference, and setup manual, please refer to **[DOCUMENTATION.md](./DOCUMENTATION.md)**.

---

## ⚡ Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
Create a `.env` file or set the secret:
```env
TELEGRAM_BOT_TOKEN="your_bot_token_from_botfather"
```
*(Note: If no token is provided, the application runs seamlessly in simulated mode using the built-in Web Playground).*

### 3. Run Development Server
```bash
npm run dev
```
Open `http://localhost:3000` in your browser.

### 4. Build for Production
```bash
npm run build
npm start
```

---

## 🌟 Key Features
- **1,330 Thirukkurals**: Complete database across all 133 chapters with Tamil text, transliteration, and commentary by Mu. Varadarajanar, Mu. Karunanidhi, Solomon Pappaiah, and G.U. Pope.
- **Custom Reminder Scheduler**: Accurate India Standard Time (IST) scheduler triggering daily couplets at each subscriber's specified time.
- **Zero-Cost Architecture**: File-backed persistent storage requiring $0 database hosting.
- **Interactive Simulator**: Test commands and inline buttons right inside the web console.
- **Admin Dashboard**: Manage users, send broadcasts, view real-time activity logs, and monitor analytics.
