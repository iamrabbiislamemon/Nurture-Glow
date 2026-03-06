import React, { useState } from 'react';
import {
  Leaf, Heart, Baby, AlertTriangle, ChevronDown, ChevronUp,
  Sun, Info, ShieldCheck, Flame, Apple, Droplet, Zap, Target
} from 'lucide-react';

/* ─────────── DATA ─────────── */

const VITAMINS = [
  { name: 'Folic Acid', amount: '600 mcg', sources: 'Spinach, Lentils, Fortified cereals', desc: 'Prevents neural tube defects, supports DNA synthesis', color: '#10b981' },
  { name: 'Vitamin D', amount: '600 IU', sources: 'Sunlight, Fortified milk, Salmon', desc: 'Bone development, immune system support', color: '#f59e0b' },
  { name: 'Vitamin C', amount: '85 mg', sources: 'Oranges, Strawberries, Bell peppers', desc: 'Iron absorption, tissue repair, immune health', color: '#ef4444' },
  { name: 'Vitamin A', amount: '770 mcg', sources: 'Sweet potatoes, Carrots, Mangoes', desc: 'Eye development, cell growth, immune function', color: '#f97316' },
  { name: 'Vitamin B12', amount: '2.6 mcg', sources: 'Eggs, Dairy, Fortified foods', desc: 'Nervous system development, red blood cells', color: '#8b5cf6' },
  { name: 'Vitamin B6', amount: '1.9 mg', sources: 'Chicken, Bananas, Potatoes', desc: 'Brain development, reduces morning sickness', color: '#06b6d4' },
];

const MINERALS = [
  { name: 'Iron', amount: '27 mg', sources: 'Red meat, Beans, Spinach', desc: 'Prevents anemia, oxygen transport to baby', color: '#dc2626' },
  { name: 'Calcium', amount: '1000 mg', sources: 'Milk, Yogurt, Cheese, Tofu', desc: 'Bone & teeth development, muscle function', color: '#f5f5f5' },
  { name: 'Zinc', amount: '11 mg', sources: 'Meat, Nuts, Whole grains', desc: 'Cell division, immune system, growth', color: '#71717a' },
  { name: 'Iodine', amount: '220 mcg', sources: 'Iodized salt, Seafood, Dairy', desc: 'Thyroid function, brain development', color: '#7c3aed' },
  { name: 'Magnesium', amount: '350 mg', sources: 'Nuts, Seeds, Dark chocolate', desc: 'Muscle relaxation, prevents preterm labor', color: '#14b8a6' },
  { name: 'Omega-3 (DHA)', amount: '200 mg', sources: 'Salmon, Walnuts, Chia seeds', desc: 'Baby brain & eye development', color: '#3b82f6' },
];

