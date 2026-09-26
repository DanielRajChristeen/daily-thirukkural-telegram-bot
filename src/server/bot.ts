import { kurals, Kural } from '../kurals';
import { chapters } from '../chapters';
import { 
  getUser, 
  saveUser, 
  getAllUsers, 
  BotUser, 
  addActivityLog,
  claimReminderDeliveryAtomic,
  markReminderDelivered,
  markReminderFailed,
  recordSchedulerTick,
  getSystemGatewayConfig,
  saveSystemGatewayConfig,
  parseTimeMinutes,
  setSchedulerLifecycleState,
  recordSchedulerHeartbeat
} from './db';
import * as fs from 'fs';
import * as path from 'path';

// Bot service status controller
const STATUS_FILE = path.join(process.cwd(), 'data', 'bot_status.json');
export let isBotServiceStopped = false;

try {
  if (fs.existsSync(STATUS_FILE)) {
    const data = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf-8'));
    isBotServiceStopped = !!data.stopped;
    console.log(`ℹ️ Loaded persistent bot service status: stopped = ${isBotServiceStopped}`);
  }
} catch (err) {
  console.error("Failed to load persistent bot service status:", err);
}

function saveStatusToDisk() {
  try {
    const dir = path.dirname(STATUS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STATUS_FILE, JSON.stringify({ stopped: isBotServiceStopped }, null, 2), 'utf-8');
  } catch (err) {
    console.error("Failed to save persistent bot service status:", err);
  }
}

export function stopBotService() {
  isBotServiceStopped = true;
  saveStatusToDisk();
  console.log("🛑 Telegram Bot Service has been STOPPED.");
}

export function startBotService() {
  isBotServiceStopped = false;
  saveStatusToDisk();
  console.log("▶️ Telegram Bot Service has been STARTED.");
}

// Complete list of all 1330 Kurals loaded offline
export let loadedKurals: Kural[] = [];
const KURALS_ALL_PATH = path.join(process.cwd(), 'data', 'kurals_all.json');

try {
  if (fs.existsSync(KURALS_ALL_PATH)) {
    loadedKurals = JSON.parse(fs.readFileSync(KURALS_ALL_PATH, 'utf-8'));
    console.log(`📖 Successfully loaded ${loadedKurals.length} offline Kurals from kurals_all.json.`);
  } else {
    loadedKurals = kurals;
    console.warn(`⚠️ kurals_all.json not found. Falling back to curated ${kurals.length} Kurals.`);
  }
} catch (err) {
  console.error("❌ Failed to load offline Kurals:", err);
  loadedKurals = kurals;
}

// In-memory cache kept for backwards-compatibility
export const dynamicKuralsCache: Record<number, Kural> = {};

// Keep a clean function signature for fetchKuralFromAI but fetch entirely offline
export async function fetchKuralFromAI(id: number): Promise<Kural | null> {
  if (id < 1 || id > 1330) {
    return null;
  }
  const found = loadedKurals.find(k => k.id === id);
  return found || null;
}

// Keep search signature but perform a robust offline case-insensitive search
export async function searchTextKuralsWithAI(query: string): Promise<Kural[]> {
  const queryLower = query.toLowerCase().trim();
  if (!queryLower) return [];

  const results = loadedKurals.filter(k => 
    k.adhigaram.toLowerCase().includes(queryLower) ||
    k.vilakam.toLowerCase().includes(queryLower) ||
    k.transliteration.toLowerCase().includes(queryLower) ||
    k.english.toLowerCase().includes(queryLower) ||
    k.paaal.toLowerCase().includes(queryLower)
  );

  return results.slice(0, 5);
}


// Helper to format Kurals for display
export function formatKural(kural: Kural, language: 'tamil' | 'english' | 'both'): string {
  const kuralText = kural.kural.replace(/<br\s*\/?>/gi, '\n');
  const section = kural.paaal;
  const chapter = kural.adhigaram;
  
  let formatted = `<b>குறள் / Kural ${kural.id}</b>\n`;
  formatted += `<i>அதிகாரம்: ${chapter} (${section})</i>\n\n`;
  
  if (language === 'tamil') {
    formatted += `<b>${kuralText}</b>\n\n`;
    formatted += `<b>விளக்கம்:</b>\n${kural.vilakam}`;
  } else if (language === 'english') {
    const englishLines = kural.english.replace(/\$/g, '\n');
    formatted += `<i>${kural.transliteration}</i>\n\n`;
    formatted += `<b>Translation:</b>\n${englishLines}`;
  } else {
    // Both
    const englishLines = kural.english.replace(/\$/g, '\n');
    formatted += `<b>${kuralText}</b>\n\n`;
    formatted += `<b>விளக்கம்:</b>\n${kural.vilakam}\n\n`;
    formatted += `<i>${kural.transliteration}</i>\n\n`;
    formatted += `<b>Translation:</b>\n${englishLines}`;
  }
  
  return formatted;
}

// Bot Response Type representing a Telegram send message payload
export interface BotResponse {
  text: string;
  replyMarkup?: {
    inline_keyboard?: Array<Array<{ 
      text: string; 
      callback_data?: string; 
      url?: string; 
      web_app?: { url: string };
    }>>;
    keyboard?: Array<Array<{ text: string }>>;
    resize_keyboard?: boolean;
  };
}

// App URL state for WebApp and Web UI links
let currentAppUrl = (() => {
  const envUrl = process.env.APP_URL;
  if (envUrl && envUrl !== 'MY_APP_URL' && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
    let clean = envUrl.replace(/\/$/, '');
    if (clean.startsWith('http://')) clean = 'https://' + clean.slice(7);
    else if (!clean.startsWith('https://')) clean = 'https://' + clean;
    return clean;
  }
  return '';
})();

export function setAppUrl(url: string) {
  if (url && url !== 'MY_APP_URL' && !url.includes('localhost') && !url.includes('127.0.0.1')) {
    let clean = url.replace(/\/$/, '');
    if (clean.startsWith('http://')) {
      clean = 'https://' + clean.slice(7);
    } else if (!clean.startsWith('https://')) {
      clean = 'https://' + clean;
    }
    currentAppUrl = clean;
  }
}

export function getAppUrl(): string {
  let url = currentAppUrl || process.env.APP_URL || '';
  if (!url || url === 'MY_APP_URL' || url.includes('localhost') || url.includes('127.0.0.1')) {
    return '';
  }
  let clean = url.replace(/\/$/, '');
  if (clean.startsWith('http://')) {
    clean = 'https://' + clean.slice(7);
  } else if (!clean.startsWith('https://')) {
    clean = 'https://' + clean;
  }
  return clean;
}

// Helper to format stored time string for friendly display
export function formatTimeDisplay(timeStr: string): string {
  if (!timeStr || timeStr.toLowerCase() === 'none') {
    return 'Disabled (OFF 📴)';
  }
  const parts = timeStr.split(':');
  if (parts.length >= 3) {
    return `${parts[0]}:${parts[1]} ${parts[2]}`;
  }
  return timeStr;
}

// Universal parser for any custom time entered by user
export function parseCustomTimeString(input: string): string | null {
  const trimmed = input.trim();
  const upper = trimmed.toUpperCase();

  if (['NONE', 'OFF', 'DISABLE', 'DISABLED', 'STOP', 'CANCEL'].includes(upper)) {
    return 'none';
  }

  // Matches 12-hour formats e.g. "07:15:AM", "7:15 AM", "07:15AM", "7:15pm", "7.15 AM", "07.15 PM"
  const match12 = upper.match(/^(\d{1,2})[:.](\d{2})\s*(?::\s*)?(AM|PM)$/);
  if (match12) {
    let hour = parseInt(match12[1], 10);
    const minute = parseInt(match12[2], 10);
    const ampm = match12[3];

    if (hour >= 1 && hour <= 12 && minute >= 0 && minute <= 59) {
      const hourStr = String(hour).padStart(2, '0');
      const minStr = String(minute).padStart(2, '0');
      return `${hourStr}:${minStr} ${ampm}`;
    }
  }

  // Matches 24-hour formats e.g. "14:30", "07:15", "19:45", "00:15", "23:59", "7:15"
  const match24 = upper.match(/^(\d{1,2})[:.](\d{2})$/);
  if (match24) {
    let hour = parseInt(match24[1], 10);
    const minute = parseInt(match24[2], 10);

    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      const ampm = hour >= 12 ? 'PM' : 'AM';
      let hour12 = hour % 12;
      if (hour12 === 0) hour12 = 12;
      const hourStr = String(hour12).padStart(2, '0');
      const minStr = String(minute).padStart(2, '0');
      return `${hourStr}:${minStr} ${ampm}`;
    }
  }

  // Matches hour-only e.g. "7 AM", "7AM", "11 PM", "11pm"
  const matchHourOnly = upper.match(/^(\d{1,2})\s*(AM|PM)$/);
  if (matchHourOnly) {
    const hour = parseInt(matchHourOnly[1], 10);
    const ampm = matchHourOnly[2];
    if (hour >= 1 && hour <= 12) {
      const hourStr = String(hour).padStart(2, '0');
      return `${hourStr}:00 ${ampm}`;
    }
  }

  return null;
}

