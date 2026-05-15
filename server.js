const express = require('express');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true })); // needed for printer's form data

// In-memory print queue
let printQueue = [];

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
    input[type="text"]:focus { outline: none; border-color: #6c63ff; }
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
    textarea:focus { outline: none; border-color: #6c63ff; }
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
    .priority-row { display: flex; gap: 8px; margin-bottom: 16px; }
    .priority-btn {
      flex: 1; padding: 8px;
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
    document.querySelectorAll('.priority-btn').forEach(b => b.className = 'priority-btn');
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
      const res = await fetch('/add-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender, message, priority })
      });
      const data = await res.json();
      if (data.success) {
        status.className = 'status success';
        status.textContent = '✅ Sent! Printer will print shortly.';
        document.getElementById('message').value = '';
      } else {
        throw new Error(data.error);
      }
    } catch (err) {
      status.className = 'status error';
      status.textContent = '❌ Could not send. Check connection.';
    } finally {
      btn.disabled = false;
    }
  }
</script>
</body>
</html>`);
});

// Website posts a new print job here
app.post('/add-job', (req, res) => {
  const { sender, message, priority } = req.body;
  if (!message) return res.json({ success: false, error: 'No message' });
  printQueue.push({ sender, message, priority, time: new Date() });
  console.log(`📥 Job added. Queue size: ${printQueue.length}`);
  res.json({ success: true });
});

// Printer polls this endpoint via POST every 2 seconds
// Printer sends application/x-www-form-urlencoded, expects text/xml back
app.post('/print', (req, res) => {
  console.log(`🔔 Printer polled. Queue size: ${printQueue.length}`);

  if (printQueue.length === 0) {
    // Nothing to print — send empty response
    res.set('Content-Type', 'text/xml; charset=utf-8');
    return res.send(`<?xml version="1.0" encoding="utf-8"?><PrintRequestInfo Version="2.00"></PrintRequestInfo>`);
  }

  const job = printQueue.shift();
  const now = job.time.toLocaleString('en-GB', { hour12: false });
  console.log(`🖨️ Sending job: "${job.message}"`);

  const urgentLine = job.priority === 'urgent'
    ? `<text width="2" height="2">*** URGENT ***\n</text>`
    : '';

  const senderLine = job.sender
    ? `<text>From:   ${job.sender}\n</text>`
    : '';

  const xml = `<?xml version="1.0" encoding="utf-8"?>
<PrintRequestInfo Version="2.00">
  <PrintData>
    <epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">
      <text align="center"/>
      <text width="2" height="2" b="true">KITCHEN MSG\n</text>
      ${urgentLine}
      <text width="1" height="1" b="false"/>
      <text align="left"/>
      <text>--------------------------------\n</text>
      <text>Time:   ${now}\n</text>
      ${senderLine}
      <text>--------------------------------\n</text>
      <text b="true">${job.message}\n</text>
      <text b="false"/>
      <feed line="4"/>
      <cut type="feed"/>
    </epos-print>
  </PrintData>
</PrintRequestInfo>`;

  res.set('Content-Type', 'text/xml; charset=utf-8');
  res.send(xml);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  ✅ Kitchen Messenger running on port ${PORT}\n`);
});
