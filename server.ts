import 'dotenv/config';
import express from 'express';
import * as path from 'path';
import { createServer as createViteServer } from 'vite';
import { 
  getAllUsers, 
  getUser, 
  saveUser, 
  deleteUser, 
  getActivityLogs, 
  clearActivityLogs, 
  addActivityLog,
  verifyAdminLogin,
  changeAdminPassword
} from './src/server/db';
import { 
  handleBotMessage, 
  handleBotCallback, 
  startRealTelegramBot, 
  startReminderScheduler,
  isBotServiceStopped,
  stopBotService,
  startBotService,
  handleTelegramUpdate,
  setAppUrl
} from './src/server/bot';
import { renderFlaskTimePickerHtml } from './src/server/flaskTimePickerUi';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Trust proxy for correct protocol & forwarded headers behind nginx/Cloud Run
  app.set('trust proxy', 1);

  // Support JSON bodies for API calls
  app.use(express.json());

  // Track active base URL for Telegram WebApp and links
  app.use((req, res, next) => {
    const rawHost = req.headers['x-forwarded-host'] || req.get('host');
    if (rawHost) {
      const host = String(rawHost).split(',')[0].trim();
      if (!host.includes('localhost') && !host.includes('127.0.0.1')) {
        // Cloud Run & AI Studio public endpoints are always terminated with HTTPS
        setAppUrl(`https://${host.replace(/^https?:\/\//, '')}`);
      }
    }
    next();
  });

  // API Route: Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // API Route: Bot Connection & Config Status
  app.get('/api/status', (req, res) => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const hasToken = !!(token && token !== 'MY_TELEGRAM_BOT_TOKEN' && token.trim() !== '');
    res.json({
      hasToken,
      botUsername: '@daily_thirukkural_bot',
      appName: 'Daily Thirukkural Telegram Bot Companion',
      localTime: new Date().toISOString(),
      stopped: isBotServiceStopped
    });
  });

  // API Route: Get and Toggle Bot Service Status
  app.get('/api/bot-status', (req, res) => {
    res.json({ stopped: isBotServiceStopped });
  });

  app.post('/api/bot-status/toggle', (req, res) => {
    if (isBotServiceStopped) {
      startBotService();
    } else {
      stopBotService();
    }
    res.json({ stopped: isBotServiceStopped });
  });

  // API Route: Get all registered bot users
  app.get('/api/users', (req, res) => {
    try {
      const users = getAllUsers();
      res.json(users);
    } catch (err) {
      res.status(500).json({ error: 'Failed to retrieve bot users.' });
    }
  });

  // API Route: Update or create a user in simulator
  app.post('/api/users/update', (req, res) => {
    const { chatId, language, triggerTime, username, firstName } = req.body;
    if (!chatId) {
      return res.status(400).json({ error: 'chatId is required.' });
    }
    try {
      const updatePayload: any = {};
      if (language) updatePayload.language = language;
      if (triggerTime) updatePayload.triggerTime = triggerTime;
      if (username !== undefined) updatePayload.username = username;
      if (firstName !== undefined) updatePayload.firstName = firstName;

      const user = saveUser(chatId, updatePayload);
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update user.' });
    }
  });

  // API Route: Delete / Reset a user from companion dashboard
  app.post('/api/users/delete/:chatId', (req, res) => {
    const chatId = parseInt(req.params.chatId, 10);
    if (isNaN(chatId)) {
      return res.status(400).json({ error: 'Invalid chatId.' });
    }
    try {
      const success = deleteUser(chatId);
      res.json({ success });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete user.' });
    }
  });

  // API Route: Telegram Webhook (Processes updates from Telegram in real-time)
  app.post('/api/telegram-webhook', async (req, res) => {
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN is not configured' });
      }
      
      // Process update asynchronously
      await handleTelegramUpdate(token, req.body);
      res.sendStatus(200);
    } catch (err) {
      console.error('Error in telegram-webhook endpoint:', err);
      res.sendStatus(500);
    }
  });

  // API Route: Get Webhook Info
  app.get('/api/webhook-status', async (req, res) => {
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token || token === 'MY_TELEGRAM_BOT_TOKEN') {
        return res.json({ hasToken: false, webhookActive: false });
      }

      const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
      const data: any = await response.json();
      
      res.json({
        hasToken: true,
        webhookActive: data.ok && !!data.result.url,
        url: data.ok ? data.result.url : '',
        pendingUpdateCount: data.ok ? data.result.pending_update_count : 0,
        lastErrorDate: data.ok ? data.result.last_error_date : null,
        lastErrorMessage: data.ok ? data.result.last_error_message : ''
      });
    } catch (err) {
      console.error('Error getting webhook info:', err);
      res.status(500).json({ error: 'Failed to fetch webhook info from Telegram' });
    }
  });

  // API Route: Set Webhook
  app.post('/api/webhook-setup', async (req, res) => {
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token || token === 'MY_TELEGRAM_BOT_TOKEN') {
        return res.status(400).json({ error: 'Telegram Token is missing or placeholder.' });
      }

      // Determine webhook URL. If none is supplied, we construct it from host header
      let webhookUrl = req.body.url;
      if (!webhookUrl) {
        const host = req.headers['x-forwarded-host'] || req.get('host');
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        webhookUrl = `${protocol}://${host}`;
      }

      // Append standard path
      if (!webhookUrl.endsWith('/api/telegram-webhook')) {
        webhookUrl = `${webhookUrl.replace(/\/$/, '')}/api/telegram-webhook`;
      }

      console.log(`🔗 Registering Telegram Webhook with URL: ${webhookUrl}`);
      const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${webhookUrl}&drop_pending_updates=true`);
      const data: any = await response.json();

      if (data.ok) {
        addActivityLog(0, 'system', 'system', `Registered webhook URL: ${webhookUrl}`, 'success');
        res.json({ success: true, message: 'Webhook successfully registered!', url: webhookUrl });
      } else {
        res.status(400).json({ error: data.description || 'Telegram failed to set webhook' });
      }
    } catch (err) {
      console.error('Error registering webhook:', err);
      res.status(500).json({ error: 'Failed to configure Telegram Webhook' });
    }
  });

  // API Route: Delete Webhook (turns back to polling/offline)
  app.post('/api/webhook-delete', async (req, res) => {
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token || token === 'MY_TELEGRAM_BOT_TOKEN') {
        return res.status(400).json({ error: 'Telegram Token is missing.' });
      }

      const response = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=true`);
      const data: any = await response.json();

      if (data.ok) {
        addActivityLog(0, 'system', 'system', `Deleted webhook registration`, 'info');
        // Restart the polling bot loop since the webhook was deleted
        startRealTelegramBot(token);
        res.json({ success: true, message: 'Webhook removed. Long-polling/Simulated mode restored.' });
      } else {
        res.status(400).json({ error: data.description || 'Telegram failed to delete webhook' });
      }
    } catch (err) {
      console.error('Error deleting webhook:', err);
      res.status(500).json({ error: 'Failed to remove Telegram Webhook' });
    }
  });

  // API Route: Admin Username & Password Login
  app.post('/api/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        authorized: false,
        error: 'Both username and password are required.'
      });
    }

    const isValid = verifyAdminLogin(username, password);
    if (isValid) {
      addActivityLog(0, 'admin', 'system', `Admin authenticated successfully (username: ${username})`, 'success');
      return res.json({
        authorized: true,
        user: {
          username: 'Admin',
          signedInAt: Date.now()
        }
      });
    } else {
      addActivityLog(0, 'system', 'system', `Failed admin login attempt (username: ${username})`, 'error');
      return res.status(401).json({
        authorized: false,
        error: 'Invalid username or password. Please check your credentials.'
      });
    }
  });

  // API Route: Admin Change Password
  app.post('/api/admin/change-password', (req, res) => {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Both current password and new password are required.'
      });
    }

    if (newPassword.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 3 characters long.'
      });
    }

    const result = changeAdminPassword(currentPassword, newPassword);
    if (result.success) {
      addActivityLog(0, 'admin', 'system', 'Admin password changed successfully', 'success');
      return res.json({
        success: true,
        message: 'Password updated successfully.'
      });
    } else {
      addActivityLog(0, 'admin', 'system', `Password change failed: ${result.error}`, 'error');
      return res.status(400).json({
        success: false,
        error: result.error || 'Failed to change password.'
      });
    }
  });

  // API Route: Get activity logs
  app.get('/api/activity-logs', (req, res) => {
    res.json(getActivityLogs());
  });

  // API Route: Clear activity logs
  app.post('/api/activity-logs/clear', (req, res) => {
    clearActivityLogs();
    res.json({ success: true });
  });

  // API Route: Admin Stats (Aggregate analytics)
  app.get('/api/admin-stats', (req, res) => {
    try {
      const users = getAllUsers();
      const logs = getActivityLogs();

      // Languages breakdown
      let tamilCount = 0;
      let englishCount = 0;
      let bothCount = 0;

      // Helper to format subscriber triggerTime to standard 12-hour display e.g. "06:00 AM", "11:00 PM"
      const formatSubscriberTimeChoice = (timeStr: string | undefined): string => {
        if (!timeStr || timeStr.trim().toLowerCase() === 'none') return 'Off / None';
        const clean = timeStr.trim();
        const m12 = clean.match(/^(\d{1,2})[:.](\d{2})(?::|\s+)?(AM|PM)?$/i);
        if (m12) {
          let h = parseInt(m12[1], 10);
          const m = m12[2];
          const ap = m12[3] ? m12[3].toUpperCase() : null;
          if (ap) {
            return `${String(h).padStart(2, '0')}:${m} ${ap}`;
          } else {
            const period = h >= 12 ? 'PM' : 'AM';
            let h12 = h % 12;
            if (h12 === 0) h12 = 12;
            return `${String(h12).padStart(2, '0')}:${m} ${period}`;
          }
        }
        return clean;
      };

      // Helper to sort reminder times chronologically
      const timeChoiceToMinutes = (label: string): number => {
        if (label.includes('Off') || label.includes('None')) return 99999;
        const match = label.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
        if (!match) return 99998;
        let h = parseInt(match[1], 10);
        const m = parseInt(match[2], 10);
        const ap = match[3].toUpperCase();
        if (ap === 'PM' && h < 12) h += 12;
        if (ap === 'AM' && h === 12) h = 0;
        return h * 60 + m;
      };

      // Daily delivery window solely based on actual subscriber choice (no hardcoded metrics)
      const rawReminders: Record<string, number> = {};

      for (const u of users) {
        // Languages
        if (u.language === 'tamil') tamilCount++;
        else if (u.language === 'english') englishCount++;
        else bothCount++;

        // Reminder delivery time solely from subscriber choice
        const choice = formatSubscriberTimeChoice(u.triggerTime);
        rawReminders[choice] = (rawReminders[choice] || 0) + 1;
      }

      // Sort chronological by subscriber choice time
      const reminders: Record<string, number> = {};
      const sortedKeys = Object.keys(rawReminders).sort((a, b) => timeChoiceToMinutes(a) - timeChoiceToMinutes(b));
      for (const k of sortedKeys) {
        reminders[k] = rawReminders[k];
      }

      // Calculate activity volumes
      const messageVol = {
        incoming: logs.filter(l => l.type === 'incoming').length,
        outgoing: logs.filter(l => l.type === 'outgoing').length,
        system: logs.filter(l => l.type === 'system').length,
        total: logs.length
      };

      res.json({
        totalUsers: users.length,
        languages: { tamil: tamilCount, english: englishCount, both: bothCount },
        reminders,
        activity: messageVol
      });
    } catch (err) {
      console.error('Error generating admin stats:', err);
      res.status(500).json({ error: 'Failed to compile analytical statistics' });
    }
  });

  // API Route: Broadcast message to all Telegram users
  app.post('/api/broadcast', async (req, res) => {
    const { text } = req.body;
    if (!text || text.trim() === '') {
      return res.status(400).json({ error: 'Broadcast text cannot be empty.' });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const hasToken = token && token !== 'MY_TELEGRAM_BOT_TOKEN' && token.trim() !== '';

    try {
      const users = getAllUsers();
      console.log(`📢 Initiating administrator broadcast to ${users.length} users: "${text}"`);
      addActivityLog(0, 'system', 'system', `📢 ADMIN BROADCAST: "${text}"`, 'info');

      let successCount = 0;
      let failureCount = 0;

      for (const user of users) {
        // If it's a simulated companion user, simulate sending immediately
        if (user.chatId < 10000000) { 
          successCount++;
          addActivityLog(user.chatId, user.username || user.firstName, 'outgoing', `📢 BROADCAST: ${text}`);
          continue;
        }

        // If real Telegram bot token is configured, send the real API message!
        if (hasToken) {
          try {
            const url = `https://api.telegram.org/bot${token}/sendMessage`;
            const payload = {
              chat_id: user.chatId,
              text: `📢 <b>ADMIN BROADCAST / அறிவிப்பு</b>\n\n${text}`,
              parse_mode: 'HTML'
            };
            const response = await fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            if (response.ok) {
              successCount++;
              addActivityLog(user.chatId, user.username || user.firstName, 'outgoing', `📢 BROADCAST: ${text}`);
            } else {
              failureCount++;
              console.error(`Failed to send broadcast to ${user.chatId}: ${await response.text()}`);
            }
          } catch (e) {
            failureCount++;
            console.error(`Error broadcasting to real user ${user.chatId}:`, e);
          }
        } else {
          // No token, skip real sending but count as simulation success
          successCount++;
          addActivityLog(user.chatId, user.username || user.firstName, 'outgoing', `📢 BROADCAST (Simulated): ${text}`);
        }
      }

      res.json({ 
        success: true, 
        message: `Broadcast finished! sent to ${successCount} successfully, ${failureCount} failed.`, 
        details: { total: users.length, success: successCount, failed: failureCount } 
      });
    } catch (err) {
      console.error('Error during admin broadcast:', err);
      res.status(500).json({ error: 'Broadcast operation failed.' });
    }
  });

  // API Route: Live Bot Simulation
  app.post('/api/simulate', async (req, res) => {
    if (isBotServiceStopped) {
      return res.status(503).json({ error: 'The Bot Service has been stopped by the system administrator. Start the service to enable simulation.' });
    }

    const { chatId, text, callbackData, firstName, username } = req.body;
    if (!chatId) {
      return res.status(400).json({ error: 'chatId is required.' });
    }

    try {
      if (callbackData) {
        // Handle inline button click simulation
        console.log(`[Simulator] Callback query from ${chatId}: "${callbackData}"`);
        const response = await handleBotCallback(chatId, callbackData);
        res.json({ response });
      } else {
        // Handle text message simulation
        console.log(`[Simulator] Text message from ${chatId}: "${text}"`);
        const response = await handleBotMessage(chatId, text || '', username, firstName);
        res.json({ response });
      }
    } catch (err) {
      console.error('Error in simulation route:', err);
      res.status(500).json({ error: 'Simulation engine encountered an error.' });
    }
  });

  // Initialize Real Telegram Bot if Token is provided
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const hasToken = TOKEN && TOKEN !== 'MY_TELEGRAM_BOT_TOKEN' && TOKEN.trim() !== '';

  // Start the daily reminder scheduler unconditionally
  startReminderScheduler(hasToken ? TOKEN : undefined);

  if (hasToken) {
    try {
      console.log("🤖 Real Telegram Bot Token detected! Initializing long poller...");
      startRealTelegramBot(TOKEN!);
    } catch (e) {
      console.error("❌ Failed to start real Telegram bot poller:", e);
    }
  } else {
    console.log("⚠️ TELEGRAM_BOT_TOKEN environment variable not set or contains default placeholder.");
    console.log("🖥️ Web Companion Simulator is active and runs on the exact same server-side bot engine!");
    console.log("👉 Set TELEGRAM_BOT_TOKEN in the secrets tab to enable the actual Telegram bot.");
  }

  // Standalone Flask / Web UI for Custom Time Picker
  app.get(['/time-picker', '/flask-ui/time-picker', '/flask-ui/time'], (req, res) => {
    const chatId = (req.query.chatId as string) || '';
    const time = (req.query.time as string) || '07:00:AM';
    const html = renderFlaskTimePickerHtml(chatId, time);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Ensure iframe embedding works across preview and modals
    res.removeHeader('X-Frame-Options');
    res.setHeader('Content-Security-Policy', "frame-ancestors *");
    res.send(html);
  });

  // Vite middleware for dev mode, static folder for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log("⚡ Vite development middleware mounted.");
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log("📦 Production static assets folder serving mounted.");
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`==================================================`);
    console.log(`🚀 App Server running at http://0.0.0.0:${PORT}`);
    console.log(`==================================================`);
  });
}

startServer();
