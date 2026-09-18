const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const PORT = 3000;
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

// 🗺️ 맵 템플릿 정의
const MAP_TEMPLATES = {
  camp: [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,2,2,2,0,0,0,2,2,2,0,0,1],
    [1,0,1,2,1,2,1,0,1,2,1,2,1,0,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,2,1,2,1,2,1,2,1,2,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,0,1,2,1,0,1,0,1,0,1,2,1,0,1],
    [1,0,0,2,2,0,0,0,0,0,2,2,0,0,1],
    [1,0,1,2,1,0,1,0,1,0,1,2,1,0,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,2,1,2,1,2,1,2,1,2,1,2,1,2,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,0,1,2,1,2,1,0,1,2,1,2,1,0,1],
    [1,0,0,2,2,2,0,0,0,2,2,2,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ],
  patrit: [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,1,2,2,2,1,0,0,0,0,1],
    [1,0,1,1,0,1,2,1,2,1,0,1,1,0,1],
    [1,0,1,1,0,0,2,2,2,0,0,1,1,0,1],
    [1,0,0,0,0,1,1,0,1,1,0,0,0,0,1],
    [1,1,1,0,1,2,2,2,2,2,1,0,1,1,1],
    [1,2,2,2,1,2,1,2,1,2,1,2,2,2,1],
    [1,2,1,2,0,2,2,0,2,2,0,2,1,2,1],
    [1,2,2,2,1,2,1,2,1,2,1,2,2,2,1],
    [1,1,1,0,1,2,2,2,2,2,1,0,1,1,1],
    [1,0,0,0,0,1,1,0,1,1,0,0,0,0,1],
    [1,0,1,1,0,0,2,2,2,0,0,1,1,0,1],
    [1,0,1,1,0,1,2,1,2,1,0,1,1,0,1],
    [1,0,0,0,0,1,2,2,2,1,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ],
  factory: [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,2,1,2,0,0,0,2,1,2,0,0,1],
    [1,0,1,2,1,2,1,1,1,2,1,2,1,0,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,1,1,2,1,1,1,0,1,1,1,2,1,1,1],
    [1,2,2,2,2,0,2,2,2,0,2,2,2,2,1],
    [1,0,1,2,1,2,1,0,1,2,1,2,1,0,1],
    [1,0,1,2,0,2,0,0,0,2,0,2,1,0,1],
    [1,0,1,2,1,2,1,0,1,2,1,2,1,0,1],
    [1,2,2,2,2,0,2,2,2,0,2,2,2,2,1],
    [1,1,1,2,1,1,1,0,1,1,1,2,1,1,1],
    [1,2,2,2,2,2,2,2,2,2,2,2,2,2,1],
    [1,0,1,2,1,2,1,1,1,2,1,2,1,0,1],
    [1,0,0,2,1,2,0,0,0,2,1,2,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
  ]
};

let selectedMapName = 'camp';
let map = JSON.parse(JSON.stringify(MAP_TEMPLATES[selectedMapName]));
let players = {};
let playerColors = ['#FF4136', '#0074D9', '#2ECC40', '#FFDC00'];
let spawnPoints = [
  { x: 1, y: 1 },
  { x: 13, y: 13 },
  { x: 13, y: 1 },
  { x: 1, y: 13 }
];

let isGameStarted = false;
let explosions = [];

function cloneMap(templateName) {
  return JSON.parse(JSON.stringify(MAP_TEMPLATES[templateName]));
}

