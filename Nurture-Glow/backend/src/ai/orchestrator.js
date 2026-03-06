/**
 * AI Orchestrator — LOCAL-ONLY Mode (Ollama)
 * 
 * Uses only local models (no cloud API calls):
 * 1. Ollama LLM — local AI model (mistral/gemma) for intelligent responses
 * 2. Risk Predictor — local heuristic scoring for monitoring/BP/glucose questions
 * 3. Fallback Knowledge Base — static responses if Ollama is unavailable
 * 
 * No OpenAI, HuggingFace, or any external API dependency.
 * Works 100% offline, private, zero cost.
 */

import { runOllama, isOllamaAvailable } from './models/ollamaModel.js';
import { runRiskPredictor } from './models/riskPredictorModel.js';
import { runFallback } from './models/fallbackModel.js';

// Cache Ollama availability (re-check every 60s)
let ollamaAvailableCache = null;
let ollamaCacheTime = 0;
const OLLAMA_CACHE_TTL = 60000;

function isOllamaEnabled() {
  const val = String(process.env.ENABLE_OLLAMA || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(val);
}

async function checkOllama() {
  if (!isOllamaEnabled()) return false;
  const now = Date.now();
  if (ollamaAvailableCache !== null && (now - ollamaCacheTime) < OLLAMA_CACHE_TTL) {
    return ollamaAvailableCache;
  }
  ollamaAvailableCache = await isOllamaAvailable();
  ollamaCacheTime = now;
  if (ollamaAvailableCache) {
    console.log('[AI] Ollama is available and ready.');
  } else {
    console.warn('[AI] Ollama not available — will use static knowledge base.');
  }
  return ollamaAvailableCache;
}

const sanitize = (value) => String(value || '').trim();

const intentMatchers = {
  'mental-health': [
    /\banxious\b/, /\banxiety\b/, /\bstress\b/, /\boverwhelm\b/, /\bpanic\b/, /\bsad\b/, /\bdepress\b/,
    /\blonely\b/, /\bcry(ing)?\b/, /\bmental\b/, /\bworried\b/, /\bfear\b/, /\bself-harm\b/, /\bsuicid/i
  ],
  monitoring: [
    /\bbp\b/, /blood\s*pressure/i, /\bpressure\b/, /\bglucose\b/, /\bsugar\b/, /\bheart\s*rate\b/, /\bpulse\b/,
    /\bweight\b/, /\bbmi\b/, /\bweek\b/, /\bweeks\b/, /\bmonitor\b/, /\btracking\b/, /\breading\b/,
    /\d{2,3}\s*\/\s*\d{2,3}/
  ],
  nutrition: [
    /\bfood\b/, /\beat\b/, /\bnutrition\b/, /\bdiet\b/, /\bvitamin\b/, /\bfolic\b/, /\bcalcium\b/,
    /\biron\b/, /\bprotein\b/, /\bhydration\b/, /\bwater\b/, /\bmeal\b/
  ],
  medical: [
    /\bsymptom\b/, /\bpain\b/, /\bfever\b/, /\bbleed\b/, /\bcramp\b/, /\bheadache\b/, /\bnausea\b/,
    /\bdizzy\b/, /\bshortness\b/, /\bpreeclampsia\b/, /\bgestational\b/, /\bdiabetes\b/, /\binfection\b/,
    /\bvaccine\b/, /\bmedication\b/, /\bmedicine\b/, /\btablet\b/
  ]
};

const buildContextSummary = (userData, riskResult) => {
  if (!userData) return '';
  const parts = [];
  const week = userData.week ?? userData.pregnancyWeek;
  if (week) parts.push(`Pregnancy week: ${week}`);
  const bp = userData.blood_pressure || userData.bp;
  if (bp) parts.push(`Blood pressure: ${bp}`);
  if (userData.bp_systolic && userData.bp_diastolic) {
    parts.push(`Blood pressure (numeric): ${userData.bp_systolic}/${userData.bp_diastolic}`);
  }
  if (userData.weight) parts.push(`Weight: ${userData.weight} kg`);
  if (userData.bmi) parts.push(`BMI: ${userData.bmi}`);
  if (userData.age) parts.push(`Age: ${userData.age}`);
  if (userData.medical_conditions) {
    const raw = String(userData.medical_conditions);
    parts.push(`Medical conditions: ${raw.slice(0, 180)}`);
  }
  if (riskResult?.riskLevel) {
    parts.push(`Risk predictor level: ${riskResult.riskLevel}`);
  }
  return parts.join('; ');
};

export function classifyIntent(message) {
  const normalized = sanitize(message).toLowerCase();
  if (!normalized) return 'general';

  for (const [intent, patterns] of Object.entries(intentMatchers)) {
    if (patterns.some((pattern) => pattern.test(normalized))) {
      return intent;
    }
  }

  return 'general';
}

const buildRiskText = (riskResult, locale) => {
  const labelMap = {
    en: { low: 'Low', medium: 'Medium', high: 'High' },
    bn: { low: 'কম', medium: 'মাঝারি', high: 'উচ্চ' }
  };
  const labels = locale === 'bn' ? labelMap.bn : labelMap.en;
  const riskLabel = labels[riskResult.riskLevel] || riskResult.riskLevel;

  const lines = [];
  if (locale === 'bn') {
    lines.push(`ঝুঁকি স্তর: ${riskLabel}`);
    if (riskResult.alerts?.length) {
      lines.push(`সতর্কতা: ${riskResult.alerts.join(' ')}`);
    }
    if (riskResult.recommendations?.length) {
      lines.push('পরামর্শ:');
      riskResult.recommendations.forEach((rec) => lines.push(`- ${rec}`));
    }
  } else {
    lines.push(`Risk level: ${riskLabel}`);
    if (riskResult.alerts?.length) {
      lines.push(`Alerts: ${riskResult.alerts.join(' ')}`);
    }
    if (riskResult.recommendations?.length) {
      lines.push('Recommendations:');
      riskResult.recommendations.forEach((rec) => lines.push(`- ${rec}`));
    }
  }

  return lines.join('\n');
};

export async function routeMessage({
  message,
  locale = 'en',
  intent = 'general',
  userData,
  allowCloud,
  timeoutMs = 15000
}) {
  const fallbackLocale = locale === 'bn' ? 'bn' : 'en';
  const contextSummary = buildContextSummary(userData);
  const ollamaReady = await checkOllama();

  // ---------- LOCAL MODEL 1: Risk Predictor (heuristic scoring) ----------
  // Used for monitoring intent when user data is available
  if (intent === 'monitoring' && userData) {
    try {
      const riskResult = await runRiskPredictor({
        userData,
        locale: fallbackLocale,
        timeoutMs: Math.min(timeoutMs, 2000)
      });

      if (riskResult) {
        let text = buildRiskText(riskResult, fallbackLocale);

        // Enrich with Ollama guidance if available
        if (ollamaReady) {
          try {
            const ollamaGuidance = await runOllama({
              message: `Based on these health readings, provide brief additional guidance:\n${text}\n\nOriginal question: ${message}`,
              locale: fallbackLocale,
              context: buildContextSummary(userData, riskResult),
              timeoutMs: Math.min(timeoutMs, 12000)
            });
            if (ollamaGuidance?.text) {
              text = `${text}\n\n${ollamaGuidance.text}`;
            }
          } catch (ollamaErr) {
            console.warn('[AI] Ollama enrichment failed, using risk data only:', ollamaErr?.message);
          }
        }

        return {
          text,
          modelUsed: 'ollama',
          intent,
          sources: [],
          riskLevel: riskResult.riskLevel
        };
      }
    } catch (err) {
      console.error('[AI] Risk predictor failed:', err?.message || err);
    }
  }

  // ---------- LOCAL MODEL 2: Ollama LLM (primary) ----------
  if (ollamaReady) {
    console.log('[AI] Using Ollama local model.');
    try {
      const ollamaResult = await runOllama({
        message,
        locale: fallbackLocale,
        context: contextSummary || undefined,
        timeoutMs: Math.min(timeoutMs, 15000)
      });
      if (ollamaResult?.text) {
        return {
          text: ollamaResult.text,
          modelUsed: 'ollama',
          intent,
          sources: [],
          riskLevel: ollamaResult.riskLevel
        };
      }
    } catch (ollamaErr) {
      console.error('[AI] Ollama failed:', ollamaErr?.message || ollamaErr);
      // Invalidate cache so next request re-checks
      ollamaAvailableCache = null;
    }
  }

  // ---------- FALLBACK: Static Knowledge Base ----------
  console.log('[AI] Ollama unavailable, using static knowledge base.');
  try {
    const fallbackResult = await runFallback({
      message,
      locale: fallbackLocale,
      intent,
      context: contextSummary || undefined
    });
    if (fallbackResult?.text) {
      return {
        text: fallbackResult.text,
        modelUsed: 'local-ai',
        intent,
        sources: [],
        riskLevel: fallbackResult.riskLevel
      };
    }
  } catch (fbErr) {
    console.error('[AI] Local KB error:', fbErr?.message || fbErr);
  }

  // Ultimate safety net — should never reach here
  return {
    text: fallbackLocale === 'bn'
      ? 'আমি এই মুহূর্তে আপনার প্রশ্নের উত্তর দিতে অক্ষম। অনুগ্রহ করে কিছুক্ষণ পর আবার চেষ্টা করুন অথবা আপনার ডাক্তারের সাথে যোগাযোগ করুন।'
      : 'I apologize, but I\'m having difficulty answering right now. Please try again in a moment, or contact your healthcare provider for immediate assistance.',
    modelUsed: 'local-ai',
    intent,
    sources: [],
    riskLevel: undefined
  };
}
