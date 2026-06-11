import express from 'express';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const router = express.Router();

// Helper to run the Python Qdrant RAG client
async function queryPythonRag(queryText) {
  try {
    // 🚀 Speed Optimization: Try querying the running RAG HTTP server first (response in <0.5 seconds!)
    console.log(`[MCP Router] Querying background RAG HTTP server for query: "${queryText}"`);
    const res = await fetch('http://localhost:5005/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: queryText, top_k: 5 })
    });
    
    if (res.ok) {
      const data = await res.json();
      return data.results || [];
    }
    console.warn(`[MCP Router] RAG HTTP server returned status ${res.status}, falling back to CLI spawn`);
  } catch (err) {
    console.warn(`[MCP Router] RAG HTTP server not reachable (${err.message}), falling back to CLI spawn`);
  }

  return new Promise((resolve, reject) => {
    // Resolve absolute path to query_qdrant.py
    const scriptPath = path.resolve(__dirname, '../../../../cloud_rag/query_qdrant.py');
    console.log(`[MCP Router] Spawning python for RAG (slow fallback): ${scriptPath} with query: "${queryText}"`);
    const py = spawn('python', [scriptPath, queryText]);
    
    let stdout = '';
    let stderr = '';
    
    py.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    py.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    py.on('close', (code) => {
      if (code !== 0) {
        console.error(`[MCP Router] Python process exited with code ${code}. Stderr: ${stderr}`);
        return reject(new Error(stderr || `Python process exited with code ${code}`));
      }
      try {
        const parsed = JSON.parse(stdout);
        if (parsed.error) {
          return reject(new Error(parsed.error));
        }
        resolve(parsed.results || []);
      } catch (err) {
        console.error(`[MCP Router] Failed to parse stdout: ${stdout}`);
        reject(new Error(`Failed to parse Python output: ${err.message}`));
      }
    });
  });
}

// Time parsing and formatting helpers
function parseTime(timeStr) {
  const parts = timeStr.split(':').map(Number);
  const d = new Date();
  d.setHours(parts[0], parts[1], parts[2] || 0, 0);
  return d;
}

function formatTime(date) {
  let h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  h = h ? h : 12;
  return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
}

function normalizeTime(timeStr) {
  // Try to normalize times like "9:00 AM", "09:00", "09:00:00" to comparison string "09:00 AM"
  try {
    let raw = String(timeStr).trim().toUpperCase();
    if (raw.endsWith('AM') || raw.endsWith('PM')) {
      const match = raw.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/);
      if (match) {
        const h = String(Number(match[1])).padStart(2, '0');
        return `${h}:${match[2]} ${match[3]}`;
      }
    } else {
      const match = raw.match(/(\d{1,2}):(\d{2})/);
      if (match) {
        let h = Number(match[1]);
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12;
        h = h ? h : 12;
        return `${String(h).padStart(2, '0')}:${match[2]} ${ampm}`;
      }
    }
  } catch {}
  return timeStr;
}

// Helper to generate 30-min availability slots for a database availability row
function generateSlots(availabilityRows) {
  const slots = [];
  for (const row of availabilityRows) {
    let current = parseTime(row.start_time);
    const end = parseTime(row.end_time);
    const duration = row.slot_duration_minutes || 30;
    while (current.getTime() + duration * 60 * 1000 <= end.getTime()) {
      slots.push(formatTime(current));
      current = new Date(current.getTime() + duration * 60 * 1000);
    }
  }
  return slots;
}

// Day of week normalizer
function getDayName(dayVal) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  if (typeof dayVal === 'number' || !isNaN(Number(dayVal))) {
    return days[Number(dayVal) % 7];
  }
  const str = String(dayVal || '').trim().toLowerCase();
  const matched = days.find(d => d.toLowerCase() === str);
  return matched || dayVal;
}

