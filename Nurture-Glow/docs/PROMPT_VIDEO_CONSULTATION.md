# PROMPT: Video Consultation + Google Calendar Sync

You are GitHub Copilot. Implement "Online Video Consultation + Google Calendar Sync" for Nurture Glow.

## TECHNOLOGY STACK (Aligned with TECH_STACK.md)

**Frontend:**
- React 18 + TypeScript + Vite + React Router + Tailwind CSS
- Lucide React (icons), Recharts (charts)
- Context API (Auth, Translations)
- i18n system (English & Bengali)
- Port: 5173

**Backend:**
- Node.js 18 + Express.js 4
- mysql2 (pooled connections)
- JWT authentication (role-based: mother, doctor, pharmacist, nutritionist, etc.)
- Zod validation
- Port: 4000

**Database:**
- MySQL 8.0
- Entity-based data model (flexible JSON storage in app_entities)
- UUID identifiers
- Database name: neonest

---

## PROJECT FILE STRUCTURE TO FOLLOW

**Backend files (DO NOT split into controllers - use existing pattern):**
```
backend/src/
├── index.js                          # Main entry (already exists)
├── appRoutes.js                      # ADD: Video meeting endpoints here
├── db.js                             # ADD: meeting-related DB functions
├── integrations/
│   └── googleCalendar.js             # NEW: Google Calendar helper module
├── middleware/
│   └── auth.js                       # Already exists (JWT verification)
└── roles.js                          # Role-based access (already exists)
```

**Frontend files:**
```
frontend/src/
├── pages/
│   └── appointments/
│       └── AppointmentVideo.tsx      # NEW: Video session page
├── components/
│   └── appointments/
│       └── VideoSessionButton.tsx    # NEW: Join/Create button component
├── services/
│   └── appointmentService.ts         # NEW: API service for video endpoints
├── types/
│   └── appointment.ts                # ADD: MeetingInfo, VideoSessionData types
├── contexts/
│   └── AuthContext.tsx               # Already exists (use useAuth hook)
└── i18n/
    └── translations.ts               # ADD: Video-related translations (EN + Bengali)
```

---

## DATABASE CHANGES

Your project uses entity-based model. Make these changes:

**1. Create new table for OAuth tokens:**
```sql
CREATE TABLE user_oauth_tokens (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  provider VARCHAR(50) NOT NULL,       -- 'google', 'outlook', etc.
  access_token LONGTEXT NOT NULL,
  refresh_token LONGTEXT,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_provider (user_id, provider),
  INDEX idx_provider (provider)
);
```

**2. Update apartments entity to include meeting_data JSON:**
The app_entities table will store appointment meeting data as JSON:
```javascript
// Example structure stored in app_entities.data for type='appointment':
{
  id: "apt-123",
  type: "appointment",
  user_id: "patient-id",
  doctor_id: "doctor-id",
  scheduled_at: "2026-02-20T10:00:00Z",
  status: "scheduled",
  appointment_type: "online",
  // NEW FIELDS:
  meeting_data: {
    provider: "jitsi",
    room_name: "ng-apt-123-abc123xyz",
    join_url: "http://localhost:5173/appointments/apt-123/video",
    calendar_event_id: "google-event-id-xyz123",
    status: "scheduled",  // scheduled|started|ended|cancelled
    created_at: "2026-02-19T15:30:00Z"
  }
}
```

---

## BACKEND IMPLEMENTATION

### Routes to add in appRoutes.js

**A) Google OAuth Endpoints:**
```
GET /api/integrations/google/auth
- Return: { auth_url: "https://accounts.google.com/o/oauth2/..." }
- Purpose: Doctor clicks link to authorize Google Calendar

GET /api/integrations/google/callback?code=AUTH_CODE&state=STATE
- Auth required: NO (OAuth callback)
- Save access_token + refresh_token to user_oauth_tokens table
- Redirect to: {FRONTEND_URL}/profile?google_connected=true
```

**B) Video Meeting Endpoints:**
```
POST /api/appointments/:id/meeting/create
- Auth required: YES (JWT)
- Access: Only doctor assigned to appointment OR patient owner
- Body: { appointment_id: "apt-123" }
- Logic:
  1. Fetch appointment from app_entities
  2. Verify user is doctor or patient (else return 403)
  3. Generate unique room: "ng-{appointmentId}-{randomSuffix}"
  4. Create join URL: "{FRONTEND_URL}/appointments/{id}/video"
  5. If doctor has Google token, create calendar event
  6. Store meeting_data in appointment entity
  7. Return: { success: true, data: { room_name, join_url, calendar_event_id } }
- Error codes: 404 (appointment not found), 403 (unauthorized), 500 (calendar error)

GET /api/appointments/:id/meeting
- Auth required: YES
- Access: Only doctor or patient of this appointment
- Return: { success: true, data: { meeting_data, appointment: {...} } }
- Or: { success: false, error: "Meeting not created yet" }

POST /api/appointments/:id/meeting/cancel
- Auth required: YES
- Access: Only doctor or admin
- Logic:
  1. Fetch appointment meeting_data
  2. If calendar_event_id exists, delete event from Google Calendar
  3. Update meeting_status to "cancelled"
  4. Return: { success: true, message: "Meeting cancelled" }

POST /api/appointments/:id/meeting/end
- Auth required: YES
- Logic: Update meeting_status to "ended", log end time
- Return: { success: true, message: "Meeting ended" }
```

