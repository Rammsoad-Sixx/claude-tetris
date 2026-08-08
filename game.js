'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#f06292', // J - pink
  '#ffb74d', // L - orange
];

const NEON_COLORS = [
  null,
  '#00e5ff', // I - cyan
  '#ffea00', // O - yellow
  '#e040fb', // T - purple
  '#00e676', // S - green
  '#ff1744', // Z - red
  '#ff4081', // J - pink
  '#ff9100', // L - orange
];

const PASTEL_COLORS = [
  null,
  '#a8e6ef', // I - soft cyan
  '#fff2b2', // O - soft yellow
  '#dcb8e8', // T - soft purple
  '#c3e8c3', // S - soft green
  '#f4b8b8', // Z - soft red
  '#f7c6dc', // J - soft pink
  '#ffd9a8', // L - soft orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const RECORDS_KEY = 'tetrisRecords';
const BEST_COMBO_KEY = 'tetrisBestCombo';
const MAX_LINES_KEY = 'tetrisMaxLines';
const MAX_RECORDS = 5;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const overlayStats = document.getElementById('overlay-stats');
const recordsListEl = document.getElementById('records-list');
const saveRecordDiv = document.getElementById('save-record');
const playerNameInput = document.getElementById('player-name');
const saveRecordBtn = document.getElementById('save-record-btn');
const resetRecordsBtn = document.getElementById('reset-records-btn');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle-input');
const pauseOverlay = document.getElementById('pause-overlay');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const toggleControlsBtn = document.getElementById('toggle-controls-btn');
const pauseControlsList = document.getElementById('pause-controls-list');
const startLevelSelect = document.getElementById('start-level-select');
const skinSelect = document.getElementById('skin-select');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;
let gridColor, startLevel;
let combo, maxCombo;
let started = false;
let currentSkin;

function applyTheme(isLight) {
  document.body.classList.toggle('light-theme', isLight);
  themeToggle.checked = isLight;
  gridColor = getComputedStyle(document.body).getPropertyValue('--grid-color').trim();
}

function initTheme() {
  applyTheme(localStorage.getItem('theme') === 'light');
}

function applySkin(skin) {
  if (!SKINS[skin]) skin = 'retro';
  currentSkin = skin;
  document.body.classList.remove('skin-retro', 'skin-neon', 'skin-pastel', 'skin-pixelart');
  document.body.classList.add(`skin-${skin}`);
  if (skinSelect) skinSelect.value = skin;
  gridColor = getComputedStyle(document.body).getPropertyValue('--grid-color').trim();
  if (board && current) draw();
  if (next) drawNext();
}

function initSkin() {
  applySkin(localStorage.getItem('skin') || 'retro');
}

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = startLevel + Math.floor(lines / 10);
    dropInterval = computeDropInterval(level);
    updateHUD();
  }
  return cleared;
}

