import React, { useState } from 'react';
import {
  Leaf, Heart, Baby, AlertTriangle, ChevronDown, ChevronUp,
  Sun, Info, ShieldCheck, Flame, Apple, Droplet, Zap, Target
} from 'lucide-react';

/* ─────────── DATA ─────────── */

const VITAMINS = [
  { name: 'Folic Acid', amount: '600 mcg', sources: 'Spinach, Lentils, Fortified cereals', desc: 'Prevents neural tube defects, supports DNA synthesis', color: 'emerald' },
  { name: 'Vitamin D', amount: '600 IU', sources: 'Sunlight, Fortified milk, Salmon', desc: 'Bone development, immune system support', color: 'amber' },
  { name: 'Vitamin C', amount: '85 mg', sources: 'Oranges, Strawberries, Bell peppers', desc: 'Iron absorption, tissue repair, immune health', color: 'red' },
  { name: 'Vitamin A', amount: '770 mcg', sources: 'Sweet potatoes, Carrots, Mangoes', desc: 'Eye development, cell growth, immune function', color: 'orange' },
  { name: 'Vitamin B12', amount: '2.6 mcg', sources: 'Eggs, Dairy, Fortified foods', desc: 'Nervous system development, red blood cells', color: 'violet' },
  { name: 'Vitamin B6', amount: '1.9 mg', sources: 'Chicken, Bananas, Potatoes', desc: 'Brain development, reduces morning sickness', color: 'cyan' },
];

const MINERALS = [
  { name: 'Iron', amount: '27 mg', sources: 'Red meat, Beans, Spinach', desc: 'Prevents anemia, oxygen transport to baby', color: 'red' },
  { name: 'Calcium', amount: '1000 mg', sources: 'Milk, Yogurt, Cheese, Tofu', desc: 'Bone & teeth development, muscle function', color: 'slate' },
  { name: 'Zinc', amount: '11 mg', sources: 'Meat, Nuts, Whole grains', desc: 'Cell division, immune system, growth', color: 'gray' },
  { name: 'Iodine', amount: '220 mcg', sources: 'Iodized salt, Seafood, Dairy', desc: 'Thyroid function, brain development', color: 'violet' },
  { name: 'Magnesium', amount: '350 mg', sources: 'Nuts, Seeds, Dark chocolate', desc: 'Muscle relaxation, prevents preterm labor', color: 'teal' },
  { name: 'Omega-3 (DHA)', amount: '200 mg', sources: 'Salmon, Walnuts, Chia seeds', desc: 'Baby brain & eye development', color: 'blue' },
];

const MACROS = [
  { name: 'Protein', amount: '71 g/day', sources: 'Lean meat, Eggs, Legumes, Greek yogurt', desc: 'Tissue growth, baby development, blood supply', color: 'red' },
  { name: 'Complex Carbs', amount: '175 g/day', sources: 'Whole grains, Oats, Brown rice, Quinoa', desc: 'Primary energy source, fiber for digestion', color: 'amber' },
  { name: 'Healthy Fats', amount: '65 g/day', sources: 'Avocado, Olive oil, Nuts, Seeds', desc: 'Brain development, hormone production', color: 'emerald' },
  { name: 'Fiber', amount: '28 g/day', sources: 'Fruits, Vegetables, Whole grains, Beans', desc: 'Prevents constipation, blood sugar control', color: 'violet' },
];

const NUTRIENT_TABS = [
  { key: 'vitamins', label: 'Vitamins', icon: <Sun size={14} />, data: VITAMINS },
  { key: 'minerals', label: 'Minerals', icon: <ShieldCheck size={14} />, data: MINERALS },
  { key: 'macros', label: 'Macronutrients', icon: <Flame size={14} />, data: MACROS },
] as const;

