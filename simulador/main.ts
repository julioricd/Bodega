// Simulador de Navio — jogo 2D em canvas (visão de cima).
// Pilote o navio, colete as boias na ordem e atraque no cais para vencer.

const KNOT = 0.514; // m/s

// ---------------------------------------------------------------------------
// Mundo
// ---------------------------------------------------------------------------

const WORLD = { w: 5000, h: 3500 };

interface Island {
  x: number;
  y: number;
  r: number;
  shape: { x: number; y: number }[];
}

interface Buoy {
  x: number;
  y: number;
  collected: boolean;
}

function makeIsland(x: number, y: number, r: number, seed: number): Island {
  const pts: { x: number; y: number }[] = [];
  const n = 14;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const wobble = 0.72 + 0.28 * Math.abs(Math.sin(seed * 7.3 + i * 2.17) * Math.cos(seed * 3.1 + i));
    pts.push({ x: Math.cos(a) * r * wobble, y: Math.sin(a) * r * wobble });
  }
  return { x, y, r, shape: pts };
}

const islands: Island[] = [
  makeIsland(1200, 800, 260, 1),
  makeIsland(3400, 600, 200, 2),
  makeIsland(2400, 1900, 320, 3),
  makeIsland(900, 2600, 220, 4),
  makeIsland(4200, 2400, 280, 5),
  makeIsland(4300, 1300, 150, 6),
  makeIsland(300, 1700, 130, 7),
];

const buoys: Buoy[] = [
  { x: 2000, y: 700, collected: false },
  { x: 3900, y: 950, collected: false },
  { x: 3300, y: 2600, collected: false },
  { x: 1700, y: 2750, collected: false },
  { x: 700, y: 1100, collected: false },
];

// Cais encostado na ilha central (lado leste)
const dock = { x: 2790, y: 1820, w: 120, h: 60, heading: 0 };

// ---------------------------------------------------------------------------
// Navio
// ---------------------------------------------------------------------------

const TELEGRAPH = [
  { label: 'RÉ TODA', speed: -6 * KNOT },
  { label: 'RÉ DEVAGAR', speed: -3 * KNOT },
  { label: 'PARADA', speed: 0 },
  { label: 'MUITO DEVAGAR', speed: 4 * KNOT },
  { label: 'DEVAGAR', speed: 8 * KNOT },
  { label: 'MEIA FORÇA', speed: 12 * KNOT },
  { label: 'TODA FORÇA', speed: 16 * KNOT },
];
const TELEGRAPH_STOP = 2; // índice de "PARADA"
const MAX_SPEED = 16 * KNOT;
const MAX_RUDDER = 35; // graus
const SHIP_LEN = 34; // m
const SHIP_RADIUS = 12; // raio de colisão aproximado

interface Ship {
  x: number;
  y: number;
  heading: number; // rad, 0 = norte, horário
  speed: number; // m/s (negativo = ré)
  rudder: number; // graus, negativo = bombordo
  telegraph: number;
  hull: number; // 0..100
}

function newShip(): Ship {
  return { x: 2850, y: 1700, heading: Math.PI, speed: 0, rudder: 0, telegraph: TELEGRAPH_STOP, hull: 100 };
}

let ship = newShip();
let state: 'start' | 'playing' | 'won' | 'lost' = 'start';
let elapsed = 0;
let message = '';
let messageTimer = 0;

interface Wake {
  x: number;
  y: number;
  age: number;
  life: number;
  size: number;
}
let wakes: Wake[] = [];

function resetGame() {
  ship = newShip();
  for (const b of buoys) b.collected = false;
  wakes = [];
  elapsed = 0;
  message = '';
  messageTimer = 0;
  state = 'playing';
}

