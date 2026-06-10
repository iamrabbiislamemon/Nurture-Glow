import React, { useState, useEffect, useRef } from 'react';
import {
  Baby, Calendar, Heart, Apple, AlertTriangle, Lightbulb,
  ChevronLeft, ChevronRight, Ruler, Scale, Utensils, Leaf
} from 'lucide-react';
import { db } from '../services/db';
import { useAuth } from '../contexts/AuthContext';
import { apiFetch } from '../services/api';

/* ── types ── */
interface WeekInfo {
  week_number: number;
  trimester: number;
  stage_name: string;
  baby_size: string;
  tips: string[];
  nutrients: string[];
  symptoms: string[];
}

/* ── baby-size → emoji map ── */
const SIZE_EMOJI: Record<string, string> = {
  'Poppy Seed': '🌰', 'Sesame Seed': '🫘', 'Lentil': '🫘',
  'Blueberry': '🫐', 'Sweet Pea': '🫛', 'Raspberry': '🍇',
  'Olive': '🫒', 'Grape': '🍇', 'Prune': '🟣', 'Fig': '🍐',
  'Lime': '🍋', 'Plum': '🍑', 'Peach': '🍑', 'Lemon': '🍋',
  'Navel Orange': '🍊', 'Apple': '🍎', 'Avocado': '🥑',
  'Onion': '🧅', 'Sweet Potato': '🍠', 'Mango': '🥭',
  'Banana': '🍌', 'Pomegranate': '🫐', 'Papaya': '🥭',
  'Grapefruit': '🍊', 'Cantaloupe': '🍈', 'Ear of Corn': '🌽',
  'Cauliflower': '🥦', 'Lettuce Head': '🥬', 'Eggplant': '🍆',
  'Butternut Squash': '🎃', 'Coconut': '🥥', 'Cabbage': '🥬',
  'Pineapple': '🍍', 'Jicama': '🥔', 'Napa Cabbage': '🥬',
  'Romaine Lettuce': '🥬', 'Swiss Chard Bunch': '🥬',
  'Winter Melon': '🍈', 'Honeydew Melon': '🍈',
  'Small Pumpkin': '🎃', 'Watermelon': '🍉',
};

const TRIMESTER_LABEL = ['', '1st Trimester', '2nd Trimester', '3rd Trimester'];
const TRIMESTER_COLOR = ['', 'emerald', 'amber', 'rose'];

