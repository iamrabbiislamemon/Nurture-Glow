# N8N Automation Guide for Nurture-Glow

## Overview

N8N is a workflow automation platform that will handle repetitive tasks and integrate your Nurture-Glow app with external services.

## Architecture

```
Nurture-Glow (React + Express)
        ↓
   Backend API (4000)
        ↓
   N8N (5678) ← Workflows & Integrations
        ↓
External Services (Email, SMS, Slack, etc.)
```

---

## 1. Getting Started with N8N

### Start N8N Server
```bash
n8n start
```

Access at: **http://localhost:5678**

### First Login
- No authentication required for localhost
- Create workflows in the UI

---

## 2. Automation Workflows

### Workflow 1: Vaccine Reminder (Daily)

**Trigger:** Every day at 9 AM  
**Action:** Send email/SMS reminders for upcoming vaccines

**Steps:**
1. **Schedule Trigger** (Daily, 9 AM)
2. **HTTP Request** → Call your backend API
   - GET `http://localhost:4000/api/vaccines/due-today`
3. **Loop** → Process each vaccine
4. **Email Node** → Send reminder email
5. **SMS Node** (optional) → Send SMS reminder
6. **DB Node** → Log notification sent

**Pseudocode:**
```javascript
// Trigger: Daily 9 AM
const dueTodayVaccines = await fetch(
  'http://localhost:4000/api/vaccines/due-today'
);

dueTodayVaccines.forEach(vaccine => {
  const user = vaccine.user;
  sendEmail({
    to: user.email,
    subject: `Vaccine Reminder: ${vaccine.name}`,
    body: `Time for your ${vaccine.name} vaccine!`
  });
  
  // Log notification
  await fetch('http://localhost:4000/api/notifications/log', {
    method: 'POST',
    body: { userId: user.id, type: 'VACCINE_REMINDER', vaccineId: vaccine.id }
  });
});
```

---

### Workflow 2: Appointment Confirmation (On-Demand)

**Trigger:** When appointment is booked  
**Action:** Send confirmation email + calendar invite

**Steps:**
1. **Webhook Trigger** (Listen for POST `/api/appointments`)
2. **HTTP Request** → Fetch appointment details
3. **Email Node** → Send confirmation with details
4. **Calendar Node** → Create calendar event (Google/Outlook)
5. **SMS Node** → Send SMS confirmation
6. **Update DB** → Mark email as sent

**Webhook Setup in Backend:**
```javascript
// In your backend (appRoutes.js)
router.post('/api/appointments', async (req, res) => {
  const appointment = await db.createAppointment(req.body);
  
  // Trigger N8N webhook
  await fetch('http://localhost:5678/webhook/appointment-confirm', {
    method: 'POST',
    body: JSON.stringify(appointment)
  });
  
  res.json(appointment);
});
```

---

### Workflow 3: Health Alert (Real-time)

**Trigger:** When health metric is logged  
**Condition:** If metric is outside normal range  
**Action:** Alert user and doctor

**Example:** If BP is too high → Alert user + notify doctor

**Steps:**
1. **Webhook Trigger** (Listen for `/api/health/metric`)
2. **Condition Node** → Check if value is abnormal
3. **If Abnormal:**
   - **Email Node** → Alert user
   - **Email Node** → Notify assigned doctor
   - **Slack Node** (optional) → Alert clinic staff
4. **DB Node** → Log the alert
5. **If Normal:** Just log the metric

---

### Workflow 4: Weekly Community Digest

**Trigger:** Every Friday at 6 PM  
**Action:** Send summary of community posts to subscribers

**Steps:**
1. **Schedule Trigger** (Weekly, Friday 6 PM)
2. **HTTP Request** → Get posts from past week
   - GET `http://localhost:4000/api/community/posts?days=7`
3. **Template Node** → Format HTML email
4. **Get Users** → Fetch all users who want digest
5. **Loop** → Send personalized email to each
6. **Update DB** → Mark digest as sent

---

