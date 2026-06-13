// Simulador de Manobra — Offloading Tandem: VLCC × FPSO Peregrino
// Visão de cima, 2D em canvas. Todas as unidades em metros, segundos,
// kN (forças) e toneladas (massa) — kN / t = m/s² diretamente.

const KNOT = 0.5144; // m/s
const DEG = Math.PI / 180;

const dirVec = (psi: number) => ({ x: Math.sin(psi), y: -Math.cos(psi) }); // proa
const stbVec = (psi: number) => ({ x: Math.cos(psi), y: Math.sin(psi) });  // boreste
const norm = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const compass = (psi: number) => ((psi / DEG) % 360 + 360) % 360;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---------------------------------------------------------------------------
// Configuração da manobra (tela inicial)
// ---------------------------------------------------------------------------

const LOAD_OPTIONS = [
  { label: 'LASTRO (0%)', cargo: 0 },
  { label: 'MEIA CARGA (50%)', cargo: 50 },
  { label: 'QUASE CHEIO (85%)', cargo: 85 },
];
const DIR_LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

const setup = {
  load: 0,        // índice em LOAD_OPTIONS
  windKt: 15,     // 0..35, passo 5
  windDir: 0,     // 0..315, passo 45 (de onde vem)
  hs: 1.5,        // 0.5..4.0, passo 0.5
  curKt: 0.5,     // 0..2, passo 0.25
  curDir: 4,      // índice 0..7 (para onde vai)
  row: 0,
};

const SETUP_ROWS = [
  {
    name: 'CONDIÇÃO DE CARGA DO VLCC',
    value: () => LOAD_OPTIONS[setup.load].label,
    change: (d: number) => { setup.load = (setup.load + d + 3) % 3; },
  },
  {
    name: 'VENTO (INTENSIDADE)',
    value: () => `${setup.windKt} nós`,
    change: (d: number) => { setup.windKt = clamp(setup.windKt + d * 5, 0, 35); },
  },
  {
    name: 'VENTO (DE ONDE VEM)',
    value: () => `${DIR_LABELS[setup.windDir / 45]} (${setup.windDir.toString().padStart(3, '0')}°)`,
    change: (d: number) => { setup.windDir = (setup.windDir + d * 45 + 360) % 360; },
  },
  {
    name: 'ALTURA DE MAR (Hs)',
    value: () => `${setup.hs.toFixed(1)} m`,
    change: (d: number) => { setup.hs = clamp(Math.round((setup.hs + d * 0.5) * 2) / 2, 0.5, 4); },
  },
  {
    name: 'CORRENTE (INTENSIDADE)',
    value: () => `${setup.curKt.toFixed(2)} nós`,
    change: (d: number) => { setup.curKt = clamp(Math.round((setup.curKt + d * 0.25) * 4) / 4, 0, 2); },
  },
  {
    name: 'CORRENTE (PARA ONDE VAI)',
    value: () => `${DIR_LABELS[setup.curDir]} (${(setup.curDir * 45).toString().padStart(3, '0')}°)`,
    change: (d: number) => { setup.curDir = (setup.curDir + d + 8) % 8; },
  },
];

// ---------------------------------------------------------------------------
// Constantes do cenário
// ---------------------------------------------------------------------------

// FPSO Peregrino (turret interno — gira com o tempo, "weathervaning")
const FPSO_L = 285;
const FPSO_B = 54;
const FPSO_TURRET_FWD = 70;   // turret a 70 m da proa
const TURRET = { x: 6000, y: 6000 };

// VLCC
const VLCC_L = 330;
const VLCC_B = 60;

// Linhas e limites
const HAWSER_LEN = 150;        // comprimento nominal do hawser do FPSO (m)
const HAWSER_K = 200;          // rigidez (kN/m de estiramento)
const HAWSER_ALARM = 1275;       // kN (~130 t) — alarme antes da ruptura
const HAWSER_BREAK = 1766;       // kN (~180 t) — ruptura do hawser
const HAWSER_BREAK_CHAFE = 1080; // kN (~110 t) — ruptura com abrasão no fairlead
const TUG_LINE_LEN = 500;        // cabo de trabalho do rebocador (m)
const HOSE_MAX = 420;            // distância máx. popa FPSO → manifold (backstop)
const HOSE_PART_T = 20;          // toneladas — ruptura do mangote por tração
const HOSE_TAUT_MARGIN = 15;     // m de folga antes do mangote começar a tracionar
const HOSE_K_T = 0.5;            // toneladas por metro de estiramento do mangote
const HAWSER_GRACE = 300;        // s (5 min) para segurar o navio após romper o hawser
const WINCH_T = 45;            // s para recolher o hawser
const HOSE_T = 40;             // s para conectar os mangotes
const TOTAL_BBL = 1_000_000;   // capacidade do VLCC
const PUMP_PCT_S = 0.35;       // % da carga por segundo (acelerado)

const TELEGRAPH = [
  { label: 'TODA FORÇA RÉ', thrust: -2000 },
  { label: 'MEIA FORÇA RÉ', thrust: -1100 },
  { label: 'DEVAGAR RÉ', thrust: -550 },
  { label: 'MTO DEVAGAR RÉ', thrust: -280 },
  { label: 'PARADA', thrust: 0 },
  { label: 'MTO DEVAGAR AV', thrust: 350 },
  { label: 'DEVAGAR AV', thrust: 700 },
  { label: 'MEIA FORÇA AV', thrust: 1400 },
  { label: 'TODA FORÇA AV', thrust: 2800 },
];
const TEL_STOP = 4;
const MAX_RUDDER = 30; // graus, em passos de 10

const TUG_FORCES = [0, 300, 600];      // kN (0 / 30 t / 60 t)
const TUG_DIRS = [
  { label: 'RÉ', ang: 180 },
  { label: 'BB', ang: 215 },
  { label: 'BE', ang: 145 },
];
const PUSHER_FORCE = 160; // kN (~16 t) da lancha empurradora

// ---------------------------------------------------------------------------
// Estado da simulação
// ---------------------------------------------------------------------------

type Phase = 'setup' | 'run' | 'success' | 'failed';
let phase: Phase = 'setup';
let failReason = '';
let elapsed = 0;
let timeScale = 1;
let paused = false;

// ambiente (evolui durante a manobra)
const env = { windKt: 15, windDir: 0, windDirRate: 0, hs: 1.5, curKt: 0.5, curDir: 0 };
let squall = { active: false, t: 0, dur: 0, extraKt: 0, veer: 0 };
let chafeT = -1; // > 0: alerta de abrasão do hawser ativo (s restantes)
let hoseLeak = false;
let nextEventT = 0;

// FPSO
const fpso = { psi: 0, x: TURRET.x, y: TURRET.y };

// VLCC — estado em corpo (u avante, v boreste, r guinada)
const ship = {
  x: 0, y: 0, psi: 0, u: 0, v: 0, r: 0,
  rudder: 0,            // graus, BE positivo
  telegraph: TEL_STOP,
  thrust: 0,            // kN efetivo (com atraso de máquina)
  cargoPct: 0,          // % da capacidade
  damage: 0,            // 0..100
};

// linhas / fases da amarração
let approachAuth = false;
let approachWarned = false;
let messengerDelivered = false;
let winching = false;
let winchProgress = 0;
let hawserConnected = false;
let hawserDist = HAWSER_LEN;
let hawserPrevDist = HAWSER_LEN;
let hawserTension = 0;
let maxTension = 0;
let hoseConnected = false;
let hoseProgress = -1;   // -1 inativo; 0..HOSE_T conectando
let hoseRuptured = false;
let pumping = false;
let pumpRequested = false;
let discAuthorized = false;
let spillRate = 0;       // bbl/s
let spilled = 0;         // bbl
let spillReportT = -1;   // tempo desde o início do vazamento sem comunicação
let hoseTension = 0;     // toneladas — tração atual no mangote
let hoseNominal = -1;    // distância manifold→popa FPSO no momento da conexão (m)
let hawserGraceT = -1;   // > 0: janela (s) para salvar o mangote após romper o hawser
let pumpStopAsk = false; // sistema pediu para parar a bomba de carga
let fpsoMoorPhase = 0;   // fase da rotação lenta do FPSO após amarrado
let pusherHintT = -999;  // controle de repetição da dica da lancha empurradora

// embarcações de apoio
const msgBoat = { x: 0, y: 0, state: 'idle' as 'idle' | 'enroute' | 'alongside' | 'return', t: 0 };
const hoseBoat = { x: 0, y: 0 };
const pusher = { x: 0, y: 0, side: 0 }; // side: -1 empurra p/ BB, +1 p/ BE, 0 parado
const tug = { x: 0, y: 0, force: 0, dir: 0 }; // índices em TUG_FORCES / TUG_DIRS

// ---------------------------------------------------------------------------
// Áudio — vento, mar, ruptura e vazamento (Web Audio API)
// Inicia no primeiro toque/tecla (exigência de autoplay dos navegadores).
// ---------------------------------------------------------------------------
const audio = (() => {
  let ac: AudioContext | null = null;
  let master: GainNode;
  let windGain: GainNode, windFilter: BiquadFilterNode;
  let seaGain: GainNode, seaFilter: BiquadFilterNode;
  let leakGain: GainNode;
  let ready = false;
  let muted = false;
  let swell = 0;

  function noiseBuffer(c: AudioContext, brown: boolean) {
    const len = c.sampleRate * 2;
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else d[i] = w;
    }
    return buf;
  }

  function loopSource(c: AudioContext, brown: boolean) {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, brown);
    src.loop = true;
    src.start();
    return src;
  }

  function ensure() {
    if (ready) { if (ac && ac.state === 'suspended') ac.resume(); return; }
    try {
      const AC = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      const c: AudioContext = new AC();
      ac = c;
      master = c.createGain(); master.gain.value = muted ? 0 : 0.9; master.connect(c.destination);

      windFilter = c.createBiquadFilter(); windFilter.type = 'bandpass';
      windFilter.frequency.value = 500; windFilter.Q.value = 0.6;
      windGain = c.createGain(); windGain.gain.value = 0;
      loopSource(c, false).connect(windFilter); windFilter.connect(windGain); windGain.connect(master);

      seaFilter = c.createBiquadFilter(); seaFilter.type = 'lowpass';
      seaFilter.frequency.value = 360; seaFilter.Q.value = 0.3;
      seaGain = c.createGain(); seaGain.gain.value = 0;
      loopSource(c, true).connect(seaFilter); seaFilter.connect(seaGain); seaGain.connect(master);

      const leakFilter = c.createBiquadFilter(); leakFilter.type = 'bandpass';
      leakFilter.frequency.value = 900; leakFilter.Q.value = 0.8;
      leakGain = c.createGain(); leakGain.gain.value = 0;
      loopSource(c, false).connect(leakFilter); leakFilter.connect(leakGain); leakGain.connect(master);

      ready = true;
    } catch { ready = false; }
  }

  function update(dt: number) {
    if (!ready || !ac || muted) return;
    swell += dt;
    // vento: 0..35 nós controla volume e brilho; rajada intensifica
    const wn = clamp(env.windKt / 35, 0, 1.3);
    const gust = squall.active ? 1.25 : 1;
    windGain.gain.value += (clamp(wn * 0.5 * gust, 0, 0.6) - windGain.gain.value) * clamp(dt * 2, 0, 1);
    windFilter.frequency.value = 350 + wn * 900 + (squall.active ? 200 : 0);
    // mar: altura significativa Hs controla volume, com marola lenta
    const sn = clamp(env.hs / 5, 0, 1);
    const wave = 0.6 + 0.4 * Math.sin(swell * 0.6);
    seaGain.gain.value += (clamp(sn * 0.45 * wave, 0, 0.5) - seaGain.gain.value) * clamp(dt * 2, 0, 1);
    // vazamento: jorro de óleo controlado pelo spillRate
    const ln = clamp(spillRate / 60, 0, 1);
    leakGain.gain.value += (ln * 0.5 - leakGain.gain.value) * clamp(dt * 3, 0, 1);
  }

  // estampido de ruptura (hawser ou mangote chicoteando)
  function crack() {
    if (!ready || !ac || muted) return;
    const t = ac.currentTime;
    const src = ac.createBufferSource(); src.buffer = noiseBuffer(ac, false);
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1200, t); bp.frequency.exponentialRampToValueAtTime(180, t + 0.4); bp.Q.value = 1.2;
    const g = ac.createGain(); g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    src.connect(bp); bp.connect(g); g.connect(master); src.start(t); src.stop(t + 0.55);
    const o = ac.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.3);
    const og = ac.createGain(); og.gain.setValueAtTime(0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(og); og.connect(master); o.start(t); o.stop(t + 0.4);
  }

  function toggle() { muted = !muted; if (ready) master.gain.value = muted ? 0 : 0.9; return muted; }

  return { ensure, update, crack, toggle };
})();

