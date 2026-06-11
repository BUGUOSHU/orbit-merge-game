const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("bestScore");
const finalScoreEl = document.getElementById("finalScore");
const recordMessageEl = document.getElementById("recordMessage");
const startOverlay = document.getElementById("startOverlay");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const soundButton = document.getElementById("soundButton");
const startButton = document.getElementById("startButton");
const currentPlayerEl = document.getElementById("currentPlayer");
const playerButtons = [...document.querySelectorAll(".player-option")];
const gameControls = document.getElementById("gameControls");
const pauseButton = document.getElementById("pauseButton");
const resumeButton = document.getElementById("resumeButton");
const endGameButton = document.getElementById("endGameButton");
const countdownOverlay = document.getElementById("countdownOverlay");
const countdownNumber = document.getElementById("countdownNumber");
const gameOverTitle = document.getElementById("gameOverTitle");
const sensitivitySelect = document.getElementById("sensitivitySelect");
const encouragementOverlay = document.getElementById("encouragementOverlay");
const encouragementText = document.getElementById("encouragementText");

const requestedLevel = new URLSearchParams(window.location.search).get("level");
const levelKey = ["beauty", "handsome"].includes(requestedLevel) ? requestedLevel : "happiness";
const LEVEL_CONFIGS = {
  happiness: { title: "幸福关", number: "LEVEL 01", imagePrefix: "memory", scoreKey: "orbitMergeBestHappiness", startTitle: "合成我们的宇宙" },
  beauty: { title: "美丽关", number: "LEVEL 02", imagePrefix: "beauty", scoreKey: "orbitMergeBestBeauty", startTitle: "合成她的美丽瞬间" },
  handsome: { title: "帅气关", number: "LEVEL 03", imagePrefix: "handsome", scoreKey: "orbitMergeBestHandsome", startTitle: "合成他的帅气瞬间" }
};
const levelConfig = LEVEL_CONFIGS[levelKey];

document.getElementById("levelTitle").textContent = levelConfig.title;
document.getElementById("levelNumber").textContent = levelConfig.number;
document.getElementById("startTitle").textContent = levelConfig.startTitle;
document.title = `${levelConfig.title} · 幸福合成计划`;

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const FLOOR = HEIGHT - 18;
const DANGER_Y = 142;
const GRAVITY = 0.029;
const AIR = 0.998;
const BOUNCE = 0;
const DROP_INTERVAL = 2400;

const LEVELS = [
  { radius: 17, color: "#f4b942", accent: "#ffd977", points: 2 },
  { radius: 23, color: "#ef765d", accent: "#ffad98", points: 5 },
  { radius: 30, color: "#63a989", accent: "#a0d2b8", points: 12 },
  { radius: 39, color: "#6f8cc7", accent: "#aabce3", points: 25 },
  { radius: 50, color: "#9b6cb3", accent: "#caa4d8", points: 50 },
  { radius: 63, color: "#dc7251", accent: "#f1a58c", points: 100 },
  { radius: 78, color: "#297b78", accent: "#64aba7", points: 200 },
  { radius: 94, color: "#203f59", accent: "#52758d", points: 400 }
];

const BALL_IMAGES = LEVELS.map((_, index) => {
  const image = new Image();
  image.src = `assets/${levelConfig.imagePrefix}-${index + 1}.jpg`;
  return image;
});

let balls = [];
let particles = [];
let score = 0;
let bestScore = 0;
let selectedPlayer = null;
let aimX = WIDTH / 2;
let running = false;
let dangerSince = 0;
let soundEnabled = true;
let audioContext;
let lastCollisionSound = 0;
let lastTime = performance.now();
let dropTimer = 0;
let activeBall = null;
let pointerHeld = false;
let paused = false;
let countingDown = false;
let historySaved = false;
let pausedAt = 0;
let sensitivity = Number(localStorage.getItem("orbitMergeSensitivity") || 1);
let lastEncouragement = -1;

const ENCOURAGEMENTS = [
  "太棒了，继续闪闪发光！",
  "厉害！幸福又长大了一点！",
  "完美合成，你真的很优秀！",
  "好样的，离最高分更近啦！",
  "这一球太漂亮了！",
  "坚持住，你一定可以！",
  "超强发挥，为你鼓掌！",
  "又完成一个大目标！"
];

if (![0.5, 0.75, 1, 1.5, 2].includes(sensitivity)) sensitivity = 1;
sensitivitySelect.value = String(sensitivity);

bestScoreEl.textContent = bestScore;

