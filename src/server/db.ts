import * as fs from 'fs';
import * as path from 'path';
import { initializeApp, FirebaseApp } from 'firebase/app';
import {
  getFirestore,
  Firestore,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  collection,
  query,
  orderBy,
  limit,
  runTransaction
} from 'firebase/firestore';
import { ReminderDeliveryRecord, SchedulerStatus } from '../types';

export interface BotUser {
  chatId: number;
  username?: string;
  firstName?: string;
  language: 'tamil' | 'english' | 'both';
  triggerTime: string; // '06:00:AM', '08:45:AM', 'none'
  lastActive: number;
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

export interface AdminCredentials {
  username: string;
  password: string;
  updatedAt: number;
}

const DB_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'bot_users.json');
const BACKUP_FILE = path.join(DB_DIR, 'bot_users.backup.json');
const LOGS_FILE = path.join(DB_DIR, 'bot_logs.json');
const ADMIN_FILE = path.join(DB_DIR, 'admin_auth.json');

// Ensure DB directory exists
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// In-memory runtime caches
let usersCache: Record<number, BotUser> = {};
let logsCache: ActivityLog[] = [];
let isDbLoaded = false;
let lastDbSaveTime = 0;
let lastSuccessfulDbOpTime = 0;
let lastDbError: string | null = null;
let isFirestoreConnected = false;

// Firebase instance
let firebaseApp: FirebaseApp | null = null;
let firestoreDb: Firestore | null = null;
let firebaseConfig: any = null;

// Read config if available
try {
  const cfgPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(cfgPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
  }
} catch (e) {
  console.warn("Could not read firebase-applet-config.json:", e);
}