['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
  window.addEventListener(ev, () => audio.ensure(), { passive: true }));

// VHF
let vhfOpen = false;
interface RadioMsg { t: number; from: string; text: string; }
let radioLog: RadioMsg[] = [];
let pendingRadio: { at: number; from: string; text: string; fn?: () => void }[] = [];

// óleo derramado
interface OilBlob { x: number; y: number; r: number; age: number; }
let oil: OilBlob[] = [];

// registro
let incidents: string[] = [];
let message = '';
let messageTimer = 0;

function showMessage(text: string, secs = 4) { message = text; messageTimer = secs; }

function radio(from: string, text: string) {
  radioLog.push({ t: elapsed, from, text });
  if (radioLog.length > 7) radioLog.shift();
}

function radioLater(delay: number, from: string, text: string, fn?: () => void) {
  pendingRadio.push({ at: elapsed + delay, from, text, fn });
}

function addIncident(text: string) {
  incidents.push(`${fmtTime(elapsed)} — ${text}`);
}

// ---------------------------------------------------------------------------
// Parâmetros dependentes da carga
// ---------------------------------------------------------------------------

function loadParams() {
  const lf = ship.cargoPct / 100;
  return {
    mass: 140000 + 180000 * lf,         // t
    izz: (140000 + 180000 * lf) * 6800, // t·m²
    cdu: 55 + 18 * lf,                  // arrasto longitudinal (kN/(m/s)²)
    cdv: 1500 + 1900 * lf,              // arrasto lateral
    cax: 1.05 - 0.5 * lf,               // vento frontal
    cay: 5.2 - 3.2 * lf,                // vento lateral (lastro pega muito mais vento)
  };
}

// ---------------------------------------------------------------------------
// Pontos de referência
// ---------------------------------------------------------------------------

function fpsoBow() { const f = dirVec(fpso.psi); return { x: fpso.x + f.x * FPSO_TURRET_FWD, y: fpso.y + f.y * FPSO_TURRET_FWD }; }
function fpsoStern() { const f = dirVec(fpso.psi); const a = FPSO_L - FPSO_TURRET_FWD; return { x: fpso.x - f.x * a, y: fpso.y - f.y * a }; }
function shipBow() { const f = dirVec(ship.psi); return { x: ship.x + f.x * VLCC_L / 2, y: ship.y + f.y * VLCC_L / 2 }; }
function shipStern() { const f = dirVec(ship.psi); return { x: ship.x - f.x * VLCC_L / 2, y: ship.y - f.y * VLCC_L / 2 }; }
function shipManifold() { return { x: ship.x, y: ship.y }; } // manifold a meia-nau
function sog() { return Math.hypot(ship.u, ship.v); }
function bowDist() { const b = shipBow(); const s = fpsoStern(); return Math.hypot(b.x - s.x, b.y - s.y); }

function windToward() {
  const v = env.windKt * KNOT;
  return { x: -Math.sin(env.windDir) * v, y: Math.cos(env.windDir) * v };
}
function currentToward() {
  const v = env.curKt * KNOT;
  return { x: Math.sin(env.curDir) * v, y: -Math.cos(env.curDir) * v };
}

// ---------------------------------------------------------------------------
// Início da manobra
// ---------------------------------------------------------------------------

function startRun() {
  elapsed = 0;
  timeScale = 1;
  paused = false;
  failReason = '';
  incidents = [];
  radioLog = [];
  pendingRadio = [];
  oil = [];
  spilled = 0;
  spillRate = 0;
  spillReportT = -1;
  maxTension = 0;

  env.windKt = setup.windKt;
  env.windDir = setup.windDir * DEG;
  env.windDirRate = 0;
  env.hs = setup.hs;
  env.curKt = setup.curKt;
  env.curDir = setup.curDir * 45 * DEG;
  squall = { active: false, t: 0, dur: 0, extraKt: 0, veer: 0 };
  chafeT = -1;
  hoseLeak = false;
  nextEventT = 70;

  // FPSO aproado à resultante ambiental
  fpso.psi = fpsoTargetPsi();

  // VLCC ~1600 m por ante a ré da popa do FPSO, levemente aberto
  const f = dirVec(fpso.psi);
  const s = stbVec(fpso.psi);
  const st = fpsoStern();
  ship.x = st.x - f.x * 1600 + s.x * 180;
  ship.y = st.y - f.y * 1600 + s.y * 180;
  ship.psi = fpso.psi - 6 * DEG;
  ship.u = 3 * KNOT;
  ship.v = 0;
  ship.r = 0;
  ship.rudder = 0;
  ship.telegraph = TEL_STOP + 1;
  ship.thrust = TELEGRAPH[ship.telegraph].thrust;
  ship.cargoPct = LOAD_OPTIONS[setup.load].cargo;
  ship.damage = 0;

  approachAuth = false;
  approachWarned = false;
  messengerDelivered = false;
  winching = false;
  winchProgress = 0;
  hawserConnected = false;
  hawserDist = bowDist();
  hawserPrevDist = hawserDist;
  hawserTension = 0;
  hoseConnected = false;
  hoseProgress = -1;
  hoseRuptured = false;
  hoseTension = 0;
  hoseNominal = -1;
  hawserGraceT = -1;
  pumpStopAsk = false;
  fpsoMoorPhase = 0;
  pusherHintT = -999;
  pumping = false;
  pumpRequested = false;
  discAuthorized = false;
  vhfOpen = false;

  const stt = fpsoStern();
  msgBoat.state = 'idle';
  msgBoat.x = stt.x; msgBoat.y = stt.y;
  hoseBoat.x = stt.x; hoseBoat.y = stt.y;
  pusher.side = 0;
  pusher.x = ship.x; pusher.y = ship.y;
  tug.force = 0; tug.dir = 0;
  const sf = dirVec(ship.psi);
  tug.x = ship.x - sf.x * (VLCC_L / 2 + TUG_LINE_LEN);
  tug.y = ship.y - sf.y * (VLCC_L / 2 + TUG_LINE_LEN);

  phase = 'run';
  radio('PEREGRINO', 'VLCC, aqui FPSO Peregrino no canal 16. Boa manobra. Aguardamos seu chamado.');
  showMessage('Chame o Peregrino no VHF (tecla V) e peça autorização de aproximação.', 7);
}

// ---------------------------------------------------------------------------
// Entrada — teclado
// ---------------------------------------------------------------------------

function telegraphStep(d: number) {
  if (phase !== 'run') return;
  ship.telegraph = clamp(ship.telegraph + d, 0, TELEGRAPH.length - 1);
}

function rudderStep(d: number) {
  if (phase !== 'run') return;
  ship.rudder = clamp(ship.rudder + d * 10, -MAX_RUDDER, MAX_RUDDER);
}

function cycleTugForce() {
  if (phase !== 'run') return;
  tug.force = (tug.force + 1) % TUG_FORCES.length;
  const f = TUG_FORCES[tug.force];
  radio('REBOCADOR', f === 0 ? 'Cabo lascado, sem força. Standby.' : `Puxando com ${f / 10} toneladas, direção ${TUG_DIRS[tug.dir].label}.`);
}

function cycleTugDir() {
  if (phase !== 'run') return;
  tug.dir = (tug.dir + 1) % TUG_DIRS.length;
  radio('REBOCADOR', `Mudando para puxar pela alheta ${TUG_DIRS[tug.dir].label === 'RÉ' ? '— em linha, pela popa' : TUG_DIRS[tug.dir].label}.`);
}

function orderPusher(side: number) {
  if (phase !== 'run') return;
  if (pusher.side === side) side = 0;
  pusher.side = side;
  radio('LANCHA', side === 0 ? 'Lancha empurradora afastando. Standby.' :
    side < 0 ? 'Lancha posicionada por boreste, empurrando a proa para bombordo.' :
      'Lancha posicionada por bombordo, empurrando a proa para boreste.');
}

function messengerConditions(): string | null {
  const d = bowDist();
  if (!approachAuth) return 'Sem autorização de aproximação do FPSO.';
  if (d > 280) return `Proa muito longe da popa do FPSO (${d.toFixed(0)} m — aproxime para menos de 250 m).`;
  if (d < 60) return 'Proa perigosamente próxima — afaste um pouco.';
  if (sog() > 1.6 * KNOT) return `Velocidade alta demais (${(sog() / KNOT).toFixed(1)} nós — reduza para menos de 1,5).`;
  return null;
}

function callMessenger() {
  if (phase !== 'run' || messengerDelivered || msgBoat.state !== 'idle') return;
  const why = messengerConditions();
  if (why) { showMessage(`Lancha do mensageiro: ${why}`); return; }
  msgBoat.state = 'enroute';
  msgBoat.t = 0;
  radio('VLCC', 'Peregrino, solicito lancha com o mensageiro do hawser na proa.');
  radioLater(3, 'PEREGRINO', 'Recebido. Lancha rápida seguindo com o mensageiro para sua proa.');
}

function actionHawser() {
  if (phase !== 'run') return;
  if (!hawserConnected) {
    if (!messengerDelivered) { showMessage('Ainda não há mensageiro a bordo — chame a lancha (M).'); return; }
    if (!winching) {
      winching = true;
      winchProgress = 0;
      radio('VLCC', 'Mensageiro a bordo, virando o hawser pelo molinete de vante.');
    }
    return;
  }
  // desconectar
  if (hoseConnected) { showMessage('Desconecte os mangotes primeiro (N).'); return; }
  if (hawserTension > 490) { showMessage('Tensão alta demais para soltar — alivie com máquina adiante.'); return; }
  hawserConnected = false;
  winching = false;
  messengerDelivered = false;
  radio('VLCC', 'Peregrino, hawser desconectado e lascado. Abrindo distância.');
  radioLater(3, 'PEREGRINO', 'Confirmado, hawser livre. Boa viagem e bom mar.');
}

function actionHose() {
  if (phase !== 'run') return;
  if (!hoseConnected && hoseProgress < 0) {
    if (!hawserConnected) { showMessage('Amarre primeiro o hawser (mensageiro + tecla H).'); return; }
    hoseProgress = 0;
    hoseRuptured = false;
    radio('VLCC', 'Peregrino, prontos para receber os mangotes a meia-nau.');
    radioLater(3, 'PEREGRINO', 'Lancha de mangotes levando a extremidade para seu manifold.');
    return;
  }
  if (hoseConnected) {
    if (pumping || pumpRequested) { showMessage('Pare o bombeio primeiro (VHF).'); return; }
    hoseConnected = false;
    hoseProgress = -1;
    radio('VLCC', 'Mangotes desconectados, flange cego instalado. Lancha recolhendo a linha.');
    radioLater(3, 'PEREGRINO', 'Recebido. Mangotes livres do seu costado.');
  }
}

function requestPump() {
  if (phase !== 'run') return;
  if (!hoseConnected) { showMessage('Sem mangotes conectados.'); return; }
  if (pumping || pumpRequested) {
    radio('VLCC', 'Peregrino, solicito parada normal do bombeio.');
    radioLater(4, 'PEREGRINO', 'Parando bombas. Bombeio parado.', () => { pumping = false; pumpRequested = false; });
    return;
  }
  if (ship.cargoPct >= 100) { showMessage('VLCC com carga completa.'); return; }
  pumpRequested = true;
  radio('VLCC', 'Peregrino, tudo pronto a bordo. Solicito início do bombeio.');
  radioLater(5, 'PEREGRINO', 'Iniciando bombeio devagar, aumentando para regime pleno.', () => {
    if (hoseConnected) pumping = true; else pumpRequested = false;
  });
}

