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
  '#90caf9', // J - pale blue
  '#ffb74d', // L - orange
  '#f06292', // + - pink
  '#a1887f', // U - brown
  '#b0bec5', // Y - blue gray
  '#ff7043', // 1x1 - deep orange
  '#26a69a', // 3x3 hueca - teal
  '#d32f2f', // 13 bomba
  '#fdd835', // 14 rayo
  '#7e57c2', // 15 tinte
  '#5c6bc0', // 16 gravedad
  '#4fc3f7', // 17 congelar
  '#eceff1', // 18 comodín (resultado del tinte)
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
  [[0,8,0],[8,8,8],[0,8,0]],                  // + (pentominó)
  [[9,0,9],[9,9,9],[0,0,0]],                  // U (pentominó)
  [[0,10,0,0],[10,10,10,10],[0,0,0,0],[0,0,0,0]], // Y (pentominó)
  [[11]],                                      // 1x1 (recompensa tras un Tetris)
  [[12,12,12],[12,0,12],[12,12,12]],          // 3x3 hueca (reto)
  [[13]], [[14]], [[15]], [[16]], [[17]],     // power-ups (1 celda)
];

// Power-ups: tipos 13-17. El 18 es el bloque comodín que deja el tinte.
const POWER_BY_TYPE = { 13: 'bomb', 14: 'lightning', 15: 'dye', 16: 'gravity', 17: 'freeze' };
const POWER_TYPES = [13, 14, 15, 16, 17];
const WILD = 18;
const GLYPHS = { 13: '💣', 14: '⚡', 15: '🎨', 16: '⬇', 17: '❄', 18: '★' };
const POWERUP_EVERY = 10;      // líneas entre power-ups
const FREEZE_MS = 5000;
const DESTROY_POINTS = 10;     // por bloque destruido (× nivel)

const STANDARD_TYPES = [1, 2, 3, 4, 5, 6, 7];
const SPECIAL_TYPES = [8, 9, 10, 12]; // la 1x1 (11) solo sale como recompensa
const SINGLE_TYPE = 11;
const SPECIAL_CHANCE = 0.08;

const LINE_SCORES = [0, 100, 300, 500, 800];
const TSPIN_SCORES = [400, 800, 1200, 1600];
const MAX_COMBO_MULT = 8;
const PERFECT_CLEAR_BONUS = 2000;
const EFFECT_MS = 1400;

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const holdCanvas = document.getElementById('hold-canvas');
const holdCtx = holdCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');

let held, holdUsed;
let combo, backToBack, lastMoveRotate, effect, audioCtx;
let powerPending, freezeLeft;
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function makePiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function randomPiece() {
  const pool = Math.random() < SPECIAL_CHANCE ? SPECIAL_TYPES : STANDARD_TYPES;
  return makePiece(pool[Math.floor(Math.random() * pool.length)]);
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
      lastMoveRotate = true;
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

function isTSpin() {
  if (current.type !== 3 || !lastMoveRotate) return false;
  const cx = current.x, cy = current.y;
  let filled = 0;
  for (const [dr, dc] of [[0, 0], [0, 2], [2, 0], [2, 2]]) {
    const x = cx + dc, y = cy + dr;
    if (x < 0 || x >= COLS || y >= ROWS || (y >= 0 && board[y][x])) filled++;
  }
  return filled >= 3;
}

// Una fila se completa si sus huecos pueden cubrirse con sus comodines (1 comodín = 1 hueco)
function rowComplete(row) {
  let empty = 0, wild = 0;
  for (const v of row) {
    if (v === 0) empty++;
    else if (v === WILD) wild++;
  }
  return empty <= wild;
}

function clearLines(tspin, keepCombo) {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (rowComplete(board[r])) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }

  if (!cleared) {
    if (!keepCombo) combo = 0;
    if (tspin) {
      score += TSPIN_SCORES[0] * level;
      showEffect(['T-SPIN'], 'tspin');
      updateHUD();
    }
    return;
  }

  combo++;
  const labels = [];
  const special = tspin || cleared === 4;
  let points = tspin ? TSPIN_SCORES[cleared] : LINE_SCORES[cleared];
  if (tspin) labels.push(`T-SPIN ${['', 'SINGLE', 'DOUBLE', 'TRIPLE'][cleared]}`);
  else if (cleared === 4) labels.push('TETRIS');
  if (cleared === 4) {
    next = makePiece(SINGLE_TYPE); // recompensa: la siguiente pieza es la 1x1
    labels.push('BONUS 1×1');
  }

  if (special && backToBack) {
    points = Math.floor(points * 1.5);
    labels.push('BACK-TO-BACK');
  }
  backToBack = special ? true : false;

  const mult = Math.min(combo, MAX_COMBO_MULT);
  points *= mult;
  if (combo >= 2) labels.push(`COMBO x${mult}`);

  score += points * level;

  if (board.every(row => row.every(v => v === 0))) {
    score += PERFECT_CLEAR_BONUS * level;
    labels.push('PERFECT CLEAR');
  }

  if (Math.floor((lines + cleared) / POWERUP_EVERY) > Math.floor(lines / POWERUP_EVERY)) {
    powerPending = true;
    labels.push('POWER-UP EN CAMINO');
  }
  lines += cleared;
  level = Math.floor(lines / 10) + 1;
  dropInterval = Math.max(100, 1000 - (level - 1) * 90);
  if (labels.length) showEffect(labels, labels.length > 1 || special ? 'big' : 'normal');
  else playTone([440], 0.08);
  updateHUD();
}

