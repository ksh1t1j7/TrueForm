import React, { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Activity, ShieldCheck, Cpu, Layers, Sparkles, ChevronDown } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

const TOTAL_FRAMES = 240;
const BASE_PATH = import.meta.env.BASE_URL || '/';

export default function ScrollVideo3D() {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const imagesRef = useRef([]);
  const frameObjRef = useRef({ frame: 0 });

  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [activeStage, setActiveStage] = useState(1);
  const [scrubPercent, setScrubPercent] = useState(0);

  // Preload frame images
  useEffect(() => {
    let loadedCount = 0;
    const images = [];

    const getFrameUrl = (index) => {
      const numStr = String(index + 1).padStart(3, '0');
      // Normalize base path to avoid double slashes
      const base = BASE_PATH.endsWith('/') ? BASE_PATH : `${BASE_PATH}/`;
      return `${base}frames/frame_${numStr}.webp`;
    };

    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = getFrameUrl(i);
      img.onload = () => {
        loadedCount++;
        setLoadingProgress(Math.round((loadedCount / TOTAL_FRAMES) * 100));
        if (loadedCount === TOTAL_FRAMES) {
          setIsLoaded(true);
        }
      };
      img.onerror = () => {
        loadedCount++;
        setLoadingProgress(Math.round((loadedCount / TOTAL_FRAMES) * 100));
        if (loadedCount === TOTAL_FRAMES) {
          setIsLoaded(true);
        }
      };
      images.push(img);
    }

    imagesRef.current = images;

    return () => {
      imagesRef.current = [];
    };
  }, []);

  // Draw current frame to canvas
  const renderFrame = (index) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imagesRef.current[index];
    if (!img || !img.complete || img.naturalWidth === 0) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;

    ctx.clearRect(0, 0, cw, ch);

    // Contain scaling to preserve 16:9 ratio cleanly
    const scale = Math.min(cw / iw, ch / ih);
    const nw = iw * scale;
    const nh = ih * scale;
    const dx = (cw - nw) / 2;
    const dy = (ch - nh) / 2;

    ctx.drawImage(img, dx, dy, nw, nh);
  };

  // Canvas size handler
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const updateCanvasSize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      renderFrame(Math.floor(frameObjRef.current.frame));
    };

    updateCanvasSize();
    window.addEventListener('resize', updateCanvasSize);
    return () => window.removeEventListener('resize', updateCanvasSize);
  }, [isLoaded]);

  // Initial first frame render once loaded
  useEffect(() => {
    if (isLoaded) {
      renderFrame(0);
    }
  }, [isLoaded]);

  // Setup GSAP ScrollTrigger
  useEffect(() => {
    if (!isLoaded || !containerRef.current) return;

    const ctx = gsap.context(() => {
      gsap.to(frameObjRef.current, {
        frame: TOTAL_FRAMES - 1,
        snap: 'frame',
        ease: 'none',
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: '+=220%',
          scrub: 0.4,
          pin: true,
          anticipatePin: 1,
          onUpdate: (self) => {
            const currentIdx = Math.min(
              TOTAL_FRAMES - 1,
              Math.max(0, Math.floor(frameObjRef.current.frame))
            );
            renderFrame(currentIdx);

            const progress = self.progress;
            setScrubPercent(Math.round(progress * 100));

            if (progress < 0.35) {
              setActiveStage(1);
            } else if (progress < 0.70) {
              setActiveStage(2);
            } else {
              setActiveStage(3);
            }
          },
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, [isLoaded]);

  return (
    <section
      ref={containerRef}
      className="relative z-10 w-full min-h-screen flex flex-col justify-center items-center bg-[#0a0604] overflow-hidden select-none"
      aria-label="3D Kinematic Motion View"
    >
      {/* Top and Bottom ambient subtle divider gradients */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent z-20" />
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent z-20" />

      {/* Loading state overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#0a0604]/95 backdrop-blur-md px-6">
          <div className="w-12 h-12 rounded-2xl bg-[#e2723b]/10 border border-[#e2723b]/30 flex items-center justify-center text-[#e2723b] mb-4 animate-pulse">
            <Cpu className="w-6 h-6" />
          </div>
          <p className="text-white font-bold text-base mb-2">Loading 3D Motion Telemetry</p>
          <p className="text-white/50 text-xs mb-5 font-mono">Initializing 240-frame spatial dataset...</p>

          <div className="w-64 h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
            <div
              className="h-full bg-gradient-to-r from-[#e2723b] to-[#f97316] transition-all duration-150 rounded-full"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          <span className="text-[#e2723b] font-mono font-bold text-xs">{loadingProgress}%</span>
        </div>
      )}

      {/* Canvas Video Viewport Container */}
      <div className="relative w-full max-w-6xl h-[75vh] mx-auto px-4 flex items-center justify-center">
        {/* Ambient radial lighting glow behind canvas */}
        <div
          className="absolute inset-0 rounded-3xl pointer-events-none opacity-40 transition-all duration-700"
          style={{
            background:
              'radial-gradient(ellipse at 50% 50%, rgba(226, 114, 59, 0.12) 0%, transparent 70%)',
          }}
        />

        {/* 3D Canvas Viewport */}
        <div className="relative w-full h-full rounded-3xl border border-white/10 overflow-hidden bg-black/40 backdrop-blur-md shadow-2xl flex items-center justify-center">
          <canvas
            ref={canvasRef}
            className="w-full h-full object-contain block transition-transform duration-100"
          />

          {/* ── Glass Floating HUD Header ── */}
          <div className="absolute top-5 left-5 right-5 z-20 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-black/60 border border-white/10 backdrop-blur-xl">
              <div className="w-2 h-2 rounded-full bg-[#e2723b] animate-ping" />
              <span className="text-white/90 text-[11px] font-bold tracking-wider uppercase font-mono">
                3D Kinematic Spatial Scan
              </span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/60 border border-white/10 backdrop-blur-xl text-white/60 text-[10px] font-mono font-semibold">
              <Sparkles className="w-3 h-3 text-[#e2723b]" />
              <span>Rotation: {scrubPercent}%</span>
            </div>
          </div>

          {/* ── Stage 1 Floating HUD Card (0% - 35%) ── */}
          <div
            className={`absolute bottom-6 left-6 z-20 max-w-xs transition-all duration-500 transform ${
              activeStage === 1
                ? 'opacity-100 translate-y-0 scale-100'
                : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
            }`}
          >
            <div className="p-4 rounded-2xl bg-[#0a0604]/85 border border-[#e2723b]/30 backdrop-blur-xl shadow-xl">
              <div className="flex items-center gap-2 mb-2 text-[#e2723b]">
                <Layers className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Phase 01 · Alignment</span>
              </div>
              <h4 className="text-white font-bold text-sm mb-1">360° Anatomical Kinematics</h4>
              <p className="text-white/60 text-xs leading-relaxed">
                Full 3D spatial rotation mapping joint coordinates across 240 continuous capture points.
              </p>
            </div>
          </div>

          {/* ── Stage 2 Floating HUD Card (35% - 70%) ── */}
          <div
            className={`absolute bottom-6 right-6 z-20 max-w-xs transition-all duration-500 transform ${
              activeStage === 2
                ? 'opacity-100 translate-y-0 scale-100'
                : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
            }`}
          >
            <div className="p-4 rounded-2xl bg-[#0a0604]/85 border border-emerald-500/30 backdrop-blur-xl shadow-xl">
              <div className="flex items-center gap-2 mb-2 text-emerald-400">
                <Activity className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Phase 02 · Trajectory</span>
              </div>
              <h4 className="text-white font-bold text-sm mb-1">Real-Time Vector Tracking</h4>
              <p className="text-white/60 text-xs leading-relaxed">
                Sub-millimeter joint position resolution with local MoveNet neural inference.
              </p>
            </div>
          </div>

          {/* ── Stage 3 Floating HUD Card (70% - 100%) ── */}
          <div
            className={`absolute bottom-6 left-6 z-20 max-w-xs transition-all duration-500 transform ${
              activeStage === 3
                ? 'opacity-100 translate-y-0 scale-100'
                : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
            }`}
          >
            <div className="p-4 rounded-2xl bg-[#0a0604]/85 border border-[#e2723b]/40 backdrop-blur-xl shadow-xl">
              <div className="flex items-center gap-2 mb-2 text-[#e2723b]">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Phase 03 · Validation</span>
              </div>
              <h4 className="text-white font-bold text-sm mb-1">Biomechanical ROM Score</h4>
              <p className="text-white/60 text-xs leading-relaxed">
                Evaluates extension, velocity drops, and phase symmetry in real time.
              </p>
            </div>
          </div>

          {/* Bottom center scroll indicator */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 text-white/40 pointer-events-none">
            <span className="text-[9px] uppercase tracking-widest font-mono font-semibold">
              Scroll to Rotate Model
            </span>
            <ChevronDown className="w-3.5 h-3.5 animate-bounce text-[#e2723b]" />
          </div>
        </div>
      </div>
    </section>
  );
}
