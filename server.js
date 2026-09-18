const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(__dirname + '/public'));

const ROWS = 15;
const COLS = 15;

// 타일 및 아이템 타입 정의
const TILE = {
  EMPTY: 0,
  SOLID_BLOCK: 1,
  SOFT_BLOCK: 2,
  BOMB: 3,
  ITEM_BOMB: 4,  // 물풍선 +1
  ITEM_RANGE: 5, // 물줄기 +1
  ITEM_SPEED: 6  // 스피드 +1
};

// ⛺ 프리셋 맵 데이터
const MAP_PRESETS = {
  camp: [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 2, 2, 0, 1, 1, 1, 0, 2, 2, 0, 0, 1],
    [1, 0, 1, 2, 1, 2, 0, 1, 0, 2, 1, 2, 1, 0, 1],
    [1, 2, 2, 0, 2, 2, 2, 1, 2, 2, 2, 0, 2, 2, 1],
    [1, 2, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1, 2, 1],
    [1, 0, 2, 2, 2, 2, 0, 1, 0, 2, 2, 2, 2, 0, 1],
    [1, 1, 0, 1, 0, 1, 2, 1, 2, 1, 0, 1, 0, 1, 1],
    [1, 1, 1, 2, 2, 2, 0, 1, 0, 2, 2, 2, 1, 1, 1],
    [1, 1, 0, 1, 0, 1, 2, 1, 2, 1, 0, 1, 0, 1, 1],
    [1, 0, 2, 2, 2, 2, 0, 1, 0, 2, 2, 2, 2, 0, 1],
    [1, 2, 1, 2, 1, 0, 2, 1, 2, 0, 1, 2, 1, 2, 1],
    [1, 2, 2, 0, 2, 2, 2, 1, 2, 2, 2, 0, 2, 2, 1],
    [1, 0, 1, 2, 1, 2, 0, 1, 0, 2, 1, 2, 1, 0, 1],
    [1, 0, 0, 2, 2, 0, 1, 1, 1, 0, 2, 2, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  ],
  patrit: [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 2, 2, 2, 1, 2, 1, 2, 2, 2, 0, 0, 1],
    [1, 0, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 1],
    [1, 2, 1, 2, 2, 2, 2, 0, 2, 2, 2, 2, 1, 2, 1],
    [1, 2, 2, 2, 1, 1, 2, 1, 2, 1, 1, 2, 2, 2, 1],
    [1, 2, 1, 2, 1, 0, 0, 2, 0, 0, 1, 2, 1, 2, 1],
    [1, 1, 2, 2, 2, 0, 1, 1, 1, 0, 2, 2, 2, 1, 1],
    [1, 2, 1, 0, 1, 2, 1, 1, 1, 2, 1, 0, 1, 2, 1],
    [1, 1, 2, 2, 2, 0, 1, 1, 1, 0, 2, 2, 2, 1, 1],
    [1, 2, 1, 2, 1, 0, 0, 2, 0, 0, 1, 2, 1, 2, 1],
    [1, 2, 2, 2, 1, 1, 2, 1, 2, 1, 1, 2, 2, 2, 1],
    [1, 2, 1, 2, 2, 2, 2, 0, 2, 2, 2, 2, 1, 2, 1],
    [1, 0, 1, 2, 1, 2, 1, 2, 1, 2, 1, 2, 1, 0, 1],
    [1, 0, 0, 2, 2, 2, 1, 2, 1, 2, 2, 2, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  ],
  factory: [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 1, 0, 0, 1],
    [1, 0, 1, 1, 2, 1, 2, 1, 2, 1, 2, 1, 1, 0, 1],
    [1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1],
    [1, 2, 2, 2, 1, 2, 1, 2, 1, 2, 1, 2, 2, 2, 1],
    [1, 2, 1, 2, 2, 2, 2, 1, 2, 2, 2, 2, 1, 2, 1],
    [1, 2, 2, 2, 1, 2, 1, 2, 1, 2, 1, 2, 2, 2, 1],
    [1, 2, 1, 2, 2, 1, 2, 0, 2, 1, 2, 2, 1, 2, 1],
    [1, 2, 2, 2, 1, 2, 1, 2, 1, 2, 1, 2, 2, 2, 1],
    [1, 2, 1, 2, 2, 2, 2, 1, 2, 2, 2, 2, 1, 2, 1],
    [1, 2, 2, 2, 1, 2, 1, 2, 1, 2, 1, 2, 2, 2, 1],
    [1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1],
    [1, 0, 1, 1, 2, 1, 2, 1, 2, 1, 2, 1, 1, 0, 1],
    [1, 0, 0, 1, 2, 2, 2, 2, 2, 2, 2, 1, 0, 0, 1],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
  ]
};

let currentMapKey = 'camp';
let map = [];
let players = {};
let bombs = [];
let explosions = [];
let isGameOver = false;
let isGameStarted = false;

function loadSelectedMap(key) {
  if (MAP_PRESETS[key]) {
    currentMapKey = key;
    map = JSON.parse(JSON.stringify(MAP_PRESETS[key]));
  }
}

function resetGameRound() {
  loadSelectedMap(currentMapKey);
  bombs = [];
  explosions = [];
  isGameOver = false;

  Object.values(players).forEach(p => {
    const isFirst = p.pNum === 1;
    p.x = isFirst ? 1 : COLS - 2;
    p.y = isFirst ? 1 : ROWS - 2;
    p.maxBombs = 1;
    p.bombRange = 1;
    p.speed = 1;
    p.activeBombs = 0;
    p.isAlive = true;
    p.lastMoveTime = 0;
  });
}

loadSelectedMap('camp');