function playerBestKey() {
  return `${levelConfig.scoreKey}:${selectedPlayer}`;
}

function selectPlayer(player) {
  selectedPlayer = player;
  playerButtons.forEach(button => button.classList.toggle("selected", button.dataset.player === player));
  bestScore = Number(localStorage.getItem(playerBestKey()) || 0);
  bestScoreEl.textContent = bestScore;
  currentPlayerEl.textContent = `当前玩家：${player}`;
  startButton.disabled = false;
  startButton.textContent = "点击开始降落";
}

function preparePlayerSelection() {
  running = false;
  paused = false;
  countingDown = false;
  window.clearInterval(dropTimer);
  selectedPlayer = null;
  bestScore = 0;
  bestScoreEl.textContent = "0";
  currentPlayerEl.textContent = "尚未选择玩家";
  playerButtons.forEach(button => button.classList.remove("selected"));
  startButton.disabled = true;
  startButton.textContent = "选择玩家后开始";
  gameOverOverlay.classList.remove("visible");
  startOverlay.classList.add("visible");
  gameControls.classList.remove("visible");
  countdownOverlay.classList.remove("visible");
}

class Ball {
  constructor(x, y, level, preview = false) {
    this.x = x;
    this.y = y;
    this.level = level;
    this.radius = LEVELS[level].radius;
    this.vx = 0;
    this.vy = 0;
    this.preview = preview;
    this.merging = false;
    this.spawnedAt = performance.now();
  }
}

function randomDropLevel() {
  return Math.floor(Math.random() * 4);
}

function resetGame() {
  if (!selectedPlayer) return;
  balls = [];
  particles = [];
  score = 0;
  aimX = WIDTH / 2;
  dangerSince = 0;
  running = true;
  paused = false;
  countingDown = false;
  historySaved = false;
  activeBall = null;
  pointerHeld = false;
  scoreEl.textContent = "0";
  startOverlay.classList.remove("visible");
  gameOverOverlay.classList.remove("visible");
  gameControls.classList.add("visible");
  pauseButton.disabled = false;
  resumeButton.disabled = true;
  endGameButton.disabled = false;
  window.clearInterval(dropTimer);
  dropBall();
  dropTimer = window.setInterval(dropBall, DROP_INTERVAL);
}

function dropBall() {
  if (!running || paused || countingDown) return;
  const level = randomDropLevel();
  const radius = LEVELS[level].radius;
  activeBall = new Ball(Math.max(radius + 5, Math.min(WIDTH - radius - 5, aimX)), 48, level);
  balls.push(activeBall);
  playTone(190 + level * 35, 0.06, "sine");
}

function update() {
  if (!running || paused || countingDown) return;

  const now = performance.now();
  balls = balls.filter(ball => {
    if (ball.level !== LEVELS.length - 1 || now - ball.spawnedAt < 900) return true;
    burst(ball.x, ball.y, LEVELS[ball.level].color);
    playFingerSnap();
    showEncouragement();
    if (activeBall === ball) activeBall = null;
    return false;
  });

  for (const ball of balls) {
    if (ball === activeBall && pointerHeld && performance.now() - ball.spawnedAt < DROP_INTERVAL - 250 && ball.y < HEIGHT - 150) {
      const targetX = Math.max(ball.radius, Math.min(WIDTH - ball.radius, aimX));
      const acceleration = 0.42 * sensitivity;
      const maxSpeed = 4.2 * sensitivity;
      ball.vx += Math.max(-acceleration, Math.min(acceleration, (targetX - ball.x) * 0.018 * sensitivity));
      ball.vx = Math.max(-maxSpeed, Math.min(maxSpeed, ball.vx));
    }
    ball.vy += GRAVITY;
    ball.vx *= AIR;
    ball.vy *= AIR;
    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.x - ball.radius < 0) {
      ball.x = ball.radius;
      ball.vx = Math.abs(ball.vx) * BOUNCE;
    } else if (ball.x + ball.radius > WIDTH) {
      ball.x = WIDTH - ball.radius;
      ball.vx = -Math.abs(ball.vx) * BOUNCE;
    }
    if (ball.y + ball.radius > FLOOR) {
      ball.y = FLOOR - ball.radius;
      ball.vy = -Math.abs(ball.vy) * BOUNCE;
      if (Math.abs(ball.vy) < 0.7) ball.vy = 0;
    }
  }

  for (let pass = 0; pass < 3; pass++) solveCollisions();

  particles.forEach(p => {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.035;
    p.life -= 0.025;
  });
  particles = particles.filter(p => p.life > 0);
  checkDanger();
}