function emergencyStop(reportText: string) {
  radio('VLCC', reportText);
  radioLater(2, 'PEREGRINO', 'ESD ACIONADO! Bombas paradas, válvulas fechadas.', () => {
    pumping = false;
    pumpRequested = false;
    if (spillRate > 0) spillRate = 0;
    spillReportT = -1;
  });
}

window.addEventListener('keydown', (e) => {
  if (phase === 'setup') {
    switch (e.key) {
      case 'ArrowUp': case 'w': case 'W': setup.row = Math.max(0, setup.row - 1); break;
      case 'ArrowDown': case 's': case 'S': setup.row = Math.min(SETUP_ROWS.length - 1, setup.row + 1); break;
      case 'ArrowLeft': case 'a': case 'A': SETUP_ROWS[setup.row].change(-1); break;
      case 'ArrowRight': case 'd': case 'D': SETUP_ROWS[setup.row].change(1); break;
      case 'Enter': startRun(); break;
    }
    return;
  }
  if (phase === 'success' || phase === 'failed') {
    if (e.key === 'Enter' || e.key === 'r' || e.key === 'R') phase = 'setup';
    return;
  }
  // fase 'run'
  if (vhfOpen) {
    if (e.key === 'v' || e.key === 'V' || e.key === 'Escape') { vhfOpen = false; return; }
    const n = parseInt(e.key, 10);
    if (!isNaN(n)) {
      const opts = vhfOptions();
      if (n >= 1 && n <= opts.length) { opts[n - 1].fn(); vhfOpen = false; }
    }
    return;
  }
  switch (e.key) {
    case 'a': case 'A': case 'ArrowLeft': if (!e.repeat) rudderStep(-1); break;
    case 'd': case 'D': case 'ArrowRight': if (!e.repeat) rudderStep(1); break;
    case 'w': case 'W': case 'ArrowUp': if (!e.repeat) telegraphStep(1); break;
    case 's': case 'S': case 'ArrowDown': if (!e.repeat) telegraphStep(-1); break;
    case ' ': ship.rudder = 0; break;
    case 't': case 'T': if (!e.repeat) cycleTugForce(); break;
    case 'g': case 'G': if (!e.repeat) cycleTugDir(); break;
    case '1': orderPusher(-1); break;
    case '2': orderPusher(0); break;
    case '3': orderPusher(1); break;
    case 'm': case 'M': callMessenger(); break;
    case 'h': case 'H': actionHawser(); break;
    case 'n': case 'N': actionHose(); break;
    case 'o': case 'O': requestPump(); break;
    case 'v': case 'V': vhfOpen = true; break;
    case 'f': case 'F': timeScale = timeScale >= 8 ? 1 : timeScale * 2; break;
    case 'p': case 'P': paused = !paused; break;
    case 'k': case 'K': { const m = audio.toggle(); showMessage(m ? 'Áudio mudo.' : 'Áudio ligado.', 2); break; }
    case '+': case '=': zoomMul = clamp(zoomMul * 1.25, 0.5, 3); break;
    case '-': case '_': zoomMul = clamp(zoomMul / 1.25, 0.5, 3); break;
    case 'Escape': phase = 'setup'; break;
  }
});

// ---------------------------------------------------------------------------
// Entrada — toque
// ---------------------------------------------------------------------------

function bindTap(id: string, fn: () => void) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); fn(); });
}

bindTap('t-rud-port', () => rudderStep(-1));
bindTap('t-rud-mid', () => { if (phase === 'run') ship.rudder = 0; });
bindTap('t-rud-stbd', () => rudderStep(1));
bindTap('t-tel-up', () => telegraphStep(1));
bindTap('t-tel-down', () => telegraphStep(-1));
bindTap('t-vhf', () => { if (phase === 'run') vhfOpen = !vhfOpen; });
bindTap('t-action', () => { if (phase === 'run') contextAction().fn(); });
bindTap('t-tug', () => cycleTugForce());
bindTap('t-push-pt', () => orderPusher(-1));
bindTap('t-push-sb', () => orderPusher(1));

// regiões clicáveis desenhadas no canvas (menu VHF, tela inicial, overlays)
interface HitRegion { x: number; y: number; w: number; h: number; fn: () => void; }
let hitRegions: HitRegion[] = [];

// ação contextual para o botão "AÇÃO" em telas de toque
function contextAction(): { label: string; fn: () => void } {
  if (!hawserConnected) {
    if (!messengerDelivered && msgBoat.state === 'idle') return { label: 'MENSAGEIRO', fn: callMessenger };
    if (messengerDelivered && !winching) return { label: 'HAWSER', fn: actionHawser };
    return { label: '…', fn: () => {} };
  }
  if (!hoseConnected && hoseProgress < 0) return { label: 'MANGOTE', fn: actionHose };
  if (hoseConnected && !pumping && !pumpRequested && ship.cargoPct < 100) return { label: 'BOMBEIO', fn: requestPump };
  if (pumping && ship.cargoPct >= 100) return { label: 'PARAR', fn: requestPump };
  if (hoseConnected && !pumping && ship.cargoPct >= 100) return { label: 'DESC. MANG.', fn: actionHose };
  if (!hoseConnected && hawserConnected && ship.cargoPct >= 100) return { label: 'DESC. HAWSER', fn: actionHawser };
  return { label: '…', fn: () => {} };
}

// ---------------------------------------------------------------------------
// VHF — opções contextuais
// ---------------------------------------------------------------------------

function vhfOptions(): { label: string; fn: () => void }[] {
  const opts: { label: string; fn: () => void }[] = [];
  if (!approachAuth) {
    opts.push({
      label: 'Peregrino, VLCC a 1 milha. Solicito autorização para aproximação tandem.',
      fn: () => {
        radio('VLCC', 'Peregrino, VLCC pela popa. Solicito autorização para aproximação tandem.');
        radioLater(4, 'PEREGRINO', 'VLCC, autorizado a aproximar pela popa. Zona de 500 m: velocidade máx. 1,5 nó. Hawser de 150 m pronto no carretel.', () => { approachAuth = true; });
      },
    });
  }
  if (approachAuth && !messengerDelivered && msgBoat.state === 'idle' && !hawserConnected) {
    opts.push({ label: 'Solicitar lancha com o mensageiro do hawser na proa.', fn: callMessenger });
  }
  if (hawserConnected && !hoseConnected && hoseProgress < 0) {
    opts.push({ label: 'Solicitar conexão dos mangotes no manifold.', fn: actionHose });
  }
  if (hoseConnected && !pumping && !pumpRequested && ship.cargoPct < 100) {
    opts.push({ label: 'Solicitar início do bombeio.', fn: requestPump });
  }
  if (pumping || pumpRequested) {
    opts.push({ label: 'Solicitar parada normal do bombeio.', fn: requestPump });
    opts.push({
      label: 'PARADA DE EMERGÊNCIA (ESD)!',
      fn: () => emergencyStop('PEREGRINO, PEREGRINO — PARADA DE EMERGÊNCIA! Fechem tudo!'),
    });
  }
  if (spillRate > 0) {
    opts.push({
      label: 'Informar vazamento de óleo no mar — acionar ESD e plano de emergência!',
      fn: () => {
        emergencyStop('Peregrino, óleo na água junto ao costado! Acionem ESD e o plano de emergência!');
        radioLater(6, 'PEREGRINO', 'Plano de emergência acionado. Barreiras de contenção e dispersante a caminho.');
      },
    });
  }
  if (hoseRuptured && spillRate <= 0) {
    opts.push({
      label: 'Informar ruptura do mangote (sem bombeio).',
      fn: () => {
        radio('VLCC', 'Peregrino, mangote rompido junto ao manifold. Sem produto na linha.');
        radioLater(4, 'PEREGRINO', 'Recebido. Lancha vai recolher a linha. Solicite nova conexão quando pronto.');
      },
    });
  }
  if (hawserConnected && ship.cargoPct >= 100 && !discAuthorized) {
    opts.push({
      label: 'Carga completa. Solicitar autorização de desconexão e saída.',
      fn: () => {
        radio('VLCC', 'Peregrino, carga completa e ullages conferidos. Solicito desconexão.');
        radioLater(4, 'PEREGRINO', 'Autorizado. Desconecte mangotes, depois o hawser, e abra para mais de 600 m.', () => { discAuthorized = true; });
      },
    });
  }
  opts.push({
    label: 'Informar posição e situação (teste de comunicação).',
    fn: () => {
      radio('VLCC', `Peregrino, distância da popa ${bowDist().toFixed(0)} m, velocidade ${(sog() / KNOT).toFixed(1)} nó.`);
      radioLater(3, 'PEREGRINO', 'Recebido, comunicação 5/5. Mantemos escuta no canal 16.');
    },
  });
  return opts.slice(0, 7);
}

// ---------------------------------------------------------------------------
// Física
// ---------------------------------------------------------------------------

function fpsoTargetPsi(): number {
  // direções unitárias "para onde" o vento sopra e a corrente vai
  const w = { x: -Math.sin(env.windDir), y: Math.cos(env.windDir) };
  const c = { x: Math.sin(env.curDir), y: -Math.cos(env.curDir) };
  const wW = 0.7 * env.windKt * env.windKt;   // peso do vento
  const wC = 250 * env.curKt * env.curKt;     // peso da corrente
  const tx = w.x * wW + c.x * wC;
  const ty = w.y * wW + c.y * wC;
  if (Math.hypot(tx, ty) < 1e-6) return fpso.psi;
  // proa aponta contra a resultante: dirVec(psi) = -unit(t) → psi = atan2(-tx, ty)
  return Math.atan2(-tx, ty);
}

function updateEnvironment(dt: number) {
  // deriva lenta da direção do vento (mais ativa durante o offloading)
  const drift = pumping ? 2.2 : 1.0;
  env.windDirRate += (Math.random() - 0.5) * 0.0008 * drift * dt * 60;
  env.windDirRate = clamp(env.windDirRate, -0.0025 * drift, 0.0025 * drift);
  env.windDir += env.windDirRate * dt;

  // rajada / squall
  if (squall.active) {
    squall.t += dt;
    const k = Math.sin(Math.PI * clamp(squall.t / squall.dur, 0, 1));
    env.windKt = clamp(setup.windKt + squall.extraKt * k, 0, 50);
    env.windDir += squall.veer * dt / squall.dur;
    if (squall.t >= squall.dur) { squall.active = false; env.windKt = setup.windKt; }
  }

  // eventos aleatórios durante o bombeio
  if (pumping && elapsed > nextEventT) {
    nextEventT = elapsed + 70 + Math.random() * 80;
    const roll = Math.random();
    if (roll < 0.4) {
      squall = { active: true, t: 0, dur: 80 + Math.random() * 40, extraKt: 8 + Math.random() * 6, veer: (Math.random() < 0.5 ? -1 : 1) * (20 + Math.random() * 25) * DEG };
      radioLater(2, 'PEREGRINO', 'Atenção VLCC: rajada com mudança de vento se aproximando pelo radar. Monitorem o hawser.');
    } else if (roll < 0.7 && hawserConnected) {
      chafeT = 90;
      radioLater(2, 'PEREGRINO', 'VLCC, observamos abrasão no hawser junto ao fairlead. Mantenham tensão abaixo de 100 t!');
    } else if (hoseConnected && !hoseLeak) {
      hoseLeak = true;
      radioLater(2, 'LANCHA', 'Lancha de mangotes: há respingo de óleo numa flange! Recomendo parar o bombeio.');
    }
  }
  if (chafeT > 0) chafeT -= dt;

  // vazamento pequeno na flange do mangote
  if (hoseLeak && pumping) {
    spillRate = Math.max(spillRate, 3);
    if (spillReportT < 0) spillReportT = 0;
  } else if (hoseLeak && !pumping) {
    hoseLeak = false;
    spillRate = Math.min(spillRate, 0);
    radioLater(8, 'LANCHA', 'Flange reapertada pela lancha. Mangote OK para retomar o bombeio.');
  }
}

