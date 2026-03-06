/**
 * Ollama Local LLM Model
 * 
 * Connects to a locally running Ollama instance for AI responses.
 * Completely offline, private, and free — no cloud API keys needed.
 * 
 * Supported models: mistral, gemma:2b, gemma, llama3, etc.
 * Default: mistral (best balance of quality and speed for maternal health)
 * 
 * Ollama API docs: https://github.com/ollama/ollama/blob/main/docs/api.md
 */

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'mistral';

const buildPrompt = ({ message, locale, context }) => {
  const language = locale === 'bn' ? 'Bengali' : 'English';
  const contextLine = context ? `\nPatient context: ${context}` : '';

  return `You are a caring and knowledgeable maternal health assistant for a pregnancy wellness app called Nurture Glow.

RULES:
- Respond in ${language}.
- Be warm, empathetic, and supportive.
- Provide evidence-based general wellness guidance only.
- Never diagnose conditions or prescribe medications.
- For any serious symptoms, advise consulting a healthcare provider.
- Keep responses concise (under 200 words).
- Use bullet points for actionable advice.
- End with a brief follow-up question when appropriate.
${contextLine}

User question: ${message}`;
};

export async function runOllama({ message, locale = 'en', context, timeoutMs = 15000 }) {
  const prompt = buildPrompt({ message, locale, context });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        options: {
          temperature: 0.5,
          top_p: 0.9,
          num_predict: 400
        }
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`Ollama returned ${response.status}: ${errText}`);
    }

    const data = await response.json();
    const text = String(data?.response || '').trim();

    if (!text) {
      throw new Error('Ollama returned empty response');
    }

    return { text, modelUsed: 'ollama', sources: [] };
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(`Ollama timed out after ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Check if Ollama is reachable and the configured model is available.
 */
export async function isOllamaAvailable() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${OLLAMA_URL}/api/tags`, {
      signal: controller.signal
    });
    clearTimeout(timeout);
    if (!res.ok) return false;
    const data = await res.json();
    const models = (data?.models || []).map(m => m.name?.split(':')[0]);
    const targetModel = OLLAMA_MODEL.split(':')[0];
    return models.includes(targetModel);
  } catch {
    return false;
  }
}