const TRIMESTER_DATA = [
  {
    key: '1st',
    label: '1st Trimester',
    weeks: 'Weeks 1–12',
    calories: '+0 extra calories',
    focus: 'Focus on nutrient-dense foods, manage nausea',
    colorClass: 'text-pink-500',
    bgClass: 'bg-pink-50',
    borderClass: 'border-pink-200',
    badgeClass: 'bg-pink-100 text-pink-700',
    meals: {
      Morning: ['Whole grain toast with avocado', 'Ginger tea for nausea', 'Small banana or crackers', 'Prenatal vitamin with breakfast'],
      Midday: ['Grilled chicken salad with spinach', 'Lentil soup with whole grain bread', 'Greek yogurt with mixed berries', 'Plenty of water throughout'],
      Evening: ['Baked salmon with sweet potato', 'Steamed broccoli and brown rice', 'Light fruit dessert', 'Chamomile tea before bed'],
    },
    tips: ['Eat small, frequent meals to manage nausea', 'Start taking prenatal vitamins with folic acid', 'Avoid raw fish, unpasteurized dairy, and deli meats', 'Stay hydrated — aim for 8–10 glasses of water'],
  },
  {
    key: '2nd',
    label: '2nd Trimester',
    weeks: 'Weeks 13–26',
    calories: '+340 extra calories/day',
    focus: 'Baby is growing rapidly — increase protein & calcium',
    colorClass: 'text-violet-500',
    bgClass: 'bg-violet-50',
    borderClass: 'border-violet-200',
    badgeClass: 'bg-violet-100 text-violet-700',
    meals: {
      Morning: ['Oatmeal with nuts and dried fruits', 'Scrambled eggs with spinach', 'Fresh orange juice (Vitamin C)', 'Calcium-fortified cereal with milk'],
      Midday: ['Turkey and cheese sandwich on whole wheat', 'Bean and vegetable stir-fry', 'Cottage cheese with pineapple', 'Handful of almonds as snack'],
      Evening: ['Lean beef stew with vegetables', 'Quinoa with roasted chickpeas', 'Steamed fish with lemon', 'Warm milk before bed'],
    },
    tips: ['Increase iron-rich foods to prevent anemia', 'Add calcium-rich foods for baby\'s bone development', 'Include omega-3 fatty acids for brain development', 'Continue prenatal vitamins consistently'],
  },
  {
    key: '3rd',
    label: '3rd Trimester',
    weeks: 'Weeks 27–40',
    calories: '+450 extra calories/day',
    focus: 'Final growth phase — energy stores & brain development',
    colorClass: 'text-blue-500',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-200',
    badgeClass: 'bg-blue-100 text-blue-700',
    meals: {
      Morning: ['Protein smoothie with banana & peanut butter', 'Whole grain pancakes with berries', 'Hard-boiled eggs with toast', 'Fortified orange juice'],
      Midday: ['Grilled fish tacos with cabbage slaw', 'Chicken and vegetable curry with rice', 'Mediterranean salad with feta', 'Trail mix for afternoon snack'],
      Evening: ['Roasted chicken with root vegetables', 'Pasta with meat sauce and side salad', 'Baked potato with cheese and broccoli', 'Dates and warm milk (helps with labor prep)'],
    },
    tips: ['Eat smaller, more frequent meals as stomach space decreases', 'Focus on DHA-rich foods for final brain development', 'Include vitamin K foods for blood clotting preparation', 'Stay well-hydrated to prevent swelling and contractions'],
  },
];

const DAILY_MEALS = [
  { time: '7:00 AM', label: 'Breakfast', emoji: '🌅', items: [
    { food: 'Whole grain oatmeal with berries', cal: 300, nutrients: 'Fiber, Iron, Antioxidants' },
    { food: 'Boiled egg', cal: 70, nutrients: 'Protein, Choline, B12' },
    { food: 'Glass of fortified orange juice', cal: 110, nutrients: 'Vitamin C, Folate, Calcium' },
    { food: 'Prenatal vitamin', cal: 0, nutrients: 'Complete daily supplements' },
  ]},
  { time: '10:00 AM', label: 'Mid-Morning Snack', emoji: '🍎', items: [
    { food: 'Greek yogurt with honey', cal: 150, nutrients: 'Calcium, Protein, Probiotics' },
    { food: 'Handful of almonds', cal: 160, nutrients: 'Healthy fats, Magnesium, Vitamin E' },
    { food: 'Apple slices', cal: 50, nutrients: 'Fiber, Vitamin C' },
  ]},
  { time: '1:00 PM', label: 'Lunch', emoji: '🥗', items: [
    { food: 'Grilled chicken salad with spinach', cal: 350, nutrients: 'Protein, Iron, Folate' },
    { food: 'Whole grain bread', cal: 120, nutrients: 'Complex carbs, Fiber, B vitamins' },
    { food: 'Lentil soup', cal: 200, nutrients: 'Protein, Iron, Fiber' },
    { food: 'Water with lemon', cal: 5, nutrients: 'Hydration, Vitamin C' },
  ]},
  { time: '4:00 PM', label: 'Afternoon Snack', emoji: '🥜', items: [
    { food: 'Hummus with carrot sticks', cal: 150, nutrients: 'Fiber, Vitamin A, Protein' },
    { food: 'Trail mix (nuts, seeds, dried fruit)', cal: 200, nutrients: 'Healthy fats, Iron, Energy' },
    { food: 'Banana', cal: 90, nutrients: 'Potassium, B6, Energy' },
  ]},
  { time: '7:00 PM', label: 'Dinner', emoji: '🍽️', items: [
    { food: 'Baked salmon with lemon', cal: 300, nutrients: 'Omega-3 DHA, Protein, Vitamin D' },
    { food: 'Quinoa pilaf', cal: 180, nutrients: 'Complete protein, Iron, Magnesium' },
    { food: 'Steamed broccoli & sweet potato', cal: 150, nutrients: 'Folate, Vitamin C, Fiber' },
    { food: 'Small side salad', cal: 80, nutrients: 'Vitamins, Minerals, Fiber' },
  ]},
  { time: '9:00 PM', label: 'Bedtime Snack', emoji: '🌙', items: [
    { food: 'Warm milk with turmeric', cal: 120, nutrients: 'Calcium, Tryptophan, Anti-inflammatory' },
    { food: 'Whole grain crackers with cheese', cal: 150, nutrients: 'Calcium, Protein, Complex carbs' },
    { food: '2–3 dates', cal: 60, nutrients: 'Natural sugar, Fiber, Iron' },
  ]},
];

