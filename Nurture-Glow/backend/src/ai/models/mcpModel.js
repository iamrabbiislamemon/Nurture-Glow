import 'dotenv/config';

const MCP_BASE_URL = process.env.MCP_BASE_URL || `http://localhost:${process.env.PORT || 4000}/api/mcp`;
const DEFAULT_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// In-memory cache for MCP prompt and tools to minimize latency
let cache = {
  prompt: null,
  tools: null,
  timestamp: 0
};
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function fetchMcpData() {
  const now = Date.now();
  if (cache.prompt && cache.tools && (now - cache.timestamp) < CACHE_TTL_MS) {
    return cache;
  }

  try {
    console.log('[MCP] Fetching tools and prompt from Render MCP server...');
    const [promptRes, toolsRes] = await Promise.all([
      fetch(`${MCP_BASE_URL}/assistant/prompt`),
      fetch(`${MCP_BASE_URL}/tools/list`)
    ]);

    if (!promptRes.ok || !toolsRes.ok) {
      throw new Error(`Failed to fetch MCP config. Prompt Status: ${promptRes.status}, Tools Status: ${toolsRes.status}`);
    }

    const promptData = await promptRes.json();
    const toolsData = await toolsRes.json();

    cache = {
      prompt: promptData,
      tools: toolsData.tools || [],
      timestamp: now
    };
    return cache;
  } catch (err) {
    console.error('[MCP] Error fetching config from MCP server:', err.message);
    // If cache exists, fall back to cached data even if expired
    if (cache.prompt && cache.tools) {
      console.warn('[MCP] Falling back to expired cache.');
      return cache;
    }
    throw err;
  }
}

function buildSystemPrompt(promptData, context) {
  const parts = [
    promptData.system_prompt || 'You are an MCP tool-using AI assistant.'
  ];

  if (promptData.response_format) {
    parts.push('\nRESPONSE FORMAT GUIDANCE:');
    if (Array.isArray(promptData.response_format.sections)) {
      parts.push(`- Strictly structure your response into sections: ${promptData.response_format.sections.join(', ')}`);
    }
    if (Array.isArray(promptData.response_format.guidance)) {
      promptData.response_format.guidance.forEach(g => parts.push(`- ${g}`));
    }
  }

  if (Array.isArray(promptData.retrieval_policy)) {
    parts.push('\nRETRIEVAL POLICY:');
    promptData.retrieval_policy.forEach(p => parts.push(`- ${p}`));
  }

  if (Array.isArray(promptData.tool_usage_rules)) {
    parts.push('\nTOOL USAGE RULES:');
    promptData.tool_usage_rules.forEach(r => parts.push(`- ${r}`));
  }

  if (context) {
    parts.push(`\nPATIENT CONTEXT (Use this to customize your responses when relevant):\n${context}`);
  }

  return parts.join('\n');
}

export async function runMcpAssistant({ message, locale = 'en', context, timeoutMs = 60000 }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  if (apiKey.startsWith('eyJ')) {
    throw new Error('OPENAI_API_KEY is invalid (JWT token detected)');
  }

  const isGemini = apiKey.startsWith('AQ.') || apiKey.startsWith('AIza');
  
  let completionsUrl;
  if (process.env.OPENAI_BASE_URL) {
    const baseUrl = process.env.OPENAI_BASE_URL.replace(/\/$/, '');
    completionsUrl = `${baseUrl}/chat/completions`;
  } else {
    completionsUrl = isGemini 
      ? 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions'
      : 'https://api.openai.com/v1/chat/completions';
  }
  
  const modelToUse = process.env.OPENAI_MODEL || (isGemini ? 'gemini-2.5-flash' : DEFAULT_MODEL);

  // 1. Fetch prompt and tools schema from the MCP server
  const { prompt: promptData, tools: mcpTools } = await fetchMcpData();

  // 2. Build system instruction prompt
  const systemPrompt = buildSystemPrompt(promptData, context);

  // 3. Map MCP tools to OpenAI function call format
  const tools = mcpTools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }
  }));

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: message }
  ];

  let loopCount = 0;
  const maxLoops = 5;

  // 4. OpenAI Completions Tool-Calling Loop
  while (loopCount < maxLoops) {
    const payload = {
      model: modelToUse,
      messages,
      temperature: 0.4,
      max_tokens: 600
    };

    if (modelToUse === 'nvidia/nemotron-3-ultra-550b-a55b') {
      payload.extra_body = {
        chat_template_kwargs: { enable_thinking: true },
        reasoning_budget: 16384
      };
      payload.max_tokens = 4096; // Adjust max response tokens (prevent huge payloads/timeouts)
    }

    if (tools.length > 0) {
      payload.tools = tools;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response;
    try {
      response = await fetch(completionsUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`OpenAI completions timed out after ${timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const raw = await response.text().catch(() => '');
      throw new Error(`OpenAI completions failed (${response.status}): ${raw || 'unknown error'}`);
    }

    const data = await response.json();
    const choice = data?.choices?.[0];
    const messageObj = choice?.message;

    if (!messageObj) {
      throw new Error('OpenAI returned an empty choice list');
    }

    // Push the assistant response to messages history
    messages.push({
      role: 'assistant',
      content: messageObj.content || null,
      tool_calls: messageObj.tool_calls || undefined
    });

    // Handle tool calls if requested
    if (messageObj.tool_calls && messageObj.tool_calls.length > 0) {
      for (const toolCall of messageObj.tool_calls) {
        const { id, function: fn } = toolCall;
        const name = fn.name;
        
        let args;
        try {
          args = typeof fn.arguments === 'string' ? JSON.parse(fn.arguments) : fn.arguments;
        } catch {
          args = {};
        }

        console.log(`[MCP] Executing tool '${name}' via Render MCP server...`);
        let toolResult;
        try {
          const callRes = await fetch(`${MCP_BASE_URL}/tools/call`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, arguments: args })
          });

          if (!callRes.ok) {
            throw new Error(`MCP tool call returned HTTP ${callRes.status}`);
          }

          toolResult = await callRes.json();
        } catch (toolErr) {
          console.error(`[MCP] Tool '${name}' call failed:`, toolErr.message);
          // Return the error directly to the LLM so it knows the call failed and can fall back
          toolResult = { success: false, error: toolErr.message };
        }

        messages.push({
          role: 'tool',
          tool_call_id: id,
          content: JSON.stringify(toolResult)
        });
      }
      loopCount++;
    } else {
      // No tool calls needed, this is the final answer
      return {
        text: String(messageObj.content || '').trim(),
        modelUsed: 'gpt4-mcp',
        sources: []
      };
    }
  }

  throw new Error('Exceeded maximum tool calling loop iterations');
}
