# N8N Architecture & Integration Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER APPLICATIONS                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────┐              ┌──────────────────┐             │
│  │   Web Browser    │              │   Mobile App     │             │
│  │  (React/Vite)    │              │   (Native/Web)   │             │
│  │  Port: 5173      │              │                  │             │
│  └────────┬─────────┘              └────────┬─────────┘             │
│           │                                  │                       │
└───────────┼──────────────────────────────────┼───────────────────────┘
            │                                  │
            └──────────────┬───────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Express   │
                    │  Backend    │
                    │  Port: 4000 │
                    └──────┬──────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐        ┌────▼────┐       ┌────▼────┐
   │  MySQL  │        │ File    │       │  Redis  │
   │   DB    │        │ Storage │       │ Cache   │
   │         │        │         │       │         │
   └─────────┘        └─────────┘       └─────────┘
        │
        │ (API Calls)
        │
        ▼
┌──────────────────────────────────────────────┐
│         N8N AUTOMATION ENGINE                │
│         Port: 5678                           │
├──────────────────────────────────────────────┤
│                                               │
│  ┌────────────┐  ┌────────────┐ ┌────────┐ │
│  │  Schedule  │  │  Webhook   │ │ Logic  │ │
│  │  Triggers  │  │  Triggers  │ │ Nodes  │ │
│  └────┬───────┘  └────┬───────┘ └───┬────┘ │
│       │               │             │      │
│  ┌────▼───────────────▼─────────────▼────┐ │
│  │  Workflow Execution Engine             │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  ┌────────────────────────────────────┐   │
│  │   Integrations & Destinations      │   │
│  ├────────────────────────────────────┤   │
│  │ ✅ Gmail/SMTP (Email)              │   │
│  │ ✅ Twilio (SMS)                    │   │
│  │ ✅ Slack (Notifications)           │   │
│  │ ✅ Google Calendar (Events)        │   │
│  │ ✅ Webhook (Custom Actions)        │   │
│  │ ✅ Database (MySQL Queries)        │   │
│  │ ✅ Stripe (Payments)               │   │
│  │ ✅ AWS S3 (Backups)                │   │
│  └────────────────────────────────────┘   │
│                                             │
└──────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────┐
│        EXTERNAL SERVICES                     │
├──────────────────────────────────────────────┤
│                                               │
│  📧 Gmail/Outlook (Email Delivery)           │
│  📱 Twilio (SMS Delivery)                    │
│  💬 Slack (Team Notifications)               │
│  📅 Google Calendar (Event Management)       │
│  ☁️  AWS S3 (Cloud Storage)                  │
│  💳 Stripe (Payment Processing)              │
│  📊 Google Sheets (Data Export)              │
│                                               │
└──────────────────────────────────────────────┘
```

---

## Data Flow Examples

### Example 1: Vaccine Reminder Workflow

```
TIME: 9:00 AM Daily
│
├─ Schedule Trigger (9 AM)
│  │
│  ├─ Query MySQL: GET vaccines due today
│  │  │
│  │  └─ Returns: Array of vaccines with user emails
│  │
│  ├─ Loop through each vaccine
│  │  │
│  │  ├─ Get user email and vaccine details
│  │  │
│  │  ├─ Send Email via Gmail SMTP
│  │  │  │
│  │  │  └─ User receives: "Time for your vaccine!"
│  │  │
│  │  ├─ Log notification to MySQL
│  │  │  │
│  │  │  └─ Store: user_id, type, channel, timestamp
│  │  │
│  │  └─ Optional: Send SMS via Twilio
│  │
│  └─ End: Mark as completed
│
RESULT: All due vaccines get reminder emails ✅
```

---

### Example 2: Appointment Confirmation (Real-time)

```
USER BOOKS APPOINTMENT
│
├─ Backend API: POST /api/appointments
│  │
│  ├─ Save to MySQL
│  │
│  └─ Trigger N8N Webhook
│     │
│     └─ POST http://localhost:5678/webhook/appointment-confirm
│        │
│        ├─ N8N receives appointment data
│        │
│        ├─ Send Email (Confirmation)
│        │  │
│        │  └─ User receives email with details
│        │
│        ├─ Send SMS (Optional)
│        │  │
│        │  └─ User receives SMS confirmation
│        │
│        ├─ Create Calendar Event (Google Calendar)
│        │  │
│        │  └─ Event added to user's calendar
│        │
│        └─ Update DB: Mark as sent
│           │
│           └─ Update appointments table
│
RESULT: User confirmed within seconds ✅
```

---

### Example 3: Health Alert (Real-time Conditional)

```
HEALTH METRIC LOGGED
│
├─ User logs: "Blood Pressure: 160/100"
│
├─ Backend API: POST /webhook/health-metric
│  │
│  └─ Trigger N8N Workflow
│     │
│     ├─ Receive metric data
│     │
│     ├─ Condition Check: Is abnormal?
│     │  │
│     │  ├─ YES (160/100 is HIGH)
│     │  │  │
│     │  │  ├─ Email User: "Alert! Your BP is high"
│     │  │  │
│     │  │  ├─ Email Doctor: "Patient alert: High BP"
│     │  │  │
│     │  │  ├─ Send SMS to User: "Alert: High BP"
│     │  │  │
│     │  │  └─ Post to Slack #alerts channel
│     │  │
│     │  └─ NO (Normal)
│     │     │
│     │     └─ Just log and continue
│     │
│     └─ Update DB: Mark alert as sent
│
RESULT: Immediate alerts sent to all parties ✅
```

---

## Workflow Triggers

```
┌─────────────────────────────────────────────┐
│          WORKFLOW TRIGGERS                  │
├─────────────────────────────────────────────┤
│                                              │
│  1️⃣  SCHEDULE (Time-based)                  │
│     ├─ Every day at 9 AM                    │
│     ├─ Every Monday 10 AM                   │
│     ├─ Every Friday 6 PM                    │
│     └─ Every hour, every 5 minutes          │
│                                              │
│  2️⃣  WEBHOOK (Event-based)                  │
│     ├─ Appointment created                  │
│     ├─ Health metric logged                 │
│     ├─ User registered                      │
│     ├─ Community post created               │
│     └─ Custom events from your app          │
│                                              │
│  3️⃣  DATABASE (Data-based)                  │
│     ├─ Query MySQL for conditions           │
│     ├─ Monitor table changes                │
│     └─ Periodic polling                     │
│                                              │
└─────────────────────────────────────────────┘
```

---

## Integration Points with Nurture-Glow

```
┌────────────────────────────────────────────────────────────┐
│  NURTURE-GLOW APP                                          │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  Dashboard                                                 │
│  ├─ Appointment booking → N8N: Trigger confirmation       │
│  ├─ Health logging → N8N: Check for alerts               │
│  ├─ Vaccine tracking → N8N: Schedule reminders            │
│  └─ Community posts → N8N: Digest summaries               │
│                                                             │
│  Profile                                                   │
│  └─ User settings → N8N: Update notification preferences  │
│                                                             │
│  Appointments                                              │
│  ├─ Book appointment → N8N: Send confirmation + SMS       │
│  ├─ 24h before → N8N: Send reminder email                 │
│  └─ Reschedule → N8N: Send updated details                │
│                                                             │
│  Vaccines                                                  │
│  ├─ Daily 9 AM → N8N: Send reminders                      │
│  └─ Vaccine logged → N8N: Update status                   │
│                                                             │
│  Health Metrics                                            │
│  ├─ Metric logged → N8N: Check if abnormal               │
│  └─ Alert sent → N8N: Email user + doctor                │
│                                                             │
│  Community                                                 │
│  ├─ Every Friday 6 PM → N8N: Send weekly digest           │
│  └─ New post → N8N: Notify subscribed users               │
│                                                             │
│  Nutrition                                                 │
│  └─ Daily 8 AM, 6 PM → N8N: Remind to log                │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