// Standard menus
function getMainMenuMarkup(): BotResponse['replyMarkup'] {
  return {
    inline_keyboard: [
      [
        { text: "Daily Kural 📅", callback_data: "btn_daily" },
        { text: "Random Kural 🎲", callback_data: "btn_random" }
      ],
      [
        { text: "Search Kural 🔍", callback_data: "btn_search" }
      ],
      [
        { text: "Set Language 🌐", callback_data: "btn_lang_menu" },
        { text: "Set Reminder ⏰", callback_data: "btn_time_menu" }
      ]
    ]
  };
}

function getLanguageMenuMarkup(current: string): BotResponse['replyMarkup'] {
  return {
    inline_keyboard: [
      [
        { text: `${current === 'tamil' ? '✅ ' : ''}Tamil 🪔`, callback_data: "set_lang_tamil" },
        { text: `${current === 'english' ? '✅ ' : ''}English 🇬🇧`, callback_data: "set_lang_english" },
        { text: `${current === 'both' ? '✅ ' : ''}Both 🌐`, callback_data: "set_lang_both" }
      ],
      [
        { text: "↩️ Back to Main Menu", callback_data: "btn_menu" }
      ]
    ]
  };
}

function getSectionMenuMarkup(): BotResponse['replyMarkup'] {
  return {
    inline_keyboard: [
      [
        { text: "அறத்துப்பால் (Aram) 🌸", callback_data: "find_sec_aram" }
      ],
      [
        { text: "பொருட்பால் (Porul) 🏛️", callback_data: "find_sec_porul" }
      ],
      [
        { text: "காமத்துப்பால் (Inbam) 💕", callback_data: "find_sec_inbam" }
      ],
      [
        { text: "↩️ Back to Main Menu", callback_data: "btn_menu" }
      ]
    ]
  };
}

// Customized interactive time menu with steppers and Flask / Web UI integration
export function getCustomReminderMenuMarkup(currentTime: string, draftTime: string, chatId: number): BotResponse['replyMarkup'] {
  let [hStr, mStr, ampm] = (draftTime && draftTime !== 'none' ? draftTime : '07:00:AM').split(':');
  let hour = parseInt(hStr, 10);
  let minute = parseInt(mStr, 10);
  if (isNaN(hour) || hour < 1 || hour > 12) hour = 7;
  if (isNaN(minute) || minute < 0 || minute > 59) minute = 0;
  if (ampm !== 'AM' && ampm !== 'PM') ampm = 'AM';

  const prevHour = hour === 1 ? 12 : hour - 1;
  const nextHour = hour === 12 ? 1 : hour + 1;

  const prevMin5 = (minute - 5 + 60) % 60;
  const nextMin5 = (minute + 5) % 60;

  const prevMin1 = (minute - 1 + 60) % 60;
  const nextMin1 = (minute + 1) % 60;

  const pad = (n: number) => String(n).padStart(2, '0');
  const curDraftFormatted = `${pad(hour)}:${pad(minute)}:${ampm}`;

  const appUrl = getAppUrl();
  const isHttps = !!(appUrl && appUrl.startsWith('https://'));
  const fullPickerUrl = isHttps 
    ? `${appUrl}/time-picker?chatId=${chatId}&time=${encodeURIComponent(curDraftFormatted)}`
    : '';

  const keyboard: Array<Array<{ text: string; callback_data?: string; url?: string; web_app?: { url: string } }>> = [
    // Stepper Row 1: Hours
    [
      { text: "◀ -1h", callback_data: `draft_time_${pad(prevHour)}_${pad(minute)}_${ampm}` },
      { text: `🕒 ${pad(hour)} Hr`, callback_data: `draft_time_${pad(nextHour)}_${pad(minute)}_${ampm}` },
      { text: "+1h ▶", callback_data: `draft_time_${pad(nextHour)}_${pad(minute)}_${ampm}` }
    ],
    // Stepper Row 2: Minutes (5m jump)
    [
      { text: "◀ -5m", callback_data: `draft_time_${pad(hour)}_${pad(prevMin5)}_${ampm}` },
      { text: `⏱️ ${pad(minute)} Min`, callback_data: `draft_time_${pad(hour)}_${pad(nextMin5)}_${ampm}` },
      { text: "+5m ▶", callback_data: `draft_time_${pad(hour)}_${pad(nextMin5)}_${ampm}` }
    ],
    // Stepper Row 3: Minute fine tuning (1m)
    [
      { text: "-1 Min", callback_data: `draft_time_${pad(hour)}_${pad(prevMin1)}_${ampm}` },
      { text: "+1 Min", callback_data: `draft_time_${pad(hour)}_${pad(nextMin1)}_${ampm}` }
    ],
    // Stepper Row 4: AM / PM Period
    [
      { text: ampm === 'AM' ? '🔘 AM (Morning 🌅)' : '☀️ AM', callback_data: `draft_time_${pad(hour)}_${pad(minute)}_AM` },
      { text: ampm === 'PM' ? '🔘 PM (Evening 🌇)' : '🌙 PM', callback_data: `draft_time_${pad(hour)}_${pad(minute)}_PM` }
    ],
    // Row 5: Confirmation action
    [
      { text: `✅ Confirm & Set: ${pad(hour)}:${pad(minute)} ${ampm} (IST)`, callback_data: `set_custom_${curDraftFormatted}` }
    ],
    // Row 6: Visual Time Picker (Dual WebApp & Direct Browser Link)
    ...(fullPickerUrl ? [
      [
        { text: "📱 Open Visual Time Picker (WebApp) ⏰", web_app: { url: fullPickerUrl } },
        { text: "🌐 Open in Browser ↗", url: fullPickerUrl }
      ]
    ] : [
      [
        { text: "📱 Open Visual Time Picker (Clock Dial) 🌐", callback_data: `open_flask_ui_${chatId}` }
      ]
    ]),
    // Row 7: Controls
    [
      { text: currentTime === 'none' ? '📴 Reminders are OFF' : '📴 Turn Off Reminders', callback_data: "set_time_none" },
      { text: "↩️ Back to Menu", callback_data: "btn_menu" }
    ]
  ];

  return { inline_keyboard: keyboard };
}

export function getCustomTimePromptText(currentTime: string, draftTime: string, chatId?: number): string {
  const currentFormatted = formatTimeDisplay(currentTime);
  const draftFormatted = formatTimeDisplay(draftTime);
  const appUrl = getAppUrl();
  const isHttps = !!(appUrl && appUrl.startsWith('https://'));
  const fullPickerUrl = (isHttps && chatId)
    ? `${appUrl}/time-picker?chatId=${chatId}&time=${encodeURIComponent(draftTime || '07:00:AM')}`
    : '';

  let text = `⏰ <b>Set Custom Daily Reminder / தனிப்பயன் நினைவூட்டல்:</b>\n\nConfigure your exact custom delivery time in India Standard Time (IST).\n<i>There are <b>no pre-defined fixed times</b> — you can customize to ANY hour and minute!</i>\n\n• <b>Active Schedule:</b> ${currentFormatted}\n• <b>Draft Time:</b> <b>${draftFormatted} (IST)</b>\n\n<b>How to set your customized time:</b>\n1️⃣ Use the <b>interactive buttons</b> below to fine-tune hour & minute.\n2️⃣ Tap <b>📱 Open Visual Time Picker</b> for a graphical circular clock dial.`;

  if (fullPickerUrl) {
    text += `\n🔗 <b>Direct Web Link:</b> <a href="${fullPickerUrl}">Open Visual Clock Dial Picker</a>`;
  }

  text += `\n3️⃣ Or simply <b>type your custom time in chat</b> (e.g. <code>7:15 AM</code>, <code>18:30</code>, <code>6:45 PM</code>, <code>/time 05:20 AM</code>, or <code>none</code>).`;

  return text;
}

// Get the daily index (same Kural for everyone on a given day)
export function getDailyKural(): Kural {
  const dayStamp = Math.floor(Date.now() / 86400000);
  const index = dayStamp % loadedKurals.length;
  return loadedKurals[index];
}

