import express from 'express';
import { query } from '../db.js';
import {
  listEntities,
  createEntity,
  updateEntity,
  deleteEntity,
  getBySubtype,
  upsertBySubtype,
  listCatalog
} from '../appStore.js';
import {
  toTrimmedString,
  toOptionalString,
  isValidId,
  isValidDateValue,
  createNotification,
  parseJson,
  isPlainObject,
  normalizeEnumValue
} from '../utils/index.js';
import { normalizeRoleValue } from '../roles.js';
import { handleAiChat } from '../services/aiService.js';

export function createAiRouter({ requireAuth }) {
  const router = express.Router();

  router.post('/ai/chat', requireAuth, async (req, res, next) => {
    try {
      const { message, locale = 'en', includeContext = false } = req.body || {};
      const result = await handleAiChat({
        message,
        locale,
        userId: req.user.sub,
        includeContext
      });
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // Voice Transcription Endpoint - OpenAI Whisper
  router.post('/ai/transcribe', requireAuth, async (req, res, next) => {
    try {
      const { audio, mimeType = 'audio/webm' } = req.body || {};
      if (!audio) {
        return res.status(400).json({ error: 'Audio data is required' });
      }

      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ error: 'Transcription service not configured' });
      }

      // Convert base64 audio to Buffer
      const audioBuffer = Buffer.from(audio, 'base64');
      if (audioBuffer.length < 100) {
        return res.status(400).json({ error: 'Audio data too small. Please record for longer.' });
      }

      const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
      const fileName = `recording.${ext}`;

      // Use Node.js File API (available in Node 20+) for proper multipart upload
      const file = new File([audioBuffer], fileName, { type: mimeType });

      const formData = new FormData();
      formData.append('file', file);
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'json');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);

      let whisperResponse;
      try {
        whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${apiKey}` },
          body: formData,
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!whisperResponse.ok) {
        const errText = await whisperResponse.text().catch(() => '');
        console.error(`Whisper API error (${whisperResponse.status}):`, errText);
        // Map common OpenAI errors to user-friendly messages
        if (whisperResponse.status === 401) {
          return res.status(502).json({ error: 'AI service authentication failed. Please contact support.' });
        }
        if (whisperResponse.status === 429) {
          const isQuota = errText.includes('insufficient_quota');
          return res.status(502).json({
            error: isQuota
              ? 'OpenAI quota exhausted. Voice transcription is temporarily unavailable. Please type your question instead.'
              : 'AI service rate limited. Please wait a moment and try again.',
            code: isQuota ? 'QUOTA_EXHAUSTED' : 'RATE_LIMITED'
          });
        }
        return res.status(502).json({ error: 'Transcription failed. Please try again.' });
      }

      const data = await whisperResponse.json();
      const text = String(data?.text || '').trim();

      if (!text) {
        return res.json({ text: '', message: 'No speech detected. Please speak clearly and try again.' });
      }

      res.json({ text });
    } catch (error) {
      console.error('Transcription error:', error);
      next(error);
    }
  });

  // Health Insights Endpoint - SQL Query from health_insights table
  router.post('/ai/insights', requireAuth, async (req, res, next) => {
    try {
      const { pregnancyWeek, vaccinesDue, hydrationLevel, locale = 'en' } = req.body;

      // SQL: Fetch wellness tips from health_insights table filtered by locale
      const insightRows = await query(
        'SELECT tip_text FROM health_insights WHERE locale = ? AND is_active = TRUE ORDER BY RAND() LIMIT 3',
        [locale === 'bn' ? 'bn' : 'en']
      );
      const tips = insightRows.map(row => row.tip_text);
      if (tips.length === 0) {
        tips.push('Stay hydrated.', 'Keep tracking your health.', 'Consult your doctor regularly.');
      }

      res.json({ insights: tips });
    } catch (error) {
      console.error('Health Insights Error:', error);
      res.status(500).json({ 
        insights: [
          'Stay hydrated.',
          'Keep tracking your health.',
          'Consult your doctor regularly.'
        ] 
      });
    }
  });

  // Myth Checker Endpoint - SQL Query from pregnancy_myths table
  router.post('/ai/check-myth', requireAuth, async (req, res, next) => {
    try {
      const { statement, locale = 'en' } = req.body;

      if (!statement) {
        return res.status(400).json({ error: 'Statement is required' });
      }

      // SQL: Fetch all myths from pregnancy_myths table filtered by locale
      const mythRows = await query(
        'SELECT myth_keyword, claim, verdict, explanation, safe_advice, when_to_call_doctor, sources_label FROM pregnancy_myths WHERE locale = ? AND is_active = TRUE',
        [locale === 'bn' ? 'bn' : 'en']
      );

      const statementLower = statement.toLowerCase();

      // Search for matching myth using keyword from database
      for (let m of mythRows) {
        if (statementLower.includes(m.myth_keyword.toLowerCase())) {
          return res.json({
            status: m.verdict || 'Myth',
            explanation: m.explanation,
            claim: m.claim,
            safeAdvice: m.safe_advice,
            whenToCallDoctor: m.when_to_call_doctor,
            sourcesLabel: m.sources_label
          });
        }
      }

      // Default response for unknown statements
      res.json({
        status: 'Unknown',
        explanation: locale === 'bn'
          ? 'à¦à¦‡ à¦¬à¦¿à¦·à¦¯à¦¼à§‡ à¦¨à¦¿à¦¶à§à¦šà¦¿à¦¤ à¦¨à¦‡à¥¤ à¦†à¦ªà¦¨à¦¾à¦° à¦¡à¦¾à¦•à§à¦¤à¦¾à¦°à§‡à¦° à¦¸à¦¾à¦¥à§‡ à¦ªà¦°à¦¾à¦®à¦°à§à¦¶ à¦•à¦°à§à¦¨à¥¤'
          : 'I\'m not certain about this. Please consult your healthcare provider.'
      });
    } catch (error) {
      console.error('Myth Check Error:', error);
      res.status(500).json({ 
        status: 'Unknown',
        explanation: 'Unable to verify. Please consult your doctor.' 
      });
    }
  });

  // =====================================================
  // DBMS SQL ENDPOINTS - Replacing Frontend Hardcoded Data
  // =====================================================

  return router;
}