// Safe backup writer for local fallback
function saveBackupToDisk() {
  try {
    fs.writeFileSync(BACKUP_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');
    fs.writeFileSync(DB_FILE, JSON.stringify(usersCache, null, 2), 'utf-8');
    lastDbSaveTime = Date.now();
  } catch (err) {
    console.warn("Could not write local backup snapshot:", err);
  }
}

// Helper to normalize raw JSON subscriber records
function parseAndIngestUsers(parsedData: any): Record<number, BotUser> {
  const result: Record<number, BotUser> = {};
  if (!parsedData) return result;

  if (Array.isArray(parsedData)) {
    for (const item of parsedData) {
      if (!item) continue;
      const cid = Number(item.chatId);
      if (!isNaN(cid) && cid > 0) {
        result[cid] = {
          chatId: cid,
          username: item.username || undefined,
          firstName: item.firstName || undefined,
          language: item.language === 'tamil' || item.language === 'english' ? item.language : 'both',
          triggerTime: item.triggerTime || '06:00:AM',
          lastActive: typeof item.lastActive === 'number' ? item.lastActive : Date.now()
        };
      }
    }
  } else if (typeof parsedData === 'object') {
    for (const key of Object.keys(parsedData)) {
      const u = parsedData[key];
      if (!u) continue;
      const cid = Number(u.chatId || key);
      if (!isNaN(cid) && cid > 0) {
        result[cid] = {
          chatId: cid,
          username: u.username || undefined,
          firstName: u.firstName || undefined,
          language: u.language === 'tamil' || u.language === 'english' ? u.language : 'both',
          triggerTime: u.triggerTime || '06:00:AM',
          lastActive: typeof u.lastActive === 'number' ? u.lastActive : Date.now()
        };
      }
    }
  }
  return result;
}

/**
 * Initialize Cloud Firestore as authoritative persistence source.
 * Follows backward-safe startup:
 * 1. Connects to Firestore.
 * 2. Verifies availability.
 * 3. Ingests all subscribers into usersCache.
 * 4. If Firestore has 0 subscribers but local JSON has valid data, performs an idempotent migration.
 * 5. Ingests recent activity logs.
 * 6. If Firestore is temporarily unreachable, preserves memory state and fallback snapshot WITHOUT destroying data.
 */
export async function initDatabase(): Promise<void> {
  console.log("📡 Initializing Database persistence layer...");

  // Load initial fallback from disk to ensure usersCache is never unexpectedly blank
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      if (data.trim().length > 0) {
        usersCache = parseAndIngestUsers(JSON.parse(data));
      }
    } else if (fs.existsSync(BACKUP_FILE)) {
      const data = fs.readFileSync(BACKUP_FILE, 'utf-8');
      if (data.trim().length > 0) {
        usersCache = parseAndIngestUsers(JSON.parse(data));
      }
    }
  } catch (err) {
    console.warn("Notice: Initial disk read notice:", err);
  }

  // Load fallback logs from disk
  try {
    if (fs.existsSync(LOGS_FILE)) {
      const data = fs.readFileSync(LOGS_FILE, 'utf-8');
      logsCache = JSON.parse(data);
    }
  } catch (err) {
    console.warn("Notice: Initial disk logs read notice:", err);
  }

  // If no Firebase config exists, keep local fallback
  if (!firebaseConfig || !firebaseConfig.projectId) {
    console.warn("⚠️ No Firebase config available. Running with local disk persistence.");
    isDbLoaded = true;
    return;
  }

  try {
    if (!firebaseApp) {
      firebaseApp = initializeApp({
        projectId: firebaseConfig.projectId,
        apiKey: firebaseConfig.apiKey,
        appId: firebaseConfig.appId
      });
    }

    firestoreDb = getFirestore(firebaseApp, firebaseConfig.firestoreDatabaseId);

    // 1. Query Firestore users collection (authoritative source of truth)
    console.log(`📡 Connecting to Firestore collection: users (db: ${firebaseConfig.firestoreDatabaseId})...`);
    const usersCollection = collection(firestoreDb, 'users');
    const usersSnapshot = await getDocs(usersCollection);

    if (usersSnapshot.size > 0) {
      const firestoreUsers: Record<number, BotUser> = {};
      usersSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const cid = Number(data.chatId || docSnap.id);
        if (!isNaN(cid) && cid > 0) {
          firestoreUsers[cid] = {
            chatId: cid,
            username: data.username || undefined,
            firstName: data.firstName || undefined,
            language: data.language === 'tamil' || data.language === 'english' ? data.language : 'both',
            triggerTime: data.triggerTime || '06:00:AM',
            lastActive: typeof data.lastActive === 'number' ? data.lastActive : Date.now()
          };
        }
      });

      // Replace runtime usersCache with authoritative Firestore records
      usersCache = firestoreUsers;
      isFirestoreConnected = true;
      lastSuccessfulDbOpTime = Date.now();
      lastDbError = null;
      console.log(`✅ Loaded ${Object.keys(usersCache).length} subscribers successfully from Cloud Firestore.`);
      saveBackupToDisk();
    } else {
      console.log("ℹ️ Firestore users collection is currently empty.");
      // If local JSON has existing users, migrate them up immediately
      if (Object.keys(usersCache).length > 0) {
        console.log(`🚀 Performing one-time migration of ${Object.keys(usersCache).length} subscribers into Firestore...`);
        for (const [cidStr, u] of Object.entries(usersCache)) {
          const cid = Number(cidStr);
          await setDoc(doc(firestoreDb, 'users', String(cid)), {
            chatId: cid,
            username: u.username || null,
            firstName: u.firstName || null,
            language: u.language || 'both',
            triggerTime: u.triggerTime || '06:00:AM',
            lastActive: u.lastActive || Date.now()
          }, { merge: true });
        }
        console.log("✅ Automatic subscriber migration to Firestore complete.");
      }
      isFirestoreConnected = true;
      lastSuccessfulDbOpTime = Date.now();
      lastDbError = null;
    }

    // 2. Load recent activity logs from Firestore
    try {
      const logsCollection = collection(firestoreDb, 'activity_logs');
      const logsQuery = query(logsCollection, orderBy('timestamp', 'desc'), limit(100));
      const logsSnapshot = await getDocs(logsQuery);

      if (logsSnapshot.size > 0) {
        const remoteLogs: ActivityLog[] = [];
        logsSnapshot.forEach(docSnap => {
          const d = docSnap.data();
          remoteLogs.push({
            id: d.id || docSnap.id,
            timestamp: d.timestamp || Date.now(),
            chatId: d.chatId || 0,
            username: d.username || undefined,
            type: d.type || 'system',
            text: d.text || '',
            status: d.status || 'info'
          });
        });
        logsCache = remoteLogs;
        console.log(`✅ Loaded ${logsCache.length} activity logs from Cloud Firestore.`);
      }
    } catch (logErr: any) {
      console.warn("Could not query activity_logs from Firestore:", logErr?.message);
    }

    isDbLoaded = true;
  } catch (err: any) {
    isFirestoreConnected = false;
    lastDbError = err?.message || 'Firestore connection failed';
    console.error("❌ Firestore connection failed during initDatabase:", err);
    console.warn("🛡️ Preserving local subscriber cache. Cloud Run restart will not erase cached state.");
    isDbLoaded = true; // Still allow app to boot with preserved memory cache
  }
}

