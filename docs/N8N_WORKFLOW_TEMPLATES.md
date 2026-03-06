# N8N Workflow Templates for Nurture-Glow

These are ready-to-use workflow JSON files that you can import into N8N.

## How to Import

1. Go to http://localhost:5678
2. Click **Import from URL** or **Paste JSON**
3. Copy the workflow JSON
4. Click **Import**
5. Configure credentials (Email, SMS, etc.)
6. Save & Deploy

---

## Workflow 1: Daily Vaccine Reminder

```json
{
  "meta": {
    "instanceId": "uuid"
  },
  "name": "Daily Vaccine Reminder",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [1],
          "intervalUnit": "day",
          "triggerAtHour": 9,
          "triggerAtMinute": 0
        }
      },
      "id": "trigger_schedule",
      "name": "Schedule Trigger",
      "type": "n8n-nodes-base.schedule",
      "typeVersion": 1.1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "method": "GET",
        "url": "http://localhost:4000/api/vaccines/due-today",
        "sendHeaders": true,
        "headerParameters": {}
      },
      "id": "http_request",
      "name": "Get Vaccines Due Today",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [450, 300]
    },
    {
      "parameters": {
        "mode": "json",
        "jsonData": "{\n  \"resources\": \"=items\"\n}"
      },
      "id": "item_split",
      "name": "Split Items",
      "type": "n8n-nodes-base.itemLists",
      "typeVersion": 3,
      "position": [650, 300]
    },
    {
      "parameters": {
        "sendTo": "=<%= $json.user.email %>",
        "subject": "⚕️ Vaccine Reminder: {{ $json.vaccineName }}",
        "emailType": "html",
        "htmlMessage": "<h2>Time for Your Vaccine!</h2>\n<p>Hello {{ $json.user.name }},</p>\n<p>It's time for your <strong>{{ $json.vaccineName }}</strong> vaccine.</p>\n<p><strong>Details:</strong></p>\n<ul>\n  <li>Vaccine: {{ $json.vaccineName }}</li>\n  <li>Recommended Week: {{ $json.recommendedWeek }}</li>\n  <li>Description: {{ $json.description }}</li>\n</ul>\n<p>Please contact your healthcare provider to schedule an appointment.</p>\n<p>Best regards,<br>Nurture-Glow Team</p>"
      },
      "id": "send_email",
      "name": "Send Email Reminder",
      "type": "n8n-nodes-base.emailSend",
      "typeVersion": 1,
      "position": [850, 300],
      "credentials": {
        "gmail": "gmail_creds"
      }
    },
    {
      "parameters": {
        "method": "POST",
        "url": "http://localhost:4000/api/notifications/log",
        "sendHeaders": true,
        "headerParameters": {},
        "sendBody": true,
        "bodyParametersJson": "{\n  \"userId\": \"={{ $json.user.id }}\",\n  \"type\": \"VACCINE_REMINDER\",\n  \"vaccineId\": \"={{ $json.vaccineId }}\",\n  \"sentAt\": \"={{ new Date().toISOString() }}\",\n  \"channel\": \"email\"\n}"
      },
      "id": "log_notification",
      "name": "Log Notification Sent",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [1050, 300]
    }
  ],
  "connections": {
    "trigger_schedule": {
      "main": [
        [
          {
            "node": "http_request",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "http_request": {
      "main": [
        [
          {
            "node": "item_split",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "item_split": {
      "main": [
        [
          {
            "node": "send_email",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "send_email": {
      "main": [
        [
          {
            "node": "log_notification",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

---

## Workflow 2: Appointment Confirmation Email

```json
{
  "meta": {
    "instanceId": "uuid"
  },
  "name": "Appointment Confirmation",
  "nodes": [
    {
      "parameters": {
        "path": "appointment-confirm",
        "method": "POST"
      },
      "id": "webhook_trigger",
      "name": "Appointment Booked Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "sendTo": "=<%= $json.user.email %>",
        "subject": "✅ Appointment Confirmed - {{ $json.doctorName }}",
        "emailType": "html",
        "htmlMessage": "<h2>Your Appointment is Confirmed!</h2>\n<p>Hello {{ $json.user.name }},</p>\n<p>Your appointment has been successfully booked.</p>\n<p><strong>Appointment Details:</strong></p>\n<ul>\n  <li>Doctor: {{ $json.doctorName }}</li>\n  <li>Date: {{ $json.appointmentDate }}</li>\n  <li>Time: {{ $json.appointmentTime }}</li>\n  <li>Location: {{ $json.hospitalName }}</li>\n  <li>Type: {{ $json.appointmentType }}</li>\n</ul>\n<p>Please arrive 10 minutes before your appointment.</p>\n<p>If you need to reschedule, contact us at least 24 hours before.</p>\n<p>Best regards,<br>Nurture-Glow Team</p>"
      },
      "id": "send_confirmation_email",
      "name": "Send Confirmation Email",
      "type": "n8n-nodes-base.emailSend",
      "typeVersion": 1,
      "position": [450, 200],
      "credentials": {
        "gmail": "gmail_creds"
      }
    },
    {
      "parameters": {
        "to": "={{ $json.user.phoneNumber }}",
        "message": "Appointment confirmed with {{ $json.doctorName }} on {{ $json.appointmentDate }} at {{ $json.appointmentTime }}. Reply CONFIRM to verify."
      },
      "id": "send_sms",
      "name": "Send SMS Confirmation",
      "type": "n8n-nodes-base.twilio",
      "typeVersion": 1,
      "position": [450, 400],
      "credentials": {
        "twilioApi": "twilio_creds"
      }
    },
    {
      "parameters": {
        "method": "POST",
        "url": "http://localhost:4000/api/appointments/{{ $json.appointmentId }}/confirm-sent",
        "sendHeaders": true,
        "headerParameters": {},
        "sendBody": true,
        "bodyParametersJson": "{\n  \"confirmationSent\": true,\n  \"sentAt\": \"={{ new Date().toISOString() }}\"\n}"
      },
      "id": "update_db",
      "name": "Update DB",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [650, 300]
    }
  ],
  "connections": {
    "webhook_trigger": {
      "main": [
        [
          {
            "node": "send_confirmation_email",
            "type": "main",
            "index": 0
          },
          {
            "node": "send_sms",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "send_confirmation_email": {
      "main": [
        [
          {
            "node": "update_db",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "send_sms": {
      "main": [
        [
          {
            "node": "update_db",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

---

## Workflow 3: 24-Hour Appointment Reminder

```json
{
  "meta": {
    "instanceId": "uuid"
  },
  "name": "24-Hour Appointment Reminder",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "interval": [1],
          "intervalUnit": "day",
          "triggerAtHour": 8,
          "triggerAtMinute": 0
        }
      },
      "id": "schedule",
      "name": "Every Day at 8 AM",
      "type": "n8n-nodes-base.schedule",
      "typeVersion": 1.1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "method": "GET",
        "url": "http://localhost:4000/api/appointments/tomorrow"
      },
      "id": "get_appointments",
      "name": "Get Tomorrow's Appointments",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [450, 300]
    },
    {
      "parameters": {
        "mode": "json",
        "jsonData": "{\n  \"resources\": \"=items\"\n}"
      },
      "id": "split",
      "name": "Split Items",
      "type": "n8n-nodes-base.itemLists",
      "typeVersion": 3,
      "position": [650, 300]
    },
    {
      "parameters": {
        "sendTo": "=<%= $json.user.email %>",
        "subject": "🕐 Reminder: Your Appointment Tomorrow",
        "emailType": "html",
        "htmlMessage": "<h2>Appointment Reminder</h2>\n<p>Hi {{ $json.user.name }},</p>\n<p>This is a friendly reminder about your appointment tomorrow:</p>\n<ul>\n  <li>Time: {{ $json.appointmentTime }}</li>\n  <li>Doctor: {{ $json.doctorName }}</li>\n  <li>Location: {{ $json.hospitalName }}</li>\n</ul>\n<p>Please arrive 10 minutes early. If you need to reschedule, contact us now.</p>"
      },
      "id": "email_reminder",
      "name": "Send Email Reminder",
      "type": "n8n-nodes-base.emailSend",
      "typeVersion": 1,
      "position": [850, 300],
      "credentials": {
        "gmail": "gmail_creds"
      }
    }
  ],
  "connections": {
    "schedule": {
      "main": [
        [
          {
            "node": "get_appointments",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "get_appointments": {
      "main": [
        [
          {
            "node": "split",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "split": {
      "main": [
        [
          {
            "node": "email_reminder",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

---

## Workflow 4: Health Alert (Abnormal Metrics)

```json
{
  "meta": {
    "instanceId": "uuid"
  },
  "name": "Health Metric Alert",
  "nodes": [
    {
      "parameters": {
        "path": "health-metric",
        "method": "POST"
      },
      "id": "webhook",
      "name": "Health Metric Logged",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "conditions": {
          "string": [
            {
              "condition": "!== normal",
              "value1": "={{ $json.status }}",
              "value2": "normal"
            }
          ]
        }
      },
      "id": "condition",
      "name": "Is Abnormal?",
      "type": "n8n-nodes-base.if",
      "typeVersion": 1,
      "position": [450, 300]
    },
    {
      "parameters": {
        "sendTo": "=<%= $json.user.email %>",
        "subject": "⚠️ Health Alert: {{ $json.metricType }}",
        "emailType": "html",
        "htmlMessage": "<h2>Health Alert</h2>\n<p>Hi {{ $json.user.name }},</p>\n<p><strong>⚠️ Your {{ $json.metricType }} is {{ $json.status }}</strong></p>\n<p>Value: {{ $json.value }} {{ $json.unit }}</p>\n<p>Normal Range: {{ $json.minNormal }} - {{ $json.maxNormal }} {{ $json.unit }}</p>\n<p>Please contact your doctor if symptoms persist.</p>"
      },
      "id": "alert_user",
      "name": "Alert User",
      "type": "n8n-nodes-base.emailSend",
      "typeVersion": 1,
      "position": [650, 200],
      "credentials": {
        "gmail": "gmail_creds"
      }
    },
    {
      "parameters": {
        "sendTo": "=<%= $json.doctor.email %>",
        "subject": "🏥 Patient Health Alert: {{ $json.user.name }}",
        "emailType": "html",
        "htmlMessage": "<h2>Patient Alert</h2>\n<p>Patient: {{ $json.user.name }}</p>\n<p>Alert: {{ $json.metricType }} - {{ $json.status }}</p>\n<p>Value: {{ $json.value }} {{ $json.unit }}</p>\n<p>Status: Requires attention</p>"
      },
      "id": "alert_doctor",
      "name": "Alert Doctor",
      "type": "n8n-nodes-base.emailSend",
      "typeVersion": 1,
      "position": [650, 400],
      "credentials": {
        "gmail": "gmail_creds"
      }
    }
  ],
  "connections": {
    "webhook": {
      "main": [
        [
          {
            "node": "condition",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "condition": {
      "main": [
        [
          {
            "node": "alert_user",
            "type": "main",
            "index": 0
          },
          {
            "node": "alert_doctor",
            "type": "main",
            "index": 0
          }
        ],
        []
      ]
    }
  }
}
```

---

## Workflow 5: Weekly Community Digest

```json
{
  "meta": {
    "instanceId": "uuid"
  },
  "name": "Weekly Community Digest",
  "nodes": [
    {
      "parameters": {
        "rule": {
          "dayOfWeek": ["Friday"],
          "hour": [18],
          "minute": 0
        }
      },
      "id": "schedule",
      "name": "Every Friday 6 PM",
      "type": "n8n-nodes-base.schedule",
      "typeVersion": 1.1,
      "position": [250, 300]
    },
    {
      "parameters": {
        "method": "GET",
        "url": "http://localhost:4000/api/community/posts?days=7"
      },
      "id": "get_posts",
      "name": "Get Weekly Posts",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [450, 300]
    },
    {
      "parameters": {
        "method": "GET",
        "url": "http://localhost:4000/api/users?digestSubscribed=true"
      },
      "id": "get_users",
      "name": "Get Digest Subscribers",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [650, 300]
    },
    {
      "parameters": {
        "mode": "json",
        "jsonData": "{\n  \"resources\": \"=items\"\n}"
      },
      "id": "split_users",
      "name": "Split Users",
      "type": "n8n-nodes-base.itemLists",
      "typeVersion": 3,
      "position": [850, 300]
    },
    {
      "parameters": {
        "sendTo": "=<%= $json.email %>",
        "subject": "📰 Your Weekly Community Digest",
        "emailType": "html",
        "htmlMessage": "<h2>Weekly Community Digest</h2>\n<p>Hello {{ $json.name }},</p>\n<p>Here's what your community was talking about this week:</p>\n<hr>\n<p>Total Posts: {{ $json.postCount }}</p>\n<p>New Members: {{ $json.newMembers }}</p>\n<p>Top Discussion: {{ $json.topicName }}</p>\n<hr>\n<p><a href='http://localhost:5173/community'>Visit Community</a></p>"
      },
      "id": "send_digest",
      "name": "Send Digest Email",
      "type": "n8n-nodes-base.emailSend",
      "typeVersion": 1,
      "position": [1050, 300],
      "credentials": {
        "gmail": "gmail_creds"
      }
    }
  ],
  "connections": {
    "schedule": {
      "main": [
        [
          {
            "node": "get_posts",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "get_posts": {
      "main": [
        [
          {
            "node": "get_users",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "get_users": {
      "main": [
        [
          {
            "node": "split_users",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "split_users": {
      "main": [
        [
          {
            "node": "send_digest",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  }
}
```

---

## How to Use These Templates

1. **Copy the JSON** from above
2. Open N8N at http://localhost:5678
3. Click **"+"** → **"New Workflow"**
4. Click **"..."** → **"Import from clipboard"**
5. Paste the JSON
6. Configure credentials (Gmail, Twilio, etc.)
7. Click **Save & Deploy**

---

## Required Backend Endpoints

Make sure you have these endpoints in `appRoutes.js`:

```javascript
GET  /api/vaccines/due-today
GET  /api/appointments/tomorrow
GET  /api/community/posts?days=7
POST /api/notifications/log
GET  /api/appointments/:id/confirm-sent
POST /api/appointments/:id/confirm-sent
GET  /api/users?digestSubscribed=true
```

---

**Your automation workflows are ready! 🎉**
