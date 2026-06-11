import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, Legend } from 'recharts';
import { 
  Activity, Droplet, Weight, Clock, CheckCircle, ChevronRight, BookOpen, 
  MessageSquare, Plus, Apple, Calendar, Sparkles, X, AlertCircle, GlassWater, Syringe, Heart
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslations } from '../i18n/I18nContext';
import { AIService, HealthData } from '../services/aiService';
import { useAuth } from '../contexts/AuthContext';
import { db, DashboardSummary } from '../services/db';
import type { Appointment, VaccineRecord } from '../types';
import { motion } from 'framer-motion';
import { Reveal } from '../components/landing/motion/Reveal';
import { Stagger, StaggerItem } from '../components/landing/motion/Stagger';

// REMOVED: Barrel re-exports of unrelated page components.
// Each page should be imported directly where needed (e.g., in Layout.tsx).
// This eliminates unnecessary coupling and enables proper tree-shaking.

const MAX_PREGNANCY_WEEKS = 40;
const HYDRATION_GOAL_GLASSES = 8;
const HYDRATION_GLASS_LITERS = 0.25;
const HYDRATION_WARNING_GLASSES = 17;
const HYDRATION_CAUTION_GLASSES = 11;
const WATER_VISUAL_MAX = 20;
const ACTIVITY_DAYS = 7;
const VACCINE_DUE_WINDOW_DAYS = 14;
const DAY_MS = 1000 * 60 * 60 * 24;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getDateKey = (date: Date) => date.toISOString().split('T')[0];

const parseDateKey = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return getDateKey(parsed);
};

const getDaysUntil = (dateKey: string) => {
  const due = new Date(dateKey);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - today.getTime()) / DAY_MS);
};