// --- PUBLIC SUBSCRIBER REPOSITORIES ---

export function getAllUsers(): BotUser[] {
  return Object.values(usersCache).map(u => ({
    ...u,
    language: u.language || 'both',
    triggerTime: u.triggerTime || '06:00:AM'
  }));
}

export function getUser(chatId: number, defaults?: Partial<BotUser>): BotUser {
  const idNum = Number(chatId);
  if (isNaN(idNum) || idNum <= 0) {
    return {
      chatId: 0,
      language: 'both',
      triggerTime: '06:00:AM',
      lastActive: Date.now()
    };
  }

  if (!usersCache[idNum]) {
    usersCache[idNum] = {
      chatId: idNum,
      username: defaults?.username || undefined,
      firstName: defaults?.firstName || undefined,
      language: defaults?.language || 'both',
      triggerTime: defaults?.triggerTime || '06:00:AM',
      lastActive: Date.now()
    };
    // Persist newly registered subscriber
    saveUser(idNum, usersCache[idNum]);
  } else {
    let shouldSave = false;
    const user = usersCache[idNum];
    if (defaults?.username && user.username !== defaults.username) {
      user.username = defaults.username;
      shouldSave = true;
    }
    if (defaults?.firstName && user.firstName !== defaults.firstName) {
      user.firstName = defaults.firstName;
      shouldSave = true;
    }
    user.lastActive = Date.now();
    if (shouldSave) {
      saveUser(idNum, user);
    }
  }

  const user = usersCache[idNum];
  if (!user.language) user.language = 'both';
  if (!user.triggerTime) user.triggerTime = '06:00:AM';
  return user;
}

export function saveUser(chatId: number, fields: Partial<BotUser>): BotUser {
  const idNum = Number(chatId);
  if (isNaN(idNum) || idNum <= 0) {
    return {
      chatId: 0,
      language: 'both',
      triggerTime: '06:00:AM',
      lastActive: Date.now()
    };
  }

  const existing = usersCache[idNum] || {
    chatId: idNum,
    username: fields.username,
    firstName: fields.firstName,
    language: fields.language || 'both',
    triggerTime: fields.triggerTime || '06:00:AM',
    lastActive: Date.now()
  };

  const updatedLanguage = fields.language !== undefined ? fields.language : (existing.language || 'both');
  const rawTriggerTime = fields.triggerTime !== undefined ? fields.triggerTime : (existing.triggerTime || '06:00 AM');
  const updatedTriggerTime = normalizeRecurringTriggerTime(rawTriggerTime);

  const updatedUser: BotUser = {
    chatId: idNum,
    username: fields.username !== undefined ? fields.username : existing.username,
    firstName: fields.firstName !== undefined ? fields.firstName : existing.firstName,
    language: updatedLanguage === 'tamil' || updatedLanguage === 'english' ? updatedLanguage : 'both',
    triggerTime: updatedTriggerTime,
    lastActive: Date.now()
  };

  // 1. Update in-memory runtime cache immediately
  usersCache[idNum] = updatedUser;
  lastDbSaveTime = Date.now();

  // 2. Asynchronously persist to Cloud Firestore (Source of Truth)
  if (firestoreDb) {
    const docData: any = {
      chatId: updatedUser.chatId,
      language: updatedUser.language,
      triggerTime: updatedUser.triggerTime,
      lastActive: updatedUser.lastActive
    };
    if (updatedUser.username) docData.username = updatedUser.username;
    if (updatedUser.firstName) docData.firstName = updatedUser.firstName;

    setDoc(doc(firestoreDb, 'users', String(idNum)), docData, { merge: true })
      .then(() => {
        lastSuccessfulDbOpTime = Date.now();
        lastDbError = null;
        isFirestoreConnected = true;
      })
      .catch((err) => {
        console.error(`❌ Firestore write error for user ${idNum}:`, err);
        lastDbError = `Firestore write error: ${err.message}`;
      });
  }

  // 3. Keep local backup snapshot file updated
  saveBackupToDisk();

  return updatedUser;
}