const FOODS_TO_AVOID = [
  { category: 'Raw & Undercooked Foods', emoji: '🚫', risk: 'high',
    items: ['Raw sushi or sashimi', 'Undercooked meat or poultry', 'Raw eggs (homemade mayo, cookie dough)', 'Unpasteurized milk or cheese', 'Raw sprouts (alfalfa, bean)'],
    reason: 'Risk of Listeria, Salmonella, E. coli, and Toxoplasma infections that can harm the baby.' },
  { category: 'High-Mercury Fish', emoji: '🐟', risk: 'high',
    items: ['Shark', 'Swordfish', 'King mackerel', 'Tilefish', 'Bigeye tuna'],
    reason: 'Mercury can damage baby\'s developing nervous system and brain.' },
  { category: 'Caffeine & Beverages', emoji: '☕', risk: 'moderate',
    items: ['More than 200 mg caffeine/day', 'Energy drinks', 'Alcohol (all types)', 'Herbal teas (some are unsafe)', 'Excessive green tea'],
    reason: 'Caffeine crosses the placenta; alcohol causes fetal alcohol syndrome.' },
  { category: 'Processed & Junk Food', emoji: '🍟', risk: 'moderate',
    items: ['Excessive processed foods', 'High-sodium snacks', 'Artificial sweeteners (excess)', 'Trans fats', 'Sugary drinks'],
    reason: 'Can lead to excessive weight gain, gestational diabetes, and nutritional deficiencies.' },
  { category: 'Certain Herbs & Supplements', emoji: '🌿', risk: 'moderate',
    items: ['High-dose Vitamin A supplements', 'Dong Quai', 'Black cohosh', 'Excessive licorice root', 'Unregulated herbal supplements'],
    reason: 'Some herbs can stimulate uterine contractions or affect hormone levels.' },
];

const DAILY_CHECKLIST = [
  '8–10 glasses of water',
  'Prenatal vitamin taken',
  '3 servings of calcium-rich foods',
  '2+ servings of iron-rich foods',
  '5 servings of fruits & vegetables',
  'Omega-3 rich food (fish, walnuts)',
  'Whole grains at every meal',
  'Limited caffeine (< 200 mg)',
];

const SUPERFOODS = [
  '🥚 Eggs (choline)',
  '🍠 Sweet Potatoes (Vitamin A)',
  '🥬 Spinach (iron & folate)',
  '🫐 Berries (antioxidants)',
  '🥜 Nuts & Seeds (healthy fats)',
  '🐟 Salmon (omega-3 DHA)',
  '🥛 Greek Yogurt (calcium)',
  '🫘 Lentils (protein & fiber)',
  '🥑 Avocado (healthy fats)',
  '🍊 Citrus Fruits (Vitamin C)',
];

