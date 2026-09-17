const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

// 클라이언트 정적 파일 제공 (index.html)
app.use(express.static(__dirname + '/public'));

const ROWS = 15;
const COLS = 15;
const TILE = { EMPTY: 0, SOLID_BLOCK: 1, SOFT_BLOCK: 2, BOMB: 3, ITEM_BOMB: 4, ITEM_RANGE: 5 };

let map = [];
let players = {};
let bombs = [];
let explosions = [];

function initMap() {
  map = [];
  for (let r = 0; r < ROWS; r++) {
    map[r] = [];
    for (let c = 0; c < COLS; c++) {
      if (r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1 || (r % 2 === 0 && c % 2 === 0)) {
        map[r][c] = TILE.SOLID_BLOCK;
      } else if ((r <= 2 && c <= 2) || (r >= ROWS - 3 && c >= COLS - 3)) {
        map[r][c] = TILE.EMPTY; // P1(좌상단), P2(우하단) 스폰 지점 비우기
      } else {
        map[r][c] = Math.random() < 0.6 ? TILE.SOFT_BLOCK : TILE.EMPTY;
      }
    }
  }
}

initMap();

io.on('connection', (socket) => {
  console.log(`플레이어 접속: ${socket.id}`);

  // 최대 2명까지만 접속 허용
  const playerKeys = Object.keys(players);
  if (playerKeys.length >= 2) {
    socket.emit('full', '방이 가득 찼습니다.');
    socket.disconnect();
    return;
  }

  // P1은 좌상단(1,1), P2는 우하단(13,13) 배치
  const isFirst = playerKeys.length === 0;
  players[socket.id] = {
    id: socket.id,
    pNum: isFirst ? 1 : 2,
    x: isFirst ? 1 : COLS - 2,
    y: isFirst ? 1 : ROWS - 2,
    color: isFirst ? '#2ECC71' : '#E74C3C',
    maxBombs: 1,
    bombRange: 1,
    activeBombs: 0,
    isAlive: true
  };

  // 현재 연결된 플레이어에게 초기 데이터 전송
  socket.emit('init', { id: socket.id, map, players });
  // 다른 플레이어들에게 새 접속자 알림
  socket.broadcast.emit('playerJoined', players[socket.id]);

  // 플레이어 이동 처리
  socket.on('move', (dir) => {
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

        // 아이템 획득 판정
        if (target === TILE.ITEM_BOMB) {
          p.maxBombs++;
          map[ny][nx] = TILE.EMPTY;
        } else if (target === TILE.ITEM_RANGE) {
          p.bombRange++;
          map[ny][nx] = TILE.EMPTY;
        }
      }
    }
  });

  // 폭탄 설치 처리
  socket.on('placeBomb', () => {
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

  // 접속 해제 처리
  socket.on('disconnect', () => {
    console.log(`플레이어 퇴장: ${socket.id}`);
    delete players[socket.id];
    io.emit('playerLeft', socket.id);
    if (Object.keys(players).length === 0) {
      initMap(); // 아무도 없으면 맵 초기화
    }
  });
});

// 서버 측 메인 게임 루프 (초당 60회 상태 업데이트 및 브로드캐스트)
setInterval(() => {
  const now = Date.now();

  // 잔여 폭발 효과 제거 (500ms 유효)
  explosions = explosions.filter(exp => now - exp.createdAt < 500);

  // 폭탄 타이머 검사 및 폭발 처리
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

          if (map[ny][nx] === TILE.SOFT_BLOCK) {
            const rand = Math.random();
            if (rand < 0.3) map[ny][nx] = TILE.ITEM_BOMB;
            else if (rand < 0.6) map[ny][nx] = TILE.ITEM_RANGE;
            else map[ny][nx] = TILE.EMPTY;
            break;
          }

          // 플레이어 피격 검사
          Object.values(players).forEach(p => {
            if (p.isAlive && p.x === nx && p.y === ny) {
              p.isAlive = false;
              io.emit('gameOver', { winner: p.pNum === 1 ? 'Player 2' : 'Player 1' });
            }
          });
        }
      });

      return false;
    }
    return true;
  });

  // 전역 게임 상태 전송
  io.emit('gameState', { map, players, explosions });
}, 1000 / 60);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
