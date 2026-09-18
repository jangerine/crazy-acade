const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const ROWS = 15;
const COLS = 15;

const TILE = {
  EMPTY: 0,
  SOLID_BLOCK: 1,
  SOFT_BLOCK: 2,
  BOMB: 3,
  ITEM_BOMB: 4,
  ITEM_RANGE: 5,
  ITEM_SPEED: 6
};

let selectedMap = 'camp';
let isGameStarted = false;
let players = {};
let activeBombs = [];
let explosions = [];
let map = [];

function generateMap(mapType) {
  let newMap = Array.from({ length: ROWS }, () => Array(COLS).fill(TILE.EMPTY));

  // 기본 파괴 불가 블록
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (r % 2 === 1 && c % 2 === 1) {
        newMap[r][c] = TILE.SOLID_BLOCK;
      }
    }
  }

  // 캠프08 다리 영역 제외 파괴 가능 블록 생성
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (newMap[r][c] === TILE.EMPTY) {
        if ((r <= 1 && c <= 1) || (r >= ROWS - 2 && c >= COLS - 2)) continue;
        if (mapType === 'camp' && c === 7) continue; // 중앙 통나무 다리 길

        if (Math.random() < 0.6) {
          newMap[r][c] = TILE.SOFT_BLOCK;
        }
      }
    }
  }
  return newMap;
}

map = generateMap(selectedMap);

io.on('connection', (socket) => {
  console.log('플레이어 접속:', socket.id);

  const playerCount = Object.keys(players).length;
  const pNum = playerCount === 0 ? 1 : 2;
  const startX = pNum === 1 ? 0 : COLS - 1;
  const startY = pNum === 1 ? 0 : ROWS - 1;

  players[socket.id] = {
    id: socket.id,
    pNum: pNum,
    x: startX,
    y: startY,
    color: pNum === 1 ? '#ef4444' : '#3b82f6',
    maxBombs: 1,
    bombRange: 1,
    speed: 1,
    isAlive: true
  };

  socket.emit('init', {
    id: socket.id,
    map,
    players,
    selectedMap,
    isGameStarted
  });

  socket.broadcast.emit('playerJoined', players[socket.id]);

  socket.on('selectMap', (mapName) => {
    if (players[socket.id]?.pNum === 1 && !isGameStarted) {
      selectedMap = mapName;
      map = generateMap(selectedMap);
      io.emit('mapChanged', { selectedMap, map });
    }
  });

  socket.on('startGame', () => {
    if (players[socket.id]?.pNum === 1 && !isGameStarted) {
      isGameStarted = true;
      map = generateMap(selectedMap);
      activeBombs = [];
      explosions = [];

      Object.values(players).forEach(p => {
        p.x = p.pNum === 1 ? 0 : COLS - 1;
        p.y = p.pNum === 1 ? 0 : ROWS - 1;
        p.maxBombs = 1;
        p.bombRange = 1;
        p.speed = 1;
        p.isAlive = true;
      });

      io.emit('gameStarted', { map, players });
    }
  });

  // 💣 정확한 클라이언트 좌표 수신 방식
  socket.on('placeBomb', (data) => {
    if (!isGameStarted) return;
    const player = players[socket.id];
    if (!player || !player.isAlive) return;

    let col = (data && typeof data.col === 'number') ? data.col : Math.round(player.x);
    let row = (data && typeof data.row === 'number') ? data.row : Math.round(player.y);

    if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;
    if (map[row][col] !== TILE.EMPTY) return;

    const myBombsCount = activeBombs.filter(b => b.ownerId === socket.id).length;
    if (myBombsCount >= player.maxBombs) return;

    map[row][col] = TILE.BOMB;

    const bomb = {
      r: row,
      c: col,
      ownerId: socket.id,
      range: player.bombRange,
      timer: setTimeout(() => explodeBomb(row, col), 3000)
    };

    activeBombs.push(bomb);
    io.emit('gameState', { map, players, explosions, isGameStarted });
  });

  socket.on('move', (dir) => {
    if (!isGameStarted) return;
    const player = players[socket.id];
    if (!player || !player.isAlive) return;

    const step = 0.2 + (player.speed - 1) * 0.05;
    let nextX = player.x;
    let nextY = player.y;

    if (dir === 'up') nextY -= step;
    if (dir === 'down') nextY += step;
    if (dir === 'left') nextX -= step;
    if (dir === 'right') nextX += step;

    player.x = Math.max(0, Math.min(COLS - 1, nextX));
    player.y = Math.max(0, Math.min(ROWS - 1, nextY));

    // 아이템 획득 로직
    const gridR = Math.floor(player.y + 0.5);
    const gridC = Math.floor(player.x + 0.5);
    const tile = map[gridR] ? map[gridR][gridC] : 0;

    if (tile === TILE.ITEM_BOMB) {
      player.maxBombs = Math.min(8, player.maxBombs + 1);
      map[gridR][gridC] = TILE.EMPTY;
    } else if (tile === TILE.ITEM_RANGE) {
      player.bombRange = Math.min(8, player.bombRange + 1);
      map[gridR][gridC] = TILE.EMPTY;
    } else if (tile === TILE.ITEM_SPEED) {
      player.speed = Math.min(5, player.speed + 1);
      map[gridR][gridC] = TILE.EMPTY;
    }

    io.emit('gameState', { map, players, explosions, isGameStarted });
  });

  socket.on('restartGame', () => {
    isGameStarted = false;
    map = generateMap(selectedMap);
    io.emit('returnToLobby', { map, players });
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    if (Object.keys(players).length === 0) isGameStarted = false;
    io.emit('playerLeft', socket.id);
  });
});

