/**
 * Dedicated Flask / Web UI for Custom Time Selection in Telegram Bot
 * Provides an interactive visual circular clock dial, digital display, stepper controls,
 * native time input, and seamless Telegram WebApp SDK integration.
 */

export function renderFlaskTimePickerHtml(defaultChatId: string = '', defaultTime: string = '07:00:AM'): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Visual Time Picker • Thirukkural Bot</title>
  <!-- Telegram WebApp SDK -->
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
  <style>
    :root {
      --bg-color: #0b0f19;
      --card-bg: #111827;
      --card-border: #1f2937;
      --text-main: #f9fafb;
      --text-muted: #9ca3af;
      --accent: #f59e0b;
      --accent-hover: #d97706;
      --accent-light: #fef3c7;
      --primary: #0284c7;
      --primary-hover: #0369a1;
      --danger: #ef4444;
      --danger-hover: #dc2626;
      --success: #10b981;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      -webkit-tap-highlight-color: transparent;
    }

    body {
      background: var(--bg-color);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 12px;
    }

    .container {
      width: 100%;
      max-width: 420px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 24px;
      padding: 20px 16px;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4);
    }

    .header {
      text-align: center;
      margin-bottom: 14px;
    }

    .bot-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(245, 158, 11, 0.12);
      color: var(--accent);
      border: 1px solid rgba(245, 158, 11, 0.25);
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      padding: 3px 10px;
      border-radius: 9999px;
      margin-bottom: 6px;
    }

    h1 {
      font-size: 18px;
      font-weight: 800;
      color: #fff;
      margin-bottom: 2px;
    }

    p.subtitle {
      font-size: 11px;
      color: var(--text-muted);
      line-height: 1.35;
    }

    .ist-live-pill {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-size: 11px;
      font-family: monospace;
      color: #38bdf8;
      background: rgba(56, 189, 248, 0.1);
      border: 1px solid rgba(56, 189, 248, 0.2);
      border-radius: 10px;
      padding: 4px 10px;
      margin: 8px 0 12px 0;
    }

    .chat-id-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--card-border);
      border-radius: 12px;
      padding: 6px 10px;
      margin-bottom: 12px;
      font-size: 11px;
    }

    .chat-id-row label {
      color: var(--text-muted);
      font-weight: 600;
    }

    .chat-id-row input {
      background: transparent;
      border: none;
      color: #fff;
      font-family: monospace;
      font-weight: 700;
      text-align: right;
      width: 140px;
      outline: none;
    }

    /* DIGITAL CLOCK DISPLAY */
    .digital-clock-card {
      background: #0d1322;
      border: 1px solid #1e293b;
      border-radius: 18px;
      padding: 12px 14px;
      text-align: center;
      margin-bottom: 14px;
      position: relative;
    }

    .digital-time {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      margin-bottom: 4px;
    }

    .time-unit-btn {
      background: #1e293b;
      border: 2px solid transparent;
      color: #cbd5e1;
      font-size: 38px;
      font-weight: 800;
      font-family: monospace;
      padding: 2px 10px;
      border-radius: 12px;
      min-width: 68px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .time-unit-btn.active {
      background: rgba(245, 158, 11, 0.15);
      border-color: var(--accent);
      color: #fff;
      box-shadow: 0 0 12px rgba(245, 158, 11, 0.2);
    }

    .time-unit-btn.minute-active {
      background: rgba(56, 189, 248, 0.15);
      border-color: #38bdf8;
      color: #fff;
      box-shadow: 0 0 12px rgba(56, 189, 248, 0.2);
    }

    .time-colon {
      font-size: 32px;
      font-weight: 800;
      color: var(--accent);
      animation: pulse 1s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.35; }
    }

    .ampm-toggle {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-left: 6px;
    }

    .ampm-btn {
      background: #1e293b;
      border: 1px solid #334155;
      color: var(--text-muted);
      font-size: 13px;
      font-weight: 800;
      padding: 5px 8px;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .ampm-btn.active {
      background: var(--accent);
      color: #0b0f19;
      border-color: var(--accent);
    }

    .delivery-summary {
      font-size: 11px;
      color: #94a3b8;
    }

    .delivery-summary strong {
      color: #38bdf8;
    }

    /* VISUAL CIRCULAR CLOCK DIAL */
    .clock-dial-section {
      background: #0d1322;
      border: 1px solid #1e293b;
      border-radius: 20px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 14px;
    }

    .dial-mode-pill {
      display: flex;
      background: #1e293b;
      border-radius: 9999px;
      padding: 3px;
      gap: 4px;
      margin-bottom: 10px;
    }

    .dial-tab {
      background: transparent;
      border: none;
      color: #94a3b8;
      font-size: 11px;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 9999px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .dial-tab.active {
      background: var(--accent);
      color: #0b0f19;
      box-shadow: 0 2px 6px rgba(245, 158, 11, 0.3);
    }

    .dial-tab.active-minute {
      background: #0284c7;
      color: #fff;
      box-shadow: 0 2px 6px rgba(2, 132, 199, 0.3);
    }

    .clock-face {
      position: relative;
      width: 220px;
      height: 220px;
      border-radius: 50%;
      background: radial-gradient(circle, #151d30 0%, #0d1322 100%);
      border: 2px solid #27354f;
      touch-action: none;
      cursor: pointer;
      user-select: none;
    }

    .clock-face-svg {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    .clock-node {
      position: absolute;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 800;
      font-family: monospace;
      color: #cbd5e1;
      border-radius: 50%;
      transform: translate(-50%, -50%);
      pointer-events: none;
      transition: color 0.15s;
    }

    .clock-node.selected {
      color: #fff;
      font-weight: 900;
    }

    /* STEPPERS */
    .controls-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 12px;
    }

    .stepper-box {
      background: #0d1322;
      border: 1px solid var(--card-border);
      border-radius: 14px;
      padding: 8px 10px;
      text-align: center;
    }

    .stepper-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      font-weight: 700;
      margin-bottom: 4px;
    }

    .stepper-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
    }

    .step-btn {
      background: #1e293b;
      border: 1px solid #334155;
      color: #f8fafc;
      width: 32px;
      height: 32px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      user-select: none;
      transition: all 0.15s;
    }

    .step-btn:hover {
      background: #334155;
      border-color: #475569;
    }

    .step-btn:active {
      transform: scale(0.92);
      background: var(--accent);
      color: #0b0f19;
    }

    .step-val {
      font-size: 16px;
      font-weight: 800;
      font-family: monospace;
      color: #fff;
    }

    /* QUICK JUMP CHIPS */
    .quick-chips-row {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      margin-bottom: 12px;
      justify-content: center;
    }

    .chip-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      color: #cbd5e1;
      font-size: 11px;
      font-weight: 600;
      padding: 4px 8px;
      border-radius: 9999px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .chip-btn:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: #475569;
      color: #fff;
    }

    .chip-btn:active {
      transform: scale(0.95);
      background: var(--accent);
      color: #0b0f19;
    }

    /* NATIVE TIME INPUT ROW */
    .native-input-box {
      background: rgba(255, 255, 255, 0.02);
      border: 1px dashed var(--card-border);
      border-radius: 12px;
      padding: 8px 12px;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
    }

    .native-input-box label {
      font-size: 11px;
      color: var(--text-muted);
      font-weight: 600;
    }

    .native-input-box input[type="time"] {
      background: #1e293b;
      border: 1px solid #334155;
      color: #fff;
      font-size: 12px;
      font-weight: 700;
      font-family: monospace;
      padding: 4px 8px;
      border-radius: 6px;
      outline: none;
      cursor: pointer;
    }

    /* TEXT INPUT BUTTON & CARD IN TIMER */
    .text-input-trigger-box {
      margin-bottom: 12px;
    }

    .btn-text-mode {
      width: 100%;
      background: #1e293b;
      color: #38bdf8;
      border: 1px solid #38bdf8;
      border-radius: 12px;
      padding: 10px 14px;
      font-size: 12px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-text-mode:hover {
      background: rgba(56, 189, 248, 0.12);
      border-color: #7dd3fc;
      color: #e0f2fe;
    }

    .btn-text-mode:active {
      transform: scale(0.98);
    }

    .custom-text-input-card {
      background: #0d1322;
      border: 1px solid #27354f;
      border-radius: 14px;
      padding: 12px;
      margin-bottom: 14px;
      text-align: left;
    }

    .custom-text-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .custom-text-badge {
      font-size: 11px;
      font-weight: 800;
      color: #f8fafc;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .custom-text-tag {
      font-size: 10px;
      font-weight: 700;
      background: #0369a1;
      color: #f0f9ff;
      padding: 2px 8px;
      border-radius: 9999px;
      font-family: monospace;
    }

    .custom-text-subtitle {
      font-size: 11px;
      color: var(--text-muted);
      margin-bottom: 8px;
    }

    .custom-text-subtitle code {
      color: #f59e0b;
      font-weight: bold;
    }

    .custom-text-field-wrap {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 6px;
    }

    .custom-time-input-field {
      flex: 1;
      background: #111827;
      border: 1.5px solid #334155;
      border-radius: 10px;
      padding: 8px 12px;
      font-size: 14px;
      font-weight: 800;
      font-family: monospace;
      color: #fff;
      outline: none;
      transition: border-color 0.2s;
    }

    .custom-time-input-field:focus {
      border-color: #38bdf8;
      box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.2);
    }

    .btn-apply-custom-time {
      background: #0284c7;
      color: #fff;
      border: none;
      border-radius: 10px;
      padding: 8px 16px;
      font-size: 12px;
      font-weight: 800;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.15s;
    }

    .btn-apply-custom-time:hover {
      background: #0369a1;
    }

    .btn-apply-custom-time:active {
      transform: scale(0.96);
    }

    .text-input-feedback {
      font-size: 11px;
      min-height: 18px;
      margin-bottom: 6px;
      font-weight: 600;
    }

    .text-input-feedback.error {
      color: #f87171;
    }

    .text-input-feedback.success {
      color: #34d399;
    }

    .custom-text-samples {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 5px;
    }

    .samples-label {
      font-size: 10px;
      color: var(--text-muted);
      font-weight: 700;
      text-transform: uppercase;
    }

    .sample-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      color: #cbd5e1;
      font-size: 10px;
      font-weight: 700;
      font-family: monospace;
      padding: 3px 7px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.15s;
    }

    .sample-btn:hover {
      background: #1e293b;
      border-color: #38bdf8;
      color: #38bdf8;
    }

    /* ACTION BUTTONS */
    .action-group {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .btn-primary {
      background: var(--accent);
      color: #0b0f19;
      border: none;
      border-radius: 14px;
      font-size: 14px;
      font-weight: 800;
      padding: 12px;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(245, 158, 11, 0.3);
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .btn-primary:hover {
      background: var(--accent-hover);
      box-shadow: 0 6px 16px rgba(245, 158, 11, 0.4);
    }

    .btn-primary:active {
      transform: scale(0.98);
    }

    .btn-secondary {
      background: transparent;
      color: #94a3b8;
      border: 1px solid var(--card-border);
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
      padding: 8px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-secondary:hover {
      color: #f1f5f9;
      border-color: #475569;
      background: rgba(255, 255, 255, 0.04);
    }

    /* SUCCESS NOTIFICATION TOAST */
    .toast-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(4px);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 16px;
      z-index: 1000;
    }

    .toast-card {
      background: #111827;
      border: 1px solid #10b981;
      border-radius: 20px;
      padding: 20px;
      max-width: 340px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(16, 185, 129, 0.25);
      animation: popIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
    }

    @keyframes popIn {
      0% { opacity: 0; transform: scale(0.85); }
      100% { opacity: 1; transform: scale(1); }
    }

    .toast-icon {
      font-size: 38px;
      margin-bottom: 8px;
    }

    .toast-title {
      font-size: 16px;
      font-weight: 800;
      color: #fff;
      margin-bottom: 6px;
    }

    .toast-desc {
      font-size: 12px;
      color: #cbd5e1;
      line-height: 1.45;
      margin-bottom: 14px;
    }

    .toast-btn {
      background: #10b981;
      color: #0b0f19;
      border: none;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 800;
      padding: 9px 18px;
      cursor: pointer;
      width: 100%;
    }
  </style>
</head>
<body>

  <div class="container">
    <!-- HEADER -->
    <div class="header">
      <div class="bot-badge">🌸 Thirukkural Bot</div>
      <h1>Visual Clock Time Picker</h1>
      <p class="subtitle">Click the clock face or drag the hand to set your customized daily delivery time (IST).</p>
    </div>

    <!-- LIVE IST TIME BANNER -->
    <div class="ist-live-pill">
      <span>🕒 Current IST:</span>
      <span id="liveIstClock">--:--:-- --</span>
    </div>

    <!-- SUBSCRIBER CHAT ID ROW -->
    <div class="chat-id-row">
      <label for="chatIdInput">Subscriber Chat ID:</label>
      <input type="text" id="chatIdInput" value="${defaultChatId || ''}" placeholder="Enter Telegram Chat ID" />
    </div>

    <!-- DIGITAL CLOCK PREVIEW -->
    <div class="digital-clock-card">
      <div class="digital-time">
        <button type="button" id="btnDispHour" class="time-unit-btn active" onclick="setClockMode('hour')">
          <span id="displayHour">07</span>
        </button>
        <div class="time-colon">:</div>
        <button type="button" id="btnDispMinute" class="time-unit-btn" onclick="setClockMode('minute')">
          <span id="displayMinute">00</span>
        </button>
        <div class="ampm-toggle">
          <button type="button" id="btnAm" class="ampm-btn active" onclick="setPeriod('AM')">AM</button>
          <button type="button" id="btnPm" class="ampm-btn" onclick="setPeriod('PM')">PM</button>
        </div>
      </div>
      <div class="delivery-summary">
        Delivery Schedule: <strong id="summaryTime">07:00 AM (IST)</strong>
      </div>
    </div>

    <!-- INTERACTIVE CIRCULAR CLOCK DIAL -->
    <div class="clock-dial-section">
      <div class="dial-mode-pill">
        <button type="button" id="tabHour" class="dial-tab active" onclick="setClockMode('hour')">
          🕒 Hours (1-12)
        </button>
        <button type="button" id="tabMinute" class="dial-tab" onclick="setClockMode('minute')">
          ⏱️ Minutes (00-59)
        </button>
      </div>

      <div class="clock-face" id="clockFace">
        <svg class="clock-face-svg" viewBox="0 0 220 220">
          <line id="clockHandLine" x1="110" y1="110" x2="110" y2="35" stroke="#f59e0b" stroke-width="3" stroke-linecap="round" />
          <circle cx="110" cy="110" r="5" fill="#f59e0b" id="clockPivot" />
          <circle id="clockHandTip" cx="110" cy="35" r="14" fill="#f59e0b" fill-opacity="0.3" stroke="#f59e0b" stroke-width="2" />
        </svg>
        <div id="clockNumbers"></div>
      </div>
    </div>

    <!-- STEPPERS (HOUR & MINUTE) -->
    <div class="controls-grid">
      <!-- Hours Stepper -->
      <div class="stepper-box">
        <div class="stepper-label">Hour</div>
        <div class="stepper-row">
          <button type="button" class="step-btn" onclick="stepHour(-1)">−</button>
          <span class="step-val" id="valHour">07</span>
          <button type="button" class="step-btn" onclick="stepHour(1)">+</button>
        </div>
      </div>

      <!-- Minutes Stepper -->
      <div class="stepper-box">
        <div class="stepper-label">Minute</div>
        <div class="stepper-row">
          <button type="button" class="step-btn" onclick="stepMinute(-1)">−</button>
          <span class="step-val" id="valMinute">00</span>
          <button type="button" class="step-btn" onclick="stepMinute(1)">+</button>
        </div>
      </div>
    </div>

    <!-- QUICK ADJUSTMENT CHIPS -->
    <div class="quick-chips-row">
      <button type="button" class="chip-btn" onclick="setMinute(0)">:00</button>
      <button type="button" class="chip-btn" onclick="setMinute(15)">:15</button>
      <button type="button" class="chip-btn" onclick="setMinute(30)">:30</button>
      <button type="button" class="chip-btn" onclick="setMinute(45)">:45</button>
      <button type="button" class="chip-btn" onclick="stepMinute(5)">+5m</button>
      <button type="button" class="chip-btn" onclick="stepMinute(-5)">-5m</button>
      <button type="button" class="chip-btn" onclick="stepHour(1)">+1h</button>
    </div>

    <!-- BUTTON IN TIMER TO GET TEXT INPUT (HH:MM AM/PM) -->
    <div class="text-input-trigger-box">
      <button type="button" class="btn-text-mode" id="btnToggleTextInput" onclick="toggleCustomTextInput()">
        <span>⌨️</span>
        <span>Enter Time via Text Input (HH:MM AM/PM)</span>
      </button>
    </div>

    <!-- CUSTOM TIME TEXT INPUT CARD -->
    <div class="custom-text-input-card" id="customTextInputCard">
      <div class="custom-text-header">
        <span class="custom-text-badge">⌨️ Custom Time Text Input</span>
        <span class="custom-text-tag">Format: HH:MM AM/PM</span>
      </div>
      <p class="custom-text-subtitle">
        Type your custom delivery time in <strong>HH:MM AM/PM</strong> format (e.g. <code>07:30 AM</code>, <code>11:00 PM</code>):
      </p>
      <div class="custom-text-field-wrap">
        <input 
          type="text" 
          id="customTimeText" 
          class="custom-time-input-field" 
          placeholder="HH:MM AM/PM (e.g. 07:30 AM)" 
          maxlength="10" 
          onkeydown="if(event.key === 'Enter') { event.preventDefault(); applyCustomTimeText(); }"
        />
        <button type="button" class="btn-apply-custom-time" onclick="applyCustomTimeText()">
          Apply Time
        </button>
      </div>
      <div id="textInputFeedback" class="text-input-feedback"></div>
      <div class="custom-text-samples">
        <span class="samples-label">Quick samples:</span>
        <button type="button" class="sample-btn" onclick="fillCustomTimeText('06:00 AM')">06:00 AM</button>
        <button type="button" class="sample-btn" onclick="fillCustomTimeText('07:30 AM')">07:30 AM</button>
        <button type="button" class="sample-btn" onclick="fillCustomTimeText('12:15 PM')">12:15 PM</button>
        <button type="button" class="sample-btn" onclick="fillCustomTimeText('06:45 PM')">06:45 PM</button>
        <button type="button" class="sample-btn" onclick="fillCustomTimeText('11:00 PM')">11:00 PM</button>
      </div>
    </div>

    <!-- NATIVE 24H TIME INPUT SYNC -->
    <div class="native-input-box">
      <label for="nativeTimeInput">Or pick via native clock:</label>
      <input type="time" id="nativeTimeInput" onchange="onNativeTimeChange(this.value)" />
    </div>

    <!-- ACTION BUTTONS -->
    <div class="action-group">
      <button type="button" class="btn-primary" onclick="saveCustomTime()">
        <span>💾</span> Save Custom Reminder Time
      </button>
      <button type="button" class="btn-secondary" onclick="disableReminders()">
        📴 Turn Off Automated Reminders
      </button>
    </div>
  </div>

  <!-- SUCCESS CONFIRMATION MODAL -->
  <div class="toast-overlay" id="toastModal">
    <div class="toast-card">
      <div class="toast-icon">🌸</div>
      <div class="toast-title" id="toastTitle">Reminder Configured!</div>
      <div class="toast-desc" id="toastDesc">
        Your daily Thirukkural couplet will be delivered every day at <b>07:00 AM IST</b>.
      </div>
      <button type="button" class="toast-btn" onclick="closeToastOrTelegram()">
        Done & Close
      </button>
    </div>
  </div>

  <script>
    // State
    let currentHour = 7;
    let currentMinute = 0;
    let currentAmPm = 'AM';
    let clockMode = 'hour'; // 'hour' | 'minute'
    let isDragging = false;

    // Parse initial time resiliently
    (function initFromParams() {
      const urlParams = new URLSearchParams(window.location.search);
      const paramChatId = urlParams.get('chatId');
      if (paramChatId) {
        document.getElementById('chatIdInput').value = paramChatId;
      } else if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
        document.getElementById('chatIdInput').value = window.Telegram.WebApp.initDataUnsafe.user.id;
      }

      const paramTime = (urlParams.get('time') || "${defaultTime}").trim();
      if (paramTime && paramTime.toLowerCase() !== 'none') {
        parseAndApplyTime(paramTime);
      }
      renderClockDial();
      updateUI();
    })();

    function parseAndApplyTime(str) {
      try {
        // e.g., "07:30:AM" or "7:30 AM" or "18:30" or "07:30"
        str = str.replace(/:/g, ' ').trim();
        const parts = str.split(/\\s+/);
        if (parts.length >= 2) {
          let h = parseInt(parts[0], 10);
          let m = parseInt(parts[1], 10);
          let ap = parts[2] ? parts[2].toUpperCase() : null;

          if (!isNaN(h) && !isNaN(m)) {
            if (!ap) {
              if (h >= 12) {
                ap = 'PM';
                if (h > 12) h -= 12;
              } else {
                ap = 'AM';
                if (h === 0) h = 12;
              }
            }
            currentHour = (h >= 1 && h <= 12) ? h : 7;
            currentMinute = (m >= 0 && m <= 59) ? m : 0;
            currentAmPm = (ap === 'PM') ? 'PM' : 'AM';
          }
        }
      } catch (e) {
        currentHour = 7;
        currentMinute = 0;
        currentAmPm = 'AM';
      }
    }

    // Live IST Clock update
    function updateLiveIST() {
      try {
        const now = new Date();
        const istString = now.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        });
        document.getElementById('liveIstClock').textContent = istString;
      } catch (e) {
        document.getElementById('liveIstClock').textContent = new Date().toLocaleTimeString();
      }
    }
    setInterval(updateLiveIST, 1000);
    updateLiveIST();

    // Mode handling
    function setClockMode(mode) {
      clockMode = mode;
      renderClockDial();
      updateUI();
    }

    // Render Dial Numbers
    function renderClockDial() {
      const container = document.getElementById('clockNumbers');
      container.innerHTML = '';
      const R = 82; // radius in px from center (110, 110)
      const cx = 110;
      const cy = 110;

      if (clockMode === 'hour') {
        for (let i = 1; i <= 12; i++) {
          const angle = (i * 30 - 90) * (Math.PI / 180);
          const x = cx + R * Math.cos(angle);
          const y = cy + R * Math.sin(angle);

          const node = document.createElement('div');
          node.className = 'clock-node' + (i === currentHour ? ' selected' : '');
          node.style.left = x + 'px';
          node.style.top = y + 'px';
          node.textContent = i;
          container.appendChild(node);
        }
      } else {
        // Minutes (00, 05, 10, 15, ..., 55)
        for (let i = 0; i < 12; i++) {
          const m = i * 5;
          const angle = (m * 6 - 90) * (Math.PI / 180);
          const x = cx + R * Math.cos(angle);
          const y = cy + R * Math.sin(angle);

          const node = document.createElement('div');
          node.className = 'clock-node' + (Math.abs(m - currentMinute) <= 2 ? ' selected' : '');
          node.style.left = x + 'px';
          node.style.top = y + 'px';
          node.textContent = pad(m);
          container.appendChild(node);
        }
      }
    }

    // Clock Face Interaction (Click & Drag)
    const clockFace = document.getElementById('clockFace');

    function handleClockInput(e) {
      const rect = clockFace.getBoundingClientRect();
      const clientX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
      const clientY = (e.touches && e.touches.length > 0) ? e.touches[0].clientY : e.clientY;
      const x = clientX - (rect.left + rect.width / 2);
      const y = clientY - (rect.top + rect.height / 2);

      let angle = Math.atan2(y, x) * (180 / Math.PI) + 90;
      if (angle < 0) angle += 360;

      if (clockMode === 'hour') {
        let h = Math.round(angle / 30);
        if (h === 0) h = 12;
        if (h > 12) h = 12;
        currentHour = h;
      } else {
        let m = Math.round(angle / 6);
        if (m >= 60) m = 0;
        currentMinute = m;
      }

      renderClockDial();
      updateUI();
    }

    clockFace.addEventListener('mousedown', function(e) {
      isDragging = true;
      handleClockInput(e);
    });

    window.addEventListener('mousemove', function(e) {
      if (isDragging) handleClockInput(e);
    });

    window.addEventListener('mouseup', function() {
      if (isDragging) {
        isDragging = false;
        // If hour was just selected, automatically transition to minute mode
        if (clockMode === 'hour') {
          setTimeout(function() {
            setClockMode('minute');
          }, 250);
        }
      }
    });

    clockFace.addEventListener('touchstart', function(e) {
      isDragging = true;
      handleClockInput(e);
    }, { passive: false });

    window.addEventListener('touchmove', function(e) {
      if (isDragging) {
        e.preventDefault();
        handleClockInput(e);
      }
    }, { passive: false });

    window.addEventListener('touchend', function() {
      if (isDragging) {
        isDragging = false;
        if (clockMode === 'hour') {
          setTimeout(function() {
            setClockMode('minute');
          }, 250);
        }
      }
    });

    // Stepper & Chip Handlers
    function stepHour(delta) {
      currentHour += delta;
      if (currentHour > 12) currentHour = 1;
      if (currentHour < 1) currentHour = 12;
      renderClockDial();
      updateUI();
    }

    function stepMinute(delta) {
      currentMinute += delta;
      while (currentMinute >= 60) currentMinute -= 60;
      while (currentMinute < 0) currentMinute += 60;
      renderClockDial();
      updateUI();
    }

    function setMinute(min) {
      currentMinute = min;
      renderClockDial();
      updateUI();
    }

    function setPeriod(p) {
      currentAmPm = p;
      updateUI();
    }

    function onNativeTimeChange(val) {
      if (!val) return;
      const [h, m] = val.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m)) {
        currentAmPm = h >= 12 ? 'PM' : 'AM';
        currentHour = h % 12;
        if (currentHour === 0) currentHour = 12;
        currentMinute = m;
        renderClockDial();
        updateUI();
      }
    }

    function pad(n) {
      return String(n).padStart(2, '0');
    }

    function updateUI() {
      const hStr = pad(currentHour);
      const mStr = pad(currentMinute);

      document.getElementById('displayHour').textContent = hStr;
      document.getElementById('displayMinute').textContent = mStr;
      document.getElementById('valHour').textContent = hStr;
      document.getElementById('valMinute').textContent = mStr;

      // Digital button active highlights
      const btnHour = document.getElementById('btnDispHour');
      const btnMin = document.getElementById('btnDispMinute');
      const tabHour = document.getElementById('tabHour');
      const tabMin = document.getElementById('tabMinute');

      if (clockMode === 'hour') {
        btnHour.className = 'time-unit-btn active';
        btnMin.className = 'time-unit-btn';
        tabHour.className = 'dial-tab active';
        tabMin.className = 'dial-tab';
      } else {
        btnHour.className = 'time-unit-btn';
        btnMin.className = 'time-unit-btn minute-active';
        tabHour.className = 'dial-tab';
        tabMin.className = 'dial-tab active-minute';
      }

      // AM/PM state
      const btnAm = document.getElementById('btnAm');
      const btnPm = document.getElementById('btnPm');
      if (currentAmPm === 'AM') {
        btnAm.classList.add('active');
        btnPm.classList.remove('active');
      } else {
        btnPm.classList.add('active');
        btnAm.classList.remove('active');
      }

      const formatted = hStr + ':' + mStr + ' ' + currentAmPm;
      document.getElementById('summaryTime').textContent = formatted + ' (IST)';

      // Sync custom text input field if user is not actively typing in it
      const textInput = document.getElementById('customTimeText');
      if (textInput && document.activeElement !== textInput) {
        textInput.value = formatted;
      }

      // Sync native time picker input (24h)
      let h24 = currentHour % 12;
      if (currentAmPm === 'PM') h24 += 12;
      document.getElementById('nativeTimeInput').value = pad(h24) + ':' + mStr;

      // Update SVG Clock Hand Position
      const cx = 110;
      const cy = 110;
      const R = 82;
      let angleDeg = 0;
      let color = '#f59e0b';

      if (clockMode === 'hour') {
        angleDeg = (currentHour % 12) * 30;
        color = '#f59e0b';
      } else {
        angleDeg = currentMinute * 6;
        color = '#38bdf8';
      }

      const rad = (angleDeg - 90) * (Math.PI / 180);
      const tipX = cx + R * Math.cos(rad);
      const tipY = cy + R * Math.sin(rad);

      const line = document.getElementById('clockHandLine');
      const tip = document.getElementById('clockHandTip');
      const pivot = document.getElementById('clockPivot');

      line.setAttribute('x2', tipX);
      line.setAttribute('y2', tipY);
      line.setAttribute('stroke', color);

      tip.setAttribute('cx', tipX);
      tip.setAttribute('cy', tipY);
      tip.setAttribute('stroke', color);
      tip.setAttribute('fill', color);

      pivot.setAttribute('fill', color);
    }

    // Custom Time Text Input Handlers (Format: HH:MM AM/PM)
    function toggleCustomTextInput() {
      const card = document.getElementById('customTextInputCard');
      const input = document.getElementById('customTimeText');
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        if (input) {
          input.focus();
          input.select();
        }
      }
    }

    function fillCustomTimeText(timeStr) {
      const input = document.getElementById('customTimeText');
      if (input) {
        input.value = timeStr;
        applyCustomTimeText();
      }
    }

    function applyCustomTimeText() {
      const input = document.getElementById('customTimeText');
      const feedback = document.getElementById('textInputFeedback');
      if (!input || !feedback) return;

      const raw = input.value.trim();
      if (!raw) {
        feedback.className = 'text-input-feedback error';
        feedback.textContent = '❌ Please enter a time in format HH:MM AM/PM (e.g. 07:30 AM)';
        return;
      }

      // Regex to parse HH:MM AM/PM (e.g. 07:30 AM, 7:15 PM, 11:00 PM, 12:45 AM)
      const match = raw.match(/^(\d{1,2})[:.](\d{2})\s*(AM|PM)$/i);
      if (!match) {
        feedback.className = 'text-input-feedback error';
        feedback.textContent = '❌ Invalid format! Please use HH:MM AM/PM format (e.g. 07:30 AM, 11:00 PM).';
        return;
      }

      const h = parseInt(match[1], 10);
      const m = parseInt(match[2], 10);
      const ap = match[3].toUpperCase();

      if (h < 1 || h > 12) {
        feedback.className = 'text-input-feedback error';
        feedback.textContent = '❌ Invalid hour: Must be between 1 and 12.';
        return;
      }

      if (m < 0 || m > 59) {
        feedback.className = 'text-input-feedback error';
        feedback.textContent = '❌ Invalid minute: Must be between 00 and 59.';
        return;
      }

      currentHour = h;
      currentMinute = m;
      currentAmPm = ap;

      updateUI();

      feedback.className = 'text-input-feedback success';
      feedback.textContent = '✅ Time applied: ' + pad(h) + ':' + pad(m) + ' ' + ap + '. Click "Save Custom Reminder Time" below to confirm!';
    }

    // Save Time to Backend
    async function saveCustomTime() {
      const chatId = parseInt(document.getElementById('chatIdInput').value, 10);
      if (isNaN(chatId)) {
        alert("Please specify a valid numeric Chat ID.");
        return;
      }

      const triggerTime = pad(currentHour) + ':' + pad(currentMinute) + ':' + currentAmPm;

      try {
        const response = await fetch('/api/users/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, triggerTime })
        });
        const data = await response.json();

        if (data.chatId || data.success || response.ok) {
          showToast(
            "✅ Time Saved Successfully!",
            "Daily Thirukkural reminder set for <b>" + pad(currentHour) + ":" + pad(currentMinute) + " " + currentAmPm + " IST</b>."
          );

          // Broadcast to any embedding parent window (Companion Simulator / Admin Table)
          try {
            window.parent.postMessage({
              type: 'TIME_PICKER_SAVED',
              chatId: chatId,
              triggerTime: triggerTime
            }, '*');
          } catch (e) {}

          // If inside Telegram WebApp, notify Telegram
          if (window.Telegram && window.Telegram.WebApp) {
            try {
              window.Telegram.WebApp.sendData(triggerTime);
            } catch (e) {
              console.log('Telegram sendData error:', e);
            }
          }
        } else {
          alert(data.error || "Failed to save customized time.");
        }
      } catch (err) {
        console.error(err);
        alert("Network error occurred while saving time.");
      }
    }

    // Disable Reminders
    async function disableReminders() {
      const chatId = parseInt(document.getElementById('chatIdInput').value, 10);
      if (isNaN(chatId)) {
        alert("Please specify a valid numeric Chat ID.");
        return;
      }

      try {
        const response = await fetch('/api/users/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chatId, triggerTime: 'none' })
        });
        const data = await response.json();

        if (data.chatId || data.success || response.ok) {
          showToast(
            "📴 Reminders Disabled",
            "Automatic daily reminders have been turned OFF for Chat ID #" + chatId + "."
          );

          try {
            window.parent.postMessage({
              type: 'TIME_PICKER_SAVED',
              chatId: chatId,
              triggerTime: 'none'
            }, '*');
          } catch (e) {}

          if (window.Telegram && window.Telegram.WebApp) {
            try {
              window.Telegram.WebApp.sendData('none');
            } catch (e) {}
          }
        }
      } catch (err) {
        console.error(err);
        alert("Network error occurred while disabling reminders.");
      }
    }

    function showToast(title, desc) {
      document.getElementById('toastTitle').innerHTML = title;
      document.getElementById('toastDesc').innerHTML = desc;
      document.getElementById('toastModal').style.display = 'flex';
    }

    function closeToastOrTelegram() {
      document.getElementById('toastModal').style.display = 'none';
      if (window.Telegram && window.Telegram.WebApp) {
        try {
          window.Telegram.WebApp.close();
        } catch (e) {}
      }
    }

    // Initialize Telegram WebApp theme integration
    if (window.Telegram && window.Telegram.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  </script>
</body>
</html>`;
}