const COLOR_MAP: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-700' },
  red: { bg: 'bg-red-50', text: 'text-red-600', border: 'border-red-200', badge: 'bg-red-100 text-red-700' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-200', badge: 'bg-orange-100 text-orange-700' },
  violet: { bg: 'bg-violet-50', text: 'text-violet-600', border: 'border-violet-200', badge: 'bg-violet-100 text-violet-700' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', border: 'border-cyan-200', badge: 'bg-cyan-100 text-cyan-700' },
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-700' },
  teal: { bg: 'bg-teal-50', text: 'text-teal-600', border: 'border-teal-200', badge: 'bg-teal-100 text-teal-700' },
  slate: { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200', badge: 'bg-slate-100 text-slate-700' },
  gray: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200', badge: 'bg-gray-100 text-gray-700' },
  pink: { bg: 'bg-pink-50', text: 'text-pink-600', border: 'border-pink-200', badge: 'bg-pink-100 text-pink-700' },
};

/* ─────────── COMPONENT ─────────── */

const Nutrition: React.FC = () => {
  const [activeNutrientTab, setActiveNutrientTab] = useState<string>('vitamins');
  const [activeTrimester, setActiveTrimester] = useState<string>('1st');
  const [expandedMeal, setExpandedMeal] = useState<number | null>(null);
  const [expandedAvoid, setExpandedAvoid] = useState<number | null>(null);

  const currentNutrients = NUTRIENT_TABS.find(t => t.key === activeNutrientTab)?.data ?? VITAMINS;
  const currentTrimester = TRIMESTER_DATA.find(t => t.key === activeTrimester) ?? TRIMESTER_DATA[0];

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-8 space-y-8 animate-in fade-in duration-500 pb-20">

      {/* ── Header ── */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center">
            <Leaf size={24} className="text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">
            Pregnancy Nutrition Guide
          </h1>
        </div>
        <p className="text-gray-500 text-sm">Complete nutrition reference for a healthy pregnancy</p>
      </div>

      {/* ═══════════ 1. Essential Nutrients Chart ═══════════ */}
      <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Apple size={20} className="text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Essential Nutrients Chart</h2>
        </div>

        {/* tabs */}
        <div className="flex gap-2 flex-wrap">
          {NUTRIENT_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveNutrientTab(tab.key)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all ${
                activeNutrientTab === tab.key
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {currentNutrients.map((n, i) => {
            const c = COLOR_MAP[n.color] || COLOR_MAP.gray;
            return (
              <div key={i} className={`${c.bg} rounded-2xl p-5 border ${c.border} hover:shadow-md transition-all`}>
                <div className="flex justify-between items-start mb-2">
                  <span className="font-bold text-gray-800 text-sm">{n.name}</span>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${c.badge}`}>{n.amount}</span>
                </div>
                <p className="text-xs text-gray-500 mb-2">{n.desc}</p>
                <p className="text-xs text-gray-400">
                  <span className="text-emerald-600 font-semibold">Sources:</span> {n.sources}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══════════ 2. Trimester-Based Nutrition Guide ═══════════ */}
      <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
            <Baby size={20} className="text-violet-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Trimester-Based Nutrition Guide</h2>
        </div>

        {/* trimester tabs */}
        <div className="flex gap-2 flex-wrap">
          {TRIMESTER_DATA.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTrimester(t.key)}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTrimester === t.key
                  ? `${t.badgeClass} shadow-md`
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* trimester info */}
        <div className={`${currentTrimester.bgClass} rounded-2xl p-5 border-l-4 ${currentTrimester.borderClass}`}>
          <div className="flex justify-between flex-wrap gap-2 mb-2">
            <span className={`text-base font-bold ${currentTrimester.colorClass}`}>{currentTrimester.label}</span>
            <span className="text-xs text-gray-500 font-medium">{currentTrimester.weeks}</span>
          </div>
          <p className="text-sm text-emerald-600 font-semibold mb-1">{currentTrimester.calories}</p>
          <p className="text-sm text-gray-500">{currentTrimester.focus}</p>
        </div>

        {/* meal times */}
        {(['Morning', 'Midday', 'Evening'] as const).map(period => (
          <div key={period}>
            <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
              {period === 'Morning' ? '🌅' : period === 'Midday' ? '☀️' : '🌙'} {period}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {currentTrimester.meals[period].map((meal, i) => (
                <div key={i} className="bg-gray-50 rounded-xl px-4 py-3 text-sm text-gray-700 flex items-center gap-3 border border-gray-100">
                  <span className={currentTrimester.colorClass}>•</span> {meal}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* trimester tips */}
        <div className="bg-amber-50 rounded-2xl p-5 border border-amber-200">
          <h4 className="text-sm font-bold text-amber-700 mb-3 flex items-center gap-2">
            <Info size={14} /> Tips for {currentTrimester.label}
          </h4>
          <ul className="space-y-1.5 ml-4 list-disc">
            {currentTrimester.tips.map((tip, i) => (
              <li key={i} className="text-sm text-gray-600">{tip}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* ═══════════ 3. Daily Meal Schedule ═══════════ */}
      <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
            <Target size={20} className="text-amber-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Daily Meal Schedule</h2>
        </div>

        {DAILY_MEALS.map((meal, idx) => {
          const open = expandedMeal === idx;
          const totalCal = meal.items.reduce((s, it) => s + it.cal, 0);
          return (
            <div key={idx} className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
              <button
                onClick={() => setExpandedMeal(open ? null : idx)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{meal.emoji}</span>
                  <div>
                    <div className="font-bold text-sm text-gray-800">{meal.label}</div>
                    <div className="text-xs text-gray-500">{meal.time} · ~{totalCal} cal</div>
                  </div>
                </div>
                {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
              </button>

              {open && (
                <div className="px-5 pb-5 animate-in fade-in duration-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-gray-400 text-left text-xs font-bold uppercase tracking-wider">
                        <th className="py-2">Food</th>
                        <th className="py-2 w-16">Cal</th>
                        <th className="py-2">Key Nutrients</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meal.items.map((it, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="py-2.5 text-gray-700 font-medium">{it.food}</td>
                          <td className="py-2.5 text-amber-600 font-bold">{it.cal}</td>
                          <td className="py-2.5 text-gray-500">{it.nutrients}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* ═══════════ 4. Foods to Avoid ═══════════ */}
      <section className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 md:p-8 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Foods to Avoid During Pregnancy</h2>
        </div>

        {FOODS_TO_AVOID.map((cat, idx) => {
          const open = expandedAvoid === idx;
          const isHigh = cat.risk === 'high';
          return (
            <div key={idx} className={`rounded-2xl border overflow-hidden ${isHigh ? 'border-red-200 bg-red-50/30' : 'border-amber-200 bg-amber-50/30'}`}>
              <button
                onClick={() => setExpandedAvoid(open ? null : idx)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-white/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{cat.emoji}</span>
                  <span className="font-bold text-sm text-gray-800">{cat.category}</span>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg uppercase tracking-wider ${
                    isHigh ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>{isHigh ? 'High Risk' : 'Moderate'}</span>
                </div>
                {open ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
              </button>

              {open && (
                <div className="px-5 pb-5 animate-in fade-in duration-200">
                  <ul className="space-y-1.5 ml-4 list-disc mb-4">
                    {cat.items.map((item, i) => (
                      <li key={i} className="text-sm text-gray-700">{item}</li>
                    ))}
                  </ul>
                  <div className={`text-sm p-4 rounded-xl border ${isHigh ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                    <strong className="text-amber-700">Why avoid:</strong>{' '}
                    <span className="text-gray-600">{cat.reason}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* ═══════════ 5. Quick Reference Cards ═══════════ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Daily Checklist */}
        <div className="bg-gradient-to-br from-emerald-600 to-teal-600 rounded-3xl p-6 md:p-8 shadow-lg">
          <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
            <ShieldCheck size={20} /> Daily Nutrition Checklist
          </h3>
          <div className="space-y-3">
            {DAILY_CHECKLIST.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-md border-2 border-emerald-300 flex-shrink-0" />
                <span className="text-sm text-emerald-100 font-medium">{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Superfoods */}
        <div className="bg-gradient-to-br from-amber-600 to-orange-600 rounded-3xl p-6 md:p-8 shadow-lg">
          <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
            <Heart size={20} /> Pregnancy Superfoods
          </h3>
          <div className="space-y-2.5">
            {SUPERFOODS.map((item, i) => (
              <div key={i} className="text-sm text-amber-100 font-medium pl-1">{item}</div>
            ))}
          </div>
        </div>
      </div>

      {/* footer note */}
      <div className="text-center py-4 text-gray-400 text-xs flex items-center justify-center gap-1.5">
        <Info size={12} />
        Always consult your healthcare provider for personalized nutritional advice during pregnancy.
      </div>
    </div>
  );
};

export default Nutrition;