/* ── component ── */
const Pregnancy: React.FC = () => {
  const { user } = useAuth();
  const [selectedWeek, setSelectedWeek] = useState(24);
  const [weekInfoMap, setWeekInfoMap] = useState<Record<number, WeekInfo>>({});
  const [loading, setLoading] = useState(true);
  const timelineRef = useRef<HTMLDivElement>(null);

  /* fetch all 40 weeks from DB */
  useEffect(() => {
    (async () => {
      try {
        const data = await apiFetch<{ items: WeekInfo[] }>('/api/pregnancy/week-info');
        if (data.items?.length) {
          const map: Record<number, WeekInfo> = {};
          data.items.forEach(i => { map[i.week_number] = i; });
          setWeekInfoMap(map);
        }
      } catch (e) {
        console.error('Failed to load pregnancy week info:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* load user's saved week */
  useEffect(() => {
    if (!user) return;
    db.getPregnancyWeek(user.id).then(setSelectedWeek);
  }, [user]);

  const pickWeek = async (w: number) => {
    setSelectedWeek(w);
    if (user) await db.updatePregnancyWeek(user.id, w);
  };

  /* resolve week info with closest-week fallback */
  const info: WeekInfo | null = (() => {
    if (weekInfoMap[selectedWeek]) return weekInfoMap[selectedWeek];
    const keys = Object.keys(weekInfoMap).map(Number).sort((a, b) => a - b);
    if (!keys.length) return null;
    let best = keys[0];
    for (const k of keys) if (k <= selectedWeek) best = k;
    return weekInfoMap[best] ?? null;
  })();

  const trimester = info?.trimester ?? (selectedWeek <= 13 ? 1 : selectedWeek <= 26 ? 2 : 3);
  const tColor = TRIMESTER_COLOR[trimester];
  const progressPct = Math.round((selectedWeek / 40) * 100);
  const emoji = info ? (SIZE_EMOJI[info.baby_size] || '🤰') : '🤰';

  /* timeline scroll helpers */
  const scrollTimeline = (dir: 'left' | 'right') => {
    timelineRef.current?.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
  };

  /* ── skeleton loader ── */
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-8 pb-20 animate-pulse">
        <div className="h-64 rounded-3xl bg-gray-100" />
        <div className="h-16 rounded-2xl bg-gray-100" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 rounded-2xl bg-gray-100" />
          <div className="h-64 rounded-2xl bg-gray-100" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-8 pb-20">

      {/* ═══════════ HERO CARD ═══════════ */}
      <div className={`relative overflow-hidden rounded-3xl bg-gradient-to-br from-${tColor}-50 via-white to-${tColor}-50 border border-${tColor}-100 shadow-sm`}>
        {/* decorative blobs */}
        <div className={`absolute -top-20 -right-20 w-64 h-64 rounded-full bg-${tColor}-100/40 blur-3xl`} />
        <div className={`absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-${tColor}-200/30 blur-3xl`} />

        <div className="relative z-10 p-6 md:p-10">
          {/* top badges */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-${tColor}-100 text-${tColor}-700`}>
              <span className={`w-1.5 h-1.5 rounded-full bg-${tColor}-500 animate-pulse`} />
              {TRIMESTER_LABEL[trimester]}
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-white/70 text-gray-600 border border-gray-200">
              Week {selectedWeek} of 40
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-center">
            {/* left: text */}
            <div className="lg:col-span-3 space-y-4">
              {info && (
                <p className={`text-sm font-semibold text-${tColor}-600`}>{info.stage_name}</p>
              )}
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 leading-tight">
                Your baby is the size of
                <br />
                <span className={`text-${tColor}-600`}>
                  {info ? `a ${info.baby_size}` : '...'}
                </span>{' '}
                <span className="text-3xl md:text-4xl">{emoji}</span>
              </h1>
              <p className="text-gray-500 text-sm leading-relaxed max-w-lg">
                {info?.tips?.[0] || 'Select a week above to see personalised tips and nutrition guidance.'}
              </p>

              {/* stat cards */}
              <div className="flex gap-3 flex-wrap pt-2">
                <StatMini icon={<Calendar size={15} />} label="Weeks Left" value={`${40 - selectedWeek}`} accent="emerald" />
                <StatMini icon={<Heart size={15} />}    label="Due In"     value={`~${(40 - selectedWeek) * 7}d`} accent="rose" />
                <StatMini icon={<Ruler size={15} />}     label="Progress"   value={`${progressPct}%`} accent="amber" />
              </div>
            </div>

            {/* right: visual circle */}
            <div className="lg:col-span-2 flex justify-center">
              <div className="relative">
                {/* outer ring — progress */}
                <svg className="w-44 h-44 md:w-52 md:h-52" viewBox="0 0 160 160">
                  <circle cx="80" cy="80" r="72" fill="none" stroke="#e5e7eb" strokeWidth="6" />
                  <circle
                    cx="80" cy="80" r="72"
                    fill="none"
                    stroke={trimester === 1 ? '#10b981' : trimester === 2 ? '#f59e0b' : '#f43f5e'}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 72}`}
                    strokeDashoffset={`${2 * Math.PI * 72 * (1 - progressPct / 100)}`}
                    transform="rotate(-90 80 80)"
                    className="transition-all duration-700"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl">{emoji}</span>
                  <span className="text-xs font-bold text-gray-400 mt-1">Week {selectedWeek}</span>
                </div>
              </div>
            </div>
          </div>

          {/* progress bar */}
          <div className="mt-8">
            <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">
              <span>Week 1</span>
              <span>{progressPct}% complete</span>
              <span>Week 40</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full bg-gradient-to-r from-${tColor}-400 to-${tColor}-500 transition-all duration-700`}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {/* trimester markers */}
            <div className="flex mt-1">
              <div className="w-[33%] text-[9px] text-emerald-500 font-semibold">1st Tri</div>
              <div className="w-[33%] text-center text-[9px] text-amber-500 font-semibold">2nd Tri</div>
              <div className="w-[34%] text-right text-[9px] text-rose-500 font-semibold">3rd Tri</div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════ WEEK TIMELINE ═══════════ */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-700 tracking-tight">Select Week</h2>
          <div className="flex gap-1">
            <button onClick={() => scrollTimeline('left')}  className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors"><ChevronLeft size={14} /></button>
            <button onClick={() => scrollTimeline('right')} className="w-7 h-7 rounded-lg bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-400 transition-colors"><ChevronRight size={14} /></button>
          </div>
        </div>
        <div ref={timelineRef} className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-hide scroll-smooth">
          {[...Array(40)].map((_, i) => {
            const w = i + 1;
            const tri = w <= 13 ? 1 : w <= 26 ? 2 : 3;
            const isSelected = selectedWeek === w;
            const baseColors = tri === 1
              ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
              : tri === 2
                ? 'border-amber-200 text-amber-700 bg-amber-50'
                : 'border-rose-200 text-rose-700 bg-rose-50';
            const activeColors = tri === 1
              ? 'bg-emerald-600 border-emerald-600 text-white shadow-lg shadow-emerald-200'
              : tri === 2
                ? 'bg-amber-500 border-amber-500 text-white shadow-lg shadow-amber-200'
                : 'bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-200';
            return (
              <button
                key={w}
                onClick={() => pickWeek(w)}
                className={`flex-shrink-0 w-10 h-10 rounded-xl text-xs font-bold border transition-all duration-200 flex items-center justify-center
                  ${isSelected ? `${activeColors} scale-110` : `${baseColors} hover:scale-105 opacity-80 hover:opacity-100`}`}
              >
                {w}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══════════ BABY SIZE DETAIL ═══════════ */}
      {info && (
        <div className={`bg-gradient-to-r from-${tColor}-50 to-white rounded-2xl border border-${tColor}-100 p-5 flex items-center gap-5`}>
          <div className={`w-16 h-16 rounded-2xl bg-white shadow-md flex items-center justify-center text-3xl border border-${tColor}-100`}>
            {emoji}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-gray-800">Baby Size: {info.baby_size}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {info.stage_name} &middot; Trimester {info.trimester} &middot; Week {selectedWeek}
            </p>
            {info.tips?.[1] && (
              <p className="text-xs text-gray-400 mt-1 line-clamp-1">{info.tips[1]}</p>
            )}
          </div>
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            <Scale size={14} className="text-gray-300" />
            <span className="text-xs text-gray-400 font-medium">Week {selectedWeek}/40</span>
          </div>
        </div>
      )}

      {/* ═══════════ NUTRIENTS + SYMPTOMS ═══════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* nutrients */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center gap-2 border-b border-gray-50">
            <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center">
              <Utensils size={16} className="text-green-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">Nutrients This Stage</h3>
              <p className="text-[10px] text-gray-400">Recommended intake for week {selectedWeek}</p>
            </div>
          </div>
          <ul className="divide-y divide-gray-50">
            {(info?.nutrients ?? []).map((n, i) => {
              const [title, ...rest] = n.split(' – ');
              const desc = rest.join(' – ');
              return (
                <li key={i} className="px-5 py-3.5 flex gap-3 items-start hover:bg-green-50/40 transition-colors group">
                  <div className="mt-0.5 w-6 h-6 rounded-lg bg-green-100 flex items-center justify-center flex-shrink-0 group-hover:bg-green-200 transition-colors">
                    <Leaf size={12} className="text-green-600" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 leading-snug">{title}</p>
                    {desc && <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{desc}</p>}
                  </div>
                </li>
              );
            })}
            {(!info || info.nutrients.length === 0) && (
              <li className="px-5 py-8 text-center text-sm text-gray-300">No nutrition data for this week.</li>
            )}
          </ul>
        </div>

        {/* symptoms */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 pt-5 pb-3 flex items-center gap-2 border-b border-gray-50">
            <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center">
              <AlertTriangle size={16} className="text-amber-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-800">Symptoms to Watch</h3>
              <p className="text-[10px] text-gray-400">Common signs during week {selectedWeek}</p>
            </div>
          </div>
          <ul className="divide-y divide-gray-50">
            {(info?.symptoms ?? []).map((s, i) => (
              <li key={i} className="px-5 py-3.5 flex gap-3 items-start hover:bg-amber-50/40 transition-colors group">
                <div className="mt-0.5 w-6 h-6 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-200 transition-colors">
                  <span className="text-xs">⚡</span>
                </div>
                <p className="text-sm text-gray-700 leading-snug">{s}</p>
              </li>
            ))}
            {(!info || info.symptoms.length === 0) && (
              <li className="px-5 py-8 text-center text-sm text-gray-300">No symptom data for this week.</li>
            )}
          </ul>
        </div>
      </div>

      {/* ═══════════ TIPS CARD ═══════════ */}
      {info && info.tips.length > 0 && (
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Lightbulb size={16} className="text-indigo-600" />
            </div>
            <h3 className="text-sm font-bold text-gray-800">Tips for This Week</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {info.tips.map((t, i) => (
              <div key={i} className="flex gap-2 items-start bg-white/60 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/80">
                <span className="text-indigo-400 font-bold text-sm mt-px">{i + 1}.</span>
                <p className="text-sm text-gray-700 leading-relaxed">{t}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/* ── tiny stat card ── */
const StatMini: React.FC<{ icon: React.ReactNode; label: string; value: string; accent: string }> = ({ icon, label, value, accent }) => (
  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-white shadow-sm border border-${accent}-100`}>
    <div className={`w-7 h-7 rounded-lg bg-${accent}-50 flex items-center justify-center text-${accent}-600`}>{icon}</div>
    <div>
      <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider leading-none">{label}</p>
      <p className="text-sm font-bold text-gray-800 leading-tight">{value}</p>
    </div>
  </div>
);

export default Pregnancy;