io.on('connection', (socket) => {
  const playerKeys = Object.keys(players);
  if (playerKeys.length >= 2) {
    socket.emit('full', '방이 가득 찼습니다.');
    socket.disconnect();
    return;
  }

  const isFirst = playerKeys.length === 0 || !Object.values(players).some(p => p.pNum === 1);
  const assignedNum = isFirst ? 1 : 2;

  players[socket.id] = {
    id: socket.id,
    pNum: assignedNum,
    x: assignedNum === 1 ? 1 : COLS - 2,
    y: assignedNum === 1 ? 1 : ROWS - 2,
    color: assignedNum === 1 ? '#2ECC71' : '#E74C3C',
    maxBombs: 1,
    bombRange: 1,
    speed: 1,
    activeBombs: 0,
    isAlive: true,
    lastMoveTime: 0
  };

  socket.emit('init', {
    id: socket.id,
    map,
    players,
    selectedMap: currentMapKey,
    isGameStarted
  });

  socket.broadcast.emit('playerJoined', players[socket.id]);

  socket.on('selectMap', (mapKey) => {
    if (!isGameStarted && players[socket.id]?.pNum === 1) {
      loadSelectedMap(mapKey);
      io.emit('mapChanged', { selectedMap: currentMapKey, map });
    }
  });

  socket.on('startGame', () => {
    if (!isGameStarted && players[socket.id]?.pNum === 1) {
      isGameStarted = true;
      resetGameRound();
      io.emit('gameStarted', { map, players });
    }
  });

  socket.on('move', (dir) => {
    if (!isGameStarted || isGameOver) return;
    const p = players[socket.id];
    if (!p || !p.isAlive) return;

    let nx = p.x;
    let ny = p.y;
    if (dir === 'up') ny--;
    if (dir === 'down') ny++;
    if (dir === 'left') nx--;
    if (dir === 'right') nx++;

    if (nx >= 0 && nx < COLS && ny >= 0 && ny < ROWS) {
      const target = map[ny][nx];
      if (target !== TILE.SOLID_BLOCK && target !== TILE.SOFT_BLOCK && target !== TILE.BOMB) {
        p.x = nx;
        p.y = ny;

        // 아이템 획득 처리
        if (target === TILE.ITEM_BOMB) {
          p.maxBombs++;
          map[ny][nx] = TILE.EMPTY;
        } else if (target === TILE.ITEM_RANGE) {
          p.bombRange++;
          map[ny][nx] = TILE.EMPTY;
        } else if (target === TILE.ITEM_SPEED) {
          p.speed = Math.min(5, p.speed + 1); // 최대 스피드 5 제한
          map[ny][nx] = TILE.EMPTY;
        }
      }
    }
  });

  socket.on('placeBomb', () => {
    if (!isGameStarted || isGameOver) return;
    const p = players[socket.id];
    if (!p || !p.isAlive) return;

    if (p.activeBombs < p.maxBombs && map[p.y][p.x] !== TILE.BOMB) {
      p.activeBombs++;
      map[p.y][p.x] = TILE.BOMB;
      bombs.push({
        ownerId: socket.id,
        x: p.x,
        y: p.y,
        range: p.bombRange,
        createdAt: Date.now(),
        timer: 3000
      });
    }
  });

  socket.on('restartGame', () => {
    isGameStarted = false;
    resetGameRound();
    io.emit('returnToLobby', { selectedMap: currentMapKey, map, players });
  });

  socket.on('disconnect', () => {
    delete players[socket.id];
    io.emit('playerLeft', socket.id);
    if (Object.keys(players).length === 0) {
      isGameStarted = false;
      resetGameRound();
    }
  });
});

// 게임 업데이트 루프
setInterval(() => {
  if (!isGameStarted) return;

  const now = Date.now();
  explosions = explosions.filter(exp => now - exp.createdAt < 500);

  if (!isGameOver) {
    bombs = bombs.filter(bomb => {
      if (now - bomb.createdAt >= bomb.timer) {
        map[bomb.y][bomb.x] = TILE.EMPTY;
        if (players[bomb.ownerId]) {
          players[bomb.ownerId].activeBombs = Math.max(0, players[bomb.ownerId].activeBombs - 1);
        }

        const dirs = [[0,0], [1,0], [-1,0], [0,1], [0,-1]];
        dirs.forEach(([dx, dy]) => {
          for (let i = (dx === 0 && dy === 0 ? 0 : 1); i <= bomb.range; i++) {
            const nx = bomb.x + dx * i;
            const ny = bomb.y + dy * i;

            if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) break;
            if (map[ny][nx] === TILE.SOLID_BLOCK) break;

            explosions.push({ x: nx, y: ny, createdAt: now });

            // 파괴 가능한 블록 파괴 시 아이템 드롭 확률
            if (map[ny][nx] === TILE.SOFT_BLOCK) {
              const rand = Math.random();
              if (rand < 0.25) map[ny][nx] = TILE.ITEM_BOMB;      // 25% 확률로 물풍선
              else if (rand < 0.50) map[ny][nx] = TILE.ITEM_RANGE; // 25% 확률로 물줄기
              else if (rand < 0.70) map[ny][nx] = TILE.ITEM_SPEED; // 20% 확률로 스피드
              else map[ny][nx] = TILE.EMPTY;                       // 30% 확률로 빈 공간
              break;
            }

            Object.values(players).forEach(p => {
              if (p.isAlive && p.x === nx && p.y === ny) {
                p.isAlive = false;
                isGameOver = true;
                io.emit('gameOver', { winner: p.pNum === 1 ? 'Player 2' : 'Player 1' });
              }
            });
          }
        });

        return false;
      }
      return true;
    });
  }

  io.emit('gameState', { map, players, explosions, isGameOver });
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