### Code patterns to follow (from your existing code):

**Response format (consistent across backend):**
```javascript
// Success
res.json({ success: true, data: meetingInfo, message: "Video session created" });

// Error
res.status(400).json({ success: false, error: "Invalid appointment", statusCode: 400 });
```

**Database query pattern:**
```javascript
// Use existing query function from db.js
const [rows] = await query('SELECT * FROM app_entities WHERE id = ? AND type = ?', [appointmentId, 'appointment']);
```

**Validation pattern (use Zod - already in dependencies):**
```javascript
import { z } from 'zod';

const createMeetingSchema = z.object({
  appointment_id: z.string().uuid()
});

// In route: const { appointment_id } = createMeetingSchema.parse(req.body);
```

**Auth middleware (already exists):**
```javascript
router.post('/api/appointments/:id/meeting/create', requireAuth, async (req, res, next) => {
  // requireAuth adds req.user from JWT token
});
```

### Files to create/update:

**1. backend/src/integrations/googleCalendar.js (NEW file)**
Purpose: Google Calendar API helper functions
```javascript
// Functions needed:
// - getGoogleOAuthUrl(redirectUri): returns OAuth auth URL
// - exchangeAuthCodeForTokens(code): exchange code for access+refresh tokens
// - saveGoogleTokens(userId, accessToken, refreshToken, expiresAt)
// - getGoogleTokens(userId): fetch doctor's saved tokens
// - createCalendarEvent(accessToken, { title, start, end, attendees, description })
// - deleteCalendarEvent(accessToken, eventId)
// - refreshAccessToken(refreshToken): refresh expired token

// Dependencies to add to package.json:
// - "googleapis": "^118.0.0"
// - "google-auth-library": "^9.x"
```

**2. backend/src/db.js (ADD functions)**
```javascript
// Add these functions:
// - createOrUpdateGoogleToken(userId, provider, accessToken, refreshToken, expiresAt)
// - getGoogleToken(userId): SELECT from user_oauth_tokens
// - deleteGoogleToken(userId): DELETE from user_oauth_tokens
// - saveMeetingData(appointmentId, meetingData): UPDATE app_entities
// - getMeetingData(appointmentId): SELECT from app_entities where type='appointment'
// - updateMeetingStatus(appointmentId, status): UPDATE meeting_data.status
```

**3. backend/src/appRoutes.js (ADD routes)**
Add these endpoints in existing router object:
```javascript
// Google OAuth
router.get('/integrations/google/auth', (req, res) => { ... });
router.get('/integrations/google/callback', (req, res, next) => { ... });

// Video meetings
router.post('/appointments/:id/meeting/create', requireAuth, (req, res, next) => { ... });
router.get('/appointments/:id/meeting', requireAuth, (req, res, next) => { ... });
router.post('/appointments/:id/meeting/cancel', requireAuth, (req, res, next) => { ... });
router.post('/appointments/:id/meeting/end', requireAuth, (req, res, next) => { ... });
```

---

## FRONTEND IMPLEMENTATION

### 1. Create new page: frontend/src/pages/appointments/AppointmentVideo.tsx

```typescript
// Page mounted at: /appointments/:id/video
// Props: appointmentId from URL params

// Features:
// - useAuth() hook to verify user is doctor or patient
// - Fetch meeting data from GET /api/appointments/:id/meeting
// - Show "Create Video Session" button if:
//   - user.role === 'doctor'
//   - meeting not created yet
// - Show Jitsi embed if meeting exists:
//   - Use room_name from meeting_data
//   - Display appointment details (patient, doctor, time)
//   - Show exit button (calls POST /api/appointments/:id/meeting/end)
// - Responsive: works on mobile + desktop

// Jitsi embed (iframe):
// <iframe src={`https://meet.jitsi.com/${roomName}`} allow="camera; microphone; fullscreen; display-capture" />
```

### 2. Create component: frontend/src/components/appointments/VideoSessionButton.tsx

```typescript
// Reusable button component for showing in appointment details

// Props:
// - appointmentId: string
// - userRole: 'mother' | 'doctor'
// - isOnlineAppointment: boolean
// - meetingExists: boolean

