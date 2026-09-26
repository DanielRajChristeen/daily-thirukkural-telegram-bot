import * as fs from 'fs';
import * as path from 'path';
import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  writeBatch
} from 'firebase/firestore';

interface MigrationReport {
  timestamp: string;
  usersMigrated: number;
  usersSkipped: number;
  logsMigrated: number;
  logsSkipped: number;
  errors: string[];
  verifiedUsersInFirestore: number;
  verifiedLogsInFirestore: number;
  sampleUsers: any[];
}

async function runMigration() {
  console.log('====================================================');
  console.log('🚀 Daily Thirukkural Bot -> Cloud Firestore Migration');
  console.log('====================================================');

  const report: MigrationReport = {
    timestamp: new Date().toISOString(),
    usersMigrated: 0,
    usersSkipped: 0,
    logsMigrated: 0,
    logsSkipped: 0,
    errors: [],
    verifiedUsersInFirestore: 0,
    verifiedLogsInFirestore: 0,
    sampleUsers: []
  };

  // 1. Connect to Firestore using firebase-applet-config.json
  const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('firebase-applet-config.json not found!');
  }
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  console.log(`📡 Connecting to Firebase Project: ${config.projectId}`);
  console.log(`🗄️ Firestore Database ID: ${config.firestoreDatabaseId}`);

  const app = initializeApp({
    projectId: config.projectId,
    apiKey: config.apiKey,
    appId: config.appId
  });

  const db = getFirestore(app, config.firestoreDatabaseId);

  // 2. Read and validate existing bot_users.json
  const usersFilePath = path.join(process.cwd(), 'data', 'bot_users.json');
  if (!fs.existsSync(usersFilePath)) {
    console.warn('⚠️ data/bot_users.json not found. Checking backup...');
  }

  let rawUsersData: any = {};
  if (fs.existsSync(usersFilePath)) {
    try {
      rawUsersData = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
    } catch (e: any) {
      report.errors.push(`Failed to read bot_users.json: ${e.message}`);
    }
  }

  // 3. Upload each valid user to users/{chatId}
  console.log('\n--- Step 1: Migrating Users / Subscribers ---');
  const userEntries = Object.entries(rawUsersData);
  console.log(`Found ${userEntries.length} candidate user entries in local JSON.`);

  for (const [key, rawUser] of userEntries) {
    if (!rawUser || typeof rawUser !== 'object') {
      report.usersSkipped++;
      continue;
    }
    const userObj = rawUser as any;
    const cid = Number(userObj.chatId || key);

    if (isNaN(cid) || cid <= 0) {
      console.warn(`Skipping invalid chatId: ${key}`);
      report.usersSkipped++;
      continue;
    }

    const cleanUser = {
      chatId: cid,
      username: userObj.username || null,
      firstName: userObj.firstName || null,
      language: userObj.language === 'tamil' || userObj.language === 'english' ? userObj.language : 'both',
      triggerTime: userObj.triggerTime || '06:00:AM',
      lastActive: typeof userObj.lastActive === 'number' ? userObj.lastActive : Date.now()
    };

    try {
      const userRef = doc(db, 'users', String(cid));
      await setDoc(userRef, cleanUser, { merge: true });
      report.usersMigrated++;
      report.sampleUsers.push({ chatId: cid, username: cleanUser.username, language: cleanUser.language, triggerTime: cleanUser.triggerTime });
      console.log(`  ✓ Migrated subscriber: chatId=${cid} (${cleanUser.username || 'unnamed'}) [${cleanUser.language} @ ${cleanUser.triggerTime}]`);
    } catch (err: any) {
      const msg = `Failed to migrate user ${cid}: ${err.message}`;
      console.error(`  ✗ ${msg}`);
      report.errors.push(msg);
    }
  }

  // 4. Read and migrate existing bot_logs.json
  console.log('\n--- Step 2: Migrating Activity Logs ---');
  const logsFilePath = path.join(process.cwd(), 'data', 'bot_logs.json');
  let rawLogs: any[] = [];
  if (fs.existsSync(logsFilePath)) {
    try {
      rawLogs = JSON.parse(fs.readFileSync(logsFilePath, 'utf8'));
    } catch (e: any) {
      report.errors.push(`Failed to read bot_logs.json: ${e.message}`);
    }
  }

  console.log(`Found ${rawLogs.length} candidate logs in local JSON.`);
  // Migrate up to 100 most recent logs in batches of 25
  const logsToMigrate = rawLogs.slice(0, 100);

  for (let i = 0; i < logsToMigrate.length; i += 25) {
    const chunk = logsToMigrate.slice(i, i + 25);
    const batch = writeBatch(db);

    for (const log of chunk) {
      if (!log || !log.text) {
        report.logsSkipped++;
        continue;
      }
      const logId = String(log.id || Math.random().toString(36).substring(2, 9));
      const logRef = doc(db, 'activity_logs', logId);
      const cleanLog: any = {
        id: logId,
        timestamp: typeof log.timestamp === 'number' ? log.timestamp : Date.now(),
        chatId: typeof log.chatId === 'number' ? log.chatId : 0,
        type: ['incoming', 'outgoing', 'system'].includes(log.type) ? log.type : 'system',
        text: String(log.text).substring(0, 1000),
        status: ['success', 'error', 'info'].includes(log.status) ? log.status : 'info'
      };
      if (log.username) cleanLog.username = String(log.username);

      batch.set(logRef, cleanLog, { merge: true });
      report.logsMigrated++;
    }

    try {
      await batch.commit();
      console.log(`  ✓ Committed batch of logs (${Math.min(i + 25, logsToMigrate.length)}/${logsToMigrate.length})`);
    } catch (batchErr: any) {
      const msg = `Batch log migration failed at chunk index ${i}: ${batchErr.message}`;
      console.error(`  ✗ ${msg}`);
      report.errors.push(msg);
    }
  }

  // 5. Verification: Query Firestore back directly to verify
  console.log('\n--- Step 3: Verifying Firestore Persistent Data ---');
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    report.verifiedUsersInFirestore = usersSnapshot.size;
    console.log(`  🔍 Verified ${usersSnapshot.size} total subscribers currently stored in Firestore:`);
    usersSnapshot.forEach(docSnap => {
      const d = docSnap.data();
      console.log(`     - [${docSnap.id}] chatId=${d.chatId}, user=${d.username}, lang=${d.language}, time=${d.triggerTime}`);
    });

    const logsSnapshot = await getDocs(collection(db, 'activity_logs'));
    report.verifiedLogsInFirestore = logsSnapshot.size;
    console.log(`  🔍 Verified ${logsSnapshot.size} total activity log entries stored in Firestore.`);
  } catch (verErr: any) {
    const msg = `Verification query failed: ${verErr.message}`;
    console.error(`  ✗ ${msg}`);
    report.errors.push(msg);
  }

  // Save report to disk
  fs.writeFileSync(
    path.join(process.cwd(), 'data', 'migration_report.json'),
    JSON.stringify(report, null, 2),
    'utf8'
  );

  console.log('\n====================================================');
  console.log('🎉 Migration Completed!');
  console.log(`Users migrated: ${report.usersMigrated} (Verified in Firestore: ${report.verifiedUsersInFirestore})`);
  console.log(`Logs migrated: ${report.logsMigrated} (Verified in Firestore: ${report.verifiedLogsInFirestore})`);
  console.log(`Errors: ${report.errors.length}`);
  console.log('====================================================\n');

  return report;
}

runMigration()
  .then((report) => {
    console.log('Migration script finished cleanly.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal migration failure:', err);
    process.exit(1);
  });
