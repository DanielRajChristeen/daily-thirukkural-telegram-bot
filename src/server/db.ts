import * as fs from 'fs';
import * as path from 'path';

export interface BotUser {
  chatId: number;
  username?: string;
  firstName?: string;
  language: 'tamil' | 'english' | 'both';
  triggerTime: string; // '08:00', '12:00', '18:00', '21:00', 'none'
  lastActive: number;
}

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'bot_users.json');
const LOGS_FILE = path.join(DB_DIR, 'bot_logs.json');
const ADMIN_FILE = path.join(DB_DIR, 'admin_auth.json');

export interface AdminCredentials {
  username: string;
  password: string;
  updatedAt: number;
}

export interface ActivityLog {
  id: string;
  timestamp: number;
  chatId: number;
  username?: string;
  type: 'incoming' | 'outgoing' | 'system';
  text: string;
  status: 'success' | 'error' | 'info';
}

// Ensure DB directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// In-memory caches
let usersCache: Record<number, BotUser> = {};
let logsCache: ActivityLog[] = [];

// Load logs on startup
try {
  if (fs.existsSync(LOGS_FILE)) {
    const data = fs.readFileSync(LOGS_FILE, 'utf-8');
    logsCache = JSON.parse(data);
  } else {
    logsCache = [];
    fs.writeFileSync(LOGS_FILE, JSON.stringify(logsCache, null, 2), 'utf-8');
  }
} catch (e) {
  console.error("Failed to load logs:", e);
}

// Load on startup
try {
  if (fs.existsSync(DB_FILE)) {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    usersCache = {};
    for (const key of Object.keys(parsed)) {
      const numericKey = Number(key);
      if (!isNaN(numericKey)) {
        const u = parsed[key];
        usersCache[numericKey] = {
          ...u,
          chatId: u.chatId || numericKey,
          language: u.language || 'both',
          triggerTime: u.triggerTime || '06:00:AM',
          lastActive: u.lastActive || Date.now()
        };
      }
    }
    console.log(`🗄️ Loaded ${Object.keys(usersCache).length} subscribers successfully from disk.`);
  } else {
    usersCache = {};
    saveToDisk();
  }
} catch (e) {
  console.error("Failed to load bot users DB:", e);
}

function saveToDisk() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');
  } catch (e) {
    console.error("Failed to save bot users DB:", e);
  }
}

export function getAllUsers(): BotUser[] {
  return Object.values(usersCache).map(u => ({
    ...u,
    language: u.language || 'both',
    triggerTime: u.triggerTime || '06:00:AM'
  }));
}

export function getUser(chatId: number, defaults?: Partial<BotUser>): BotUser {
  const idNum = Number(chatId);
  if (!usersCache[idNum]) {
    usersCache[idNum] = {
      chatId: idNum,
      language: defaults?.language || 'both',
      triggerTime: defaults?.triggerTime || '06:00:AM',
      lastActive: Date.now(),
      ...defaults
    };
    saveToDisk();
  }
  const user = usersCache[idNum];
  if (!user.language) user.language = 'both';
  if (!user.triggerTime) user.triggerTime = '06:00:AM';
  return user;
}

export function saveUser(chatId: number, fields: Partial<BotUser>): BotUser {
  const idNum = Number(chatId);
  const user = getUser(idNum);

  // Sanitize fields: do not allow undefined or null to overwrite existing fields
  const cleanFields: Partial<BotUser> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null) {
      (cleanFields as any)[k] = v;
    }
  }

  usersCache[idNum] = {
    ...user,
    ...cleanFields,
    chatId: idNum,
    language: cleanFields.language || user.language || 'both',
    triggerTime: cleanFields.triggerTime || user.triggerTime || '06:00:AM',
    lastActive: Date.now()
  };
  saveToDisk();
  return usersCache[idNum];
}

export function deleteUser(chatId: number): boolean {
  const idNum = Number(chatId);
  if (usersCache[idNum]) {
    delete usersCache[idNum];
    saveToDisk();
    return true;
  }
  return false;
}

export function getActivityLogs(): ActivityLog[] {
  return logsCache;
}

export function addActivityLog(
  chatId: number, 
  username: string | undefined, 
  type: 'incoming' | 'outgoing' | 'system', 
  text: string, 
  status: 'success' | 'error' | 'info' = 'success'
): ActivityLog {
  const newLog: ActivityLog = {
    id: Math.random().toString(36).substring(2, 9),
    timestamp: Date.now(),
    chatId,
    username,
    type,
    text: text.substring(0, 1000), // Prevent massive log strings
    status
  };

  logsCache.unshift(newLog); // Newest first

  // Trim to keep maximum 150 entries
  if (logsCache.length > 150) {
    logsCache = logsCache.slice(0, 150);
  }

  // Save asynchronously to prevent blocking
  try {
    fs.writeFile(LOGS_FILE, JSON.stringify(logsCache, null, 2), 'utf-8', (err) => {
      if (err) console.error("Error writing bot logs to file:", err);
    });
  } catch (err) {
    console.error("Failed to save bot logs:", err);
  }

  return newLog;
}

export function clearActivityLogs(): void {
  logsCache = [];
  try {
    fs.writeFileSync(LOGS_FILE, JSON.stringify([], null, 2), 'utf-8');
  } catch (e) {
    console.error("Failed to clear logs file:", e);
  }
}

// Admin Credentials Management
let adminCache: AdminCredentials | null = null;

export function getAdminCredentials(): AdminCredentials {
  if (adminCache) {
    return adminCache;
  }

  try {
    if (fs.existsSync(ADMIN_FILE)) {
      const data = fs.readFileSync(ADMIN_FILE, 'utf-8');
      adminCache = JSON.parse(data);
      if (adminCache && adminCache.username && adminCache.password) {
        return adminCache;
      }
    }
  } catch (err) {
    console.error("Failed reading admin_auth.json:", err);
  }

  // Default credentials: Admin / Admin
  const defaultAdmin: AdminCredentials = {
    username: 'Admin',
    password: 'Admin',
    updatedAt: Date.now()
  };

  try {
    fs.writeFileSync(ADMIN_FILE, JSON.stringify(defaultAdmin, null, 2), 'utf-8');
  } catch (err) {
    console.error("Failed writing initial admin_auth.json:", err);
  }

  adminCache = defaultAdmin;
  return adminCache;
}

export function verifyAdminLogin(username: string, password: string): boolean {
  const creds = getAdminCredentials();
  if (!username || !password) return false;
  // Match username (case-insensitive for convenience) and exact password
  const usernameMatch = creds.username.trim().toLowerCase() === username.trim().toLowerCase();
  const passwordMatch = creds.password === password;
  return usernameMatch && passwordMatch;
}

export function changeAdminPassword(currentPassword: string, newPassword: string): { success: boolean; error?: string } {
  const creds = getAdminCredentials();
  if (creds.password !== currentPassword) {
    return { success: false, error: 'Current password is incorrect.' };
  }

  if (!newPassword || newPassword.trim().length === 0) {
    return { success: false, error: 'New password cannot be empty.' };
  }

  const updated: AdminCredentials = {
    ...creds,
    password: newPassword,
    updatedAt: Date.now()
  };

  try {
    fs.writeFileSync(ADMIN_FILE, JSON.stringify(updated, null, 2), 'utf-8');
    adminCache = updated;
    return { success: true };
  } catch (err) {
    console.error("Failed to update admin credentials:", err);
    return { success: false, error: 'Server failed to save new password.' };
  }
}