// Unified state-driven bot message handler
export async function handleBotMessage(
  chatId: number,
  text: string,
  username?: string,
  firstName?: string
): Promise<BotResponse> {
  const user = getUser(chatId, { username, firstName });
  if (!user.language) user.language = 'both';
  if (!user.triggerTime) user.triggerTime = '06:00:AM';
  const trimmed = text.trim();

  // 1. Direct custom time input detection (e.g. "7:15 AM", "18:30", "04:30:PM", "7.30 pm", "none")
  const directParsed = parseCustomTimeString(trimmed);
  if (directParsed) {
    if (directParsed === 'none') {
      saveUser(chatId, { triggerTime: 'none', username, firstName });
      return {
        text: `✅ <b>Reminders turned OFF / நினைவூட்டல் நிறுத்தப்பட்டது!</b>\n\nAutomatic daily reminders are now disabled. You can set a customized time anytime with <code>/time</code>.`,
        replyMarkup: {
          inline_keyboard: [
            [{ text: "⏰ Set Custom Time", callback_data: "btn_time_menu" }],
            [{ text: "↩️ Back to Menu", callback_data: "btn_menu" }]
          ]
        }
      };
    } else {
      saveUser(chatId, { triggerTime: directParsed, username, firstName });
      return {
        text: `✅ <b>Custom Reminder Set / நினைவூட்டல் குறிக்கப்பட்டது!</b>\n\nI will send you a daily couplet every day at your exact customized time:\n⏰ <b>${formatTimeDisplay(directParsed)} (IST)</b>\n\n<i>Type /time anytime to change your customized schedule!</i>`,
        replyMarkup: {
          inline_keyboard: [
            [{ text: "⚙️ Adjust Time", callback_data: "btn_time_menu" }],
            [{ text: "↩️ Back to Menu", callback_data: "btn_menu" }]
          ]
        }
      };
    }
  }

  // 2. Handle /time, /timer, /schedule commands with optional custom time argument
  if (trimmed.startsWith('/time') || trimmed.startsWith('/timer') || trimmed.startsWith('/schedule')) {
    const parts = trimmed.split(/\s+/);
    if (parts.length > 1) {
      const timeArg = parts.slice(1).join(' ');
      const parsed = parseCustomTimeString(timeArg);
      if (parsed) {
        if (parsed === 'none') {
          saveUser(chatId, { triggerTime: 'none', username, firstName });
          return {
            text: `✅ <b>Reminders turned OFF / நினைவூட்டல் நிறுத்தப்பட்டது!</b>\n\nAutomatic daily reminders are now disabled.`,
            replyMarkup: { inline_keyboard: [[{ text: "↩️ Back to Menu", callback_data: "btn_menu" }]] }
          };
        } else {
          saveUser(chatId, { triggerTime: parsed, username, firstName });
          return {
            text: `✅ <b>Custom Reminder Set / நினைவூட்டல் குறிக்கப்பட்டது!</b>\n\nI will send you a daily couplet every day at your customized time:\n⏰ <b>${formatTimeDisplay(parsed)} (IST)</b>`,
            replyMarkup: { inline_keyboard: [[{ text: "↩️ Back to Menu", callback_data: "btn_menu" }]] }
          };
        }
      } else {
        const draft = (user.triggerTime && user.triggerTime !== 'none') ? user.triggerTime : '07:00:AM';
        return {
          text: `❌ <b>Invalid Time Format / தவறான நேரம்!</b>\n\nCould not recognize "<code>${timeArg}</code>".\n\nPlease enter a customized time like:\n• <code>07:15 AM</code> or <code>7:30 PM</code>\n• <code>18:30</code> (24-hour format)\n• <code>none</code> to turn off reminders\n\nOr use the interactive custom buttons below:`,
          replyMarkup: getCustomReminderMenuMarkup(user.triggerTime, draft, chatId)
        };
      }
    } else {
      const draft = (user.triggerTime && user.triggerTime !== 'none') ? user.triggerTime : '07:00:AM';
      return {
        text: getCustomTimePromptText(user.triggerTime, draft, chatId),
        replyMarkup: getCustomReminderMenuMarkup(user.triggerTime, draft, chatId)
      };
    }
  }

  // 3. Handle /lang, /language commands and direct language input
  if (trimmed.startsWith('/lang') || trimmed.startsWith('/language')) {
    const parts = trimmed.split(/\s+/);
    if (parts.length > 1) {
      const choice = parts[1].toLowerCase();
      if (['tamil', 'tam', 'ta', 'தமிழ்'].includes(choice)) {
        saveUser(chatId, { language: 'tamil', username, firstName });
        return {
          text: `✅ <b>Language Set / மொழி தேர்வு செய்யப்பட்டது!</b>\n\nFrom now on, I will display Kurals and explanations in <b>Tamil</b> 🪔`,
          replyMarkup: getLanguageMenuMarkup('tamil')
        };
      } else if (['english', 'eng', 'en'].includes(choice)) {
        saveUser(chatId, { language: 'english', username, firstName });
        return {
          text: `✅ <b>Language Set / மொழி தேர்வு செய்யப்பட்டது!</b>\n\nFrom now on, I will display Kurals and translations in <b>English</b> 🇬🇧`,
          replyMarkup: getLanguageMenuMarkup('english')
        };
      } else if (['both', 'all', 'iru', 'இருமொழியும்'].includes(choice)) {
        saveUser(chatId, { language: 'both', username, firstName });
        return {
          text: `✅ <b>Language Set / மொழி தேர்வு செய்யப்பட்டது!</b>\n\nFrom now on, I will display Kurals and details in <b>Both Tamil and English</b> 🌐`,
          replyMarkup: getLanguageMenuMarkup('both')
        };
      }
    }
    return {
      text: `🌐 <b>Select Your Preferred Language / மொழியைத் தேர்ந்தெடுக்கவும்:</b>\n\nCurrent Preference: <b>${(user.language || 'both').toUpperCase()}</b>`,
      replyMarkup: getLanguageMenuMarkup(user.language || 'both')
    };
  }

  if (trimmed.toLowerCase() === 'tamil' || trimmed.toLowerCase() === 'தமிழ்') {
    saveUser(chatId, { language: 'tamil', username, firstName });
    return {
      text: `✅ <b>Language Set / மொழி தேர்வு செய்யப்பட்டது!</b>\n\nFrom now on, I will display Kurals and explanations in <b>Tamil</b> 🪔`,
      replyMarkup: getLanguageMenuMarkup('tamil')
    };
  }
  if (trimmed.toLowerCase() === 'english') {
    saveUser(chatId, { language: 'english', username, firstName });
    return {
      text: `✅ <b>Language Set / மொழி தேர்வு செய்யப்பட்டது!</b>\n\nFrom now on, I will display Kurals and translations in <b>English</b> 🇬🇧`,
      replyMarkup: getLanguageMenuMarkup('english')
    };
  }
  if (trimmed.toLowerCase() === 'both' || trimmed.toLowerCase() === 'இருமொழியும்') {
    saveUser(chatId, { language: 'both', username, firstName });
    return {
      text: `✅ <b>Language Set / மொழி தேர்வு செய்யப்பட்டது!</b>\n\nFrom now on, I will display Kurals and details in <b>Both Tamil and English</b> 🌐`,
      replyMarkup: getLanguageMenuMarkup('both')
    };
  }

  // 1. Handle commands
  if (trimmed === '/start' || trimmed.toLowerCase() === 'menu' || trimmed.toLowerCase() === 'back') {
    return {
      text: `வணக்கம்! Welcome to Daily Thirukkural Bot 🌸\n\nI will fetch and display a Thirukkural couplet with its explanation in Tamil, English, or both daily.\n\n<b>Your Current Settings:</b>\n🌐 Language: <b>${(user.language || 'both').toUpperCase()}</b>\n⏰ Daily Reminder: <b>${user.triggerTime === 'none' ? 'OFF' : user.triggerTime}</b>\n\nUse the buttons below to interact with me!`,
      replyMarkup: getMainMenuMarkup()
    };
  }

  if (trimmed === '/random') {
    return await triggerRandomKural(user);
  }

  if (trimmed === '/daily') {
    const kural = getDailyKural();
    return {
      text: `📅 <b>TODAY'S DAILY KURAL / இன்றைய தினசரி குறள்</b>\n\n${formatKural(kural, user.language || 'both')}`,
      replyMarkup: {
        inline_keyboard: [[{ text: "↩️ Back to Menu", callback_data: "btn_menu" }]]
      }
    };
  }

  // 2. Handle Search Queries
  // Check if search query is a number (ID)
  const idNum = parseInt(trimmed, 10);
  if (!isNaN(idNum)) {
    if (idNum < 1 || idNum > 1330) {
      return {
        text: `❌ <b>Invalid Kural Number / தவறான எண்!</b>\n\nThirukkural contains exactly 1330 couplets. Please enter a number between <b>1 and 1330</b>.`,
        replyMarkup: {
          inline_keyboard: [[{ text: "↩️ Back to Menu", callback_data: "btn_menu" }]]
        }
      };
    }

    const kural = await fetchKuralFromAI(idNum);
    if (kural) {
      return {
        text: `🔍 <b>Kural Found / குறள் கிடைத்தது!</b>\n\n${formatKural(kural, user.language || 'both')}`,
        replyMarkup: {
          inline_keyboard: [
            [
              { text: "🎲 Another Random", callback_data: "btn_random" },
              { text: "↩️ Back to Menu", callback_data: "btn_menu" }
            ]
          ]
        }
      };
    } else {
      return {
        text: `❌ <b>Kural Not Found / குறள் கிடைக்கவில்லை!</b>\n\nWe couldn't retrieve Kural ${idNum}. Let's search by text instead.`,
        replyMarkup: {
          inline_keyboard: [[{ text: "↩️ Back to Menu", callback_data: "btn_menu" }]]
        }
      };
    }
  }

  // Handle text-based search (Search by adhigaram, transliteration, english, or explanation)
  const queryLower = trimmed.toLowerCase();
  let searchResults = loadedKurals.filter(k => 
    k.adhigaram.toLowerCase().includes(queryLower) ||
    k.vilakam.toLowerCase().includes(queryLower) ||
    k.transliteration.toLowerCase().includes(queryLower) ||
    k.english.toLowerCase().includes(queryLower) ||
    k.paaal.toLowerCase().includes(queryLower)
  );

  if (searchResults.length > 0) {
    // Return first match but mention total matches
    const firstMatch = searchResults[0];
    const matchCountMsg = searchResults.length > 1 
      ? `\n\n<i>(Found ${searchResults.length} matches. Showing first match for "${trimmed}")</i>` 
      : '';
    return {
      text: `🔍 <b>Search Result / தேடல் முடிவுகள்:</b>\n\n${formatKural(firstMatch, user.language || 'both')}${matchCountMsg}`,
      replyMarkup: {
        inline_keyboard: [
          [
            { text: "🎲 Random Kural", callback_data: "btn_random" },
            { text: "↩️ Back to Menu", callback_data: "btn_menu" }
          ]
        ]
      }
    };
  }

  // If search matches nothing
  return {
    text: `❓ <b>Search Help / தேடல் விளக்கம்:</b>\n\nTo search for a Kural, simply send:\n• A Kural number (<b>1 to 1330</b>) (e.g. <code>391</code>)\n• A word in Tamil (e.g., <b>கடவுள்</b> or <b>அன்பு</b>)\n• A word in English (e.g., <b>rain</b> or <b>learn</b>)\n\nWe couldn't find any results for "${trimmed}". Let's try again!`,
    replyMarkup: {
      inline_keyboard: [
        [
          { text: "🎲 Random Kural", callback_data: "btn_random" },
          { text: "↩️ Back to Menu", callback_data: "btn_menu" }
        ]
      ]
    }
  };
}

