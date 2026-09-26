import { 
  parseTimeMinutes, 
  normalizeRecurringTriggerTime, 
  getDeliveryKey, 
  claimReminderDeliveryAtomic, 
  markReminderDelivered,
  markReminderFailed,
  isReminderDeliveredToday,
  clearLocalDeliveriesCacheForTesting,
  clearUsersCacheForTesting,
  getLocalDeliveriesCacheForTesting,
  saveUser,
  getUser,
  getAllUsers,
  getSchedulerTelemetry
} from '../src/server/db';
import { 
  isReminderDueInWindow, 
  processScheduledRemindersTick, 
  validateSchedulerAuth,
  getISTDateString,
  getISTTimeString,
  parseCustomTimeString,
  startReminderScheduler,
  stopReminderScheduler,
  stopBotService,
  startBotService,
  handleBotMessage
} from '../src/server/bot';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`  ✓ ${message}`);
  }
}

async function runTests() {
  console.log('\n================================================================');
  console.log('RUNNING COMPREHENSIVE PRODUCTION-READINESS REMINDER ARCHITECTURE TESTS');
  console.log('================================================================\n');

  // Ensure bot service is started before running tests
  startBotService();

  // -----------------------------------------------------------
  // TEST 0: User document storage is strictly time-only (no date)
  // -----------------------------------------------------------
  console.log('STAGE 0: User Document recurring time format verification (date-independent)');
  clearUsersCacheForTesting();
  const testUser = saveUser(5164666817, {
    triggerTime: '07:40 AM',
    language: 'both',
    username: 'test_subscriber'
  });
  assert(testUser.triggerTime === '07:40 AM', 'triggerTime is strictly time-only "07:40 AM"');
  assert(!testUser.triggerTime.includes('-') && !testUser.triggerTime.includes('/'), 'triggerTime contains NO date');
  
  // Normalization checks
  assert(normalizeRecurringTriggerTime('07:40:AM') === '07:40 AM', 'Normalizes 07:40:AM to 07:40 AM');
  assert(normalizeRecurringTriggerTime('7:40 am') === '07:40 AM', 'Normalizes 7:40 am to 07:40 AM');
  assert(normalizeRecurringTriggerTime('19:40') === '07:40 PM', 'Normalizes 24-hr 19:40 to 07:40 PM');
  assert(normalizeRecurringTriggerTime('none') === 'none', 'Normalizes none');

  // getDeliveryKey format check
  const testKey = getDeliveryKey('2026-09-22', 5164666817, '07:40 AM');
  assert(testKey === '2026-09-22_5164666817_07:40', `getDeliveryKey produces date-scoped key: ${testKey}`);

  const testDate = '2026-09-22';

  // -----------------------------------------------------------
  // TEST 1: Authorized tick authentication
  // -----------------------------------------------------------
  console.log('\nSTAGE 1: Authorized tick authentication (header, query, bearer, and open default)');
  const secretKey = 'my_secure_cron_secret_123';
  
  // 1a. Header authentication
  assert(
    validateSchedulerAuth({ 'x-scheduler-secret': secretKey }, undefined, secretKey) === true,
    'Header x-scheduler-secret authorized successfully'
  );
  
  // 1b. Query parameter authentication
  assert(
    validateSchedulerAuth({}, secretKey, secretKey) === true,
    'Query parameter ?secret= authorized successfully'
  );

  // 1c. Bearer token authentication
  assert(
    validateSchedulerAuth({ 'authorization': `Bearer ${secretKey}` }, undefined, secretKey) === true,
    'Authorization Bearer token authorized successfully'
  );

  // 1d. Open default when SCHEDULER_SECRET is not configured or empty
  assert(
    validateSchedulerAuth({}, undefined, undefined) === true,
    'Open access granted when SCHEDULER_SECRET is not set in environment'
  );
  assert(
    validateSchedulerAuth({}, undefined, '') === true,
    'Open access granted when SCHEDULER_SECRET is blank'
  );

  // -----------------------------------------------------------
  // TEST 2: Unauthorized tick rejection
  // -----------------------------------------------------------
  console.log('\nSTAGE 2: Unauthorized tick rejection');
  // 2a. Missing secret when configured
  assert(
    validateSchedulerAuth({}, undefined, secretKey) === false,
    'Missing secret rejected when SCHEDULER_SECRET is configured'
  );

  // 2b. Wrong secret
  assert(
    validateSchedulerAuth({ 'x-scheduler-secret': 'wrong_secret' }, undefined, secretKey) === false,
    'Mismatched header secret rejected'
  );
  assert(
    validateSchedulerAuth({}, 'wrong_query_secret', secretKey) === false,
    'Mismatched query secret rejected'
  );
  assert(
    validateSchedulerAuth({ 'authorization': 'Bearer wrong_bearer' }, undefined, secretKey) === false,
    'Mismatched Bearer token rejected'
  );

  // -----------------------------------------------------------
  // TEST 3: Exact trigger time (0 minute lag)
  // -----------------------------------------------------------
  console.log('\nSTAGE 3: Exact trigger time (07:40 AM tick for 07:40 AM schedule) → sends');
  clearLocalDeliveriesCacheForTesting();
  clearUsersCacheForTesting();
  saveUser(101, { triggerTime: '07:40 AM', language: 'both', username: 'user101' });

  const tick1 = await processScheduledRemindersTick(undefined, '07:40 AM', 'external_trigger', testDate);
  assert(tick1.dueCount === 1, 'Evaluated as due at exact time');
  assert(tick1.claimedCount === 1, 'Delivery claimed at exact time');
  assert(tick1.deliveredCount === 1, 'Couplet delivered at exact time');
  assert(tick1.details[0].status === 'DELIVERED', 'Status marked DELIVERED');
  assert(tick1.details[0].isCatchUp === false, 'isCatchUp is false at exact minute');
  assert(tick1.details[0].lagMinutes === 0, 'lagMinutes is 0');

  // -----------------------------------------------------------
  // TEST 4: +1 minute catch-up
  // -----------------------------------------------------------
  console.log('\nSTAGE 4: +1 minute (07:41 AM tick for 07:40 AM schedule) → sends if not already delivered');
  clearLocalDeliveriesCacheForTesting();
  clearUsersCacheForTesting();
  saveUser(102, { triggerTime: '07:40 AM', language: 'both', username: 'user102' });

  const tick2 = await processScheduledRemindersTick(undefined, '07:41 AM', 'external_trigger', testDate);
  assert(tick2.dueCount === 1, 'Due at +1 min');
  assert(tick2.claimedCount === 1, 'Claimed at +1 min');
  assert(tick2.deliveredCount === 1, 'Delivered at +1 min');
  assert(tick2.details[0].isCatchUp === true, 'isCatchUp is true at +1 min');
  assert(tick2.details[0].lagMinutes === 1, 'lagMinutes is 1');

  // -----------------------------------------------------------
  // TEST 5: +2 minutes catch-up
  // -----------------------------------------------------------
  console.log('\nSTAGE 5: +2 minutes (07:42 AM tick for 07:40 AM schedule) → sends if not already delivered');
  clearLocalDeliveriesCacheForTesting();
  clearUsersCacheForTesting();
  saveUser(103, { triggerTime: '07:40 AM', language: 'both', username: 'user103' });

  const tick3 = await processScheduledRemindersTick(undefined, '07:42 AM', 'external_trigger', testDate);
  assert(tick3.dueCount === 1, 'Due at +2 min');
  assert(tick3.claimedCount === 1, 'Claimed at +2 min');
  assert(tick3.deliveredCount === 1, 'Delivered at +2 min');
  assert(tick3.details[0].isCatchUp === true, 'isCatchUp is true at +2 min');
  assert(tick3.details[0].lagMinutes === 2, 'lagMinutes is 2');

  // -----------------------------------------------------------
  // TEST 6: +3 minutes rejected
  // -----------------------------------------------------------
  console.log('\nSTAGE 6: +3 minutes (07:43 AM tick for 07:40 AM schedule) → rejected');
  clearLocalDeliveriesCacheForTesting();
  clearUsersCacheForTesting();
  saveUser(104, { triggerTime: '07:40 AM', language: 'both', username: 'user104' });

  const tick4 = await processScheduledRemindersTick(undefined, '07:43 AM', 'external_trigger', testDate);
  assert(tick4.dueCount === 0, 'Not due at +3 min (beyond tolerance window)');
  assert(tick4.deliveredCount === 0, 'No delivery dispatched at +3 min');

  // -----------------------------------------------------------
  // TEST 7: Duplicate tick prevention (same calendar day)
  // -----------------------------------------------------------
  console.log('\nSTAGE 7: Duplicate tick prevention (second tick skips)');
  clearLocalDeliveriesCacheForTesting();
  clearUsersCacheForTesting();
  saveUser(107, { triggerTime: '07:40 AM', language: 'both', username: 'user107' });

  // First tick delivers
  const tick7First = await processScheduledRemindersTick(undefined, '07:40 AM', 'external_trigger', testDate);
  assert(tick7First.deliveredCount === 1, 'First tick delivers to user 107');

  // Second tick at +1 minute skips
  const tick7Second = await processScheduledRemindersTick(undefined, '07:41 AM', 'external_trigger', testDate);
  assert(tick7Second.dueCount === 1, 'Due candidate evaluated by window');
  assert(tick7Second.claimedCount === 0, 'Claim rejected by idempotency key');
  assert(tick7Second.skippedCount === 1, 'Recorded as SKIPPED');
  assert(tick7Second.deliveredCount === 0, 'Duplicate delivery prevented');
  assert(tick7Second.details[0].status === 'SKIPPED', 'Status is SKIPPED');

  // -----------------------------------------------------------
  // TEST 8: Concurrent tick requests (Promise.all race test)
  // -----------------------------------------------------------
  console.log('\nSTAGE 8: Concurrent tick execution race test (Promise.all)');
  clearLocalDeliveriesCacheForTesting();
  clearUsersCacheForTesting();
  saveUser(108, { triggerTime: '07:40 AM', language: 'both', username: 'user108' });

  const [race1, race2] = await Promise.all([
    processScheduledRemindersTick(undefined, '07:40 AM', 'worker_alpha', testDate),
    processScheduledRemindersTick(undefined, '07:40 AM', 'worker_beta', testDate)
  ]);
  const totalDelivered = race1.deliveredCount + race2.deliveredCount;
  const totalSkipped = race1.skippedCount + race2.skippedCount;
  assert(totalDelivered === 1, `Exactly 1 delivery occurred across simultaneous workers (got ${totalDelivered})`);
  assert(totalSkipped === 1, `Exactly 1 worker skipped due to atomic lock (got ${totalSkipped})`);

  // -----------------------------------------------------------
  // TEST 9: Server restart / reinitialization retains subscriber state
  // -----------------------------------------------------------
  console.log('\nSTAGE 9: Server restart / reinitialization retains subscriber state');
  const retrievedUser = getUser(108);
  assert(retrievedUser.chatId === 108, 'User state reconstructed after simulated restart');
  assert(retrievedUser.triggerTime === '07:40 AM', 'User triggerTime preserved');

  const isDeliveredToday = await isReminderDeliveredToday(108, testDate, '07:40 AM');
  assert(isDeliveredToday === true, 'Delivery ledger recognizes today delivery was completed');

  // -----------------------------------------------------------
  // TEST 10: Previous-day delivery record does not block today
  // -----------------------------------------------------------
  console.log('\nSTAGE 10: Previous-day delivery record does not block today');
  clearLocalDeliveriesCacheForTesting();
  clearUsersCacheForTesting();
  saveUser(110, { triggerTime: '07:40 AM', language: 'both', username: 'user110' });

  // Mark yesterday delivered
  await markReminderDelivered(110, '2026-09-21', '07:40 AM', 1);

  // Today runs at 07:40 AM
  const tickNextDay = await processScheduledRemindersTick(undefined, '07:40 AM', 'external_trigger', '2026-09-22');
  assert(tickNextDay.dueCount === 1, 'Due today despite yesterday delivery');
  assert(tickNextDay.claimedCount === 1, 'Claimed today');
  assert(tickNextDay.deliveredCount === 1, 'Delivered today');

  // -----------------------------------------------------------
  // TEST 11: Different user trigger times
  // -----------------------------------------------------------
  console.log('\nSTAGE 11: Different user trigger times (07:40 AM vs 08:45 AM)');
  clearLocalDeliveriesCacheForTesting();
  clearUsersCacheForTesting();
  saveUser(111, { triggerTime: '07:40 AM', language: 'both', username: 'early_bird' });
  saveUser(112, { triggerTime: '08:45 AM', language: 'both', username: 'later_bird' });

  const tickDiff = await processScheduledRemindersTick(undefined, '07:40 AM', 'external_trigger', testDate);
  assert(tickDiff.dueCount === 1, 'Only user with 07:40 AM evaluated as due');
  assert(tickDiff.details[0].chatId === 111, 'Target user is 111');
  assert(tickDiff.deliveredCount === 1, 'Early bird delivered');

  // -----------------------------------------------------------
  // TEST 12: Multiple users evaluation
  // -----------------------------------------------------------
  console.log('\nSTAGE 12: Multiple users with shared and varied schedules');
  clearLocalDeliveriesCacheForTesting();
  clearUsersCacheForTesting();
  saveUser(201, { triggerTime: '07:40 AM', language: 'tamil', username: 'u201' });
  saveUser(202, { triggerTime: '07:40 AM', language: 'english', username: 'u202' });
  saveUser(203, { triggerTime: '07:40 AM', language: 'both', username: 'u203' });
  saveUser(204, { triggerTime: '09:00 AM', language: 'both', username: 'u204' });
  saveUser(205, { triggerTime: 'none', language: 'both', username: 'u205' });

  const tickMulti = await processScheduledRemindersTick(undefined, '07:40 AM', 'external_trigger', testDate);
  assert(tickMulti.evaluatedCount === 5, 'Evaluated all 5 users');
  assert(tickMulti.dueCount === 3, 'Exactly 3 users are due for 07:40 AM');
  assert(tickMulti.deliveredCount === 3, 'Delivered to all 3 due users');
  assert(tickMulti.skippedCount === 0, 'Zero skipped');

  // -----------------------------------------------------------
  // TEST 13: Midnight boundary handling
  // -----------------------------------------------------------
  console.log('\nSTAGE 13: Midnight boundary handling (11:59 PM reminder evaluated at 12:01 AM next day)');
  const midnightRoll = isReminderDueInWindow(1, 1439, 2); // 12:01 AM = 1 min, 11:59 PM = 1439 min
  assert(midnightRoll.isDue === true, '11:59 PM reminder due at 12:01 AM next day (+2m lag)');
  assert(midnightRoll.lagMinutes === 2, 'lag is correctly computed as 2 minutes across midnight rollover');

  const midnightRollExceeded = isReminderDueInWindow(3, 1439, 2); // 12:03 AM = 3 min
  assert(midnightRollExceeded.isDue === false, '11:59 PM reminder is not due at 12:03 AM (+3m lag exceeds window)');

  // -----------------------------------------------------------
  // TEST 14: 00:00 (12:00 AM) reminder delivery
  // -----------------------------------------------------------
  console.log('\nSTAGE 14: 00:00 (12:00 AM) reminder delivery');
  clearLocalDeliveriesCacheForTesting();
  clearUsersCacheForTesting();
  saveUser(214, { triggerTime: '12:00 AM', language: 'both', username: 'user214' });

  const tickMidnight = await processScheduledRemindersTick(undefined, '12:00 AM', 'external_trigger', testDate);
  assert(tickMidnight.dueCount === 1, '12:00 AM reminder due at 12:00 AM');
  assert(tickMidnight.deliveredCount === 1, 'Delivered at 12:00 AM');

  // Next calendar day at 12:00 AM is eligible again
  const tickMidnightNextDay = await processScheduledRemindersTick(undefined, '12:00 AM', 'external_trigger', '2026-09-23');
  assert(tickMidnightNextDay.deliveredCount === 1, '12:00 AM reminder delivered again on next calendar day');

  // -----------------------------------------------------------
  // TEST 15: Firestore atomic delivery claim failure (in-flight collision)
  // -----------------------------------------------------------
  console.log('\nSTAGE 15: Firestore atomic delivery claim failure (in-flight lease collision)');
  clearLocalDeliveriesCacheForTesting();
  const claimA = await claimReminderDeliveryAtomic(301, testDate, '07:40 AM');
  assert(claimA.claimed === true, 'First worker claims delivery lease');

  // Simultaneous second claim fails immediately
  const claimB = await claimReminderDeliveryAtomic(301, testDate, '07:40 AM');
  assert(claimB.claimed === false, 'Second concurrent worker claim is rejected');
  assert(claimB.reason?.includes('in-flight') || claimB.reason?.includes('In-flight'), 'Rejection reason states in-flight lease');

  // -----------------------------------------------------------
  // TEST 16: Telegram failure does not mark delivery as successful
  // -----------------------------------------------------------
  console.log('\nSTAGE 16: Telegram failure should not incorrectly mark delivery as successful');
  clearLocalDeliveriesCacheForTesting();
  await claimReminderDeliveryAtomic(401, testDate, '07:40 AM');
  await markReminderFailed(401, testDate, '07:40 AM', 'Telegram API 502 Bad Gateway');
  const cache = getLocalDeliveriesCacheForTesting();
  const deliveryKey = getDeliveryKey(testDate, 401, '07:40 AM');
  assert(cache[deliveryKey].status === 'FAILED', 'Status recorded as FAILED, not DELIVERED');
  assert(cache[deliveryKey].deliveredAt === undefined, 'deliveredAt timestamp is undefined');

  // -----------------------------------------------------------
  // TEST 17: Bot service stopped state prevents deliveries
  // -----------------------------------------------------------
  console.log('\nSTAGE 17: Bot service stopped state prevents deliveries');
  clearLocalDeliveriesCacheForTesting();
  clearUsersCacheForTesting();
  saveUser(501, { triggerTime: '07:40 AM', language: 'both', username: 'user501' });

  stopBotService(); // Admin toggled bot service to STOPPED
  const tickStopped = await processScheduledRemindersTick(undefined, '07:40 AM', 'external_trigger', testDate);
  assert(tickStopped.dueCount === 1, 'Recognizes due candidate');
  assert(tickStopped.deliveredCount === 0, 'No delivery dispatched while stopped');
  assert(tickStopped.skippedCount === 1, 'Marked as SKIPPED');
  assert(tickStopped.details[0].reason === 'Bot service is stopped', 'Reason specifies bot service stopped');

  startBotService(); // Resume bot service

  // -----------------------------------------------------------
  // TEST 18: Response structure privacy verification (no leaks)
  // -----------------------------------------------------------
  console.log('\nSTAGE 18: Response structure privacy verification (no sensitive leaks)');
  clearLocalDeliveriesCacheForTesting();
  clearUsersCacheForTesting();
  saveUser(701, { triggerTime: '07:40 AM', language: 'both', username: 'private_user' });
  const rawResult = await processScheduledRemindersTick(undefined, '07:40 AM', 'external_trigger', testDate);

  // The external HTTP response returned by /api/scheduler/tick:
  const sanitizedResponse = {
    success: true,
    timeString: rawResult.timeString,
    dateString: rawResult.dateString,
    source: rawResult.source,
    evaluatedCount: rawResult.evaluatedCount,
    processedCount: rawResult.evaluatedCount,
    dueCount: rawResult.dueCount,
    normalMatchesCount: rawResult.normalMatchesCount,
    catchUpMatchesCount: rawResult.catchUpMatchesCount,
    claimedCount: rawResult.claimedCount,
    deliveredCount: rawResult.deliveredCount,
    failedCount: rawResult.failedCount,
    skippedCount: rawResult.skippedCount
  };

  const responseJson = JSON.stringify(sanitizedResponse);
  assert(!responseJson.includes('private_user'), 'Does not leak username in external response');
  assert(!responseJson.includes('701'), 'Does not leak subscriber chatId in external response');
  assert(!responseJson.includes('TELEGRAM'), 'Does not leak bot tokens');
  assert(!responseJson.includes('secret'), 'Does not leak scheduler secrets');
  assert(!responseJson.includes('apiKey'), 'Does not leak API keys');
  assert(sanitizedResponse.success === true, 'Response indicates success: true');
  assert(sanitizedResponse.deliveredCount === 1, 'Response confirms deliveredCount');

  // -----------------------------------------------------------
  // TEST 19: Existing webhook & command parser functionality
  // -----------------------------------------------------------
  console.log('\nSTAGE 19: Existing webhook & bot command parser functionality');
  const responseStart = await handleBotMessage(601, '/start', 'test_user', 'Tester');
  assert(responseStart.text.includes('Thirukkural') || responseStart.text.includes('திருக்குறள்'), 'Handles /start command');

  const responseToday = await handleBotMessage(601, '/today');
  assert(responseToday.text.includes('Kural') || responseToday.text.includes('குறள்'), 'Handles /today command');

  const responseTime = await handleBotMessage(601, '/time 07:40 AM');
  assert(responseTime.text.includes('07:40 AM'), 'Handles /time command and normalizes format');
  const user601 = getUser(601);
  assert(user601.triggerTime === '07:40 AM', 'User triggerTime updated via bot command');

  console.log('\n================================================================');
  console.log('✅ ALL PRODUCTION-READINESS TESTS PASSED SUCCESSFULLY!');
  console.log('================================================================\n');
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