function showEncouragement() {
  let index = Math.floor(Math.random() * ENCOURAGEMENTS.length);
  if (ENCOURAGEMENTS.length > 1 && index === lastEncouragement) {
    index = (index + 1 + Math.floor(Math.random() * (ENCOURAGEMENTS.length - 1))) % ENCOURAGEMENTS.length;
  }
  lastEncouragement = index;
  encouragementText.textContent = ENCOURAGEMENTS[index];
  encouragementOverlay.classList.remove("show");
  void encouragementOverlay.offsetWidth;
  encouragementOverlay.classList.add("show");
}

function solveCollisions() {
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const a = balls[i];
      const b = balls[j];
      if (a.merging || b.merging) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const minDist = a.radius + b.radius;
      const distSq = dx * dx + dy * dy;
      if (distSq >= minDist * minDist || distSq === 0) continue;

      if (a.level === b.level && a.level < LEVELS.length - 1) {
        mergeBalls(i, j, a, b);
        return;
      }

      const dist = Math.sqrt(distSq);
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - dist;
      const massA = a.radius * a.radius;
      const massB = b.radius * b.radius;
      const total = massA + massB;

      // Nearly vertical contacts get a sideways bias so balls cannot form a straight column.
      if (Math.abs(dx) < minDist * 0.16 && Math.abs(dy) > minDist * 0.72) {
        const side = (i + j) % 2 === 0 ? 1 : -1;
        const push = 0.16 + overlap * 0.025;
        a.vx -= side * push * (massB / total);
        b.vx += side * push * (massA / total);
        a.x -= side * 0.35;
        b.x += side * 0.35;
      }

      a.x -= nx * overlap * (massB / total);
      a.y -= ny * overlap * (massB / total);
      b.x += nx * overlap * (massA / total);
      b.y += ny * overlap * (massA / total);

      const relativeVelocity = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (relativeVelocity < 0) {
        if (Math.abs(relativeVelocity) > 0.45) playMetalHit(Math.abs(relativeVelocity));
        const impulse = -relativeVelocity / (1 / massA + 1 / massB);
        a.vx -= impulse * nx / massA;
        a.vy -= impulse * ny / massA;
        b.vx += impulse * nx / massB;
        b.vy += impulse * ny / massB;
      }
    }
  }
}

function mergeBalls(i, j, a, b) {
  a.merging = true;
  b.merging = true;
  const level = a.level + 1;
  const x = (a.x + b.x) / 2;
  const y = (a.y + b.y) / 2;
  const merged = new Ball(x, y, level);
  merged.vx = (a.vx + b.vx) * 0.35;
  merged.vy = Math.max(0, (a.vy + b.vy) * 0.05);
  balls.splice(j, 1);
  balls.splice(i, 1);
  balls.push(merged);

  const gained = LEVELS[level].points;
  score += gained;
  scoreEl.textContent = score;
  scoreEl.animate([{ transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 220 });
  burst(x, y, LEVELS[level].color);
  playBubblePop(level);
}

function burst(x, y, color) {
  for (let i = 0; i < 12; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 2.8;
    particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1, color });
  }
}

function checkDanger() {
  const now = performance.now();
  const touching = balls.some(ball => now - ball.spawnedAt > 1400 && ball.y - ball.radius < DANGER_Y);
  if (touching) {
    if (!dangerSince) dangerSince = now;
    if (now - dangerSince > 1800) endGame();
  } else {
    dangerSince = 0;
  }
}

function endGame(manual = false) {
  if (!running || historySaved) return;
  running = false;
  paused = false;
  countingDown = false;
  historySaved = true;
  window.clearInterval(dropTimer);
  const isRecord = score > bestScore;
  if (isRecord) {
    bestScore = score;
    localStorage.setItem(playerBestKey(), String(bestScore));
    bestScoreEl.textContent = bestScore;
  }
  saveHistoryRecord();
  finalScoreEl.textContent = score;
  recordMessageEl.textContent = isRecord ? "新的最高纪录！" : "再来一次，冲击更高分";
  gameOverTitle.textContent = manual ? "本局已结束" : "星轨已满";
  gameControls.classList.remove("visible");
  countdownOverlay.classList.remove("visible");
  gameOverOverlay.classList.add("visible");
  playTone(140, 0.32, "sawtooth");
}

function pauseGame() {
  if (!running || paused || countingDown) return;
  paused = true;
  pausedAt = performance.now();
  pointerHeld = false;
  window.clearInterval(dropTimer);
  pauseButton.disabled = true;
  resumeButton.disabled = false;
}