// Triggers a random Kural excluding Inbam (Aram and Porul only)
async function triggerRandomKural(user: BotUser): Promise<BotResponse> {
  const randomId = Math.floor(Math.random() * 1330) + 1;
  const kural = await fetchKuralFromAI(randomId);

  if (kural && kural.paaal !== "காமத்துப்பால்") {
    return {
      text: `🎲 <b>RANDOM KURAL / ரேண்டம் குறள் (1-1330)</b>\n\n${formatKural(kural, user.language || 'both')}`,
      replyMarkup: {
        inline_keyboard: [
          [
            { text: "🎲 Another Random", callback_data: "btn_random" },
            { text: "↩️ Back to Menu", callback_data: "btn_menu" }
          ]
        ]
      }
    };
  } else {
    // Fallback to local random if AI fails or picks Inbam (and we want to exclude Inbam)
    const filtered = loadedKurals.filter(k => k.paaal !== "காமத்துப்பால்");
    const randomIndex = Math.floor(Math.random() * filtered.length);
    const randomKural = filtered[randomIndex];

    return {
      text: `🎲 <b>RANDOM KURAL / ரேண்டம் குறள்</b>\n\n${formatKural(randomKural, user.language || 'both')}`,
      replyMarkup: {
        inline_keyboard: [
          [
            { text: "🎲 Another Random", callback_data: "btn_random" },
            { text: "↩️ Back to Menu", callback_data: "btn_menu" }
          ]
        ]
      }
    };
  }
}

// Unified button click / callback handler
export async function handleBotCallback(
  chatId: number, 
  callbackData: string,
  username?: string,
  firstName?: string
): Promise<BotResponse> {
  const user = getUser(chatId, { username, firstName });
  if (!user.language) user.language = 'both';
  if (!user.triggerTime) user.triggerTime = '06:00:AM';

  // Dynamic path handlers
  if (callbackData.startsWith('find_sec_')) {
    const secKey = callbackData; // find_sec_aram, find_sec_porul, find_sec_inbam
    const sectionMap: Record<string, "அறத்துப்பால்" | "பொருட்பால்" | "காமத்துப்பால்"> = {
      find_sec_aram: "அறத்துப்பால்",
      find_sec_porul: "பொருட்பால்",
      find_sec_inbam: "காமத்துப்பால்"
    };
    const sectionName = sectionMap[secKey] || "அறத்துப்பால்";
    
    // Retrieve all chapters belonging to this section from the full 133 list
    const adhigaramsList = chapters.filter(c => c.section === sectionName);

    const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
    for (let i = 0; i < adhigaramsList.length; i += 2) {
      const row = adhigaramsList.slice(i, i + 2).map(adh => ({
        text: `${adh.name}`,
        callback_data: `find_adh_${adh.id}`
      }));
      buttons.push(row);
    }
    buttons.push([{ text: "↩️ Back to Sections", callback_data: "btn_search" }]);

    return {
      text: `📂 <b>${sectionName} - Chapters / அதிகாரங்கள்:</b>\n\nChoose an Adhigaram (Chapter) from this section:`,
      replyMarkup: { inline_keyboard: buttons }
    };
  }

  if (callbackData.startsWith('find_adh_')) {
    const adhigaramId = parseInt(callbackData.split('_')[2], 10);
    const chapterObj = chapters.find(c => c.id === adhigaramId);
    if (!chapterObj) {
      return {
        text: `❌ Chapter not found in database.`,
        replyMarkup: { inline_keyboard: [[{ text: "↩️ Back to Sections", callback_data: "btn_search" }]] }
      };
    }
    const adhigaramName = chapterObj.name;
    const parentSection = chapterObj.section;
    const parentSectionCallback = parentSection === "அறத்துப்பால்" ? "find_sec_aram" : (parentSection === "பொருட்பால்" ? "find_sec_porul" : "find_sec_inbam");

    // Construct the 10 Kural IDs belonging to this chapter dynamically
    const startKuralId = (adhigaramId - 1) * 10 + 1;
    const endKuralId = adhigaramId * 10;
    const kuralButtons: Array<Array<{ text: string; callback_data: string }>> = [];
    
    // Arrange in rows of 3
    for (let i = startKuralId; i <= endKuralId; i += 3) {
      const row = [];
      for (let j = 0; j < 3 && (i + j) <= endKuralId; j++) {
        const kId = i + j;
        row.push({
          text: `குறள் ${kId}`,
          callback_data: `find_kur_${kId}`
        });
      }
      kuralButtons.push(row);
    }
    kuralButtons.push([{ text: `↩️ Back to Chapters`, callback_data: parentSectionCallback }]);

    return {
      text: `📖 <b>அதிகாரம்: ${adhigaramName}</b>\n(Section: ${parentSection})\n\nSelect a Kural number to view:`,
      replyMarkup: { inline_keyboard: kuralButtons }
    };
  }

  if (callbackData.startsWith('find_kur_')) {
    const kuralId = parseInt(callbackData.split('_')[2], 10);
    const kural = await fetchKuralFromAI(kuralId);
    if (!kural) {
      return {
        text: `❌ Kural not found in database or AI retrieval failed.`,
        replyMarkup: { inline_keyboard: [[{ text: "↩️ Back to Sections", callback_data: "btn_search" }]] }
      };
    }
    const parentAdhId = kural.adhigaram_id;

    return {
      text: `✨ <b>Kural Found / குறள் கிடைத்தது!</b>\n\n${formatKural(kural, user.language || 'both')}`,
      replyMarkup: {
        inline_keyboard: [
          [
            { text: `↩️ Back to Chapter`, callback_data: `find_adh_${parentAdhId}` },
            { text: "↩️ Back to Menu", callback_data: "btn_menu" }
          ]
        ]
      }
    };
  }

  // Custom time builder steppers (draft_time_HH_MM_AM/PM)
  if (callbackData.startsWith('draft_time_')) {
    const parts = callbackData.replace('draft_time_', '').split('_');
    const h = parts[0] || '07';
    const m = parts[1] || '00';
    const ap = parts[2] || 'AM';
    const newDraft = `${h}:${m}:${ap}`;
    return {
      text: getCustomTimePromptText(user.triggerTime, newDraft, chatId),
      replyMarkup: getCustomReminderMenuMarkup(user.triggerTime, newDraft, chatId)
    };
  }

  // Confirm custom time (set_custom_HH:MM:AM or set_time_...)
  if (callbackData.startsWith('set_custom_') || callbackData.startsWith('set_time_')) {
    const time = callbackData.replace('set_custom_', '').replace('set_time_', '');
    if (time === 'none') {
      saveUser(chatId, { triggerTime: 'none', username, firstName });
      return {
        text: `✅ <b>Reminders turned OFF / நினைவூட்டல் நிறுத்தப்பட்டது!</b>\n\nAutomatic daily reminders are now disabled. You can still fetch couplets manually with /daily or /random.`,
        replyMarkup: getCustomReminderMenuMarkup('none', '07:00:AM', chatId)
      };
    } else {
      saveUser(chatId, { triggerTime: time, username, firstName });
      return {
        text: `✅ <b>Custom Reminder Set / நினைவூட்டல் குறிக்கப்பட்டது!</b>\n\nI will send you a daily couplet every day at your exact customized time:\n⏰ <b>${formatTimeDisplay(time)} (IST)</b>\n\n<i>You can re-adjust anytime using /time or the menu!</i>`,
        replyMarkup: getCustomReminderMenuMarkup(time, time, chatId)
      };
    }
  }

  // Open Flask UI fallback or web app instructions
  if (callbackData.startsWith('open_flask_ui_')) {
    const appUrl = getAppUrl();
    const curDraft = (user.triggerTime && user.triggerTime !== 'none') ? user.triggerTime : '07:00:AM';
    const isHttps = !!(appUrl && appUrl.startsWith('https://'));
    const fullPickerUrl = isHttps 
      ? `${appUrl}/time-picker?chatId=${chatId}&time=${encodeURIComponent(curDraft)}`
      : '';

    const buttons: Array<Array<{ text: string; url?: string; callback_data?: string; web_app?: { url: string } }>> = [];
    if (fullPickerUrl && fullPickerUrl.startsWith('https://')) {
      buttons.push([
        { text: "📱 Open Visual Time Picker (WebApp) ⏰", web_app: { url: fullPickerUrl } },
        { text: "🌐 Open in Browser ↗", url: fullPickerUrl }
      ]);
    }
    buttons.push([{ text: "↩️ Back to Time Stepper", callback_data: "btn_time_menu" }]);

    return {
      text: `📱 <b>Visual Time Picker (Clock Dial UI)</b>\n\nOpen the interactive circular analog clock dial to set your exact customized reminder time:\n\n${fullPickerUrl ? `🔗 <b>Direct Link:</b> <a href="${fullPickerUrl}">Open Visual Clock Dial</a>\n\n` : ''}<i>Tip: You can also use the step buttons (+1h, -5m) in the previous menu or simply type your custom time in chat anytime (e.g. <code>7:15 AM</code>, <code>18:30</code>, or <code>none</code>).</i>`,
      replyMarkup: { inline_keyboard: buttons }
    };
  }

  switch (callbackData) {
    case 'btn_menu':
      return {
        text: `வணக்கம்! Welcome to Daily Thirukkural Bot 🌸\n\nI will fetch and display a Thirukkural couplet with its explanation in Tamil, English, or both daily.\n\n<b>Your Current Settings:</b>\n🌐 Language: <b>${(user.language || 'both').toUpperCase()}</b>\n⏰ Daily Reminder: <b>${formatTimeDisplay(user.triggerTime)}</b>\n\nUse the buttons below to interact with me!`,
        replyMarkup: getMainMenuMarkup()
      };

    case 'btn_daily': {
      const kural = getDailyKural();
      return {
        text: `📅 <b>TODAY'S DAILY KURAL / இன்றைய தினசரி குறள்</b>\n\n${formatKural(kural, user.language || 'both')}`,
        replyMarkup: {
          inline_keyboard: [[{ text: "↩️ Back to Menu", callback_data: "btn_menu" }]]
        }
      };
    }

    case 'btn_random':
      return await triggerRandomKural(user);

    case 'btn_search':
      return {
        text: `🔍 <b>Choose Section / பால் தேர்வு செய்க:</b>\n\nExplore Thirukkural by navigating through Sections, Chapters, and Kural numbers:\n\n• <b>அறத்துப்பால் (Aram)</b>: Virtue\n• <b>பொருட்பால் (Porul)</b>: Wealth / Polity\n• <b>காமத்துப்பால் (Inbam)</b>: Love`,
        replyMarkup: getSectionMenuMarkup()
      };

    case 'btn_lang_menu':
      return {
        text: `🌐 <b>Set Language Preference / மொழி தேர்வு:</b>\n\nChoose your preferred display language for Kurals and explanations:\n\n• <b>Tamil</b>: Tamil Couplet & Explanation\n• <b>English</b>: English Transliteration & Translation\n• <b>Both</b>: Full Tamil & English details\n\nYour current preference: <b>${(user.language || 'both').toUpperCase()}</b>`,
        replyMarkup: getLanguageMenuMarkup(user.language || 'both')
      };

    case 'btn_time_menu': {
      const draft = (user.triggerTime && user.triggerTime !== 'none') ? user.triggerTime : '07:00:AM';
      return {
        text: getCustomTimePromptText(user.triggerTime, draft, chatId),
        replyMarkup: getCustomReminderMenuMarkup(user.triggerTime, draft, chatId)
      };
    }

    case 'set_lang_tamil':
      saveUser(chatId, { language: 'tamil', username, firstName });
      return {
        text: `✅ <b>Language Set / மொழி தேர்வு செய்யப்பட்டது!</b>\n\nFrom now on, I will display Kurals and explanations in <b>Tamil</b> 🪔`,
        replyMarkup: getLanguageMenuMarkup('tamil')
      };

    case 'set_lang_english':
      saveUser(chatId, { language: 'english', username, firstName });
      return {
        text: `✅ <b>Language Set / மொழி தேர்வு செய்யப்பட்டது!</b>\n\nFrom now on, I will display Kurals and translations in <b>English</b> 🇬🇧`,
        replyMarkup: getLanguageMenuMarkup('english')
      };

    case 'set_lang_both':
      saveUser(chatId, { language: 'both', username, firstName });
      return {
        text: `✅ <b>Language Set / மொழி தேர்வு செய்யப்பட்டது!</b>\n\nFrom now on, I will display Kurals and details in <b>Both Tamil and English</b> 🌐`,
        replyMarkup: getLanguageMenuMarkup('both')
      };

    default:
      return {
        text: `I'm not sure how to handle this action. Let's go back to the Main Menu!`,
        replyMarkup: getMainMenuMarkup()
      };
  }
}