### Workflow 5: Appointment Reminder (24h before)

**Trigger:** Daily at 8 AM  
**Action:** Remind users of appointments tomorrow

**Steps:**
1. **Schedule Trigger** (Daily, 8 AM)
2. **HTTP Request** → Get appointments for tomorrow
   - GET `http://localhost:4000/api/appointments/tomorrow`
3. **Loop** → Process each appointment
4. **Email Node** → "Your appointment with Dr. Smith tomorrow at 2 PM"
5. **SMS Node** → Optional SMS reminder
6. **Update Reminder Status** → Mark as sent

---

### Workflow 6: Nutrition Intake Reminder

**Trigger:** Twice daily (8 AM & 6 PM)  
**Action:** Remind pregnant women to log nutrition

**Steps:**
1. **Schedule Trigger** (Twice daily)
2. **HTTP Request** → Get users who haven't logged today
3. **Email Node** → "Don't forget to log your meals!"
4. **Push Notification Node** → Mobile notification (if you add Firebase)

---

### Workflow 7: Backup & Export Data

**Trigger:** Daily at midnight  
**Action:** Backup database to cloud storage

**Steps:**
1. **Schedule Trigger** (Daily, 12 AM)
2. **MySQL Node** → Execute backup query
3. **S3 Node** → Upload to AWS S3
4. **Email Node** → Send backup confirmation
5. **Slack Node** → Alert DevOps team

---

### Workflow 8: User Onboarding Sequence

**Trigger:** New user signs up  
**Action:** Welcome email + setup guide + health questionnaire

**Steps:**
1. **Webhook Trigger** (`/api/auth/register`)
2. **Day 0:** Welcome email
3. **Day 1:** "Complete your health profile"
4. **Day 3:** "Here's what to expect this week"
5. **Day 7:** "You've completed week 1!"

---

## 3. API Endpoints Needed in Backend

Add these endpoints to support N8N automations:

```javascript
// appRoutes.js

// Get vaccines due today
router.get('/api/vaccines/due-today', async (req, res) => {
  const vaccines = await db.getVaccinesDueToday();
  res.json(vaccines);
});

// Get appointments for tomorrow
router.get('/api/appointments/tomorrow', async (req, res) => {
  const appts = await db.getAppointmentsTomorrow();
  res.json(appts);
});

// Get community posts from past N days
router.get('/api/community/posts', async (req, res) => {
  const days = req.query.days || 7;
  const posts = await db.getRecentCommunityPosts(days);
  res.json(posts);
});

// Log notifications
router.post('/api/notifications/log', async (req, res) => {
  const notification = await db.logNotification(req.body);
  res.json(notification);
});

// Get users who haven't logged nutrition today
router.get('/api/nutrition/missing-logs', async (req, res) => {
  const users = await db.getUsersMissingNutritionLog();
  res.json(users);
});

// Get health alerts for abnormal metrics
router.get('/api/health/alerts', async (req, res) => {
  const alerts = await db.getHealthAlerts();
  res.json(alerts);
});

// Trigger event for onboarding
router.post('/api/events/user-registered', async (req, res) => {
  // Webhook called by N8N after user signup
  await db.logEvent('USER_REGISTERED', req.body);
  res.json({ success: true });
});
```

---

## 4. N8N Nodes You'll Use

### Essential Nodes:
- **Schedule** - Trigger workflows on a schedule
- **Webhook** - Trigger from your app
- **HTTP Request** - Call your backend API
- **MySQL** - Direct database queries
- **Email** - Send emails (Gmail, Outlook, SMTP)
- **SMS** - Send SMS (Twilio, AWS SNS)
- **Loop** - Process multiple items
- **Condition** - If/else logic
- **Template** - Format data

### Optional Nodes:
- **Slack** - Send Slack messages
- **Google Sheets** - Export data
- **S3** - Cloud storage backup
- **Stripe** - Payment processing
- **Google Calendar** - Calendar events
- **Firebase** - Push notifications

---

## 5. Setup Instructions