function computeDropInterval(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  const cleared = clearLines();
  if (cleared > 0) {
    combo++;
    if (combo > maxCombo) maxCombo = combo;
  } else {
    combo = -1;
  }
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function lightenColor(hex, amount) {
  const num = parseInt(hex.slice(1), 16);
  let r = (num >> 16) + amount;
  let g = ((num >> 8) & 0xff) + amount;
  let b = (num & 0xff) + amount;
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `rgb(${r}, ${g}, ${b})`;
}

function drawRetroBlock(context, x, y, colorIndex, size, alpha) {
  const color = SKINS.retro.colors[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawNeonBlock(context, x, y, colorIndex, size, alpha) {
  const color = SKINS.neon.colors[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.shadowBlur = 15;
  context.shadowColor = color;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  context.shadowBlur = 0;
  context.shadowColor = 'transparent';
  context.globalAlpha = 1;
}

function drawPastelBlock(context, x, y, colorIndex, size, alpha) {
  const color = SKINS.pastel.colors[colorIndex];
  const bx = x * size + 1;
  const by = y * size + 1;
  const bw = size - 2;
  const bh = size - 2;
  const radius = Math.min(6, bw / 2, bh / 2);
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.beginPath();
  if (typeof context.roundRect === 'function') {
    context.roundRect(bx, by, bw, bh, radius);
  } else {
    // fallback: manual rounded rect via arcTo
    context.moveTo(bx + radius, by);
    context.arcTo(bx + bw, by, bx + bw, by + bh, radius);
    context.arcTo(bx + bw, by + bh, bx, by + bh, radius);
    context.arcTo(bx, by + bh, bx, by, radius);
    context.arcTo(bx, by, bx + bw, by, radius);
    context.closePath();
  }
  context.fill();
  context.globalAlpha = 1;
}

const PIXEL_ART_SHADES = COLORS.map(color =>
  color ? { lighter: lightenColor(color, 25), darker: lightenColor(color, -25) } : null
);

function drawPixelArtBlock(context, x, y, colorIndex, size, alpha) {
  const color = SKINS.pixelart.colors[colorIndex];
  const bx = x * size + 1;
  const by = y * size + 1;
  const bw = size - 2;
  const bh = size - 2;
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(bx, by, bw, bh);
  // pixel-art texture: checkerboard of lighter/darker tones over the base fill
  const cellsPerSide = 4;
  const cellW = bw / cellsPerSide;
  const cellH = bh / cellsPerSide;
  const { lighter, darker } = PIXEL_ART_SHADES[colorIndex];
  for (let ry = 0; ry < cellsPerSide; ry++) {
    for (let rx = 0; rx < cellsPerSide; rx++) {
      context.fillStyle = (rx + ry) % 2 === 0 ? lighter : darker;
      context.fillRect(bx + rx * cellW, by + ry * cellH, cellW, cellH);
    }
  }
  context.globalAlpha = 1;
}

const SKINS = {
  retro: { colors: COLORS, draw: drawRetroBlock },
  neon: { colors: NEON_COLORS, draw: drawNeonBlock },
  pastel: { colors: PASTEL_COLORS, draw: drawPastelBlock },
  pixelart: { colors: COLORS, draw: drawPixelArtBlock },
};

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  SKINS[currentSkin].draw(context, x, y, colorIndex, size, alpha);
}

function drawGrid() {
  ctx.strokeStyle = gridColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function loadRecords() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (!Array.isArray(raw)) return [];
    // descarta entradas corruptas/incompletas (ej. de versiones anteriores)
    // para que un dato inválido no rompa el renderizado de records
    return raw.filter(
      rec => rec && typeof rec.name === 'string' && Number.isFinite(rec.score)
    );
  } catch {
    return [];
  }
}

function saveRecords(records) {
  const sorted = [...records].sort((a, b) => b.score - a.score).slice(0, MAX_RECORDS);
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify(sorted));
  } catch {
    // storage unavailable (e.g. private browsing) — ignore, keep playing
  }
  return sorted;
}

function loadStats() {
  try {
    return {
      bestCombo: parseInt(localStorage.getItem(BEST_COMBO_KEY), 10) || 0,
      maxLines: parseInt(localStorage.getItem(MAX_LINES_KEY), 10) || 0,
    };
  } catch {
    return { bestCombo: 0, maxLines: 0 };
  }
}

function saveStats(stats) {
  try {
    localStorage.setItem(BEST_COMBO_KEY, String(stats.bestCombo));
    localStorage.setItem(MAX_LINES_KEY, String(stats.maxLines));
  } catch {
    // storage unavailable — ignore
  }
}