function showMessage(text: string, secs = 3) {
  message = text;
  messageTimer = secs;
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------

const input = { port: false, stbd: false };

function telegraphStep(delta: number) {
  if (state !== 'playing') return;
  ship.telegraph = Math.max(0, Math.min(TELEGRAPH.length - 1, ship.telegraph + delta));
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) {
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') input.port = true;
    if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') input.stbd = true;
    return;
  }
  switch (e.key) {
    case 'a': case 'A': case 'ArrowLeft': input.port = true; break;
    case 'd': case 'D': case 'ArrowRight': input.stbd = true; break;
    case 'w': case 'W': case 'ArrowUp': telegraphStep(1); break;
    case 's': case 'S': case 'ArrowDown': telegraphStep(-1); break;
    case ' ': if (state === 'playing') ship.rudder = 0; break;
    case 'Enter':
    case 'r': case 'R':
      if (state !== 'playing') resetGame();
      break;
  }
});

window.addEventListener('keyup', (e) => {
  switch (e.key) {
    case 'a': case 'A': case 'ArrowLeft': input.port = false; break;
    case 'd': case 'D': case 'ArrowRight': input.stbd = false; break;
  }
});

function bindHold(id: string, set: (v: boolean) => void) {
  const el = document.getElementById(id)!;
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); set(true); });
  el.addEventListener('pointerup', () => set(false));
  el.addEventListener('pointerleave', () => set(false));
  el.addEventListener('pointercancel', () => set(false));
}

function bindTap(id: string, fn: () => void) {
  const el = document.getElementById(id)!;
  el.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); });
}

bindHold('btn-port', (v) => { input.port = v; });
bindHold('btn-stbd', (v) => { input.stbd = v; });
bindTap('btn-up', () => { if (state === 'playing') telegraphStep(1); else resetGame(); });
bindTap('btn-down', () => telegraphStep(-1));

window.addEventListener('pointerdown', () => {
  if (state !== 'playing') resetGame();
});

// ---------------------------------------------------------------------------
// Física
// ---------------------------------------------------------------------------

function update(dt: number) {
  if (state !== 'playing') return;
  elapsed += dt;
  if (messageTimer > 0) messageTimer -= dt;

  // Leme: move enquanto a tecla está pressionada
  const RUDDER_RATE = 35; // graus/s
  if (input.port) ship.rudder = Math.max(-MAX_RUDDER, ship.rudder - RUDDER_RATE * dt);
  if (input.stbd) ship.rudder = Math.min(MAX_RUDDER, ship.rudder + RUDDER_RATE * dt);

  // Velocidade tende ao telégrafo, com inércia grande (navio demora a responder)
  const target = TELEGRAPH[ship.telegraph].speed;
  const tau = ship.speed * (target - ship.speed) >= 0 && Math.abs(target) > Math.abs(ship.speed) ? 10 : 14;
  ship.speed += ((target - ship.speed) / tau) * dt;

  // Curva: o leme só funciona com água passando pelo casco
  const flow = ship.speed / MAX_SPEED;
  const turnRate = (ship.rudder * Math.PI / 180) * flow * 0.55; // rad/s
  ship.heading += turnRate * dt;

  // Curvar com força reduz a velocidade
  ship.speed *= 1 - Math.abs(turnRate) * 0.25 * dt;

  ship.x += Math.sin(ship.heading) * ship.speed * dt;
  ship.y -= Math.cos(ship.heading) * ship.speed * dt;

  // Limites do mundo
  if (ship.x < 30 || ship.x > WORLD.w - 30 || ship.y < 30 || ship.y > WORLD.h - 30) {
    ship.x = Math.max(30, Math.min(WORLD.w - 30, ship.x));
    ship.y = Math.max(30, Math.min(WORLD.h - 30, ship.y));
    ship.speed *= 0.5;
    showMessage('Você atingiu o limite da carta náutica!');
  }

  // Colisão com ilhas
  for (const isl of islands) {
    const dx = ship.x - isl.x;
    const dy = ship.y - isl.y;
    const dist = Math.hypot(dx, dy);
    const minDist = isl.r * 0.85 + SHIP_RADIUS;
    if (dist < minDist) {
      const impact = Math.abs(ship.speed);
      ship.hull -= Math.max(4, impact * 6);
      const nx = dx / (dist || 1);
      const ny = dy / (dist || 1);
      ship.x = isl.x + nx * minDist;
      ship.y = isl.y + ny * minDist;
      ship.speed *= -0.3;
      if (ship.hull <= 0) {
        ship.hull = 0;
        state = 'lost';
      } else {
        showMessage('ENCALHOU! Casco danificado.');
      }
    }
  }

  // Boias (na ordem)
  const next = buoys.find((b) => !b.collected);
  if (next) {
    if (Math.hypot(ship.x - next.x, ship.y - next.y) < 45) {
      next.collected = true;
      const remaining = buoys.filter((b) => !b.collected).length;
      showMessage(remaining > 0
        ? `Boia coletada! Faltam ${remaining}.`
        : 'Todas as boias coletadas! Volte e atraque no cais.');
    }
  } else {
    // Atracação: dentro da zona do cais e quase parado
    const dx = ship.x - (dock.x + dock.w / 2);
    const dy = ship.y - (dock.y + dock.h / 2);
    if (Math.abs(dx) < dock.w / 2 + 30 && Math.abs(dy) < dock.h / 2 + 30) {
      if (Math.abs(ship.speed) < 1.0) {
        state = 'won';
      } else if (messageTimer <= 0) {
        showMessage('Reduza para atracar (menos de 2 nós)!', 1.5);
      }
    }
  }

  // Esteira (espuma atrás do navio)
  if (Math.abs(ship.speed) > 1.2) {
    const sternX = ship.x - Math.sin(ship.heading) * SHIP_LEN * 0.45;
    const sternY = ship.y + Math.cos(ship.heading) * SHIP_LEN * 0.45;
    wakes.push({
      x: sternX + (Math.random() - 0.5) * 6,
      y: sternY + (Math.random() - 0.5) * 6,
      age: 0,
      life: 2.5 + Math.random(),
      size: 3 + Math.abs(ship.speed) * 0.8,
    });
  }
  for (const w of wakes) w.age += dt;
  wakes = wakes.filter((w) => w.age < w.life);
}

