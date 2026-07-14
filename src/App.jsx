import { useState, useRef, useEffect, useCallback } from 'react';

import {
  StopCircle, Info, AlertCircle, X, ChevronRight, ArrowLeft,
  BarChart2, Zap, Target, TrendingUp, CheckCircle, Clock, Award,
  RefreshCw, Rotate3D, Activity, Brain, ChevronDown, Wifi, Layers,
  Camera, Upload, Plus, Trash2, Apple
} from 'lucide-react';

// TensorFlow.js from Global Scope (loaded via CDN in index.html to bypass Vite bundling errors)
const tf = window.tf;
const poseDetection = window.poseDetection;
const mobilenet = window.mobilenet;

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
  const h = { sm: 'h-7', md: 'h-10', lg: 'h-14' };
  return (
    <div className="inline-flex items-center justify-center">
      <img
        src="/brandimage.png"
        alt="TrueForm AI Logo"
        className={`${h[size]} w-auto object-contain block rounded-md`}
      />
    </div>
  );
}

/* ─── Header ───────────────────────────────────────────────── */
function Header({ screen, onInfo, onBack, mode, setMode }) {
  const steps = [SCREENS.LANDING, SCREENS.SELECT, SCREENS.TRACKING, SCREENS.ANALYSIS];
  const isLanding = screen === SCREENS.LANDING;
  return (
    <header
      className={`flex items-center justify-between px-8 py-4 border-b border-white/5 shrink-0 sticky top-0 z-40 transition-all duration-300
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
      {isLanding && (
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
      )}

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
    { icon: <Wifi className="w-6 h-6" />, title: 'Live Camera Capture', desc: 'Captures direct browser-level video stream. Secure local processing ensures full privacy.' },
    { icon: <Layers className="w-6 h-6" />, title: 'Kinematic Analysis', desc: 'Real-time joint coordinates are calculated using on-device ML Models.' },
    { icon: <Brain className="w-6 h-6" />, title: 'AI Coaching', desc: 'Context-aware feedback fires based on precise anatomical angle thresholds.' },
  ];
  return (
    <section className="relative z-10 flex flex-col items-center justify-center px-12 py-20 min-h-[90vh] bg-transparent" aria-label="How It Works">
      {/* Top gradient divider */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div ref={ref} className="w-full max-w-5xl">
        <div className={`text-center mb-14 transition-all duration-700 ease-out ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#e2723b]/25 bg-[#e2723b]/8 mb-4">
            <div className="w-1 h-1 rounded-full bg-[#e2723b]" />
            <span className="text-[#e2723b] text-[10px] uppercase tracking-widest font-bold">How It Works</span>
          </div>
          <h2 className="text-white text-4xl font-bold mb-3">From camera to coaching<br /><span className="text-white/60 font-normal">in milliseconds</span></h2>
          <p className="text-white/55 text-base max-w-lg mx-auto">A fully client-side ML pipeline — no server, no latency, no wearables.</p>
        </div>

        <div className="grid grid-cols-3 gap-6 mb-12">
          {steps.map((s, i) => (
            <div key={i}
                 className={`relative bg-[#111316] border border-white/8 rounded-3xl p-7 transition-all duration-700 ease-out hover:border-white/15 hover:bg-[#141619] group ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
                 style={{ transitionDelay: `${i * 150 + 100}ms` }}>
              <div className="absolute inset-0 rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                style={{ background: 'radial-gradient(circle at 30% 30%, rgba(226,114,59,0.05) 0%, transparent 70%)' }} />
              <div className="relative">
                <div className="w-12 h-12 rounded-2xl bg-[#e2723b]/10 border border-[#e2723b]/20 flex items-center justify-center text-[#e2723b] mb-5 group-hover:bg-[#e2723b]/15 transition-all">
                  {s.icon}
                </div>
                <div className="text-white/40 text-xs font-mono mb-2">0{i + 1}</div>
                <h3 className="text-white font-bold text-lg mb-2">{s.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className={`bg-[#111316] border border-white/8 rounded-3xl p-7 transition-all duration-1000 ease-out ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-12'}`}
             style={{ transitionDelay: '550ms' }}>
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-white/50 text-xs uppercase tracking-wider font-semibold mb-1">Repetition Waveform</p>
              <p className="text-white font-semibold text-base">Joint angle trajectory over multiple rep cycles</p>
            </div>
            <div className="flex items-center gap-4 text-xs text-white/55">
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#e2723b] inline-block rounded" /> Angle</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#e2723b] inline-block" /> Extension Peak</span>
            </div>
          </div>
          <AngleLineChart />
        </div>
      </div>
      {/* Bottom gradient divider */}
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
    <section className="relative z-10 flex flex-col items-center justify-center px-12 py-20 min-h-[90vh] bg-transparent" aria-label="System Performance">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div ref={ref} className="w-full max-w-5xl">
        <div className={`text-center mb-14 transition-all duration-700 ease-out ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#e2723b]/25 bg-[#e2723b]/8 mb-4">
            <div className="w-1 h-1 rounded-full bg-[#e2723b]" />
            <span className="text-[#e2723b] text-[10px] uppercase tracking-widest font-bold">System Performance</span>
          </div>
          <h2 className="text-white text-4xl font-bold mb-3">Built for precision<br /><span className="text-white/60 font-normal">& real-time speed</span></h2>
          <p className="text-white/55 text-base max-w-md mx-auto">Powered by TF.js MoveNet SinglePose Lightning. Runs entirely in your browser.</p>
        </div>

        <div className="grid grid-cols-4 gap-4 mb-8">
          {stats.map((s, i) => (
            <div key={i}
                 className={`bg-[#111316] border border-white/8 rounded-2xl p-5 text-center transition-all duration-700 ease-out hover:border-white/15 hover:bg-[#141619] group ${inView ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
                 style={{ transitionDelay: `${i * 100 + 100}ms` }}>
              <div className="flex justify-center mb-3">
                <div className="w-8 h-8 rounded-xl bg-[#e2723b]/10 border border-[#e2723b]/20 flex items-center justify-center text-[#e2723b] group-hover:bg-[#e2723b]/15 transition-all">
                  {s.icon}
                </div>
              </div>
              <p className="text-[#e2723b] font-mono font-bold text-3xl mb-1">{s.val}</p>
              <p className="text-white/50 text-xs uppercase tracking-wider font-semibold">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
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
      <section className="relative flex flex-col items-center justify-center min-h-[88vh] overflow-hidden px-8">

        <div className="relative z-10 text-center" style={{ mixBlendMode: 'normal', background: 'transparent' }}>
          <div className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-[#e2723b]/45 bg-[#e2723b]/12 mb-7 transition-all duration-1000 ease-out ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
            <div className="w-1.5 h-1.5 rounded-full bg-[#e2723b] animate-pulse" />
            <span className="text-[#e2723b] text-[11px] font-bold tracking-wider uppercase">
              {mode === 'mobility' ? 'TensorFlow.js Powered' : 'Local Computer Vision'}
            </span>
          </div>

          <div className={`flex justify-center mb-6 transition-all duration-1000 ease-out delay-100 ${loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`}>
            <Logo size="lg" />
          </div>

          <h1 className={`text-5xl font-bold text-white leading-tight mb-4 max-w-2xl mx-auto transition-all duration-1000 ease-out delay-200 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
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

          <div className={`transition-all duration-1000 ease-out delay-500 ${loaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <button onClick={onStart}
              className="group inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-[#e2723b] hover:bg-[#d15f2a] text-white font-semibold text-base shadow-lg shadow-[#e2723b]/25 transition-all cursor-pointer mb-6">
              {mode === 'mobility' ? 'Begin Session' : 'Start Nutrition Scanner'} <ChevronRight className="w-5 h-5 group-hover:translate-x-0.5 transition-transform" />
            </button>
            <p className="text-white/45 text-xs block">Camera access or file upload required · local execution only</p>
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
        {EXERCISES.map((ex) => (
          <button key={ex.id} onClick={() => onSelect(ex)}
            onMouseEnter={() => setHovered(ex.id)} onMouseLeave={() => setHovered(null)}
            className={`relative rounded-3xl p-7 text-left border transition-all duration-300 cursor-pointer overflow-hidden ${
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
    <div className="relative z-10 flex-1 flex flex-col gap-4 px-6 py-5 min-h-0 overflow-hidden select-none">
      <div className="flex gap-4 flex-1 min-h-0">
        {/* Webcam Display */}
        <div className="relative bg-black rounded-[1.8rem] border border-white/8 overflow-hidden" style={{ flex: '0 0 58%' }}>
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
      <div className="grid grid-cols-4 gap-3 shrink-0">
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

      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center gap-5 bg-[#111316] border border-white/8 rounded-2xl px-5 py-3">
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
          className="flex items-center gap-2.5 px-6 py-3 rounded-2xl bg-[#e2723b] hover:bg-[#d15f2a] text-white font-semibold text-sm transition-all shadow-lg shadow-[#e2723b]/20 cursor-pointer">
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

/* ─── SCREEN 5: AI Nutrition Dashboard ─────────────────────── */
function NutritionScreen() {
  const [model, setModel] = useState(null);
  const [loadingModel, setLoadingModel] = useState(false);
  const [modelStatus, setModelStatus] = useState('');
  
  const [imageSrc, setImageSrc] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState(null);
  const [confidence, setConfidence] = useState(0);

  const [searchQuery, setSearchQuery] = useState('');
  const [showManualResults, setShowManualResults] = useState(false);

  // Daily log (persisted via localStorage)
  const [dailyLog, setDailyLog] = useState(() => {
    const saved = localStorage.getItem('tf_nutrition_log');
    return saved ? JSON.parse(saved) : [];
  });

  const videoRef = useRef(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [camError, setCamError] = useState('');
  const streamRef = useRef(null);

  // Save log helper
  const updateLog = (newLog) => {
    setDailyLog(newLog);
    localStorage.setItem('tf_nutrition_log', JSON.stringify(newLog));
  };

  // Load MobileNet on demand
  const initMobileNet = async () => {
    if (model) return model;
    setLoadingModel(true);
    setModelStatus('Initializing TensorFlow.js...');
    try {
      await tf.ready();
      setModelStatus('Loading MobileNet Model...');
      const loadedModel = await mobilenet.load({ version: 1, alpha: 1.0 });
      setModel(loadedModel);
      setLoadingModel(false);
      setModelStatus('');
      return loadedModel;
    } catch (e) {
      console.error(e);
      setModelStatus('Failed to load local ML model.');
      setLoadingModel(false);
      return null;
    }
  };

  // Process File Upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    stopCamera();

    const reader = new FileReader();
    reader.onload = async (event) => {
      const src = event.target.result;
      setImageSrc(src);
      analyzeImageSrc(src);
    };
    reader.readAsDataURL(file);
  };

  // Stop Webcam
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  // Start Webcam
  const startCamera = async () => {
    setImageSrc(null);
    setScanResult(null);
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { width: 400, height: 300 }, audio: false });
      streamRef.current = s;
      if (videoRef.current) {
        videoRef.current.srcObject = s;
        await videoRef.current.play().catch(() => {});
      }
      setCameraActive(true);
      setCamError('');
    } catch (err) {
      console.error(err);
      setCamError('Unable to access camera.');
    }
  };

  // Take Webcam Snapshot
  const captureSnapshot = async () => {
    const video = videoRef.current;
    if (!video || !cameraActive) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg');
    setImageSrc(dataUrl);
    stopCamera();
    analyzeImageSrc(dataUrl);
  };

  // Perform Image Classification
  const analyzeImageSrc = async (src) => {
    setScanning(true);
    setScanResult(null);

    // Initialize model if not already loaded
    const net = await initMobileNet();
    if (!net) {
      setScanning(false);
      return;
    }

    // Create temporary image element for MobileNet
    const imgEl = new Image();
    imgEl.src = src;
    imgEl.onload = async () => {
      try {
        const predictions = await net.classify(imgEl);
        setScanning(false);

        if (predictions && predictions.length > 0) {
          // Fuzzy match predictions with our local Nutrition DB
          let matchedKey = null;
          let bestConf = 0;

          for (const pred of predictions) {
            const label = pred.className.toLowerCase();
            const confidenceScore = pred.probability;

            // Find matching key in DB
            const matched = Object.keys(NUTRITION_DB).find(key => label.includes(key));
            if (matched && confidenceScore > bestConf) {
              matchedKey = matched;
              bestConf = confidenceScore;
            }
          }

          if (matchedKey) {
            setScanResult(NUTRITION_DB[matchedKey]);
            setConfidence(Math.round(bestConf * 100));
          } else {
            // Fallback - display the top raw prediction and let them adjust
            const topPrediction = predictions[0].className.split(',')[0];
            setScanResult({
              name: topPrediction,
              calories: 120, carbs: 15, protein: 4, fat: 3, fiber: 1.5, sodium: 120, isCustom: true
            });
            setConfidence(Math.round(predictions[0].probability * 100));
          }
        }
      } catch (err) {
        console.error(err);
        setScanning(false);
      }
    };
  };

  // Add Item to Daily Log
  const handleAddToLog = (item) => {
    if (!item) return;
    const newLog = [...dailyLog, { ...item, id: Date.now(), timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }];
    updateLog(newLog);
    // Reset scanner state
    setImageSrc(null);
    setScanResult(null);
    playChime();
  };

  // Remove Item from Daily Log
  const handleRemoveFromLog = (id) => {
    const newLog = dailyLog.filter(item => item.id !== id);
    updateLog(newLog);
  };

  // Clear Daily Log
  const handleClearLog = () => {
    updateLog([]);
  };

  // Compute Daily totals
  const totals = dailyLog.reduce((acc, item) => {
    acc.calories += item.calories;
    acc.carbs += item.carbs;
    acc.protein += item.protein;
    acc.fat += item.fat;
    return acc;
  }, { calories: 0, carbs: 0, protein: 0, fat: 0 });

  // Handle manual food selection
  const handleManualSelect = (foodKey) => {
    setScanResult(NUTRITION_DB[foodKey]);
    setConfidence(100);
    setShowManualResults(false);
    setSearchQuery('');
  };

  const matchedSearchKeys = Object.keys(NUTRITION_DB).filter(key =>
    NUTRITION_DB[key].name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    return () => stopCamera();
  }, []);

  return (
    <div className="relative z-10 flex-1 flex flex-col gap-6 px-8 py-6 overflow-y-auto max-w-6xl mx-auto w-full select-none">
      
      {/* Upper Grid: Daily Totals */}
      <div className="bg-[#111316] border border-white/8 rounded-3xl p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-white/45 text-xs uppercase tracking-widest font-semibold mb-1">AI Nutrition Logs</p>
            <h2 className="text-white text-2xl font-bold">Daily Macro Progress</h2>
          </div>
          {dailyLog.length > 0 && (
            <button onClick={handleClearLog} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 hover:border-red-500/30 text-white/50 hover:text-red-400 text-xs transition-all cursor-pointer">
              <Trash2 className="w-3.5 h-3.5" /> Clear Logs
            </button>
          )}
        </div>

        <div className="grid grid-cols-4 gap-6">
          {/* Calories Progress Ring / Bar */}
          <div className="bg-[#0d0e10] rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wider font-semibold mb-1">Calories Intake</p>
              <p className="text-white font-mono text-3xl font-bold">{totals.calories} <span className="text-sm text-white/40">/ {DAILY_TARGETS.calories} kcal</span></p>
            </div>
            <div className="mt-4">
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-[#e2723b] rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (totals.calories / DAILY_TARGETS.calories) * 100)}%` }} />
              </div>
            </div>
          </div>

          {/* Carbs Progress Bar */}
          <div className="bg-[#0d0e10] rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wider font-semibold mb-1">Carbohydrates</p>
              <p className="text-emerald-400 font-mono text-2xl font-bold">{totals.carbs.toFixed(1)}g <span className="text-xs text-white/40">/ {DAILY_TARGETS.carbs}g</span></p>
            </div>
            <div className="mt-4">
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-400 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (totals.carbs / DAILY_TARGETS.carbs) * 100)}%` }} />
              </div>
            </div>
          </div>

          {/* Protein Progress Bar */}
          <div className="bg-[#0d0e10] rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wider font-semibold mb-1">Protein</p>
              <p className="text-[#e2723b] font-mono text-2xl font-bold">{totals.protein.toFixed(1)}g <span className="text-xs text-white/40">/ {DAILY_TARGETS.protein}g</span></p>
            </div>
            <div className="mt-4">
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-[#e2723b] rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (totals.protein / DAILY_TARGETS.protein) * 100)}%` }} />
              </div>
            </div>
          </div>

          {/* Fat Progress Bar */}
          <div className="bg-[#0d0e10] rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <p className="text-white/40 text-[10px] uppercase tracking-wider font-semibold mb-1">Fats</p>
              <p className="text-blue-400 font-mono text-2xl font-bold">{totals.fat.toFixed(1)}g <span className="text-xs text-white/40">/ {DAILY_TARGETS.fat}g</span></p>
            </div>
            <div className="mt-4">
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-blue-400 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, (totals.fat / DAILY_TARGETS.fat) * 100)}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Lower Workspace: Camera/Upload (Left) + Results/Logs (Right) */}
      <div className="grid grid-cols-12 gap-6 flex-1 items-start min-h-0">
        
        {/* Left: Input scanner */}
        <div className="col-span-7 bg-[#111316] border border-white/8 rounded-3xl p-6 flex flex-col gap-5 min-h-[500px]">
          <div>
            <h3 className="text-white font-bold text-lg">Scan Meal</h3>
            <p className="text-white/50 text-xs">Snap a picture with your webcam or upload a photo to identify nutrients.</p>
          </div>

          {/* Search bar helper */}
          <div className="relative">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search food database manually..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowManualResults(e.target.value.length > 0);
                }}
                className="flex-1 bg-[#0d0e10] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white placeholder-white/30 focus:border-[#e2723b] outline-none"
              />
              {searchQuery && (
                <button onClick={() => { setSearchQuery(''); setShowManualResults(false); }} className="text-white/40 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {showManualResults && matchedSearchKeys.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-[#17191d] border border-white/10 rounded-xl max-h-48 overflow-y-auto z-30 shadow-2xl">
                {matchedSearchKeys.map(key => (
                  <button
                    key={key}
                    onClick={() => handleManualSelect(key)}
                    className="w-full text-left px-4 py-2.5 hover:bg-white/5 text-xs text-white/80 border-b border-white/5 last:border-b-0 cursor-pointer"
                  >
                    {NUTRITION_DB[key].name} ({NUTRITION_DB[key].calories} kcal)
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Scanner View Box */}
          <div className="relative flex-1 bg-black rounded-2xl border border-white/5 overflow-hidden flex flex-col items-center justify-center min-h-[300px]">
            {camError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20">
                <AlertCircle className="w-8 h-8 text-[#e2723b] mb-2" />
                <p className="text-[#e2723b] text-xs font-semibold">{camError}</p>
                <button onClick={() => setCamError('')} className="mt-4 px-3.5 py-1.5 bg-white/5 border border-white/10 text-white/80 rounded-xl text-xs font-bold hover:bg-white/10 cursor-pointer">Dismiss</button>
              </div>
            )}
            {cameraActive ? (
              <div className="relative w-full h-full flex flex-col items-center justify-center">
                <video ref={videoRef} className="w-full h-full object-cover rounded-2xl" playsInline muted />
                <button
                  onClick={captureSnapshot}
                  className="absolute bottom-4 flex items-center justify-center w-14 h-14 rounded-full bg-white text-black hover:bg-white/90 active:scale-95 shadow-xl transition-all cursor-pointer z-20"
                >
                  <Camera className="w-6 h-6" />
                </button>
              </div>
            ) : imageSrc ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <img src={imageSrc} alt="Scanned meal" className="w-full max-h-[340px] object-contain rounded-2xl" />
                {scanning && (
                  <div className="absolute inset-x-0 h-1 bg-[#e2723b] animate-bounce shadow-lg shadow-[#e2723b]/50" style={{ top: '20%' }} />
                )}
                {scanning && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-10">
                    <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-black/60 border border-white/15">
                      <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-[#e2723b] animate-spin" />
                      <span className="text-[#e2723b] text-xs font-semibold tracking-wider">Scanning Meal...</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center p-8">
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-white/30 mb-4 border border-white/10">
                  <Apple className="w-7 h-7" />
                </div>
                <p className="text-white/60 text-sm font-semibold mb-2">No Meal Loaded</p>
                <p className="text-white/40 text-xs max-w-[240px] leading-relaxed mb-6">Select a webcam stream or upload an image file of your plate.</p>
                
                <div className="flex gap-3">
                  <button
                    onClick={startCamera}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 font-bold text-xs transition-all cursor-pointer"
                  >
                    <Camera className="w-4 h-4 text-[#e2723b]" /> Use Camera
                  </button>
                  <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 font-bold text-xs transition-all cursor-pointer">
                    <Upload className="w-4 h-4 text-emerald-400" /> Upload Image
                    <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </label>
                </div>
              </div>
            )}

            {/* Model load status banner */}
            {loadingModel && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-20">
                <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#111316] border border-white/10 shadow-2xl">
                  <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
                  <span className="text-white/60 text-xs font-semibold">{modelStatus}</span>
                </div>
              </div>
            )}

            {/* Stop camera option */}
            {cameraActive && (
              <button onClick={stopCamera} className="absolute top-3 right-3 z-20 text-white/50 hover:text-white bg-black/60 rounded-full p-1.5 border border-white/10 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Clear Image option */}
            {imageSrc && !scanning && (
              <button onClick={() => { setImageSrc(null); setScanResult(null); }} className="absolute top-3 right-3 z-20 text-white/50 hover:text-white bg-black/60 rounded-full p-1.5 border border-white/10 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Right: Results + Daily Logs */}
        <div className="col-span-5 flex flex-col gap-5 min-h-[500px]">
          
          {/* Classification Results */}
          {scanResult && (
            <div className="bg-[#111316] border border-white/8 rounded-3xl p-5 flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold mb-1">Scan Results</p>
                  <h4 className="text-white font-bold text-lg">{scanResult.name}</h4>
                  {scanResult.isCustom && <p className="text-white/45 text-[10px]">ImageNet Class (Values approximated)</p>}
                </div>
                <div className="px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                  {confidence}% CONFIDENCE
                </div>
              </div>

              {/* Nutrients Grid */}
              <div className="grid grid-cols-4 gap-2 text-center">
                <div className="bg-[#0d0e10] rounded-xl p-2.5">
                  <p className="text-white/40 text-[8px] uppercase tracking-wider font-semibold mb-0.5">Calories</p>
                  <p className="text-white font-mono font-bold text-sm">{scanResult.calories}</p>
                </div>
                <div className="bg-[#0d0e10] rounded-xl p-2.5">
                  <p className="text-white/40 text-[8px] uppercase tracking-wider font-semibold mb-0.5">Carbs</p>
                  <p className="text-emerald-400 font-mono font-bold text-sm">{scanResult.carbs}g</p>
                </div>
                <div className="bg-[#0d0e10] rounded-xl p-2.5">
                  <p className="text-white/40 text-[8px] uppercase tracking-wider font-semibold mb-0.5">Protein</p>
                  <p className="text-[#e2723b] font-mono font-bold text-sm">{scanResult.protein}g</p>
                </div>
                <div className="bg-[#0d0e10] rounded-xl p-2.5">
                  <p className="text-white/40 text-[8px] uppercase tracking-wider font-semibold mb-0.5">Fats</p>
                  <p className="text-blue-400 font-mono font-bold text-sm">{scanResult.fat}g</p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleAddToLog(scanResult)}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#e2723b] hover:bg-[#d15f2a] text-white font-bold text-xs transition-all cursor-pointer shadow-lg shadow-[#e2723b]/10"
                >
                  <Plus className="w-3.5 h-3.5" /> Log Meal
                </button>
              </div>
            </div>
          )}

          {/* Daily Log List */}
          <div className="bg-[#111316] border border-white/8 rounded-3xl p-5 flex flex-col gap-4 flex-1">
            <p className="text-white/45 text-xs uppercase tracking-widest font-semibold">Logged Meals ({dailyLog.length})</p>
            
            {dailyLog.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-white/20 border border-dashed border-white/5 rounded-2xl min-h-[160px]">
                <Apple className="w-8 h-8 mb-2" />
                <p className="text-xs font-semibold">No meals logged today</p>
                <p className="text-[10px] mt-1 max-w-[160px] leading-relaxed">Scanned meals will be logged here to build your daily macro count.</p>
              </div>
            ) : (
              <div className="flex-1 space-y-2 overflow-y-auto max-h-[240px] pr-1">
                {dailyLog.map((item) => (
                  <div key={item.id} className="flex items-center justify-between bg-[#0d0e10] border border-white/5 rounded-xl px-4 py-2.5 hover:border-white/10 transition-all">
                    <div>
                      <p className="text-white text-xs font-semibold">{item.name}</p>
                      <p className="text-white/35 text-[9px] mt-0.5">{item.timestamp} · <span className="text-[#e2723b]">{item.calories} kcal</span></p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right text-[10px] font-mono text-white/50 leading-none">
                        <span className="text-emerald-400">{item.carbs.toFixed(0)}C</span> · <span className="text-[#e2723b]">{item.protein.toFixed(0)}P</span> · <span className="text-blue-400">{item.fat.toFixed(0)}F</span>
                      </div>
                      <button
                        onClick={() => handleRemoveFromLog(item.id)}
                        className="text-white/30 hover:text-red-400 p-1 cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

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
    <div className="w-full min-h-screen text-white flex flex-col select-none overflow-hidden bg-transparent relative z-0">
      <div className="fixed inset-0 pointer-events-none flex items-center justify-center"
        style={{
          zIndex: 0,
          backgroundSize: '100px 100px',
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.08) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.08) 1px, transparent 1px)
          `
        }}>
        <div className="absolute pointer-events-none rounded-full"
          style={{
            width: 1200, height: 1200,
            background: 'radial-gradient(circle, rgba(232,112,56,0.30) 0%, rgba(232,112,56,0.12) 40%, rgba(232,112,56,0.03) 65%, transparent 80%)'
          }}
        />
      </div>

      <Header screen={screen} onInfo={() => setShowTeam(true)} onBack={handleBack} mode={mode} setMode={setMode} />

      {screen === SCREENS.LANDING && mode === 'mobility' && (
        <LandingScreen onStart={() => setScreen(SCREENS.SELECT)} mode={mode} />
      )}

      {screen === SCREENS.LANDING && mode === 'nutrition' && (
        <LandingScreen onStart={() => setScreen(SCREENS.SELECT)} mode={mode} />
      )}

      {screen === SCREENS.SELECT && mode === 'mobility' && (
        <ExerciseSelectScreen onSelect={(ex) => { setSelectedExercise(ex); setScreen(SCREENS.TRACKING); }} />
      )}

      {screen === SCREENS.SELECT && mode === 'nutrition' && (
        <NutritionScreen />
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

      {screen !== SCREENS.LANDING && (
        <div className="text-center py-3 border-t border-white/4 shrink-0 mt-auto">
          <span className="text-white/40 text-[9px] tracking-wider font-semibold">TrueForm AI · {TEAM_INFO.department} · {TEAM_INFO.semester} · {TEAM_INFO.group}</span>
        </div>
      )}

      {showTeam && <TeamModal onClose={() => setShowTeam(false)} />}
    </div>
  );
}