function renderRecords(newRecord) {
  const records = loadRecords();
  recordsListEl.innerHTML = '';
  if (!records.length) {
    const li = document.createElement('li');
    li.className = 'record-empty';
    li.textContent = 'Sin récords todavía';
    recordsListEl.appendChild(li);
    return;
  }
  records.forEach((rec, i) => {
    const li = document.createElement('li');
    const left = document.createElement('span');
    left.textContent = `${i + 1}. ${rec.name}`;
    const right = document.createElement('span');
    right.textContent = rec.score.toLocaleString();
    li.appendChild(left);
    li.appendChild(right);
    if (newRecord && rec.name === newRecord.name && rec.score === newRecord.score) {
      li.classList.add('record-new');
    }
    recordsListEl.appendChild(li);
  });
}

function resetRecords() {
  try {
    localStorage.removeItem(RECORDS_KEY);
    localStorage.removeItem(BEST_COMBO_KEY);
    localStorage.removeItem(MAX_LINES_KEY);
  } catch {
    // storage unavailable — ignore
  }
  renderRecords();
  if (gameOver) {
    const stats = loadStats();
    overlayStats.textContent = `Mejor combo: ${stats.bestCombo} · Líneas máximas: ${stats.maxLines}`;
  }
}

function saveCurrentRecord() {
  const name = playerNameInput.value.trim().slice(0, 12) || 'ANON';
  const newRecord = { name, score };
  const records = loadRecords();
  records.push(newRecord);
  saveRecords(records);
  renderRecords(newRecord);
  saveRecordDiv.classList.add('hidden');
}

function showStartScreen() {
  overlayTitle.textContent = 'TETRIS';
  overlayScore.textContent = '';
  overlayStats.textContent = '';
  saveRecordDiv.classList.add('hidden');
  playerNameInput.value = '';
  renderRecords();
  restartBtn.textContent = 'Jugar';
  overlay.classList.remove('hidden');
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);

  const stats = loadStats();
  if (maxCombo > stats.bestCombo) stats.bestCombo = maxCombo;
  if (lines > stats.maxLines) stats.maxLines = lines;
  saveStats(stats);

  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlayStats.textContent = `Mejor combo: ${stats.bestCombo} · Líneas máximas: ${stats.maxLines}`;

  const records = loadRecords();
  const qualifies = records.length < MAX_RECORDS || score > records[records.length - 1].score;
  if (qualifies) {
    saveRecordDiv.classList.remove('hidden');
    playerNameInput.value = '';
  } else {
    saveRecordDiv.classList.add('hidden');
  }
  renderRecords();

  restartBtn.textContent = 'Reiniciar';
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (!started || gameOver) return;
  paused = !paused;
  if (!paused) {
    pauseOverlay.classList.add('hidden');
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    pauseOverlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  if (gameOver) return;
  draw();
  animId = requestAnimationFrame(loop);
}

function init() {
  const storedLevel = parseInt(localStorage.getItem('startLevel'), 10) || 1;
  startLevel = Math.min(9, Math.max(1, storedLevel));
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  paused = false;
  gameOver = false;
  combo = -1;
  maxCombo = 0;
  dropInterval = computeDropInterval(level);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  saveRecordDiv.classList.add('hidden');
  overlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  startLevelSelect.value = String(startLevel);
  cancelAnimationFrame(animId);
  started = true;
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (!started) return;
  if (e.code === 'Escape' && document.activeElement === startLevelSelect) return;
  if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);
saveRecordBtn.addEventListener('click', saveCurrentRecord);
resetRecordsBtn.addEventListener('click', resetRecords);

resumeBtn.addEventListener('click', togglePause);

pauseRestartBtn.addEventListener('click', init);

toggleControlsBtn.addEventListener('click', () => {
  pauseControlsList.classList.toggle('hidden');
});

startLevelSelect.addEventListener('change', () => {
  localStorage.setItem('startLevel', startLevelSelect.value);
});

themeToggle.addEventListener('change', () => {
  const isLight = themeToggle.checked;
  applyTheme(isLight);
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
});

skinSelect.addEventListener('change', () => {
  applySkin(skinSelect.value);
  localStorage.setItem('skin', skinSelect.value);
});

initTheme();
initSkin();
showStartScreen();