function updateFpso(dt: number) {
  // após amarrado, o FPSO gira lentamente (catavento + maré), exigindo
  // correção com o rebocador para manter o VLCC alinhado.
  let target = fpsoTargetPsi();
  if (hawserConnected) {
    fpsoMoorPhase += dt;
    target += 7 * DEG * Math.sin(fpsoMoorPhase * 0.012)
            + 4 * DEG * Math.sin(fpsoMoorPhase * 0.031 + 1.3);
  }
  const err = norm(target - fpso.psi);
  const maxRate = (hawserConnected ? 0.18 : 0.12) * DEG;
  fpso.psi += clamp(err * 0.02, -maxRate, maxRate) * dt;
}

function vesselForces(dt: number) {
  const p = loadParams();
  const f = dirVec(ship.psi);
  const s = stbVec(ship.psi);
  const cur = currentToward();
  const wnd = windToward();

  // velocidades relativas (corpo)
  const urw = ship.u - (cur.x * f.x + cur.y * f.y);
  const vrw = ship.v - (cur.x * s.x + cur.y * s.y);
  const ura = ship.u - (wnd.x * f.x + wnd.y * f.y);
  const vra = ship.v - (wnd.x * s.x + wnd.y * s.y);

  // máquina com atraso
  const ordered = TELEGRAPH[ship.telegraph].thrust;
  ship.thrust += (ordered - ship.thrust) * clamp(dt / 8, 0, 1);

  let X = ship.thrust - p.cdu * urw * Math.abs(urw) - p.cax * ura * Math.abs(ura);
  let Y = -p.cdv * vrw * Math.abs(vrw) - p.cay * vra * Math.abs(vra);
  let N = 0;

  // leme (efetivo com fluxo da água + sopro do hélice)
  const wash = 0.35 * Math.sign(ship.thrust) * Math.sqrt(Math.abs(ship.thrust)) / 10;
  const ue = urw + wash;
  N += 30000 * ue * Math.abs(ue) * (ship.rudder * DEG);
  Y += 180 * ue * Math.abs(ue) * (ship.rudder * DEG);

  // passo do hélice dando ré (proa cai para boreste)
  if (ship.thrust < 0) N += -ship.thrust * 30;

  // momento do vento aplicado a ré de meia-nau (proa tende a vir ao vento)
  N += (-p.cay * vra * Math.abs(vra)) * -30;

  // amortecimento de guinada
  N += -1.1e7 * ship.r - 6e8 * ship.r * Math.abs(ship.r);

  // deriva de onda (empurra a favor do vento) + agitação
  const hs2 = env.hs * env.hs;
  const wdirTo = Math.atan2(wnd.x, -wnd.y);
  const relW = norm(wdirTo - ship.psi);
  X += 10 * hs2 * Math.cos(relW) + hs2 * 6 * Math.sin(elapsed * 0.31);
  Y += 14 * hs2 * Math.sin(relW) + hs2 * 8 * Math.sin(elapsed * 0.23 + 1.7);
  N += hs2 * 2.5e5 * Math.sin(elapsed * 0.17 + 0.6);

  // rebocador (cabo de 500 m pela popa)
  const tf = TUG_FORCES[tug.force];
  if (tf > 0) {
    const ang = TUG_DIRS[tug.dir].ang * DEG;
    const fx = Math.sin(ship.psi + ang);
    const fy = -Math.cos(ship.psi + ang);
    const Fx = fx * tf, Fy = fy * tf;
    const bx = Fx * f.x + Fy * f.y;
    const by = Fx * s.x + Fy * s.y;
    X += bx; Y += by;
    N += -VLCC_L / 2 * by; // aplicado na popa
  }

  // lancha empurradora (na altura da amura, ~0.3L avante)
  if (pusher.side !== 0) {
    const F = PUSHER_FORCE * pusher.side; // +BE
    Y += F;
    N += 0.3 * VLCC_L * F;
  }

  // hawser
  hawserPrevDist = hawserDist;
  hawserDist = bowDist();
  hawserTension = 0;
  if (hawserConnected) {
    const rate = (hawserDist - hawserPrevDist) / Math.max(dt, 1e-4);
    if (hawserDist > HAWSER_LEN) {
      hawserTension = Math.max(0, HAWSER_K * (hawserDist - HAWSER_LEN) + 400 * rate);
      // fator dinâmico do estado de mar
      hawserTension *= 1 + 0.08 * env.hs * (1 + Math.sin(elapsed * 0.9));
    }
    if (hawserTension > 0) {
      const b = shipBow();
      const st = fpsoStern();
      const d = Math.hypot(st.x - b.x, st.y - b.y) || 1;
      const ux = (st.x - b.x) / d, uy = (st.y - b.y) / d;
      const Fx = ux * hawserTension, Fy = uy * hawserTension;
      const bx = Fx * f.x + Fy * f.y;
      const by = Fx * s.x + Fy * s.y;
      X += bx; Y += by;
      N += VLCC_L / 2 * by; // aplicado na proa
    }
    maxTension = Math.max(maxTension, hawserTension);
    const breakAt = chafeT > 0 ? HAWSER_BREAK_CHAFE : HAWSER_BREAK;
    if (hawserTension > breakAt) breakHawser();
  }

  // integração
  ship.u += (X / p.mass) * dt;
  ship.v += (Y / (p.mass * 1.8)) * dt;
  ship.r += (N / p.izz) * dt;
  ship.psi += ship.r * dt;
  ship.x += (ship.u * f.x + ship.v * s.x) * dt;
  ship.y += (ship.u * f.y + ship.v * s.y) * dt;
}

function breakHawser() {
  hawserConnected = false;
  winching = false;
  messengerDelivered = false;
  audio.crack();
  addIncident('Ruptura do hawser por excesso de tensão');

  // o sistema pede imediatamente para parar a bomba de carga
  if (pumping || pumpRequested) {
    pumpStopAsk = true;
    radio('PEREGRINO', 'VLCC, HAWSER ROMPIDO! PARE A BOMBA DE CARGA AGORA — peça parada/ESD no VHF!');
  } else {
    radioLater(2, 'PEREGRINO', 'VLCC, HAWSER ROMPIDO! Afaste com máquina e rebocador. Confirme situação!');
  }

  if (hoseConnected) {
    // 5 minutos para segurar o navio com máquina e evitar tracionar/partir o mangote
    hawserGraceT = HAWSER_GRACE;
    showMessage('HAWSER ROMPEU! Dê MÁQUINA ADIANTE para segurar o navio — 5 min antes de partir o mangote!', 9);
    radioLater(3, 'PEREGRINO', 'Mangote ainda conectado! Segure o navio para a frente, senão a linha traciona e rompe!');
  } else {
    showMessage('HAWSER ROMPEU! Comunique o FPSO no VHF e afaste com segurança.', 8);
  }
}

function ruptureHose() {
  hoseConnected = false;
  hoseProgress = -1;
  hoseRuptured = true;
  hawserGraceT = -1;
  hoseTension = 0;
  audio.crack();
  addIncident('Ruptura do mangote');
  // óleo vaza sempre: jorro forte com bomba ativa, vazamento residual da linha se já parada
  if (pumping || pumpRequested) {
    spillRate = 60;
    spilled += 300;
    showMessage('MANGOTE ROMPEU COM BOMBEIO! Óleo no mar — acione ESD pelo VHF!', 9);
  } else {
    spillRate = Math.max(spillRate, 18);
    spilled += 80;
    showMessage('MANGOTE ROMPEU! Óleo da linha vazando no mar — comunique o FPSO (VHF)!', 8);
  }
  if (spillReportT < 0) spillReportT = 0;
}