export async function saveUserAsync(chatId: number, fields: Partial<BotUser>): Promise<BotUser> {
  const user = saveUser(chatId, fields);
  if (firestoreDb) {
    const docData: any = {
      chatId: user.chatId,
      language: user.language,
      triggerTime: user.triggerTime,
      lastActive: user.lastActive
    };
    if (user.username) docData.username = user.username;
    if (user.firstName) docData.firstName = user.firstName;
    await setDoc(doc(firestoreDb, 'users', String(user.chatId)), docData, { merge: true });
    lastSuccessfulDbOpTime = Date.now();
  }
  return user;
}

export function deleteUser(chatId: number): boolean {
  const idNum = Number(chatId);
  if (usersCache[idNum]) {
    delete usersCache[idNum];
    lastDbSaveTime = Date.now();

    if (firestoreDb) {
      deleteDoc(doc(firestoreDb, 'users', String(idNum)))
        .then(() => {
          lastSuccessfulDbOpTime = Date.now();
          lastDbError = null;
        })
        .catch((err) => {
          console.error(`❌ Firestore delete error for user ${idNum}:`, err);
          lastDbError = `Firestore delete error: ${err.message}`;
        });
    }

    saveBackupToDisk();
    return true;
  }
  return false;
}

export async function deleteUserAsync(chatId: number): Promise<boolean> {
  const idNum = Number(chatId);
  const existed = deleteUser(idNum);
  if (firestoreDb && existed) {
    await deleteDoc(doc(firestoreDb, 'users', String(idNum)));
    lastSuccessfulDbOpTime = Date.now();
  }
  return existed;
}

export function getDbHealthStatus() {
  return {
    isLoaded: isDbLoaded,
    provider: 'Cloud Firestore',
    firestoreConnected: isFirestoreConnected,
    databaseId: firebaseConfig?.firestoreDatabaseId || 'default',
    projectId: firebaseConfig?.projectId || '',
    subscriberCount: Object.keys(usersCache).length,
    lastSaved: lastDbSaveTime,
    lastSuccessfulOp: lastSuccessfulDbOpTime,
    recentDbError: lastDbError,
    dbFilePath: DB_FILE,
    hasBackup: fs.existsSync(BACKUP_FILE)
  };
}