// ---------------------------------------------------------------------------
// Renderização
// ---------------------------------------------------------------------------

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function resize() {
  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;
}
window.addEventListener('resize', resize);
resize();

function hash(ix: number, iy: number): number {
  let h = ix * 374761393 + iy * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function drawWater(camX: number, camY: number, scale: number, vw: number, vh: number, time: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, vh);
  grad.addColorStop(0, '#13486b');
  grad.addColorStop(1, '#0b2a3d');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, vw, vh);

  // Ondulações: arcos pseudoaleatórios em uma grade fixa do mundo
  const cell = 90;
  const x0 = Math.floor((camX - vw / 2 / scale) / cell) - 1;
  const x1 = Math.floor((camX + vw / 2 / scale) / cell) + 1;
  const y0 = Math.floor((camY - vh / 2 / scale) / cell) - 1;
  const y1 = Math.floor((camY + vh / 2 / scale) / cell) + 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1.5;
  for (let gx = x0; gx <= x1; gx++) {
    for (let gy = y0; gy <= y1; gy++) {
      const r = hash(gx, gy);
      if (r < 0.45) continue;
      const phase = (time * 0.6 + r * 10) % 4;
      if (phase > 2) continue;
      const wx = (gx + hash(gx + 7, gy) ) * cell;
      const wy = (gy + hash(gx, gy + 7)) * cell;
      const sx = (wx - camX) * scale + vw / 2;
      const sy = (wy - camY) * scale + vh / 2;
      const len = (10 + r * 18) * scale * (1 - Math.abs(phase - 1));
      ctx.beginPath();
      ctx.arc(sx, sy, len, Math.PI * 0.15, Math.PI * 0.55);
      ctx.stroke();
    }
  }
}

function worldToScreen(x: number, y: number, camX: number, camY: number, scale: number, vw: number, vh: number) {
  return { x: (x - camX) * scale + vw / 2, y: (y - camY) * scale + vh / 2 };
}