// Endpoints
router.get('/assistant/prompt', (req, res) => {
  res.json({
    name: "MCP Medical Assistant",
    mode: "tool-using",
    system_prompt: "You are a warm, caring, and empathetic maternal care assistant for Nurture Glow. Answer the mother's questions using database and textbook tools. NEVER mention database IDs, UUIDs, tools, APIs, function names, or programming concepts. Replace any doctor IDs with the actual doctor's name, specialization, or hospital details. Keep responses structured and easy to read for a non-technical mother. Clearly separate your response into: Summary, Details, and Action Plan. CRITICAL: You must only call at most one tool at a time. Never output multiple tool calls in parallel.",
    response_format: {
      sections: ["Summary", "Details", "Action Plan"],
      guidance: [
        "Summary should provide a warm, direct, and simple response to the mother's question (1-2 sentences).",
        "Details should explain any health advice, symptoms, or doctor details in plain language. Never expose technical IDs or code names.",
        "Action Plan should list clear, actionable next steps for the mother to take, including who to consult or when to seek immediate care."
      ]
    },
    retrieval_policy: [
      "Use fetched medical documents when available, and prefer them over general knowledge.",
      "If context is missing, answer from general knowledge without inventing facts.",
      "If multiple sources conflict, note the conflict instead of choosing silently.",
      "Do not invent document content or tool output."
    ],
    tool_usage_rules: [
      "You must only call at most one tool at a time. If you need information from multiple tools, call one tool first, wait for the result, and then call the next tool in the subsequent turn.",
      "Call search_symptoms() for symptom-based questions.",
      "Call get_disease_info() when the user asks about a condition or disease.",
      "Call recommend_doctor() when the user needs a specialist recommendation.",
      "Call fetch_medical_docs() when authoritative retrieved context is needed."
    ]
  });
});

router.get('/tools/list', (req, res) => {
  res.json({
    tools: [
      {
        name: "search_symptoms",
        description: "Search nursing textbook for maternal or newborn symptoms.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "The maternal or newborn symptoms to search for." }
          },
          required: ["query"],
          additionalProperties: false
        }
      },
      {
        name: "get_disease_info",
        description: "Get information about maternal/newborn conditions or diseases from the nursing textbook.",
        inputSchema: {
          type: "object",
          properties: {
            disease: { type: "string", description: "The condition or disease to look up." }
          },
          required: ["disease"],
          additionalProperties: false
        }
      },
      {
        name: "fetch_medical_docs",
        description: "Fetch authoritative medical textbook documents for a pregnancy, childbirth, or newborn care search query.",
        inputSchema: {
          type: "object",
          properties: {
            query: { type: "string", description: "The query to search textbook documents for." }
          },
          required: ["query"],
          additionalProperties: false
        }
      },
      {
        name: "recommend_doctor",
        description: "Search local verified doctors by their specialty or specialization (e.g. Gynecologist, Pediatrician).",
        inputSchema: {
          type: "object",
          properties: {
            specialty: { type: "string", description: "The doctor specialty to find." }
          },
          required: ["specialty"],
          additionalProperties: false
        }
      },
      {
        name: "get_doctor_schedule",
        description: "Get the full availability schedule for a doctor.",
        inputSchema: {
          type: "object",
          properties: {
            doctor_id: { type: "string", description: "The doctor's unique ID." }
          },
          required: ["doctor_id"],
          additionalProperties: false
        }
      },
      {
        name: "get_available_slots",
        description: "Get available consultation slots for a doctor on a day of the week.",
        inputSchema: {
          type: "object",
          properties: {
            doctor_id: { type: "string", description: "The doctor's unique ID." },
            day_of_week: { type: ["integer", "string"], description: "0-6 or weekday name (e.g. Sunday)" }
          },
          required: ["doctor_id", "day_of_week"],
          additionalProperties: false
        }
      },
      {
        name: "check_slot_availability",
        description: "Check whether a doctor is available at a specific time on a day of the week.",
        inputSchema: {
          type: "object",
          properties: {
            doctor_id: { type: "string", description: "The doctor's unique ID." },
            day_of_week: { type: ["integer", "string"], description: "0-6 or weekday name (e.g. Sunday)" },
            time: { type: "string", description: "HH:MM or HH:MM AM/PM" }
          },
          required: ["doctor_id", "day_of_week", "time"],
          additionalProperties: false
        }
      },
      {
        name: "get_today_schedule",
        description: "Get the current weekday schedule for a doctor.",
        inputSchema: {
          type: "object",
          properties: {
            doctor_id: { type: "string", description: "The doctor's unique ID." }
          },
          required: ["doctor_id"],
          additionalProperties: false
        }
      },
      {
        name: "get_week_schedule",
        description: "Get the weekly schedule for a doctor.",
        inputSchema: {
          type: "object",
          properties: {
            doctor_id: { type: "string", description: "The doctor's unique ID." }
          },
          required: ["doctor_id"],
          additionalProperties: false
        }
      }
    ]
  });
});

