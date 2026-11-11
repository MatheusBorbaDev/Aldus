// Onda C2: lembrete diário de revisão com expo-notifications e AsyncStorage controlados. Não prova a notificação no Android.
const assert = require('node:assert/strict');
const store = new Map(); const platform = { OS: 'android' };
let granted = false, askGrant = true, failSchedule = false; const scheduled = new Map(); let nextId = 0; const channels = [];
const notifications = {
  AndroidImportance: { DEFAULT: 3 }, SchedulableTriggerInputTypes: { DAILY: 'daily' },
  getPermissionsAsync: async () => ({ granted }), requestPermissionsAsync: async () => { granted = askGrant; return { granted }; },
  setNotificationChannelAsync: async (id, config) => { channels.push([id, config.name]); },
  scheduleNotificationAsync: async request => { if (failSchedule) throw Error('x'); const id = 'n' + (++nextId); scheduled.set(id, request); return id; },
  cancelScheduledNotificationAsync: async id => { scheduled.delete(id); },
};
const storage = { getItem: async k => store.get(k) ?? null, setItem: async (k, v) => { store.set(k, v); } };
const load = require('./community-test-loader.cjs')({
  'react-native': { Platform: platform }, 'expo-notifications': notifications,
  '@react-native-async-storage/async-storage': { default: storage, ...storage },
  react: { useEffect() {} }, 'expo-router': { router: { push() {} } },
});
const r = load('src/presentation/services/reviewReminder.ts');
const { reminderRoute } = load('src/presentation/hooks/useReviewReminderNavigation.ts');
(async () => {
  assert.deepEqual(await r.readReviewReminder(), r.DEFAULT_REVIEW_REMINDER, 'off by default');
  assert.ok(r.REVIEW_REMINDER_KEY.startsWith('@kindle/'));
  let result = await r.setReviewReminder(true, 19, r.DEFAULT_REVIEW_REMINDER);
  assert.equal(result.ok, true); assert.equal(scheduled.size, 1); const request = [...scheduled.values()][0];
  assert.deepEqual(request.trigger, { type: 'daily', hour: 19, minute: 0, channelId: 'review-reminder' }); assert.deepEqual(channels.at(-1), ['review-reminder', 'Lembrete de revisão']);
  assert.doesNotMatch(request.content.body, /\d/, 'no invented count in the text'); assert.equal(request.content.data.url, '/study');
  assert.deepEqual(await r.readReviewReminder(), result.reminder, 'saved only after scheduling');
  result = await r.setReviewReminder(true, 8, result.reminder); assert.equal(scheduled.size, 1, 'changing the hour never leaves two reminders'); assert.equal([...scheduled.values()][0].trigger.hour, 8);
  result = await r.setReviewReminder(false, 8, result.reminder); assert.equal(scheduled.size, 0); assert.equal((await r.readReviewReminder()).enabled, false);
  granted = false; askGrant = false; const denied = await r.setReviewReminder(true, 21, result.reminder);
  assert.deepEqual(denied, { ok: false, reason: 'denied' }); assert.equal(scheduled.size, 0); assert.equal((await r.readReviewReminder()).enabled, false, 'denied → preference unchanged');
  granted = true; failSchedule = true; assert.deepEqual(await r.setReviewReminder(true, 21, result.reminder), { ok: false, reason: 'failed' }); assert.equal((await r.readReviewReminder()).enabled, false, 'failure → nothing saved');
  failSchedule = false; platform.OS = 'web'; assert.deepEqual(await r.setReviewReminder(true, 21, result.reminder), { ok: false, reason: 'unsupported' }); assert.equal(r.reviewRemindersSupported(), false);
  store.set(r.REVIEW_REMINDER_KEY, JSON.stringify({ enabled: true, hour: 3, notificationId: 7 })); assert.deepEqual(await r.readReviewReminder(), { enabled: true, hour: 19, notificationId: null }, 'invalid saved values are sanitized');
  assert.equal(reminderRoute({ url: '/study' }), '/study'); assert.equal(reminderRoute({ url: 'https://evil.example' }), null, 'notification data cannot choose arbitrary routes'); assert.equal(reminderRoute(null), null);
  console.log('PASS review reminder: off by default, daily trigger at the chosen hour on its channel, no invented numbers, one reminder at a time, denied/failure keep preference, Web unsupported, sanitized storage, only /study opens. Android delivery NOT TESTED.');
})().catch(e => { console.error(e); process.exitCode = 1; });
