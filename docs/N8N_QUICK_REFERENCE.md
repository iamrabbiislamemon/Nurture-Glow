# N8N Quick Reference Card

**One-page guide to Nurture-Glow automation**

---

## 🚀 Installation (1 minute)

```powershell
# Install N8N
npm install -g n8n

# Start N8N server
n8n start

# Access UI
http://localhost:5678
```

---

## 🎯 5 Key Workflows

### 1. 💉 Daily Vaccine Reminder
**When:** Every day at 9 AM  
**What:** Send vaccine reminder emails  
**Result:** 🎯 Improves vaccine compliance

### 2. ✅ Appointment Confirmation
**When:** When user books appointment  
**What:** Send email + SMS + calendar invite  
**Result:** 🎯 Instant confirmations

### 3. 🕐 24-Hour Reminder
**When:** Every day at 8 AM  
**What:** Remind users of tomorrow's appointments  
**Result:** 🎯 Reduces no-shows

### 4. 🚨 Health Alert
**When:** Real-time when abnormal metric logged  
**What:** Alert user + doctor + clinic  
**Result:** 🎯 Immediate health response

### 5. 📰 Weekly Digest
**When:** Every Friday at 6 PM  
**What:** Send community summary email  
**Result:** 🎯 Boosts engagement

---

## 🔌 Node Types You'll Use

| Node | Purpose | Example |
|------|---------|---------|
| **Schedule** | Time-based trigger | Daily 9 AM |
| **Webhook** | Event-based trigger | User books appointment |
| **HTTP Request** | Call your API | GET /vaccines/due-today |
| **Email Send** | Send email | Gmail confirmation |
| **SMS** | Send text | Twilio alert |
| **Loop** | Process multiple items | Each vaccine |
| **Condition** | If/else logic | Is abnormal? |
| **Template** | Format text | HTML email |

---

## 🔗 API Endpoints Needed

```javascript
// Vaccines
GET  /api/vaccines/due-today

// Appointments
GET  /api/appointments/tomorrow
GET  /api/appointments/upcoming-week
POST /api/appointments/:id/reminder-sent

// Health
GET  /api/health/alerts
POST /api/health/alert/:id/sent

// Community
GET  /api/community/posts?days=7
GET  /api/community/stats

// Users
GET  /api/users/digest-subscribers
GET  /api/users/missing-nutrition-logs

// Logging
POST /api/notifications/log
GET  /api/notifications/sent
```

---

## 📊 Common Expressions

```javascript
// Get email from JSON
{{ $json.user.email }}

// Current timestamp
{{ new Date().toISOString() }}

// Loop through items
// Use "Split Items" node first, then:
{{ $json.email }}
{{ $json.name }}

// Conditional text
{{ $json.status === 'HIGH' ? 'URGENT' : 'Normal' }}

// Array length
{{ $json.items.length }}

// Format date
{{ new Date($json.date).toLocaleDateString() }}
```

---

## 📧 Email Configuration

### Option A: Gmail OAuth (Recommended)
1. Add "Email Send" node
2. Click "Create New Credential"
3. Select "Gmail"
4. Click "Connect Account"
5. Sign in with Gmail ✅

### Option B: Gmail App Password
1. Gmail Settings → Security → 2FA
2. Generate "App Password"
3. In N8N:
   - SMTP: smtp.gmail.com:587
   - Username: your-email@gmail.com
   - Password: (16-char app password) ✅

---

## 💬 Troubleshooting

| Problem | Solution |
|---------|----------|
| Workflow not running | Check "Active" toggle is ON |
| Email not sending | Verify Gmail credential |
| API call fails | Check backend running on 4000 |
| Database error | Check table/column names exist |
| Webhook not triggering | Verify URL matches in backend |

---

## 📱 URL Reference

```
N8N Dashboard:    http://localhost:5678
N8N Editor:       http://localhost:5678/edit
Your Backend:     http://localhost:4000
Your Frontend:    http://localhost:5173
MySQL:            localhost:3306
```

---

## 🎯 Workflow Building Steps