### Step 1: Start N8N
```bash
n8n start
```

### Step 2: Create First Workflow

1. Go to http://localhost:5678
2. Click **"New Workflow"**
3. Click **"Add Trigger Node"**
4. Select **"Schedule"**
5. Set to **"Daily"** at **"9:00 AM"**
6. Click the **"+"** to add next node
7. Select **"HTTP Request"**
8. Set method to **GET**
9. URL: `http://localhost:4000/api/vaccines/due-today`
10. Add **Email** node
11. Configure SMTP settings
12. Click **Save & Deploy**

### Step 3: Enable Webhooks

For appointment confirmations, your backend needs to POST to N8N:

```javascript
// After creating appointment in backend
const response = await fetch('http://localhost:5678/webhook/appointment-confirm', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(appointment)
});
```

---

## 6. Email Configuration

### Gmail Setup (Recommended)
1. In N8N, use **Gmail** node
2. Or use SMTP with App Password:
   - Enable 2FA on Gmail
   - Generate App Password
   - Use in N8N Email node

### Outlook
- Use **Outlook** node
- Or SMTP settings

### Custom SMTP
```
Host: smtp.your-provider.com
Port: 587
Username: your-email@example.com
Password: your-password
```

---

## 7. SMS Configuration (Optional)

### Twilio Setup
1. Create Twilio account at twilio.com
2. Get Account SID & Auth Token
3. In N8N, add **Twilio** node
4. Paste credentials
5. Send SMS to users

### AWS SNS
- Alternative to Twilio
- Use in N8N **AWS SNS** node

---

## 8. Database Credentials for N8N

In N8N, configure MySQL connection:
```
Host: localhost
Port: 3306
Database: neonest
Username: root
Password: (your password)
```

---

## 9. Example Workflow: Complete Vaccine Reminder

### JSON Configuration
```json
{
  "name": "Daily Vaccine Reminder",
  "nodes": [
    {
      "type": "n8n-nodes-base.schedule",
      "parameters": {
        "rule": {
          "interval": [1],
          "intervalUnit": "day",
          "triggerAtHour": 9,
          "triggerAtMinute": 0
        }
      }
    },
    {
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "GET",
        "url": "http://localhost:4000/api/vaccines/due-today"
      }
    },
    {
      "type": "n8n-nodes-base.itemLists",
      "parameters": {
        "operation": "splitOutItems"
      }
    },
    {
      "type": "n8n-nodes-base.emailSend",
      "parameters": {
        "to": "={{ $json.user.email }}",
        "subject": "Vaccine Reminder: {{ $json.name }}",
        "textOnly": false,
        "htmlMessage": "<h2>Time for your vaccine!</h2><p>{{ $json.description }}</p>"
      }
    }
  ]
}
```

---

## 10. Monitoring & Debugging

### View Workflow Logs
- N8N Dashboard → Click workflow
- See execution history
- Debug any errors

### Test Webhook
```bash
curl -X POST http://localhost:5678/webhook/appointment-confirm \
  -H "Content-Type: application/json" \
  -d '{"appointmentId": 1, "userId": 1}'
```

---

## 11. Best Practices

✅ **Do:**
- Start with simple workflows (one trigger + one action)
- Test in sandbox first
- Log all notifications sent
- Add error handling
- Monitor workflow executions
- Keep API rate limits in mind

❌ **Don't:**
- Chain too many steps (slow execution)
- Forget to handle errors
- Expose sensitive data in logs
- Run too many simultaneous workflows
- Skip testing before deploying

---

## 12. Next Steps

1. **Start N8N**: `n8n start`
2. **Create first workflow** in the UI
3. **Add API endpoints** to backend
4. **Test with sample data**
5. **Deploy & monitor**
6. **Add more workflows** as needed

---

## 13. Support & Documentation

- N8N Docs: https://docs.n8n.io
- Node Library: https://n8n.io/nodes
- Community: https://community.n8n.io

---

**Your Nurture-Glow app is now ready for intelligent automation! 🚀**