const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { t, locale } = useTranslations();
  const navigate = useNavigate();
  const firstName = user?.name?.split(' ')[0] || 'Mom';
  const [insights, setInsights] = useState<string[]>([]);
  const [loadingInsights, setLoadingInsights] = useState(true);
  const [currentWeek, setCurrentWeek] = useState(0);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [vaccines, setVaccines] = useState<VaccineRecord[]>([]);
  const [glassCount, setGlassCount] = useState(0);
  const [healthHistory, setHealthHistory] = useState<Record<string, { date: string; value: string }[]>>({});
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [activeChartTab, setActiveChartTab] = useState<'activity' | 'sleep' | 'weight' | 'vitals' | 'vaccine'>('activity');
  
  // Dashboard summary state (from consolidated API)
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  
  // Modal States
  const [showWeekModal, setShowWeekModal] = useState(false);
  const [showWaterModal, setShowWaterModal] = useState(false);
  const [tempWeek, setTempWeek] = useState(0);

  const insightTimeoutRef = useRef<number | null>(null);

  const hydrationLiters = useMemo(
    () => (glassCount * HYDRATION_GLASS_LITERS).toFixed(1),
    [glassCount]
  );

  // Use summary data for appointment count (more accurate since it's calculated server-side)
  const appointmentCount = useMemo(
    () => dashboardSummary?.upcomingAppointments ?? 
      appointments.filter((appointment) => {
        const normalizedStatus = String(appointment.status || '').toLowerCase();
        return normalizedStatus === 'upcoming' || normalizedStatus === 'scheduled';
      }).length,
    [dashboardSummary, appointments]
  );

  // Use summary data for vaccine progress (calculated server-side)
  const vaccineProgress = useMemo(() => {
    if (dashboardSummary) return dashboardSummary.vaccineProgress;
    if (vaccines.length === 0) return 0;
    const taken = vaccines.filter((vaccine) => {
      const verification = vaccine.verificationStatus || 'pending';
      return vaccine.status === 'Taken' && (verification === 'approved' || verification === 'auto');
    }).length;
    return Math.round((taken / vaccines.length) * 100);
  }, [dashboardSummary, vaccines]);

  const { vaccinesDueSoonCount, vaccinesOverdueCount, nextVaccineDue } = useMemo(() => {
    if (vaccines.length === 0) {
      return { vaccinesDueSoonCount: 0, vaccinesOverdueCount: 0, nextVaccineDue: null as null | { name: string; dateKey: string; daysUntil: number } };
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const windowEnd = new Date(today);
    windowEnd.setDate(windowEnd.getDate() + VACCINE_DUE_WINDOW_DAYS);

    let dueSoon = 0;
    let overdue = 0;
    let nextDue: { name: string; dateKey: string; daysUntil: number } | null = null;

    vaccines.forEach((vaccine) => {
      if (vaccine.status === 'Taken') return;
      const dateKey = parseDateKey(vaccine.dueDate);
      if (!dateKey) return;
      const daysUntil = getDaysUntil(dateKey);
      if (daysUntil === null) return;

      if (daysUntil < 0) {
        overdue += 1;
      } else if (daysUntil <= VACCINE_DUE_WINDOW_DAYS) {
        dueSoon += 1;
      }

      if (!nextDue || daysUntil < nextDue.daysUntil) {
        nextDue = { name: vaccine.name, dateKey, daysUntil };
      }
    });

    return { vaccinesDueSoonCount: dueSoon, vaccinesOverdueCount: overdue, nextVaccineDue: nextDue };
  }, [vaccines]);

  const vaccinesDueCount = vaccinesDueSoonCount + vaccinesOverdueCount;

  const waterWarning = useMemo(() => {
    if (glassCount >= HYDRATION_WARNING_GLASSES) {
      return { severity: 'danger', message: 'Warning: excessive water intake can be harmful.' };
    }
    if (glassCount >= HYDRATION_CAUTION_GLASSES) {
      return { severity: 'caution', message: 'Caution: you are above the daily hydration target.' };
    }
    return null;
  }, [glassCount]);

  const latestMetrics = useMemo(() => {
    const getTime = (value: string) => {
      const time = new Date(value).getTime();
      return Number.isNaN(time) ? 0 : time;
    };
    const formatMetricValue = (value?: string | null) => {
      if (!value) return '--';
      const [first] = value.split(' ');
      return first || value;
    };
    const getLatest = (key: string) => {
      const entries = healthHistory[key] || [];
      if (entries.length === 0) return null;
      return [...entries].sort((a, b) => getTime(b.date) - getTime(a.date))[0];
    };
    return {
      heartRate: formatMetricValue(getLatest('Heart Rate')?.value),
      weight: formatMetricValue(getLatest('Weight')?.value),
      sleep: formatMetricValue(getLatest('Sleep')?.value)
    };
  }, [healthHistory]);

  const activityData = useMemo(() => {
    const counts = new Map<string, number>();
    Object.values(healthHistory).forEach((entries) => {
      entries.forEach((entry) => {
        const key = parseDateKey(entry.date);
        if (!key) return;
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    });

    const days: { name: string; active: number }[] = [];
    for (let i = ACTIVITY_DAYS - 1; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = getDateKey(date);
      const label = date.toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-US', { weekday: 'short' });
      days.push({ name: label, active: counts.get(key) || 0 });
    }
    return days;
  }, [healthHistory, locale]);

  const hasActivity = useMemo(
    () => activityData.some((day) => day.active > 0),
    [activityData]
  );

  const weightChartData = useMemo(() => {
    const raw = healthHistory['Weight'] || [];
    const parsed = raw
      .map(entry => {
        const val = parseFloat(entry.value);
        return {
          date: entry.date,
          formattedDate: new Date(entry.date).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-US', { month: 'short', day: 'numeric' }),
          weight: isNaN(val) ? null : val,
          baseline: undefined as number | undefined
        };
      })
      .filter(d => d.weight !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (parsed.length > 0) {
      return parsed;
    }
    // Default gestational weight baseline starting at week 12 (approx. 62kg default)
    return [
      { formattedDate: locale === 'bn' ? '১২ সপ্তাহ' : 'Wk 12', weight: 62.0, baseline: 62.0 as number | undefined },
      { formattedDate: locale === 'bn' ? '১৬ সপ্তাহ' : 'Wk 16', weight: 63.2, baseline: 63.0 as number | undefined },
      { formattedDate: locale === 'bn' ? '২০ সপ্তাহ' : 'Wk 20', weight: 64.5, baseline: 64.5 as number | undefined },
      { formattedDate: locale === 'bn' ? '২৪ সপ্তাহ' : 'Wk 24', weight: 66.0, baseline: 66.0 as number | undefined },
      { formattedDate: locale === 'bn' ? '২৮ সপ্তাহ' : 'Wk 28', weight: 67.8, baseline: 68.0 as number | undefined },
      { formattedDate: locale === 'bn' ? '৩২ সপ্তাহ' : 'Wk 32', weight: 69.5, baseline: 70.0 as number | undefined },
      { formattedDate: locale === 'bn' ? '৩৬ সপ্তাহ' : 'Wk 36', weight: 71.0, baseline: 72.0 as number | undefined },
    ];
  }, [healthHistory, locale]);

  const vitalsChartData = useMemo(() => {
    const raw = healthHistory['Heart Rate'] || [];
    const parsed = raw
      .map(entry => {
        const val = parseFloat(entry.value);
        return {
          date: entry.date,
          formattedDate: new Date(entry.date).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-US', { month: 'short', day: 'numeric' }),
          heartRate: isNaN(val) ? null : val
        };
      })
      .filter(d => d.heartRate !== null)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (parsed.length > 0) {
      return parsed;
    }
    // Default Heart Rate baseline trends
    return [
      { formattedDate: locale === 'bn' ? '১ম দিন' : 'Day 1', heartRate: 72 },
      { formattedDate: locale === 'bn' ? '২য় দিন' : 'Day 2', heartRate: 75 },
      { formattedDate: locale === 'bn' ? '৩য় দিন' : 'Day 3', heartRate: 78 },
      { formattedDate: locale === 'bn' ? '৪র্থ দিন' : 'Day 4', heartRate: 74 },
      { formattedDate: locale === 'bn' ? '৫ম দিন' : 'Day 5', heartRate: 80 },
      { formattedDate: locale === 'bn' ? '৬ষ্ঠ দিন' : 'Day 6', heartRate: 82 },
      { formattedDate: locale === 'bn' ? '৭ম দিন' : 'Day 7', heartRate: 79 },
    ];
  }, [healthHistory, locale]);

  const sleepChartData = useMemo(() => {
    const rawSleep = healthHistory['Sleep'] || [];
    const rawHydration = healthHistory['Hydration'] || [];

    // Map sleep entries
    const sleepMap = new Map<string, number>();
    rawSleep.forEach(entry => {
      const parsedDate = parseDateKey(entry.date);
      if (parsedDate) {
        const val = parseFloat(entry.value);
        if (!isNaN(val)) sleepMap.set(parsedDate, val);
      }
    });

    // Map hydration entries
    const hydrationMap = new Map<string, number>();
    rawHydration.forEach(entry => {
      const parsedDate = parseDateKey(entry.date);
      if (parsedDate) {
        const val = parseFloat(entry.value);
        if (!isNaN(val)) hydrationMap.set(parsedDate, val);
      }
    });

    // Get the last 7 days of sleep and fluid data
    const days: { formattedDate: string; sleep: number | null; hydration: number | null }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = getDateKey(d);
      const label = d.toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-US', { weekday: 'short' });
      const sleepVal = sleepMap.get(key) ?? null;
      const hydrationVal = hydrationMap.get(key) ?? null;
      days.push({
        formattedDate: label,
        sleep: sleepVal,
        hydration: hydrationVal
      });
    }
    return days;
  }, [healthHistory, locale]);

  const vaccineChartData = useMemo(() => {
    if (vaccines.length === 0) {
      return [
        { name: locale === 'bn' ? 'অপেক্ষমাণ' : 'Pending', value: 3, color: '#eab308' },
        { name: locale === 'bn' ? 'সম্পূর্ণ' : 'Taken', value: 2, color: '#10b981' }
      ];
    }
    const taken = vaccines.filter((vaccine) => {
      const verification = vaccine.verificationStatus || 'pending';
      return vaccine.status === 'Taken' && (verification === 'approved' || verification === 'auto');
    }).length;
    const pending = vaccines.length - taken;

    return [
      { name: locale === 'bn' ? 'সম্পূর্ণ' : 'Taken', value: taken, color: '#10b981' },
      { name: locale === 'bn' ? 'অপেক্ষমাণ' : 'Pending', value: pending, color: '#eab308' }
    ];
  }, [vaccines, locale]);

  const defaultInsights = useMemo(
    () => [
      'Drink at least 8 glasses of water daily.',
      'Remember to take your prenatal vitamins.',
      'Light walking and stretching can support circulation.'
    ],
    []
  );

  useEffect(() => {
    setTempWeek(currentWeek);
  }, [currentWeek]);

  const handleWeekUpdate = async () => {
    const normalizedWeek = clamp(tempWeek, 1, MAX_PREGNANCY_WEEKS);
    setCurrentWeek(normalizedWeek);
    setShowWeekModal(false);
    if (!user) return;
    try {
      await db.updatePregnancyWeek(user.id, normalizedWeek);
    } catch (err) {
      console.error('Failed to update pregnancy week:', err);
    }
  };

  const updateHydrationCount = async (nextCount: number) => {
    const normalized = Math.max(0, Math.round(nextCount));
    setGlassCount(normalized);
    if (!user) return;
    try {
      await db.updateHydration(user.id, normalized);
    } catch (err) {
      console.error('Failed to update hydration:', err);
    }
  };

  const handleAddGlass = () => {
    updateHydrationCount(glassCount + 1);
  };

  const handleRemoveGlass = () => {
    if (glassCount > 0) {
      updateHydrationCount(glassCount - 1);
    }
  };

  const refreshDashboard = async (silent = false) => {
    if (!user) {
      if (!silent) setLoadingData(false);
      return;
    }
    if (!silent) setLoadingData(true);
    setDataError(null);
    try {
      // Use consolidated dashboard summary API and load historical metrics concurrently
      const [summary, appts, vacs, hrHistory, wtHistory, slHistory, hyHistory] = await Promise.all([
        db.getDashboardSummary(),
        db.getAppointments(user.id),
        db.getVaccines(user.id),
        db.getHealthHistory(user.id, 'Heart Rate'),
        db.getHealthHistory(user.id, 'Weight'),
        db.getHealthHistory(user.id, 'Sleep'),
        db.getHealthHistory(user.id, 'Hydration'),
      ]);

      setDashboardSummary(summary);
      setAppointments(appts || []);
      setVaccines(vacs || []);
      
      // Set individual state from summary for backward compatibility
      const safeHydration = Number.isFinite(summary.waterToday) ? Math.max(0, Math.round(summary.waterToday)) : 0;
      setGlassCount(safeHydration);
      setCurrentWeek(clamp(summary.pregnancyWeek || 0, 0, MAX_PREGNANCY_WEEKS));
      
      setHealthHistory({
        'Heart Rate': hrHistory || [],
        'Weight': wtHistory || [],
        'Sleep': slHistory || [],
        'Hydration': hyHistory || [],
      });
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setDataError('Failed to load dashboard data. Please try again.');
    } finally {
      if (!silent) setLoadingData(false);
    }
  };

  useEffect(() => {
    if (!user) {
      setLoadingData(false);
      return;
    }
    refreshDashboard();
    const handleUpdate = () => refreshDashboard(true);
    window.addEventListener('db-update', handleUpdate);
    return () => window.removeEventListener('db-update', handleUpdate);
  }, [user]);

  useEffect(() => {
    if (!user || loadingData) return;

    if (insightTimeoutRef.current) {
      window.clearTimeout(insightTimeoutRef.current);
    }

    insightTimeoutRef.current = window.setTimeout(async () => {
      setLoadingInsights(true);
      try {
        const healthData: HealthData = {
          pregnancyWeek: currentWeek.toString(),
          vaccinesDue: vaccinesDueCount,
          hydrationLevel: `${hydrationLiters}L`
        };
        const aiInsights = await AIService.getHealthInsights(healthData, locale);
        setInsights(aiInsights && aiInsights.length > 0 ? aiInsights : defaultInsights);
      } catch (error) {
        setInsights(defaultInsights);
      } finally {
        setLoadingInsights(false);
      }
    }, 500);

    return () => {
      if (insightTimeoutRef.current) {
        window.clearTimeout(insightTimeoutRef.current);
      }
    };
  }, [user, loadingData, locale, currentWeek, hydrationLiters, vaccinesDueCount, defaultInsights]);
  const hydrationPercent = Math.min((glassCount / HYDRATION_GOAL_GLASSES) * 100, 100);
  const waterYLevel = 100 - hydrationPercent;
  const waterPathA = `M 0 ${waterYLevel} Q 25 ${waterYLevel - 4} 50 ${waterYLevel} T 100 ${waterYLevel} L 100 100 L 0 100 Z`;
  const waterPathB = `M 0 ${waterYLevel} Q 25 ${waterYLevel + 4} 50 ${waterYLevel} T 100 ${waterYLevel} L 100 100 L 0 100 Z`;

  const quickActions = [
    { label: t('nav.appointments'), icon: <Plus size={18} />, path: '/appointments', badge: appointmentCount, bgGradient: 'from-emerald-400 to-emerald-500', text: 'text-white' },
    { label: t('nav.nutrition'), icon: <Apple size={18} />, path: '/nutrition', bgGradient: 'from-amber-300 to-amber-400', text: 'text-white' },
    { label: t('nav.community'), icon: <MessageSquare size={18} />, path: '/community', bgGradient: 'from-blue-300 to-blue-400', text: 'text-white' },
    { label: t('nav.journal'), icon: <BookOpen size={18} />, path: '/journal', bgGradient: 'from-rose-300 to-rose-400', text: 'text-white' },
    { label: t('nav.vaccines'), icon: <Syringe size={18} />, path: '/vaccines', badge: vaccinesDueCount, bgGradient: 'from-teal-400 to-emerald-500', text: 'text-white' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#f8f6f1] via-[#fafbf7] to-white">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 space-y-12">
        {dataError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
            <AlertCircle size={20} className="text-red-500 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-red-700">{dataError}</p>
              <p className="text-xs text-red-600">Check your connection and try again.</p>
            </div>
            <button
              onClick={() => refreshDashboard()}
              className="px-4 py-2 text-xs font-bold rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              Retry
            </button>
          </div>
        )}
        
        {/* Hero Welcome Section */}
        <Reveal y={30} delay={0.1}>
          <div className="relative overflow-hidden">
            <div className="relative z-10 rounded-3xl bg-gradient-to-r from-emerald-500 via-emerald-500 to-teal-500 p-8 md:p-12 shadow-xl">
              <div className="absolute inset-0 opacity-5">
                <div className="absolute top-4 right-4 w-80 h-80 bg-white rounded-full blur-3xl"></div>
                <div className="absolute -bottom-20 -left-20 w-60 h-60 bg-white rounded-full blur-2xl"></div>
              </div>
              
              <div className="relative z-20 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div>
                  <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-white mb-3 leading-tight">
                    {t('dashboard.welcome', { name: firstName })}
                  </h1>
                  <p className="text-white/90 text-base leading-relaxed max-w-md">
                    {t('dashboard.pregnancySub')}
                  </p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Week Card - Interactive */}
                  <motion.button
                    whileHover={{ scale: 1.03, y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    onClick={() => setShowWeekModal(true)}
                    disabled={loadingData}
                    className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:bg-white/25 transition-all group cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-[#E6C77A]/30 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Calendar size={16} className="text-[#E6C77A]" />
                      </div>
                      <span className="text-white/70 text-sm font-medium text-left">Week</span>
                    </div>
                    <p className="text-2xl font-bold text-white text-left group-hover:text-[#E6C77A] transition-colors">
                      {loadingData ? '--' : (currentWeek > 0 ? currentWeek : 'Set')}
                    </p>
                    <p className="text-xs text-white/50 mt-2 text-left">{currentWeek > 0 ? 'Click to edit' : 'Click to set'}</p>
                  </motion.button>
                  
                  {/* Water Card - Interactive with Glass Units */}
                  <motion.button
                    whileHover={{ scale: 1.03, y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    onClick={() => setShowWaterModal(true)}
                    disabled={loadingData}
                    className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:bg-white/25 transition-all group cursor-pointer relative overflow-hidden h-40 disabled:opacity-60 disabled:cursor-not-allowed text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  >
                    {/* Animated Water Container */}
                    <div className="absolute inset-0 rounded-2xl overflow-hidden">
                      <svg 
                        className="absolute inset-0 w-full h-full" 
                        viewBox="0 0 100 100" 
                        preserveAspectRatio="none"
                        style={{
                          opacity: 0.3,
                        }}
                      >
                        <defs>
                          <linearGradient id="waterGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#E6C77A" />
                            <stop offset="100%" stopColor="#d4a853" />
                          </linearGradient>
                        </defs>
                        <rect 
                          x="0" 
                          y={String(100 - Math.min((glassCount / HYDRATION_GOAL_GLASSES) * 100, 100))} 
                          width="100" 
                          height={String(Math.min((glassCount / HYDRATION_GOAL_GLASSES) * 100, 100))} 
                          fill="url(#waterGradient)" 
                          opacity="0.6"
                        />
                        <motion.path 
                          animate={{
                            d: [waterPathA, waterPathB, waterPathA]
                          }}
                          transition={{
                            repeat: Infinity,
                            duration: 4,
                            ease: "easeInOut"
                          }}
                          fill="url(#waterGradient)"
                          opacity="0.4"
                        />
                      </svg>
                    </div>

                    <div className="relative z-10 h-full flex flex-col justify-between">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-[#E6C77A]/30 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                          <GlassWater size={16} className="text-[#E6C77A]" />
                        </div>
                        <span className="text-white/70 text-sm font-medium">Water</span>
                      </div>
                      
                      <div>
                        <p className="text-2xl font-bold text-white group-hover:text-[#E6C77A] transition-colors">{loadingData ? '--' : glassCount} Glasses</p>
                        <p className="text-xs text-white/50 mt-2">Click to update</p>
                      </div>
                    </div>
                  </motion.button>

                  {/* Vaccines Card with Progress Theme */}
                  <motion.button
                    whileHover={{ scale: 1.03, y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    type="button"
                    onClick={() => navigate('/vaccines')}
                    aria-label="Open vaccine tracker"
                    className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:bg-white/20 transition-all group relative overflow-hidden text-left cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  >
                    <div className="absolute inset-0 opacity-5 pointer-events-none">
                    </div>
                    <div className="relative z-10 flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-[#E6C77A]/30 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <CheckCircle size={16} className="text-[#E6C77A]" />
                      </div>
                      <span className="text-white/70 text-sm font-medium">{t('nav.vaccines')}</span>
                    </div>
                    <p className="text-2xl font-bold text-white relative z-10">{loadingData ? '--' : `${vaccineProgress}%`}</p>
                    <div className="mt-3 relative z-10">
                      <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#E6C77A]/50 to-[#E6C77A] transition-all duration-500" style={{ width: `${loadingData ? 0 : vaccineProgress}%` }}></div>
                      </div>
                    </div>
                    {!loadingData && (
                      <div className="mt-3 space-y-1">
                        {nextVaccineDue ? (
                          <p className="text-[11px] text-white/80 font-medium">
                            Next due: {nextVaccineDue.name} &middot; {new Date(nextVaccineDue.dateKey).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-US', { day: '2-digit', month: 'short', year: 'numeric' })} &middot; {
                              nextVaccineDue.daysUntil === 0
                                ? 'Due today'
                                : nextVaccineDue.daysUntil < 0
                                ? `Overdue by ${Math.abs(nextVaccineDue.daysUntil)}d`
                                : `Due in ${nextVaccineDue.daysUntil}d`
                            }
                          </p>
                        ) : (
                          <p className="text-[11px] text-white/70 font-medium">No upcoming vaccine dates yet</p>
                        )}
                        <p className="text-[11px] text-white/70">
                          Due in next {VACCINE_DUE_WINDOW_DAYS} days: <span className="font-semibold text-white">{vaccinesDueSoonCount}</span>
                          {vaccinesOverdueCount > 0 && (
                            <span className="ml-2 text-amber-100 font-semibold">Overdue: {vaccinesOverdueCount}</span>
                          )}
                        </p>
                      </div>
                    )}
                    <p className="text-[10px] text-white/60 mt-2">Tap to open tracker</p>
                  </motion.button>

                  {/* Appointments Card with Calendar Theme */}
                  <motion.button
                    whileHover={{ scale: 1.03, y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    onClick={() => navigate('/appointments')}
                    className="bg-white/15 backdrop-blur-md rounded-2xl p-6 border border-white/20 hover:bg-white/25 transition-all group cursor-pointer relative overflow-hidden text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  >
                    <div className="absolute inset-0 opacity-5 pointer-events-none">
                      <div className="grid grid-cols-3 gap-1 p-2">
                        {[...Array(9)].map((_, i) => (
                          <div key={i} className="w-2 h-2 bg-white rounded-sm" />
                        ))}
                      </div>
                    </div>
                    <div className="relative z-10 flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-[#E6C77A]/30 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Calendar size={16} className="text-[#E6C77A]" />
                      </div>
                      <span className="text-white/70 text-sm font-medium">{t('nav.appointments')}</span>
                    </div>
                    <div className="flex items-end gap-2 relative z-10">
                      <p className="text-2xl font-bold text-white">{loadingData ? '--' : appointmentCount}</p>
                      <span className="text-xs text-white/60 pb-1">Upcoming</span>
                    </div>
                  </motion.button>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        {/* Emergency Ambulance Shortcut Banner */}
        <Reveal y={30} delay={0.2}>
          <div className="shake-on-hover bg-gradient-to-r from-red-500 via-rose-500 to-red-600 rounded-[32px] p-6 shadow-sm border border-red-200/10 text-white flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-md transition-all duration-300">
            <div className="space-y-2 max-w-2xl text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-full border border-white/20">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-ping" />
                <span className="text-[10px] font-black uppercase tracking-wider">
                  {locale === 'bn' ? 'জরুরি অ্যাম্বুলেন্স সেবা' : 'Emergency Ambulance Service'}
                </span>
              </div>
              <h2 className="text-xl md:text-2xl font-extrabold tracking-tight">
                {locale === 'bn' ? 'জরুরি অ্যাম্বুলেন্স প্রয়োজন?' : 'Need Ground Transport Assistance?'}
              </h2>
              <p className="text-sm text-white/80 leading-relaxed">
                {locale === 'bn'
                  ? 'এক ট্যাপে আপনার অবস্থানে একটি মাতৃত্বকালীন অ্যাম্বুলেন্স অনুরোধ করুন। চালক শুধুমাত্র আপনার যোগাযোগের বিবরণ ও অবস্থান পাবেন, আপনার সংবেদনশীল চিকিৎসা বিবরণ সম্পূর্ণ নিরাপদ।'
                  : 'Instantly request a maternal ambulance to your location with one tap. The driver receives coordinates and contact info, with complete protection of your pregnancy and medical history.'}
              </p>
            </div>
            <button
              onClick={() => navigate('/ambulance')}
              className="shimmer-hover self-start md:self-center px-6 py-4 bg-white text-red-600 dark:text-white font-extrabold text-xs uppercase tracking-widest rounded-2xl shadow-md hover:bg-red-50 hover:scale-102 transition-all cursor-pointer border-none shrink-0"
            >
              {locale === 'bn' ? 'অ্যাম্বুলেন্স ডিসপ্যাচ খুলুন' : 'Access Ambulance Dispatch'} &rarr;
            </button>
          </div>
        </Reveal>

        {/* Health Metrics Cards */}
        <div>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900">{t('dashboard.healthSummary')}</h2>
            <button 
              onClick={() => navigate('/health')}
              className="text-emerald-600 font-semibold hover:text-emerald-700 flex items-center gap-2 text-sm bg-emerald-50 px-4 py-2 rounded-lg hover:bg-emerald-100 transition-all"
            >
              {t('common.viewAll')} <ChevronRight size={16} />
            </button>
          </div>
          
          <Stagger staggerDelay={0.08}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {[
                { id: 'heart-rate', label: t('health.heartRate'), value: latestMetrics.heartRate, unit: 'bpm', icon: <Activity size={24} />, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
                { id: 'hydration', label: t('health.hydration'), value: hydrationLiters, unit: 'L', icon: <Droplet size={24} />, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
                { id: 'weight', label: t('health.weight'), value: latestMetrics.weight, unit: 'kg', icon: <Weight size={24} />, color: 'text-[#d4a853]', bg: 'bg-amber-50', border: 'border-amber-200' },
                { id: 'sleep', label: t('health.sleep'), value: latestMetrics.sleep, unit: '', icon: <Clock size={24} />, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' },
              ].map((m, idx) => (
                <StaggerItem key={idx}>
                  <motion.button 
                    whileHover={{ scale: 1.05, y: -4 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 400, damping: 17 }}
                    onClick={() => navigate(m.id === 'hydration' ? '/health/hydration' : m.id === 'heart-rate' ? '/health/heart-rate' : m.id === 'weight' ? '/health/weight' : '/health/sleep')}
                    className={`${m.bg} w-full p-6 rounded-2xl shadow-sm hover:shadow-xl transition-all text-left group cursor-pointer border-2 ${m.border} focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500`}
                  >
                    <div className={`w-12 h-12 ${m.bg} ${m.color} rounded-xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform ${m.id === 'heart-rate' ? 'beat-on-hover' : ''}`}>
                      {m.icon}
                    </div>
                    <p className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-3">{m.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{m.value} <span className="text-sm font-normal text-gray-400">{m.unit}</span></p>
                  </motion.button>
                </StaggerItem>
              ))}
            </div>
          </Stagger>
        </div>

        {/* Content Grid - AI Insights & Activity */}
        <Reveal y={30} delay={0.35}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Insights & Chart */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* AI Health Insights */}
              <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-500 rounded-xl flex items-center justify-center shadow-lg">
                      <Sparkles size={24} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">{t('dashboard.aiInsights')}</h3>
                      <p className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-1">{t('dashboard.poweredAi')}</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => navigate('/assistant')}
                    className="text-emerald-500 hover:text-emerald-600 p-2 rounded-xl hover:bg-emerald-50 transition-all"
                  >
                    <ChevronRight size={20} />
                  </button>
                </div>

                <div className="space-y-4">
                  {loadingInsights ? (
                    <>
                      <div className="h-20 bg-gradient-to-r from-gray-100 to-gray-50 rounded-2xl animate-pulse"></div>
                      <div className="h-20 bg-gradient-to-r from-gray-100 to-gray-50 rounded-2xl animate-pulse"></div>
                      <div className="h-20 bg-gradient-to-r from-gray-100 to-gray-50 rounded-2xl animate-pulse"></div>
                    </>
                  ) : (
                    insights.map((insight, idx) => (
                      <div 
                        key={idx} 
                        className="relative p-5 bg-gradient-to-r from-emerald-100/50 to-white rounded-2xl border-l-4 border-emerald-400 shadow-sm hover:shadow-md hover:from-emerald-100 transition-all group"
                      >
                        <p className="text-gray-700 text-sm leading-relaxed font-medium">{insight}</p>
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <Sparkles size={16} className="text-emerald-500" />
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Maternal Health Analytics Hub */}
              <div className="relative bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-100 hover:shadow-lg transition-all duration-300">
                {/* Floating vital heart bubble (moving object) */}
                <div className="absolute -top-5 -right-5 animate-float opacity-20 sm:opacity-40 hidden md:block z-20 pointer-events-none">
                  <div className="w-14 h-14 rounded-full bg-emerald-50 backdrop-blur-md flex items-center justify-center border-2 border-emerald-100 shadow-md">
                    <Heart className="text-emerald-700 animate-pulse-slow" size={20} fill="currentColor" />
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">
                      {locale === 'bn' ? 'মাতৃত্বকালীন স্বাস্থ্য অ্যানালিটিক্স হাব' : 'Maternal Health Analytics Hub'}
                    </h3>
                    <p className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">
                      {locale === 'bn' ? 'আপনার সাপ্তাহিক স্বাস্থ্য ও পুষ্টির অগ্রগতি ট্র্যাক করুন' : 'Track your weekly wellness & health metrics'}
                    </p>
                  </div>
                  <span className="self-start sm:self-center text-xs text-emerald-700 font-semibold uppercase tracking-wider bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full shrink-0">
                    {locale === 'bn' ? 'সাপ্তাহিক ভিউ' : 'Weekly Trends'}
                  </span>
                </div>

                {/* Tab Selector Buttons - Fully Responsive */}
                <div className="flex overflow-x-auto gap-2 pb-3 mb-6 scrollbar-hide -mx-2 px-2 sm:mx-0 sm:px-0">
                  {[
                    { id: 'activity', label: locale === 'bn' ? 'কার্যক্রম' : 'Activity', icon: <Activity size={16} /> },
                    { id: 'sleep', label: locale === 'bn' ? 'ঘুম ও তরল' : 'Sleep & Fluids', icon: <Clock size={16} /> },
                    { id: 'weight', label: locale === 'bn' ? 'ওজন' : 'Weight', icon: <Weight size={16} /> },
                    { id: 'vitals', label: locale === 'bn' ? 'হার্ট রেট' : 'Heart Rate', icon: <Heart size={16} /> },
                    { id: 'vaccine', label: locale === 'bn' ? 'টিকা' : 'Vaccine', icon: <Syringe size={16} /> },
                  ].map((tab) => {
                    const isActive = activeChartTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveChartTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer border-2 shrink-0 ${
                          isActive
                            ? 'bg-[#1B4D3E] border-[#1B4D3E] text-white shadow-md shadow-emerald-950/15'
                            : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {tab.icon}
                        {tab.label}
                      </button>
                    );
                  })}
                </div>

                {/* Chart Display Wrapper */}
                <div className="h-72 w-full relative">
                  {activeChartTab === 'activity' && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className="h-full w-full"
                    >
                      {hasActivity ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={activityData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                            <defs>
                              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" />
                                <stop offset="100%" stopColor="#6ee7b7" />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12, fontWeight: 500}} />
                            <YAxis hide />
                            <Tooltip 
                              cursor={{fill: 'rgba(16, 185, 129, 0.1)', radius: 8}} 
                              contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(16, 185, 129, 0.15)', backgroundColor: 'white'}}
                              formatter={(value) => [value, locale === 'bn' ? 'কার্যক্রম' : 'Activity']}
                            />
                            <Bar dataKey="active" fill="url(#barGradient)" radius={[8, 8, 0, 0]} isAnimationActive={true} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="h-full flex flex-col items-center justify-center text-sm text-gray-400 gap-2">
                          <Activity size={32} className="text-gray-300 animate-pulse" />
                          <span>{locale === 'bn' ? 'কোন সাম্প্রতিক কার্যক্রম নেই' : 'No recent activity yet.'}</span>
                        </div>
                      )}
                    </motion.div>
                  )}

                  {activeChartTab === 'sleep' && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className="h-full w-full"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sleepChartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                          <XAxis dataKey="formattedDate" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12, fontWeight: 500}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} />
                          <Tooltip
                            contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(99, 102, 241, 0.15)', backgroundColor: 'white'}}
                          />
                          <Legend verticalAlign="top" height={36} />
                          <Line
                            type="monotone"
                            name={locale === 'bn' ? 'ঘুম (ঘণ্টা)' : 'Sleep (hrs)'}
                            dataKey="sleep"
                            stroke="#6366f1"
                            strokeWidth={3}
                            activeDot={{ r: 8 }}
                            isAnimationActive={true}
                          />
                          <Line
                            type="monotone"
                            name={locale === 'bn' ? 'তরল (লিটার)' : 'Fluids (L)'}
                            dataKey="hydration"
                            stroke="#3b82f6"
                            strokeWidth={3}
                            activeDot={{ r: 8 }}
                            isAnimationActive={true}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </motion.div>
                  )}

                  {activeChartTab === 'weight' && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className="h-full w-full"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={weightChartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                          <defs>
                            <linearGradient id="weightGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#1B4D3E" stopOpacity={0.2}/>
                              <stop offset="95%" stopColor="#1B4D3E" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                          <XAxis dataKey="formattedDate" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12, fontWeight: 500}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} domain={['auto', 'auto']} />
                          <Tooltip
                            contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(27, 77, 62, 0.15)', backgroundColor: 'white'}}
                          />
                          <Legend verticalAlign="top" height={36} />
                          <Area
                            type="monotone"
                            name={locale === 'bn' ? 'ওজন (কেজি)' : 'Weight (kg)'}
                            dataKey="weight"
                            stroke="#1B4D3E"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#weightGrad)"
                            isAnimationActive={true}
                          />
                          <Area
                            type="monotone"
                            name={locale === 'bn' ? 'বেসলাইন (কেজি)' : 'Baseline (kg)'}
                            dataKey="baseline"
                            stroke="#C9A961"
                            strokeDasharray="5 5"
                            fill="none"
                            isAnimationActive={true}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </motion.div>
                  )}

                  {activeChartTab === 'vitals' && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className="h-full w-full"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={vitalsChartData} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                          <defs>
                            <linearGradient id="vitalsGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                          <XAxis dataKey="formattedDate" axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12, fontWeight: 500}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#9ca3af', fontSize: 12}} domain={['auto', 'auto']} />
                          <Tooltip
                            contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(236, 72, 153, 0.15)', backgroundColor: 'white'}}
                          />
                          <Legend verticalAlign="top" height={36} />
                          <Area
                            type="monotone"
                            name={locale === 'bn' ? 'হার্ট রেট (বিপিএম)' : 'Heart Rate (bpm)'}
                            dataKey="heartRate"
                            stroke="#ec4899"
                            strokeWidth={3}
                            fillOpacity={1}
                            fill="url(#vitalsGrad)"
                            isAnimationActive={true}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </motion.div>
                  )}

                  {activeChartTab === 'vaccine' && (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4 }}
                      className="h-full w-full flex items-center justify-center"
                    >
                      <div className="w-full h-full max-w-sm flex items-center justify-center relative">
                        {/* Center text overlay showing taken percentage */}
                        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none mt-[-18px]">
                          <p className="text-3xl font-black text-slate-800 dark:text-white leading-none">{vaccineProgress}%</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1.5">{locale === 'bn' ? 'সম্পূর্ণ' : 'Taken'}</p>
                        </div>
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={vaccineChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={80}
                              paddingAngle={5}
                              dataKey="value"
                              isAnimationActive={true}
                            >
                              {vaccineChartData.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 8px 24px rgba(0,0,0,0.08)', backgroundColor: 'white'}}
                              formatter={(value, name) => {
                                const total = vaccineChartData.reduce((sum, item) => sum + item.value, 0);
                                const pct = total > 0 ? Math.round((Number(value) / total) * 100) : 0;
                                return [`${value} (${pct}%)`, name];
                              }}
                            />
                            <Legend verticalAlign="bottom" height={36} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Quick Actions & Progress */}
            <div className="space-y-8">
              
              {/* Quick Actions */}
              <div className="bg-gradient-to-br from-white to-gray-50/50 rounded-3xl p-8 shadow-sm border border-gray-100 hover:shadow-lg transition-all duration-300">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center">
                    <Sparkles size={20} className="text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">{t('dashboard.quickActions')}</h3>
                </div>
                <div className="space-y-3">
                  {quickActions.map((action, idx) => (
                    <motion.button 
                      whileHover={{ scale: 1.03, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      transition={{ type: "spring", stiffness: 400, damping: 17 }}
                      key={idx} 
                      onClick={() => navigate(action.path)}
                      className="shimmer-hover w-full flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-400 to-emerald-500 text-white shadow-md hover:shadow-xl transition-all font-semibold text-sm group relative overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                    >
                      <div className="absolute inset-0 bg-white/0 group-hover:bg-white/10 transition-all" />
                      <div className="relative z-10 w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                        {action.icon}
                      </div>
                      <span className="relative z-10 flex-1 text-left">{action.label}</span>
                      {action.badge !== undefined && action.badge > 0 && (
                        <span className="relative z-10 bg-white text-emerald-600 text-xs font-bold px-3 py-1 rounded-full">
                          {action.badge}
                        </span>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Vaccine Progress Card */}
              <div className="bg-gradient-to-br from-emerald-100/60 via-emerald-50/40 to-white rounded-3xl p-8 shadow-sm border-2 border-emerald-200/70 hover:shadow-lg hover:border-emerald-300 transition-all duration-300 group">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-200/60 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <CheckCircle size={20} className="text-emerald-600" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-900">{t('dashboard.completion')}</h3>
                  </div>
                </div>

                {!loadingData && (dashboardSummary?.vaccineCounts?.total || vaccines.length) === 0 ? (
                  /* Empty state for vaccines */
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle size={32} className="text-emerald-400" />
                    </div>
                    <p className="text-gray-600 mb-4">No vaccines tracked yet</p>
                    <button 
                      onClick={() => navigate('/vaccines')}
                      className="px-6 py-2 bg-gradient-to-r from-emerald-400 to-emerald-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg transition-all hover:scale-105"
                    >
                      Add Vaccines
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="mb-6">
                      <div className="flex justify-between items-end mb-4">
                        <span className="text-sm font-bold text-gray-600 uppercase tracking-wider">Vaccine Progress</span>
                        <span className="text-3xl font-bold text-emerald-600">{loadingData ? '--' : `${vaccineProgress}%`}</span>
                      </div>
                      <div className="h-3 bg-gray-200/50 rounded-full overflow-hidden shadow-sm">
                        <div 
                          className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-lg transition-all duration-1000"
                          style={{ width: `${loadingData ? 0 : vaccineProgress}%` }}
                        ></div>
                      </div>
                    </div>

                    {!loadingData && (
                      <div className="pt-6 border-t border-emerald-200/50">
                        <div className="space-y-3">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-700 font-medium">Total Vaccines</span>
                            <span className="font-bold text-gray-900">{dashboardSummary?.vaccineCounts?.total ?? vaccines.length}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-700 font-medium">Completed</span>
                            <span className="font-bold text-emerald-600">{dashboardSummary?.vaccineCounts?.completed ?? vaccines.filter((vaccine) => vaccine.status === 'Taken').length}</span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-700 font-medium">Due in next {VACCINE_DUE_WINDOW_DAYS} days</span>
                            <span className="font-bold text-amber-600">{vaccinesDueSoonCount}</span>
                          </div>
                          {vaccinesOverdueCount > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-700 font-medium">Overdue</span>
                              <span className="font-bold text-red-600 dark:text-red-400">{vaccinesOverdueCount}</span>
                            </div>
                          )}
                          <button 
                            onClick={() => navigate('/vaccines')}
                            className="w-full mt-4 py-2 bg-gradient-to-r from-emerald-400 to-emerald-500 text-white rounded-xl font-semibold text-sm hover:shadow-lg transition-all hover:scale-105"
                          >
                            View Details
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </Reveal>
      </div>

      {/* Week Modal */}
      {showWeekModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Update Week</h2>
              <button onClick={() => { setTempWeek(currentWeek); setShowWeekModal(false); }} className="p-2 hover:bg-gray-100 rounded-lg transition-all">
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            <div className="space-y-6">
              <p className="text-gray-600">{`Select your pregnancy week (1-${MAX_PREGNANCY_WEEKS}):`}</p>
              
              <div className="flex items-center gap-4">
                <button 
                  onClick={() => setTempWeek(Math.max(1, tempWeek - 1))}
                  className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl font-bold text-lg hover:bg-emerald-200 transition-all"
                >
                  -
                </button>
                
                <div className="flex-1">
                  <input 
                    type="number" 
                    value={tempWeek}
                    onChange={(e) => setTempWeek(Math.min(MAX_PREGNANCY_WEEKS, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-full text-center text-3xl font-bold text-emerald-600 border-2 border-emerald-200 rounded-xl p-3 focus:outline-none focus:border-emerald-500"
                  />
                  <p className="text-xs text-gray-500 text-center mt-2">Weeks</p>
                </div>
                
                <button 
                  onClick={() => setTempWeek(Math.min(MAX_PREGNANCY_WEEKS, tempWeek + 1))}
                  className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl font-bold text-lg hover:bg-emerald-200 transition-all"
                >
                  +
                </button>
              </div>

              <div className="space-y-3">
                <button 
                  onClick={handleWeekUpdate}
                  className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  {t('common.save')}
                </button>
                <button 
                  onClick={() => { setTempWeek(currentWeek); setShowWeekModal(false); }}
                  className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all"
                >
                  {t('common.cancel')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Water Modal */}
      {showWaterModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 animate-in fade-in zoom-in-95 duration-300">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Track Water</h2>
              <button onClick={() => setShowWaterModal(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-all">
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            <div className="space-y-6">
              <p className="text-gray-600 text-center">How many glasses of water have you had today?</p>
              
              {/* Glass Counter Display */}
              <div className="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-2xl p-8 text-center">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <GlassWater size={32} className="text-emerald-500" />
                  <span className="text-5xl font-bold text-emerald-600">{glassCount}</span>
                </div>
                <p className="text-sm text-gray-600">Glasses</p>
              </div>

              {/* Glass Progress Visual */}
              <div className="flex gap-2 justify-center flex-wrap">
                {[...Array(Math.min(glassCount + 1, WATER_VISUAL_MAX))].map((_, i) => {
                  let bgColor = 'border-gray-300 bg-gray-50';
                  let iconColor = 'text-gray-300';
                  
                  if (i < glassCount) {
                    if (glassCount >= HYDRATION_WARNING_GLASSES) {
                      bgColor = 'bg-red-400 border-red-600';
                      iconColor = 'text-white';
                    } else if (glassCount >= HYDRATION_CAUTION_GLASSES) {
                      bgColor = 'bg-amber-400 border-amber-600';
                      iconColor = 'text-white';
                    } else {
                      bgColor = 'bg-emerald-400 border-emerald-600';
                      iconColor = 'text-white';
                    }
                  }
                  
                  return (
                    <div 
                      key={i}
                      className={`w-10 h-12 rounded-lg border-2 flex items-center justify-center transition-all ${bgColor}`}
                    >
                      <GlassWater size={20} className={iconColor} />
                    </div>
                  );
                })}
              </div>

              {/* Warning Message */}
              {waterWarning && (
                <div className={`p-4 rounded-xl flex gap-3 ${
                  waterWarning.severity === 'danger'
                    ? 'bg-red-100 border-l-4 border-red-500'
                    : 'bg-amber-100 border-l-4 border-amber-500'
                }`}>
                  <AlertCircle size={20} className={waterWarning.severity === 'danger' ? 'text-red-600' : 'text-amber-600'} />
                  <p className={waterWarning.severity === 'danger' ? 'text-red-700' : 'text-amber-700'}>
                    {waterWarning.message}
                  </p>
                </div>
              )}

              {/* Add/Remove Buttons */}
              <div className="flex gap-3">
                <button 
                  onClick={handleRemoveGlass}
                  disabled={loadingData || glassCount === 0}
                  className="flex-1 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                >
                  - Remove
                </button>
                <button 
                  onClick={handleAddGlass}
                  disabled={loadingData}
                  className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  + Add Glass
                </button>
              </div>

              <button 
                onClick={() => setShowWaterModal(false)}
                className="w-full py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;



