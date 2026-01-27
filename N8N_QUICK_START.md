# N8N Quick Start Guide

## ⚡ Get Started in 5 Minutes

### Step 1: Start N8N Server (in a new terminal)

```powershell
# Windows PowerShell
n8n start

# Then access: http://localhost:5678
```

**You should see:**
```
╭────────────────────────────────────────────────────╮
│ n8n ready on 0.0.0.0:5678                         │
│ http://localhost:5678                             │
│ Editor: http://localhost:5678/edit                │
╰────────────────────────────────────────────────────╯
```

---

### Step 2: Create Your First Workflow (2 min)

#### A. Create New Workflow
1. Go to http://localhost:5678
2. Click **"New Workflow"**
3. Name it: **"Daily Vaccine Reminder"**

#### B. Add Trigger
1. Click **"Add Trigger"**
2. Search for **"Schedule"**
3. Select **Schedule**
4. Set to:
   - **Frequency:** Every day
   - **Time:** 9:00 AM

#### C. Add Action
1. Click the **"+"** icon to add next node
2. Search for **"HTTP Request"**
3. Configure:
   - **Method:** GET
   - **URL:** `http://localhost:4000/api/vaccines/due-today`

#### D. Add Email
1. Click **"+"** to add next node
2. Search for **"Email Send"**
3. Configure Gmail:
   - Click **"Create New Credential"**
   - Select **"Gmail"**
   - Click **"Connect Account"**
   - Authorize with your Gmail

#### E. Map Email Fields
- **To:** `{{ $json[0].email }}`
- **Subject:** `Vaccine Reminder: {{ $json[0].vaccineName }}`
- **Body:** Create your HTML template

#### F. Deploy
1. Click **"Save"** (top right)
2. Click **"Activate"** toggle
3. ✅ Workflow is now running!

---

### Step 3: Test the Workflow

#### Manual Test
1. Click **"Test Workflow"** button
2. Check **Execution History** for results
3. View sent emails in Gmail

#### View Logs
```powershell
# In N8N UI, click on workflow
# See all execution history with timestamps and results
```

---

## 📋 Common Workflows to Create

### Workflow List
✅ **Daily Vaccine Reminder** (9 AM)
✅ **Appointment Confirmation** (on-demand)
✅ **24-Hour Appointment Reminder** (8 AM)
✅ **Health Alert** (real-time)
✅ **Weekly Digest** (Friday 6 PM)
✅ **Nutrition Reminder** (8 AM, 6 PM)
✅ **User Onboarding** (day 0, 1, 3, 7)

---

## 🔧 Configuration

### Gmail Setup

**Option 1: Gmail OAuth (Recommended)**
```
1. In N8N, select "Gmail" node
2. Click "Create New Credential"
3. Authorize with your Gmail account
4. Done! ✅
```

**Option 2: App Password**
```
1. Gmail Settings → Security
2. Enable 2-Factor Authentication
3. Generate "App Password" for N8N
4. Use in N8N Email settings
```

### Twilio SMS (Optional)

```
1. Create Twilio account: twilio.com
2. Get: Account SID, Auth Token, Phone Number
3. In N8N, click "Create New Credential"
4. Select "Twilio"
5. Paste credentials
```

---

## 📊 Workflow Examples

### Example 1: Vaccine Reminder (Simplest)

```
Schedule (Daily 9 AM)
    ↓
HTTP Request (GET /api/vaccines/due-today)
    ↓
Email Send (To each user)
    ↓
HTTP Request (POST /api/notifications/log)
```

### Example 2: Appointment Confirmation (Real-time)

```
Webhook (From backend when appointment created)
    ↓
Email Send (Confirmation email)
    ↓
SMS Send (Twilio confirmation)
    ↓
HTTP Request (POST /api/appointments/:id/confirm-sent)
```

### Example 3: Health Alert (Conditional)

```
Webhook (Health metric posted)
    ↓
If Condition (Status = abnormal?)
    ├─ YES:
    │   ├─ Email to User
    │   ├─ Email to Doctor
    │   └─ Slack to Clinic
    └─ NO: (skip)
```

---

## 🎯 Implementation Checklist