function resumeGame() {
  if (!running || !paused || countingDown) return;
  countingDown = true;
  resumeButton.disabled = true;
  endGameButton.disabled = true;
  countdownOverlay.classList.add("visible");
  let count = 3;
  countdownNumber.textContent = count;

  const countdownTimer = window.setInterval(() => {
    count -= 1;
    if (count > 0) {
      countdownNumber.textContent = count;
      playTone(420 + count * 80, 0.08, "sine");
      return;
    }
    window.clearInterval(countdownTimer);
    countdownOverlay.classList.remove("visible");
    const pausedDuration = performance.now() - pausedAt;
    balls.forEach(ball => { ball.spawnedAt += pausedDuration; });
    paused = false;
    countingDown = false;
    dangerSince = 0;
    pauseButton.disabled = false;
    resumeButton.disabled = true;
    endGameButton.disabled = false;
    dropTimer = window.setInterval(dropBall, DROP_INTERVAL);
    playTone(760, 0.12, "triangle");
  }, 1000);
}

function saveHistoryRecord() {
  if (!selectedPlayer) return;
  const historyKey = "orbitMergeHistory";
  let history = [];
  try {
    const saved = JSON.parse(localStorage.getItem(historyKey) || "[]");
    if (Array.isArray(saved)) history = saved;
  } catch (_) { /* Start a fresh history if stored data is invalid. */ }
  history.push({ player: selectedPlayer, level: levelKey, score, time: Date.now() });
  localStorage.setItem(historyKey, JSON.stringify(history.slice(-120)));
}

function drawBall(target, ball, alpha = 1) {
  const style = LEVELS[ball.level];
  target.save();
  target.globalAlpha = alpha;
  target.translate(ball.x, ball.y);
  target.beginPath();
  target.arc(0, 0, ball.radius, 0, Math.PI * 2);
  target.clip();

  const image = BALL_IMAGES[ball.level];
  if (image.complete && image.naturalWidth) {
    const diameter = ball.radius * 2;
    const scale = Math.max(diameter / image.naturalWidth, diameter / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    target.drawImage(image, -width / 2, -height / 2, width, height);
    const shadeGradient = target.createRadialGradient(-ball.radius * .35, -ball.radius * .4, 0, 0, 0, ball.radius);
    shadeGradient.addColorStop(.45, "rgba(255,255,255,0)");
    shadeGradient.addColorStop(1, "rgba(20,10,12,.25)");
    target.fillStyle = shadeGradient;
    target.fillRect(-ball.radius, -ball.radius, diameter, diameter);
  } else {
    target.fillStyle = style.color;
    target.fillRect(-ball.radius, -ball.radius, ball.radius * 2, ball.radius * 2);
  }
  target.restore();

  target.save();
  target.globalAlpha = alpha;
  target.translate(ball.x, ball.y);
  target.beginPath();
  target.arc(0, 0, ball.radius, 0, Math.PI * 2);
  target.strokeStyle = "rgba(24,48,59,.2)";
  target.lineWidth = Math.max(1, ball.radius * 0.045);
  target.stroke();

  target.globalAlpha = alpha * 0.38;
  target.beginPath();
  target.ellipse(-ball.radius * 0.25, -ball.radius * 0.32, ball.radius * 0.2, ball.radius * 0.11, -0.6, 0, Math.PI * 2);
  target.fillStyle = "white";
  target.fill();
  target.restore();
}

function draw() {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  drawBackground();

  balls.forEach(ball => drawBall(ctx, ball));
  particles.forEach(p => {
    ctx.globalAlpha = p.life;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5 + p.life * 2, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#f2f3eb");
  gradient.addColorStop(1, "#e5e9df");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "rgba(24,48,59,.035)";
  for (let y = 30; y < HEIGHT; y += 38) {
    for (let x = 20 + (y % 76 ? 19 : 0); x < WIDTH; x += 38) {
      ctx.beginPath(); ctx.arc(x, y, 1.2, 0, Math.PI * 2); ctx.fill();
    }
  }

  const dangerRatio = dangerSince ? Math.min(1, (performance.now() - dangerSince) / 1800) : 0;
  ctx.save();
  ctx.setLineDash([8, 7]);
  ctx.lineWidth = 2;
  ctx.strokeStyle = dangerRatio ? `rgba(220,70,55,${0.5 + dangerRatio * 0.5})` : "rgba(239,106,82,.56)";
  ctx.beginPath(); ctx.moveTo(0, DANGER_Y); ctx.lineTo(WIDTH, DANGER_Y); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = dangerRatio ? "#c84538" : "rgba(197,82,65,.8)";
  ctx.font = "700 10px 'DM Sans', sans-serif";
  ctx.fillText("警戒线", 14, DANGER_Y - 10);

  ctx.fillStyle = "rgba(24,48,59,.08)";
  ctx.fillRect(0, FLOOR, WIDTH, HEIGHT - FLOOR);
}

function shade(hex, amount) {
  const value = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, (value >> 16) + amount));
  const g = Math.max(0, Math.min(255, ((value >> 8) & 255) + amount));
  const b = Math.max(0, Math.min(255, (value & 255) + amount));
  return `rgb(${r},${g},${b})`;
}

function playTone(frequency, duration, type) {
  if (!soundEnabled) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.06, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
    oscillator.connect(gain).connect(audioContext.destination);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + duration);
  } catch (_) { /* Audio is optional. */ }
}