function updateMooringLogic(dt: number) {
  const d = bowDist();

  // autorização de aproximação
  if (!approachAuth && !approachWarned && d < 600) {
    approachWarned = true;
    addIncident('Entrou na zona de 500 m sem autorização do FPSO');
    radio('PEREGRINO', 'VLCC, você entrou na zona de segurança SEM autorização! Chame no canal 16 imediatamente!');
  }

  // perdendo posição junto ao FPSO → sugerir a lancha empurradora
  if (hawserConnected && bowDist() < 220 && Math.abs(ship.v) > 0.18 && pusher.side === 0
      && elapsed - pusherHintT > 40) {
    pusherHintT = elapsed;
    showMessage('Perdendo posição junto ao FPSO — chame a lancha para empurrar a proa (◁P / P▷).', 5);
  }

  // lancha do mensageiro
  if (msgBoat.state === 'enroute') {
    const b = shipBow();
    const dx = b.x - msgBoat.x, dy = b.y - msgBoat.y;
    const dist = Math.hypot(dx, dy);
    const spd = 9;
    if (dist < 25) { msgBoat.state = 'alongside'; msgBoat.t = 0; }
    else { msgBoat.x += (dx / dist) * spd * dt; msgBoat.y += (dy / dist) * spd * dt; }
    if (sog() > 2.5 * KNOT) {
      msgBoat.state = 'return';
      radio('LANCHA', 'VLCC com muito seguimento — abortando a entrega do mensageiro!');
    }
  } else if (msgBoat.state === 'alongside') {
    const b = shipBow();
    msgBoat.x = b.x; msgBoat.y = b.y;
    msgBoat.t += dt;
    if (msgBoat.t > 8) {
      messengerDelivered = true;
      msgBoat.state = 'return';
      radio('LANCHA', 'Mensageiro entregue na proa do VLCC! Lancha se afastando.');
      showMessage('Mensageiro a bordo — recolha o hawser com a tecla H.', 6);
    }
  } else if (msgBoat.state === 'return') {
    const st = fpsoStern();
    const dx = st.x - msgBoat.x, dy = st.y - msgBoat.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 40) msgBoat.state = 'idle';
    else { msgBoat.x += (dx / dist) * 9 * dt; msgBoat.y += (dy / dist) * 9 * dt; }
  }

  // recolhimento do hawser
  if (winching && !hawserConnected) {
    if (d > 280) {
      winching = false;
      messengerDelivered = false;
      addIncident('Mensageiro perdido — distância excessiva durante o recolhimento');
      showMessage('Mensageiro partiu! Será preciso nova entrega pela lancha.', 6);
    } else if (d > 250 || sog() > 1.6 * KNOT) {
      // pausa o recolhimento
    } else {
      winchProgress += dt;
      if (winchProgress >= WINCH_T) {
        winching = false;
        hawserConnected = true;
        hawserDist = d;
        hawserPrevDist = d;
        radio('VLCC', 'Peregrino, hawser conectado no chain stopper. Amarrado em tandem.');
        radioLater(3, 'PEREGRINO', 'Excelente. Mantenha-se na sombra do FPSO. Pode solicitar os mangotes.');
      }
    }
  }

  // conexão dos mangotes
  if (hoseProgress >= 0 && !hoseConnected) {
    const m = shipManifold();
    const dx = m.x - hoseBoat.x, dy = m.y - hoseBoat.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 20) { hoseBoat.x += (dx / dist) * 7 * dt; hoseBoat.y += (dy / dist) * 7 * dt; }
    hoseProgress += dt;
    if (hoseProgress >= HOSE_T) {
      hoseConnected = true;
      hoseRuptured = false;
      hoseProgress = -1;
      { const mm = shipManifold(); const ss = fpsoStern(); hoseNominal = Math.hypot(mm.x - ss.x, mm.y - ss.y); }
      radio('LANCHA', 'Mangote conectado e testado no manifold. Linha pronta.');
      radioLater(3, 'PEREGRINO', 'Mangotes prontos. Solicite o bombeio quando estiverem prontos a bordo.');
    }
  } else if (!hoseConnected && hoseProgress < 0) {
    // lancha de mangotes segura a linha perto da popa do FPSO
    const st = fpsoStern();
    const w = windToward();
    const tx = st.x + w.x * 6, ty = st.y + w.y * 6;
    hoseBoat.x += (tx - hoseBoat.x) * clamp(dt * 0.3, 0, 1);
    hoseBoat.y += (ty - hoseBoat.y) * clamp(dt * 0.3, 0, 1);
  } else if (hoseConnected) {
    const m = shipManifold();
    hoseBoat.x += (m.x + 60 - hoseBoat.x) * clamp(dt * 0.3, 0, 1);
    hoseBoat.y += (m.y + 40 - hoseBoat.y) * clamp(dt * 0.3, 0, 1);
    const st = fpsoStern();
    const hd = Math.hypot(m.x - st.x, m.y - st.y);
    // tração do mangote conforme o navio se afasta da conexão (cai à ré)
    const base = (hoseNominal > 0 ? hoseNominal : hd) + HOSE_TAUT_MARGIN;
    hoseTension = Math.max(0, (hd - base) * HOSE_K_T);
    if (hawserGraceT > 0) {
      // janela de 5 min após romper o hawser
      hawserGraceT -= dt;
      if (hoseTension >= HOSE_PART_T) {
        ruptureHose();                       // não segurou: navio caiu à ré, mangote parte e vaza
      } else if (hawserGraceT <= 0) {
        hawserGraceT = -1;                   // segurou o navio: mangote preservado
        showMessage('Navio seguro — mangote preservado. Suspenda o bombeio e desconecte com calma.', 7);
        radio('PEREGRINO', 'VLCC segurou a posição. Mangote preservado. Reavaliar a amarração.');
      }
    } else if (hoseTension >= HOSE_PART_T || hd > HOSE_MAX) {
      ruptureHose();                          // tração excessiva também rompe fora da janela
    }
  } else {
    hoseTension = 0;
  }

  // posição do rebocador (500 m de cabo pela popa, na direção de puxar)
  const sf = dirVec(ship.psi);
  const stp = shipStern();
  const ang = TUG_DIRS[tug.dir].ang * DEG;
  const tx = stp.x + Math.sin(ship.psi + ang) * TUG_LINE_LEN;
  const ty = stp.y - Math.cos(ship.psi + ang) * TUG_LINE_LEN;
  tug.x += (tx - tug.x) * clamp(dt * 0.15, 0, 1);
  tug.y += (ty - tug.y) * clamp(dt * 0.15, 0, 1);

  // lancha empurradora
  const target = pusher.side !== 0
    ? {
      x: ship.x + sf.x * 0.3 * VLCC_L + stbVec(ship.psi).x * -pusher.side * (VLCC_B / 2 + 14),
      y: ship.y + sf.y * 0.3 * VLCC_L + stbVec(ship.psi).y * -pusher.side * (VLCC_B / 2 + 14),
    }
    : { x: ship.x + stbVec(ship.psi).x * 220, y: ship.y + stbVec(ship.psi).y * 220 };
  pusher.x += (target.x - pusher.x) * clamp(dt * 0.5, 0, 1);
  pusher.y += (target.y - pusher.y) * clamp(dt * 0.5, 0, 1);

  // bombeio
  if (pumping) {
    ship.cargoPct = Math.min(100, ship.cargoPct + PUMP_PCT_S * dt);
    if (ship.cargoPct >= 100) {
      pumping = false;
      pumpRequested = false;
      radio('PEREGRINO', 'VLCC, atingida a nominação. Bombeio parado. Solicite desconexão quando pronto.');
    }
  }

  // derramamento
  if (spillRate > 0) {
    spilled += spillRate * dt;
    if (spillReportT >= 0) {
      spillReportT += dt;
      if (spillReportT > 45) {
        addIncident('FPSO acionou ESD por conta própria — demora na comunicação VHF');
        emergencyStop('(FPSO observou o óleo e acionou ESD automaticamente)');
        spillReportT = -1;
      }
    }
    const src = hoseConnected || hoseRuptured ? shipManifold() : shipBow();
    if (oil.length < 350 && Math.random() < 0.5) {
      oil.push({ x: src.x + (Math.random() - 0.5) * 30, y: src.y + (Math.random() - 0.5) * 30, r: 6, age: 0 });
    }
  }
  const w = windToward();
  const c = currentToward();
  for (const b of oil) {
    b.age += dt;
    b.r = Math.min(80, b.r + dt * 0.8);
    b.x += (c.x + w.x * 0.03) * dt;
    b.y += (c.y + w.y * 0.03) * dt;
  }

  if (spilled > 8000 && phase === 'run') {
    fail('Derramamento de grande porte — desastre ambiental. A manobra foi abortada pelas autoridades.');
  }

  // colisão VLCC × FPSO
  checkCollision(dt);

  // sucesso: carga completa, tudo desconectado, afastado
  if (ship.cargoPct >= 100 && !hawserConnected && !hoseConnected && d > 600) {
    phase = 'success';
  }
}

function segPoints(cx: number, cy: number, psi: number, len: number, n: number) {
  const f = dirVec(psi);
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) {
    const t = -0.5 + i / (n - 1);
    pts.push({ x: cx + f.x * len * t, y: cy + f.y * len * t });
  }
  return pts;
}

let collideCooldown = 0;
function checkCollision(dt: number) {
  collideCooldown = Math.max(0, collideCooldown - dt);
  const a = segPoints(ship.x, ship.y, ship.psi, VLCC_L * 0.92, 7);
  const fc = { x: (fpsoBow().x + fpsoStern().x) / 2, y: (fpsoBow().y + fpsoStern().y) / 2 };
  const b = segPoints(fc.x, fc.y, fpso.psi, FPSO_L * 0.92, 6);
  const minDist = (VLCC_B + FPSO_B) / 2;
  let best = Infinity, pa = a[0], pb = b[0];
  for (const p of a) for (const q of b) {
    const d = Math.hypot(p.x - q.x, p.y - q.y);
    if (d < best) { best = d; pa = p; pb = q; }
  }
  if (best < minDist) {
    const speed = sog();
    if (speed > 0.8) {
      spilled += 3000;
      oil.push({ x: pa.x, y: pa.y, r: 40, age: 0 });
      fail('COLISÃO GRAVE com o FPSO Peregrino! Casco rompido, óleo no mar.');
      return;
    }
    // toque leve: empurra para fora e amortece
    const nx = (pa.x - pb.x) / (best || 1);
    const ny = (pa.y - pb.y) / (best || 1);
    ship.x += nx * (minDist - best);
    ship.y += ny * (minDist - best);
    ship.u *= 0.4; ship.v *= 0.4; ship.r *= 0.5;
    if (collideCooldown <= 0) {
      collideCooldown = 8;
      ship.damage += 18 + speed * 25;
      addIncident('Batida no casco do FPSO durante a manobra');
      showMessage('BATIDA NO FPSO! Verifique avarias e comunique no VHF.', 6);
      radioLater(2, 'PEREGRINO', 'VLCC, sentimos o contato no casco! Informe avarias. Afaste com cuidado.');
      if (speed > 0.5) { spilled += 200; oil.push({ x: pa.x, y: pa.y, r: 15, age: 0 }); }
      if (ship.damage >= 100) fail('Casco do VLCC comprometido após batidas sucessivas.');
    }
  }
}

function fail(reason: string) {
  if (phase !== 'run') return;
  failReason = reason;
  phase = 'failed';
}

function update(dt: number) {
  if (phase !== 'run' || paused) return;
  elapsed += dt;
  if (messageTimer > 0) messageTimer -= dt;

  for (const m of pendingRadio.filter((m) => m.at <= elapsed)) {
    radio(m.from, m.text);
    if (m.fn) m.fn();
  }
  pendingRadio = pendingRadio.filter((m) => m.at > elapsed);

  updateEnvironment(dt);
  updateFpso(dt);
  vesselForces(dt);
  updateMooringLogic(dt);
  audio.update(dt);
  if (!pumping && !pumpRequested) pumpStopAsk = false;
}

// ---------------------------------------------------------------------------
// Renderização
// ---------------------------------------------------------------------------

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let zoomMul = 1;
let camX = TURRET.x, camY = TURRET.y, camSpan = 2000;

function resize() {
  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;
}
window.addEventListener('resize', resize);
resize();

canvas.addEventListener('pointerdown', (e) => {
  const x = e.clientX * devicePixelRatio;
  const y = e.clientY * devicePixelRatio;
  for (const r of hitRegions) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) { r.fn(); return; }
  }
  if (phase === 'success' || phase === 'failed') phase = 'setup';
});

function w2s(x: number, y: number, scale: number, vw: number, vh: number) {
  return { x: (x - camX) * scale + vw / 2, y: (y - camY) * scale + vh / 2 };
}

function hash(ix: number, iy: number): number {
  let h = ix * 374761393 + iy * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}

function drawWater(scale: number, vw: number, vh: number, time: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, vh);
  grad.addColorStop(0, '#0e3e5c');
  grad.addColorStop(1, '#06222f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, vw, vh);

  const cell = 110;
  const x0 = Math.floor((camX - vw / 2 / scale) / cell) - 1;
  const x1 = Math.floor((camX + vw / 2 / scale) / cell) + 1;
  const y0 = Math.floor((camY - vh / 2 / scale) / cell) - 1;
  const y1 = Math.floor((camY + vh / 2 / scale) / cell) + 1;
  const hsK = env.hs / 2;
  ctx.strokeStyle = `rgba(255,255,255,${0.05 + 0.06 * hsK})`;
  ctx.lineWidth = 1.5;
  for (let gx = x0; gx <= x1; gx++) {
    for (let gy = y0; gy <= y1; gy++) {
      const r = hash(gx, gy);
      if (r < 0.5 - hsK * 0.2) continue;
      const phaseW = (time * (0.5 + hsK * 0.5) + r * 10) % 4;
      if (phaseW > 2) continue;
      const wx = (gx + hash(gx + 7, gy)) * cell;
      const wy = (gy + hash(gx, gy + 7)) * cell;
      const p = w2s(wx, wy, scale, vw, vh);
      const len = (12 + r * 22 * (0.5 + hsK)) * scale * (1 - Math.abs(phaseW - 1));
      ctx.beginPath();
      ctx.arc(p.x, p.y, Math.max(0.5, len), Math.PI * 0.15, Math.PI * 0.55);
      ctx.stroke();
    }
  }
}

function drawOil(scale: number, vw: number, vh: number) {
  for (const b of oil) {
    const p = w2s(b.x, b.y, scale, vw, vh);
    const r = b.r * scale;
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, Math.max(1, r));
    g.addColorStop(0, 'rgba(15, 10, 5, 0.75)');
    g.addColorStop(0.7, 'rgba(30, 20, 10, 0.45)');
    g.addColorStop(1, 'rgba(60, 45, 20, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(1, r), 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRope(p1: { x: number; y: number }, p2: { x: number; y: number }, slack: number, color: string, width: number, scale: number, vw: number, vh: number) {
  const a = w2s(p1.x, p1.y, scale, vw, vh);
  const b = w2s(p2.x, p2.y, scale, vw, vh);
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const off = clamp(slack, 0, 60) * scale;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, width * scale);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.quadraticCurveTo(mx - (dy / len) * off, my + (dx / len) * off, b.x, b.y);
  ctx.stroke();
}