---

## Typical Workflow Node Sequence

```
┌─────────────────────────────────────────────────────────┐
│         NODES & CONNECTIONS PATTERN                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  [Trigger]  →  [Data Source]  →  [Logic]  →  [Action]  │
│                                                          │
│  Examples:                                               │
│                                                          │
│  Schedule  →  HTTP Request  →  Condition  →  Email     │
│  (Daily 9AM)  (GET /api/*)   (If abnormal) (Send to X)  │
│                                                          │
│  Webhook   →  MySQL Query   →  Loop       →  Email     │
│  (From app)   (Get users)     (Each item)  (Send each)  │
│                                                          │
│  Schedule  →  Database      →  Template   →  Slack     │
│  (Weekly)     (Get stats)     (Format HTML) (Post msg)  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## Data Mapping in N8N

```javascript
// How data flows through N8N nodes

// Node 1: HTTP Request returns
{
  "vaccines": [
    {
      "id": 1,
      "name": "COVID Booster",
      "user": {
        "email": "user@example.com",
        "name": "Sarah"
      }
    }
  ]
}

// Node 2: Loop processes each item
// $json.vaccines[0].user.email = "user@example.com"
// $json.vaccines[0].name = "COVID Booster"

// Node 3: Email uses mapping
To: {{ $json.user.email }}              // user@example.com
Subject: Vaccine: {{ $json.name }}      // "Vaccine: COVID Booster"
Body: Hi {{ $json.user.name }}          // "Hi Sarah"
```

---

## Performance Considerations

```
┌──────────────────────────────────┐
│   WORKFLOW OPTIMIZATION          │
├──────────────────────────────────┤
│                                   │
│ ✅ DO:                            │
│  ├─ Use database queries          │
│  ├─ Batch process items           │
│  ├─ Cache results when possible   │
│  └─ Monitor execution time        │
│                                   │
│ ❌ DON'T:                         │
│  ├─ Too many HTTP requests        │
│  ├─ Complex nested loops          │
│  ├─ Large data transfers          │
│  └─ No error handling             │
│                                   │
│ TYPICAL EXECUTION TIMES:          │
│  ├─ Simple email: ~2 seconds      │
│  ├─ 100 items loop: ~30 seconds   │
│  ├─ Complex logic: ~5-10 seconds  │
│  └─ Database query: ~1 second     │
│                                   │
└──────────────────────────────────┘
```

---

## Error Handling Flow

```
WORKFLOW EXECUTION
│
├─ Node 1: Success ✅
│
├─ Node 2: Failed ❌
│  │
│  ├─ Error Handler:
│  │  ├─ Send Slack alert
│  │  ├─ Log error to DB
│  │  └─ Retry or skip
│  │
│  └─ Continue to Node 3 (if not critical)
│
├─ Node 3: Success ✅
│
└─ RESULT: Partial success (logged) ⚠️