// ---- Power-ups ----
function destroyCell(r, c) {
  if (r < 0 || r >= ROWS || c < 0 || c >= COLS || !board[r][c]) return 0;
  board[r][c] = 0;
  return 1;
}

function applyPower(kind, cx, cy) {
  let destroyed = 0;
  let label = '';
  if (kind === 'bomb') {
    for (let r = cy - 1; r <= cy + 1; r++)
      for (let c = cx - 1; c <= cx + 1; c++) destroyed += destroyCell(r, c);
    label = 'BOMBA';
  } else if (kind === 'lightning') {
    if (Math.random() < 0.5) {
      for (let c = 0; c < COLS; c++) destroyed += destroyCell(cy, c);
    } else {
      for (let r = 0; r < ROWS; r++) destroyed += destroyCell(r, cx);
    }
    label = 'RAYO';
  } else if (kind === 'dye') {
    // color del bloque justo debajo; si no hay, el más abundante del tablero
    let target = 0;
    for (let r = cy + 1; r < ROWS && !target; r++)
      if (board[r][cx] && board[r][cx] !== WILD) target = board[r][cx];
    if (!target) {
      const counts = {};
      for (const row of board) for (const v of row) if (v && v !== WILD) counts[v] = (counts[v] || 0) + 1;
      target = +(Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || 0);
    }
    if (target)
      for (let r = 0; r < ROWS; r++)
        for (let c = 0; c < COLS; c++) if (board[r][c] === target) board[r][c] = WILD;
    label = 'TINTE';
  } else if (kind === 'gravity') {
    for (let c = 0; c < COLS; c++) {
      const col = [];
      for (let r = ROWS - 1; r >= 0; r--) if (board[r][c]) col.push(board[r][c]);
      for (let r = ROWS - 1, i = 0; r >= 0; r--, i++) board[r][c] = col[i] || 0;
    }
    label = 'GRAVEDAD';
  } else if (kind === 'freeze') {
    freezeLeft = FREEZE_MS;
    label = 'CONGELADO';
  }
  if (destroyed) score += destroyed * DESTROY_POINTS * level;
  showEffect([label], 'big');
  updateHUD();
}

// ---- Efectos visuales y sonoros ----
function showEffect(labels, kind) {
  effect = { labels, start: performance.now() };
  const tones = { tspin: [523, 659], big: [523, 659, 784], normal: [440] };
  playTone(tones[kind] || tones.normal, 0.12);
}

function playTone(freqs, dur) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    freqs.forEach((f, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const t = audioCtx.currentTime + i * dur;
      osc.type = 'square';
      osc.frequency.value = f;
      gain.gain.setValueAtTime(0.06, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + dur);
    });
  } catch (e) {}
}

function drawEffect() {
  if (!effect) return;
  const age = performance.now() - effect.start;
  if (age > EFFECT_MS) { effect = null; return; }
  const alpha = 1 - age / EFFECT_MS;
  const rise = (age / EFFECT_MS) * 30;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.font = 'bold 22px system-ui, sans-serif';
  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#7aa2f7';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 6;
  effect.labels.forEach((text, i) => {
    ctx.fillText(text, canvas.width / 2, 200 - rise + i * 28);
  });
  ctx.restore();
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  if (gy > current.y) lastMoveRotate = false;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    lastMoveRotate = false;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  const power = POWER_BY_TYPE[current.type];
  if (power) {
    // el power-up no se queda en el tablero: aplica su efecto donde aterriza
    applyPower(power, current.x, current.y);
    clearLines(false, true);
  } else {
    const tspin = isTSpin();
    merge();
    clearLines(tspin);
  }
  spawn();
}

