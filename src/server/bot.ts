import { kurals, Kural } from '../kurals';
import { chapters } from '../chapters';
import { getUser, saveUser, getAllUsers, BotUser, addActivityLog } from './db';
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
      return `${hourStr}:${minStr}:${ampm}`;
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
      return `${hourStr}:${minStr}:${ampm}`;
    }
  }

  // Matches hour-only e.g. "7 AM", "7AM", "11 PM", "11pm"
  const matchHourOnly = upper.match(/^(\d{1,2})\s*(AM|PM)$/);
  if (matchHourOnly) {
    const hour = parseInt(matchHourOnly[1], 10);
    const ampm = matchHourOnly[2];
    if (hour >= 1 && hour <= 12) {
      const hourStr = String(hour).padStart(2, '0');
      return `${hourStr}:00:${ampm}`;
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
      saveUser(chatId, { triggerTime: 'none' });
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
      saveUser(chatId, { triggerTime: directParsed });
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
          saveUser(chatId, { triggerTime: 'none' });
          return {
            text: `✅ <b>Reminders turned OFF / நினைவூட்டல் நிறுத்தப்பட்டது!</b>\n\nAutomatic daily reminders are now disabled.`,
            replyMarkup: { inline_keyboard: [[{ text: "↩️ Back to Menu", callback_data: "btn_menu" }]] }
          };
        } else {
          saveUser(chatId, { triggerTime: parsed });
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
export async function handleBotCallback(chatId: number, callbackData: string): Promise<BotResponse> {
  const user = getUser(chatId);
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
      saveUser(chatId, { triggerTime: 'none' });
      return {
        text: `✅ <b>Reminders turned OFF / நினைவூட்டல் நிறுத்தப்பட்டது!</b>\n\nAutomatic daily reminders are now disabled. You can still fetch couplets manually with /daily or /random.`,
        replyMarkup: getCustomReminderMenuMarkup('none', '07:00:AM', chatId)
      };
    } else {
      saveUser(chatId, { triggerTime: time });
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
      saveUser(chatId, { language: 'tamil' });
      return {
        text: `✅ <b>Language Set / மொழி தேர்வு செய்யப்பட்டது!</b>\n\nFrom now on, I will display Kurals and explanations in <b>Tamil</b> 🪔`,
        replyMarkup: getLanguageMenuMarkup('tamil')
      };

    case 'set_lang_english':
      saveUser(chatId, { language: 'english' });
      return {
        text: `✅ <b>Language Set / மொழி தேர்வு செய்யப்பட்டது!</b>\n\nFrom now on, I will display Kurals and translations in <b>English</b> 🇬🇧`,
        replyMarkup: getLanguageMenuMarkup('english')
      };

    case 'set_lang_both':
      saveUser(chatId, { language: 'both' });
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

async function sendTelegramMessage(token: string, chatId: number, response: BotResponse) {
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
      const errText = await res.text();
      console.error(`Error sending Telegram message to chat ${chatId}:`, errText);
      
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
          const fallbackErr = await res.text();
          console.error(`Retry without web_app also failed for chat ${chatId}:`, fallbackErr);
        }
      } else if (errText.includes("can't parse entities")) {
        // Fallback for HTML entity parsing issues
        delete payload.parse_mode;
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
    }
  } catch (err) {
    console.error(`Failed to send Telegram message to chat ${chatId}:`, err);
  }
}

// Helper to get time formatted in India Standard Time (IST)
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
    // Pad to match DB expectation (e.g., "08:00:AM")
    hour = hour.padStart(2, '0');
    minute = minute.padStart(2, '0');
    const ampm = dayPeriod.toUpperCase();
    return `${hour}:${minute}:${ampm}`;
  } catch (err) {
    console.error("Error formatting IST time:", err);
    // Fallback to server local time if timeZone not supported
    let hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12; // '0' should be '12'
    const hoursStr = String(hours).padStart(2, '0');
    return `${hoursStr}:${minutes}:${ampm}`;
  }
}