BEST PRACTICE:
Add error handlers to all HTTP requests and external calls
```

---

## Monitoring & Observability

```
N8N Dashboard
│
├─ Execution History
│  ├─ View each run
│  ├─ Check success/failure
│  └─ See execution time
│
├─ Workflow Performance
│  ├─ Total executions
│  ├─ Success rate
│  ├─ Average duration
│  └─ Error count
│
├─ Node Logs
│  ├─ Input data
│  ├─ Output results
│  ├─ Error messages
│  └─ Timing breakdown
│
└─ Debugging
   ├─ Step-by-step trace
   ├─ Variable inspection
   ├─ Test individual nodes
   └─ Preview output
```

---

## Security Best Practices

```
┌───────────────────────────────────┐
│   SECURITY CONSIDERATIONS         │
├───────────────────────────────────┤
│                                    │
│ 🔒 CREDENTIALS                     │
│  ├─ Store in N8N secrets           │
│  ├─ Never in code/logs             │
│  ├─ Rotate regularly               │
│  └─ Use service accounts           │
│                                    │
│ 🔐 API SECURITY                    │
│  ├─ Use HTTPS only                 │
│  ├─ Require authentication         │
│  ├─ Validate webhook signatures    │
│  └─ Rate limit endpoints           │
│                                    │
│ 🛡️ DATA HANDLING                  │
│  ├─ Don't log sensitive data       │
│  ├─ Encrypt in transit             │
│  ├─ PII compliance (GDPR, etc.)    │
│  └─ Audit trail for changes        │
│                                    │
│ 🔑 WEBHOOK SECURITY               │
│  ├─ Use secret tokens              │
│  ├─ Verify sender                  │
│  ├─ Validate data format           │
│  └─ Implement rate limiting        │
│                                    │
└───────────────────────────────────┘
```

---

**This architecture enables Nurture-Glow to automate healthcare workflows with zero-code integration!** 🚀