function spawn() {
  current = next;
  if (powerPending) {
    next = makePiece(POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)]);
    powerPending = false;
  } else {
    next = randomPiece();
  }
  holdUsed = false;
  lastMoveRotate = false;
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
  drawHold();
}

function holdPiece() {
  if (holdUsed) return;
  const type = current.type;
  if (held) {
    current = makePiece(held);
    if (collide(current.shape, current.x, current.y)) endGame();
  } else {
    spawn();
  }
  held = type;
  holdUsed = true;
  lastMoveRotate = false;
  dropAccum = 0;
  drawHold();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  const glyph = GLYPHS[colorIndex];
  if (glyph) {
    context.fillStyle = '#fff';
    context.font = `${Math.floor(size * 0.6)}px system-ui, sans-serif`;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(glyph, x * size + size / 2, y * size + size / 2 + 1);
  }
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--grid').trim();
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

  drawFreeze();
  drawEffect();
}

function drawFreeze() {
  if (freezeLeft <= 0) return;
  ctx.save();
  ctx.fillStyle = 'rgba(79, 195, 247, 0.12)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#4fc3f7';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`❄ ${(freezeLeft / 1000).toFixed(1)}s`, canvas.width / 2, 22);
  ctx.restore();
}

// Dibuja una pieza centrada (por su bounding box) y escalada para que quepa en el canvas
function drawPreview(context, cnv, shape) {
  context.clearRect(0, 0, cnv.width, cnv.height);
  let minR = Infinity, maxR = -1, minC = Infinity, maxC = -1;
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c]) {
        minR = Math.min(minR, r); maxR = Math.max(maxR, r);
        minC = Math.min(minC, c); maxC = Math.max(maxC, c);
      }
  if (maxR < 0) return;
  const rows = maxR - minR + 1, cols = maxC - minC + 1;
  const size = Math.min(BLOCK, Math.floor(cnv.width / Math.max(rows, cols, 4)));
  const offX = (cnv.width / size - cols) / 2 - minC;
  const offY = (cnv.height / size - rows) / 2 - minR;
  for (let r = minR; r <= maxR; r++)
    for (let c = minC; c <= maxC; c++)
      drawBlock(context, offX + c, offY + r, shape[r][c], size);
}

function drawNext() {
  drawPreview(nextCtx, nextCanvas, next.shape);
}

function drawHold() {
  holdCanvas.classList.toggle('locked', !!holdUsed);
  if (!held) { holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height); return; }
  drawPreview(holdCtx, holdCanvas, PIECES[held]);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  if (freezeLeft > 0) {
    freezeLeft = Math.max(0, freezeLeft - dt);
    dropAccum = 0;
  } else {
    dropAccum += dt;
  }
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      lastMoveRotate = false;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  lastTime = performance.now();
  held = null;
  powerPending = false;
  freezeLeft = 0;
  combo = 0;
  backToBack = false;
  lastMoveRotate = false;
  effect = null;
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) { current.x--; lastMoveRotate = false; }
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) { current.x++; lastMoveRotate = false; }
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
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      holdPiece();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

// ---- Tema claro/oscuro (oscuro por defecto) ----
const themeToggle = document.getElementById('theme-toggle');
const themeText = document.getElementById('theme-toggle-text');

function applyTheme(light) {
  if (light) document.documentElement.setAttribute('data-theme', 'light');
  else document.documentElement.removeAttribute('data-theme');
  themeToggle.setAttribute('aria-checked', String(light));
  themeText.textContent = light ? 'Modo oscuro' : 'Modo claro';
  themeToggle.setAttribute('aria-label', themeText.textContent);
  try { localStorage.setItem('theme', light ? 'light' : 'dark'); } catch (e) {}
  // repintar también en pausa / game over
  if (current) draw();
  if (next) drawNext();
  if (current) drawHold();
}

themeToggle.addEventListener('click', () => {
  applyTheme(document.documentElement.getAttribute('data-theme') !== 'light');
  themeToggle.blur(); // evita que Space/Enter reactiven el botón
});

let savedTheme = null;
try { savedTheme = localStorage.getItem('theme'); } catch (e) {}

init();
applyTheme(savedTheme === 'light');