### Database Setup
- [ ] Add `notification_logs` table
- [ ] Add `confirm_sent` to appointments
- [ ] Add `reminder_sent` to appointments
- [ ] Add `alert_sent` to health_metrics

### Backend Setup
- [ ] Add N8N endpoints (see N8N_API_ENDPOINTS.js)
- [ ] Test each endpoint with curl/Postman
- [ ] Enable CORS for N8N (localhost:5678)
- [ ] Deploy endpoints to production

### N8N Setup
- [ ] Start N8N server
- [ ] Create Gmail credential
- [ ] Create first workflow
- [ ] Test with real data
- [ ] Deploy to production

### Testing
- [ ] [ ] Manual test each workflow
- [ ] [ ] Check email inbox
- [ ] [ ] Verify notification logs
- [ ] [ ] Monitor execution history

---

## 🚀 Go Live

### Before Production:
1. **Test all workflows** in sandbox
2. **Verify email delivery** works
3. **Monitor execution logs** for errors
4. **Set up error notifications** (Slack/Email)
5. **Document all workflows** with descriptions

### Production Deployment:
```bash
# On your server:
n8n start --secure --ssl --sslkey=/path/to/key.pem --sslcert=/path/to/cert.pem

# Or use PM2 to keep it running:
npm install -g pm2
pm2 start n8n --name "n8n-nurture-glow"
pm2 save
pm2 startup
```

---

## 📝 Database Schema Additions

Add these tables to support N8N logging:

```sql
-- Notification logs
CREATE TABLE notification_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  type VARCHAR(50),
  channel VARCHAR(20),
  vaccine_id INT,
  appointment_id INT,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Update existing tables
ALTER TABLE appointments ADD COLUMN confirm_sent BOOLEAN DEFAULT 0;
ALTER TABLE appointments ADD COLUMN confirm_sent_at TIMESTAMP;
ALTER TABLE appointments ADD COLUMN reminder_sent BOOLEAN DEFAULT 0;
ALTER TABLE appointments ADD COLUMN reminder_sent_at TIMESTAMP;

ALTER TABLE health_metrics ADD COLUMN alert_sent BOOLEAN DEFAULT 0;
ALTER TABLE health_metrics ADD COLUMN alert_sent_at TIMESTAMP;
```

---

## 🐛 Troubleshooting

### Workflow not triggering?
- ✅ Check workflow is **Active** (toggle on)
- ✅ Check trigger condition (schedule time correct?)
- ✅ View execution history for errors
- ✅ Check backend API response

### Email not sending?
- ✅ Gmail credential authorized?
- ✅ Check N8N log for SMTP errors
- ✅ Check if Gmail blocks less secure apps
- ✅ Use Gmail App Password instead

### API calls failing?
- ✅ Backend running on 4000?
- ✅ CORS enabled for localhost:5678?
- ✅ Check endpoint exists and returns data
- ✅ Test with curl first:
```bash
curl http://localhost:4000/api/vaccines/due-today
```

### Performance issues?
- ✅ Don't use too many HTTP requests in one workflow
- ✅ Use database queries when possible
- ✅ Split into multiple workflows if needed
- ✅ Monitor execution time in N8N logs

---

## 📞 Support & Resources

- **N8N Docs:** https://docs.n8n.io
- **N8N Community:** https://community.n8n.io
- **Node Library:** https://n8n.io/nodes
- **Issues/Help:** GitHub Issues on n8n/n8n

---

## 🎉 What You've Enabled

With N8N, Nurture-Glow now has:

✅ **Automated Reminders** - Never miss a vaccine or appointment
✅ **Real-time Alerts** - Health alerts when needed
✅ **Email Campaigns** - Onboarding sequences, digests
✅ **SMS Notifications** - For critical updates
✅ **Audit Trail** - Log all automations sent
✅ **Zero Code** - Create workflows in N8N UI
✅ **24/7 Automation** - Runs while you sleep
✅ **Scalable** - Handles 1000s of users

---

**You're now ready to automate Nurture-Glow! 🚀**

Next Steps:
1. Start N8N: `n8n start`
2. Create first workflow
3. Test thoroughly
4. Add more workflows
5. Monitor & optimize

Happy automating! 🎊
