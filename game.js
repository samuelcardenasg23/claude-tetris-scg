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
  '#607d8b', // 19 basura (modo desafío)
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
const GARBAGE = 19;
const GLYPHS = { 13: '💣', 14: '⚡', 15: '🎨', 16: '⬇', 17: '❄', 18: '★' };
const POWERUP_EVERY = 10;      // líneas entre power-ups
const FREEZE_MS = 5000;
const DESTROY_POINTS = 10;     // por bloque destruido (× nivel)

// ---- Modo desafío ----
// Cada desafío es independiente y se juega con reglas puras: sin habilidades,
// power-ups, piezas especiales ni recompensa 1x1 (el hold sí está activo).
const CHALLENGES = {
  sprint:    { desc: 'Limpia 40 líneas en 2 minutos', goalLines: 40, timeLimit: 120000 },
  survival:  { desc: 'Sobrevive 2 minutos: sube una fila de basura cada 10 s', surviveMs: 120000, garbageMs: 10000 },
  fixed:     { desc: 'Despeja todos los bloques pre-colocados', junkRows: 6 },
  invisible: { desc: 'Las piezas se vuelven invisibles al tocar suelo. Limpia 15 líneas', goalLines: 15 },
  reverse:   { desc: 'Desde el nivel 5 la rotación gira al revés. Limpia 20 líneas', goalLines: 20, startLevel: 5 },
};
const REVERSE_FROM_LEVEL = 5;
const REVEAL_MS = 500;         // cuánto se ve el tablero tras cada pieza en "invisibles"

// Habilidades cargables: la barra se llena al limpiar líneas
const ENERGY_MAX = 100;
const ENERGY_PER_LINE = 10;
const SKILLS = {
  peek: { key: 1, cost: 20 },  // ver las siguientes 5 piezas
  swap: { key: 2, cost: 30 },  // cambiar la pieza actual por otra estándar
  slow: { key: 3, cost: 40 },  // ralentizar la caída
  undo: { key: 4, cost: 50 },  // deshacer la última colocación
};
const PEEK_PIECES = 5;         // piezas visibles
const PEEK_LOCKS = 5;          // colocaciones que dura la vista
const SLOW_MS = 10000;
const SLOW_FACTOR = 2;         // la gravedad tarda el doble

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
const energyEl = document.getElementById('energy');
const energyFill = document.getElementById('energy-fill');
const skillEls = document.querySelectorAll('[data-skill]');
const modeBtns = document.querySelectorAll('[data-mode]');
const objectiveSection = document.getElementById('objective-section');
const objectiveDesc = document.getElementById('objective-desc');
const objectiveProgress = document.getElementById('objective-progress');

const pauseMenu = document.getElementById('pause-menu');
const pauseMain = document.getElementById('pause-main');
const pauseControls = document.getElementById('pause-controls');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const controlsBackBtn = document.getElementById('controls-back-btn');
const startLevelSel = document.getElementById('start-level');
const MAX_START_LEVEL = 10;
const RESUME_GUARD_MS = 250;   // tras reanudar se ignoran las teclas un instante
let startLevel = 1;            // nivel con el que arranca la próxima partida clásica
let inputBlockedUntil = 0;

// ---- Tabla de records (localStorage, solo modo clásico) ----
const RECORDS_KEY = 'tetris-records';
const MAX_RECORDS = 5;
const NAME_MAX = 12;
const DEFAULT_NAME = 'Anónimo';
const recordsListEl = document.getElementById('records-list');
const recordsStatsEl = document.getElementById('records-stats');
const resetRecordsBtn = document.getElementById('reset-records');
const overlayRecordsEl = document.getElementById('overlay-records');
const overlayStatsEl = document.getElementById('overlay-stats');
const recordForm = document.getElementById('record-form');
const recordMsg = document.getElementById('record-msg');
const recordName = document.getElementById('record-name');

function emptyRecords() {
  return { scores: [], bestCombo: 0, maxLines: 0 };
}

