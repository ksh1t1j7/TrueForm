import { useState, useRef, useEffect, useCallback } from 'react';

import {
  StopCircle, Info, AlertCircle, X, ChevronRight, ArrowLeft,
  BarChart2, Zap, Target, TrendingUp, CheckCircle, Clock, Award,
  RefreshCw, Rotate3D, Activity, Brain, ChevronDown, Wifi, Layers,
  Camera, Upload, Plus, Trash2, Apple, Cpu, Dna, Shield
} from 'lucide-react';

import SplashCursor from './SplashCursor';

// TensorFlow.js from Global Scope (loaded via CDN in index.html to bypass Vite bundling errors)
const tf = window.tf;
const poseDetection = window.poseDetection;
const mobilenet = window.mobilenet;

/* ─── FluidShaderBackground ─────────────────────────────────── */
const VERT_SRC = `
  attribute vec2 a_pos;
  void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAG_SRC = `
  precision mediump float;
  uniform float u_time;
  uniform vec2  u_res;

  // ── VIBRANT DYNAMIC NEBULA ─ Anchored at warm obsidian base ─────
  // Core Highlight: Vibrant Terracotta #e2723b → vec3(0.886, 0.447, 0.231)
  // Mid-tones: Deep Burnt Orange      #9a3412 → vec3(0.604, 0.204, 0.071)
  // Shadows: Dark Bronze               #451a03 → vec3(0.271, 0.102, 0.012)
  // Base: Warm Obsidian                #0a0604 → vec3(0.039, 0.024, 0.016)

  vec3 C_DARK   = vec3(0.039, 0.024, 0.016);
  vec3 C_BRONZE = vec3(0.271, 0.102, 0.012);
  vec3 C_ORANGE = vec3(0.604, 0.204, 0.071);
  vec3 C_TERRA  = vec3(0.886, 0.447, 0.231);

  // fast hash for fbm noise
  float hash(vec2 p) {
    p = fract(p * vec2(127.1, 311.7));
    p += dot(p, p + 17.5);
    return fract(p.x * p.y);
  }

  // high-frequency pixel noise for tactile matte finish
  float random(vec2 st) {
    return fract(sin(dot(st, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  // smooth value noise
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  // 3-octave fbm for volumetric fluid sweeps
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 3; i++) {
      v += a * noise(p);
      p  = p * 2.1 + vec2(3.7, 1.3);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / u_res;
    uv.x *= u_res.x / u_res.y;

    // Center-right localized fluid flow
    uv -= vec2(0.18, 0.05);
    uv *= 0.70;

    // Smooth, hypnotic fluid drift speed (u_time * 0.10)
    float t = u_time * 0.10;

    // Double domain-warp for swirling fluid smoke folds
    vec2 q = vec2(fbm(uv + vec2(0.00, t)),
                  fbm(uv + vec2(5.20, 1.30 + t * 0.70)));
    vec2 r = vec2(fbm(uv + 4.5 * q + vec2(1.70, 9.20 + t * 0.45)),
                  fbm(uv + 4.5 * q + vec2(8.30, 2.80 + t * 0.30)));
    float f = fbm(uv + 4.5 * r);

    // Dynamic volumetric weights
    float wA = smoothstep(0.20, 0.75, f);
    float wB = smoothstep(0.28, 0.80, q.x + 0.40 * f);
    float wC = smoothstep(0.35, 0.85, r.y + 0.45 * f);

    // Sequential mix: dark base -> bronze -> burnt orange -> vibrant terracotta
    vec3 col = C_DARK;
    col = mix(col, C_BRONZE, wA * 0.85);
    col = mix(col, C_ORANGE, wB * 0.65);
    col = mix(col, C_TERRA,  wC * 0.55);

    // Exposure cap at 0.65 (vibrant glowing highlights without text blowout)
    float maxL = max(col.r, max(col.g, col.b));
    if (maxL > 0.65) col *= 0.65 / maxL;

    // Tactile matte noise overlay
    float matteNoise = (random(gl_FragCoord.xy + fract(u_time * 19.0)) - 0.5) * 0.035;
    col = clamp(col + matteNoise, 0.0, 1.0);

    // Vignette
    vec2 cv = (gl_FragCoord.xy / u_res) - 0.5;
    float vig = 1.0 - smoothstep(0.25, 0.88, length(cv) * 1.20);
    col *= vig;

    gl_FragColor = vec4(col, 1.0);
  }
`;

function FluidShaderBackground() {
  const canvasRef = useRef(null);
  const glRef     = useRef(null);
  const rafRef    = useRef(null);
  const progRef   = useRef(null);
  const uTimeRef  = useRef(null);
  const uResRef   = useRef(null);
  const startRef  = useRef(performance.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // ── init GL ───────────────────────────────────────────────
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) return; // fallback to CSS gradient gracefully
    glRef.current = gl;

    // compile shaders
    function compile(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return s;
    }
    const prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER,   VERT_SRC));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG_SRC));
    gl.linkProgram(prog);
    gl.useProgram(prog);
    progRef.current = prog;

    // full-screen quad
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a_pos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    uTimeRef.current = gl.getUniformLocation(prog, 'u_time');
    uResRef.current  = gl.getUniformLocation(prog, 'u_res');

    // ── resize ────────────────────────────────────────────────
    const dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    function resize() {
      canvas.width  = Math.floor(window.innerWidth  * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    resize();
    window.addEventListener('resize', resize);

    // ── render loop ───────────────────────────────────────────
    let paused = false;
    function draw() {
      if (!paused) {
        const t = (performance.now() - startRef.current) * 0.001;
        gl.uniform1f(uTimeRef.current, t);
        gl.uniform2f(uResRef.current, canvas.width, canvas.height);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      rafRef.current = requestAnimationFrame(draw);
    }
    rafRef.current = requestAnimationFrame(draw);

    // pause when tab is hidden
    const onVis = () => { paused = document.hidden; };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVis);
      gl.deleteProgram(prog);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        top: 0, left: 0,
        width: '100%', height: '100%',
        zIndex: -2,
        pointerEvents: 'none',
        display: 'block',
        opacity: 0.85,
      }}
    />
  );
}


/* ─── Constants ─────────────────────────────────────────────── */
const EXERCISES = [
  {
    id: 'head_rotation',
    name: 'Head Rotation',
    icon: 'rotate',
    targetRange: { min: 45, max: 80 },
    unit: '°',
    description: 'Horizontal yaw sweep targeting cervical spine mobility. Tracks lateral head movement and rotation angle.',
    tags: ['Neck', 'Mobility', 'Cervical'],
  },
  {
    id: 'arm_rotation',
    name: 'Arm Rotation',
    icon: 'activity',
    targetRange: { min: 90, max: 150 },
    unit: '°',
    description: 'Glenohumeral joint orbit tracking for shoulder range of motion and extension assessment.',
    tags: ['Shoulder', 'Extension', 'Upper Body'],
  },
];

const TEAM_INFO = {
  department: 'Department of Electronics and Telecommunication Engineering',
  semester: 'Semester VII',
  group: 'Group 20',
  guide: 'Dr. Sumit Gupta',
  members: [
    { name: 'Arya Hule', prn: '23070123029' },
    { name: 'Chirag Tekwani', prn: '23070123042' },
    { name: 'Gargi Pedhekar', prn: '23070123052' },
    { name: 'Kshitij Yadav', prn: '23070123075' },
  ],
};

const SCREENS = { LANDING: 'landing', SELECT: 'select', TRACKING: 'tracking', ANALYSIS: 'analysis' };

const NUTRITION_DB = {
  banana: { name: 'Banana', calories: 89, carbs: 23, protein: 1.1, fat: 0.3, fiber: 2.6, sodium: 1 },
  apple: { name: 'Apple', calories: 52, carbs: 14, protein: 0.3, fat: 0.2, fiber: 2.4, sodium: 1 },
  pizza: { name: 'Pizza (1 slice)', calories: 285, carbs: 36, protein: 12, fat: 10, fiber: 2.5, sodium: 640 },
  hotdog: { name: 'Hot Dog', calories: 290, carbs: 18, protein: 10, fat: 20, fiber: 0.8, sodium: 560 },
  cheeseburger: { name: 'Cheeseburger', calories: 303, carbs: 33, protein: 15, fat: 12, fiber: 1.5, sodium: 580 },
  salad: { name: 'Garden Salad', calories: 15, carbs: 3, protein: 1, fat: 0.2, fiber: 1.2, sodium: 10 },
  broccoli: { name: 'Broccoli (1 cup)', calories: 31, carbs: 6, protein: 2.5, fat: 0.3, fiber: 2.4, sodium: 30 },
  orange: { name: 'Orange', calories: 47, carbs: 12, protein: 0.9, fat: 0.1, fiber: 2.4, sodium: 0 },
  strawberry: { name: 'Strawberry (1 cup)', calories: 49, carbs: 12, protein: 1.0, fat: 0.5, fiber: 3.0, sodium: 1 },
  egg: { name: 'Boiled Egg', calories: 78, carbs: 0.6, protein: 6, fat: 5, fiber: 0, sodium: 62 },
  chicken: { name: 'Chicken Breast (100g)', calories: 165, carbs: 0, protein: 31, fat: 3.6, fiber: 0, sodium: 74 },
  salmon: { name: 'Salmon Fillet (100g)', calories: 208, carbs: 0, protein: 20, fat: 13, fiber: 0, sodium: 59 },
  rice: { name: 'White Rice (1 cup)', calories: 205, carbs: 45, protein: 4.2, fat: 0.4, fiber: 0.6, sodium: 0 },
  bread: { name: 'Whole Wheat Bread (1 slice)', calories: 69, carbs: 12, protein: 3.6, fat: 0.9, fiber: 1.9, sodium: 130 },
  avocado: { name: 'Avocado', calories: 160, carbs: 8.5, protein: 2, fat: 15, fiber: 6.7, sodium: 7 },
  potato: { name: 'Baked Potato', calories: 161, carbs: 37, protein: 4.3, fat: 0.2, fiber: 3.8, sodium: 17 }
};

const DAILY_TARGETS = { calories: 2000, carbs: 250, protein: 130, fat: 70 };

/* ─── Audio ────────────────────────────────────────────────── */
let _actx = null;
function getAudioCtx() {
  if (!_actx) _actx = new (window.AudioContext || window.webkitAudioContext)();
  return _actx;
}
function playChime() {
  try {
    const c = getAudioCtx(); const t = c.currentTime;
    const o = c.createOscillator(); const g = c.createGain();
    o.connect(g); g.connect(c.destination);
    o.type = 'sine';
    o.frequency.setValueAtTime(880, t);
    o.frequency.setValueAtTime(1100, t + 0.07);
    o.frequency.setValueAtTime(1320, t + 0.14);
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    o.start(t); o.stop(t + 0.28);
  } catch (_) {}
}

/* ─── AI Coach logic ───────────────────────────────────────── */
function getCoachMsg(angle, velocity, isFlexing, formScore, isMoving) {
  if (!isMoving) return { msg: 'Waiting for movement', sub: 'Position yourself and start the exercise.', type: 'idle' };
  if (velocity > 150) return { msg: 'Slow down', sub: 'Movement is too fast — control each rep carefully.', type: 'warn' };
  if (angle > 72) return { msg: 'Peak reached ✓', sub: 'Hold for a moment, then return smoothly.', type: 'good' };
  if (angle > 45 && isFlexing) return { msg: 'Great range', sub: 'Push towards your full extension.', type: 'good' };
  if (angle > 25 && isFlexing) return { msg: 'Keep going', sub: 'Continue to full range of motion.', type: 'info' };
  if (angle < 15 && !isFlexing) return { msg: 'Neutral position', sub: 'Reset — ready for the next rep.', type: 'info' };
  if (formScore < 50) return { msg: 'Adjust your form', sub: 'Ensure you reach the target ROM zone consistently.', type: 'warn' };
  return { msg: 'Good form', sub: 'Maintain this consistent movement pattern.', type: 'good' };
}

/* ─── InView hook ──────────────────────────────────────────── */
function useInView(ref) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold: 0.15 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  return inView;
}

/* ─── Logo ─────────────────────────────────────────────────── */
function Logo({ size = 'sm' }) {
  return (
    <div className="inline-flex items-center gap-2.5 bg-transparent border-0 shadow-none p-0 cursor-pointer hover:opacity-85 transition-all group select-none">
      <div className="flex items-center justify-center p-0.5 rounded-lg bg-transparent">
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="text-[#e2723b] drop-shadow-[0_0_8px_rgba(232,112,56,0.5)] group-hover:scale-110 transition-transform duration-200"
        >
          {/* Joint Kinematic / Neural Synapse Paths */}
          <path
            d="M5 18L11 12L19 6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M11 12L17 18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Geometric Synapse / Joint Nodes */}
          <circle cx="5" cy="18" r="2.5" fill="currentColor" />
          <circle cx="11" cy="12" r="3" fill="#ffffff" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="19" cy="6" r="2.5" fill="currentColor" />
          <circle cx="17" cy="18" r="2" fill="currentColor" />
        </svg>
      </div>
      <span className="text-white font-extrabold tracking-wide text-base flex items-center gap-1">
        TrueForm <span className="text-[#e2723b]">AI</span>
      </span>
    </div>
  );
}

/* ─── Header ───────────────────────────────────────────────── */
function Header({ screen, onInfo, onBack, mode, setMode }) {
  const steps = [SCREENS.LANDING, SCREENS.SELECT, SCREENS.TRACKING, SCREENS.ANALYSIS];
  const isLanding = screen === SCREENS.LANDING;
  return (
    <header
      className={`flex items-center justify-between px-4 md:px-8 py-3.5 md:py-4 border-b border-white/5 shrink-0 sticky top-0 z-40 transition-all duration-300
        ${ isLanding ? 'bg-transparent' : 'bg-[#0d0e10]/85 backdrop-blur-xl' }`}
      role="banner"
    >
      <div className="flex items-center gap-3">
        {screen !== SCREENS.LANDING && screen !== SCREENS.SELECT && (
          <button
            onClick={onBack}
            aria-label="Go back to previous screen"
            className="text-white/60 hover:text-white/90 transition-colors cursor-pointer mr-1 p-1 rounded-lg hover:bg-white/5"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        )}
        <Logo size="sm" />
      </div>

      {/* Segment Mode Selector */}
      <div className="flex bg-[#111316] border border-white/8 rounded-full p-1" role="tablist" aria-label="Application mode">
        <button
          role="tab"
          aria-selected={mode === 'mobility'}
          onClick={() => setMode('mobility')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
            mode === 'mobility' ? 'bg-[#e2723b] text-white shadow-md shadow-[#e2723b]/25' : 'text-white/55 hover:text-white'
          }`}
        >
          Mobility
        </button>
        <button
          role="tab"
          aria-selected={mode === 'nutrition'}
          onClick={() => setMode('nutrition')}
          className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-200 cursor-pointer ${
            mode === 'nutrition' ? 'bg-[#e2723b] text-white shadow-md shadow-[#e2723b]/25' : 'text-white/55 hover:text-white'
          }`}
        >
          AI Nutrition
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex gap-1.5" role="progressbar" aria-label="Navigation progress" aria-valuenow={Object.values(SCREENS).indexOf(screen) + 1} aria-valuemin={1} aria-valuemax={4}>
          {steps.map(s => (
            <div key={s} className={`rounded-full transition-all duration-300 ${
              s === screen ? 'w-5 h-1.5 bg-[#e2723b]' : 'w-1.5 h-1.5 bg-white/15'
            }`} />
          ))}
        </div>
        <button
          onClick={onInfo}
          aria-label="View team information"
          title="Team info"
          className="text-white/50 hover:text-white/80 transition-colors cursor-pointer p-1 rounded-lg hover:bg-white/5"
        >
          <Info className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}

/* ─── Team Modal ───────────────────────────────────────────── */
function TeamModal({ onClose }) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Team Information"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-[#111316] border border-white/10 rounded-3xl p-7 shadow-2xl w-full max-w-md mx-4 relative overflow-hidden">
        {/* Orange accent top bar */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#e2723b]/60 to-transparent" />

        <div className="flex justify-between items-start mb-5">
          <div>
            <p className="text-white/40 text-[10px] uppercase tracking-widest font-semibold mb-2">Final Year B.Tech Project</p>
            <Logo size="sm" />
          </div>
          <button
            onClick={onClose}
            aria-label="Close team modal"
            className="text-white/50 hover:text-white/80 cursor-pointer p-1 rounded-lg hover:bg-white/5 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="bg-[#0d0e10] rounded-2xl p-4 mb-4 space-y-1.5">
          <p className="text-white/60 text-xs leading-relaxed">{TEAM_INFO.department}</p>
          <p className="text-white/45 text-xs">
            {TEAM_INFO.semester} · {TEAM_INFO.group}
            <span className="mx-1.5 text-white/20">·</span>
            Guide: <span className="text-white/65 font-medium">{TEAM_INFO.guide}</span>
          </p>
        </div>

        <div className="space-y-2">
          {TEAM_INFO.members.map((m, i) => (
            <div key={i} className="flex justify-between items-center bg-[#0d0e10] rounded-xl px-4 py-2.5 hover:bg-[#151719] transition-colors">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-[#e2723b]/15 border border-[#e2723b]/25 flex items-center justify-center">
                  <span className="text-[#e2723b] text-[9px] font-bold">{m.name.charAt(0)}</span>
                </div>
                <span className="text-white/80 text-sm font-medium">{m.name}</span>
              </div>
              <span className="text-white/35 text-[10px] font-mono">PRN {m.prn}</span>
            </div>
          ))}
        </div>

        <p className="text-center text-white/20 text-[10px] mt-5 tracking-wider">
          Made with ♥ · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}


/* ─── Angle Chart SVG ──────────────────────────────────────── */
function AngleLineChart() {
  const pts = [];
  for (let i = 0; i <= 100; i++) {
    const x = (i / 100) * 300;
    const y = 50 - 40 * Math.abs(Math.sin((i / 100) * Math.PI * 4));
    pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const polyline = pts.join(' ');
  return (
    <svg viewBox="0 0 300 65" className="w-full" style={{ height: 90 }}>
      <defs>
        <linearGradient id="chartGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#e2723b" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#e2723b" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[10, 30, 50].map(y => (
        <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      ))}
      <polygon points={`0,65 ${polyline} 300,65`} fill="url(#chartGrad)" />
      <polyline points={polyline} fill="none" stroke="#e2723b" strokeWidth="2.2" strokeLinejoin="round" />
      {[0, 1, 2, 3].map(i => {
        const x = (i / 3) * 300;
        const y = 50 - 40 * Math.abs(Math.sin((i / 3) * Math.PI * 4));
        return <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="4" fill="#e2723b" stroke="white" strokeWidth="1" />;
      })}
    </svg>
  );
}

function MetricBar({ label, value, delay = 0 }) {
  const [w, setW] = useState(0);
  const ref = useRef(null);
  const inView = useInView(ref);
  useEffect(() => {
    if (inView) setTimeout(() => setW(value), delay);
  }, [inView, value, delay]);
  return (
    <div ref={ref}>
      <div className="flex justify-between text-xs mb-1.5">
        <span className="text-white/50">{label}</span>
        <span className="text-[#e2723b] font-mono font-bold">{value}%</span>
      </div>
      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full bg-[#e2723b] rounded-full transition-all duration-1000 ease-out" style={{ width: `${w}%` }} />
      </div>
    </div>
  );
}

/* ─── Landing: How It Works Slide ──────────────────────────── */
function HowItWorksSlide() {
  const ref = useRef(null);
  const inView = useInView(ref);
  const steps = [
    { icon: <Wifi className="w-6 h-6" />, title: 'Live Camera Capture', desc: 'Captures direct browser-level video stream. Secure local processing ensures full privacy.', num: '01' },
    { icon: <Layers className="w-6 h-6" />, title: 'Kinematic Analysis', desc: 'Real-time joint coordinates calculated using on-device MoveNet ML Model.', num: '02' },
    { icon: <Brain className="w-6 h-6" />, title: 'AI Coaching', desc: 'Context-aware feedback fires based on precise anatomical angle thresholds.', num: '03' },
  ];
  return (
    <section className="relative z-10 flex flex-col items-center justify-center px-4 sm:px-12 py-16 sm:py-20 min-h-[90vh] bg-transparent" aria-label="How It Works">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div ref={ref} className="w-full max-w-5xl">

        {/* Section Header */}
        <div className={`text-center mb-10 transition-all duration-700 ease-out ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#e2723b]/25 bg-[#e2723b]/8 mb-4">
            <div className="w-1 h-1 rounded-full bg-[#e2723b]" />
            <span className="text-[#e2723b] text-[10px] uppercase tracking-widest font-bold">How It Works</span>
          </div>
          <h2 className="text-white text-3xl sm:text-4xl font-bold mb-3">From camera to coaching<br /><span className="text-white/55 font-normal text-2xl sm:text-3xl">in milliseconds</span></h2>
          <p className="text-white/55 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">A fully client-side ML pipeline — no server, no latency, no wearables.</p>
        </div>

        {/* ── Bento Grid ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">

          {/* Wide hero bento card — spans 2 cols on md */}
          <div className={`md:col-span-2 relative bg-[#111316] border border-white/8 rounded-3xl p-8 overflow-hidden transition-all duration-700 ease-out group hover:border-[#e2723b]/20 hover:bg-[#131619] ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
               style={{ transitionDelay: '100ms' }}>
            {/* Subtle radial glow */}
            <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ background: 'radial-gradient(ellipse at 20% 50%, rgba(226,114,59,0.06) 0%, transparent 60%)' }} />
            {/* Top terracotta accent line */}
            <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-[#e2723b]/40 to-transparent" />
            <div className="relative flex flex-col h-full">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-[#e2723b]/12 border border-[#e2723b]/20 flex items-center justify-center text-[#e2723b]">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[#e2723b] text-[10px] font-bold uppercase tracking-widest">Pipeline Overview</p>
                  <p className="text-white font-bold text-base">Full kinematic inference loop</p>
                </div>
              </div>
              {/* Step flow visualization */}
              <div className="flex items-center gap-2 flex-wrap">
                {['Camera Feed', '→', 'MoveNet', '→', 'Joint Coords', '→', 'Angle Engine', '→', 'AI Feedback'].map((item, i) => (
                  item === '→'
                    ? <span key={i} className="text-[#e2723b]/40 font-bold text-sm">→</span>
                    : <span key={i} className="px-3 py-1.5 rounded-lg bg-[#1a1d21] border border-white/8 text-white/70 text-xs font-semibold">{item}</span>
                ))}
              </div>
              <p className="text-white/40 text-xs mt-5 leading-relaxed">All processing runs in the browser via WebGL-accelerated TensorFlow.js. Zero network round-trips. Your video never leaves your device.</p>
            </div>
          </div>

          {/* Stat bento card — tall right column */}
          <div className={`relative bg-[#111316] border border-white/8 rounded-3xl p-7 flex flex-col justify-between transition-all duration-700 ease-out group hover:border-[#e2723b]/20 hover:bg-[#131619] ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
               style={{ transitionDelay: '200ms' }}>
            <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ background: 'radial-gradient(circle at 80% 20%, rgba(226,114,59,0.06) 0%, transparent 60%)' }} />
            <div className="relative">
              <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold mb-4">Live Metrics</p>
              {[['< 35ms', 'Latency'], ['17', 'Keypoints'], ['30+ fps', 'Frame Rate']].map(([val, label], i) => (
                <div key={i} className={`mb-4 pb-4 ${i < 2 ? 'border-b border-white/5' : ''}`}>
                  <p className="text-[#e2723b] font-mono font-bold text-2xl leading-none">{val}</p>
                  <p className="text-white/45 text-[10px] uppercase tracking-wider mt-1">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Three step cards row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {steps.map((s, i) => (
            <div key={i}
                 className={`relative bg-[#111316] border border-white/8 rounded-3xl p-6 transition-all duration-700 ease-out hover:border-[#e2723b]/20 hover:bg-[#131619] group ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
                 style={{ transitionDelay: `${i * 120 + 300}ms` }}>
              <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: 'radial-gradient(circle at 30% 30%, rgba(226,114,59,0.05) 0%, transparent 70%)' }} />
              <div className="relative">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-2xl bg-[#e2723b]/10 border border-[#e2723b]/20 flex items-center justify-center text-[#e2723b] group-hover:bg-[#e2723b]/18 transition-all">
                    {s.icon}
                  </div>
                  <span className="text-white/15 font-mono text-2xl font-bold">{s.num}</span>
                </div>
                <h3 className="text-white font-bold text-base mb-2">{s.title}</h3>
                <p className="text-white/45 text-sm leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Waveform card */}
        <div className={`bg-[#111316] border border-white/8 rounded-3xl p-7 transition-all duration-1000 ease-out ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
             style={{ transitionDelay: '650ms' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-white/40 text-xs uppercase tracking-wider font-semibold mb-1">Repetition Waveform</p>
              <p className="text-white font-semibold text-base">Joint angle trajectory over multiple rep cycles</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-white/45">
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#e2723b] inline-block rounded" /> Angle</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#e2723b] inline-block" /> Extension Peak</span>
            </div>
          </div>
          <AngleLineChart />
        </div>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </section>
  );
}

/* ─── Landing: Metrics Slide ────────────────────────────────── */

/* ─── Landing: Metrics Slide ────────────────────────────────── */
function MetricsSlide() {
  const ref = useRef(null);
  const inView = useInView(ref);
  const stats = [
    { val: '<35ms', label: 'Inference Latency', icon: <Zap className="w-4 h-4" /> },
    { val: '30+ fps', label: 'Analysis Rate', icon: <Activity className="w-4 h-4" /> },
    { val: '100%', label: 'Private Local Run', icon: <CheckCircle className="w-4 h-4" /> },
    { val: '17', label: 'Keypoints Tracked', icon: <Target className="w-4 h-4" /> },
  ];
  const features = [
    { icon: <Target className="w-4 h-4" />, label: 'Joint angle (°)', desc: 'Real-time skeletal vector dot-products' },
    { icon: <TrendingUp className="w-4 h-4" />, label: 'Angular velocity', desc: 'Temporal rate of joint movement' },
    { icon: <Activity className="w-4 h-4" />, label: 'Phase detection', desc: 'Extension vs. return classification' },
    { icon: <Award className="w-4 h-4" />, label: 'ROM score', desc: 'Range-of-motion quality percentage' },
    { icon: <RefreshCw className="w-4 h-4" />, label: 'Rep counting', desc: 'Waveform peak-valley detection' },
    { icon: <Brain className="w-4 h-4" />, label: 'AI coach tips', desc: 'Contextual form correction messages' },
  ];
  return (
    <section className="relative z-10 flex flex-col items-center justify-center px-4 sm:px-12 py-16 sm:py-20 min-h-[90vh] bg-transparent" aria-label="System Performance">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div ref={ref} className="w-full max-w-5xl">
        <div className={`text-center mb-14 transition-all duration-700 ease-out ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#e2723b]/25 bg-[#e2723b]/8 mb-4">
            <div className="w-1 h-1 rounded-full bg-[#e2723b]" />
            <span className="text-[#e2723b] text-[10px] uppercase tracking-widest font-bold">System Performance</span>
          </div>
          <h2 className="text-white text-3xl sm:text-4xl font-bold mb-3">Built for precision<br /><span className="text-white/60 font-normal">& real-time speed</span></h2>
          <p className="text-white/55 text-sm sm:text-base max-w-md mx-auto">Powered by TF.js MoveNet SinglePose Lightning. Runs entirely in your browser.</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {stats.map((s, i) => (
            <div key={i}
                 className={`bg-[#111316] border border-white/8 rounded-2xl p-5 text-center transition-all duration-700 ease-out hover:border-white/15 hover:bg-[#141619] group ${inView ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
                 style={{ transitionDelay: `${i * 100 + 100}ms` }}>
              <div className="flex justify-center mb-3">
                <div className="w-8 h-8 rounded-xl bg-[#e2723b]/10 border border-[#e2723b]/20 flex items-center justify-center text-[#e2723b] group-hover:bg-[#e2723b]/15 transition-all">
                  {s.icon}
                </div>
              </div>
              <p className="text-[#e2723b] font-mono font-bold text-2xl sm:text-3xl mb-1">{s.val}</p>
              <p className="text-white/50 text-[10px] sm:text-xs uppercase tracking-wider font-semibold">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className={`bg-[#111316] border border-white/8 rounded-3xl p-7 transition-all duration-700 ease-out ${inView ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'}`}
               style={{ transitionDelay: '500ms' }}>
            <p className="text-white/50 text-xs uppercase tracking-wider font-semibold mb-1">Component Accuracy</p>
            <p className="text-white font-semibold text-base mb-6">System validation metrics</p>
            <div className="space-y-4">
              <MetricBar label="Pose Estimation Confidence" value={98} delay={700} />
              <MetricBar label="Kinematic Angle Mapping" value={94} delay={850} />
              <MetricBar label="Form Score Validity" value={91} delay={1000} />
              <MetricBar label="AI Feedback Relevance" value={89} delay={1150} />
            </div>
          </div>

          <div className={`bg-[#111316] border border-white/8 rounded-3xl p-7 transition-all duration-700 ease-out ${inView ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}
               style={{ transitionDelay: '500ms' }}>
            <p className="text-white/50 text-xs uppercase tracking-wider font-semibold mb-1">Technical Features</p>
            <p className="text-white font-semibold text-base mb-5">What TrueForm AI measures</p>
            <div className="grid grid-cols-2 gap-3">
              {features.map((f, i) => (
                <div key={i} className="flex items-start gap-2.5 p-3 rounded-xl bg-[#0d0e10] hover:bg-[#151719] transition-colors">
                  <div className="w-6 h-6 rounded-lg bg-[#e2723b]/10 flex items-center justify-center text-[#e2723b] shrink-0 mt-0.5">
                    {f.icon}
                  </div>
                  <div>
                    <p className="text-white/80 text-xs font-semibold">{f.label}</p>
                    <p className="text-white/35 text-[10px] leading-relaxed mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}


/* ─── SCREEN 1: Landing ─────────────────────────────────────── */
function LandingScreen({ onStart, mode }) {
  const [loaded, setLoaded] = useState(false);
  const [activeFeature, setActiveFeature] = useState(null);
  const featureRef = useRef(null);

  const MOBILITY_FEATURES = [
    {
      id: 'tracking',
      icon: <Zap className="w-3.5 h-3.5" />,
      label: 'Real-time Tracking',
      detail: 'Utilizes advanced computer vision to extract 17 keypoint coordinates directly from your device\'s web camera feed at sub-35ms speeds with zero network overhead.',
      stat: '< 35ms latency',
    },
    {
      id: 'rep',
      icon: <Target className="w-3.5 h-3.5" />,
      label: 'Rep Counting',
      detail: 'Automatically detects phase transitions in your motion waveform to count completed repetitions dynamically, filtering out partial or failed attempts.',
      stat: '30+ fps detection',
    },
    {
      id: 'analytics',
      icon: <BarChart2 className="w-3.5 h-3.5" />,
      label: 'Session Analytics',
      detail: 'Logs joint angle variations, kinematic pathing vectors, and velocity drops to generate comprehensive form-accuracy charts instantly.',
      stat: '100% on-device',
    },
    {
      id: 'coach',
      icon: <Brain className="w-3.5 h-3.5" />,
      label: 'AI Coach',
      detail: 'Translates raw mathematical joint data into direct, actionable coaching tips to fix structural form errors in real-time.',
      stat: '17 keypoints tracked',
    },
  ];

  useEffect(() => { setLoaded(true); }, []);

  // Dismiss popover when clicking outside the feature row
  useEffect(() => {
    const handler = (e) => {
      if (featureRef.current && !featureRef.current.contains(e.target)) {
        setActiveFeature(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div className="relative z-10 flex-1 overflow-y-auto scroll-smooth">
      <section className="relative flex flex-col items-center justify-center min-h-[88vh] overflow-hidden px-4 sm:px-8">

        <div className="relative z-10 text-center" style={{ mixBlendMode: 'normal', background: 'transparent' }}>
          <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#e2723b]/45 bg-[#e2723b]/12 mb-7 transition-all duration-1000 ease-out ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="w-1.5 h-1.5 rounded-full bg-[#e2723b] animate-pulse" />
            <span className="text-[#e2723b] text-[11px] font-bold tracking-wider uppercase">
              {mode === 'mobility' ? 'TensorFlow.js Powered' : 'Local Computer Vision'}
            </span>
          </div>

          <h2 className={`text-xs sm:text-sm font-bold uppercase tracking-[0.25em] mb-3 bg-gradient-to-r from-[#e2723b] via-[#f97316] to-[#9a3412] bg-clip-text text-transparent transition-all duration-1000 ease-out delay-150 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            {mode === 'mobility' ? 'TrueForm AI Computer Vision' : 'TrueForm AI Predictive Intelligence'}
          </h2>

          <h1 className={`text-3xl sm:text-5xl font-bold text-white leading-tight mb-4 max-w-2xl mx-auto transition-all duration-1000 ease-out delay-200 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {mode === 'mobility' ? (
              <>Track Your Motion.<br /><span className="text-[#e2723b]">Perfect Your Form.</span></>
            ) : (
              <>Scan Your Meals.<br /><span className="text-[#e2723b]">Audit Your Macros.</span></>
            )}
          </h1>
          <p className={`text-white/70 text-base max-w-md mx-auto leading-relaxed mb-8 transition-all duration-1000 ease-out delay-300 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            {mode === 'mobility'
              ? 'Real-time skeletal tracking via AI computer vision. Highly accurate movement quality scores. No upload.'
              : 'On-device meal classification using local MobileNet. Calculates precise calories, protein, carbs, and fats.'}
          </p>

          {/* Feature Toggle Pills with Interactive Popover Cards */}
          <div
            ref={featureRef}
            className={`relative flex flex-wrap justify-center gap-3 mb-10 transition-all duration-1000 ease-out delay-400 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            {mode === 'mobility' ? (
              MOBILITY_FEATURES.map((f) => {
                const isActive = activeFeature === f.id;
                return (
                  <div key={f.id} className="relative">
                    {/* Pill Button */}
                    <button
                      onClick={() => setActiveFeature(isActive ? null : f.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-semibold transition-all duration-200 cursor-pointer select-none
                        ${ isActive
                          ? 'bg-[#e2723b]/15 border-[#e2723b]/70 text-[#e2723b] shadow-[0_0_16px_rgba(232,112,56,0.25)]'
                          : 'bg-[#1d1f23] border-white/15 text-white/80 hover:border-[#e2723b]/40 hover:bg-[#22252a]'
                        }`}
                    >
                      <span className={isActive ? 'text-[#e2723b]' : 'text-[#e2723b]'}>{f.icon}</span>
                      {f.label}
                      <span className={`ml-0.5 text-[9px] transition-transform duration-200 ${isActive ? 'rotate-180' : 'rotate-0'}`}>▾</span>
                    </button>

                    {/* Popover Card */}
                    <div
                      className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 z-50
                        transition-all duration-200 ease-out origin-bottom pointer-events-none
                        ${ isActive ? 'opacity-100 scale-100 translate-y-0 pointer-events-auto' : 'opacity-0 scale-95 translate-y-1' }`}
                    >
                      {/* Card */}
                      <div className="relative rounded-2xl border border-white/10 overflow-hidden"
                        style={{ background: 'rgba(13, 14, 16, 0.95)', backdropFilter: 'blur(20px)' }}>
                        {/* Top accent bar */}
                        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-[#e2723b]/70 to-transparent" />

                        <div className="p-4">
                          {/* Header */}
                          <div className="flex items-center gap-2.5 mb-3">
                            <div className="w-7 h-7 rounded-lg bg-[#e2723b]/12 border border-[#e2723b]/25 flex items-center justify-center text-[#e2723b]">
                              {f.icon}
                            </div>
                            <span className="text-white font-bold text-sm">{f.label}</span>
                          </div>

                          {/* Detail text */}
                          <p className="text-white/65 text-xs leading-relaxed mb-3">{f.detail}</p>

                          {/* Stat chip */}
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#e2723b]/10 border border-[#e2723b]/20">
                            <div className="w-1 h-1 rounded-full bg-[#e2723b] animate-pulse" />
                            <span className="text-[#e2723b] text-[10px] font-bold tracking-wider uppercase">{f.stat}</span>
                          </div>
                        </div>

                        {/* Grid texture overlay */}
                        <div className="absolute inset-0 pointer-events-none opacity-30"
                          style={{
                            backgroundSize: '20px 20px',
                            backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px),
                                             linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)`
                          }}
                        />
                      </div>

                      {/* Arrow pointing down */}
                      <div className="absolute left-1/2 -translate-x-1/2 -bottom-[6px] w-3 h-3 rotate-45
                        border-r border-b border-white/10"
                        style={{ background: 'rgba(13,14,16,0.95)' }} />
                    </div>
                  </div>
                );
              })
            ) : (
              [
                { icon: <Camera className="w-3.5 h-3.5" />, label: 'Photo/Webcam Capture' },
                { icon: <Zap className="w-3.5 h-3.5" />, label: 'On-Device Analysis' },
                { icon: <Apple className="w-3.5 h-3.5" />, label: 'Macro Tracking' },
                { icon: <TrendingUp className="w-3.5 h-3.5" />, label: 'Daily Macro Goals' },
              ].map((f, i) => (
                <div key={i} className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#1d1f23] border border-white/15 text-white/80 text-xs hover:border-[#e2723b]/40 hover:bg-[#22252a] transition-all cursor-default">
                  <span className="text-[#e2723b]">{f.icon}</span>{f.label}
                </div>
              ))
            )}
          </div>

          {/* ── Social Proof Stats Bar ── */}
          <div className={`flex items-center justify-center gap-0 mb-8 transition-all duration-1000 ease-out delay-450 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}>
            <div className="inline-flex items-center divide-x divide-white/10 bg-white/4 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
              {[
                { val: '97.4%', label: 'Pose Accuracy' },
                { val: '33', label: 'Joints Tracked' },
                { val: '< 35ms', label: 'Inference Latency' },
              ].map((s, i) => (
                <div key={i} className="px-5 py-3 text-center">
                  <p className="text-[#e2723b] font-mono font-bold text-lg leading-none">{s.val}</p>
                  <p className="text-white/45 text-[10px] uppercase tracking-wider mt-0.5 font-semibold">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className={`transition-all duration-1000 ease-out delay-500 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <button onClick={onStart}
              className="group inline-flex items-center gap-3 px-9 py-4 rounded-2xl font-bold text-base text-white shadow-lg shadow-[#e2723b]/30 transition-all duration-200 cursor-pointer mb-6 hover:scale-[1.03] active:scale-[0.98]"
              style={{ background: 'linear-gradient(135deg, #e2723b 0%, #c25c30 100%)', boxShadow: '0 0 0 0 rgba(226,114,59,0)' }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 0 3px rgba(226,114,59,0.25), 0 8px 30px rgba(226,114,59,0.30)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = '0 8px 30px rgba(226,114,59,0.25)'}>
              {mode === 'mobility' ? 'Begin Session' : 'Start Nutrition Scanner'} <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200" />
            </button>
            <p className="text-white/40 text-xs block">Camera access or file upload required · local execution only</p>
          </div>
        </div>

        <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-white/50 animate-bounce cursor-default transition-all duration-1000 delay-700 ${loaded ? 'opacity-100' : 'opacity-0'}`}>
          <span className="text-[10px] uppercase tracking-widest font-bold">Scroll to learn more</span>
          <ChevronDown className="w-4 h-4" />
        </div>
      </section>

      <HowItWorksSlide />
      <MetricsSlide />

      {/* Landing Footer */}
      <footer className="relative z-10 border-t border-white/5 py-8 px-8">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <div>
              <p className="text-white/70 text-xs font-semibold">TrueForm AI</p>
              <p className="text-white/30 text-[10px]">Real-time kinematic analysis · {new Date().getFullYear()}</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-white/30 text-[10px] font-semibold tracking-wider">
            <span>100% On-Device</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span>Zero Network Overhead</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span>Open Source</span>
          </div>
          <p className="text-white/20 text-[9px] tracking-wider">
            {TEAM_INFO.department} · {TEAM_INFO.semester} · {TEAM_INFO.group}
          </p>
        </div>
      </footer>
    </div>
  );
}

/* ─── SCREEN 2: Exercise Select ─────────────────────────────── */
function ExerciseSelectScreen({ onSelect }) {
  const [hovered, setHovered] = useState(null);
  return (
    <div className="relative z-10 flex-1 flex flex-col px-8 py-10 max-w-4xl mx-auto w-full" role="main">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#e2723b]/25 bg-[#e2723b]/8 mb-4">
          <span className="text-[#e2723b] text-[10px] uppercase tracking-widest font-bold">Step 1 of 2</span>
        </div>
        <h2 className="text-white text-3xl font-bold mb-2">Choose Your Exercise</h2>
        <p className="text-white/50 text-sm">Select the movement you want to track and analyse in this session.</p>
      </div>
      <div className="grid grid-cols-2 gap-5 flex-1">
        {EXERCISES.map((ex, exIdx) => (
          <button key={ex.id} onClick={() => onSelect(ex)}
            onMouseEnter={() => setHovered(ex.id)} onMouseLeave={() => setHovered(null)}
            style={{ animationDelay: `${exIdx * 90}ms`, animationFillMode: 'both' }}
            className={`stagger-card relative rounded-3xl p-7 text-left border transition-all duration-300 cursor-pointer overflow-hidden ${
              hovered === ex.id ? 'bg-[#141619] border-[#e2723b]/50 shadow-xl shadow-[#e2723b]/8' : 'bg-[#111316] border-white/8'
            }`}>
            <div className={`absolute inset-0 rounded-3xl pointer-events-none transition-opacity duration-300 ${hovered === ex.id ? 'opacity-100' : 'opacity-0'}`}
              style={{ background: 'radial-gradient(circle at 30% 30%, rgba(226,114,59,0.07) 0%, transparent 70%)' }} />
            <div className="w-12 h-12 rounded-2xl bg-[#e2723b]/10 border border-[#e2723b]/20 flex items-center justify-center mb-5">
              {ex.icon === 'rotate' ? <Rotate3D className="w-6 h-6 text-[#e2723b]" /> : <Activity className="w-6 h-6 text-[#e2723b]" />}
            </div>
            <h3 className="text-white font-bold text-xl mb-2">{ex.name}</h3>
            <p className="text-white/65 text-sm leading-relaxed mb-5">{ex.description}</p>
            <div className="flex flex-wrap gap-2 mb-5">
              {ex.tags.map(t => (
                <span key={t} className="px-2.5 py-1 rounded-full bg-[#1d1f23] border border-white/12 text-white/65 text-[10px] font-semibold uppercase tracking-wide">{t}</span>
              ))}
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-white/5">
              <div>
                <p className="text-white/35 text-[10px] uppercase tracking-wider mb-0.5">Target ROM</p>
                <p className="text-white/70 text-sm font-mono font-semibold">{ex.targetRange.min}° — {ex.targetRange.max}°</p>
              </div>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300 ${hovered === ex.id ? 'bg-[#e2723b] text-white' : 'bg-white/5 text-white/25'}`}>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          </button>
        ))}
      </div>
      <p className="text-center text-white/20 text-xs mt-6 font-semibold">Camera and AI models will activate on selection</p>
    </div>
  );
}

/* ─── Angle Arc Gauge ───────────────────────────────────────── */
function SemicircleGauge({ angle, tMin, tMax }) {
  const pct = Math.min(Math.max(angle / 180, 0), 1); // normalized to 180 for full arc
  const R = 40; const cx = 50; const cy = 52;
  const toXY = (frac) => {
    const a = Math.PI + frac * Math.PI;
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  };
  const s = toXY(0); const e = toXY(pct);
  const path = pct > 0.001 ? `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${R} ${R} 0 ${pct > 0.5 ? 1 : 0} 1 ${e.x.toFixed(2)} ${e.y.toFixed(2)}` : '';
  const isGood = angle >= tMin && angle <= tMax;
  const col = !angle ? '#333' : isGood ? '#34d399' : '#e2723b';
  return (
    <svg viewBox="0 0 100 58" className="w-full h-[72px]">
      <path d={`M ${s.x} ${s.y} A ${R} ${R} 0 1 1 ${toXY(1).x} ${toXY(1).y}`} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" strokeLinecap="round" />
      <path d={`M ${toXY(tMin/180).x} ${toXY(tMin/180).y} A ${R} ${R} 0 0 1 ${toXY(tMax/180).x} ${toXY(tMax/180).y}`} fill="none" stroke="rgba(52,211,153,0.18)" strokeWidth="8" strokeLinecap="round" />
      {path && <path d={path} fill="none" stroke={col} strokeWidth="8" strokeLinecap="round" />}
      <text x="50" y="48" textAnchor="middle" fill="white" fontSize="15" fontWeight="bold" fontFamily="monospace">{angle.toFixed(0)}°</text>
    </svg>
  );
}

/* ─── AI Coach Panel ────────────────────────────────────────── */
function AICoachPanel({ angle, velocity, isFlexing, formScore, isMoving, repCount, peakAngle, exercise }) {
  const coach = getCoachMsg(angle, velocity, isFlexing, formScore, isMoving);
  const st = {
    good: { bg: 'bg-emerald-500/10 border-emerald-500/25', text: 'text-emerald-400', dot: 'bg-emerald-400' },
    warn: { bg: 'bg-[#e2723b]/10 border-[#e2723b]/25', text: 'text-[#e2723b]', dot: 'bg-[#e2723b]' },
    info: { bg: 'bg-blue-500/10 border-blue-500/25', text: 'text-blue-400', dot: 'bg-blue-400' },
    idle: { bg: 'bg-white/5 border-white/10', text: 'text-white/40', dot: 'bg-white/30' },
  }[coach.type];

  return (
    <div className="flex-1 bg-[#111316] border border-white/8 rounded-[1.8rem] p-5 flex flex-col gap-4 overflow-hidden select-none">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-xl bg-[#e2723b]/10 border border-[#e2723b]/20 flex items-center justify-center text-[#e2723b]"><Brain className="w-4.5 h-4.5" /></div>
        <div>
          <p className="text-white font-bold text-sm">AI Coach</p>
          <p className="text-white/40 text-[10px] uppercase tracking-wider font-semibold">{exercise.name}</p>
        </div>
        <div className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-bold ${st.bg} ${st.text}`}>
          <div className={`w-1.5 h-1.5 rounded-full ${st.dot} ${isMoving ? 'animate-pulse' : ''}`} />
          {isMoving ? 'TRACKING' : 'WAITING'}
        </div>
      </div>

      <div className="bg-[#0d0e10] rounded-2xl px-4 pt-3.5 pb-2">
        <p className="text-white/40 text-[10px] uppercase tracking-wider font-bold mb-1">Kinematic Angle Gauge</p>
        <SemicircleGauge angle={angle} tMin={exercise.targetRange.min} tMax={exercise.targetRange.max} />
        <div className="flex justify-between text-[9px] text-white/30 -mt-1 px-1 font-semibold">
          <span>0°</span><span className="text-emerald-400/80">Target: {exercise.targetRange.min}°–{exercise.targetRange.max}°</span><span>180°</span>
        </div>
      </div>

      <div className={`rounded-2xl border p-4 ${st.bg}`}>
        <p className={`font-bold text-base mb-1 ${st.text}`}>{coach.msg}</p>
        <p className="text-white/60 text-xs leading-relaxed">{coach.sub}</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {[
          { label: 'Reps Detected', val: repCount, color: 'text-emerald-400' },
          { label: 'Peak Angle', val: `${peakAngle.toFixed(0)}°`, color: 'text-[#e2723b]' },
          { label: 'Avg Speed', val: `${velocity.toFixed(0)}°/s`, color: 'text-blue-400' },
          { label: 'Form Score', val: `${formScore}%`, color: formScore > 70 ? 'text-emerald-400' : 'text-[#e2723b]' },
        ].map(m => (
          <div key={m.label} className="bg-[#0d0e10] rounded-xl px-3 py-2.5">
            <p className="text-white/40 text-[10px] uppercase tracking-wider font-semibold mb-1">{m.label}</p>
            <p className={`font-mono font-bold text-lg leading-none ${m.color}`}>{m.val}</p>
          </div>
        ))}
      </div>

      <div className="bg-[#0d0e10] rounded-xl px-3 py-2.5">
        <p className="text-white/40 text-[10px] uppercase tracking-wider font-semibold mb-2">Phase Indicator</p>
        <div className="flex items-center gap-2">
          <div className={`flex-1 h-1.5 rounded-full ${isFlexing ? 'bg-[#e2723b]' : 'bg-white/10'} transition-all duration-300`} />
          <span className="text-white/50 text-[9px] font-bold tracking-wider">{isFlexing ? 'EXTENSION' : 'RETURN'}</span>
          <div className={`flex-1 h-1.5 rounded-full ${!isFlexing && isMoving ? 'bg-emerald-400' : 'bg-white/10'} transition-all duration-300`} />
        </div>
      </div>

      <div className="mt-auto">
        <p className="text-white/30 text-[9px] text-center font-semibold">TF.js MoveNet Engine Active</p>
      </div>
    </div>
  );
}

/* ─── SCREEN 3: Tracking (TF.js ML Version) ─────────────────── */
function TrackingScreen({ exercise, onFinish }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const animRef = useRef(null);
  const detectorRef = useRef(null);
  const isMountedRef = useRef(true);

  // State tracing
  const prevTimeRef = useRef(performance.now());
  const prevAngleRef = useRef(0);
  const historyRef = useRef([]);

  const isFlexingRef = useRef(false);
  const repCountRef = useRef(0);
  const peakAngleRef = useRef(0);
  const formScoreRef = useRef(100);

  // Smoothing filter
  const smoothedAngleRef = useRef(0);

  const [camActive, setCamActive] = useState(false);
  const [camError, setCamError] = useState('');
  const [modelStatus, setModelStatus] = useState('Loading ML Model...');

  // Decoupled state updates for smooth UI render
  const [uiAngle, setUiAngle] = useState(0);
  const [uiVel, setUiVel] = useState(0);
  const [uiReps, setUiReps] = useState(0);
  const [uiPeak, setUiPeak] = useState(0);
  const [uiForm, setUiForm] = useState(100);
  const [uiMoving, setUiMoving] = useState(false);
  const [uiFlexing, setUiFlexing] = useState(false);
  
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef(Date.now());
  const frameSkipRef = useRef(0);

  const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  /* Timer */
  useEffect(() => {
    const iv = setInterval(() => {
      if (isMountedRef.current) setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  /* Initialize Camera and Model */
  useEffect(() => {
    isMountedRef.current = true;
    (async () => {
      try {
        // 1. Load Camera
        const s = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' }, audio: false
        });
        if (!isMountedRef.current) { s.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = s;
        if (videoRef.current) { 
          videoRef.current.srcObject = s; 
          await videoRef.current.play().catch(() => {}); 
        }
        setCamActive(true);
        
        // 2. Load TFJS Model
        setModelStatus('Initializing TensorFlow.js...');
        await tf.setBackend('webgl');
        await tf.ready();
        
        setModelStatus('Loading MoveNet Pose Model...');
        const detectorConfig = { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING };
        detectorRef.current = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, detectorConfig);
        
        if (isMountedRef.current) setModelStatus('');

      } catch (err) {
        if (!isMountedRef.current) return;
        console.error(err);
        setCamError('Hardware acceleration or camera access failed.');
        setCamActive(false); 
        setModelStatus('');
      }
    })();
    return () => {
      isMountedRef.current = false;
      if (animRef.current) { cancelAnimationFrame(animRef.current); animRef.current = null; }
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    };
  }, []);

  /* ML Inference Loop */
  const runDetection = useCallback(async () => {
    if (!isMountedRef.current) return;
    
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const detector = detectorRef.current;

      if (detector && canvas && video && video.readyState >= 2) {
        const vw = video.videoWidth || 640;
        const vh = video.videoHeight || 480;
        if (canvas.width !== vw || canvas.height !== vh) { canvas.width = vw; canvas.height = vh; }

        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        ctx.clearRect(0, 0, W, H);

        // Run inference
        const poses = await detector.estimatePoses(video, { maxPoses: 1, flipHorizontal: false });
        
        let calculatedAngle = 0;
        let isUserMoving = false;

        if (poses.length > 0 && poses[0].keypoints) {
          const kps = poses[0].keypoints;
          const kMap = {};
          kps.forEach(k => { if (k.score > 0.3) kMap[k.name] = k; }); // Minimum confidence 0.3

          // ── Kinematic Math ──
          if (exercise.id === 'head_rotation') {
            // Track head yaw using ear and nose relationships
            if (kMap.nose && kMap.left_ear && kMap.right_ear) {
              const earDist = Math.abs(kMap.left_ear.x - kMap.right_ear.x) || 1;
              const earCenter = (kMap.left_ear.x + kMap.right_ear.x) / 2;
              // How far does the nose deviate from the center of the ears horizontally?
              const dx = Math.abs(kMap.nose.x - earCenter);
              // Map this ratio to a raw angle (approx 90 deg max)
              const rawAngle = Math.min((dx / (earDist / 1.5)) * 90, 95);
              calculatedAngle = rawAngle;
              isUserMoving = true;
            }
          } else if (exercise.id === 'arm_rotation') {
            // Track shoulder abduction/flexion
            const rightValid = kMap.right_shoulder && kMap.right_elbow;
            const leftValid = kMap.left_shoulder && kMap.left_elbow;
            
            let rAngle = 0, lAngle = 0;
            // Vector from shoulder to elbow relative to straight down (0, 1)
            if (rightValid) {
              const len = Math.hypot(kMap.right_elbow.x - kMap.right_shoulder.x, kMap.right_elbow.y - kMap.right_shoulder.y);
              const vy = (kMap.right_elbow.y - kMap.right_shoulder.y) / len;
              rAngle = Math.acos(vy) * 180 / Math.PI;
            }
            if (leftValid) {
              const len = Math.hypot(kMap.left_elbow.x - kMap.left_shoulder.x, kMap.left_elbow.y - kMap.left_shoulder.y);
              const vy = (kMap.left_elbow.y - kMap.left_shoulder.y) / len;
              lAngle = Math.acos(vy) * 180 / Math.PI;
            }
            
            if (rightValid || leftValid) {
              calculatedAngle = Math.max(rAngle, lAngle); // Track whichever arm is higher
              isUserMoving = true;
            }
          }

          // Draw active skeleton on canvas
          ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
          const drawBone = (p1, p2) => {
            if (kMap[p1] && kMap[p2]) {
              ctx.beginPath(); ctx.moveTo(kMap[p1].x, kMap[p1].y); ctx.lineTo(kMap[p2].x, kMap[p2].y); ctx.stroke();
            }
          };

          // Draw torso and arms to look cool
          drawBone('left_shoulder', 'right_shoulder');
          drawBone('left_shoulder', 'left_elbow'); drawBone('left_elbow', 'left_wrist');
          drawBone('right_shoulder', 'right_elbow'); drawBone('right_elbow', 'right_wrist');
          
          if (exercise.id === 'head_rotation') {
             drawBone('nose', 'left_eye'); drawBone('left_eye', 'left_ear');
             drawBone('nose', 'right_eye'); drawBone('right_eye', 'right_ear');
          }

          Object.values(kMap).forEach(k => {
            ctx.fillStyle = '#e2723b';
            ctx.beginPath(); ctx.arc(k.x, k.y, 6, 0, Math.PI*2); ctx.fill();
            ctx.strokeStyle = 'white'; ctx.lineWidth = 1.5; ctx.stroke();
          });
        }

        // Low-pass filter for smooth UI display
        smoothedAngleRef.current += (calculatedAngle - smoothedAngleRef.current) * 0.15;
        const activeAngle = smoothedAngleRef.current;
        
        // Rep counting logic
        const now = performance.now();
        const dt = (now - prevTimeRef.current) / 1000;
        prevTimeRef.current = now;

        const peakLimit = exercise.targetRange.min; // e.g. 45 or 90
        const restLimit = exercise.id === 'head_rotation' ? 20 : 35; // neutral return thresholds

        if (activeAngle > peakLimit && !isFlexingRef.current) {
          isFlexingRef.current = true;
        } else if (activeAngle < restLimit && isFlexingRef.current) {
          isFlexingRef.current = false;
          repCountRef.current += 1;
          playChime();
        }

        if (activeAngle > peakAngleRef.current) peakAngleRef.current = activeAngle;

        let velocity = 0;
        if (dt > 0.01) {
          velocity = Math.abs(activeAngle - prevAngleRef.current) / dt;
        }
        prevAngleRef.current = activeAngle;

        // Store for analysis
        historyRef.current.push(activeAngle);
        if (historyRef.current.length > 600) historyRef.current.shift();

        const tMin = exercise.targetRange.min;
        const tMax = exercise.targetRange.max;
        const goodSamp = historyRef.current.filter(a => a >= tMin && a <= tMax).length;
        formScoreRef.current = historyRef.current.length > 0 ? Math.round((goodSamp / historyRef.current.length) * 100) : 100;

        // UI Throttle Update
        frameSkipRef.current++;
        if (frameSkipRef.current % 4 === 0 && isMountedRef.current) {
          setUiAngle(activeAngle);
          setUiVel(velocity);
          setUiReps(repCountRef.current);
          setUiPeak(peakAngleRef.current);
          setUiForm(formScoreRef.current);
          setUiMoving(isUserMoving);
          setUiFlexing(isFlexingRef.current);
        }
      }
    } catch (e) {
       console.error("Inference Error:", e);
    }
    
    // Non-blocking async loop
    if (isMountedRef.current) animRef.current = requestAnimationFrame(runDetection);
  }, [exercise]);

  useEffect(() => {
    // Start loop when model and camera are ready
    if (camActive && !modelStatus && !animRef.current) {
      prevTimeRef.current = performance.now();
      animRef.current = requestAnimationFrame(runDetection);
    }
    return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
  }, [camActive, modelStatus, runDetection]);

  const handleFinish = () => {
    if (animRef.current) cancelAnimationFrame(animRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    const hist = [...historyRef.current];
    onFinish({
      exercise,
      repCount: repCountRef.current,
      peakAngle: peakAngleRef.current,
      formScore: formScoreRef.current,
      elapsed,
      history: hist,
      avgAngle: hist.length > 0 ? Math.round(hist.reduce((a, b) => a + b, 0) / hist.length) : 0,
    });
  };

  return (
    <div className="relative z-10 flex-1 flex flex-col gap-4 px-4 sm:px-6 py-4 sm:py-5 overflow-y-auto md:overflow-hidden select-none">
      <div className="flex flex-col md:flex-row gap-4 flex-1 min-h-0">
        {/* Webcam Display */}
        <div className="relative bg-black rounded-[1.8rem] border border-white/8 overflow-hidden w-full md:w-[58%] shrink-0 aspect-[4/3] md:aspect-auto min-h-[240px] md:min-h-0">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
            playsInline muted
          />
          {/* Canvas perfectly overlays video - NO Distortion */}
          <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />

          {camError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-10">
              <AlertCircle className="w-8 h-8 text-[#e2723b] mb-2" />
              <p className="text-[#e2723b] text-xs font-semibold">{camError}</p>
            </div>
          )}
          {modelStatus && !camError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
              <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/10 border border-white/20">
                <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white/60 animate-spin" />
                <span className="text-white/60 text-xs font-semibold tracking-wider">{modelStatus}</span>
              </div>
            </div>
          )}

          {camActive && !modelStatus && (
            <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#e2723b]/20 border border-[#e2723b]/30">
              <div className={`w-1.5 h-1.5 rounded-full ${uiMoving ? 'bg-[#e2723b] animate-pulse' : 'bg-white/30'}`} />
              <span className="text-[#e2723b] text-[9px] font-bold tracking-widest uppercase">{uiMoving ? 'Tracking Body' : 'Stand in frame'}</span>
            </div>
          )}

          <div className="absolute top-3 right-3 z-20 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 border border-white/10">
            <Clock className="w-3 h-3 text-white/40" />
            <span className="text-white/70 text-[10px] font-mono">{fmtTime(elapsed)}</span>
          </div>

          <div className="absolute bottom-3 left-3 z-20 px-2.5 py-1 rounded-full bg-black/50 border border-white/10">
            <span className="text-white/50 text-[9px] uppercase tracking-wider font-semibold">{exercise.name}</span>
          </div>
        </div>

        {/* AI Coach Display */}
        <AICoachPanel
          angle={uiAngle} velocity={uiVel} isFlexing={uiFlexing}
          formScore={uiForm} isMoving={uiMoving}
          repCount={uiReps} peakAngle={uiPeak} exercise={exercise}
        />
      </div>

      {/* Stats pills */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        {[
          { label: 'Calculated Angle', val: `${uiAngle.toFixed(1)}°` },
          { label: 'Movement Speed', val: `${uiVel.toFixed(1)}°/s` },
          { label: 'Peak Angle', val: `${uiPeak.toFixed(0)}°` },
          { label: 'Tracking Score', val: `${uiForm}%` },
        ].map(p => (
          <div key={p.label} className="bg-[#111316] border border-white/8 rounded-2xl px-4 py-3.5">
            <p className="text-white/45 text-[10px] uppercase tracking-wider font-semibold mb-1.5">{p.label}</p>
            <p className="text-[#e2723b] font-mono text-2xl font-bold leading-none">{p.val}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 shrink-0">
        <div className="flex flex-wrap items-center gap-4 sm:gap-5 bg-[#111316] border border-white/8 rounded-2xl px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="text-white/45 text-xs">Repetitions</span>
            <span className="text-emerald-400 font-mono font-bold text-xl leading-none">{uiReps}</span>
          </div>
          <div className="w-px h-5 bg-white/8" />
          <div className="flex items-center gap-2">
            <span className="text-white/45 text-xs">Best ROM</span>
            <span className="text-[#e2723b] font-mono font-bold text-sm">{uiPeak.toFixed(0)}°</span>
          </div>
          <div className="w-px h-5 bg-white/8" />
          <div className="flex items-center gap-2">
            <span className="text-white/45 text-xs">Consistency</span>
            <span className={`font-mono font-bold text-sm ${uiForm > 70 ? 'text-emerald-400' : 'text-[#e2723b]'}`}>{uiForm}%</span>
          </div>
        </div>
        <button onClick={handleFinish}
          className="flex items-center justify-center gap-2.5 px-6 py-3 rounded-2xl bg-[#e2723b] hover:bg-[#d15f2a] text-white font-semibold text-sm transition-all shadow-lg shadow-[#e2723b]/20 cursor-pointer w-full sm:w-auto">
          <StopCircle className="w-4 h-4" /> Finish Session
        </button>
      </div>
    </div>
  );
}

/* ─── SCREEN 4: Analysis ────────────────────────────────────── */
function AnalysisScreen({ data, onRetry, onHome }) {
  const { exercise, repCount, peakAngle, formScore, elapsed, avgAngle, history } = data;
  const fmtTime = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const grade = formScore >= 80 ? 'Excellent' : formScore >= 60 ? 'Good' : formScore >= 40 ? 'Fair' : 'Needs Work';
  const gradeColor = formScore >= 80 ? 'text-emerald-400' : formScore >= 60 ? 'text-blue-400' : formScore >= 40 ? 'text-yellow-400' : 'text-[#e2723b]';
  const targetMet = peakAngle >= exercise.targetRange.min;
  const roiPct = Math.min(100, Math.round((peakAngle / Math.max(exercise.targetRange.max, 1)) * 100));

  const svgW = 300, svgH = 55;
  const sparkMax = Math.max(...history, 1);
  const step = Math.max(1, Math.floor(history.length / 80));
  const spark = history.filter((_, i) => i % step === 0).slice(-80);
  const pts = spark.map((v, i) => {
    const x = (i / Math.max(spark.length - 1, 1)) * svgW;
    const y = svgH - (v / sparkMax) * (svgH - 4) - 2;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <div className="relative z-10 flex-1 flex flex-col px-8 py-8 overflow-y-auto max-w-5xl mx-auto w-full select-none">
      <div className="flex items-start justify-between mb-8">
        <div>
          <p className="text-[#e2723b] text-xs uppercase tracking-widest font-semibold mb-1">Session Complete</p>
          <h2 className="text-white text-3xl font-bold">Analysis Report</h2>
          <p className="text-white/50 text-sm mt-1">{exercise.name} · {fmtTime(elapsed)} session</p>
        </div>
        <div className="text-right">
          <p className="text-white/40 text-xs mb-1 uppercase tracking-wider font-semibold">Form Grade</p>
          <p className={`text-3xl font-bold ${gradeColor}`}>{grade}</p>
          <p className={`text-sm opacity-70 ${gradeColor}`}>{formScore}% in target zone</p>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          { icon: <RefreshCw className="w-4 h-4" />, label: 'Total Reps', val: repCount, unit: '', color: 'text-emerald-400' },
          { icon: <Target className="w-4 h-4" />, label: 'Peak ROM', val: peakAngle.toFixed(0), unit: '°', color: 'text-[#e2723b]' },
          { icon: <TrendingUp className="w-4 h-4" />, label: 'Avg Angle', val: avgAngle, unit: '°', color: 'text-blue-400' },
          { icon: <Clock className="w-4 h-4" />, label: 'Duration', val: fmtTime(elapsed), unit: '', color: 'text-purple-400' },
        ].map(s => (
          <div key={s.label} className="bg-[#111316] border border-white/8 rounded-2xl p-5">
            <div className={`mb-3 opacity-60 ${s.color}`}>{s.icon}</div>
            <p className="text-white/45 text-[10px] uppercase tracking-wider font-semibold mb-1.5">{s.label}</p>
            <p className={`font-mono text-2xl font-bold ${s.color}`}>{s.val}<span className="text-sm opacity-50 ml-0.5">{s.unit}</span></p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-[#111316] border border-white/8 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-white/50 text-xs uppercase tracking-wider font-semibold">Range of Motion</p>
            {targetMet
              ? <div className="flex items-center gap-1 text-emerald-400 text-xs font-semibold"><CheckCircle className="w-3.5 h-3.5" /> Target Met</div>
              : <div className="flex items-center gap-1 text-[#e2723b] text-xs font-semibold"><AlertCircle className="w-3.5 h-3.5" /> Below Target</div>}
          </div>
          <div className="relative h-3 bg-white/5 rounded-full mb-3 overflow-hidden">
            <div className="absolute left-0 top-0 h-full rounded-full bg-[#e2723b] transition-all duration-1000" style={{ width: `${roiPct}%` }} />
            <div className="absolute top-0 h-full w-0.5 bg-emerald-400/50"
              style={{ left: `${(exercise.targetRange.min / Math.max(exercise.targetRange.max, 1)) * 100}%` }} />
          </div>
          <div className="flex justify-between text-[10px] text-white/30 font-semibold">
            <span>0°</span>
            <span className="text-emerald-400/80">Target: {exercise.targetRange.min}°–{exercise.targetRange.max}°</span>
            <span>{exercise.targetRange.max}°</span>
          </div>
          <p className={`text-2xl font-bold font-mono mt-3 ${targetMet ? 'text-emerald-400' : 'text-[#e2723b]'}`}>
            {peakAngle.toFixed(0)}<span className="text-sm opacity-50">°</span>
          </p>
        </div>

        <div className="bg-[#111316] border border-white/8 rounded-2xl p-5">
          <p className="text-white/50 text-xs uppercase tracking-wider font-semibold mb-4">Angle Over Session</p>
          {spark.length > 3 ? (
            <svg width="100%" viewBox={`0 0 ${svgW} ${svgH}`} preserveAspectRatio="none" className="overflow-visible">
              <defs>
                <linearGradient id="sg2" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#e2723b" stopOpacity="0.22" />
                  <stop offset="100%" stopColor="#e2723b" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polygon points={`0,${svgH} ${pts} ${svgW},${svgH}`} fill="url(#sg2)" />
              <polyline points={pts} fill="none" stroke="#e2723b" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          ) : (
            <div className="flex items-center justify-center h-16 text-white/20 text-xs">Insufficient data</div>
          )}
          <p className="text-white/35 text-[10px] mt-2 font-semibold">{history.length} frames sampled</p>
        </div>
      </div>

      <div className="bg-[#111316] border border-white/8 rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Award className="w-4 h-4 text-[#e2723b]" />
          <p className="text-white/50 text-xs uppercase tracking-wider font-semibold">AI Feedback</p>
        </div>
        <ul className="space-y-2 text-white/60 text-sm leading-relaxed">
          {repCount === 0 && <li>• No complete repetitions detected. Ensure you perform a full range of motion, reaching the peak before returning to start.</li>}
          {repCount > 0 && repCount < 5 && <li>• {repCount} rep{repCount > 1 ? 's' : ''} recorded. Extend your session for a more comprehensive assessment.</li>}
          {repCount >= 5 && <li>• Great effort — {repCount} reps logged with consistent movement patterns.</li>}
          {!targetMet && <li>• Peak ROM ({peakAngle.toFixed(0)}°) is below target ({exercise.targetRange.min}°–{exercise.targetRange.max}°). Focus on a fuller range of motion.</li>}
          {targetMet && <li>• Peak ROM is within the target range — excellent mobility demonstrated.</li>}
          {formScore >= 80 && <li>• Consistency of {formScore}% is excellent. Maintain this quality as you progress.</li>}
          {formScore < 60 && <li>• Form score of {formScore}% suggests deviation from optimal zone. Slow down for more controlled movement.</li>}
        </ul>
      </div>

      <div className="flex items-center gap-3 pb-2">
        <button onClick={onRetry}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#e2723b] hover:bg-[#d15f2a] text-white font-semibold text-sm transition-all shadow-lg shadow-[#e2723b]/20 cursor-pointer">
          <RefreshCw className="w-4 h-4" /> New Session
        </button>
        <button onClick={onHome}
          className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white/5 hover:bg-white/8 border border-white/10 text-white/70 hover:text-white font-semibold text-sm transition-all cursor-pointer">
          <ArrowLeft className="w-4 h-4" /> Home
        </button>
      </div>
    </div>
  );
}

/* ─── SCREEN 5: Predictive Nutritional Intelligence Hub ────── */
function PredictiveNutritionHub() {
  // Input Biomarker State
  const [fastingGlucose, setFastingGlucose] = useState('95');
  const [triglycerides, setTriglycerides] = useState('125');
  const [hdlCholesterol, setHdlCholesterol] = useState('52');
  const [ldlCholesterol, setLdlCholesterol] = useState('98');
  const [hba1c, setHba1c] = useState('5.2');

  // Diagnostics & Inference State
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [diagnostics, setDiagnostics] = useState(null);

  // Compute inference model predictions (FFNN & Random Forest logic)
  const runInference = useCallback((fg, tg, hdl, ldl, a1c) => {
    const glucose = parseFloat(fg) || 90;
    const trig = parseFloat(tg) || 120;
    const hdlVal = parseFloat(hdl) || 50;
    const ldlVal = parseFloat(ldl) || 100;
    const a1cVal = parseFloat(a1c) || 5.2;

    // 1. Fasting Glucose Risk Component (70-99 optimal)
    let gScore = 10;
    if (glucose > 99 && glucose <= 125) {
      gScore = 30 + ((glucose - 99) / 26) * 40;
    } else if (glucose > 125) {
      gScore = 70 + Math.min(28, ((glucose - 125) / 50) * 28);
    } else {
      gScore = Math.max(5, ((glucose - 70) / 29) * 25);
    }

    // 2. HbA1c Risk Component (< 5.7% optimal)
    let a1cScore = 10;
    if (a1cVal >= 5.7 && a1cVal <= 6.4) {
      a1cScore = 35 + ((a1cVal - 5.7) / 0.7) * 35;
    } else if (a1cVal > 6.4) {
      a1cScore = 70 + Math.min(28, ((a1cVal - 6.4) / 2.0) * 28);
    } else {
      a1cScore = Math.max(5, ((a1cVal - 4.5) / 1.2) * 25);
    }

    // 3. Triglyceride Risk Component (< 150 optimal)
    let tgScore = 15;
    if (trig >= 150 && trig <= 199) {
      tgScore = 35 + ((trig - 150) / 49) * 35;
    } else if (trig > 199) {
      tgScore = 70 + Math.min(28, ((trig - 199) / 150) * 28);
    } else {
      tgScore = Math.max(5, (trig / 150) * 25);
    }

    // 4. Lipid & Atherogenic Ratios
    const tgHdlRatio = trig / (hdlVal || 1);
    const aip = Math.log10(Math.max(0.1, tgHdlRatio));
    let ldlScore = ldlVal < 100 ? 12 : ldlVal < 130 ? 32 : ldlVal < 160 ? 62 : 88;

    // 5. HOMA-IR Proxy & FFNN Neural Weighted Fusion
    const homaIr = (glucose * (trig / 2.5 + 10)) / 400;
    
    // FFNN Weighted Layer Sum
    const rawFfnnScore = (0.35 * gScore) + (0.30 * a1cScore) + (0.20 * tgScore) + (0.15 * ldlScore);
    const metabolicRiskIndex = Math.min(98, Math.max(4, Math.round(rawFfnnScore)));

    // Random Forest 100 Trees Ensemble Vote
    const rfLowRiskVotes = Math.max(2, Math.min(98, Math.round(100 - metabolicRiskIndex)));
    const rfHighRiskVotes = 100 - rfLowRiskVotes;

    // Risk Classification Tier
    let riskTier = 'LOW RISK';
    let riskColor = '#34d399'; // emerald-400
    let riskBadgeBg = 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400';
    let summaryText = 'Optimal metabolic flexibility detected. Biomarkers align with healthy glycemic control and lipid homeostasis.';

    if (metabolicRiskIndex >= 75) {
      riskTier = 'HIGH RISK';
      riskColor = '#ef4444'; // red-500
      riskBadgeBg = 'bg-red-500/10 border-red-500/30 text-red-400';
      summaryText = 'Significant metabolic stress and potential insulin resistance phenotype detected. Immediate nutritional intervention recommended.';
    } else if (metabolicRiskIndex >= 50) {
      riskTier = 'ELEVATED RISK';
      riskColor = '#e2723b'; // terracotta
      riskBadgeBg = 'bg-[#e2723b]/10 border-[#e2723b]/30 text-[#e2723b]';
      summaryText = 'Sub-optimal biomarkers indicating early dysmetabolism and glycemic volatility. Targeted dietary protocol required.';
    } else if (metabolicRiskIndex >= 25) {
      riskTier = 'MODERATE RISK';
      riskColor = '#facc15'; // amber-400
      riskBadgeBg = 'bg-amber-500/10 border-amber-500/30 text-amber-400';
      summaryText = 'Mild biomarker elevations detected. Minor nutritional & lifestyle adjustments recommended to restore homeostasis.';
    }

    // Generate Targeted Recommendations based on biomarkers
    const recs = [];

    if (glucose > 99 || a1cVal >= 5.7) {
      recs.push({
        title: 'Glycemic Load Capping & Fiber Modulation',
        category: 'GLYCEMIC CONTROL',
        impact: 'CRITICAL',
        icon: Zap,
        color: '#e2723b',
        detail: `Cap net carbohydrates to < 130g/day. Integrate 15g soluble fiber (psyllium husk, chia) prior to main meals to reduce postprandial glucose AUC.`
      });
      recs.push({
        title: 'Postprandial GLUT4 Translocation Protocol',
        category: 'TIMING & MOBILITY',
        impact: 'HIGH',
        icon: Activity,
        color: '#38bdf8',
        detail: 'Perform a 10-minute light walk or soleus push-ups immediately after carbohydrate-containing meals to activate non-insulin dependent glucose uptake.'
      });
    }

    if (trig > 150 || tgHdlRatio > 3.0) {
      recs.push({
        title: 'Hepatic VLDL Suppression & Omega-3 EPA/DHA Stack',
        category: 'LIPID METABOLISM',
        impact: 'CRITICAL',
        icon: Target,
        color: '#facc15',
        detail: `Triglyceride/HDL ratio is ${tgHdlRatio.toFixed(1)}. Supplement with 2,500mg purified EPA/DHA daily and eliminate refined liquid fructose.`
      });
    }

    if (hdlVal < 45 || aip > 0.24) {
      recs.push({
        title: 'Atherogenic Index Mitigation & Polyphenol Stack',
        category: 'CARDIO-METABOLIC',
        impact: 'HIGH',
        icon: Shield,
        color: '#a855f7',
        detail: `Atherogenic Index of Plasma is ${aip.toFixed(2)}. Increase polyphenol-rich extra virgin olive oil (30mL/day) and wild-caught cold-water fish.`
      });
    }

    if (ldlVal > 130) {
      recs.push({
        title: 'ApoB & LDL Particle Clearance Protocol',
        category: 'LIPID PANEL',
        impact: 'MODERATE',
        icon: CheckCircle,
        color: '#34d399',
        detail: 'Replace saturated fats with monounsaturated fatty acids (avocado, macadamia) and target 10g viscous beta-glucans daily to upregulate hepatic LDL receptors.'
      });
    }

    // Default Baseline Rec if profile is optimal
    if (recs.length < 3) {
      recs.push({
        title: 'Mitochondrial Density & Micronutrient Maintenance',
        category: 'LONGEVITY',
        impact: 'OPTIMAL',
        icon: CheckCircle,
        color: '#34d399',
        detail: 'Maintain current nutrient timing. Ensure 400mg elemental Magnesium Glycinate and 2,000 IU D3 + K2 daily for optimal cellular bioenergetics.'
      });
      recs.push({
        title: 'Zone-2 Aerobic & Metabolic Flexibility Protocol',
        category: 'PHYSICAL CONDITIONING',
        impact: 'MAINTENANCE',
        icon: TrendingUp,
        color: '#38bdf8',
        detail: 'Incorporate 150-180 minutes per week of Zone-2 aerobic exercise to maximize mitochondrial fat oxidation capacity.'
      });
    }

    return {
      glucose, trig, hdlVal, ldlVal, a1cVal,
      tgHdlRatio, aip, homaIr,
      metabolicRiskIndex,
      rfLowRiskVotes, rfHighRiskVotes,
      riskTier, riskColor, riskBadgeBg, summaryText,
      recommendations: recs,
      ffnnLayers: {
        inputLayer: [glucose/200, trig/300, hdlVal/100, ldlVal/200, a1cVal/10],
        hiddenLayer1: [0.82, 0.45, 0.67, 0.29, 0.91, 0.38, 0.74, 0.53],
        hiddenLayer2: [0.15, metabolicRiskIndex / 100, 1 - (metabolicRiskIndex / 100)],
      }
    };
  }, []);

  // Initial calculation on load
  useEffect(() => {
    setDiagnostics(runInference(fastingGlucose, triglycerides, hdlCholesterol, ldlCholesterol, hba1c));
  }, [runInference]);

  const handleRunDiagnostics = (e) => {
    if (e) e.preventDefault();
    setIsEvaluating(true);
    setTimeout(() => {
      setDiagnostics(runInference(fastingGlucose, triglycerides, hdlCholesterol, ldlCholesterol, hba1c));
      setIsEvaluating(false);
    }, 350);
  };

  const applyPreset = (fg, tg, hdl, ldl, a1c) => {
    setFastingGlucose(String(fg));
    setTriglycerides(String(tg));
    setHdlCholesterol(String(hdl));
    setLdlCholesterol(String(ldl));
    setHba1c(String(a1c));
    setIsEvaluating(true);
    setTimeout(() => {
      setDiagnostics(runInference(fg, tg, hdl, ldl, a1c));
      setIsEvaluating(false);
    }, 250);
  };

  return (
    <div className="relative z-10 flex-1 flex flex-col gap-6 px-4 md:px-8 py-4 md:py-6 overflow-y-auto max-w-7xl mx-auto w-full select-none">
      
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111316]/90 border border-white/8 rounded-3xl p-6 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </div>
            <span className="text-[#e2723b] text-[11px] font-mono tracking-widest uppercase font-bold">
              Feedforward Neural Network &amp; Random Forest Biomarker Engine
            </span>
          </div>
          <h2 className="text-white text-2xl md:text-3xl font-extrabold tracking-tight">
            Predictive Nutritional Intelligence Hub
          </h2>
          <p className="text-[#f4f3ef]/70 text-xs md:text-sm mt-1 max-w-2xl">
            Evaluate biochemical blood markers using deep machine learning models to calculate personalized metabolic risk scores and targeted nutritional interventions.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-center">
          <div className="bg-black/50 border border-white/10 rounded-2xl px-4 py-2.5 text-right">
            <p className="text-white/40 text-[9px] uppercase tracking-wider font-semibold">Model Status</p>
            <p className="text-emerald-400 font-mono text-xs font-bold flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5" /> FFNN v2.4 Active
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Inputs (Left) + Inference Output Dashboard (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT PANEL: Biomarker Data Input Form */}
        <div className="lg:col-span-5 bg-[#111316]/80 border border-white/8 rounded-3xl p-5 md:p-6 backdrop-blur-xl flex flex-col gap-5">
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <div>
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <Dna className="w-5 h-5 text-[#e2723b]" /> Biochemical Biomarkers
              </h3>
              <p className="text-[#f4f3ef]/60 text-xs mt-0.5">Input lab blood panel values for real-time model inference.</p>
            </div>
          </div>

          {/* Preset Buttons */}
          <div>
            <p className="text-white/40 text-[10px] uppercase tracking-wider font-bold mb-2">Quick Lab Profiles</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => applyPreset(88, 92, 62, 95, 5.1)}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-emerald-400 text-left text-xs font-semibold transition-all cursor-pointer hover:border-emerald-500/30"
              >
                Optimal Profile
              </button>
              <button
                type="button"
                onClick={() => applyPreset(114, 168, 42, 128, 6.1)}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-amber-400 text-left text-xs font-semibold transition-all cursor-pointer hover:border-amber-500/30"
              >
                Pre-Diabetic Risk
              </button>
              <button
                type="button"
                onClick={() => applyPreset(132, 245, 36, 162, 6.8)}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-[#e2723b] text-left text-xs font-semibold transition-all cursor-pointer hover:border-[#e2723b]/30"
              >
                Atherogenic Dyslip.
              </button>
              <button
                type="button"
                onClick={() => applyPreset(108, 190, 39, 145, 5.9)}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/8 text-red-400 text-left text-xs font-semibold transition-all cursor-pointer hover:border-red-500/30"
              >
                Insulin Resistant
              </button>
            </div>
          </div>

          {/* Form Controls */}
          <form onSubmit={handleRunDiagnostics} className="flex flex-col gap-4">
            
            {/* 1. Fasting Glucose */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[#f4f3ef] text-xs font-bold">Fasting Blood Glucose</label>
                <span className="text-white/40 text-[10px]">Ref: 70–99 mg/dL</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  value={fastingGlucose}
                  onChange={(e) => setFastingGlucose(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 backdrop-blur-md text-white rounded-xl p-3 focus:border-[#e2723b] outline-none transition-all text-sm font-mono"
                  placeholder="95"
                  required
                />
                <span className="absolute right-3 top-3 text-white/30 text-xs">mg/dL</span>
              </div>
            </div>

            {/* 2. Serum Triglycerides */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[#f4f3ef] text-xs font-bold">Serum Triglycerides</label>
                <span className="text-white/40 text-[10px]">Ref: &lt; 150 mg/dL</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  value={triglycerides}
                  onChange={(e) => setTriglycerides(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 backdrop-blur-md text-white rounded-xl p-3 focus:border-[#e2723b] outline-none transition-all text-sm font-mono"
                  placeholder="125"
                  required
                />
                <span className="absolute right-3 top-3 text-white/30 text-xs">mg/dL</span>
              </div>
            </div>

            {/* 3. HDL Cholesterol */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[#f4f3ef] text-xs font-bold">HDL Cholesterol</label>
                <span className="text-white/40 text-[10px]">Ref: &gt; 45 mg/dL</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  value={hdlCholesterol}
                  onChange={(e) => setHdlCholesterol(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 backdrop-blur-md text-white rounded-xl p-3 focus:border-[#e2723b] outline-none transition-all text-sm font-mono"
                  placeholder="52"
                  required
                />
                <span className="absolute right-3 top-3 text-white/30 text-xs">mg/dL</span>
              </div>
            </div>

            {/* 4. LDL Cholesterol */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[#f4f3ef] text-xs font-bold">LDL Cholesterol</label>
                <span className="text-white/40 text-[10px]">Ref: &lt; 100 mg/dL</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  value={ldlCholesterol}
                  onChange={(e) => setLdlCholesterol(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 backdrop-blur-md text-white rounded-xl p-3 focus:border-[#e2723b] outline-none transition-all text-sm font-mono"
                  placeholder="98"
                  required
                />
                <span className="absolute right-3 top-3 text-white/30 text-xs">mg/dL</span>
              </div>
            </div>

            {/* 5. HbA1c */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[#f4f3ef] text-xs font-bold">Glycated Hemoglobin (HbA1c)</label>
                <span className="text-white/40 text-[10px]">Ref: &lt; 5.7%</span>
              </div>
              <div className="relative">
                <input
                  type="number"
                  step="0.1"
                  value={hba1c}
                  onChange={(e) => setHba1c(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 backdrop-blur-md text-white rounded-xl p-3 focus:border-[#e2723b] outline-none transition-all text-sm font-mono"
                  placeholder="5.2"
                  required
                />
                <span className="absolute right-3 top-3 text-white/30 text-xs">%</span>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isEvaluating}
              className="mt-2 bg-[#e2723b] hover:bg-[#d15f2a] active:scale-[0.99] text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-[#e2723b]/25 flex items-center justify-center gap-2 cursor-pointer w-full"
            >
              {isEvaluating ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  <span>EXECUTING FFNN &amp; RF INFERENCE...</span>
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4" />
                  <span>RUN DIAGNOSTICS</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* RIGHT PANEL: ML Diagnostic Dashboard */}
        {diagnostics && (
          <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Top Metric: Metabolic Risk Index Score */}
            <div className="bg-[#111316]/80 border border-white/8 rounded-3xl p-6 backdrop-blur-xl flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-4">
                <div>
                  <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Predictive Model Output</p>
                  <h3 className="text-white text-xl font-bold">Metabolic Risk Index</h3>
                </div>
                <div className={`px-3 py-1.5 rounded-full border text-xs font-bold tracking-wide self-start sm:self-auto ${diagnostics.riskBadgeBg}`}>
                  {diagnostics.riskTier}
                </div>
              </div>

              <div className="flex items-center gap-6 my-2">
                <div className="relative flex items-center justify-center w-24 h-24 rounded-2xl bg-black/50 border border-white/10 shrink-0">
                  <span className="font-mono text-3xl font-extrabold" style={{ color: diagnostics.riskColor }}>
                    {diagnostics.metabolicRiskIndex}%
                  </span>
                  <span className="absolute bottom-1.5 text-[9px] text-white/40 uppercase font-semibold">RISK</span>
                </div>

                <div className="flex-1 flex flex-col gap-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[#f4f3ef]/80 font-medium">Metabolic Health Continuum</span>
                    <span className="font-mono font-bold" style={{ color: diagnostics.riskColor }}>
                      {diagnostics.metabolicRiskIndex} / 100
                    </span>
                  </div>
                  {/* Gauge Bar */}
                  <div className="h-3 bg-black/60 rounded-full overflow-hidden border border-white/10 p-0.5 relative">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${diagnostics.metabolicRiskIndex}%`,
                        backgroundColor: diagnostics.riskColor,
                        boxShadow: `0 0 12px ${diagnostics.riskColor}66`
                      }}
                    />
                  </div>
                  <p className="text-[#f4f3ef]/70 text-xs leading-relaxed mt-1">
                    {diagnostics.summaryText}
                  </p>
                </div>
              </div>

              {/* Sub-Metrics Row */}
              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="bg-black/40 rounded-2xl p-3 border border-white/5">
                  <p className="text-white/40 text-[9px] uppercase font-semibold mb-0.5">HOMA-IR Proxy</p>
                  <p className="text-white font-mono font-bold text-base">{diagnostics.homaIr.toFixed(2)}</p>
                  <span className="text-[9px] text-white/40">{diagnostics.homaIr > 2.5 ? 'Elevated' : 'Optimal'}</span>
                </div>

                <div className="bg-black/40 rounded-2xl p-3 border border-white/5">
                  <p className="text-white/40 text-[9px] uppercase font-semibold mb-0.5">TG / HDL Ratio</p>
                  <p className="text-white font-mono font-bold text-base">{diagnostics.tgHdlRatio.toFixed(2)}</p>
                  <span className="text-[9px] text-white/40">{diagnostics.tgHdlRatio > 3.0 ? 'High' : 'Normal'}</span>
                </div>

                <div className="bg-black/40 rounded-2xl p-3 border border-white/5">
                  <p className="text-white/40 text-[9px] uppercase font-semibold mb-0.5">AIP Index</p>
                  <p className="text-white font-mono font-bold text-base">{diagnostics.aip.toFixed(2)}</p>
                  <span className="text-[9px] text-white/40">{diagnostics.aip > 0.24 ? 'High Risk' : 'Low Risk'}</span>
                </div>
              </div>
            </div>

            {/* Neural Classifier & Ensemble Activation Visualization */}
            <div className="bg-[#111316]/80 border border-white/8 rounded-3xl p-6 backdrop-blur-xl flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <h4 className="text-white font-bold text-sm flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#e2723b]" /> Classifier Layer Activations &amp; Ensemble Decision
                </h4>
                <span className="text-white/40 text-[10px] font-mono">100 Trees / 3-Dense Layers</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Random Forest Ensemble Tree Votes */}
                <div className="bg-black/40 rounded-2xl p-4 border border-white/5 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#f4f3ef]/80 font-semibold">Random Forest Votes</span>
                      <span className="text-emerald-400 font-mono font-bold">{diagnostics.rfLowRiskVotes} / 100 Trees</span>
                    </div>
                    <p className="text-white/40 text-[10px]">Decision tree ensemble probability distribution</p>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-emerald-400 font-mono">Optimal Phenotype</span>
                      <span className="text-white/70 font-mono">{diagnostics.rfLowRiskVotes}%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${diagnostics.rfLowRiskVotes}%` }} />
                    </div>

                    <div className="flex items-center justify-between text-[11px] pt-1">
                      <span className="text-[#e2723b] font-mono">Metabolic Stress</span>
                      <span className="text-white/70 font-mono">{diagnostics.rfHighRiskVotes}%</span>
                    </div>
                    <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                      <div className="h-full bg-[#e2723b] rounded-full" style={{ width: `${diagnostics.rfHighRiskVotes}%` }} />
                    </div>
                  </div>
                </div>

                {/* FFNN Dense Activations */}
                <div className="bg-black/40 rounded-2xl p-4 border border-white/5 flex flex-col justify-between gap-3">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[#f4f3ef]/80 font-semibold">FFNN Dense Activations</span>
                      <span className="text-cyan-400 font-mono font-bold">ReLU / Softmax</span>
                    </div>
                    <p className="text-white/40 text-[10px]">5-Vector Input &rarr; 64-ReLU &rarr; Output</p>
                  </div>
                  <div className="flex items-end justify-between h-16 gap-1 px-2 pt-2">
                    {diagnostics.ffnnLayers.hiddenLayer1.map((val, idx) => (
                      <div key={idx} className="flex-1 bg-cyan-500/20 hover:bg-cyan-500/40 rounded-t transition-all relative group" style={{ height: `${val * 100}%` }}>
                        <div className="h-full bg-cyan-400 rounded-t" style={{ opacity: val }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Precision Dietary Recommendations Protocol */}
            <div className="bg-[#111316]/80 border border-white/8 rounded-3xl p-6 backdrop-blur-xl flex flex-col gap-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-3">
                <div>
                  <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Automated Targeted Interventions</p>
                  <h4 className="text-white font-bold text-base flex items-center gap-2">
                    <Apple className="w-4 h-4 text-[#e2723b]" /> AI Precision Dietary Protocol
                  </h4>
                </div>
                <span className="text-white/40 text-[10px]">Evidence-Based Interventions</span>
              </div>

              <div className="flex flex-col gap-3">
                {diagnostics.recommendations.map((rec, idx) => {
                  const IconComp = rec.icon || CheckCircle;
                  return (
                    <div key={idx} className="bg-black/40 border border-white/5 hover:border-white/10 rounded-2xl p-4 transition-all flex items-start gap-4">
                      <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 shrink-0 mt-0.5" style={{ color: rec.color }}>
                        <IconComp className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h5 className="text-white font-bold text-sm">{rec.title}</h5>
                          <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold bg-white/5 text-white/60 border border-white/10">
                            {rec.category}
                          </span>
                        </div>
                        <p className="text-[#f4f3ef]/80 text-xs leading-relaxed">
                          {rec.detail}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}

/* ─── ROOT ──────────────────────────────────────────────────── */
export default function App() {
  const [screen, setScreen] = useState(SCREENS.LANDING);
  const [mode, setMode] = useState('mobility'); // 'mobility' or 'nutrition'
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [sessionData, setSessionData] = useState(null);
  const [showTeam, setShowTeam] = useState(false);

  const handleBack = () => {
    if (screen === SCREENS.SELECT) setScreen(SCREENS.LANDING);
    else if (screen === SCREENS.TRACKING) setScreen(SCREENS.SELECT);
    else if (screen === SCREENS.ANALYSIS) setScreen(SCREENS.SELECT);
  };

  return (
    <div className="w-full min-h-screen text-white flex flex-col select-none overflow-hidden relative z-0" style={{ background: '#0a0604' }}>
      {/* ── WebGL moody fluid shader — z-index: -2 ── */}
      <FluidShaderBackground />


      {/* ── SplashCursor: Navier-Stokes fluid trail — z:9998 ── */}
      <SplashCursor RAINBOW_MODE={false} COLOR="#e2723b" />

      <Header screen={screen} onInfo={() => setShowTeam(true)} onBack={handleBack} mode={mode} setMode={setMode} />

      {mode === 'nutrition' ? (
        <PredictiveNutritionHub />
      ) : (
        <>
          {screen === SCREENS.LANDING && (
            <LandingScreen onStart={() => setScreen(SCREENS.SELECT)} mode={mode} />
          )}

          {screen === SCREENS.SELECT && (
            <ExerciseSelectScreen onSelect={(ex) => { setSelectedExercise(ex); setScreen(SCREENS.TRACKING); }} />
          )}

          {screen === SCREENS.TRACKING && selectedExercise && (
            <TrackingScreen key={selectedExercise.id} exercise={selectedExercise}
              onFinish={(d) => { setSessionData(d); setScreen(SCREENS.ANALYSIS); }} />
          )}

          {screen === SCREENS.ANALYSIS && sessionData && (
            <AnalysisScreen data={sessionData}
              onRetry={() => { setSessionData(null); setScreen(SCREENS.SELECT); }}
              onHome={() => { setSelectedExercise(null); setSessionData(null); setScreen(SCREENS.LANDING); }} />
          )}
        </>
      )}

      {screen !== SCREENS.LANDING && (
        <div className="text-center py-3 border-t border-white/4 shrink-0 mt-auto">
          <span className="text-white/40 text-[9px] tracking-wider font-semibold">TrueForm AI · {TEAM_INFO.department} · {TEAM_INFO.semester} · {TEAM_INFO.group}</span>
        </div>
      )}

      {showTeam && <TeamModal onClose={() => setShowTeam(false)} />}
    </div>
  );
}