router.post('/tools/call', async (req, res) => {
  const { name, arguments: args } = req.body || {};
  console.log(`[MCP Router] Received tool call: ${name}`, args);

  try {
    switch (name) {
      case 'search_symptoms':
      case 'fetch_medical_docs': {
        const queryText = args.query;
        const results = await queryPythonRag(queryText);
        return res.json({ success: true, results });
      }
      
      case 'get_disease_info': {
        const queryText = args.disease;
        const results = await queryPythonRag(queryText);
        return res.json({ success: true, results });
      }

      case 'recommend_doctor': {
        const specialty = args.specialty;
        const doctors = await query(
          `SELECT d.id, d.full_name, d.specialization, d.hospital, d.location, d.experience_years, d.phone, d.email, d.fee_amount, d.rating, d.available_time, d.availability_status, s.name AS specialty_name 
           FROM doctors d 
           LEFT JOIN doctor_specialties s ON d.specialty_id = s.id 
           WHERE d.verified = TRUE AND (s.name LIKE ? OR d.specialization LIKE ? OR d.full_name LIKE ?)`,
          [`%${specialty}%`, `%${specialty}%`, `%${specialty}%`]
        );
        return res.json({ success: true, doctors });
      }

      case 'get_doctor_schedule': {
        const schedule = await query(
          'SELECT id, doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, max_consultations FROM doctor_availability_slots WHERE doctor_id = ?',
          [args.doctor_id]
        );
        return res.json({ success: true, schedule });
      }

      case 'get_available_slots': {
        const dayName = getDayName(args.day_of_week);
        const rows = await query(
          'SELECT start_time, end_time, slot_duration_minutes FROM doctor_availability_slots WHERE doctor_id = ? AND LOWER(day_of_week) = LOWER(?)',
          [args.doctor_id, dayName]
        );
        const slots = generateSlots(rows);
        return res.json({ success: true, slots });
      }

      case 'check_slot_availability': {
        const dayName = getDayName(args.day_of_week);
        const rows = await query(
          'SELECT start_time, end_time, slot_duration_minutes FROM doctor_availability_slots WHERE doctor_id = ? AND LOWER(day_of_week) = LOWER(?)',
          [args.doctor_id, dayName]
        );
        const slots = generateSlots(rows);
        const normalizedInputTime = normalizeTime(args.time);
        
        const isAvailable = slots.some(slot => normalizeTime(slot) === normalizedInputTime);
        return res.json({ success: true, available: isAvailable, time_checked: args.time, day_checked: dayName });
      }

      case 'get_today_schedule': {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const todayName = days[new Date().getDay()];
        const rows = await query(
          'SELECT start_time, end_time, slot_duration_minutes FROM doctor_availability_slots WHERE doctor_id = ? AND LOWER(day_of_week) = LOWER(?)',
          [args.doctor_id, todayName]
        );
        const slots = generateSlots(rows);
        return res.json({ success: true, day: todayName, slots });
      }

      case 'get_week_schedule': {
        const schedule = await query(
          'SELECT day_of_week, start_time, end_time, slot_duration_minutes FROM doctor_availability_slots WHERE doctor_id = ?',
          [args.doctor_id]
        );
        
        const grouped = {};
        for (const row of schedule) {
          const day = row.day_of_week;
          if (!grouped[day]) grouped[day] = [];
          grouped[day].push(row);
        }
        
        const weekSchedule = {};
        for (const [day, rows] of Object.entries(grouped)) {
          weekSchedule[day] = generateSlots(rows);
        }
        
        return res.json({ success: true, weekSchedule });
      }

      default:
        return res.status(400).json({ error: `Tool ${name} not found` });
    }
  } catch (error) {
    console.error(`[MCP Router] Tool execution error for ${name}:`, error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