function loadRecords() {
  try {
    const data = JSON.parse(localStorage.getItem(RECORDS_KEY));
    if (!data || !Array.isArray(data.scores)) return emptyRecords();
    return {
      scores: data.scores
        .filter(s => s && Number.isFinite(s.score))
        .map(s => ({ id: s.id, name: String(s.name || DEFAULT_NAME).slice(0, NAME_MAX), score: s.score }))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_RECORDS),
      bestCombo: Number(data.bestCombo) || 0,
      maxLines: Number(data.maxLines) || 0,
    };
  } catch (e) {
    return emptyRecords();
  }
}

function persistRecords() {
  try { localStorage.setItem(RECORDS_KEY, JSON.stringify(records)); } catch (e) {}
}

let records = loadRecords();
let pendingRecord = null; // { id, score } mientras el jugador no ha guardado su nombre

// Posición (0-based) que ocuparía una puntuación en el top, o -1 si no entra
function recordRank(sc) {
  if (sc <= 0) return -1;
  const idx = records.scores.findIndex(s => sc > s.score);
  if (idx !== -1) return idx;
  return records.scores.length < MAX_RECORDS ? records.scores.length : -1;
}

function fillRecordList(ol, highlightId) {
  const rows = records.scores.map(s => ({ ...s }));
  if (pendingRecord) {
    const rank = recordRank(pendingRecord.score);
    if (rank !== -1) rows.splice(rank, 0, { id: pendingRecord.id, name: recordName.value.trim() || 'Tú', score: pendingRecord.score });
  }
  ol.replaceChildren();
  if (!rows.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Sin records aún';
    ol.append(li);
    return;
  }
  rows.slice(0, MAX_RECORDS).forEach((s, i) => {
    const li = document.createElement('li');
    if (s.id === highlightId) li.className = 'highlight';
    for (const [cls, text] of [['rank', i + 1], ['name', s.name], ['pts', s.score.toLocaleString()]]) {
      const span = document.createElement('span');
      span.className = cls;
      span.textContent = text;
      li.append(span);
    }
    ol.append(li);
  });
}

function renderRecords(highlightId) {
  const hl = pendingRecord ? pendingRecord.id : highlightId;
  fillRecordList(recordsListEl, hl);
  fillRecordList(overlayRecordsEl, hl);
  const stats = `Mejor combo: x${records.bestCombo} · Máx. líneas: ${records.maxLines}`;
  recordsStatsEl.textContent = stats;
  overlayStatsEl.textContent = stats;
}

function commitRecord() {
  if (!pendingRecord) return;
  const entry = { id: pendingRecord.id, name: recordName.value.trim().slice(0, NAME_MAX) || DEFAULT_NAME, score: pendingRecord.score };
  const rank = recordRank(entry.score);
  pendingRecord = null;
  recordForm.hidden = true;
  recordName.value = '';
  if (rank === -1) { renderRecords(); return; } // el top cambió (p. ej. tras resetear) y ya no entra
  records.scores.splice(rank, 0, entry);
  records.scores.length = Math.min(records.scores.length, MAX_RECORDS);
  persistRecords();
  renderRecords(entry.id);
}

function finishRecords() {
  records.bestCombo = Math.max(records.bestCombo, maxCombo);
  records.maxLines = Math.max(records.maxLines, lines);
  persistRecords();
  const rank = recordRank(score);
  if (rank !== -1) {
    pendingRecord = { id: Date.now(), score };
    recordMsg.textContent = `¡Entras al top! Puesto #${rank + 1}`;
    recordForm.hidden = false;
    recordName.value = '';
    renderRecords();
    recordName.focus();
  } else {
    renderRecords();
  }
}

let resetTimer = null;
function resetRecords() {
  if (!resetRecordsBtn.dataset.confirm) {
    resetRecordsBtn.dataset.confirm = '1';
    resetRecordsBtn.textContent = '¿Seguro? Pulsa otra vez';
    resetTimer = setTimeout(cancelResetConfirm, 3000);
    return;
  }
  cancelResetConfirm();
  records = emptyRecords();
  persistRecords();
  renderRecords();
}

