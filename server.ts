import 'dotenv/config';
import express from 'express';
import * as path from 'path';
import { createServer as createViteServer } from 'vite';
import { 
  getAllUsers, 
  getUser, 
  saveUser, 
  saveUserAsync,
  deleteUser, 
  deleteUserAsync,
  getActivityLogs, 
  clearActivityLogs, 
  addActivityLog,
  verifyAdminLogin,
  changeAdminPassword,
  getDbHealthStatus,
  initDatabase,
  getSchedulerTelemetry,
  getSystemGatewayConfig,
  saveSystemGatewayConfig
} from './src/server/db';
import { 
  handleBotMessage, 
  handleBotCallback, 
  startRealTelegramBot, 
  reconnectTelegramBot,
  getTelegramBotState,
  startReminderScheduler,
  processScheduledRemindersTick,
  opportunisticReminderCheck,
  isBotServiceStopped,
  stopBotService,
  startBotService,
  handleTelegramUpdate,
  setAppUrl,
  validateSchedulerAuth
} from './src/server/bot';
import { renderFlaskTimePickerHtml } from './src/server/flaskTimePickerUi';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Trust proxy for correct protocol & forwarded headers behind nginx/Cloud Run
  app.set('trust proxy', 1);

  // Support JSON bodies for API calls
  app.use(express.json());

  // CORS and iframe embedding headers for all environments
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    // Prevent stale caching of API responses
    if (req.path.startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
    next();
  });

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
  app.post('/api/users/update', async (req, res) => {
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

      const user = await saveUserAsync(chatId, updatePayload);
      res.json(user);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update user.' });
    }
  });

  // API Route: Delete / Reset a user from companion dashboard
  app.post('/api/users/delete/:chatId', async (req, res) => {
    const chatId = parseInt(req.params.chatId, 10);
    if (isNaN(chatId)) {
      return res.status(400).json({ error: 'Invalid chatId.' });
    }
    try {
      const success = await deleteUserAsync(chatId);
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

      // Validate Telegram secret token if configured
      const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
      if (expectedSecret && expectedSecret.trim() !== '') {
        const receivedSecret = req.headers['x-telegram-bot-api-secret-token'];
        if (receivedSecret !== expectedSecret) {
          console.warn("⚠️ Rejected telegram webhook update: X-Telegram-Bot-Api-Secret-Token mismatch.");
          return res.status(403).json({ error: 'Forbidden: Invalid secret token' });
        }
      }
      
      // Send 200 OK immediately and process update asynchronously to avoid Telegram timeouts
      res.sendStatus(200);

      handleTelegramUpdate(token, req.body).catch(err => {
        console.error('Error handling Telegram webhook update:', err);
      });

      // Opportunistically check if any reminder is due while the instance is awake
      opportunisticReminderCheck(token).catch(() => {});
    } catch (err) {
      console.error('Error in telegram-webhook endpoint:', err);
      res.sendStatus(500);
    }
  });

  // Helper to validate scheduler secret if configured
  const checkSchedulerRequestAuth = (req: express.Request): boolean => {
    const querySecret = typeof req.query.secret === 'string' ? req.query.secret : undefined;
    const bodySecret = req.body && typeof req.body.secret === 'string' ? req.body.secret : undefined;
    return validateSchedulerAuth(req.headers, querySecret || bodySecret);
  };

  // API Route: Daily Initialization Endpoint (Lightweight, idempotent daily wake-up)
  app.all(['/api/scheduler/daily-init', '/api/scheduler/init'], async (req, res) => {
    try {
      if (!checkSchedulerRequestAuth(req)) {
        console.warn("⚠️ Unauthorized attempt to call scheduler daily-init: Secret mismatch.");
        return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or missing X-Scheduler-Secret' });
      }

      const token = process.env.TELEGRAM_BOT_TOKEN;
      const result = await processScheduledRemindersTick(token, undefined, 'daily_init');
      res.json({
        success: true,
        message: 'Daily scheduler initialized successfully',
        timeString: result.timeString,
        dateString: result.dateString,
        uptimeSeconds: Math.floor(process.uptime()),
        evaluatedCount: result.evaluatedCount,
        dueCount: result.dueCount,
        deliveredCount: result.deliveredCount,
        skippedCount: result.skippedCount
      });
    } catch (err: any) {
      console.error("Error executing daily-init:", err);
      res.status(500).json({ success: false, error: err?.message || 'Daily-init execution failed' });
    }
  });

  // API Route: Scheduler Tick Endpoint (Supports GET & POST for external cron/pingers)
  app.all('/api/scheduler/tick', async (req, res) => {
    try {
      if (!checkSchedulerRequestAuth(req)) {
        console.warn("⚠️ Unauthorized attempt to trigger scheduler tick: Secret mismatch.");
        return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or missing X-Scheduler-Secret' });
      }

      const token = process.env.TELEGRAM_BOT_TOKEN;
      const customTime = (req.query.time as string) || (req.body && req.body.time as string) || undefined;
      const source = (req.headers['user-agent']?.includes('Google-Cloud-Scheduler') ? 'cloud_scheduler' : 'external_trigger') as string;

      const result = await processScheduledRemindersTick(token, customTime, source);
      console.log(`⏱️ Scheduler tick: current IST time = ${result.timeString}, evaluated = ${result.evaluatedCount}, normal matches = ${result.normalMatchesCount}, catch-up matches = ${result.catchUpMatchesCount}, claimed = ${result.claimedCount}, delivered = ${result.deliveredCount}, skipped = ${result.skippedCount}`);
      
      // Concise, sanitized JSON response avoiding any credential or subscriber data leakage
      res.json({
        success: true,
        timeString: result.timeString,
        dateString: result.dateString,
        source: result.source,
        evaluatedCount: result.evaluatedCount,
        processedCount: result.evaluatedCount,
        dueCount: result.dueCount,
        normalMatchesCount: result.normalMatchesCount,
        catchUpMatchesCount: result.catchUpMatchesCount,
        claimedCount: result.claimedCount,
        deliveredCount: result.deliveredCount,
        failedCount: result.failedCount,
        skippedCount: result.skippedCount
      });
    } catch (err: any) {
      console.error("Error executing scheduler tick:", err);
      res.status(500).json({ success: false, error: err?.message || 'Scheduler tick execution failed' });
    }
  });

  // API Route: Scheduler Status Telemetry
  app.get('/api/scheduler/status', (req, res) => {
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const baseUrl = process.env.PUBLIC_APP_URL || `${protocol}://${host}`;
    const endpointUrl = `${baseUrl.replace(/\/$/, '')}/api/scheduler/tick`;
    const isSecretConfigured = !!(process.env.SCHEDULER_SECRET && process.env.SCHEDULER_SECRET.trim() !== '');

    const telemetry = getSchedulerTelemetry(endpointUrl, isSecretConfigured);
    res.json(telemetry);
  });

  // API Route: Get Webhook Info & Connection Diagnostics
  app.get('/api/webhook-status', async (req, res) => {
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const baseUrl = process.env.PUBLIC_APP_URL || `${protocol}://${host}`;
    const schedulerEndpointUrl = `${baseUrl.replace(/\/$/, '')}/api/scheduler/tick`;
    const isSecretConfigured = !!(process.env.SCHEDULER_SECRET && process.env.SCHEDULER_SECRET.trim() !== '');
    const isWebhookSecretConfigured = !!(process.env.TELEGRAM_WEBHOOK_SECRET && process.env.TELEGRAM_WEBHOOK_SECRET.trim() !== '');

    const schedulerStatus = getSchedulerTelemetry(schedulerEndpointUrl, isSecretConfigured);

    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token || token === 'MY_TELEGRAM_BOT_TOKEN') {
        return res.json({ 
          hasToken: false, 
          webhookActive: false, 
          url: '',
          pendingUpdateCount: 0,
          botState: getTelegramBotState(),
          dbHealth: getDbHealthStatus(),
          schedulerStatus,
          isWebhookSecretConfigured,
          productionServiceUrl: process.env.PUBLIC_APP_URL || undefined
        });
      }

      let data: any = { ok: false };
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, {
          signal: AbortSignal.timeout(8000)
        });
        data = await response.json();
      } catch (fetchErr: any) {
        console.warn("Could not reach Telegram getWebhookInfo:", fetchErr?.message || fetchErr);
      }

      const botState = getTelegramBotState();
      const dbHealth = getDbHealthStatus();
      
      res.json({
        hasToken: true,
        webhookActive: data.ok && !!data.result?.url,
        url: data.ok && data.result?.url ? data.result.url : '',
        pendingUpdateCount: data.ok && data.result?.pending_update_count ? data.result.pending_update_count : 0,
        lastErrorDate: data.ok ? data.result?.last_error_date : null,
        lastErrorMessage: data.ok ? (data.result?.last_error_message || '') : '',
        botState,
        dbHealth,
        schedulerStatus,
        isWebhookSecretConfigured,
        productionServiceUrl: process.env.PUBLIC_APP_URL || (data.ok && data.result?.url ? data.result.url : undefined)
      });
    } catch (err) {
      console.error('Error getting webhook info:', err);
      res.json({ 
        hasToken: true, 
        webhookActive: false, 
        url: '', 
        pendingUpdateCount: 0,
        botState: getTelegramBotState(),
        dbHealth: getDbHealthStatus(),
        schedulerStatus,
        isWebhookSecretConfigured,
        productionServiceUrl: process.env.PUBLIC_APP_URL || undefined,
        lastErrorMessage: 'Transient network delay querying Telegram API'
      });
    }
  });

  // API Route: Bot Diagnostics & Database Health
  app.get('/api/bot/diagnostics', async (req, res) => {
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      const hasToken = !!(token && token !== 'MY_TELEGRAM_BOT_TOKEN' && token.trim() !== '');
      const botState = getTelegramBotState();
      const dbHealth = getDbHealthStatus();

      res.json({
        hasToken,
        botState,
        dbHealth,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: Date.now()
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Failed to gather diagnostics.' });
    }
  });

  // API Route: Reconnect Telegram Bot on demand
  app.post('/api/bot/reconnect', async (req, res) => {
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token || token === 'MY_TELEGRAM_BOT_TOKEN') {
        return res.status(400).json({ success: false, message: 'TELEGRAM_BOT_TOKEN is not configured in secrets.' });
      }

      const result = await reconnectTelegramBot(token);
      res.json(result);
    } catch (err: any) {
      console.error("Error during manual bot reconnection:", err);
      res.status(500).json({ success: false, message: err?.message || 'Reconnection attempt failed.' });
    }
  });

  // API Route: Set Webhook (Explicit Administrative Operation)
  app.post('/api/webhook-setup', async (req, res) => {
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token || token === 'MY_TELEGRAM_BOT_TOKEN') {
        return res.status(400).json({ error: 'Telegram Token is missing or placeholder.' });
      }

      // Determine webhook URL. If none is supplied, we construct it from host header
      let webhookUrl = req.body.url || process.env.PUBLIC_APP_URL || process.env.TELEGRAM_WEBHOOK_URL;
      if (!webhookUrl) {
        const host = req.headers['x-forwarded-host'] || req.get('host');
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        webhookUrl = `${protocol}://${host}`;
      }

      // Append standard path
      if (!webhookUrl.endsWith('/api/telegram-webhook')) {
        webhookUrl = `${webhookUrl.replace(/\/$/, '')}/api/telegram-webhook`;
      }

      const secretToken = req.body.secretToken || process.env.TELEGRAM_WEBHOOK_SECRET;

      console.log(`🔗 Registering Telegram Webhook with URL: ${webhookUrl}`);
      const setBody: any = {
        url: webhookUrl,
        drop_pending_updates: false
      };
      if (secretToken) {
        setBody.secret_token = secretToken;
      }

      const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setBody),
        signal: AbortSignal.timeout(15000)
      });
      const data: any = await response.json();

      if (data.ok) {
        await saveSystemGatewayConfig(webhookUrl, secretToken);
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

  // API Route: Delete Webhook (Explicit Administrative Operation)
  app.post('/api/webhook-delete', async (req, res) => {
    try {
      const token = process.env.TELEGRAM_BOT_TOKEN;
      if (!token || token === 'MY_TELEGRAM_BOT_TOKEN') {
        return res.status(400).json({ error: 'Telegram Token is missing.' });
      }

      const response = await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`);
      const data: any = await response.json();

      if (data.ok) {
        await saveSystemGatewayConfig(undefined, undefined);
        addActivityLog(0, 'system', 'system', `Deleted webhook registration by administrative action`, 'info');
        // Restart the fallback polling bot loop since the webhook was intentionally removed
        startRealTelegramBot(token);
        res.json({ success: true, message: 'Webhook removed. Local fallback polling mode restored.' });
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
        const response = await handleBotCallback(chatId, callbackData, username, firstName);
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

  // Initialize Cloud Firestore Database (Authoritative Source of Truth)
  try {
    await initDatabase();
  } catch (dbInitErr) {
    console.error("Critical error during database initialization:", dbInitErr);
  }

  // Initialize Real Telegram Bot if Token is provided
  const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  const hasToken = TOKEN && TOKEN !== 'MY_TELEGRAM_BOT_TOKEN' && TOKEN.trim() !== '';

  // Start the daily reminder scheduler unconditionally with Firestore subscribers
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

  // API catch-all: protect unmatched API endpoints from falling through to the SPA index.html
  app.all('/api/*', (req, res) => {
    res.status(404).json({
      success: false,
      error: `API route not found: ${req.method} ${req.path}`
    });
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
