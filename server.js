const express = require('express');
const net = require('net');
const fs = require('fs');
const app = express();

// CHANGE THESE TWO LINES ─────────
const PRINTER_IP = '192.168.100.142';
const PRINTER_PORT = 9100;
// ────────────────────────────────

app.use(express.json());

// Serve the front-end page
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kitchen Messenger</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', sans-serif;
      background: #1a1a2e;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 36px;
      width: 100%;
      max-width: 480px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.4);
    }
    .header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 28px;
    }
    .icon { font-size: 32px; }
    h1 { font-size: 22px; color: #1a1a2e; font-weight: 700; }
    p.subtitle { font-size: 13px; color: #888; margin-top: 2px; }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #444;
      margin-bottom: 6px;
    }
    input[type="text"] {
      width: 100%;
      padding: 11px 14px;
      border: 1.5px solid #ddd;
      border-radius: 8px;
      font-size: 14px;
      margin-bottom: 16px;
      transition: border-color 0.2s;
    }
    input[type="text"]:focus {
      outline: none;
      border-color: #6c63ff;
    }
    textarea {
      width: 100%;
      height: 130px;
      padding: 12px 14px;
      border: 1.5px solid #ddd;
      border-radius: 8px;
      font-size: 15px;
      resize: vertical;
      font-family: inherit;
      transition: border-color 0.2s;
      margin-bottom: 20px;
    }
    textarea:focus {
      outline: none;
      border-color: #6c63ff;
    }
    button {
      width: 100%;
      padding: 14px;
      background: #6c63ff;
      color: white;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s;
    }
    button:hover { background: #574fd6; }
    button:active { transform: scale(0.98); }
    button:disabled { background: #aaa; cursor: not-allowed; }
    .status {
      margin-top: 16px;
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      display: none;
      text-align: center;
    }
    .status.success { background: #e8f5e9; color: #2e7d32; display: block; }
    .status.error   { background: #fdecea; color: #c62828; display: block; }
    .status.sending { background: #e3f2fd; color: #1565c0; display: block; }
    .priority-row {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }
    .priority-btn {
      flex: 1;
      padding: 8px;
      border: 1.5px solid #ddd;
      background: white;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      color: #555;
      cursor: pointer;
      transition: all 0.15s;
    }
    .priority-btn.active-normal { border-color: #6c63ff; color: #6c63ff; background: #f0eeff; }
    .priority-btn.active-urgent { border-color: #e53935; color: #e53935; background: #fdecea; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <span class="icon">🍳</span>
      <div>
        <h1>Kitchen Messenger</h1>
        <p class="subtitle">Send a message directly to the kitchen printer</p>
      </div>
    </div>
 
    <label>Your name</label>
    <input type="text" id="sender" placeholder="e.g. Front Cashier" />

    <label>Priority</label>
    <div class="priority-row">
      <button class="priority-btn active-normal" onclick="setPriority('normal', this)">🟢 Normal</button>
      <button class="priority-btn" onclick="setPriority('urgent', this)">🔴 Urgent</button>
    </div>

    <label>Message</label>
    <textarea id="message" placeholder="e.g. Table 4 needs extra napkins..."></textarea>

    <button id="sendBtn" onclick="sendMessage()">🖨️ Print to Kitchen</button>
    <div class="status" id="status"></div>
  </div>

<script>
  let priority = 'normal';

  function setPriority(p, btn) {
    priority = p;
    document.querySelectorAll('.priority-btn').forEach(b => {
      b.className = 'priority-btn';
    });
    btn.className = p === 'urgent' ? 'priority-btn active-urgent' : 'priority-btn active-normal';
  }

  async function sendMessage() {
    const sender  = document.getElementById('sender').value.trim();
    const message = document.getElementById('message').value.trim();
    const status  = document.getElementById('status');
    const btn     = document.getElementById('sendBtn');

    if (!message) {
      status.className = 'status error';
      status.textContent = '⚠️ Please enter a message first.';
      return;
    }

    btn.disabled = true;
    status.className = 'status sending';
    status.textContent = '📡 Sending to printer...';

    try {
      const res = await fetch('/print', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender, message, priority })
      });
      const data = await res.json();
      if (data.success) {
        status.className = 'status success';
        status.textContent = '✅ Printed successfully!';
        document.getElementById('message').value = '';
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      status.className = 'status error';
      status.textContent = '❌ Could not reach printer. Check network connection.';
    } finally {
      btn.disabled = false;
    }
  }
</script>
</body>
</html>`);
});

// Handle print requests
app.post('/print', (req, res) => {
  const { sender, message, priority } = req.body;
  const now = new Date().toLocaleString('en-GB', { hour12: false });

  const ESC = 0x1B;
  const GS  = 0x1D;
  const commands = [];

  const add  = (...bytes) => bytes.forEach(b => commands.push(b));
  const text = (str) => { for (const c of str) commands.push(c.charCodeAt(0)); };
  const newline = (n = 1) => { for (let i = 0; i < n; i++) commands.push(0x0A); };

  add(ESC, 0x40);
  add(ESC, 0x61, 0x01);
  add(ESC, 0x45, 0x01);
  add(GS,  0x21, 0x11);

  if (priority === 'urgent') { text('*** URGENT ***'); newline(); }

  text('KITCHEN MESSAGE');
  newline();
  add(GS, 0x21, 0x00);
  add(ESC, 0x45, 0x00);
  text('--------------------------------');
  newline();
  add(ESC, 0x61, 0x00);
  text('Time:   ' + now);
  newline();
  if (sender) { text('From:   ' + sender); newline(); }
  text('--------------------------------');
  newline();
  add(ESC, 0x45, 0x01);
  text(message);
  add(ESC, 0x45, 0x00);
  newline(2);
  add(ESC, 0x61, 0x01);
  text('[ End of Message ]');
  newline(4);
  add(GS, 0x56, 0x41, 0x03);

  const buffer = Buffer.from(commands);
  const client = new net.Socket();
  let responded = false;

  client.setTimeout(5000);

  client.connect(PRINTER_PORT, PRINTER_IP, () => {
    client.write(buffer, () => {
      client.end();
      if (!responded) { responded = true; res.json({ success: true }); }
    });
  });

  client.on('timeout', () => {
    client.destroy();
    if (!responded) { responded = true; res.json({ success: false, error: 'Printer timed out' }); }
  });

  client.on('error', (err) => {
    if (!responded) { responded = true; res.json({ success: false, error: err.message }); }
  });
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  ✅ Kitchen Messenger is running!');
  console.log('');
  console.log('  Open this in your browser → http://localhost:3000');
  console.log('');
  console.log('  To share with others on the same WiFi, use this');
  console.log('  computer\'s IP address instead of localhost');
  console.log('');
});