// --- ACTIVITY LOGS REPOSITORY ---

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
    chatId: chatId || 0,
    username: username || (chatId === 0 ? 'system' : undefined),
    type,
    text: text.substring(0, 1000), // Prevent unbounded log payload
    status
  };

  logsCache.unshift(newLog); // Newest first

  if (logsCache.length > 150) {
    logsCache = logsCache.slice(0, 150);
  }

  // Persist to Cloud Firestore asynchronously
  if (firestoreDb) {
    const logDocData: any = {
      id: newLog.id,
      timestamp: newLog.timestamp,
      chatId: newLog.chatId,
      type: newLog.type,
      text: newLog.text,
      status: newLog.status
    };
    if (newLog.username) logDocData.username = newLog.username;

    setDoc(doc(firestoreDb, 'activity_logs', newLog.id), logDocData)
      .then(() => {
        lastSuccessfulDbOpTime = Date.now();
      })
      .catch((err) => {
        console.warn("Could not write activity log to Firestore:", err?.message);
      });
  }

  // Backup to disk without blocking
  try {
    fs.writeFile(LOGS_FILE, JSON.stringify(logsCache.slice(0, 100), null, 2), 'utf-8', () => {});
  } catch (err) {}

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

// --- ADMIN CREDENTIALS MANAGEMENT (Preserved Local Auth Secret) ---

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

// --- IDEMPOTENT REMINDER DELIVERY LEDGER ---

// In-memory fallback delivery tracking
const localDeliveriesCache: Record<string, ReminderDeliveryRecord> = {};

const SERVER_BOOT_TIMESTAMP = Date.now();
let schedulerInitializedTimestamp = 0;
let lastHeartbeatTimestamp = 0;
let isSchedulerActive = false;

let schedulerTelemetry = {
  lastTickTimestamp: 0,
  lastTickTimeString: '',
  lastDeliveryTimestamp: 0,
  todayDeliveriesCount: 0,
  todayAttemptedCount: 0,
  lastError: null as string | null,
  lastEvaluatedCount: 0,
  lastNormalMatchesCount: 0,
  lastCatchUpMatchesCount: 0,
  lastClaimedCount: 0,
  lastSkippedCount: 0,
  lastSource: 'none'
};

export function setSchedulerLifecycleState(initializedAt: number, active: boolean, heartbeatAt?: number) {
  schedulerInitializedTimestamp = initializedAt;
  isSchedulerActive = active;
  if (heartbeatAt) {
    lastHeartbeatTimestamp = heartbeatAt;
  }
}

export function recordSchedulerHeartbeat(source?: string) {
  lastHeartbeatTimestamp = Date.now();
  if (source) {
    schedulerTelemetry.lastSource = source;
  }
}

export function recordSchedulerTick(
  timeString: string,
  error?: string | null,
  stats?: {
    evaluatedCount?: number;
    normalMatchesCount?: number;
    catchUpMatchesCount?: number;
    claimedCount?: number;
    skippedCount?: number;
    source?: string;
  }
) {
  const now = Date.now();
  schedulerTelemetry.lastTickTimestamp = now;
  lastHeartbeatTimestamp = now;
  schedulerTelemetry.lastTickTimeString = timeString;
  schedulerTelemetry.todayAttemptedCount++;
  if (error !== undefined) {
    schedulerTelemetry.lastError = error;
  }
  if (stats) {
    if (stats.evaluatedCount !== undefined) schedulerTelemetry.lastEvaluatedCount = stats.evaluatedCount;
    if (stats.normalMatchesCount !== undefined) schedulerTelemetry.lastNormalMatchesCount = stats.normalMatchesCount;
    if (stats.catchUpMatchesCount !== undefined) schedulerTelemetry.lastCatchUpMatchesCount = stats.catchUpMatchesCount;
    if (stats.claimedCount !== undefined) schedulerTelemetry.lastClaimedCount = stats.claimedCount;
    if (stats.skippedCount !== undefined) schedulerTelemetry.lastSkippedCount = stats.skippedCount;
    if (stats.source) schedulerTelemetry.lastSource = stats.source;
  }
}