// Real Telegram API interaction helper functions
function sanitizeTelegramMarkup(markup: any, allowWebApp: boolean = true): any {
  if (!markup || !markup.inline_keyboard) return markup;
  const cloned = JSON.parse(JSON.stringify(markup));
  if (Array.isArray(cloned.inline_keyboard)) {
    for (const row of cloned.inline_keyboard) {
      if (Array.isArray(row)) {
        for (const btn of row) {
          if (btn.web_app) {
            let webAppUrl = btn.web_app.url || '';
            if (webAppUrl.startsWith('http://')) {
              webAppUrl = 'https://' + webAppUrl.slice(7);
            }
            if (allowWebApp && webAppUrl.startsWith('https://')) {
              btn.web_app = { url: webAppUrl };
            } else {
              // Telegram strictly rejects non-https web_app links
              delete btn.web_app;
              if (webAppUrl.startsWith('https://') || webAppUrl.startsWith('http://')) {
                btn.url = webAppUrl;
              } else if (!btn.callback_data && !btn.url) {
                btn.callback_data = 'btn_time_menu';
              }
            }
          }
        }
      }
    }
  }
  return cloned;
}

export async function sendTelegramMessage(token: string, chatId: number, response: BotResponse): Promise<{ ok: boolean; messageId?: number; error?: string }> {
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const sanitizedMarkup = sanitizeTelegramMarkup(response.replyMarkup, true);
    const payload: any = {
      chat_id: chatId,
      text: response.text,
      parse_mode: 'HTML',
      reply_markup: sanitizedMarkup ? JSON.stringify(sanitizedMarkup) : undefined
    };
    
    let res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });
    
    if (!res.ok) {
      let errText = await res.text();
      const classification = classifyTelegramError(null, res.status, errText);
      console.error(`Error sending Telegram message to chat ${chatId} [${classification.category}]: ${classification.description}`);
      
      // If error is related to Web App URL or bad inline keyboard, retry with web_app stripped
      if (errText.includes('Web App') || errText.includes('Only HTTPS links are allowed') || errText.includes('BUTTON_URL_INVALID')) {
        console.log(`⚠️ Retrying Telegram sendMessage without web_app button for chat ${chatId}...`);
        const fallbackMarkup = sanitizeTelegramMarkup(response.replyMarkup, false);
        payload.reply_markup = fallbackMarkup ? JSON.stringify(fallbackMarkup) : undefined;
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000)
        });
        if (!res.ok) {
          errText = await res.text();
          const fallbackClass = classifyTelegramError(null, res.status, errText);
          console.error(`Retry without web_app also failed for chat ${chatId} [${fallbackClass.category}]: ${fallbackClass.description}`);
          return { ok: false, error: `${fallbackClass.category}: ${fallbackClass.description}` };
        }
      } else if (errText.includes("can't parse entities")) {
        // Fallback for HTML entity parsing issues
        delete payload.parse_mode;
        res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(15000)
        });
        if (!res.ok) {
          errText = await res.text();
          return { ok: false, error: errText };
        }
      } else {
        return { ok: false, error: `${classification.category}: ${classification.description}` };
      }
    }

    const data: any = await res.json().catch(() => null);
    return { ok: true, messageId: data?.result?.message_id };
  } catch (err: any) {
    const classification = classifyTelegramError(err);
    console.error(`Failed to send Telegram message to chat ${chatId} [${classification.category}]: ${classification.description}`);
    return { ok: false, error: `${classification.category}: ${classification.description} (${err?.message || ''})` };
  }
}

// Helper to get current date formatted in India Standard Time (IST) YYYY-MM-DD
export function getISTDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date);
}

// Helper to get time formatted in India Standard Time (IST) "07:40 AM"
export function getISTTimeString(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
    const parts = formatter.formatToParts(date);
    let hour = '';
    let minute = '';
    let dayPeriod = 'AM';
    for (const part of parts) {
      if (part.type === 'hour') hour = part.value;
      if (part.type === 'minute') minute = part.value;
      if (part.type === 'dayPeriod') dayPeriod = part.value;
    }
    hour = hour.padStart(2, '0');
    minute = minute.padStart(2, '0');
    const ampm = dayPeriod.toUpperCase();
    return `${hour}:${minute} ${ampm}`;
  } catch (err) {
    console.error("Error formatting IST time:", err);
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hoursStr = String(hours).padStart(2, '0');
    return `${hoursStr}:${minutes} ${ampm}`;
  }
}

// Re-export parseTimeMinutes from db for backwards compatibility
export { parseTimeMinutes };

/**
 * Determines whether a user's configured reminder is eligible for delivery during the current tick.
 * Supports exact minute match (0-min lag) and a 1-to-2 minute bounded catch-up window (maxLag = 2).
 * Handles minute rollover around midnight (00:00 vs 23:59).
 */
export function isReminderDueInWindow(
  nowMinutes: number,
  userMinutes: number,
  maxLagMinutes: number = 2
): { isDue: boolean; isCatchUp: boolean; lagMinutes: number } {
  let diff = nowMinutes - userMinutes;
  // Handle cross-midnight wrap (e.g. 00:01 AM tick for a 11:59 PM scheduled reminder)
  if (diff < -720) {
    diff += 1440;
  } else if (diff > 720) {
    diff -= 1440;
  }
  // If tick arrived within [0 .. maxLagMinutes] after the trigger time
  if (diff >= 0 && diff <= maxLagMinutes) {
    return { isDue: true, isCatchUp: diff > 0, lagMinutes: diff };
  }
  return { isDue: false, isCatchUp: false, lagMinutes: diff };
}