function drawFpso(scale: number, vw: number, vh: number, time: number) {
  // zona de exclusão de 500 m
  const t = w2s(TURRET.x, TURRET.y, scale, vw, vh);
  ctx.strokeStyle = 'rgba(255, 200, 60, 0.25)';
  ctx.setLineDash([14, 10]);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(t.x, t.y, 500 * scale, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // linhas de fundeio do turret
  ctx.strokeStyle = 'rgba(180, 200, 210, 0.20)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(t.x, t.y);
    ctx.lineTo(t.x + Math.cos(a) * 700 * scale, t.y + Math.sin(a) * 700 * scale);
    ctx.stroke();
  }

  const fc = { x: (fpsoBow().x + fpsoStern().x) / 2, y: (fpsoBow().y + fpsoStern().y) / 2 };
  const c = w2s(fc.x, fc.y, scale, vw, vh);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(fpso.psi);
  const L = FPSO_L * scale, W = FPSO_B * scale;

  // casco
  ctx.fillStyle = '#7a1f1f';
  ctx.beginPath();
  ctx.moveTo(0, -L / 2);
  ctx.quadraticCurveTo(W / 2, -L / 2 + L * 0.12, W / 2, -L / 4);
  ctx.lineTo(W / 2, L / 2 - W * 0.2);
  ctx.quadraticCurveTo(W / 2, L / 2, W / 4, L / 2);
  ctx.lineTo(-W / 4, L / 2);
  ctx.quadraticCurveTo(-W / 2, L / 2, -W / 2, L / 2 - W * 0.2);
  ctx.lineTo(-W / 2, -L / 4);
  ctx.quadraticCurveTo(-W / 2, -L / 2 + L * 0.12, 0, -L / 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#4a1212';
  ctx.lineWidth = Math.max(1, 1.5 * scale);
  ctx.stroke();

  // convés
  ctx.fillStyle = '#9c3b2e';
  ctx.fillRect(-W / 2 + 4 * scale, -L / 2 + 14 * scale, W - 8 * scale, L - 24 * scale);

  // heliponto na proa
  ctx.fillStyle = '#2e6b48';
  ctx.beginPath();
  ctx.arc(0, -L / 2 + 26 * scale, 13 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = Math.max(1, scale);
  ctx.stroke();
  if (scale > 0.05) {
    ctx.fillStyle = '#fff';
    ctx.font = `700 ${Math.max(6, 14 * scale)}px 'Space Grotesk', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('H', 0, -L / 2 + 26 * scale);
  }

  // acomodações
  ctx.fillStyle = '#e9e4d8';
  ctx.fillRect(-W / 3, -L / 2 + 44 * scale, (W * 2) / 3, 24 * scale);

  // módulos de processo
  ctx.fillStyle = '#5d6a72';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(-W / 3, -L / 8 + i * 26 * scale, (W * 2) / 3, 18 * scale);
  }

  // flare com chama
  ctx.strokeStyle = '#888';
  ctx.lineWidth = Math.max(1, 2 * scale);
  ctx.beginPath();
  ctx.moveTo(W / 3, L / 4);
  ctx.lineTo(W / 2 + 20 * scale, L / 4 + 10 * scale);
  ctx.stroke();
  const fl = 1 + 0.3 * Math.sin(time * 7);
  ctx.fillStyle = 'rgba(255, 160, 40, 0.85)';
  ctx.beginPath();
  ctx.arc(W / 2 + 22 * scale, L / 4 + 11 * scale, 5 * scale * fl, 0, Math.PI * 2);
  ctx.fill();

  // estação de offloading na popa
  ctx.fillStyle = '#333c42';
  ctx.fillRect(-10 * scale, L / 2 - 16 * scale, 20 * scale, 12 * scale);

  // nome
  if (scale > 0.07) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `700 ${Math.max(7, 13 * scale)}px 'Space Grotesk', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.save();
    ctx.rotate(Math.PI / 2);
    ctx.fillText('FPSO PEREGRINO', 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

function drawVlcc(scale: number, vw: number, vh: number) {
  const c = w2s(ship.x, ship.y, scale, vw, vh);
  ctx.save();
  ctx.translate(c.x, c.y);
  ctx.rotate(ship.psi);
  const L = VLCC_L * scale, W = VLCC_B * scale;

  // casco
  ctx.fillStyle = '#1d2c38';
  ctx.beginPath();
  ctx.moveTo(0, -L / 2);
  ctx.quadraticCurveTo(W / 2, -L / 2 + L * 0.16, W / 2, -L / 5);
  ctx.lineTo(W / 2, L / 2 - W * 0.25);
  ctx.quadraticCurveTo(W / 2, L / 2, W / 5, L / 2);
  ctx.lineTo(-W / 5, L / 2);
  ctx.quadraticCurveTo(-W / 2, L / 2, -W / 2, L / 2 - W * 0.25);
  ctx.lineTo(-W / 2, -L / 5);
  ctx.quadraticCurveTo(-W / 2, -L / 2 + L * 0.16, 0, -L / 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#0d161d';
  ctx.lineWidth = Math.max(1, 1.5 * scale);
  ctx.stroke();

  // convés (tanque)
  ctx.fillStyle = '#6e3b2a';
  ctx.beginPath();
  ctx.moveTo(0, -L / 2 + 10 * scale);
  ctx.quadraticCurveTo(W / 2 - 6 * scale, -L / 2 + L * 0.16, W / 2 - 6 * scale, -L / 5);
  ctx.lineTo(W / 2 - 6 * scale, L / 2 - 30 * scale);
  ctx.lineTo(-W / 2 + 6 * scale, L / 2 - 30 * scale);
  ctx.lineTo(-W / 2 + 6 * scale, -L / 5);
  ctx.quadraticCurveTo(-W / 2 + 6 * scale, -L / 2 + L * 0.16, 0, -L / 2 + 10 * scale);
  ctx.closePath();
  ctx.fill();

  // passadiço central + linhas de tanques
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = Math.max(1, scale);
  for (let i = 1; i < 6; i++) {
    const y = -L / 2 + (L * 0.8 * i) / 6 + L * 0.06;
    ctx.beginPath();
    ctx.moveTo(-W / 2 + 8 * scale, y);
    ctx.lineTo(W / 2 - 8 * scale, y);
    ctx.stroke();
  }
  ctx.strokeStyle = '#caa46a';
  ctx.lineWidth = Math.max(1, 2.5 * scale);
  ctx.beginPath();
  ctx.moveTo(0, -L / 2 + 16 * scale);
  ctx.lineTo(0, L / 2 - 34 * scale);
  ctx.stroke();

  // manifold a meia-nau
  ctx.fillStyle = '#caa46a';
  ctx.fillRect(-W / 2 + 4 * scale, -6 * scale, 10 * scale, 12 * scale);
  ctx.fillRect(W / 2 - 14 * scale, -6 * scale, 10 * scale, 12 * scale);

  // superestrutura à ré
  ctx.fillStyle = '#ece7da';
  ctx.fillRect(-W / 3, L / 2 - 28 * scale, (W * 2) / 3, 18 * scale);
  ctx.fillStyle = '#b8b2a0';
  ctx.fillRect(-W / 4, L / 2 - 24 * scale, W / 2, 6 * scale);
  // chaminé
  ctx.fillStyle = '#C45D38';
  ctx.fillRect(-4 * scale, L / 2 - 12 * scale, 8 * scale, 6 * scale);

  // castelo de proa (estação do hawser)
  ctx.fillStyle = '#39495a';
  ctx.beginPath();
  ctx.moveTo(0, -L / 2 + 4 * scale);
  ctx.lineTo(10 * scale, -L / 2 + 18 * scale);
  ctx.lineTo(-10 * scale, -L / 2 + 18 * scale);
  ctx.closePath();
  ctx.fill();

  // indicação de avaria
  if (ship.damage > 0) {
    ctx.fillStyle = `rgba(255, 80, 40, ${clamp(ship.damage / 150, 0, 0.6)})`;
    ctx.fillRect(-W / 2, -L / 2, W, L);
  }
  ctx.restore();
}

function drawBoat(x: number, y: number, psi: number, len: number, color: string, scale: number, vw: number, vh: number) {
  const p = w2s(x, y, scale, vw, vh);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(psi);
  const L = Math.max(6, len * scale), W = Math.max(3, len * 0.32 * scale);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -L / 2);
  ctx.quadraticCurveTo(W / 2, -L / 6, W / 2, L / 2);
  ctx.lineTo(-W / 2, L / 2);
  ctx.quadraticCurveTo(-W / 2, -L / 6, 0, -L / 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(-W / 4, -L / 8, W / 2, L / 4);
  ctx.restore();
}

function angleTo(x1: number, y1: number, x2: number, y2: number) {
  return Math.atan2(x2 - x1, -(y2 - y1));
}

function drawSupport(scale: number, vw: number, vh: number) {
  // rebocador + cabo de trabalho
  const stp = shipStern();
  if (TUG_FORCES[tug.force] > 0) {
    drawRope(stp, tug, 4, 'rgba(220, 220, 230, 0.8)', 1.6, scale, vw, vh);
  } else {
    drawRope(stp, tug, 30, 'rgba(220, 220, 230, 0.35)', 1.2, scale, vw, vh);
  }
  drawBoat(tug.x, tug.y, angleTo(tug.x, tug.y, stp.x, stp.y) + Math.PI, 32, '#3f7d4e', scale, vw, vh);

  // lancha do mensageiro
  if (msgBoat.state !== 'idle') {
    const b = shipBow();
    drawBoat(msgBoat.x, msgBoat.y, angleTo(msgBoat.x, msgBoat.y, b.x, b.y), 16, '#d8842b', scale, vw, vh);
    if (msgBoat.state === 'alongside' || msgBoat.state === 'enroute') {
      const st = fpsoStern();
      drawRope({ x: msgBoat.x, y: msgBoat.y }, st, 25, 'rgba(255, 220, 120, 0.5)', 1, scale, vw, vh);
    }
  }

  // lancha de mangotes
  drawBoat(hoseBoat.x, hoseBoat.y, angleTo(hoseBoat.x, hoseBoat.y, ship.x, ship.y), 18, '#c9b23a', scale, vw, vh);

  // lancha empurradora
  const pAng = pusher.side !== 0 ? ship.psi + (pusher.side > 0 ? -Math.PI / 2 : Math.PI / 2) : ship.psi;
  drawBoat(pusher.x, pusher.y, pAng, 20, '#4a86c9', scale, vw, vh);
  if (pusher.side !== 0) {
    const p = w2s(pusher.x, pusher.y, scale, vw, vh);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 10 * scale, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLines(scale: number, vw: number, vh: number) {
  const st = fpsoStern();
  const bow = shipBow();

  // hawser
  if (hawserConnected || winching) {
    const taut = hawserTension > 50;
    const color = hawserTension > HAWSER_ALARM ? '#ff5a36' : taut ? '#ffd34d' : 'rgba(255, 211, 77, 0.55)';
    const slack = hawserConnected ? clamp((HAWSER_LEN - hawserDist) * 0.4 + 6, 2, 50) : 30;
    drawRope(st, bow, hawserTension > 200 ? 1 : slack, color, 2.2, scale, vw, vh);
  }

  // mangote (linha flutuante com flutuadores)
  if (hoseConnected || hoseProgress >= 0) {
    const end = hoseConnected ? shipManifold() : hoseBoat;
    const a = w2s(st.x, st.y, scale, vw, vh);
    const b = w2s(end.x, end.y, scale, vw, vh);
    ctx.strokeStyle = '#15100c';
    ctx.lineWidth = Math.max(2, 3.5 * scale);
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    const dx = b.x - a.x, dy = b.y - a.y;
    const ln = Math.hypot(dx, dy) || 1;
    const off = 30 * scale;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(mx - (dy / ln) * off, my + (dx / ln) * off, b.x, b.y);
    ctx.stroke();
    // flutuadores laranja
    ctx.fillStyle = '#ff8c2b';
    for (let i = 1; i < 8; i++) {
      const t = i / 8;
      const qx = (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * (mx - (dy / ln) * off) + t * t * b.x;
      const qy = (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * (my + (dx / ln) * off) + t * t * b.y;
      ctx.beginPath();
      ctx.arc(qx, qy, Math.max(1.5, 2.5 * scale), 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ---------------------------------------------------------------------------
// HUD
// ---------------------------------------------------------------------------

function roundRect(x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fmtTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function missionText(): string {
  if (!approachAuth) return 'Chame o Peregrino no VHF (V) e peça autorização de aproximação';
  if (!hawserConnected) {
    if (msgBoat.state === 'enroute') return 'Lancha levando o mensageiro à sua proa — mantenha posição e velocidade baixa';
    if (msgBoat.state === 'alongside') return 'Lancha entregando o mensageiro na proa — segure a posição!';
    if (winching) return `Recolhendo o hawser… ${Math.round((winchProgress / WINCH_T) * 100)}% — mantenha a proa a 80–250 m`;
    if (messengerDelivered) return 'Mensageiro a bordo — recolha o hawser (H)';
    return 'Posicione a proa a 80–250 m da popa do FPSO (vel < 1,5 nó) e chame a lancha do mensageiro (M)';
  }
  if (!hoseConnected) {
    if (hoseProgress >= 0) return `Lancha conectando os mangotes… ${Math.round((hoseProgress / HOSE_T) * 100)}%`;
    if (ship.cargoPct >= 100) return 'Carga completa — peça desconexão pelo VHF e solte o hawser (H)';
    return 'Amarrado em tandem! Solicite a conexão dos mangotes (N)';
  }
  if (!pumping && !pumpRequested && ship.cargoPct < 100) return 'Mangotes conectados — solicite o início do bombeio (O ou VHF)';
  if (pumping) return `Bombeio em andamento — mantenha a tensão do hawser abaixo de 130 t (carga ${ship.cargoPct.toFixed(0)}%)`;
  if (ship.cargoPct >= 100 && hoseConnected) return 'Carga completa — solicite desconexão (VHF) e desconecte os mangotes (N)';
  return 'Solte o hawser (H) com a tensão aliviada e afaste-se mais de 600 m do FPSO';
}

function drawArrowIn(cx: number, cy: number, r: number, angTo: number, color: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(angTo);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, r * 0.55);
  ctx.lineTo(-r * 0.28, -r * 0.45);
  ctx.lineTo(0, -r * 0.2);
  ctx.lineTo(r * 0.28, -r * 0.45);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawHUD(vw: number, vh: number) {
  const ui = Math.min(vw, vh) / 760;
  const pad = 14 * ui;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  // ---- painel de navegação (esquerda)
  const pw = 252 * ui, ph = 332 * ui;
  ctx.fillStyle = 'rgba(6, 20, 30, 0.78)';
  roundRect(pad, pad, pw, ph, 10 * ui);
  ctx.fill();

  const kts = sog() / KNOT;
  const lines: [string, string, string?][] = [
    ['VELOCIDADE', `${kts.toFixed(2)} nós`, kts > 1.5 && bowDist() < 500 ? '#ff5a36' : undefined],
    ['RUMO', `${compass(ship.psi).toFixed(0).padStart(3, '0')}°`],
    ['MÁQUINA', TELEGRAPH[ship.telegraph].label],
    ['LEME', ship.rudder === 0 ? 'A MEIO' : `${Math.abs(ship.rudder)}° ${ship.rudder < 0 ? 'BB' : 'BE'}`],
    ['DIST. POPA FPSO', `${bowDist().toFixed(0)} m`],
    ['CARGA', `${ship.cargoPct.toFixed(1)} %  (${Math.round((ship.cargoPct / 100) * TOTAL_BBL / 1000)} mil bbl)`],
    ['REBOCADOR', `${TUG_FORCES[tug.force] / 10} t · ${TUG_DIRS[tug.dir].label}`],
    ['EMPURRADORA', pusher.side === 0 ? 'STANDBY' : pusher.side < 0 ? 'EMPURRANDO P/ BB' : 'EMPURRANDO P/ BE'],
  ];
  let ty = pad + 12 * ui;
  for (const [label, value, color] of lines) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `${10.5 * ui}px 'DM Mono', monospace`;
    ctx.fillText(label, pad + 13 * ui, ty);
    ctx.fillStyle = color ?? '#fff';
    ctx.font = `600 ${14.5 * ui}px 'Space Grotesk', sans-serif`;
    ctx.fillText(value, pad + 13 * ui, ty + 12 * ui);
    ty += 32 * ui;
  }

  // tensão do hawser
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `${10.5 * ui}px 'DM Mono', monospace`;
  ctx.fillText('TENSÃO DO HAWSER', pad + 13 * ui, ty);
  const bw = pw - 26 * ui;
  const frac = clamp(hawserTension / HAWSER_BREAK, 0, 1);
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.fillRect(pad + 13 * ui, ty + 14 * ui, bw, 9 * ui);
  ctx.fillStyle = hawserTension > HAWSER_ALARM ? '#ff5a36' : hawserTension > 800 ? '#ffcf3d' : '#6fd86f';
  ctx.fillRect(pad + 13 * ui, ty + 14 * ui, bw * frac, 9 * ui);
  // marca de alarme
  ctx.fillStyle = '#fff';
  ctx.fillRect(pad + 13 * ui + bw * (HAWSER_ALARM / HAWSER_BREAK) - 1, ty + 12 * ui, 2, 13 * ui);
  ctx.fillStyle = '#fff';
  ctx.font = `600 ${13 * ui}px 'Space Grotesk', sans-serif`;
  ctx.fillText(hawserConnected ? `${(hawserTension / 9.81).toFixed(0)} t` : '— desconectado —', pad + 13 * ui, ty + 27 * ui);

  // tração do mangote (aparece com mangote conectado ou na janela de emergência)
  if (hoseConnected || hawserGraceT > 0) {
    ty += 40 * ui;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `${10.5 * ui}px 'DM Mono', monospace`;
    ctx.fillText('TRAÇÃO DO MANGOTE', pad + 13 * ui, ty);
    const hfrac = clamp(hoseTension / HOSE_PART_T, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(pad + 13 * ui, ty + 14 * ui, bw, 9 * ui);
    ctx.fillStyle = hoseTension > HOSE_PART_T * 0.66 ? '#ff5a36' : hoseTension > HOSE_PART_T * 0.33 ? '#ffcf3d' : '#6fd86f';
    ctx.fillRect(pad + 13 * ui, ty + 14 * ui, bw * hfrac, 9 * ui);
    ctx.fillStyle = '#fff';
    ctx.font = `600 ${13 * ui}px 'Space Grotesk', sans-serif`;
    ctx.fillText(`${hoseTension.toFixed(0)} t / ${HOSE_PART_T} t (ruptura)`, pad + 13 * ui, ty + 27 * ui);
  }

  // ---- painel de ambiente (direita)
  const ew = 198 * ui, eh = 158 * ui;
  const ex = vw - ew - pad;
  ctx.fillStyle = 'rgba(6, 20, 30, 0.78)';
  roundRect(ex, pad, ew, eh, 10 * ui);
  ctx.fill();
  // rosa com setas
  const rcx = ex + 48 * ui, rcy = pad + 52 * ui, rr = 34 * ui;
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(rcx, rcy, rr, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = `${9 * ui}px 'DM Mono', monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('N', rcx, rcy - rr - 11 * ui);
  // vento entra apontando para onde sopra
  drawArrowIn(rcx, rcy, rr * 0.9, env.windDir + Math.PI, '#7fd4ff');
  if (env.curKt > 0.01) drawArrowIn(rcx, rcy, rr * 0.62, env.curDir, '#6fd86f');
  ctx.textAlign = 'left';
  const envLines: [string, string][] = [
    ['VENTO', `${env.windKt.toFixed(0)} nós · ${compass(env.windDir).toFixed(0).padStart(3, '0')}°`],
    ['MAR (Hs)', `${env.hs.toFixed(1)} m`],
    ['CORRENTE', `${env.curKt.toFixed(2)} nó → ${compass(env.curDir).toFixed(0).padStart(3, '0')}°`],
  ];
  let ey2 = pad + 12 * ui;
  for (const [label, value] of envLines) {
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = `${9.5 * ui}px 'DM Mono', monospace`;
    ctx.fillText(label, ex + 96 * ui, ey2);
    ctx.fillStyle = label === 'VENTO' && squall.active ? '#ffcf3d' : '#fff';
    ctx.font = `600 ${12 * ui}px 'Space Grotesk', sans-serif`;
    ctx.fillText(value, ex + 96 * ui, ey2 + 11 * ui);
    ey2 += 32 * ui;
  }
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = `${9.5 * ui}px 'DM Mono', monospace`;
  ctx.fillText(`TEMPO ${fmtTime(elapsed)}${timeScale > 1 ? `  ×${timeScale}` : ''}${paused ? '  ‖ PAUSA' : ''}`, ex + 14 * ui, pad + eh - 22 * ui);
  ctx.fillText(`DERRAMADO ${spilled.toFixed(0)} bbl`, ex + 14 * ui, pad + eh - 38 * ui);

  // ---- rádio (abaixo do ambiente)
  const rw = Math.min(330 * ui, vw * 0.42), rh = 132 * ui;
  const rx = vw - rw - pad, ry = pad + eh + 8 * ui;
  ctx.fillStyle = 'rgba(6, 20, 30, 0.7)';
  roundRect(rx, ry, rw, rh, 10 * ui);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = `${9.5 * ui}px 'DM Mono', monospace`;
  ctx.fillText('VHF CANAL 16 — (V para falar)', rx + 12 * ui, ry + 8 * ui);
  ctx.font = `${10.5 * ui}px 'DM Mono', monospace`;
  let ly = ry + 24 * ui;
  for (const m of radioLog.slice(-5)) {
    ctx.fillStyle = m.from === 'VLCC' ? '#9fd4ff' : m.from === 'PEREGRINO' ? '#ffd34d' : '#9fe8a8';
    const text = `${m.from}: ${m.text}`;
    // quebra simples em duas linhas
    const maxC = Math.floor((rw - 24 * ui) / (6.2 * ui));
    if (text.length > maxC) {
      ctx.fillText(text.slice(0, maxC), rx + 12 * ui, ly);
      ly += 12 * ui;
      ctx.fillText('  ' + text.slice(maxC, maxC * 2 - 2), rx + 12 * ui, ly);
    } else {
      ctx.fillText(text, rx + 12 * ui, ly);
    }
    ly += 14 * ui;
    if (ly > ry + rh - 14 * ui) break;
  }

  // ---- missão (topo, centro)
  const mt = missionText();
  ctx.font = `600 ${14 * ui}px 'Space Grotesk', sans-serif`;
  const mw = Math.min(ctx.measureText(mt).width + 36 * ui, vw * 0.6);
  ctx.fillStyle = 'rgba(6, 20, 30, 0.78)';
  roundRect(vw / 2 - mw / 2, pad, mw, 32 * ui, 16 * ui);
  ctx.fill();
  ctx.fillStyle = '#ffcf3d';
  ctx.textAlign = 'center';
  ctx.fillText(mt, vw / 2, pad + 9 * ui, mw - 24 * ui);
  ctx.textAlign = 'left';

  // ---- alarmes
  const alarms: string[] = [];
  if (hawserConnected && hawserTension > HAWSER_ALARM) alarms.push('TENSÃO ALTA NO HAWSER');
  if (pumpStopAsk && (pumping || pumpRequested)) alarms.push('PARE A BOMBA DE CARGA — HAWSER ROMPIDO');
  if (hawserGraceT > 0) alarms.push(`SEGURE O NAVIO COM MÁQUINA — ${Math.ceil(hawserGraceT)}s P/ PARTIR O MANGOTE`);
  if (chafeT > 0) alarms.push(`ABRASÃO NO HAWSER — TENSÃO < 100 t (${chafeT.toFixed(0)}s)`);
  if (spillRate > 0) alarms.push('ÓLEO NO MAR — COMUNIQUE O FPSO (VHF)');
  if (squall.active) alarms.push('RAJADA DE VENTO');
  if (bowDist() < 70) alarms.push('MUITO PRÓXIMO DO FPSO');
  if (!approachAuth && bowDist() < 600) alarms.push('ZONA DE 500 m SEM AUTORIZAÇÃO');
  if (hoseConnected) {
    const m = shipManifold(); const st = fpsoStern();
    const hd = Math.hypot(m.x - st.x, m.y - st.y);
    if (hd > HOSE_MAX - 60) alarms.push('MANGOTE PRÓXIMO DO LIMITE');
  }
  if (alarms.length) {
    const blink = Math.sin(performance.now() / 180) > -0.3;
    if (blink) {
      ctx.textAlign = 'center';
      ctx.font = `700 ${15 * ui}px 'Space Grotesk', sans-serif`;
      let ay = pad + 44 * ui;
      for (const a of alarms.slice(0, 3)) {
        const aw = ctx.measureText(a).width + 30 * ui;
        ctx.fillStyle = 'rgba(160, 30, 10, 0.85)';
        roundRect(vw / 2 - aw / 2, ay, aw, 26 * ui, 13 * ui);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(a, vw / 2, ay + 6 * ui);
        ay += 32 * ui;
      }
      ctx.textAlign = 'left';
    }
  }

  // ---- menu VHF
  hitRegions = [];
  if (vhfOpen) {
    const opts = vhfOptions();
    const vwid = Math.min(620 * ui, vw * 0.9);
    const vhei = (opts.length + 2) * 34 * ui + 20 * ui;
    const vx = vw / 2 - vwid / 2, vy = vh * 0.28;
    ctx.fillStyle = 'rgba(4, 14, 22, 0.93)';
    roundRect(vx, vy, vwid, vhei, 12 * ui);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 211, 77, 0.6)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = '#ffd34d';
    ctx.font = `700 ${15 * ui}px 'Space Grotesk', sans-serif`;
    ctx.fillText('VHF CANAL 16 — FPSO PEREGRINO  (escolha 1–' + opts.length + ', V/ESC fecha)', vx + 16 * ui, vy + 12 * ui);
    ctx.font = `${12.5 * ui}px 'Space Grotesk', sans-serif`;
    opts.forEach((o, i) => {
      const oy = vy + 40 * ui + i * 34 * ui;
      ctx.fillStyle = 'rgba(255,255,255,0.07)';
      roundRect(vx + 12 * ui, oy, vwid - 24 * ui, 28 * ui, 8 * ui);
      ctx.fill();
      ctx.fillStyle = o.label.includes('EMERGÊNCIA') || o.label.includes('vazamento') ? '#ff7a5a' : '#fff';
      ctx.fillText(`${i + 1}.  ${o.label}`, vx + 24 * ui, oy + 7 * ui, vwid - 48 * ui);
      hitRegions.push({ x: vx + 12 * ui, y: oy, w: vwid - 24 * ui, h: 28 * ui, fn: () => { o.fn(); vhfOpen = false; } });
    });
  }

  // ---- mensagem temporária
  if (messageTimer > 0 && message) {
    ctx.font = `600 ${15 * ui}px 'Space Grotesk', sans-serif`;
    const w = Math.min(ctx.measureText(message).width + 40 * ui, vw * 0.9);
    ctx.fillStyle = 'rgba(6, 20, 30, 0.88)';
    roundRect(vw / 2 - w / 2, vh * 0.74, w, 36 * ui, 18 * ui);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(message, vw / 2, vh * 0.74 + 9 * ui, w - 28 * ui);
    ctx.textAlign = 'left';
  }

  // ---- dica de teclas (rodapé)
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.font = `${10.5 * ui}px 'DM Mono', monospace`;
  ctx.textAlign = 'center';
  ctx.fillText('A/D leme ±10° · W/S máquina · ESPAÇO leme a meio · T/G rebocador · 1/2/3 empurradora · M mensageiro · H hawser · N mangote · O bombeio · V VHF · F tempo ×' + timeScale + ' · P pausa', vw / 2, vh - 20 * ui);
  ctx.textAlign = 'left';
}

// ---------------------------------------------------------------------------
// Telas (setup / fim)
// ---------------------------------------------------------------------------

function drawSetup(vw: number, vh: number) {
  hitRegions = [];
  const ui = Math.min(vw, vh) / 760;
  ctx.fillStyle = 'rgba(4, 16, 24, 0.92)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  ctx.fillStyle = '#ffd34d';
  ctx.font = `700 ${30 * ui}px 'Space Grotesk', sans-serif`;
  ctx.fillText('OFFLOADING TANDEM', vw / 2, vh * 0.07);
  ctx.fillStyle = '#fff';
  ctx.font = `600 ${18 * ui}px 'Space Grotesk', sans-serif`;
  ctx.fillText('VLCC × FPSO PEREGRINO — Simulador de Manobra', vw / 2, vh * 0.07 + 40 * ui);

  const rowW = Math.min(560 * ui, vw * 0.9);
  const rx = vw / 2 - rowW / 2;
  let ry = vh * 0.2;
  SETUP_ROWS.forEach((row, i) => {
    const sel = i === setup.row;
    ctx.fillStyle = sel ? 'rgba(255, 211, 77, 0.16)' : 'rgba(255,255,255,0.06)';
    roundRect(rx, ry, rowW, 40 * ui, 9 * ui);
    ctx.fill();
    if (sel) {
      ctx.strokeStyle = '#ffd34d';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `${11 * ui}px 'DM Mono', monospace`;
    ctx.fillText(row.name, rx + 18 * ui, ry + 13 * ui);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = `600 ${15 * ui}px 'Space Grotesk', sans-serif`;
    ctx.fillText(`◀  ${row.value()}  ▶`, rx + rowW - 16 * ui, ry + 10 * ui);
    ctx.textAlign = 'center';
    const yy = ry;
    hitRegions.push({ x: rx, y: yy, w: rowW / 2, h: 40 * ui, fn: () => { setup.row = i; row.change(-1); } });
    hitRegions.push({ x: rx + rowW / 2, y: yy, w: rowW / 2, h: 40 * ui, fn: () => { setup.row = i; row.change(1); } });
    ry += 48 * ui;
  });

  // botão iniciar
  ry += 10 * ui;
  ctx.fillStyle = '#ffd34d';
  roundRect(vw / 2 - 130 * ui, ry, 260 * ui, 44 * ui, 22 * ui);
  ctx.fill();
  ctx.fillStyle = '#0a2333';
  ctx.font = `700 ${17 * ui}px 'Space Grotesk', sans-serif`;
  ctx.fillText('INICIAR MANOBRA  (ENTER)', vw / 2, ry + 12 * ui);
  hitRegions.push({ x: vw / 2 - 130 * ui, y: ry, w: 260 * ui, h: 44 * ui, fn: startRun });

  ry += 62 * ui;
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.font = `${11.5 * ui}px 'DM Mono', monospace`;
  const help = [
    'Hawser do FPSO: 150 m · Cabo do rebocador: 500 m · 3 lanchas de apoio',
    'Sequência: VHF p/ autorização → aproximar a popa → lancha do mensageiro →',
    'recolher hawser → conectar mangotes → bombeio → desconexão → afastamento',
    '',
    'A/D leme em passos de 10° · W/S máquina (mto devagar/devagar/meia/toda, AV e RÉ)',
    'T força do rebocador · G direção do reboque · 1/2/3 lancha empurradora',
    'M mensageiro · H hawser · N mangotes · O bombeio · V VHF · F acelerar tempo',
  ];
  help.forEach((l, i) => ctx.fillText(l, vw / 2, ry + i * 17 * ui));
  ctx.textAlign = 'left';
}

function scoreNote(): number {
  let n = 10;
  n -= incidents.length * 1.2;
  n -= spilled / 1500;
  n -= ship.damage / 25;
  return clamp(Math.round(n * 10) / 10, 0, 10);
}

function drawEnd(vw: number, vh: number) {
  hitRegions = [];
  const ui = Math.min(vw, vh) / 760;
  ctx.fillStyle = 'rgba(4, 14, 22, 0.85)';
  ctx.fillRect(0, 0, vw, vh);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  if (phase === 'success') {
    ctx.fillStyle = '#6fd86f';
    ctx.font = `700 ${34 * ui}px 'Space Grotesk', sans-serif`;
    ctx.fillText('MANOBRA CONCLUÍDA!', vw / 2, vh * 0.16);
    ctx.fillStyle = '#fff';
    ctx.font = `${16 * ui}px 'Space Grotesk', sans-serif`;
    ctx.fillText('Carga completa, linhas desconectadas e afastamento seguro do Peregrino.', vw / 2, vh * 0.16 + 48 * ui);
  } else {
    ctx.fillStyle = '#ff5a36';
    ctx.font = `700 ${34 * ui}px 'Space Grotesk', sans-serif`;
    ctx.fillText('MANOBRA ABORTADA', vw / 2, vh * 0.16);
    ctx.fillStyle = '#fff';
    ctx.font = `${16 * ui}px 'Space Grotesk', sans-serif`;
    ctx.fillText(failReason, vw / 2, vh * 0.16 + 48 * ui, vw * 0.85);
  }

  const stats = [
    `Tempo de manobra: ${fmtTime(elapsed)}`,
    `Carga transferida: ${ship.cargoPct.toFixed(0)}% (${Math.round((ship.cargoPct / 100) * TOTAL_BBL / 1000)} mil bbl)`,
    `Tensão máxima no hawser: ${(maxTension / 9.81).toFixed(0)} t`,
    `Óleo derramado: ${spilled.toFixed(0)} bbl`,
    `Avarias no casco: ${ship.damage.toFixed(0)}%`,
    `NOTA DA MANOBRA: ${scoreNote().toFixed(1)} / 10`,
  ];
  ctx.font = `${15 * ui}px 'DM Mono', monospace`;
  stats.forEach((s, i) => {
    ctx.fillStyle = i === stats.length - 1 ? '#ffd34d' : 'rgba(255,255,255,0.85)';
    ctx.fillText(s, vw / 2, vh * 0.34 + i * 26 * ui);
  });

  if (incidents.length) {
    ctx.fillStyle = 'rgba(255, 120, 90, 0.95)';
    ctx.font = `${13 * ui}px 'DM Mono', monospace`;
    ctx.fillText('— OCORRÊNCIAS —', vw / 2, vh * 0.34 + stats.length * 26 * ui + 16 * ui);
    incidents.slice(0, 5).forEach((inc, i) => {
      ctx.fillText(inc, vw / 2, vh * 0.34 + stats.length * 26 * ui + 36 * ui + i * 20 * ui, vw * 0.85);
    });
  }

  ctx.fillStyle = '#ffd34d';
  ctx.font = `600 ${17 * ui}px 'Space Grotesk', sans-serif`;
  ctx.fillText('ENTER / toque — nova manobra', vw / 2, vh * 0.86);
  ctx.textAlign = 'left';
}

// ---------------------------------------------------------------------------
// Loop principal
// ---------------------------------------------------------------------------

function render(time: number) {
  const vw = canvas.width, vh = canvas.height;

  if (phase === 'setup') {
    // fundo animado de mar
    camX = TURRET.x; camY = TURRET.y;
    const sc = Math.min(vw, vh) / 2400;
    drawWater(sc, vw, vh, time);
    drawSetup(vw, vh);
    return;
  }

  // câmera: enquadra navio e popa do FPSO
  const st = fpsoStern();
  const d = bowDist();
  const follow = d < 1400;
  const txc = follow ? (ship.x + st.x) / 2 : ship.x;
  const tyc = follow ? (ship.y + st.y) / 2 : ship.y;
  const span = clamp((follow ? d + VLCC_L + FPSO_L : 1500) * 1.25, 750, 3200) / zoomMul;
  camX += (txc - camX) * 0.04;
  camY += (tyc - camY) * 0.04;
  camSpan += (span - camSpan) * 0.03;
  const scale = Math.min(vw, vh) / camSpan;

  drawWater(scale, vw, vh, time);
  drawOil(scale, vw, vh);
  drawFpso(scale, vw, vh, time);
  drawLines(scale, vw, vh);
  drawSupport(scale, vw, vh);
  drawVlcc(scale, vw, vh);

  if (phase === 'run') {
    drawHUD(vw, vh);
  } else {
    drawEnd(vw, vh);
  }
}

let last = performance.now();
function frame(now: number) {
  const dtRaw = Math.min(0.05, (now - last) / 1000);
  last = now;
  const simDt = dtRaw * timeScale;
  const steps = Math.max(1, Math.ceil(simDt / 0.05));
  for (let i = 0; i < steps; i++) update(simDt / steps);
  render(now / 1000);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// sinaliza ao vlcc.html que o jogo carregou (suprime o aviso de falha)
(window as any).__vlccOk = true;