function drawIsland(isl: Island, camX: number, camY: number, scale: number, vw: number, vh: number) {
  const c = worldToScreen(isl.x, isl.y, camX, camY, scale, vw, vh);
  if (c.x < -isl.r * scale * 1.5 || c.x > vw + isl.r * scale * 1.5 ||
      c.y < -isl.r * scale * 1.5 || c.y > vh + isl.r * scale * 1.5) return;

  for (const [grow, color] of [[1.25, '#7fb7c9'], [1.1, '#e8d8a8'], [1.0, '#c9b87a'], [0.8, '#5a7d4a'], [0.55, '#3e5e35']] as [number, string][]) {
    ctx.fillStyle = color;
    ctx.beginPath();
    isl.shape.forEach((p, i) => {
      const sx = c.x + p.x * grow * scale;
      const sy = c.y + p.y * grow * scale;
      i === 0 ? ctx.moveTo(sx, sy) : ctx.lineTo(sx, sy);
    });
    ctx.closePath();
    ctx.fill();
  }
}

function drawDock(camX: number, camY: number, scale: number, vw: number, vh: number, active: boolean, time: number) {
  const c = worldToScreen(dock.x, dock.y, camX, camY, scale, vw, vh);
  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(c.x, c.y, dock.w * scale, dock.h * scale);
  ctx.strokeStyle = '#4a3320';
  ctx.lineWidth = 2;
  for (let i = 1; i < 6; i++) {
    const px = c.x + (dock.w * scale * i) / 6;
    ctx.beginPath();
    ctx.moveTo(px, c.y);
    ctx.lineTo(px, c.y + dock.h * scale);
    ctx.stroke();
  }
  if (active) {
    const pulse = 0.5 + 0.5 * Math.sin(time * 4);
    ctx.strokeStyle = `rgba(120, 255, 140, ${0.4 + 0.5 * pulse})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(c.x - 30 * scale, c.y - 30 * scale, (dock.w + 60) * scale, (dock.h + 60) * scale);
    ctx.setLineDash([]);
  }
}

function drawBuoy(b: Buoy, isNext: boolean, camX: number, camY: number, scale: number, vw: number, vh: number, time: number) {
  if (b.collected) return;
  const c = worldToScreen(b.x, b.y, camX, camY, scale, vw, vh);
  const bob = Math.sin(time * 2 + b.x) * 2 * scale;
  const r = 8 * scale;

  if (isNext) {
    const pulse = (time * 1.5) % 1;
    ctx.strokeStyle = `rgba(255, 200, 60, ${1 - pulse})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(c.x, c.y + bob, r + 40 * scale * pulse, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = isNext ? '#ff5a36' : '#b8442a';
  ctx.beginPath();
  ctx.arc(c.x, c.y + bob, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(c.x, c.y + bob, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
  // mastro com bandeirola
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y + bob - r);
  ctx.lineTo(c.x, c.y + bob - r - 14 * scale);
  ctx.stroke();
  ctx.fillStyle = '#ffcf3d';
  ctx.beginPath();
  ctx.moveTo(c.x, c.y + bob - r - 14 * scale);
  ctx.lineTo(c.x + 10 * scale, c.y + bob - r - 10 * scale);
  ctx.lineTo(c.x, c.y + bob - r - 6 * scale);
  ctx.closePath();
  ctx.fill();
}

function drawShip(camX: number, camY: number, scale: number, vw: number, vh: number) {
  // Esteira
  for (const w of wakes) {
    const c = worldToScreen(w.x, w.y, camX, camY, scale, vw, vh);
    const t = w.age / w.life;
    ctx.fillStyle = `rgba(220, 240, 250, ${0.35 * (1 - t)})`;
    ctx.beginPath();
    ctx.arc(c.x, c.y, (w.size + t * 14) * scale, 0, Math.PI * 2);
    ctx.fill();
  }

  const c = worldToScreen(ship.x, ship.y, camX, camY, scale, vw, vh);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(ship.heading);
  const L = SHIP_LEN * scale;
  const W = 11 * scale;

  // Casco
  ctx.fillStyle = '#2e3a45';
  ctx.beginPath();
  ctx.moveTo(0, -L / 2); // proa
  ctx.quadraticCurveTo(W / 2, -L / 4, W / 2, 0);
  ctx.lineTo(W / 2, L / 2 - 4 * scale);
  ctx.quadraticCurveTo(0, L / 2, -W / 2, L / 2 - 4 * scale);
  ctx.lineTo(-W / 2, 0);
  ctx.quadraticCurveTo(-W / 2, -L / 4, 0, -L / 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#1a232b';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Convés
  ctx.fillStyle = '#c9bfa0';
  ctx.beginPath();
  ctx.moveTo(0, -L / 2 + 5 * scale);
  ctx.quadraticCurveTo(W / 2 - 3 * scale, -L / 4, W / 2 - 3 * scale, 0);
  ctx.lineTo(W / 2 - 3 * scale, L / 2 - 7 * scale);
  ctx.lineTo(-W / 2 + 3 * scale, L / 2 - 7 * scale);
  ctx.lineTo(-W / 2 + 3 * scale, 0);
  ctx.quadraticCurveTo(-W / 2 + 3 * scale, -L / 4, 0, -L / 2 + 5 * scale);
  ctx.closePath();
  ctx.fill();

  // Cabine
  ctx.fillStyle = '#f0ece0';
  ctx.fillRect(-W / 4, -2 * scale, W / 2, L / 4);
  ctx.fillStyle = '#3a4d39';
  ctx.fillRect(-W / 6, 0, W / 3, L / 9);

  // Chaminé
  ctx.fillStyle = '#C45D38';
  ctx.beginPath();
  ctx.arc(0, L / 5, 2.6 * scale, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function roundRect(x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function drawHUD(vw: number, vh: number, time: number) {
  const ui = Math.min(vw, vh) / 720; // fator de escala da interface
  const pad = 16 * ui;
  ctx.textBaseline = 'top';

  // ---- Painel principal (canto superior esquerdo)
  const pw = 250 * ui;
  const ph = 196 * ui;
  ctx.fillStyle = 'rgba(8, 24, 36, 0.78)';
  roundRect(pad, pad, pw, ph, 10 * ui);
  ctx.fill();

  const knots = ship.speed / KNOT;
  const hdg = ((ship.heading * 180 / Math.PI) % 360 + 360) % 360;
  const lines: [string, string][] = [
    ['VELOCIDADE', `${knots.toFixed(1)} nós`],
    ['RUMO', `${hdg.toFixed(0).padStart(3, '0')}°`],
    ['MÁQUINAS', TELEGRAPH[ship.telegraph].label],
  ];
  let ty = pad + 12 * ui;
  for (const [label, value] of lines) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `${11 * ui}px 'DM Mono', monospace`;
    ctx.fillText(label, pad + 14 * ui, ty);
    ctx.fillStyle = '#fff';
    ctx.font = `600 ${17 * ui}px 'Space Grotesk', sans-serif`;
    ctx.fillText(value, pad + 110 * ui, ty - 3 * ui);
    ty += 30 * ui;
  }

  // Leme: barra com indicador
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `${11 * ui}px 'DM Mono', monospace`;
  ctx.fillText('LEME', pad + 14 * ui, ty);
  const bx = pad + 110 * ui;
  const bw = 120 * ui;
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(bx, ty + 3 * ui, bw, 6 * ui);
  ctx.fillStyle = '#fff';
  ctx.fillRect(bx + bw / 2 - 1, ty, 2, 12 * ui);
  ctx.fillStyle = '#ffcf3d';
  const rud = ship.rudder / MAX_RUDDER;
  ctx.beginPath();
  ctx.arc(bx + bw / 2 + rud * bw / 2, ty + 6 * ui, 5 * ui, 0, Math.PI * 2);
  ctx.fill();
  ty += 30 * ui;

  // Casco: barra de integridade
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('CASCO', pad + 14 * ui, ty);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(bx, ty + 3 * ui, bw, 6 * ui);
  ctx.fillStyle = ship.hull > 50 ? '#6fd86f' : ship.hull > 25 ? '#ffcf3d' : '#ff5a36';
  ctx.fillRect(bx, ty + 3 * ui, bw * ship.hull / 100, 6 * ui);
  ty += 30 * ui;

  // Cronômetro
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText('TEMPO', pad + 14 * ui, ty);
  ctx.fillStyle = '#fff';
  ctx.font = `600 ${17 * ui}px 'Space Grotesk', sans-serif`;
  ctx.fillText(formatTime(elapsed), pad + 110 * ui, ty - 3 * ui);

  // ---- Missão (centro superior)
  const next = buoys.find((b) => !b.collected);
  const collected = buoys.filter((b) => b.collected).length;
  const mission = next ? `Colete a boia ${collected + 1} de ${buoys.length}` : 'Atraque no cais (menos de 2 nós)';
  ctx.font = `600 ${16 * ui}px 'Space Grotesk', sans-serif`;
  const mw = ctx.measureText(mission).width + 36 * ui;
  ctx.fillStyle = 'rgba(8, 24, 36, 0.78)';
  roundRect(vw / 2 - mw / 2, pad, mw, 34 * ui, 17 * ui);
  ctx.fill();
  ctx.fillStyle = '#ffcf3d';
  ctx.textAlign = 'center';
  ctx.fillText(mission, vw / 2, pad + 9 * ui);
  ctx.textAlign = 'left';

  // ---- Seta para o alvo
  const target = next ?? { x: dock.x + dock.w / 2, y: dock.y + dock.h / 2 };
  const dx = target.x - ship.x;
  const dy = target.y - ship.y;
  const distM = Math.hypot(dx, dy);
  if (distM > 180) {
    const ang = Math.atan2(dy, dx);
    const cx = vw / 2 + Math.cos(ang) * Math.min(vw, vh) * 0.32;
    const cy = vh / 2 + Math.sin(ang) * Math.min(vw, vh) * 0.32;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.fillStyle = next ? '#ff5a36' : '#6fd86f';
    ctx.beginPath();
    ctx.moveTo(14 * ui, 0);
    ctx.lineTo(-8 * ui, -9 * ui);
    ctx.lineTo(-8 * ui, 9 * ui);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `${12 * ui}px 'DM Mono', monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(`${(distM / 1000).toFixed(2)} km`, cx, cy + 16 * ui);
    ctx.textAlign = 'left';
  }

  // ---- Minimapa (canto superior direito)
  const mmW = 180 * ui;
  const mmH = mmW * WORLD.h / WORLD.w;
  const mx = vw - mmW - pad;
  const my = pad;
  ctx.fillStyle = 'rgba(8, 24, 36, 0.78)';
  roundRect(mx - 6 * ui, my - 6 * ui, mmW + 12 * ui, mmH + 12 * ui, 8 * ui);
  ctx.fill();
  ctx.fillStyle = '#0e3852';
  ctx.fillRect(mx, my, mmW, mmH);
  const k = mmW / WORLD.w;
  ctx.fillStyle = '#5a7d4a';
  for (const isl of islands) {
    ctx.beginPath();
    ctx.arc(mx + isl.x * k, my + isl.y * k, Math.max(2, isl.r * k), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#6b4a2f';
  ctx.fillRect(mx + dock.x * k - 2, my + dock.y * k - 2, 5, 5);
  for (const b of buoys) {
    if (b.collected) continue;
    ctx.fillStyle = b === next ? '#ff5a36' : '#b8442a';
    ctx.beginPath();
    ctx.arc(mx + b.x * k, my + b.y * k, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(mx + ship.x * k, my + ship.y * k);
  ctx.rotate(ship.heading);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(0, -5);
  ctx.lineTo(3.5, 4);
  ctx.lineTo(-3.5, 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // ---- Mensagem temporária
  if (messageTimer > 0 && message) {
    ctx.font = `600 ${18 * ui}px 'Space Grotesk', sans-serif`;
    const w = ctx.measureText(message).width + 40 * ui;
    ctx.fillStyle = 'rgba(8, 24, 36, 0.85)';
    roundRect(vw / 2 - w / 2, vh * 0.72, w, 40 * ui, 20 * ui);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(message, vw / 2, vh * 0.72 + 10 * ui);
    ctx.textAlign = 'left';
  }

  // ---- Dica de controles (rodapé)
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = `${12 * ui}px 'DM Mono', monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('W/S máquinas · A/D leme · ESPAÇO centrar leme', vw / 2, vh - 26 * ui);
  ctx.textAlign = 'left';
}

function drawOverlay(vw: number, vh: number) {
  const ui = Math.min(vw, vh) / 720;
  ctx.fillStyle = 'rgba(5, 18, 28, 0.78)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (state === 'start') {
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${44 * ui}px 'Space Grotesk', sans-serif`;
    ctx.fillText('SIMULADOR DE NAVIO', vw / 2, vh * 0.3);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = `${17 * ui}px 'Space Grotesk', sans-serif`;
    const lines = [
      'Colete as 5 boias na ordem indicada e atraque no cais.',
      'O navio tem inércia: planeje as curvas e as paradas com antecedência.',
      'Cuidado com as ilhas — encalhar danifica o casco!',
      '',
      'W/S — telégrafo de máquinas (frente/ré)',
      'A/D — leme · ESPAÇO — centrar o leme',
    ];
    lines.forEach((l, i) => ctx.fillText(l, vw / 2, vh * 0.42 + i * 26 * ui));
    ctx.fillStyle = '#ffcf3d';
    ctx.font = `600 ${20 * ui}px 'Space Grotesk', sans-serif`;
    ctx.fillText('Pressione ENTER (ou toque) para zarpar', vw / 2, vh * 0.74);
  } else if (state === 'won') {
    ctx.fillStyle = '#6fd86f';
    ctx.font = `700 ${44 * ui}px 'Space Grotesk', sans-serif`;
    ctx.fillText('ATRACADO COM SUCESSO!', vw / 2, vh * 0.38);
    ctx.fillStyle = '#fff';
    ctx.font = `${20 * ui}px 'Space Grotesk', sans-serif`;
    ctx.fillText(`Tempo: ${formatTime(elapsed)} · Casco: ${ship.hull.toFixed(0)}%`, vw / 2, vh * 0.48);
    ctx.fillStyle = '#ffcf3d';
    ctx.font = `600 ${18 * ui}px 'Space Grotesk', sans-serif`;
    ctx.fillText('Pressione R (ou toque) para navegar de novo', vw / 2, vh * 0.6);
  } else if (state === 'lost') {
    ctx.fillStyle = '#ff5a36';
    ctx.font = `700 ${44 * ui}px 'Space Grotesk', sans-serif`;
    ctx.fillText('NAUFRÁGIO!', vw / 2, vh * 0.38);
    ctx.fillStyle = '#fff';
    ctx.font = `${20 * ui}px 'Space Grotesk', sans-serif`;
    ctx.fillText('O casco não resistiu aos encalhes.', vw / 2, vh * 0.48);
    ctx.fillStyle = '#ffcf3d';
    ctx.font = `600 ${18 * ui}px 'Space Grotesk', sans-serif`;
    ctx.fillText('Pressione R (ou toque) para tentar de novo', vw / 2, vh * 0.6);
  }

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
}

function render(time: number) {
  const vw = canvas.width;
  const vh = canvas.height;
  const scale = (Math.min(vw, vh) / 420) ; // ~420 m visíveis na menor dimensão
  const camX = ship.x;
  const camY = ship.y;

  drawWater(camX, camY, scale, vw, vh, time);

  const next = buoys.find((b) => !b.collected);
  drawDock(camX, camY, scale, vw, vh, !next && state === 'playing', time);
  for (const isl of islands) drawIsland(isl, camX, camY, scale, vw, vh);
  for (const b of buoys) drawBuoy(b, b === next, camX, camY, scale, vw, vh, time);
  drawShip(camX, camY, scale, vw, vh);

  if (state === 'playing') {
    drawHUD(vw, vh, time);
  } else {
    drawOverlay(vw, vh);
  }
}

// ---------------------------------------------------------------------------
// Loop principal
// ---------------------------------------------------------------------------

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  update(dt);
  render(now / 1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
