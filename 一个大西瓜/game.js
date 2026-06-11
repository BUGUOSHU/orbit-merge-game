const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreEl = document.getElementById("score");
const bestScoreEl = document.getElementById("bestScore");
const finalScoreEl = document.getElementById("finalScore");
const recordMessageEl = document.getElementById("recordMessage");
const startOverlay = document.getElementById("startOverlay");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const soundButton = document.getElementById("soundButton");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const FLOOR = HEIGHT - 18;
const DANGER_Y = 142;
const GRAVITY = 0.029;
const AIR = 0.998;
const BOUNCE = 0.3;
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

let balls = [];
let particles = [];
let score = 0;
let bestScore = Number(localStorage.getItem("orbitMergeBest") || 0);
let aimX = WIDTH / 2;
let running = false;
let dangerSince = 0;
let soundEnabled = true;
let audioContext;
let lastTime = performance.now();
let dropTimer = 0;
let activeBall = null;
let pointerHeld = false;
const ballImages = Array(LEVELS.length).fill(null);

bestScoreEl.textContent = bestScore;

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
  const roll = Math.random();
  return roll < 0.48 ? 0 : roll < 0.8 ? 1 : 2;
}

function resetGame() {
  balls = [];
  particles = [];
  score = 0;
  aimX = WIDTH / 2;
  dangerSince = 0;
  running = true;
  activeBall = null;
  pointerHeld = false;
  scoreEl.textContent = "0";
  startOverlay.classList.remove("visible");
  gameOverOverlay.classList.remove("visible");
  window.clearInterval(dropTimer);
  dropBall();
  dropTimer = window.setInterval(dropBall, DROP_INTERVAL);
}

function dropBall() {
  if (!running) return;
  const level = randomDropLevel();
  const radius = LEVELS[level].radius;
  activeBall = new Ball(Math.max(radius + 5, Math.min(WIDTH - radius - 5, aimX)), 48, level);
  balls.push(activeBall);
  playTone(190 + level * 35, 0.06, "sine");
}

function update() {
  if (!running) return;

  for (const ball of balls) {
    if (ball === activeBall && pointerHeld && performance.now() - ball.spawnedAt < DROP_INTERVAL - 250 && ball.y < HEIGHT - 150) {
      const targetX = Math.max(ball.radius, Math.min(WIDTH - ball.radius, aimX));
      ball.vx += Math.max(-0.42, Math.min(0.42, (targetX - ball.x) * 0.018));
      ball.vx = Math.max(-4.2, Math.min(4.2, ball.vx));
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
      a.x -= nx * overlap * (massB / total);
      a.y -= ny * overlap * (massB / total);
      b.x += nx * overlap * (massA / total);
      b.y += ny * overlap * (massA / total);

      const relativeVelocity = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
      if (relativeVelocity < 0) {
        const impulse = -(1 + 0.22) * relativeVelocity / (1 / massA + 1 / massB);
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
  merged.vy = Math.min(-2.2, (a.vy + b.vy) * 0.2 - 1.2);
  balls.splice(j, 1);
  balls.splice(i, 1);
  balls.push(merged);

  const gained = LEVELS[level].points;
  score += gained;
  scoreEl.textContent = score;
  scoreEl.animate([{ transform: "scale(1.18)" }, { transform: "scale(1)" }], { duration: 220 });
  burst(x, y, LEVELS[level].color);
  playTone(320 + level * 70, 0.1, "triangle");
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

function endGame() {
  running = false;
  window.clearInterval(dropTimer);
  const isRecord = score > bestScore;
  if (isRecord) {
    bestScore = score;
    localStorage.setItem("orbitMergeBest", String(bestScore));
    bestScoreEl.textContent = bestScore;
  }
  finalScoreEl.textContent = score;
  recordMessageEl.textContent = isRecord ? "新的最高纪录！" : "再来一次，冲击更高分";
  gameOverOverlay.classList.add("visible");
  playTone(140, 0.32, "sawtooth");
}

function drawBall(target, ball, alpha = 1) {
  const style = LEVELS[ball.level];
  target.save();
  target.globalAlpha = alpha;
  target.translate(ball.x, ball.y);
  target.beginPath();
  target.arc(0, 0, ball.radius, 0, Math.PI * 2);
  target.clip();

  const image = ballImages[ball.level];
  if (image) {
    const scale = Math.max((ball.radius * 2) / image.naturalWidth, (ball.radius * 2) / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    target.drawImage(image, -width / 2, -height / 2, width, height);
    const shadeGradient = target.createRadialGradient(-ball.radius * 0.35, -ball.radius * 0.4, 0, 0, 0, ball.radius);
    shadeGradient.addColorStop(0.45, "rgba(255,255,255,0)");
    shadeGradient.addColorStop(1, "rgba(10,25,30,.3)");
    target.fillStyle = shadeGradient;
    target.fillRect(-ball.radius, -ball.radius, ball.radius * 2, ball.radius * 2);
  } else {
    const gradient = target.createRadialGradient(-ball.radius * 0.35, -ball.radius * 0.4, ball.radius * 0.08, 0, 0, ball.radius);
    gradient.addColorStop(0, style.accent);
    gradient.addColorStop(0.5, style.color);
    gradient.addColorStop(1, shade(style.color, -22));
    target.fillStyle = gradient;
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
document.getElementById("startButton").addEventListener("click", resetGame);
document.getElementById("restartButton").addEventListener("click", resetGame);
soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundButton.textContent = soundEnabled ? "音效 开" : "音效 关";
});

const photoPanel = document.getElementById("photoPanel");
const photoSlots = document.getElementById("photoSlots");

LEVELS.forEach((level, index) => {
  const label = document.createElement("label");
  label.className = "photo-slot";
  label.innerHTML = `<span class="photo-preview" style="background:${level.color}">+</span><small>${index + 1}级</small><input type="file" accept="image/*">`;
  const input = label.querySelector("input");
  const preview = label.querySelector(".photo-preview");
  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const image = new Image();
      image.addEventListener("load", () => {
        ballImages[index] = image;
        preview.innerHTML = "";
        const thumbnail = document.createElement("img");
        thumbnail.src = image.src;
        thumbnail.alt = `${index + 1}级球体照片`;
        preview.appendChild(thumbnail);
      });
      image.src = reader.result;
    });
    reader.readAsDataURL(file);
  });
  photoSlots.appendChild(label);
});

function setPhotoPanel(open) {
  photoPanel.classList.toggle("open", open);
  photoPanel.setAttribute("aria-hidden", String(!open));
}

document.getElementById("photoButton").addEventListener("click", () => setPhotoPanel(!photoPanel.classList.contains("open")));
document.getElementById("closePhotoPanel").addEventListener("click", () => setPhotoPanel(false));

function frame(time) {
  const elapsed = Math.min(40, time - lastTime);
  lastTime = time;
  const steps = Math.max(1, Math.round(elapsed / 16.67));
  for (let i = 0; i < steps; i++) update();
  draw();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
