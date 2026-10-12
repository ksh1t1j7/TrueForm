import { useState, useRef, useCallback } from 'react';
import {
  Camera, Upload, RefreshCw, Brain, Apple, Sparkles,
  AlertCircle, CheckCircle, Dna, Zap, Activity
} from 'lucide-react';

// ─── Gemini Vision Food Analyzer ────────────────────────────────────────────
const GEMINI_API_KEY = 'AIzaSyD8vW6wMuKqLKiSUuCflZRcSzm7bfS0mMM';

const NUTRITION_PROMPT = `You are a professional nutritionist and dietitian. Analyze this food image and provide an accurate nutritional breakdown.

Respond ONLY with a valid JSON object in exactly this format (no markdown, no explanation, no code fences):
{
  "foodName": "Name of the dish or food item",
  "servingSize": "Estimated serving size (e.g. 1 plate ~350g)",
  "calories": 350,
  "protein": 25,
  "carbohydrates": 40,
  "fat": 12,
  "fiber": 5,
  "sugar": 8,
  "sodium": 450,
  "ingredients": ["ingredient 1", "ingredient 2", "ingredient 3"],
  "healthScore": 75,
  "glycemicIndex": "Medium (55-70)",
  "dietaryFlags": ["high-protein", "gluten-free"],
  "recommendations": ["Pair with a green salad to boost fiber", "Ideal pre-workout meal"],
  "warnings": ["High in sodium", "Contains dairy"]
}

healthScore is 0-100 (100 = most nutritious, whole food). Be specific and accurate with calories and macros.`;

async function analyzeWithGemini(base64Data, mimeType) {
  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: NUTRITION_PROMPT },
            { inline_data: { mime_type: mimeType, data: base64Data } }
          ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
      })
    }
  );
  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    throw new Error(`Gemini API error ${resp.status}: ${errBody.slice(0, 200)}`);
  }
  const data = await resp.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Could not parse JSON from Gemini response. Raw: ' + text.slice(0, 300));
  return JSON.parse(jsonMatch[0]);
}

// ─── MacroCard ───────────────────────────────────────────────────────────────
function MacroCard({ label, value, unit, color }) {
  return (
    <div className="bg-black/40 rounded-xl p-3 border border-white/5 text-center">
      <p className="text-white/40 text-[9px] uppercase font-semibold tracking-wider">{label}</p>
      <p className="font-mono font-extrabold text-lg mt-0.5" style={{ color }}>{value}</p>
      <p className="text-white/30 text-[9px]">{unit}</p>
    </div>
  );
}