function explodeBomb(r, c) {
  const bombIdx = activeBombs.findIndex(b => b.r === r && b.c === c);
  if (bombIdx === -1) return;

  const bomb = activeBombs[bombIdx];
  clearTimeout(bomb.timer);
  activeBombs.splice(bombIdx, 1);

  map[r][c] = TILE.EMPTY;
  const currentExplosions = [{ x: c, y: r }];

  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  dirs.forEach(([dr, dc]) => {
    for (let i = 1; i <= bomb.range; i++) {
      const nr = r + dr * i;
      const nc = c + dc * i;

      if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) break;

      const tile = map[nr][nc];
      if (tile === TILE.SOLID_BLOCK) break;

      currentExplosions.push({ x: nc, y: nr });

      if (tile === TILE.SOFT_BLOCK) {
        const rand = Math.random();
        if (rand < 0.25) map[nr][nc] = TILE.ITEM_BOMB;
        else if (rand < 0.5) map[nr][nc] = TILE.ITEM_RANGE;
        else if (rand < 0.75) map[nr][nc] = TILE.ITEM_SPEED;
        else map[nr][nc] = TILE.EMPTY;
        break;
      }

      if (tile === TILE.BOMB) {
        explodeBomb(nr, nc);
        break;
      }
    }
  });

  explosions.push(...currentExplosions);

  // 피격 판정
  Object.values(players).forEach(p => {
    if (!p.isAlive) return;
    const pR = Math.floor(p.y + 0.5);
    const pC = Math.floor(p.x + 0.5);

    if (currentExplosions.some(e => e.x === pC && e.y === pR)) {
      p.isAlive = false;
    }
  });

  io.emit('gameState', { map, players, explosions, isGameStarted });

  // 승패 판정
  const alivePlayers = Object.values(players).filter(p => p.isAlive);
  if (alivePlayers.length <= 1 && isGameStarted) {
    const winnerText = alivePlayers.length === 1 ? `Player ${alivePlayers[0].pNum}` : '무승부!';
    io.emit('gameOver', { winner: winnerText });
  }

  setTimeout(() => {
    explosions = explosions.filter(e => !currentExplosions.includes(e));
    io.emit('gameState', { map, players, explosions, isGameStarted });
  }, 500);
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