/**
 * Validates external scheduler authentication against configured SCHEDULER_SECRET.
 * Accepts header ('x-scheduler-secret' or 'authorization: Bearer <secret>'), query param ('?secret='),
 * or JSON body ('{ secret: "..." }').
 * If no secret is configured in environment, returns true (open by default).
 */
export function validateSchedulerAuth(
  headers: Record<string, string | string[] | undefined> = {},
  queryOrBodySecret?: string,
  configuredSecret: string | undefined = process.env.SCHEDULER_SECRET
): boolean {
  if (!configuredSecret || configuredSecret.trim() === '') {
    return true; // No secret configured; allow open requests
  }

  const rawHeaderSecret = headers['x-scheduler-secret'];
  const headerSecret = typeof rawHeaderSecret === 'string'
    ? rawHeaderSecret.trim()
    : Array.isArray(rawHeaderSecret)
      ? rawHeaderSecret[0]?.trim()
      : undefined;

  const rawAuthHeader = headers['authorization'];
  const authHeader = typeof rawAuthHeader === 'string' ? rawAuthHeader.trim() : undefined;
  const bearerSecret = authHeader && authHeader.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : undefined;

  const candidate = headerSecret || (queryOrBodySecret ? String(queryOrBodySecret).trim() : undefined) || bearerSecret;
  return candidate === configuredSecret.trim();
}

export interface ScheduledTickResult {
  timeString: string;
  dateString: string;
  source: string;
  evaluatedCount: number;
  dueCount: number;
  normalMatchesCount: number;
  catchUpMatchesCount: number;
  claimedCount: number;
  deliveredCount: number;
  failedCount: number;
  skippedCount: number;
  details: Array<{
    chatId: number;
    username?: string;
    status: 'DELIVERED' | 'FAILED' | 'SKIPPED';
    reason?: string;
    kuralNumber?: number;
    isCatchUp?: boolean;
    lagMinutes?: number;
  }>;
}

export async function processScheduledRemindersTick(
  token: string | undefined,
  customTimeString?: string,
  source: 'cloud_scheduler' | 'local_interval' | 'manual_test' | string = 'cloud_scheduler',
  customDateString?: string
): Promise<ScheduledTickResult> {
  const hasToken = token && token !== 'MY_TELEGRAM_BOT_TOKEN' && token.trim() !== '';
  const timeString = customTimeString || getISTTimeString();
  const dateString = customDateString || getISTDateString();

  const currentMinutes = parseTimeMinutes(timeString);
  const users = getAllUsers();

  interface CandidateUser {
    user: BotUser;
    isCatchUp: boolean;
    lagMinutes: number;
  }

  const dueCandidates: CandidateUser[] = [];
  let normalMatches = 0;
  let catchUpMatches = 0;

  for (const user of users) {
    if (!user.triggerTime || user.triggerTime === 'none') continue;

    if (currentMinutes !== null) {
      const userMinutes = parseTimeMinutes(user.triggerTime);
      if (userMinutes !== null) {
        const { isDue, isCatchUp, lagMinutes } = isReminderDueInWindow(currentMinutes, userMinutes, 2);
        if (isDue) {
          dueCandidates.push({ user, isCatchUp, lagMinutes });
          if (isCatchUp) catchUpMatches++;
          else normalMatches++;
        }
      }
    }
  }

  const result: ScheduledTickResult = {
    timeString,
    dateString,
    source,
    evaluatedCount: users.length,
    dueCount: dueCandidates.length,
    normalMatchesCount: normalMatches,
    catchUpMatchesCount: catchUpMatches,
    claimedCount: 0,
    deliveredCount: 0,
    failedCount: 0,
    skippedCount: 0,
    details: []
  };

  if (dueCandidates.length === 0) {
    recordSchedulerTick(timeString, null, {
      evaluatedCount: users.length,
      normalMatchesCount: 0,
      catchUpMatchesCount: 0,
      claimedCount: 0,
      skippedCount: 0,
      source
    });
    return result;
  }

  // If bot service has been paused/stopped by admin, skip all deliveries safely
  if (isBotServiceStopped) {
    const stoppedResult: ScheduledTickResult = {
      timeString,
      dateString,
      source,
      evaluatedCount: users.length,
      dueCount: dueCandidates.length,
      normalMatchesCount: normalMatches,
      catchUpMatchesCount: catchUpMatches,
      claimedCount: 0,
      deliveredCount: 0,
      failedCount: 0,
      skippedCount: dueCandidates.length,
      details: dueCandidates.map(c => ({
        chatId: c.user.chatId,
        username: c.user.username,
        status: 'SKIPPED',
        reason: 'Bot service is stopped',
        isCatchUp: c.isCatchUp,
        lagMinutes: c.lagMinutes
      }))
    };
    recordSchedulerTick(timeString, null, {
      evaluatedCount: users.length,
      normalMatchesCount: normalMatches,
      catchUpMatchesCount: catchUpMatches,
      claimedCount: 0,
      skippedCount: dueCandidates.length,
      source
    });
    return stoppedResult;
  }

  const dailyKural = getDailyKural();

  for (const candidate of dueCandidates) {
    const user = candidate.user;
    // 1. Atomic date-specific claim check in Firestore (YYYY-MM-DD + chatId + triggerTime)
    const claim = await claimReminderDeliveryAtomic(user.chatId, dateString, user.triggerTime);
    if (!claim.claimed) {
      result.skippedCount++;
      result.details.push({
        chatId: user.chatId,
        username: user.username,
        status: 'SKIPPED',
        reason: claim.reason || 'Already processed or in-flight',
        isCatchUp: candidate.isCatchUp,
        lagMinutes: candidate.lagMinutes
      });
      continue;
    }

    result.claimedCount++;

    const catchUpNotice = candidate.isCatchUp ? ` (tolerance window: +${candidate.lagMinutes}m)` : '';
    const response: BotResponse = {
      text: `📅 <b>DAILY REMINDER / தினசரி நினைவூட்டல்</b>\n\n${formatKural(dailyKural, user.language || 'both')}`,
      replyMarkup: getMainMenuMarkup()
    };

    // 2. Simulated companion users
    if (user.chatId < 10000000) {
      console.log(`⏰ Reminder [SIMULATED]: Daily couplet to companion user ${user.chatId} at ${timeString} IST${catchUpNotice}`);
      await markReminderDelivered(user.chatId, dateString, user.triggerTime, dailyKural.id);
      addActivityLog(user.chatId, user.username || user.firstName || `User ${user.chatId}`, 'outgoing', `📅 DAILY REMINDER: ${dailyKural.english}`, 'info');
      result.deliveredCount++;
      result.details.push({
        chatId: user.chatId,
        username: user.username,
        status: 'DELIVERED',
        kuralNumber: dailyKural.id,
        isCatchUp: candidate.isCatchUp,
        lagMinutes: candidate.lagMinutes
      });
    } else if (hasToken) {
      // 3. Real Telegram user delivery
      console.log(`⏰ Reminder [REAL]: Sending daily couplet to Telegram user ${user.chatId} at ${timeString} IST${catchUpNotice}`);
      const sendResult = await sendTelegramMessage(token!, user.chatId, response);
      if (sendResult.ok) {
        await markReminderDelivered(user.chatId, dateString, user.triggerTime, dailyKural.id, sendResult.messageId);
        addActivityLog(user.chatId, user.username || user.firstName || `User ${user.chatId}`, 'outgoing', `📅 DAILY REMINDER (Delivered via Telegram #${sendResult.messageId || ''})`, 'info');
        result.deliveredCount++;
        result.details.push({
          chatId: user.chatId,
          username: user.username,
          status: 'DELIVERED',
          kuralNumber: dailyKural.id,
          isCatchUp: candidate.isCatchUp,
          lagMinutes: candidate.lagMinutes
        });
      } else {
        await markReminderFailed(user.chatId, dateString, user.triggerTime, sendResult.error || 'Telegram send failure');
        addActivityLog(user.chatId, user.username || user.firstName || `User ${user.chatId}`, 'system', `Failed sending reminder: ${sendResult.error}`, 'error');
        result.failedCount++;
        result.details.push({
          chatId: user.chatId,
          username: user.username,
          status: 'FAILED',
          reason: sendResult.error,
          isCatchUp: candidate.isCatchUp,
          lagMinutes: candidate.lagMinutes
        });
      }
    } else {
      await markReminderFailed(user.chatId, dateString, user.triggerTime, 'TELEGRAM_BOT_TOKEN not configured on server');
      result.failedCount++;
      result.details.push({
        chatId: user.chatId,
        username: user.username,
        status: 'FAILED',
        reason: 'TELEGRAM_BOT_TOKEN not configured',
        isCatchUp: candidate.isCatchUp,
        lagMinutes: candidate.lagMinutes
      });
    }
  }

  recordSchedulerTick(timeString, null, {
    evaluatedCount: users.length,
    normalMatchesCount: normalMatches,
    catchUpMatchesCount: catchUpMatches,
    claimedCount: result.claimedCount,
    skippedCount: result.skippedCount
  });

  if (result.deliveredCount > 0) {
    addActivityLog(0, 'system', 'system', `Scheduler processed daily reminders: ${result.deliveredCount} delivered, ${result.failedCount} failed (${source})`, 'info');
  }

  return result;
}