const MACROS = [
  { name: 'Protein', amount: '71 g/day', sources: 'Lean meat, Eggs, Legumes, Greek yogurt', desc: 'Tissue growth, baby development, blood supply', color: '#ef4444' },
  { name: 'Complex Carbs', amount: '175 g/day', sources: 'Whole grains, Oats, Brown rice, Quinoa', desc: 'Primary energy source, fiber for digestion', color: '#f59e0b' },
  { name: 'Healthy Fats', amount: '65 g/day', sources: 'Avocado, Olive oil, Nuts, Seeds', desc: 'Brain development, hormone production', color: '#10b981' },
  { name: 'Fiber', amount: '28 g/day', sources: 'Fruits, Vegetables, Whole grains, Beans', desc: 'Prevents constipation, blood sugar control', color: '#8b5cf6' },
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
    color: '#f472b6',
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
    color: '#a78bfa',
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
    color: '#60a5fa',
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

/* ─────────── COMPONENT ─────────── */

const Nutrition: React.FC = () => {
  const [activeNutrientTab, setActiveNutrientTab] = useState<string>('vitamins');
  const [activeTrimester, setActiveTrimester] = useState<string>('1st');
  const [expandedMeal, setExpandedMeal] = useState<number | null>(null);
  const [expandedAvoid, setExpandedAvoid] = useState<number | null>(null);

  const currentNutrients = NUTRIENT_TABS.find(t => t.key === activeNutrientTab)?.data ?? VITAMINS;
  const currentTrimester = TRIMESTER_DATA.find(t => t.key === activeTrimester) ?? TRIMESTER_DATA[0];

  return (
    <div style={{ padding: '20px', maxWidth: 900, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Leaf size={28} color="#10b981" />
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, background: 'linear-gradient(135deg,#10b981,#059669)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Pregnancy Nutrition Guide
          </h1>
        </div>
        <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>Complete nutrition reference for a healthy pregnancy</p>
      </div>

      {/* ═══════════ 1. Essential Nutrients Chart ═══════════ */}
      <section style={{ background: '#1e1e2e', borderRadius: 16, padding: 24, marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#e5e7eb', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Apple size={20} color="#10b981" /> Essential Nutrients Chart
        </h2>

        {/* tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {NUTRIENT_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveNutrientTab(tab.key)}
              style={{
                padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                display: 'flex', alignItems: 'center', gap: 6,
                background: activeNutrientTab === tab.key ? '#10b981' : '#2a2a3e',
                color: activeNutrientTab === tab.key ? '#fff' : '#9ca3af',
                transition: 'all .2s',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* cards grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 14 }}>
          {currentNutrients.map((n, i) => (
            <div key={i} style={{ background: '#16162a', borderRadius: 12, padding: 16, borderLeft: `3px solid ${n.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 6 }}>
                <span style={{ fontWeight: 600, color: '#e5e7eb', fontSize: 14 }}>{n.name}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: n.color, background: `${n.color}22`, padding: '2px 8px', borderRadius: 8 }}>{n.amount}</span>
              </div>
              <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 6px' }}>{n.desc}</p>
              <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>
                <span style={{ color: '#10b981', fontWeight: 500 }}>Sources:</span> {n.sources}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════ 2. Trimester-Based Nutrition Guide ═══════════ */}
      <section style={{ background: '#1e1e2e', borderRadius: 16, padding: 24, marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#e5e7eb', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Baby size={20} color="#a78bfa" /> Trimester-Based Nutrition Guide
        </h2>

        {/* trimester tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {TRIMESTER_DATA.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTrimester(t.key)}
              style={{
                padding: '8px 18px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
                background: activeTrimester === t.key ? t.color : '#2a2a3e',
                color: activeTrimester === t.key ? '#fff' : '#9ca3af',
                transition: 'all .2s',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* trimester info */}
        <div style={{ background: `${currentTrimester.color}15`, borderRadius: 12, padding: 18, marginBottom: 18, borderLeft: `3px solid ${currentTrimester.color}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: currentTrimester.color }}>{currentTrimester.label}</span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>{currentTrimester.weeks}</span>
          </div>
          <p style={{ margin: '0 0 4px', fontSize: 13, color: '#10b981', fontWeight: 500 }}>{currentTrimester.calories}</p>
          <p style={{ margin: 0, fontSize: 13, color: '#9ca3af' }}>{currentTrimester.focus}</p>
        </div>

        {/* meal times */}
        {(['Morning', 'Midday', 'Evening'] as const).map(period => (
          <div key={period} style={{ marginBottom: 14 }}>
            <h4 style={{ fontSize: 14, fontWeight: 600, color: '#e5e7eb', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              {period === 'Morning' ? '🌅' : period === 'Midday' ? '☀️' : '🌙'} {period}
            </h4>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
              {currentTrimester.meals[period].map((meal, i) => (
                <div key={i} style={{ background: '#16162a', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#d1d5db', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: currentTrimester.color }}>•</span> {meal}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* trimester tips */}
        <div style={{ background: '#16162a', borderRadius: 12, padding: 16, marginTop: 14 }}>
          <h4 style={{ fontSize: 14, fontWeight: 600, color: '#f59e0b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Info size={14} /> Tips for {currentTrimester.label}
          </h4>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {currentTrimester.tips.map((tip, i) => (
              <li key={i} style={{ fontSize: 13, color: '#9ca3af', marginBottom: 4 }}>{tip}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* ═══════════ 3. Daily Meal Schedule ═══════════ */}
      <section style={{ background: '#1e1e2e', borderRadius: 16, padding: 24, marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#e5e7eb', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={20} color="#f59e0b" /> Daily Meal Schedule
        </h2>

        {DAILY_MEALS.map((meal, idx) => {
          const open = expandedMeal === idx;
          const totalCal = meal.items.reduce((s, it) => s + it.cal, 0);
          return (
            <div key={idx} style={{ background: '#16162a', borderRadius: 12, marginBottom: 10, overflow: 'hidden' }}>
              <button
                onClick={() => setExpandedMeal(open ? null : idx)}
                style={{
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 18px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#e5e7eb',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left' }}>
                  <span style={{ fontSize: 22 }}>{meal.emoji}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{meal.label}</div>
                    <div style={{ fontSize: 12, color: '#9ca3af' }}>{meal.time} · ~{totalCal} cal</div>
                  </div>
                </div>
                {open ? <ChevronUp size={18} color="#9ca3af" /> : <ChevronDown size={18} color="#9ca3af" />}
              </button>

              {open && (
                <div style={{ padding: '0 18px 14px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ color: '#6b7280', textAlign: 'left' }}>
                        <th style={{ padding: '6px 0', fontWeight: 500 }}>Food</th>
                        <th style={{ padding: '6px 0', fontWeight: 500, width: 60 }}>Cal</th>
                        <th style={{ padding: '6px 0', fontWeight: 500 }}>Key Nutrients</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meal.items.map((it, i) => (
                        <tr key={i} style={{ borderTop: '1px solid #2a2a3e' }}>
                          <td style={{ padding: '8px 0', color: '#d1d5db' }}>{it.food}</td>
                          <td style={{ padding: '8px 0', color: '#f59e0b', fontWeight: 500 }}>{it.cal}</td>
                          <td style={{ padding: '8px 0', color: '#9ca3af' }}>{it.nutrients}</td>
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
      <section style={{ background: '#1e1e2e', borderRadius: 16, padding: 24, marginBottom: 28 }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: '#e5e7eb', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={20} color="#ef4444" /> Foods to Avoid During Pregnancy
        </h2>

        {FOODS_TO_AVOID.map((cat, idx) => {
          const open = expandedAvoid === idx;
          return (
            <div key={idx} style={{ background: '#16162a', borderRadius: 12, marginBottom: 10, overflow: 'hidden', borderLeft: `3px solid ${cat.risk === 'high' ? '#ef4444' : '#f59e0b'}` }}>
              <button
                onClick={() => setExpandedAvoid(open ? null : idx)}
                style={{
                  width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '14px 18px',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#e5e7eb',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{cat.emoji}</span>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{cat.category}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 8,
                    background: cat.risk === 'high' ? '#ef444422' : '#f59e0b22',
                    color: cat.risk === 'high' ? '#ef4444' : '#f59e0b',
                  }}>{cat.risk === 'high' ? 'High Risk' : 'Moderate'}</span>
                </div>
                {open ? <ChevronUp size={18} color="#9ca3af" /> : <ChevronDown size={18} color="#9ca3af" />}
              </button>

              {open && (
                <div style={{ padding: '0 18px 16px' }}>
                  <ul style={{ margin: '0 0 10px', paddingLeft: 18 }}>
                    {cat.items.map((item, i) => (
                      <li key={i} style={{ fontSize: 13, color: '#d1d5db', marginBottom: 4 }}>{item}</li>
                    ))}
                  </ul>
                  <div style={{ fontSize: 12, color: '#9ca3af', background: '#1e1e2e', borderRadius: 8, padding: '10px 14px' }}>
                    <strong style={{ color: '#f59e0b' }}>Why avoid:</strong> {cat.reason}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {/* ═══════════ 5. Quick Reference Cards ═══════════ */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 20, marginBottom: 28 }}>

        {/* Daily Checklist */}
        <div style={{ background: 'linear-gradient(135deg, #065f46, #047857)', borderRadius: 16, padding: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={20} /> Daily Nutrition Checklist
          </h3>
          {DAILY_CHECKLIST.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 20, height: 20, borderRadius: 6, border: '2px solid #34d399', flexShrink: 0 }} />
              <span style={{ fontSize: 14, color: '#d1fae5' }}>{item}</span>
            </div>
          ))}
        </div>

        {/* Superfoods */}
        <div style={{ background: 'linear-gradient(135deg, #7c2d12, #9a3412)', borderRadius: 16, padding: 24 }}>
          <h3 style={{ fontSize: 18, fontWeight: 600, color: '#fff', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Heart size={20} /> Pregnancy Superfoods
          </h3>
          {SUPERFOODS.map((item, i) => (
            <div key={i} style={{ fontSize: 14, color: '#fed7aa', marginBottom: 8, paddingLeft: 4 }}>{item}</div>
          ))}
        </div>
      </section>

      {/* footer note */}
      <div style={{ textAlign: 'center', padding: '12px 0 20px', color: '#6b7280', fontSize: 12 }}>
        <Info size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
        Always consult your healthcare provider for personalized nutritional advice during pregnancy.
      </div>
    </div>
  );
};

export default Nutrition;
