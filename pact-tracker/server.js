const express = require('express');
const fs = require('fs');
const path = require('path');
 
const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'store.json');
 
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
 
// ─── SSE clients management ───
const clients = new Set();
 
function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) {
    try { res.write(payload); } catch (e) { clients.delete(res); }
  }
}
 
app.get('/api/sse', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });
  res.write(':\n\n'); // initial comment to keep connection alive
  clients.add(res);
  req.on('close', () => clients.delete(res));
});
 
// ─── Data helpers ───
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
    }
  } catch (e) { console.error('Load error:', e.message); }
  return { totalBoba: 0, history: {} };
}
 
function saveData(data) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
}
 
// ─── GET current state ───
app.get('/api/state', (req, res) => {
  const data = loadData();
  res.json({
    totalBoba: data.totalBoba || 0,
    history: data.history || {}
  });
});
 
// ─── POST update ───
app.post('/api/update', (req, res) => {
  const { date, meals, bobaAdded, totalBoba, cigarettes } = req.body;
  if (!date) return res.status(400).json({ error: 'date required' });
 
  const data = loadData();
  if (!data.history) data.history = {};
 
  data.totalBoba = totalBoba !== undefined ? totalBoba : data.totalBoba;
  data.history[date] = {
    meals: meals !== undefined ? meals : 0,
    bobaAdded: bobaAdded !== undefined ? bobaAdded : 0,
    cigarettes: cigarettes !== undefined ? cigarettes : 0
  };
 
  saveData(data);
 
  // Broadcast to all other clients
  broadcast('update', {
    date,
    meals: data.history[date].meals,
    bobaAdded: data.history[date].bobaAdded,
    cigarettes: data.history[date].cigarettes,
    totalBoba: data.totalBoba
  });
 
  res.json({ ok: true });
});
 
// ─── Fallback: serve index.html for any unmatched route ───
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});
 
app.listen(PORT, () => {
  console.log(`Pact Tracker running on port ${PORT}`);
});
 