let activeSchedulerTimer: NodeJS.Timeout | null = null;
let lastOpportunisticTickTimestamp = 0;

// Cleanly stop the background reminder scheduler timer
export function stopReminderScheduler(): void {
  if (activeSchedulerTimer) {
    clearInterval(activeSchedulerTimer);
    activeSchedulerTimer = null;
  }
  setSchedulerLifecycleState(Date.now(), false);
  console.log("⏰ In-Process Reminder Scheduler: Stopped.");
}

// Background scheduler for daily reminders with singleton protection and lifecycle tracking
export function startReminderScheduler(token: string | undefined): void {
  // If an existing timer was already running, clear it to avoid duplicate timers
  if (activeSchedulerTimer) {
    clearInterval(activeSchedulerTimer);
    activeSchedulerTimer = null;
  }

  const now = Date.now();
  setSchedulerLifecycleState(now, true, now);

  const hasToken = token && token !== 'MY_TELEGRAM_BOT_TOKEN' && token.trim() !== '';
  if (hasToken) {
    console.log("⏰ In-Process Reminder Scheduler: Initialized (IST Timezone, 60s interval).");
  } else {
    console.log("⏰ In-Process Reminder Scheduler: Initialized for Simulated Companion users (IST Timezone).");
  }

  // 1. Immediately evaluate any reminder currently due on startup / restart (catch-up window: +0m, +1m, +2m)
  processScheduledRemindersTick(token, undefined, 'startup_init').catch(err => {
    console.warn("Startup reminder evaluation notice:", err?.message || err);
  });
  
  // 2. Schedule recurring 60-second in-process heartbeat interval
  activeSchedulerTimer = setInterval(async () => {
    if (isBotServiceStopped) {
      return;
    }
    try {
      recordSchedulerHeartbeat('local_interval');
      await processScheduledRemindersTick(token, undefined, 'local_interval');
    } catch (err: any) {
      console.error("Error in fallback reminder scheduler interval:", err?.message || err);
    }
  }, 60000);
}

/**
 * Opportunistically checks for due reminders when HTTP traffic (webhook/ping/page load) arrives.
 * Throttled to execute at most once every 30 seconds to prevent unnecessary database load.
 */
export async function opportunisticReminderCheck(token?: string): Promise<void> {
  const now = Date.now();
  if (isBotServiceStopped) return;
  if (now - lastOpportunisticTickTimestamp < 30000) {
    return; // Throttled
  }
  lastOpportunisticTickTimestamp = now;
  recordSchedulerHeartbeat('opportunistic_traffic');
  try {
    await processScheduledRemindersTick(token, undefined, 'opportunistic_traffic');
  } catch (err: any) {
    console.warn("Opportunistic reminder check notice:", err?.message || err);
  }
}

// Simple polling bot loop for production/deployment
// Bot runtime telemetry & connection state
export interface TelegramBotState {
  isConnected: boolean;
  botInfo: { id: number; username: string; firstName: string } | null;
  mode: 'polling' | 'webhook' | 'stopped' | 'uninitialized';
  lastPollTimestamp: number;
  lastSuccessfulUpdateId: number;
  consecutiveErrors: number;
  lastErrorMessage: string | null;
  initAttempts: number;
}

let botState: TelegramBotState = {
  isConnected: false,
  botInfo: null,
  mode: 'uninitialized',
  lastPollTimestamp: 0,
  lastSuccessfulUpdateId: 0,
  consecutiveErrors: 0,
  lastErrorMessage: null,
  initAttempts: 0
};

let activePollerAbortController: AbortController | null = null;

export function getTelegramBotState(): TelegramBotState {
  return { ...botState };
}

// Token-safe logger that replaces bot token strings with [REDACTED]
export function maskToken(str: string): string {
  if (!str) return '';
  return str.replace(/\/bot[0-9]+:[a-zA-Z0-9_-]+/g, '/bot[REDACTED]');
}

export type TelegramErrorCategory = 
  | 'INVALID_TOKEN' 
  | 'WEBHOOK_CONFLICT' 
  | 'BLOCKED_BY_USER' 
  | 'TIMEOUT' 
  | 'DNS_NETWORK_FAILURE' 
  | 'CONNECTION_RESET' 
  | 'TELEGRAM_API_ERROR' 
  | 'HTTP_ERROR';

export interface TelegramErrorClassification {
  category: TelegramErrorCategory;
  description: string;
  statusCode?: number;
}

export function classifyTelegramError(err: any, status?: number, body?: string): TelegramErrorClassification {
  if (status === 401 || (body && body.includes('Unauthorized'))) {
    return { category: 'INVALID_TOKEN', description: 'Invalid Telegram Bot Token (401 Unauthorized)', statusCode: 401 };
  }
  if (status === 409 || (body && (body.includes('Conflict') || body.includes("can't use getUpdates")))) {
    return { category: 'WEBHOOK_CONFLICT', description: 'Webhook conflict: webhook is active while polling (409 Conflict)', statusCode: 409 };
  }
  if (status === 403 || (body && (body.includes('bot was blocked') || body.includes('user is deactivated') || body.includes('chat not found')))) {
    return { category: 'BLOCKED_BY_USER', description: 'Bot was blocked by user or chat is not accessible (403 Forbidden)', statusCode: 403 };
  }

  const errCode = err?.cause?.code || err?.code || '';
  const errMsg = String(err?.message || err || '');

  if (err?.name === 'TimeoutError' || err?.name === 'AbortError' || errCode === 'ETIMEDOUT' || errCode === 'UND_ERR_CONNECT_TIMEOUT' || errMsg.toLowerCase().includes('timeout')) {
    return { category: 'TIMEOUT', description: `Request timed out (${errCode || 'Timeout'})` };
  }
  if (errCode === 'ENOTFOUND' || errCode === 'EAI_AGAIN' || errCode === 'UND_ERR_RESOLVE_HOST') {
    return { category: 'DNS_NETWORK_FAILURE', description: `DNS resolution failure (${errCode})` };
  }
  if (errCode === 'ECONNRESET' || errCode === 'ECONNREFUSED') {
    return { category: 'CONNECTION_RESET', description: `TCP connection reset or refused (${errCode})` };
  }
  if (status && status >= 400) {
    const cleanBody = body ? maskToken(body).substring(0, 150) : '';
    return { category: status >= 500 ? 'HTTP_ERROR' : 'TELEGRAM_API_ERROR', description: `HTTP ${status}: ${cleanBody || 'API response error'}`, statusCode: status };
  }

  return { category: 'DNS_NETWORK_FAILURE', description: maskToken(errMsg) || 'Network fetch failure' };
}

// Unified Telegram update processor for both Poller and Webhook
export async function handleTelegramUpdate(token: string, update: any): Promise<void> {
  if (isBotServiceStopped) {
    console.log("⚠️ Bot service is stopped. Ignoring Telegram update.");
    return;
  }

  try {
    if (update.message) {
      const msg = update.message;
      const chatId = msg.chat.id;
      const username = msg.from?.username;
      const firstName = msg.from?.first_name;

      // Handle Telegram WebApp Data (e.g. from Visual Time Picker)
      if (msg.web_app_data && msg.web_app_data.data) {
        const rawWebAppData = msg.web_app_data.data.trim();
        console.log(`📱 [Telegram Bot] WebApp Data received from ${chatId} (${username || firstName || 'User'}): "${rawWebAppData}"`);
        addActivityLog(chatId, username || firstName || `User ${chatId}`, 'incoming', `WebApp Time Picker: ${rawWebAppData}`);

        const parsedTime = parseCustomTimeString(rawWebAppData);
        if (parsedTime) {
          saveUser(chatId, { triggerTime: parsedTime, username, firstName });
          const response: BotResponse = {
            text: parsedTime === 'none'
              ? `✅ <b>Reminders turned OFF / நினைவூட்டல் நிறுத்தப்பட்டது!</b>\n\nAutomatic daily reminders are now disabled. You can still fetch couplets manually with /daily or /random.`
              : `✅ <b>Custom Reminder Set / நினைவூட்டல் குறிக்கப்பட்டது!</b>\n\nI will send you a daily couplet every day at your exact customized time:\n⏰ <b>${formatTimeDisplay(parsedTime)} (IST)</b>\n\n<i>You can re-adjust anytime using /time or the menu!</i>`,
            replyMarkup: getCustomReminderMenuMarkup(parsedTime, parsedTime, chatId)
          };
          await sendTelegramMessage(token, chatId, response);
          addActivityLog(chatId, username || firstName || `User ${chatId}`, 'outgoing', response.text);
          return;
        }
      }

      const text = msg.text || '';

      console.log(`💬 [Telegram Bot] Message received from ${chatId} (${username || firstName || 'User'}): "${text}"`);
      addActivityLog(chatId, username || firstName || `User ${chatId}`, 'incoming', text);

      const response = await handleBotMessage(chatId, text, username, firstName);
      await sendTelegramMessage(token, chatId, response);

      addActivityLog(chatId, username || firstName || `User ${chatId}`, 'outgoing', response.text);
    } 
    else if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message?.chat?.id || cb.from?.id;
      const cbData = cb.data || '';
      const queryId = cb.id;
      const username = cb.from?.username;
      const firstName = cb.from?.first_name;

      console.log(`🔘 [Telegram Bot] Callback received from ${chatId}: "${cbData}"`);
      addActivityLog(chatId, username || firstName || `User ${chatId}`, 'incoming', `Pressed button: ${cbData}`);

      const response = await handleBotCallback(chatId, cbData, username, firstName);
      await sendTelegramMessage(token, chatId, response);

      addActivityLog(chatId, username || firstName || `User ${chatId}`, 'outgoing', response.text);

      try {
        await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: queryId }),
          signal: AbortSignal.timeout(10000)
        });
      } catch (e) {
        console.error("Failed to answer callback query:", e);
      }
    }
  } catch (err) {
    console.error("Error processing Telegram update:", err);
    addActivityLog(0, 'system', 'system', `Error processing update: ${err instanceof Error ? err.message : err}`, 'error');
  }
}