export function getSchedulerTelemetry(endpointUrl: string, isSecretConfigured: boolean): SchedulerStatus {
  return {
    lastTickTimestamp: schedulerTelemetry.lastTickTimestamp,
    lastTickTimeString: schedulerTelemetry.lastTickTimeString,
    lastDeliveryTimestamp: schedulerTelemetry.lastDeliveryTimestamp,
    todayDeliveriesCount: schedulerTelemetry.todayDeliveriesCount,
    todayAttemptedCount: schedulerTelemetry.todayAttemptedCount,
    lastError: schedulerTelemetry.lastError,
    schedulerEndpoint: endpointUrl,
    isSecretConfigured,
    lastSource: schedulerTelemetry.lastSource,
    lastEvaluatedCount: schedulerTelemetry.lastEvaluatedCount,
    lastNormalMatchesCount: schedulerTelemetry.lastNormalMatchesCount,
    lastCatchUpMatchesCount: schedulerTelemetry.lastCatchUpMatchesCount,
    lastClaimedCount: schedulerTelemetry.lastClaimedCount,
    lastSkippedCount: schedulerTelemetry.lastSkippedCount,
    serverBootTimestamp: SERVER_BOOT_TIMESTAMP,
    processUptimeSeconds: Math.floor(process.uptime()),
    lastHeartbeatTimestamp,
    schedulerInitializedTimestamp,
    isSchedulerActive
  };
}

/**
 * Checks if a reminder was already delivered today for a given user.
 */
export async function isReminderDeliveredToday(
  chatId: number,
  dateStr: string,
  triggerTime: string
): Promise<boolean> {
  const deliveryId = getDeliveryKey(dateStr, chatId, triggerTime);
  if (firestoreDb && isFirestoreConnected) {
    try {
      const snap = await getDoc(doc(firestoreDb, 'reminder_deliveries', deliveryId));
      if (snap.exists()) {
        const data = snap.data();
        return data.status === 'DELIVERED';
      }
      return false;
    } catch (e) {
      // Fallback to local cache
    }
  }
  return localDeliveriesCache[deliveryId]?.status === 'DELIVERED';
}

/**
 * Helper to parse HH:MM(:AM/PM) or "HH:MM AM/PM" or "HH:MM" into total minutes since midnight (0..1439).
 */
export function parseTimeMinutes(timeStr: string | undefined): number | null {
  if (!timeStr || timeStr === 'none' || timeStr.trim() === '') return null;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?::|\s+)?(AM|PM)?$/i);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3] ? match[3].toUpperCase() : null;
  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

/**
 * Normalizes recurring user reminder time to standard format (e.g. "07:40 AM", "06:00 AM", or "none").
 * Ensures user reminder schedule contains NO date.
 */
export function normalizeRecurringTriggerTime(timeStr: string | undefined): string {
  if (!timeStr || timeStr.toLowerCase() === 'none' || timeStr.trim() === '') {
    return 'none';
  }
  const clean = timeStr.trim();
  const minutes = parseTimeMinutes(clean);
  if (minutes !== null) {
    let hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const ampm = hours >= 12 ? 'PM' : 'AM';
    let hour12 = hours % 12;
    if (hour12 === 0) hour12 = 12;
    return `${String(hour12).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${ampm}`;
  }
  return clean;
}

export function clearLocalDeliveriesCacheForTesting(): void {
  for (const k of Object.keys(localDeliveriesCache)) {
    delete localDeliveriesCache[k];
  }
}

export function getLocalDeliveriesCacheForTesting(): Record<string, ReminderDeliveryRecord> {
  return localDeliveriesCache;
}

export function clearUsersCacheForTesting(): void {
  for (const k of Object.keys(usersCache)) {
    delete usersCache[k];
  }
}

/**
 * Normalizes a delivery ID key: YYYY-MM-DD_<chatId>_<triggerTime>
 * Example: 2026-09-22_5164666817_07:40
 */
export function getDeliveryKey(dateStr: string, chatId: number, triggerTime: string): string {
  const minutes = parseTimeMinutes(triggerTime);
  let timePart: string;
  if (minutes !== null) {
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
    const mm = String(minutes % 60).padStart(2, '0');
    timePart = `${hh}:${mm}`;
  } else {
    timePart = triggerTime.trim().replace(/[^a-zA-Z0-9:_-]/g, '');
  }
  return `${dateStr}_${chatId}_${timePart}`;
}