// Background scheduler for daily reminders (checks every minute)
export function startReminderScheduler(token: string | undefined) {
  const hasToken = token && token !== 'MY_TELEGRAM_BOT_TOKEN' && token.trim() !== '';
  if (hasToken) {
    console.log("⏰ Reminder Scheduler: Initialized for Real Telegram users (IST Timezone).");
  } else {
    console.log("⏰ Reminder Scheduler: Initialized for Simulated Companion users only (IST Timezone).");
  }
  
  setInterval(async () => {
    if (isBotServiceStopped) {
      return; // Do nothing if bot service is stopped
    }
    try {
      // Get current hour and minute in Asia/Kolkata (IST)
      const timeString = getISTTimeString();
      const users = getAllUsers();
      let triggeredCount = 0;

      for (const user of users) {
        if (user.triggerTime === timeString) {
          const dailyKural = getDailyKural();
          const response: BotResponse = {
            text: `📅 <b>DAILY REMINDER / தினசரி நினைவூட்டல்</b>\n\n${formatKural(dailyKural, user.language || 'both')}`,
            replyMarkup: getMainMenuMarkup()
          };

          // Check if it's a simulated companion user
          if (user.chatId < 10000000) {
            console.log(`⏰ Reminder [SIMULATED]: Sending daily couplet to companion user ${user.chatId} at ${timeString} IST`);
            addActivityLog(user.chatId, user.username || user.firstName || `User ${user.chatId}`, 'outgoing', `📅 DAILY REMINDER: ${dailyKural.english}`);
            triggeredCount++;
          } else if (hasToken) {
            console.log(`⏰ Reminder [REAL]: Sending daily couplet to real Telegram user ${user.chatId} at ${timeString} IST`);
            await sendTelegramMessage(token!, user.chatId, response);
            addActivityLog(user.chatId, user.username || user.firstName || `User ${user.chatId}`, 'outgoing', `📅 DAILY REMINDER (Sent via Telegram)`);
            triggeredCount++;
          } else {
            console.log(`⏰ Reminder [SKIPPED]: Real user ${user.chatId} trigger matched ${timeString} IST but TELEGRAM_BOT_TOKEN is not configured.`);
          }
        }
      }

      if (triggeredCount > 0) {
        addActivityLog(0, 'system', 'system', `Scheduler processed daily reminders for ${triggeredCount} subscribers`, 'info');
      }
    } catch (err) {
      console.error("Error in reminder scheduler interval:", err);
    }
  }, 60000); // check every minute
}

// Simple polling bot loop for production/deployment
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
      const text = msg.text || '';
      const username = msg.from?.username;
      const firstName = msg.from?.first_name;

      console.log(`💬 [Telegram Bot] Message received from ${chatId} (${username}): "${text}"`);
      addActivityLog(chatId, username || firstName || `User ${chatId}`, 'incoming', text);

      const response = await handleBotMessage(chatId, text, username, firstName);
      await sendTelegramMessage(token, chatId, response);

      addActivityLog(chatId, username || firstName || `User ${chatId}`, 'outgoing', response.text);
    } 
    else if (update.callback_query) {
      const cb = update.callback_query;
      const chatId = cb.message.chat.id;
      const cbData = cb.data || '';
      const queryId = cb.id;
      const username = cb.from?.username;
      const firstName = cb.from?.first_name;

      console.log(`🔘 [Telegram Bot] Callback received from ${chatId}: "${cbData}"`);
      addActivityLog(chatId, username || firstName || `User ${chatId}`, 'incoming', `Pressed button: ${cbData}`);

      const response = await handleBotCallback(chatId, cbData);
      await sendTelegramMessage(token, chatId, response);

      addActivityLog(chatId, username || firstName || `User ${chatId}`, 'outgoing', response.text);

      try {
        await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ callback_query_id: queryId })
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

