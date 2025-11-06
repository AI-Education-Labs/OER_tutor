# Detailed Chat Logging

Complete logging system for debugging and analyzing chat interactions.

---

## Quick Toggle

**In `backend/routes/chat.py` line 46:**

```python
ENABLE_DETAILED_LOGGING = True   # Logging ON
ENABLE_DETAILED_LOGGING = False  # Logging OFF
```

Change this to turn logging on/off instantly. No other changes needed.

---

## What Gets Logged

When `ENABLE_DETAILED_LOGGING = True`, each chat saves:

✅ User message
✅ All context layers (system prompt, learning plan, student progress, quiz data)
✅ Full message array sent to LLM
✅ LLM call details (model, temperature, response time)
✅ Assistant response
✅ Learning analysis (concepts discussed, understanding level, milestones)
✅ Progress updates made
✅ Any errors

❌ **NOT logged:** Textbook content (too large - just notes the character count)

---

## How to View Logs

### Option 1: Python Script (Easiest)

```bash
# View last 5 logs
python -m backend.scripts.view_chat_logs

# View specific session
python -m backend.scripts.view_chat_logs <session_id>

# View last 10 logs
python -m backend.scripts.view_chat_logs "" 10
```

### Option 2: API Endpoint

```bash
# Get your recent logs
curl http://localhost:8000/chat/logs \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get specific session
curl "http://localhost:8000/chat/logs?session_id=SESSION_ID&limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Option 3: MongoDB Directly

```javascript
// In MongoDB Compass or shell
db.detailed_chat_logs.find().sort({created_at: -1}).limit(5)
```

---

## Example Log Output

```
================================================================================
DETAILED CHAT LOG: log_abc123456
================================================================================
Session: session_xyz
User: user123
Textbook: textbook-uuid, Chapter: 1

--- USER MESSAGE ---
What is the scientific method?

--- CONTEXT LAYERS ---
[1] SYSTEM_PROMPT
You are an engaging tutor...

[2] LEARNING_PLAN
Learning Plan for Chapter 1: What is Physics?
- Scientific Method: Understand the systematic approach...

[3] STUDENT_PROGRESS
- Completed objectives: None yet
- Overall progress: 0%

[4] QUIZ_DATA
- Quiz Performance: 1 quiz, 75% average
- Missed concepts: Force Vectors

[5] TEXTBOOK_CONTENT
[Chapter content: 50000 characters - NOT LOGGED TO SAVE SPACE]

--- ASSISTANT RESPONSE ---
The scientific method is a systematic approach...

--- LEARNING ANALYSIS ---
Concepts discussed: Scientific Method
Understanding demonstrated:
  - Scientific Method: partial
Milestone reached: Discussed scientific method steps
Student engagement: engaged

--- PROGRESS UPDATES ---
{
  "concept_mastery.Scientific Method": {"understanding_level": "partial"}
}
```

---

## Storage

- **Collection:** `detailed_chat_logs` in MongoDB
- **Size:** ~5-10KB per log (without textbook content)
- **Retention:** Keep as long as needed, delete old logs manually if desired

---

## Use Cases

1. **Debug Issues** - See exactly what context LLM received
2. **Improve Prompts** - Analyze if learning plan is working
3. **Check Analysis** - Verify learning analysis is accurate
4. **Share with Me** - Copy/paste logs for me to review and improve system

---

## Performance Impact

**Minimal:**
- Logging happens in background tasks (non-blocking)
- ~0.1-0.2 seconds added per chat
- No impact on user experience

**To Disable:**
Set `ENABLE_DETAILED_LOGGING = False` - zero overhead

---

## Testing

```bash
# 1. Ensure logging is ON
# Check line 46 in backend/routes/chat.py

# 2. Restart backend
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

# 3. Have a conversation

# 4. View logs
python -m backend.scripts.view_chat_logs

# 5. Copy and send me the output!
```

---

**Last Updated:** January 2025
