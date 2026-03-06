# 🎯 Ask AI Feature - Quick Reference

## Purpose
General wellness questions only. NOT for medical advice.

## What It Does ✅
- Answers nutrition, exercise, sleep questions
- Checks common pregnancy myths
- Provides wellness insights
- **Blocks all medical questions**

## What It Refuses ❌
- Symptoms & pain
- Medications & drugs
- Diagnosis & treatment
- Medical emergencies
- Any health condition

## How It Works

### Mode 1: Ollama (Optional - Smart Responses)
```
User question → Safety check → Ollama AI → Smart answer
```
Install Ollama for smarter responses (optional)

### Mode 2: Built-in (Current - Always Works)
```
User question → Safety check → Curated response → Safe answer
```
No setup needed, works immediately

### Mode 3: Blocked (Safety)
```
User question → Detect keywords → BLOCK → "Consult doctor"
```
Protects users from bad advice

## Examples

✅ **Good Questions:**
- "What foods should I eat?"
- "Can I exercise?"
- "How much sleep do I need?"

❌ **Blocked Questions:**
- "I have back pain"
- "What medicine should I take?"
- "Is this symptom normal?"

## Features

| Feature | Status | Setup |
|---------|--------|-------|
| Chat Assistant | ✅ Working | None |
| Health Insights | ✅ Working | None |
| Myth Checker | ✅ Working | None |
| Ollama (optional) | 🔷 Enhanced | Download Ollama.ai |

## No Setup Required
- No API key needed
- Works immediately
- No configuration
- No costs

## Safety Features
- Keyword blocking (18+ sensitive terms)
- Medical redirect ("Consult your doctor")
- Curated responses (manually verified)
- Bilingual (English & Bengali)

## To Use Right Now
1. Restart backend (it has code changes)
2. Go to http://localhost:5173
3. Try Ask Assistant
4. Ask something safe like "What's good nutrition?"
5. It should respond immediately ✅

---

That's it! **Zero setup. Safe by default. Ready to use.** 🚀