// Behavior:
// - If not online appointment: hidden
// - If online but meeting not created: show "Create Session" (doctor only)
// - If meeting exists: show "Join Video Session" (both doctor & patient)
// - Navigation: onClick -> router.push(`/appointments/${id}/video`)
```

### 3. Create service: frontend/src/services/appointmentService.ts

```typescript
// Add new class or extend existing AppointmentService:

export class AppointmentService {
  // Existing methods...
  
  // NEW methods for video:
  static async createVideoMeeting(appointmentId: string): Promise<MeetingInfo> {
    return apiFetch(`/api/appointments/${appointmentId}/meeting/create`, {
      method: 'POST'
    });
  }

  static async getMeetingInfo(appointmentId: string): Promise<MeetingInfo> {
    return apiFetch(`/api/appointments/${appointmentId}/meeting`);
  }

  static async cancelMeeting(appointmentId: string): Promise<{ success: boolean }> {
    return apiFetch(`/api/appointments/${appointmentId}/meeting/cancel`, {
      method: 'POST'
    });
  }

  static async endMeeting(appointmentId: string): Promise<{ success: boolean }> {
    return apiFetch(`/api/appointments/${appointmentId}/meeting/end`, {
      method: 'POST'
    });
  }

  // Google OAuth
  static async getGoogleAuthUrl(): Promise<{ auth_url: string }> {
    return apiFetch('/api/integrations/google/auth');
  }
}
```

### 4. Update types: frontend/src/types/appointment.ts

```typescript
// Add these interfaces:

export interface MeetingData {
  provider: 'jitsi' | 'google_meet';
  room_name: string;
  join_url: string;
  calendar_event_id?: string;
  status: 'scheduled' | 'started' | 'ended' | 'cancelled';
  created_at: string;
}

export interface MeetingInfo {
  success: boolean;
  data: {
    room_name: string;
    join_url: string;
    calendar_event_id?: string;
    status: string;
  };
  message?: string;
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  scheduled_at: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  appointment_type: 'in-person' | 'online';
  meeting_data?: MeetingData;
  // ... existing fields
}
```

### 5. Add i18n translations: frontend/src/i18n/translations.ts

```typescript
// Add to existing translations object:

const translations = {
  en: {
    // ... existing translations
    'video.joinSession': 'Join Video Session',
    'video.createSession': 'Create Video Session',
    'video.roomNotReady': 'Video room not yet created by doctor',
    'video.enterRoom': 'Enter Video Room',
    'video.exitRoom': 'Exit Video Session',
    'video.sessionStarting': 'Starting video session...',
    'video.sessionEnded': 'Video session ended',
    'video.onlineConsultation': 'Online Consultation',
    'video.connectGoogle': 'Connect Google Calendar',
    'video.googleConnected': 'Google Calendar connected',
    'video.automatedScheduling': 'Automated scheduling enabled',
  },
  bn: {
    // ... existing Bengali translations
    'video.joinSession': 'ভিডিও সেশনে যোগ দিন',
    'video.createSession': 'ভিডিও সেশন তৈরি করুন',
    'video.roomNotReady': 'ডাক্তার এখনো ভিডিও রুম তৈরি করেননি',
    'video.enterRoom': 'ভিডিও রুমে প্রবেশ করুন',
    'video.exitRoom': 'ভিডিও সেশন থেকে বেরিয়ে যান',
    'video.sessionStarting': 'ভিডিও সেশন শুরু হচ্ছে...',
    'video.sessionEnded': 'ভিডিও সেশন শেষ হয়েছে',
    'video.onlineConsultation': 'অনলাইন পরামর্শ',
    'video.connectGoogle': 'গুগল ক্যালেন্ডার সংযোগ করুন',
    'video.googleConnected': 'গুগল ক্যালেন্ডার সংযুক্ত',
    'video.automatedScheduling': 'স্বয়ংক্রিয় সময়সূচী সক্ষম',
  }
};
```

### 6. Update routing: frontend/src/components/Layout.tsx (if not already present)

```typescript
// Add to Routes in Layout component:

<Route
  path="/appointments/:id/video"
  element={
    <ProtectedRoute>
      <AppointmentVideo />
    </ProtectedRoute>
  }
/>
```

---

## ENVIRONMENT VARIABLES

### Backend (.env)
```
# Existing
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=root
DB_NAME=neonest
JWT_SECRET=your-secret-key-change-in-production
PORT=4000
CORS_ORIGIN=http://localhost:5173
NODE_ENV=development