export function startRealTelegramBot(token: string) {
  let offset = 0;
  console.log("🤖 Telegram Bot: Initializing real bot controller...");

  // Query webhook info to ensure we don't have stale/external webhooks stealing updates
  fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`)
    .then(r => r.json())
    .then(async (webhookData: any) => {
      const activeUrl = webhookData.ok && webhookData.result && webhookData.result.url;
      const currentApp = getAppUrl();
      const expectedWebhookUrl = currentApp ? `${currentApp}/api/telegram-webhook` : '';

      // If there is any webhook active that does not match this server's current endpoint,
      // delete it immediately so updates are fetched by our live long-polling loop!
      if (activeUrl && activeUrl !== expectedWebhookUrl) {
        console.log(`🧹 Detected external/stale webhook: ${activeUrl}. Deleting to enable live polling...`);
        try {
          await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`);
          addActivityLog(0, 'system', 'system', `Deleted stale webhook (${activeUrl}) to switch to active Poller`, 'info');
        } catch (e) {
          console.error("Failed to delete stale webhook:", e);
        }
      } else if (activeUrl && activeUrl === expectedWebhookUrl) {
        console.log(`🌐 Telegram Bot: Active webhook matches current App URL: ${activeUrl}. Waiting for webhook deliveries.`);
        addActivityLog(0, 'system', 'system', `Bot initialized in Webhook mode (${activeUrl})`, 'info');
        return;
      }

      console.log("🔌 Telegram Bot Poller: Initializing live long-polling mode...");
      addActivityLog(0, 'system', 'system', `Bot initialized in live Long-Polling mode.`, 'info');

      // Make sure webhook is clean
      try {
        await fetch(`https://api.telegram.org/bot${token}/deleteWebhook?drop_pending_updates=false`);
      } catch (e) {}

      const poll = async () => {
        while (true) {
          if (isBotServiceStopped) {
            await new Promise(r => setTimeout(r, 2000));
            continue;
          }
          try {
            // Use 15s server timeout and 20s abort timeout to prevent proxy idle socket drops
            const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${offset}&timeout=15`;
            const res = await fetch(url, {
              signal: AbortSignal.timeout(20000),
              headers: { 'Connection': 'keep-alive' }
            });

            if (!res.ok) {
              if (res.status === 409) {
                console.log("ℹ️ Telegram Bot Poller: Webhook conflict detected (Status 409). Suspending poller.");
                addActivityLog(0, 'system', 'system', `Polling loop suspended: Webhook conflict detected (409).`, 'info');
                break;
              }
              console.warn(`Telegram API getUpdates returned status: ${res.status}`);
              await new Promise(r => setTimeout(r, 5000));
              continue;
            }

            const data: any = await res.json();
            if (data.ok && Array.isArray(data.result)) {
              for (const update of data.result) {
                offset = update.update_id + 1;
                await handleTelegramUpdate(token, update);
              }
            }
          } catch (err: any) {
            // In long-polling, socket read timeouts or idle resets are normal cycle events
            const errCode = err?.cause?.code || err?.code || '';
            const errMsg = String(err?.message || err || '');
            const isSocketTimeout =
              err?.name === 'TimeoutError' ||
              err?.name === 'AbortError' ||
              errCode === 'ETIMEDOUT' ||
              errCode === 'ECONNRESET' ||
              errCode === 'UND_ERR_CONNECT_TIMEOUT' ||
              errMsg.includes('ETIMEDOUT') ||
              errMsg.includes('timeout') ||
              (errMsg.includes('fetch failed') && (errCode === 'ETIMEDOUT' || String(err?.cause).includes('ETIMEDOUT')));

            if (isSocketTimeout) {
              // Benign idle socket renewal, seamlessly continue next poll cycle
              await new Promise(r => setTimeout(r, 1000));
            } else {
              console.error("Non-timeout error in Telegram Polling loop:", err);
              await new Promise(r => setTimeout(r, 4000));
            }
          }
        }
      };

      poll();
    })
    .catch(err => {
      console.error("❌ Failed to query Telegram Webhook Info during initialization:", err);
      addActivityLog(0, 'system', 'system', `Failed to initialize Telegram Bot: ${err instanceof Error ? err.message : err}`, 'error');
    });
}