/**
 * Atomically claims delivery for a user on a given date and trigger time.
 * If another worker is currently in-flight (< 5 minutes lease) or if already DELIVERED,
 * this returns { claimed: false }.
 */
export async function claimReminderDeliveryAtomic(
  chatId: number,
  dateStr: string,
  triggerTime: string
): Promise<{ claimed: boolean; reason?: string }> {
  const deliveryId = getDeliveryKey(dateStr, chatId, triggerTime);
  const now = Date.now();

  if (firestoreDb && isFirestoreConnected) {
    try {
      const deliveryRef = doc(firestoreDb, 'reminder_deliveries', deliveryId);
      const claimResult = await runTransaction(firestoreDb, async (transaction) => {
        const snap = await transaction.get(deliveryRef);

        if (snap.exists()) {
          const data = snap.data() as ReminderDeliveryRecord;

          // 1. If already confirmed delivered, never re-send
          if (data.status === 'DELIVERED') {
            return { claimed: false, reason: 'Already delivered today' };
          }

          // 2. If claimed, check for lease timeout (5 minutes)
          if (data.status === 'CLAIMED') {
            const ageMs = now - (data.claimedAt || 0);
            if (ageMs < 5 * 60 * 1000) {
              return { claimed: false, reason: 'Delivery currently in-flight by another worker' };
            }
            // Lease expired (worker died/timed out), re-claim
            transaction.update(deliveryRef, {
              status: 'CLAIMED',
              claimedAt: now,
              lastAttemptAt: now,
              attempts: (data.attempts || 1) + 1
            });
            return { claimed: true };
          }

          // 3. If previous attempt failed, allow retry up to 5 attempts
          if (data.status === 'FAILED') {
            if ((data.attempts || 0) >= 5) {
              return { claimed: false, reason: 'Max retry attempts (5) reached for today' };
            }
            transaction.update(deliveryRef, {
              status: 'CLAIMED',
              claimedAt: now,
              lastAttemptAt: now,
              attempts: (data.attempts || 0) + 1
            });
            return { claimed: true };
          }
        }

        // Fresh record
        transaction.set(deliveryRef, {
          id: deliveryId,
          date: dateStr,
          chatId,
          triggerTime,
          status: 'CLAIMED',
          claimedAt: now,
          lastAttemptAt: now,
          attempts: 1
        });
        return { claimed: true };
      });

      lastSuccessfulDbOpTime = Date.now();
      return claimResult;
    } catch (err: any) {
      console.error(`Error in claimReminderDeliveryAtomic for ${deliveryId}:`, err);
      // Fall through to memory fallback if firestore fails
    }
  }

  // In-memory fallback if Firestore is temporarily offline
  const existing = localDeliveriesCache[deliveryId];
  if (existing) {
    if (existing.status === 'DELIVERED') {
      return { claimed: false, reason: 'Already delivered today (local cache)' };
    }
    if (existing.status === 'CLAIMED') {
      if (now - existing.claimedAt < 5 * 60 * 1000) {
        return { claimed: false, reason: 'In-flight (local cache)' };
      }
      existing.status = 'CLAIMED';
      existing.claimedAt = now;
      existing.lastAttemptAt = now;
      existing.attempts += 1;
      return { claimed: true };
    }
    if (existing.status === 'FAILED' && existing.attempts >= 5) {
      return { claimed: false, reason: 'Max retries (local cache)' };
    }
    existing.status = 'CLAIMED';
    existing.claimedAt = now;
    existing.lastAttemptAt = now;
    existing.attempts += 1;
    return { claimed: true };
  }

  localDeliveriesCache[deliveryId] = {
    id: deliveryId,
    date: dateStr,
    chatId,
    triggerTime,
    status: 'CLAIMED',
    claimedAt: now,
    lastAttemptAt: now,
    attempts: 1
  };
  return { claimed: true };
}

/**
 * Marks reminder delivery as successfully delivered after Telegram API confirms receipt.
 */