```
1️⃣  Add Trigger
    └─ Schedule or Webhook

2️⃣  Add Data Node
    └─ HTTP Request to your API

3️⃣  Add Logic (Optional)
    └─ Condition, Loop, Template

4️⃣  Add Action
    └─ Email, SMS, Slack, etc.

5️⃣  Add Logging (Optional)
    └─ Save to database

6️⃣  Test & Deploy
    └─ Click "Test" then "Activate"
```

---

## ⏱️ Timing

| Task | Time |
|------|------|
| Install N8N | 2 min |
| Start N8N | 1 min |
| Create simple workflow | 10 min |
| Test workflow | 5 min |
| Add backend endpoints | 1 hour |
| Create all 5 workflows | 2 hours |
| Full implementation | 4-6 hours |

---

## 💾 Database Tables to Add

```sql
-- Notification logs
CREATE TABLE notification_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  type VARCHAR(50),
  channel VARCHAR(20),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add to appointments
ALTER TABLE appointments ADD confirmation_sent BOOLEAN DEFAULT 0;
ALTER TABLE appointments ADD reminder_sent BOOLEAN DEFAULT 0;

-- Add to health_metrics
ALTER TABLE health_metrics ADD alert_sent BOOLEAN DEFAULT 0;
```

---

## 🎨 Email Template Example

```html
<h2>{{ $json.title }}</h2>
<p>Hi {{ $json.user.name }},</p>
<p>{{ $json.message }}</p>
<ul>
  <li>Time: {{ $json.time }}</li>
  <li>Doctor: {{ $json.doctor }}</li>
  <li>Location: {{ $json.location }}</li>
</ul>
<p><a href="http://localhost:5173">View Details</a></p>
<p>Best regards,<br>Nurture-Glow Team</p>
```

---

## 📊 Success Metrics

Track these after implementation:
```
✅ Workflow success rate: 99%+
✅ Email delivery: 99%+
✅ SMS delivery: 95%+
✅ Execution time: <5 seconds
✅ User satisfaction: Higher
✅ Appointment no-shows: Lower
```

---

## 🚀 Go Live Checklist

```
☑️  Database schema updated
☑️  Backend endpoints added
☑️  N8N installed and running
☑️  Email credentials configured
☑️  All 5 workflows created
☑️  Testing completed
☑️  Frontend integrated
☑️  Production deployed
☑️  Monitoring set up
```

---

## 📞 Support

**N8N Community:** https://community.n8n.io  
**N8N Docs:** https://docs.n8n.io  
**GitHub Issues:** https://github.com/n8n-io/n8n/issues

---

## 🔐 Security Notes

```
✅ Store credentials in N8N secrets
✅ Use HTTPS in production
✅ Enable webhook verification
✅ Validate all input data
✅ Log sensitive operations
✅ Implement rate limiting
```

---

## 📚 Document Guide

| Need | Read |
|------|------|
| Overview | N8N_SUMMARY.md |
| Quick start | N8N_QUICK_START.md |
| Full guide | N8N_AUTOMATION_GUIDE.md |
| System design | N8N_ARCHITECTURE.md |
| Workflows | N8N_WORKFLOW_TEMPLATES.md |
| Implementation | N8N_IMPLEMENTATION_CHECKLIST.md |

---

## ⚙️ Workflow Performance Tips

```
✅ Use database queries when possible
✅ Batch process items in loops
✅ Add error handling
✅ Monitor execution time
✅ Cache when applicable
✅ Optimize HTTP requests

❌ Avoid too many nested loops
❌ Don't make unnecessary API calls
❌ Don't skip error handling
❌ Don't store large data in memory
```

---

## 🎯 Next Steps

1. **Read:** N8N_QUICK_START.md (5 min)
2. **Install:** `npm install -g n8n` (2 min)
3. **Start:** `n8n start` (1 min)
4. **Create:** First workflow (10 min)
5. **Test:** Send test email (5 min)
6. **Deploy:** Full system (4-6 hours)

**Total: 25 minutes to working automation!**

---

**You're all set! Start with `n8n start` 🚀**

Questions? Check N8N_INDEX.md for full documentation links.

Good luck! 🎉