io.on('connection', (socket) => {
  console.log(`플레이어 접속: ${socket.id}`);

  const pNum = Object.keys(players).length + 1;
  const spawn = spawnPoints[(pNum - 1) % spawnPoints.length];

  players[socket.id] = {
    id: socket.id,
    pNum: pNum,
    x: spawn.x,
    y: spawn.y,
    color: playerColors[(pNum - 1) % playerColors.length],
    maxBombs: 1,
    currentBombs: 0,
    bombRange: 1,
    speed: 1,
    isAlive: true
  };

  socket.emit('init', {
    id: socket.id,
    map: map,
    players: players,
    isGameStarted: isGameStarted,
    selectedMap: selectedMapName
  });

  socket.broadcast.emit('playerJoined', players[socket.id]);

  socket.on('selectMap', (mapName) => {
    if (players[socket.id] && players[socket.id].pNum === 1 && !isGameStarted) {
      if (MAP_TEMPLATES[mapName]) {
        selectedMapName = mapName;
        map = cloneMap(selectedMapName);
        io.emit('mapChanged', { selectedMap: selectedMapName, map: map });
      }
    }
  });

  socket.on('startGame', () => {
    if (players[socket.id] && players[socket.id].pNum === 1 && !isGameStarted) {
      isGameStarted = true;
      map = cloneMap(selectedMapName);
      
      Object.keys(players).forEach((id, idx) => {
        const sp = spawnPoints[idx % spawnPoints.length];
        players[id].x = sp.x;
        players[id].y = sp.y;
        players[id].maxBombs = 1;
        players[id].currentBombs = 0;
        players[id].bombRange = 1;
        players[id].speed = 1;
        players[id].isAlive = true;
      });

      io.emit('gameStarted', { map: map, players: players });
    }
  });

  // 🏃‍♂️ 서버 측 방향 이동 검사 로직 철거 -> 클라이언트 이동 신호 수용 및 동기화
  socket.on('move', (dir) => {
    const player = players[socket.id];
    if (!player || !player.isAlive || !isGameStarted) return;

    let nx = player.x;
    let ny = player.y;

    if (dir === 'up') ny -= 1;
    if (dir === 'down') ny += 1;
    if (dir === 'left') nx -= 1;
    if (dir === 'right') nx += 1;

    // 타일 경계선 내에 존재할 경우 위치 업데이트 (클라이언트 부드러운 위치 수용)
    if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
      player.x = nx;
      player.y = ny;
    }

    // 아이템 획득 처리
    const tileX = Math.round(player.x);
    const tileY = Math.round(player.y);
    if (map[tileY] && map[tileY][tileX]) {
      const currentTile = map[tileY][tileX];
      if (currentTile === TILE.ITEM_BOMB) {
        player.maxBombs = Math.min(player.maxBombs + 1, 6);
        map[tileY][tileX] = TILE.EMPTY;
      } else if (currentTile === TILE.ITEM_RANGE) {
        player.bombRange = Math.min(player.bombRange + 1, 8);
        map[tileY][tileX] = TILE.EMPTY;
      } else if (currentTile === TILE.ITEM_SPEED) {
        player.speed = Math.min(player.speed + 1, 5);
        map[tileY][tileX] = TILE.EMPTY;
      }
    }
  });

  socket.on('placeBomb', () => {
    const player = players[socket.id];
    if (!player || !player.isAlive || !isGameStarted) return;

    if (player.currentBombs >= player.maxBombs) return;

    const bx = Math.round(player.x);
    const by = Math.round(player.y);

    if (map[by] && map[by][bx] === TILE.EMPTY) {
      map[by][bx] = TILE.BOMB;
      player.currentBombs++;

      setTimeout(() => {
        explodeBomb(bx, by, player.bombRange, socket.id);
      }, 3000);
    }
  });

  socket.on('restartGame', () => {
    isGameStarted = false;
    map = cloneMap(selectedMapName);
    io.emit('returnToLobby', { map: map, players: players });
  });

  socket.on('disconnect', () => {
    console.log(`플레이어 퇴장: ${socket.id}`);
    delete players[socket.id];
    io.emit('playerLeft', socket.id);
  });
});

function explodeBomb(bx, by, range, ownerId) {
  if (map[by] && map[by][bx] !== TILE.BOMB) return;

  if (players[ownerId]) {
    players[ownerId].currentBombs = Math.max(0, players[ownerId].currentBombs - 1);
  }

  map[by][bx] = TILE.EMPTY;
  const currentExplosions = [{ x: bx, y: by }];

  const directions = [
    { x: 0, y: -1 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 1, y: 0 }
  ];

  directions.forEach(dir => {
    for (let i = 1; i <= range; i++) {
      const ex = bx + dir.x * i;
      const ey = by + dir.y * i;

      if (ex < 0 || ex >= COLS || ey < 0 || ey >= ROWS) break;

      const tile = map[ey][ex];

      if (tile === TILE.SOLID_BLOCK) {
        break;
      }

      currentExplosions.push({ x: ex, y: ey });

      if (tile === TILE.SOFT_BLOCK) {
        const rand = Math.random();
        if (rand < 0.25) map[ey][ex] = TILE.ITEM_BOMB;
        else if (rand < 0.50) map[ey][ex] = TILE.ITEM_RANGE;
        else if (rand < 0.70) map[ey][ex] = TILE.ITEM_SPEED;
        else map[ey][ex] = TILE.EMPTY;
        break;
      }

      if ([TILE.ITEM_BOMB, TILE.ITEM_RANGE, TILE.ITEM_SPEED].includes(tile)) {
        map[ey][ex] = TILE.EMPTY;
        break;
      }
    }
  });

  explosions.push(...currentExplosions);

  // 폭발에 맞은 플레이어 체크
  Object.values(players).forEach(p => {
    if (!p.isAlive) return;
    const px = Math.round(p.x);
    const py = Math.round(p.y);

    const hit = currentExplosions.some(e => e.x === px && e.y === py);
    if (hit) {
      p.isAlive = false;
    }
  });

  setTimeout(() => {
    explosions = explosions.filter(e => !currentExplosions.includes(e));
  }, 400);

  checkGameOver();
}

function checkGameOver() {
  const alivePlayers = Object.values(players).filter(p => p.isAlive);

  if (alivePlayers.length <= 1 && Object.keys(players).length > 1) {
    const winnerText = alivePlayers.length === 1 ? `Player ${alivePlayers[0].pNum}` : '무승부';
    io.emit('gameOver', { winner: winnerText });
  }
}

// 60FPS 서버 루프 (상태 브로드캐스트)
setInterval(() => {
  io.emit('gameState', {
    map: map,
    players: players,
    explosions: explosions
  });
}, 1000 / 60);

server.listen(PORT, () => {
  console.log(`서버 구동 완료: http://localhost:${PORT}`);
});