export async function markReminderDelivered(
  chatId: number,
  dateStr: string,
  triggerTime: string,
  kuralNumber: number,
  telegramMessageId?: number
): Promise<void> {
  const deliveryId = getDeliveryKey(dateStr, chatId, triggerTime);
  const now = Date.now();

  schedulerTelemetry.lastDeliveryTimestamp = now;
  schedulerTelemetry.todayDeliveriesCount++;
  schedulerTelemetry.lastError = null;

  if (localDeliveriesCache[deliveryId]) {
    localDeliveriesCache[deliveryId].status = 'DELIVERED';
    localDeliveriesCache[deliveryId].deliveredAt = now;
    localDeliveriesCache[deliveryId].kuralNumber = kuralNumber;
    localDeliveriesCache[deliveryId].telegramMessageId = telegramMessageId;
    localDeliveriesCache[deliveryId].lastError = null;
  }

  if (firestoreDb && isFirestoreConnected) {
    try {
      const deliveryRef = doc(firestoreDb, 'reminder_deliveries', deliveryId);
      await setDoc(deliveryRef, {
        id: deliveryId,
        date: dateStr,
        chatId,
        triggerTime,
        status: 'DELIVERED',
        deliveredAt: now,
        kuralNumber,
        telegramMessageId: telegramMessageId || null,
        lastError: null
      }, { merge: true });
      lastSuccessfulDbOpTime = Date.now();
    } catch (err) {
      console.error(`Failed to mark reminder DELIVERED in Firestore for ${deliveryId}:`, err);
    }
  }
}

/**
 * Records a Telegram send failure without claiming delivery was successful,
 * allowing safe future retry.
 */
export async function markReminderFailed(
  chatId: number,
  dateStr: string,
  triggerTime: string,
  errorMsg: string
): Promise<void> {
  const deliveryId = getDeliveryKey(dateStr, chatId, triggerTime);
  const now = Date.now();

  schedulerTelemetry.lastError = errorMsg;

  if (localDeliveriesCache[deliveryId]) {
    localDeliveriesCache[deliveryId].status = 'FAILED';
    localDeliveriesCache[deliveryId].lastError = errorMsg;
    localDeliveriesCache[deliveryId].lastAttemptAt = now;
  }

  if (firestoreDb && isFirestoreConnected) {
    try {
      const deliveryRef = doc(firestoreDb, 'reminder_deliveries', deliveryId);
      await setDoc(deliveryRef, {
        id: deliveryId,
        date: dateStr,
        chatId,
        triggerTime,
        status: 'FAILED',
        lastError: errorMsg,
        failedAt: now
      }, { merge: true });
      lastSuccessfulDbOpTime = Date.now();
    } catch (err) {
      console.error(`Failed to mark reminder FAILED in Firestore for ${deliveryId}:`, err);
    }
  }
}

/**
 * System Gateway configuration in Firestore
 */
export async function saveSystemGatewayConfig(webhookUrl?: string, secretToken?: string): Promise<void> {
  if (firestoreDb && isFirestoreConnected) {
    try {
      const cfgRef = doc(firestoreDb, 'system_config', 'gateway');
      await setDoc(cfgRef, {
        webhookUrl: webhookUrl || null,
        secretToken: secretToken || null,
        updatedAt: Date.now()
      }, { merge: true });
      lastSuccessfulDbOpTime = Date.now();
    } catch (err) {
      console.error("Failed to save gateway config to Firestore:", err);
    }
  }
}

export async function getSystemGatewayConfig(): Promise<{ webhookUrl?: string; secretToken?: string }> {
  if (firestoreDb && isFirestoreConnected) {
    try {
      const cfgRef = doc(firestoreDb, 'system_config', 'gateway');
      const snap = await getDoc(cfgRef);
      if (snap.exists()) {
        const d = snap.data();
        return {
          webhookUrl: d.webhookUrl || undefined,
          secretToken: d.secretToken || undefined
        };
      }
    } catch (err) {
      console.warn("Could not load gateway config from Firestore:", err);
    }
  }
  return {};
}