export async function reconnectTelegramBot(token: string): Promise<{ success: boolean; message: string; botInfo?: any }> {
  console.log("🔄 Telegram Bot: Manual reconnection initiated...");
  if (activePollerAbortController) {
    activePollerAbortController.abort();
    activePollerAbortController = null;
  }
  return startRealTelegramBot(token);
}

export async function startRealTelegramBot(rawToken: string): Promise<{ success: boolean; message: string; botInfo?: any }> {
  const token = rawToken.trim();
  if (!token || token === 'MY_TELEGRAM_BOT_TOKEN') {
    botState.mode = 'uninitialized';
    botState.isConnected = false;
    return { success: false, message: 'TELEGRAM_BOT_TOKEN is missing or placeholder.' };
  }

  // Cancel any existing running poller loop
  if (activePollerAbortController) {
    activePollerAbortController.abort();
    activePollerAbortController = null;
  }

  botState.initAttempts++;
  console.log(`🤖 Telegram Bot: Initializing controller (Attempt #${botState.initAttempts})...`);

  // Step 1: Verify token and test Telegram API connectivity with retry backoff
  let botIdentity: { id: number; username: string; firstName: string } | null = null;
  const maxRetries = 4;
  const backoffDelays = [1500, 3000, 5000, 8000];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const getMeRes = await fetch(`https://api.telegram.org/bot${token}/getMe`, {
        signal: AbortSignal.timeout(10000)
      });

      if (getMeRes.status === 401) {
        const desc = "Telegram API rejected token: 401 Unauthorized. Please verify TELEGRAM_BOT_TOKEN.";
        console.error(`❌ ${desc}`);
        botState.isConnected = false;
        botState.lastErrorMessage = desc;
        addActivityLog(0, 'system', 'system', desc, 'error');
        return { success: false, message: desc };
      }

      if (getMeRes.ok) {
        const getMeData: any = await getMeRes.json();
        if (getMeData.ok && getMeData.result) {
          botIdentity = {
            id: getMeData.result.id,
            username: getMeData.result.username || '',
            firstName: getMeData.result.first_name || 'Bot'
          };
          botState.botInfo = botIdentity;
          botState.isConnected = true;
          botState.lastErrorMessage = null;
          botState.consecutiveErrors = 0;
          console.log(`✅ Telegram Bot authenticated successfully: @${botIdentity.username} (ID: ${botIdentity.id})`);
          break;
        }
      }
    } catch (err: any) {
      const classification = classifyTelegramError(err);
      console.warn(`⏳ Telegram Bot connection attempt ${attempt + 1}/${maxRetries + 1} failed [${classification.category}]: ${classification.description}`);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, backoffDelays[attempt]));
      } else {
        const failureReason = `Failed to connect to Telegram API after ${maxRetries + 1} attempts [${classification.category}]: ${classification.description}`;
        console.error(`❌ ${failureReason}`);
        botState.isConnected = false;
        botState.lastErrorMessage = failureReason;
        addActivityLog(0, 'system', 'system', failureReason, 'error');
        return { success: false, message: failureReason };
      }
    }
  }

  if (!botIdentity) {
    return { success: false, message: 'Could not verify Telegram Bot credentials.' };
  }

  // Step 2: Check webhook configuration
  try {
    const webhookRes = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`, {
      signal: AbortSignal.timeout(10000)
    });
    const webhookData: any = await webhookRes.json();
    const activeUrl = webhookData.ok && webhookData.result && webhookData.result.url ? webhookData.result.url : '';

    // If ANY webhook is active on Telegram, maintain Webhook mode and NEVER delete it
    if (activeUrl && activeUrl.trim() !== '') {
      console.log(`🌐 Telegram Bot: Active production webhook verified on Telegram (${activeUrl}). Maintaining Webhook mode.`);
      botState.mode = 'webhook';
      botState.isConnected = true;
      botState.lastErrorMessage = null;
      botState.consecutiveErrors = 0;
      addActivityLog(0, 'system', 'system', `Bot online in Webhook mode (@${botIdentity.username}) at ${activeUrl}`, 'info');
      return { success: true, message: `Bot active in Webhook mode (@${botIdentity.username})`, botInfo: botIdentity };
    }

    // Check if a production webhook URL is configured in environment or Firestore
    const gatewayConfig = await getSystemGatewayConfig();
    const configuredBaseUrl = process.env.TELEGRAM_WEBHOOK_URL || process.env.PUBLIC_APP_URL || gatewayConfig.webhookUrl;

    if (configuredBaseUrl && configuredBaseUrl.trim() !== '') {
      const webhookEndpoint = configuredBaseUrl.endsWith('/api/telegram-webhook')
        ? configuredBaseUrl.trim()
        : `${configuredBaseUrl.replace(/\/$/, '')}/api/telegram-webhook`;
      const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET || gatewayConfig.secretToken;

      console.log(`📡 Registering configured production webhook with Telegram: ${webhookEndpoint}`);
      const setBody: any = {
        url: webhookEndpoint,
        drop_pending_updates: false
      };
      if (secretToken) {
        setBody.secret_token = secretToken;
      }

      const setRes = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(setBody),
        signal: AbortSignal.timeout(15000)
      });
      const setData: any = await setRes.json().catch(() => ({}));

      if (setData.ok) {
        botState.mode = 'webhook';
        botState.isConnected = true;
        botState.lastErrorMessage = null;
        botState.consecutiveErrors = 0;
        addActivityLog(0, 'system', 'system', `Registered production webhook (@${botIdentity.username}) at ${webhookEndpoint}`, 'info');
        return { success: true, message: `Bot registered and active in Webhook mode (@${botIdentity.username})`, botInfo: botIdentity };
      } else {
        console.warn(`Could not auto-register webhook: ${setData.description || 'Unknown error'}`);
      }
    }
  } catch (webhookErr) {
    console.warn("Could not query webhook info, proceeding with polling setup:", webhookErr);
  }

  // Step 3: Launch Local Fallback Polling Loop (Only if NO webhook is registered)
  console.log(`🔌 Telegram Bot: Initializing fallback Long-Polling engine for @${botIdentity.username}...`);
  botState.mode = 'polling';
  addActivityLog(0, 'system', 'system', `Bot online in Fallback Polling mode (@${botIdentity.username})`, 'info');

  const abortController = new AbortController();
  activePollerAbortController = abortController;

  const poll = async () => {
    let offset = 0;

    while (!abortController.signal.aborted) {
      if (isBotServiceStopped) {
        botState.mode = 'stopped';
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      try {
        const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=15`;
        const res = await fetch(url, {
          signal: AbortSignal.timeout(25000),
          headers: { 'Connection': 'keep-alive' }
        });

        if (abortController.signal.aborted) break;

        if (!res.ok) {
          const errText = await res.text();
          const classification = classifyTelegramError(null, res.status, errText);
          botState.lastErrorMessage = classification.description;

          if (classification.category === 'WEBHOOK_CONFLICT') {
            console.log("ℹ️ Webhook is active on Telegram (HTTP 409). Pausing poller and switching to Webhook mode.");
            botState.mode = 'webhook';
            botState.isConnected = true;
            botState.lastErrorMessage = null;
            break; // Stop poller cleanly, preserve webhook
          }

          if (classification.category === 'INVALID_TOKEN') {
            console.error("❌ Telegram Token rejected (401 Unauthorized). Stopping polling loop.");
            botState.isConnected = false;
            break;
          }

          console.warn(`Telegram API getUpdates error [${classification.category}]: ${classification.description}`);
          botState.consecutiveErrors++;
          await new Promise(r => setTimeout(r, 5000));
          continue;
        }

        const data: any = await res.json();
        botState.lastPollTimestamp = Date.now();
        botState.consecutiveErrors = 0;
        botState.lastErrorMessage = null;

        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            if (abortController.signal.aborted) break;
            offset = update.update_id + 1;
            botState.lastSuccessfulUpdateId = update.update_id;
            await handleTelegramUpdate(token, update);
          }
        }
      } catch (err: any) {
        if (abortController.signal.aborted) break;

        const classification = classifyTelegramError(err);
        
        if (classification.category === 'TIMEOUT') {
          // Benign idle long-polling socket renewal, continue smoothly
          await new Promise(r => setTimeout(r, 1000));
        } else {
          botState.consecutiveErrors++;
          botState.lastErrorMessage = classification.description;
          console.error(`Telegram Polling [${classification.category}]: ${classification.description}`);
          await new Promise(r => setTimeout(r, 4000));
        }
      }
    }
  };

  poll().catch(err => {
    console.error("Fatal exception in poller loop:", err);
  });

  return { success: true, message: `Bot active in Long-Polling mode (@${botIdentity.username})`, botInfo: botIdentity };
}