// ─── FoodScanner Component ───────────────────────────────────────────────────
export default function FoodScanner() {
  const [foodImage, setFoodImage] = useState(null);   // dataURL for preview
  const [foodMime, setFoodMime]   = useState('image/jpeg');
  const [analysis,  setAnalysis]  = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const inputRef = useRef(null);

  const analyze = useCallback(async (b64, mime) => {
    setLoading(true); setError(''); setAnalysis(null);
    try {
      const result = await analyzeWithGemini(b64, mime);
      setAnalysis(result);
    } catch (e) {
      setError(e.message || 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleFile = (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Please upload an image file (JPG, PNG, WebP).'); return; }
    setError(''); setAnalysis(null);
    setFoodMime(file.type);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      setFoodImage(dataUrl);
      const b64 = dataUrl.split(',')[1];
      analyze(b64, file.type);
    };
    reader.readAsDataURL(file);
  };

  const handleInputChange = (e) => handleFile(e.target.files?.[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files?.[0]);
  };

  const healthColor = (score) =>
    score >= 70 ? '#34d399' : score >= 40 ? '#fbbf24' : '#ef4444';
  const healthBg = (score) =>
    score >= 70 ? 'rgba(52,211,153,0.1)' : score >= 40 ? 'rgba(251,191,36,0.1)' : 'rgba(239,68,68,0.1)';
  const healthBorder = (score) =>
    score >= 70 ? 'rgba(52,211,153,0.25)' : score >= 40 ? 'rgba(251,191,36,0.25)' : 'rgba(239,68,68,0.25)';

  return (
    <div className="flex flex-col gap-6">

      {/* ── Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-[#111316]/90 border border-white/8 rounded-3xl p-5 md:p-6 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2.5 mb-1.5">
            <div className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </div>
            <span className="text-[#e2723b] text-[11px] font-mono tracking-widest uppercase font-bold">
              Gemini 2.0 Flash Vision · Real-time Food Intelligence
            </span>
          </div>
          <h2 className="text-white text-2xl md:text-3xl font-extrabold tracking-tight">
            AI Food Nutrition Scanner
          </h2>
          <p className="text-[#f4f3ef]/70 text-xs md:text-sm mt-1 max-w-2xl">
            Upload any food photo and get instant AI-powered nutritional analysis — calories, macros, glycemic index, health score, and personalised recommendations.
          </p>
        </div>
        <div className="bg-black/50 border border-white/10 rounded-2xl px-4 py-2.5 text-right self-start md:self-center">
          <p className="text-white/40 text-[9px] uppercase tracking-wider font-semibold">Vision Model</p>
          <p className="text-emerald-400 font-mono text-xs font-bold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" /> Gemini 2.0 Flash
          </p>
        </div>
      </div>

      {/* ── Upload + Result grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

        {/* ── Upload Panel ── */}
        <div className="bg-[#111316]/80 border border-white/8 rounded-3xl p-5 md:p-6 backdrop-blur-xl flex flex-col gap-5">
          <div className="flex items-center gap-2 pb-3 border-b border-white/5">
            <Upload className="w-4 h-4 text-[#e2723b]" />
            <h3 className="text-white font-bold text-base">Upload Food Photo</h3>
          </div>

          {/* Drop Zone */}
          <div
            className="relative flex flex-col items-center justify-center gap-4 border-2 border-dashed border-white/15 hover:border-[#e2723b]/50 rounded-2xl p-6 cursor-pointer transition-all group min-h-[220px]"
            onClick={() => inputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            {foodImage ? (
              <>
                <img src={foodImage} alt="Food" className="w-full max-h-52 object-contain rounded-xl" />
                <div className="flex gap-2 mt-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => inputRef.current?.click()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#e2723b]/20 text-[#e2723b] text-xs font-bold border border-[#e2723b]/30 hover:bg-[#e2723b]/30 transition-all"
                  >
                    <RefreshCw className="w-3 h-3" /> Change Photo
                  </button>
                  {!loading && (
                    <button
                      onClick={() => { const b64 = foodImage.split(',')[1]; analyze(b64, foodMime); }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold border border-emerald-500/30 hover:bg-emerald-500/30 transition-all"
                    >
                      <Brain className="w-3 h-3" /> Re-analyze
                    </button>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-[#e2723b]/10 group-hover:border-[#e2723b]/30 transition-all">
                  <Camera className="w-8 h-8 text-white/30 group-hover:text-[#e2723b]/70 transition-all" />
                </div>
                <div className="text-center">
                  <p className="text-white font-semibold text-sm">Tap or drag to upload food photo</p>
                  <p className="text-white/40 text-xs mt-1">JPG · PNG · WebP · Any meal, snack, or packaged food</p>
                </div>
              </>
            )}
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleInputChange} />
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-10 h-10 rounded-full border-2 border-[#e2723b]/30 border-t-[#e2723b] animate-spin" />
              <p className="text-white/60 text-sm font-semibold">Analyzing with Gemini Vision...</p>
              <p className="text-white/30 text-xs">Identifying ingredients, macros &amp; health score</p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl p-3.5">
              <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
              <p className="text-red-300 text-xs leading-relaxed">{error}</p>
            </div>
          )}

          {/* Tips */}
          {!foodImage && (
            <div className="bg-black/30 rounded-xl p-4 border border-white/5">
              <p className="text-white/50 text-[10px] uppercase font-bold tracking-wider mb-2">Tips for best results</p>
              <ul className="text-white/40 text-xs space-y-1.5">
                <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-500/60" /> Use clear, well-lit photos</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-500/60" /> Whole plate or single food item works great</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-500/60" /> Works for home-cooked &amp; restaurant meals</li>
                <li className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-emerald-500/60" /> Also reads packaged food labels</li>
              </ul>
            </div>
          )}
        </div>

        {/* ── Results Panel ── */}
        {analysis ? (
          <div className="flex flex-col gap-4">

            {/* Food Name + Health Score */}
            <div className="bg-[#111316]/80 border border-white/8 rounded-3xl p-5 backdrop-blur-xl">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex-1 min-w-0">
                  <p className="text-white/40 text-[10px] uppercase tracking-widest font-bold">Identified Food</p>
                  <h3 className="text-white text-xl font-extrabold mt-0.5 truncate">{analysis.foodName}</h3>
                  <p className="text-white/50 text-xs mt-1">{analysis.servingSize}</p>
                </div>
                <div
                  className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center border shrink-0"
                  style={{
                    backgroundColor: healthBg(analysis.healthScore),
                    borderColor: healthBorder(analysis.healthScore),
                    color: healthColor(analysis.healthScore)
                  }}
                >
                  <span className="font-mono text-xl font-extrabold">{analysis.healthScore}</span>
                  <span className="text-[8px] font-bold opacity-70">HEALTH</span>
                </div>
              </div>

              {/* Macros Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <MacroCard label="Calories" value={analysis.calories} unit="kcal" color="#e2723b" />
                <MacroCard label="Protein"  value={`${analysis.protein}g`}        unit="protein" color="#38bdf8" />
                <MacroCard label="Carbs"    value={`${analysis.carbohydrates}g`}  unit="carbs"   color="#facc15" />
                <MacroCard label="Fat"      value={`${analysis.fat}g`}            unit="fat"     color="#a855f7" />
              </div>
            </div>

            {/* Micronutrients row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Fiber',  value: analysis.fiber,  unit: 'g'  },
                { label: 'Sugar',  value: analysis.sugar,  unit: 'g'  },
                { label: 'Sodium', value: analysis.sodium, unit: 'mg' },
              ].map(m => (
                <div key={m.label} className="bg-[#111316]/70 border border-white/8 rounded-2xl p-3 text-center">
                  <p className="text-white/40 text-[9px] uppercase font-semibold">{m.label}</p>
                  <p className="text-white font-mono font-bold text-base">{m.value}<span className="text-white/40 text-[10px]"> {m.unit}</span></p>
                </div>
              ))}
            </div>

            {/* GI + dietary flags */}
            <div className="bg-[#111316]/80 border border-white/8 rounded-2xl p-4 backdrop-blur-xl flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <p className="text-white/40 text-[10px] uppercase tracking-wider font-bold">Glycemic Index</p>
                <span className="bg-amber-500/15 text-amber-400 border border-amber-500/20 rounded-lg px-2.5 py-0.5 text-[10px] font-bold">{analysis.glycemicIndex}</span>
              </div>
              {analysis.dietaryFlags?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {analysis.dietaryFlags.map((f, i) => (
                    <span key={i} className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg px-2 py-0.5 text-[10px] font-semibold">{f}</span>
                  ))}
                </div>
              )}
            </div>

            {/* Ingredients */}
            {analysis.ingredients?.length > 0 && (
              <div className="bg-[#111316]/80 border border-white/8 rounded-2xl p-4 backdrop-blur-xl">
                <p className="text-white/40 text-[10px] uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5">
                  <Apple className="w-3 h-3 text-[#e2723b]" /> Detected Ingredients
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {analysis.ingredients.map((ing, i) => (
                    <span key={i} className="bg-white/5 border border-white/10 text-white/60 rounded-lg px-2 py-0.5 text-[10px] font-medium">{ing}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {analysis.recommendations?.length > 0 && (
              <div className="bg-[#111316]/80 border border-white/8 rounded-2xl p-4 backdrop-blur-xl">
                <p className="text-white/40 text-[10px] uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-[#e2723b]" /> AI Recommendations
                </p>
                {analysis.recommendations.map((r, i) => (
                  <p key={i} className="text-white/70 text-xs py-1.5 border-b border-white/5 last:border-0">✦ {r}</p>
                ))}
              </div>
            )}

            {/* Warnings */}
            {analysis.warnings?.length > 0 && (
              <div className="bg-red-500/8 border border-red-500/15 rounded-2xl p-4">
                <p className="text-red-400 text-[10px] uppercase tracking-wider font-bold mb-2 flex items-center gap-1.5">
                  <AlertCircle className="w-3 h-3" /> Nutritional Warnings
                </p>
                {analysis.warnings.map((w, i) => (
                  <p key={i} className="text-red-300/80 text-xs py-1.5 border-b border-red-500/10 last:border-0">⚠ {w}</p>
                ))}
              </div>
            )}

          </div>
        ) : (
          !loading && (
            <div className="bg-[#111316]/80 border border-white/8 rounded-3xl p-8 backdrop-blur-xl flex flex-col items-center justify-center gap-4 text-center min-h-[300px]">
              <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
                <Apple className="w-8 h-8 text-white/20" />
              </div>
              <div>
                <p className="text-white/50 font-semibold text-sm">No food analyzed yet</p>
                <p className="text-white/30 text-xs mt-1">Upload a photo to get instant AI nutritional breakdown</p>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