function getAudioContext() {
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function createNoiseBuffer(context, duration) {
  const length = Math.max(1, Math.floor(context.sampleRate * duration));
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function playMetalHit(strength) {
  if (!soundEnabled || performance.now() - lastCollisionSound < 85) return;
  lastCollisionSound = performance.now();
  try {
    const context = getAudioContext();
    const now = context.currentTime;
    const volume = Math.min(0.07, 0.025 + strength * 0.012);
    [720, 1130, 1680].forEach((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index === 0 ? "triangle" : "square";
      oscillator.frequency.setValueAtTime(frequency, now);
      oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.72, now + 0.11);
      gain.gain.setValueAtTime(volume / (index + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.13);
    });
  } catch (_) { /* Audio is optional. */ }
}

function playBubblePop(level) {
  if (!soundEnabled) return;
  try {
    const context = getAudioContext();
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(760 + level * 55, now);
    oscillator.frequency.exponentialRampToValueAtTime(150, now + 0.12);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.13);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.14);

    const noise = context.createBufferSource();
    const noiseGain = context.createGain();
    noise.buffer = createNoiseBuffer(context, 0.055);
    noiseGain.gain.setValueAtTime(0.035, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);
    noise.connect(noiseGain).connect(context.destination);
    noise.start(now);
  } catch (_) { /* Audio is optional. */ }
}

function playFingerSnap() {
  if (!soundEnabled) return;
  try {
    const context = getAudioContext();
    const now = context.currentTime;
    [0, 0.035].forEach((delay, index) => {
      const noise = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const gain = context.createGain();
      noise.buffer = createNoiseBuffer(context, 0.055);
      filter.type = "bandpass";
      filter.frequency.value = index ? 2200 : 3400;
      filter.Q.value = 0.8;
      gain.gain.setValueAtTime(index ? 0.045 : 0.1, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.055);
      noise.connect(filter).connect(gain).connect(context.destination);
      noise.start(now + delay);
    });
  } catch (_) { /* Audio is optional. */ }
}

function pointerX(event) {
  const rect = canvas.getBoundingClientRect();
  return (event.clientX - rect.left) * WIDTH / rect.width;
}

canvas.addEventListener("pointerdown", event => {
  event.preventDefault();
  pointerHeld = true;
  canvas.setPointerCapture(event.pointerId);
  aimX = pointerX(event);
});
canvas.addEventListener("pointermove", event => {
  if (pointerHeld) aimX = pointerX(event);
});
canvas.addEventListener("pointerup", () => { pointerHeld = false; });
canvas.addEventListener("pointercancel", () => { pointerHeld = false; });
playerButtons.forEach(button => button.addEventListener("click", () => selectPlayer(button.dataset.player)));
startButton.addEventListener("click", resetGame);
document.getElementById("restartButton").addEventListener("click", preparePlayerSelection);
pauseButton.addEventListener("click", pauseGame);
resumeButton.addEventListener("click", resumeGame);
endGameButton.addEventListener("click", () => endGame(true));
sensitivitySelect.addEventListener("change", () => {
  sensitivity = Number(sensitivitySelect.value);
  localStorage.setItem("orbitMergeSensitivity", String(sensitivity));
});
soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundButton.textContent = soundEnabled ? "音效 开" : "音效 关";
});

function frame(time) {
  const elapsed = Math.min(40, time - lastTime);
  lastTime = time;
  const steps = Math.max(1, Math.round(elapsed / 16.67));
  for (let i = 0; i < steps; i++) update();
  draw();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
