// Lokalny serwer do gry w kółko i krzyżyk po sieci LAN.
// Start: npm install && npm start
// Potem otwórz w przeglądarce: http://<adres-IP-twojego-komputera>:3000

const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const RANKING_FILE = path.join(__dirname, 'ranking.json');

// ---------- ranking persistence ----------
let ranking = {};
try {
  ranking = JSON.parse(fs.readFileSync(RANKING_FILE, 'utf8'));
} catch (e) {
  ranking = {};
}

function saveRanking() {
  fs.writeFile(RANKING_FILE, JSON.stringify(ranking, null, 2), () => {});
}

function ensureRankingEntry(name) {
  if (!ranking[name]) ranking[name] = { wins: 0, draws: 0, losses: 0 };
}

function recordResult(winnerName, loserName) {
  ensureRankingEntry(winnerName);
  ensureRankingEntry(loserName);
  ranking[winnerName].wins++;
  ranking[loserName].losses++;
  saveRanking();
}

function recordDraw(nameA, nameB) {
  ensureRankingEntry(nameA);
  ensureRankingEntry(nameB);
  ranking[nameA].draws++;
  if (nameB !== nameA) ranking[nameB].draws++;
  saveRanking();
}

function rankingList() {
  return Object.entries(ranking)
    .map(([name, rec]) => ({ name, ...rec }))
    .sort((a, b) => b.wins - a.wins || b.draws - a.draws);
}

// ---------- static file server ----------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(PUBLIC_DIR, path.normalize(filePath).replace(/^(\.\.[/\\])+/, ''));
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Nie znaleziono');
      return;
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

// ---------- game rooms ----------
// rooms[code] = { players: { X: ws|null, O: ws|null }, names: { X, O }, board, current, gameOver, scores }
const rooms = {};
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do {
    code = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms[code]);
  return code;
}

function freshRoom() {
  return {
    players: { X: null, O: null },
    names: { X: '', O: '' },
    board: Array(9).fill(null),
    current: 'X',
    gameOver: false,
    scores: { X: 0, O: 0, D: 0 },
  };
}

function checkWin(board) {
  for (const line of LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[b] === board[c]) return line;
  }
  return null;
}

function send(ws, msg) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

function broadcastState(code, extra = {}) {
  const room = rooms[code];
  if (!room) return;
  const payload = {
    type: 'state',
    board: room.board,
    current: room.current,
    gameOver: room.gameOver,
    scores: room.scores,
    names: room.names,
    ...extra,
  };
  send(room.players.X, payload);
  send(room.players.O, payload);
}

function broadcastRanking(ws) {
  send(ws, { type: 'ranking', data: rankingList() });
}

wss.on('connection', (ws) => {
  ws.roomCode = null;
  ws.symbol = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'create') {
      const code = makeCode();
      rooms[code] = freshRoom();
      const room = rooms[code];
      room.players.X = ws;
      room.names.X = (msg.name || 'Gracz X').slice(0, 16);
      ws.roomCode = code;
      ws.symbol = 'X';
      send(ws, { type: 'created', code, symbol: 'X' });
      return;
    }

    if (msg.type === 'join') {
      const code = (msg.code || '').toUpperCase();
      const room = rooms[code];
      if (!room) {
        send(ws, { type: 'error', message: 'Nie znaleziono pokoju o tym kodzie.' });
        return;
      }
      if (room.players.O) {
        send(ws, { type: 'error', message: 'Ten pokój jest już pełny.' });
        return;
      }
      room.players.O = ws;
      room.names.O = (msg.name || 'Gracz O').slice(0, 16);
      ws.roomCode = code;
      ws.symbol = 'O';
      send(ws, { type: 'joined', code, symbol: 'O' });
      broadcastState(code, { status: 'Ruch gracza: ' + room.names.X });
      return;
    }

    if (msg.type === 'move') {
      const room = rooms[ws.roomCode];
      if (!room || room.gameOver) return;
      if (ws.symbol !== room.current) return;
      const i = msg.index;
      if (typeof i !== 'number' || i < 0 || i > 8 || room.board[i]) return;

      room.board[i] = room.current;
      const winLine = checkWin(room.board);

      if (winLine) {
        room.gameOver = true;
        room.scores[room.current]++;
        const winnerName = room.names[room.current];
        const loserName = room.names[room.current === 'X' ? 'O' : 'X'];
        recordResult(winnerName, loserName);
        broadcastState(ws.roomCode, { winLine, status: `Wygrywa ${winnerName}!`, finished: 'win' });
        return;
      }

      if (room.board.every((c) => c !== null)) {
        room.gameOver = true;
        room.scores.D++;
        recordDraw(room.names.X, room.names.O);
        broadcastState(ws.roomCode, { status: 'Remis!', finished: 'draw' });
        return;
      }

      room.current = room.current === 'X' ? 'O' : 'X';
      broadcastState(ws.roomCode, { status: 'Ruch gracza: ' + room.names[room.current] });
      return;
    }

    if (msg.type === 'restart') {
      const room = rooms[ws.roomCode];
      if (!room) return;
      room.board = Array(9).fill(null);
      room.current = 'X';
      room.gameOver = false;
      broadcastState(ws.roomCode, { status: 'Ruch gracza: ' + room.names.X });
      return;
    }

    if (msg.type === 'getRanking') {
      broadcastRanking(ws);
      return;
    }

    if (msg.type === 'clearRanking') {
      ranking = {};
      saveRanking();
      broadcastRanking(ws);
      return;
    }
  });

  ws.on('close', () => {
    const room = rooms[ws.roomCode];
    if (!room) return;
    if (ws.symbol === 'X') room.players.X = null;
    if (ws.symbol === 'O') room.players.O = null;
    const other = ws.symbol === 'X' ? room.players.O : room.players.X;
    send(other, { type: 'opponentLeft' });
    if (!room.players.X && !room.players.O) {
      delete rooms[ws.roomCode];
    }
  });
});

server.listen(PORT, () => {
  const nets = os.networkInterfaces();
  const addresses = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) addresses.push(net.address);
    }
  }
  console.log('');
  console.log('Serwer kółko i krzyżyk działa!');
  console.log('  Na tym komputerze:  http://localhost:' + PORT);
  addresses.forEach((addr) => {
    console.log('  W sieci lokalnej:   http://' + addr + ':' + PORT);
  });
  console.log('');
  console.log('Udostępnij adres "W sieci lokalnej" innym osobom w tej samej sieci Wi-Fi/LAN.');
  console.log('');
});