function cancelResetConfirm() {
  clearTimeout(resetTimer);
  delete resetRecordsBtn.dataset.confirm;
  resetRecordsBtn.textContent = 'Resetear records';
}

let held, holdUsed, maxCombo;
let combo, backToBack, lastMoveRotate, effect, audioCtx;
let powerPending, freezeLeft;
let energy, queue, peekCount, slowLeft, undoSnap;
let mode = 'classic';
let levelBase, timeLeft, elapsed, garbageAccum, revealUntil, revealAll;
let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function makePiece(type) {
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function isChallenge() {
  return mode !== 'classic';
}

function intervalFor(lvl) {
  return Math.max(100, 1000 - (lvl - 1) * 90);
}

function randomPiece() {
  const pool = !isChallenge() && Math.random() < SPECIAL_CHANCE ? SPECIAL_TYPES : STANDARD_TYPES;
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

function rotateCCW(shape) {
  return rotateCW(rotateCW(rotateCW(shape)));
}

function reverseRotation() {
  return mode === 'reverse' && level >= REVERSE_FROM_LEVEL;
}

function tryRotate() {
  const rotated = reverseRotation() ? rotateCCW(current.shape) : rotateCW(current.shape);
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
  maxCombo = Math.max(maxCombo, combo);
  const labels = [];
  const special = tspin || cleared === 4;
  let points = tspin ? TSPIN_SCORES[cleared] : LINE_SCORES[cleared];
  if (tspin) labels.push(`T-SPIN ${['', 'SINGLE', 'DOUBLE', 'TRIPLE'][cleared]}`);
  else if (cleared === 4) labels.push('TETRIS');
  if (cleared === 4 && !isChallenge()) {
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

  if (!isChallenge() && Math.floor((lines + cleared) / POWERUP_EVERY) > Math.floor(lines / POWERUP_EVERY)) {
    powerPending = true;
    labels.push('POWER-UP EN CAMINO');
  }
  if (!isChallenge()) energy = Math.min(ENERGY_MAX, energy + cleared * ENERGY_PER_LINE);
  lines += cleared;
  level = Math.floor(lines / 10) + 1 + levelBase;
  dropInterval = intervalFor(level);
  if (labels.length) showEffect(labels, labels.length > 1 || special ? 'big' : 'normal');
  else playTone([440], 0.08);
  updateHUD();
  checkObjective();
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
  saveUndo();
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
  if (peekCount > 0) peekCount--;
  revealUntil = performance.now() + REVEAL_MS;
  if (gameOver) return; // el último clearLines pudo ganar la partida
  spawn();
  updateHUD();
}

function spawn() {
  current = next;
  if (powerPending) {
    next = makePiece(POWER_TYPES[Math.floor(Math.random() * POWER_TYPES.length)]);
    powerPending = false;
  } else {
    next = queue.shift();
    fillQueue();
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

// ---- Habilidades ----
function fillQueue() {
  while (queue.length < PEEK_PIECES) queue.push(randomPiece());
}

function saveUndo() {
  undoSnap = {
    board: board.map(row => [...row]),
    score, lines, level, dropInterval, combo, backToBack, held, holdUsed,
    powerPending, freezeLeft,
    type: current.type,
    nextType: next.type,
    queueTypes: queue.map(p => p.type),
  };
}

function useSkill(name) {
  if (isChallenge()) { showEffect(['SOLO EN MODO CLÁSICO'], 'normal'); return; }
  const skill = SKILLS[name];
  if (name === 'undo' && !undoSnap) { showEffect(['NADA QUE DESHACER'], 'normal'); return; }
  if (energy < skill.cost) { showEffect(['ENERGÍA INSUFICIENTE'], 'normal'); return; }
  energy -= skill.cost;
  if (name === 'peek') {
    peekCount = PEEK_LOCKS;
    drawNext();
    showEffect(['VISTA x5'], 'big');
  } else if (name === 'swap') {
    const types = STANDARD_TYPES.filter(t => t !== current.type);
    current = makePiece(types[Math.floor(Math.random() * types.length)]);
    lastMoveRotate = false;
    if (collide(current.shape, current.x, current.y)) endGame();
    showEffect(['CAMBIO'], 'big');
  } else if (name === 'slow') {
    slowLeft = SLOW_MS;
    showEffect(['RALENTIZAR'], 'big');
  } else if (name === 'undo') {
    const snap = undoSnap;
    undoSnap = null;
    board = snap.board;
    ({ score, lines, level, dropInterval, combo, backToBack, held, holdUsed, powerPending, freezeLeft } = snap);
    current = makePiece(snap.type);
    next = makePiece(snap.nextType);
    queue = snap.queueTypes.map(makePiece);
    lastMoveRotate = false;
    dropAccum = 0;
    drawNext();
    drawHold();
    showEffect(['DESHACER'], 'big');
  }
  updateHUD();
}

// ---- Lógica de desafíos ----
function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function junkBoard(rows) {
  const b = createBoard();
  for (let r = ROWS - rows; r < ROWS; r++) {
    const holes = new Set();
    const holeCount = 1 + Math.floor(Math.random() * 3);
    while (holes.size < holeCount) holes.add(Math.floor(Math.random() * COLS));
    for (let c = 0; c < COLS; c++)
      b[r][c] = holes.has(c) ? 0 : STANDARD_TYPES[Math.floor(Math.random() * STANDARD_TYPES.length)];
  }
  return b;
}

function addGarbage() {
  if (board[0].some(v => v)) { endGame(); return; }
  board.shift();
  const hole = Math.floor(Math.random() * COLS);
  board.push(Array.from({ length: COLS }, (_, c) => (c === hole ? 0 : GARBAGE)));
  if (collide(current.shape, current.x, current.y)) {
    current.y--;
    if (collide(current.shape, current.x, current.y)) endGame();
  }
}

function checkObjective() {
  const cfg = CHALLENGES[mode];
  if (!cfg || gameOver) return;
  if (cfg.goalLines && lines >= cfg.goalLines) endGame('¡VICTORIA!', true);
  else if (cfg.junkRows && board.every(row => row.every(v => !v))) endGame('¡VICTORIA!', true);
}

function tickChallenge(dt) {
  const cfg = CHALLENGES[mode];
  if (!cfg) return;
  elapsed += dt;
  if (cfg.timeLimit || cfg.surviveMs) {
    timeLeft = Math.max(0, timeLeft - dt);
    if (timeLeft === 0) {
      if (cfg.surviveMs) endGame('¡VICTORIA!', true);
      else endGame('TIEMPO AGOTADO');
      return;
    }
  }
  if (cfg.garbageMs) {
    garbageAccum += dt;
    while (garbageAccum >= cfg.garbageMs && !gameOver) {
      garbageAccum -= cfg.garbageMs;
      addGarbage();
    }
  }
}

function updateObjective() {
  const cfg = CHALLENGES[mode];
  objectiveSection.hidden = !cfg;
  if (!cfg) return;
  objectiveDesc.textContent = cfg.desc;
  let text = '';
  if (mode === 'sprint') text = `${lines}/${cfg.goalLines} · ${formatTime(timeLeft)}`;
  else if (mode === 'survival') text = `${formatTime(timeLeft)} · basura en ${Math.ceil((cfg.garbageMs - garbageAccum) / 1000)}s`;
  else if (mode === 'fixed') text = `${board.flat().filter(v => v).length} bloques`;
  else if (mode === 'invisible') text = `${lines}/${cfg.goalLines} líneas`;
  else if (mode === 'reverse') text = `${lines}/${cfg.goalLines} · ${reverseRotation() ? '↺ invertida' : '↻ normal'}`;
  if (objectiveProgress.textContent !== text) objectiveProgress.textContent = text;
}

function setMode(id) {
  mode = id;
  for (const btn of modeBtns) {
    const active = btn.dataset.mode === id;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  }
  init();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
  updateObjective();
  energyFill.style.width = `${(energy / ENERGY_MAX) * 100}%`;
  energyEl.setAttribute('aria-valuenow', String(energy));
  for (const li of skillEls) {
    const skill = SKILLS[li.dataset.skill];
    li.classList.toggle('ready', energy >= skill.cost && !(li.dataset.skill === 'undo' && !undoSnap));
  }
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
  // en "invisibles" el tablero solo se ve un instante tras colocar cada pieza
  const boardAlpha = mode === 'invisible' && !revealAll
    ? Math.max(0, Math.min(1, (revealUntil - performance.now()) / REVEAL_MS))
    : 1;
  if (boardAlpha > 0)
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        drawBlock(ctx, c, r, board[r][c], BLOCK, boardAlpha);

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
  drawSlow();
  drawEffect();
}

function drawSlow() {
  if (slowLeft <= 0) return;
  ctx.save();
  ctx.fillStyle = '#ffb74d';
  ctx.font = 'bold 16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`🐢 ${(slowLeft / 1000).toFixed(1)}s`, canvas.width / 2, freezeLeft > 0 ? 44 : 22);
  ctx.restore();
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
function drawPreview(context, cnv, shape, box) {
  const { x: bx, y: by, w, h } = box || { x: 0, y: 0, w: cnv.width, h: cnv.height };
  if (!box) context.clearRect(0, 0, cnv.width, cnv.height);
  let minR = Infinity, maxR = -1, minC = Infinity, maxC = -1;
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      if (shape[r][c]) {
        minR = Math.min(minR, r); maxR = Math.max(maxR, r);
        minC = Math.min(minC, c); maxC = Math.max(maxC, c);
      }
  if (maxR < 0) return;
  const rows = maxR - minR + 1, cols = maxC - minC + 1;
  const size = Math.min(BLOCK, Math.floor(Math.min(w, h) / Math.max(rows, cols, 4)));
  const offX = bx / size + (w / size - cols) / 2 - minC;
  const offY = by / size + (h / size - rows) / 2 - minR;
  for (let r = minR; r <= maxR; r++)
    for (let c = minC; c <= maxC; c++)
      drawBlock(context, offX + c, offY + r, shape[r][c], size);
}

function drawNext() {
  if (peekCount > 0) {
    // habilidad "ver siguientes": 5 piezas en una cuadrícula de 3×2
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    const cell = nextCanvas.width / 3;
    const upcoming = [next, ...queue].slice(0, PEEK_PIECES);
    upcoming.forEach((piece, i) => {
      const box = { x: (i % 3) * cell, y: Math.floor(i / 3) * cell + 10, w: cell, h: cell };
      drawPreview(nextCtx, nextCanvas, piece.shape, box);
    });
    nextCtx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#7aa2f7';
    nextCtx.lineWidth = 1;
    nextCtx.strokeRect(1.5, 11.5, cell - 3, cell - 3);
    return;
  }
  drawPreview(nextCtx, nextCanvas, next.shape);
}

function drawHold() {
  holdCanvas.classList.toggle('locked', !!holdUsed);
  if (!held) { holdCtx.clearRect(0, 0, holdCanvas.width, holdCanvas.height); return; }
  drawPreview(holdCtx, holdCanvas, PIECES[held]);
}

function endGame(title = 'GAME OVER', win = false) {
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = title;
  overlayTitle.classList.toggle('win', win);
  const time = isChallenge() ? ` · Tiempo ${formatTime(elapsed)}` : '';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}${time}`;
  overlay.classList.remove('hidden');
  revealAll = true;
  if (current) draw();
  updateObjective();
  if (!isChallenge() && !pendingRecord) finishRecords();
}

function showPauseView(controls) {
  pauseMain.hidden = controls;
  pauseControls.hidden = !controls;
  (controls ? controlsBackBtn : resumeBtn).focus();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    pauseMenu.classList.add('hidden');
    if (document.activeElement) document.activeElement.blur();
    inputBlockedUntil = performance.now() + RESUME_GUARD_MS;
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    pauseMenu.classList.remove('hidden');
    showPauseView(false);
  }
}

function startNewGame() {
  init();
  if (document.activeElement) document.activeElement.blur();
  inputBlockedUntil = performance.now() + RESUME_GUARD_MS;
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  if (isChallenge()) {
    tickChallenge(dt);
    if (gameOver) return;
  }
  if (freezeLeft > 0) {
    freezeLeft = Math.max(0, freezeLeft - dt);
    dropAccum = 0;
  } else {
    dropAccum += dt;
  }
  if (slowLeft > 0) slowLeft = Math.max(0, slowLeft - dt);
  if (dropAccum >= (slowLeft > 0 ? dropInterval * SLOW_FACTOR : dropInterval)) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
      lastMoveRotate = false;
    } else {
      lockPiece();
    }
  }
  draw();
  updateObjective();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  commitRecord(); // si el jugador no pulsó "Guardar", se guarda con lo que haya escrito
  renderRecords(); // quita el resaltado de la partida anterior
  maxCombo = 0;
  const cfg = CHALLENGES[mode];
  board = cfg && cfg.junkRows ? junkBoard(cfg.junkRows) : createBoard();
  score = 0;
  lines = 0;
  levelBase = cfg ? (cfg.startLevel ? cfg.startLevel - 1 : 0) : startLevel - 1;
  level = 1 + levelBase;
  paused = false;
  gameOver = false;
  timeLeft = cfg ? cfg.timeLimit || cfg.surviveMs || 0 : 0;
  elapsed = 0;
  garbageAccum = 0;
  revealUntil = 0;
  revealAll = false;
  dropInterval = intervalFor(level);
  dropAccum = 0;
  lastTime = performance.now();
  held = null;
  powerPending = false;
  freezeLeft = 0;
  energy = 0;
  peekCount = 0;
  slowLeft = 0;
  undoSnap = null;
  queue = [];
  combo = 0;
  backToBack = false;
  lastMoveRotate = false;
  effect = null;
  next = randomPiece();
  fillQueue();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  overlayTitle.classList.remove('win');
  pauseMenu.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.target instanceof HTMLInputElement) return; // escribiendo el nombre
  if (e.code === 'KeyP' || e.code === 'Escape') {
    e.preventDefault();
    if (!e.repeat) togglePause();
    return;
  }
  // menú abierto, partida terminada o recién reanudada: el juego ignora el teclado
  if (paused || gameOver || performance.now() < inputBlockedUntil) return;
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
    case 'Digit1': case 'Numpad1': useSkill('peek'); break;
    case 'Digit2': case 'Numpad2': useSkill('swap'); break;
    case 'Digit3': case 'Numpad3': useSkill('slow'); break;
    case 'Digit4': case 'Numpad4': useSkill('undo'); break;
    case 'KeyC':
    case 'ShiftLeft':
    case 'ShiftRight':
      holdPiece();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

// ---- Menú de pausa ----
for (let l = 1; l <= MAX_START_LEVEL; l++) startLevelSel.add(new Option(String(l), String(l)));
startLevelSel.addEventListener('change', () => { startLevel = +startLevelSel.value; });
resumeBtn.addEventListener('click', togglePause);
pauseRestartBtn.addEventListener('click', startNewGame);
controlsBtn.addEventListener('click', () => showPauseView(true));
controlsBackBtn.addEventListener('click', () => showPauseView(false));

recordForm.addEventListener('submit', e => {
  e.preventDefault();
  commitRecord();
  restartBtn.focus();
});
recordName.addEventListener('input', () => renderRecords());
resetRecordsBtn.addEventListener('click', () => {
  resetRecords();
  resetRecordsBtn.blur(); // evita que Space/Enter lo reactiven
});
window.addEventListener('pagehide', commitRecord);

for (const btn of modeBtns) {
  btn.addEventListener('click', () => {
    setMode(btn.dataset.mode);
    btn.blur(); // evita que Space/Enter reactiven el botón
  });
}

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

renderRecords();
init();
applyTheme(savedTheme === 'light');