# NEW - Google OAuth
GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=YOUR_GOOGLE_CLIENT_SECRET
GOOGLE_REDIRECT_URI=http://localhost:4000/api/integrations/google/callback
GOOGLE_SCOPES=https://www.googleapis.com/auth/calendar
FRONTEND_URL=http://localhost:5173
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:4000
VITE_APP_NAME=Nurture Glow
VITE_FRONTEND_URL=http://localhost:5173
```

---

## DEPENDENCIES TO ADD

### Backend (npm install these)
```
googleapis@^118.0.0
google-auth-library@^9.x
```

### Frontend
```
# Jitsi is embedded via iframe URL - NO npm package needed
# OR if using wrapper:
react-jitsi@optional
```

---

## ACCESS CONTROL & SECURITY

**Backend middleware validation:**
```javascript
// For /api/appointments/:id/video endpoints:
// 1. Verify JWT with requireAuth middleware
// 2. Fetch appointment from DB
// 3. Check:
//    - req.user.sub === appointment.patient_id OR
//    - req.user.sub === appointment.doctor_id OR
//    - req.user.role === 'medical_admin'
// 4. Return 403 if no match
// 5. Allow operation only if appointment exists and is online type
```

**Frontend access:**
```typescript
// In AppointmentVideo.tsx:
const { user } = useAuth();

if (appointment.patient_id !== user.id && appointment.doctor_id !== user.id) {
  return <Navigate to="/appointments" replace />;
}
```

---

## TESTING CHECKLIST

### Backend (Optional curl examples)
```bash
# Create video meeting
curl -X POST http://localhost:4000/api/appointments/apt-123/meeting/create \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"

# Get meeting info
curl -X GET http://localhost:4000/api/appointments/apt-123/meeting \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Get Google OAuth URL
curl http://localhost:4000/api/integrations/google/auth

# Callback (auto-handled by browser redirect)
```

### Frontend Testing
- [ ] Doctor can create video session
- [ ] Patient sees "Join Video Session" button after creation
- [ ] Both can access Jitsi embed in /appointments/:id/video
- [ ] Google Calendar event created when session created
- [ ] Jitsi video/audio works
- [ ] Exit button calls backend and marks session ended
- [ ] Mobile responsive UI

### Database
- [ ] user_oauth_tokens table created
- [ ] OAuth tokens saved correctly
- [ ] Appointment meeting_data persists
- [ ] Calendar event ID stored

---

## DEPLOYMENT SETUP

### Google OAuth Setup (Required for production)
1. Go to Google Cloud Console: https://console.cloud.google.com/
2. Create new project: "Nurture-Glow-Video"
3. Enable APIs:
   - Google Calendar API
   - Google+ API
4. Create OAuth 2.0 credentials (Desktop / Web application)
5. Add Authorized redirect URIs:
   - Local: http://localhost:4000/api/integrations/google/callback
   - Production: https://yourdomain.com/api/integrations/google/callback
6. Copy Client ID & Client Secret to .env

### Deployment Platforms
- Backend: Heroku / Railway / AWS EC2 (with updated GOOGLE_REDIRECT_URI)
- Frontend: Vercel / Netlify (with updated VITE_API_URL)

---

## IMPORTANT NOTES

1. **Jitsi embed:** Free tier, no credentials needed. Self-hosted possible for scale.
2. **Google Calendar:** Doctor must authorize once via OAuth flow (one-time setup)
3. **Video permissions:** Browser will request camera/microphone permissions
4. **Database auto-migration:** Run SQL migration for user_oauth_tokens table manually
5. **Datetime format:** Use ISO 8601 for all timestamps
6. **Room name uniqueness:** Include appointmentId + random suffix to prevent collisions
7. **Token refresh:** Implement refresh token logic for long-lived calendar access
8. **Error logging:** Log all calendar API errors for debugging
9. **Notifications:** Consider N8N workflow to notify about video session start (optional)

---

## DELIVERABLES CHECKLIST

- [ ] user_oauth_tokens table created
- [ ] Google OAuth endpoints in appRoutes.js
- [ ] Video meeting endpoints in appRoutes.js
- [ ] googleCalendar.js integration helper created
- [ ] db.js functions added for meetings & tokens
- [ ] AppointmentVideo.tsx page component created
- [ ] VideoSessionButton.tsx component created
- [ ] appointmentService.ts updated with video methods
- [ ] appointment.ts types updated (MeetingData, MeetingInfo)
- [ ] i18n translations added (EN + Bengali)
- [ ] Layout.tsx routing updated
- [ ] Environment variables documented in .env.example
- [ ] Google OAuth credentials obtained & configured
- [ ] README updated with setup steps
- [ ] Code compiles without TypeScript errors
- [ ] Doctor can create session, patient can join
- [ ] Google Calendar events created & synced
- [ ] Tested on both desktop & mobile

---

**GOAL:** Full in-app video consultation with automated calendar sync. Doctor initiates, system creates Jitsi room + Google Calendar event, both participants join via React UI.
