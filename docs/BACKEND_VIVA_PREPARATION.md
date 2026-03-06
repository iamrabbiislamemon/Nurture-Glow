# 🎯 NURTURE GLOW — Backend Technology Viva Preparation Guide

> **Project:** Nurture Glow — Maternal & Child Healthcare Platform  
> **Target Region:** Bangladesh  
> **Prepared for:** Industry Expert Viva / Presentation  

---

## TABLE OF CONTENTS

1. [Project Overview & Problem Statement](#1-project-overview--problem-statement)
2. [Tech Stack & Justification](#2-tech-stack--justification)
3. [System Architecture](#3-system-architecture)
4. [Database Design & Schema](#4-database-design--schema)
5. [Authentication & Authorization](#5-authentication--authorization)
6. [API Design & Route Architecture](#6-api-design--route-architecture)
7. [Middleware Pipeline](#7-middleware-pipeline)
8. [AI/ML Integration](#8-aiml-integration)
9. [Real-Time Features (WebSocket/WebRTC)](#9-real-time-features-websocketwebrtc)
10. [File Upload & Storage](#10-file-upload--storage)
11. [Email Service](#11-email-service)
12. [Third-Party Integrations](#12-third-party-integrations)
13. [Security Measures](#13-security-measures)
14. [DevOps & Deployment](#14-devops--deployment)
15. [Database Migration System](#15-database-migration-system)
16. [Error Handling Strategy](#16-error-handling-strategy)
17. [Likely Viva Q&A (50+ Questions)](#17-likely-viva-qa)

---

## 1. PROJECT OVERVIEW & PROBLEM STATEMENT

**Problem:** Bangladesh has a high maternal mortality rate. Many expecting mothers, especially in rural areas, lack easy access to healthcare information, doctor consultations, vaccination tracking, mental health support, and emergency services.

**Solution:** Nurture Glow is a **full-stack maternal and child healthcare platform** providing:
- Pregnancy health tracking (BP, glucose, weight, BMI)
- Doctor tele-consultation with video calls (WebRTC)
- AI-powered health assistant (local Ollama LLM or fallback knowledge base)
- Vaccination scheduling & tracking for children
- Mental health assessments (EPDS-based)
- Blood donor network
- Emergency services (ambulance, hospitals, ICU bed tracking)
- E-commerce marketplace for maternal products
- Community forum and journal
- Multi-role admin panel (System Admin, Medical Admin, Ops Admin)
- Health ID verification system (government integration)
- Nutritionist & pharmacist dashboards

---

## 2. TECH STACK & JUSTIFICATION

### Backend Stack

| Technology | Version | Purpose | Why This Choice? |
|---|---|---|---|
| **Node.js** | 20 (Alpine) | Runtime | Non-blocking I/O, great for real-time features, large npm ecosystem |
| **Express.js** | 4.21 | HTTP Framework | Lightweight, unopinionated, huge middleware ecosystem |
| **MySQL** | 8.0 | RDBMS | ACID compliance for healthcare data, relational integrity, JSON support |
| **mysql2** | 3.11 | DB Driver | Promise-based, prepared statements, connection pooling |
| **JWT (jsonwebtoken)** | 9.0 | Authentication | Stateless auth, scalable, no server-side session storage |
| **bcryptjs** | 2.4 | Password Hashing | Adaptive cost factor (12 rounds per OWASP), resistant to brute-force |
| **Zod** | 4.3 | Schema Validation | Runtime type validation for env vars & request bodies |
| **Helmet** | 8.1 | Security Headers | Sets CSP, X-Frame-Options, HSTS, etc. |
| **express-rate-limit** | 8.2 | Rate Limiting | DDoS protection, brute-force prevention |
| **Multer** | 2.0 | File Upload | Handles multipart/form-data for avatars, verification docs |
| **Nodemailer** | 7.0 | Email | Password reset, welcome emails, suspension notifications |
| **ws** | 8.19 | WebSocket | WebRTC signaling for video calls |
| **uuid** | 9.0 | Unique IDs | UUID v4 for all primary keys (36-char format) |
| **Morgan** | 1.10 | HTTP Logging | Request logging in dev mode |
| **CORS** | 2.8 | Cross-Origin | Frontend-backend separation |
| **googleapis** | 118.0 | Google Calendar | OAuth2 calendar event integration |
| **Docker** | - | Containerization | Consistent dev/prod environments |
| **Nodemon** | 3.1 (dev) | Hot Reload | Auto-restart on file changes during development |

### Why Node.js + Express over alternatives?

| Alternative | Reason for Not Choosing |
|---|---|
| Django (Python) | Monolithic, opinionated, heavier for real-time WebSocket |
| Spring Boot (Java) | Over-engineered for MVP, slower dev cycles |
| FastAPI (Python) | Good, but Node.js has better WebSocket/WebRTC ecosystem |
| NestJS | Adds TypeScript overhead; Express gives more control |

### Why MySQL over alternatives?

| Alternative | Reason for Not Choosing |
|---|---|
| PostgreSQL | MySQL is more widely deployed in Bangladesh hosting |
| MongoDB | Healthcare data needs ACID transactions and relational integrity |
| SQLite | Not suitable for concurrent web server access |

---

## 3. SYSTEM ARCHITECTURE

### Architecture Pattern: **Modular Monolith**

```
┌──────────────────────────────────────────────────────────────┐
│                     CLIENT (React/Vite)                      │
│                 http://localhost:5173                         │
└──────────────────────┬───────────────────────────────────────┘
                       │ HTTP/REST + WebSocket
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                  EXPRESS SERVER (Node.js)                     │
│                  http://localhost:4000                        │
│                                                              │
│  ┌─────────────┐ ┌──────────────┐ ┌────────────────┐        │
│  │  Middleware  │ │  Rate Limiter│ │ Helmet+CORS    │        │
│  │  Pipeline   │ │  (3 tiers)   │ │ Security       │        │
│  └──────┬──────┘ └──────┬───────┘ └───────┬────────┘        │
│         └───────────────┼─────────────────┘                  │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │              ROUTE LAYER (4 routers)                  │    │
│  │  Auth Routes │ Profile Routes │ App Routes │ Admin   │    │
│  └──────────────────────┬───────────────────────────────┘    │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │            SERVICE LAYER                              │    │
│  │  AI Service │ Email Service │ App Store │ Signaling  │    │
│  └──────────────────────┬───────────────────────────────┘    │
│                         ▼                                    │
│  ┌──────────────────────────────────────────────────────┐    │
│  │            DATA ACCESS LAYER (db.js)                  │    │
│  │  Connection Pool │ Transactions │ Query Helper        │    │
│  └──────────────────────┬───────────────────────────────┘    │
└─────────────────────────┼────────────────────────────────────┘
                          ▼
┌──────────────────────────────────────────────────────────────┐
│              MySQL 8.0 (neonest database)                    │
│    40+ Tables │ 20 Triggers │ Views │ Foreign Keys           │
│    + Flexible EAV (app_entities JSON store)                  │
└──────────────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

1. **ES Modules** (`"type": "module"`) — The project uses native ES module syntax (`import/export`) instead of CommonJS (`require`).

2. **Factory Pattern for Middleware** — Middleware functions are created via factory functions like `createAuthMiddleware(JWT_SECRET)` to inject dependencies cleanly.

3. **Hybrid Storage Model** — Traditional SQL tables for structured entities (users, doctors, hospitals, orders) + a flexible **Entity-Attribute-Value (EAV)** system (`app_entities` table) for dynamic data (appointments, notifications, journal entries, community posts).

4. **Router Composition** — The main `index.js` composes 4 route modules:
   - `createAuthRouter()` — Auth endpoints
   - `createProfileRouter()` — Profile management
   - `createAppRouter()` — All application APIs (~120+ endpoints)
   - `createAdminRouter()` — Admin panel APIs

---

## 4. DATABASE DESIGN & SCHEMA

### Database: `neonest` (MySQL 8.0)

### Schema Architecture: Dual Storage Model

#### A. Traditional SQL Tables (40+ tables)

| Category | Tables |
|---|---|
| **User Management** | `users`, `user_profiles`, `roles`, `user_roles`, `user_oauth_tokens`, `emergency_contacts`, `addresses` |
| **Maternal Health** | `mothers`, `pregnancies`, `pregnancy_checkins`, `children`, `child_growth_logs` |
| **Medical Records** | `health_records`, `health_record_files`, `allergies` |
| **Vaccination** | `vaccine_schedules`, `vaccine_schedule_items`, `vaccination_events`, `vaccine_catalog`, `vaccine_suggestions` |
| **Consultations** | `doctors`, `doctor_specialties`, `doctor_availability_slots`, `consultations`, `video_sessions`, `consultation_messages` |
| **Emergency** | `hospitals`, `icu_status_updates`, `ambulances`, `emergency_requests`, `emergency_status_events` |
| **E-Commerce** | `vendors`, `product_categories`, `products`, `orders`, `order_items`, `payments` |
| **Mental Health** | `mental_questions`, `mental_assessments`, `mental_answers` |
| **Community** | `referrals`, `ngos`, `gov_resources`, `certificates` |
| **Reviews** | `doctor_reviews`, `product_reviews` |
| **System** | `files`, `file_links`, `chat_history`, `notifications`, `audit_logs`, `password_reset_tokens`, `reminders`, `reminder_deliveries` |
| **Admin** | `system_settings`, `admin_notifications`, `admin_activity_logs`, `high_risk_cases`, `doctor_verification_requests`, `telemedicine_sessions` |
| **Migration** | `schema_migrations` |

#### B. Flexible EAV System (`app_entities` table)

```sql
CREATE TABLE app_entities (
  id       VARCHAR(36) PRIMARY KEY,  -- UUID
  user_id  VARCHAR(36) NULL,
  type     VARCHAR(50) NOT NULL,     -- Entity type discriminator
  subtype  VARCHAR(100) NULL,
  data     LONGTEXT NOT NULL,        -- JSON payload
  created_at DATETIME,
  updated_at DATETIME,
  INDEX idx_type (type),
  INDEX idx_user_type (user_id, type),
  INDEX idx_user_type_sub (user_id, type, subtype)
);
```

**Used for:** appointments, community posts, journal entries, blood donors, blood requests, nutrition logs, notifications, medical consents, verification docs, user suspensions, medical profiles, visit history, announcements, subscription plans, FAQs, etc.

**Why EAV?** Instead of creating 20+ tables for features with evolving schemas, the EAV pattern allows:
- Adding new entity types without schema migrations
- Storing arbitrary JSON payloads per entity
- Single CRUD interface for all dynamic features

### Key Schema Design Decisions

1. **UUID Primary Keys** — All IDs are `VARCHAR(36)` UUIDs generated with `uuid v4`. Why? Prevents enumeration attacks, ensures uniqueness across distributed systems.

2. **Soft References via EAV** — The `app_entities` table uses `user_id` + `type` as logical foreign keys.

3. **Proper Foreign Keys with CASCADE** — Traditional tables use `ON DELETE CASCADE` and `ON DELETE SET NULL` for referential integrity.

4. **Indexing Strategy** — Composite indexes on `(user_id, type)`, `(type, subtype)` for EAV queries; individual indexes on `role`, `status`, `health_id`, date columns for frequent filters.

5. **20 Database Triggers** for automated business logic:
   - `trg_doctor_review_rating` — Auto-recalculate doctor avg rating
   - `trg_order_item_total_recalc` — Auto-recalculate order totals
   - `trg_high_risk_case_notify` — Auto-notify on high-risk pregnancy
   - `trg_pregnancy_checkin_risk_detect` — Detect risky BP/glucose readings
   - `trg_user_status_change_audit` — Audit log on user status change
   - `trg_product_stock_low_alert` — Low stock notification
   - `trg_emergency_request_audit` — Audit emergency requests
   - And 13 more...

### Connection Pool Configuration

```javascript
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: 3306,
  user: process.env.DB_USER || 'root',
  database: process.env.DB_NAME || 'neonest',
  connectionLimit: NODE_ENV === 'production' ? 25 : 10,
  enableKeepAlive: true,
  keepAliveInitialDelay: 10_000
});
```

### Transaction Support

```javascript
export async function withTransaction(callback) {
  const conn = await pool.getConnection();
  await conn.beginTransaction();
  try {
    const result = await callback(wrappedConn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
```

Used for: meeting data updates, migrations, order processing — any multi-step operation requiring atomicity.

---

## 5. AUTHENTICATION & AUTHORIZATION

### 5.1 Authentication Flow

```
[Client]                          [Server]
   │                                 │
   │  POST /auth/register            │
   │  {name, email, phone,           │
   │   password, role}               │
   ├────────────────────────────────►│
   │                                 │─── Validate (Zod + custom)
   │                                 │─── Normalize email/phone
   │                                 │─── Check duplicate
   │                                 │─── bcrypt.hash(pw, 12)
   │                                 │─── INSERT users + user_profiles
   │                                 │─── jwt.sign({sub, role}, secret, {expiresIn: '7d'})
   │                                 │─── Send welcome email (async, non-blocking)
   │  ◄──── {token, user}  ─────────│
   │                                 │
   │  POST /auth/login               │
   │  {identifier, password}         │
   ├────────────────────────────────►│
   │                                 │─── SELECT by email OR phone
   │                                 │─── bcrypt.compare()
   │                                 │─── Check suspension status
   │                                 │─── jwt.sign()
   │  ◄──── {token, user}  ─────────│
   │                                 │
   │  GET /api/*  (Header:           │
   │   Authorization: Bearer <token>)│
   ├────────────────────────────────►│
   │                                 │─── requireAuth middleware
   │                                 │─── jwt.verify()
   │                                 │─── req.user = payload
   │  ◄──── Protected Data ─────────│
```

### 5.2 JWT Token Structure

```javascript
// Token payload:
{
  sub: "uuid-of-user",          // User ID
  role: "mother",               // Normalized role
  iat: 1709254800,              // Issued at
  exp: 1709859600               // Expires in 7 days
}
```

**JWT Secret Management:**
- Production: Must be set via `JWT_SECRET` env var (≥32 chars, validated at boot)
- Development: Auto-generates a 256-bit random hex secret, persisted to `.dev_jwt_secret` file

### 5.3 Password Security

- **Algorithm:** bcrypt
- **Cost Factor:** 12 rounds (OWASP recommendation)
- **Validation Rules:** Min 8 chars, strength scoring (uppercase, lowercase, digit, special char, common pattern detection)
- **Password Reset:** JWT-based tokens with 1-hour expiry, stored in `password_reset_tokens` table with `used_at` to prevent replay

### 5.4 Role-Based Access Control (RBAC)

**8 Canonical Roles:**

| Role | Access Level |
|---|---|
| `mother` (patient/user) | Core features: appointments, health tracking, vaccination, community |
| `doctor` | Doctor dashboard, patient management, prescriptions, consultations |
| `pharmacist` | Pharmacy dashboard, order fulfillment |
| `nutritionist` | Nutrition plans, patient diet management |
| `merchandiser` | Product management, inventory |
| `medical_admin` | Doctor verification, high-risk case management |
| `ops_admin` | System operations, hospital management |
| `system_admin` | Full access: all admin panels, database management, backups |

**Role Normalization:** Aliases are mapped to canonical roles:
```javascript
// "admin" → "system_admin", "patient" → "mother", "mom" → "mother", etc.
const ROLE_ALIASES = {
  ops_admin: 'ops_admin', operations_admin: 'ops_admin',
  admin: 'system_admin', patient: 'mother', mom: 'mother', ...
};
```

**Middleware Chain:**
```javascript
requireAuth           // Verify JWT → sets req.user
→ requireRole(...)    // Check role against DB
→ checkSuspensionStatus // Check if account is suspended
→ requireConsentForPatient('patientId')  // Doctor-patient consent
```

### 5.5 Medical Consent System

Doctors must obtain **active consent** from patients before accessing medical data:

```javascript
function requireConsentForPatient(patientIdParam) {
  // Queries app_entities for type='medical_consent'
  // Checks: doctorId match, status='active', not expired
  // Blocks with 403 if no active consent
}
```

### 5.6 Account Suspension Flow

- Admin suspends user → record in `app_entities` (type: `user_suspension`)
- Suspended user attempts login → gets `403` with suspension details + time-limited appeal token
- User can appeal via `/auth/suspension-appeal` with the appeal token (15-min expiry)

---

## 6. API DESIGN & ROUTE ARCHITECTURE

### Route Organization

| Router | Mount Path | File | # Endpoints |
|---|---|---|---|
| Health Check | `/health`, `/db/*` | `routes/health.js` | 3 |
| Auth | `/auth/*` | `routes/auth.js` | 6 |
| Profile | `/profile/*` | `routes/profile.js` | 2 |
| App (main) | `/api/*` | `appRoutes.js` | ~120+ |
| Admin | `/api/admin/*` | `adminRoutes.js` | ~50+ |
| Legacy Admin | `/api/system-admin/*`, `/api/ops-admin/*` | Mapped to adminRoutes | — |
| Raw Admin | `/admin/:table/*` | `index.js` | 6 (CRUD on any table) |

### Major API Endpoint Groups

#### Patient/Mother APIs
```
POST   /auth/register              - Register with role
POST   /auth/login                 - Login (email or phone)
POST   /api/auth/forgot-password   - Request password reset
POST   /api/auth/reset-password    - Reset with token
GET    /auth/me                    - Get current user profile
PUT    /profile                    - Update name/language
PUT    /profile/avatar             - Upload/update avatar
GET    /api/health/history         - Health check-in history
POST   /api/health/history         - Log health check-in
GET    /api/appointments           - List appointments
POST   /api/appointments           - Book appointment
PATCH  /api/appointments/:id       - Update appointment
DELETE /api/appointments/:id       - Cancel appointment
GET    /api/vaccines               - List vaccinations
POST   /api/vaccines               - Add vaccination record
PATCH  /api/vaccines/:id           - Update vaccination
POST   /api/vaccines/:id/proof     - Upload vaccine proof photo
```

#### AI & Chat
```
POST   /api/ai/chat                - AI health assistant chat
POST   /api/ai/insights            - Health insights analysis
POST   /api/ai/check-myth          - Pregnancy myth checker
POST   /api/ai/transcribe          - Voice-to-text (placeholder)
```

#### Blood Donation
```
GET    /api/blood/donors            - Search donors by blood group/location
POST   /api/blood/donors            - Register as donor
GET    /api/blood/requests           - List blood requests
POST   /api/blood/requests           - Create blood request
```

#### Community & Journal
```
GET    /api/community/posts          - List community posts
POST   /api/community/posts          - Create post
POST   /api/community/posts/:id/like - Like a post
POST   /api/community/posts/:id/comments - Comment
GET    /api/journal                  - List journal entries
POST   /api/journal                  - Create journal entry
```

#### Doctor APIs
```
GET    /api/doctor/dashboard         - Doctor dashboard stats
GET    /api/doctor/consultations     - Doctor's consultations
GET    /api/doctor/patients/:id      - Patient details (consent required)
PATCH  /api/doctor/appointments/:id  - Accept/reject appointment
POST   /api/doctor/prescriptions     - Create prescription
PUT    /api/doctor/profile           - Update doctor profile
PUT    /api/doctor/schedule          - Set availability slots
GET    /api/doctor/earnings          - Earnings report
```

#### Pharmacist APIs
```
GET    /api/pharmacy/dashboard       - Pharmacy stats
GET    /api/pharmacy/orders          - Incoming orders
PATCH  /api/pharmacy/orders/:id      - Process order
```

#### Nutritionist APIs
```
GET    /api/nutritionist/dashboard   - Stats
GET    /api/nutritionist/patients    - Assigned patients
POST   /api/nutritionist/plans       - Create nutrition plan
PATCH  /api/nutritionist/plans/:id   - Update plan
```

#### Merchandiser APIs
```
GET    /api/merchandiser/dashboard   - Dashboard
GET    /api/merchandiser/products    - Product inventory
POST   /api/merchandiser/products    - Add product
PATCH  /api/merchandiser/products/:id - Update product
```

#### E-Commerce
```
POST   /api/orders                   - Place order
GET    /api/orders                   - Order history
GET    /api/orders/:id               - Order details
PATCH  /api/orders/:id/cancel        - Cancel order
```

#### Video Consultation
```
POST   /api/appointments/:id/meeting/create  - Create video meeting
GET    /api/appointments/:id/meeting         - Get meeting details
POST   /api/appointments/:id/meeting/end     - End video session
```

### Response Format (Standardized Envelope)

```javascript
// Success:
{ success: true, data: { ... }, meta: { page, pageSize, total, totalPages } }

// Error:
{ success: false, error: "Human-readable message" }
```

### Pagination

```javascript
// Request: GET /api/orders?page=2&pageSize=20
// Parsed by parsePagination() → { page: 2, pageSize: 20, offset: 20 }
// Response includes meta: { page: 2, pageSize: 20, total: 150, totalPages: 8 }
```

---

## 7. MIDDLEWARE PIPELINE

### Request Processing Order

```
1. helmet()               - Security headers (CSP, HSTS, X-Frame-Options)
2. cors()                 - Cross-origin resource sharing
3. express.json({15mb})   - Body parser with size limit
4. morgan('dev')          - HTTP request logging
5. express.static()       - Serve uploaded files from /uploads
6. apiLimiter             - 100 req/15 min per IP (global)
7. adminExportLimiter     - 5 req/min for admin export endpoints
8. authLimiter            - 5 req/min for /auth/login and /auth/register
9. sanitizeInput          - Strip <> from all string fields (XSS prevention)
10. [Route Handler]
11. 404 Handler           - Catch-all for unknown routes
12. errorHandler          - Global error handler (hides details in production)
```

### Input Sanitization

```javascript
// Strips < and > from all string fields, trims, and limits to 5000 chars
export function sanitizeInput(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    const sanitize = (obj) => {
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          obj[key] = obj[key].replace(/[<>]/g, '').trim().substring(0, 5000);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          sanitize(obj[key]);
        }
      }
    };
    sanitize(req.body);
  }
  next();
}
```

### Rate Limiting Strategy (3 Tiers)

| Tier | Scope | Limit | Window |
|---|---|---|---|
| Global | All `/api/*` | 100 requests | 15 minutes |
| Auth | `/auth/login`, `/auth/register` | 5 requests | 1 minute |
| Admin Export | Admin export endpoints | 5 requests | 1 minute |

---

## 8. AI/ML INTEGRATION

### Architecture: Multi-Model Orchestrator (Local-First)

```
User Message
    │
    ▼
┌─────────────────────┐
│  Intent Classifier   │  ← Regex-based (5 intents)
│  classifyIntent()    │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│  Risk Predictor      │  ← Heuristic scoring for monitoring queries
│  runRiskPredictor()  │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐     ┌─────────────────┐
│  Ollama LLM         │────►│  If available    │──► AI Response
│  (mistral/gemma)     │     │  (local model)   │
└─────────┬───────────┘     └─────────────────┘
          │ If unavailable
          ▼
┌─────────────────────┐
│  Fallback Knowledge  │──► Template-based response
│  Base (static)       │    (guaranteed, no 503)
└─────────────────────┘
```

### Intent Classification

```javascript
const intentMatchers = {
  'mental-health': [/\banxious\b/, /\bstress\b/, /\bdepress\b/, ...],
  monitoring:      [/\bbp\b/, /blood\s*pressure/i, /\bglucose\b/, ...],
  nutrition:       [/\bfood\b/, /\bnutrition\b/, /\bvitamin\b/, ...],
  medical:         [/\bsymptom\b/, /\bpain\b/, /\bpreeclampsia\b/, ...],
};
// Falls back to 'general' if no pattern matches
```

### Risk Predictor (Heuristic Scoring)

Calculates a 0–1 risk score based on:
- Pregnancy week (≥28: +0.05)
- Systolic BP ≥ 140: +0.3, ≥ 160: +0.15 additional
- Diastolic BP ≥ 90: +0.3, ≥ 110: +0.15 additional
- Age ≥ 35: +0.08
- BMI ≥ 30: +0.08
- Pre-existing conditions (diabetes, hypertension): +0.1–0.12

**Risk levels:** Low (<0.33), Medium (0.33–0.66), High (≥0.66)

### Ollama Integration (Local LLM)

- Connects to locally running Ollama at `http://localhost:11434`
- Default model: **Mistral** (best quality-speed balance for maternal health)
- Prompt engineering: Role-based system prompt for maternal health assistant
- 15-second timeout with AbortController
- Cached availability check (60-second TTL)
- 100% offline, private, zero cost

### Fallback Knowledge Base

- Curated responses for 4 categories × 5-10 sub-topics each
- Keyword matching within category
- Bilingual (English + Bengali)
- **Guaranteed response** — no user ever gets a 503

### Daily Usage Limit

```javascript
const DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT) || 50;
// Per-user, per-day, tracked via chat_history table
```

### Medical Disclaimer

Every AI response is appended with:
- EN: "For urgent symptoms, contact your doctor."
- BN: "জরুরি উপসর্গের জন্য আপনার ডাক্তারের সাথে যোগাযোগ করুন।"

---

## 9. REAL-TIME FEATURES (WebSocket/WebRTC)

### WebRTC Video Calling Architecture

```
[Doctor Browser]                    [Server WSS]                    [Patient Browser]
     │                                  │                                  │
     │  ws://server/ws/signaling        │                                  │
     │  { type: 'join', roomId,         │                                  │
     │    role: 'doctor', userId }      │                                  │
     ├─────────────────────────────────►│                                  │
     │                                  │  { type: 'join', roomId,         │
     │                                  │    role: 'patient', userId }     │
     │                                  │◄─────────────────────────────────┤
     │                                  │                                  │
     │  { type: 'peer-joined' }         │                                  │
     │◄─────────────────────────────────┤                                  │
     │                                  │                                  │
     │  { type: 'offer', sdp: ... }     │  Relay to peer                   │
     ├─────────────────────────────────►├─────────────────────────────────►│
     │                                  │                                  │
     │  { type: 'answer', sdp: ... }    │  Relay to peer                   │
     │◄─────────────────────────────────┤◄─────────────────────────────────┤
     │                                  │                                  │
     │  ICE candidates                  │  Relay                           │
     │◄────────────────────────────────►│◄────────────────────────────────►│
     │                                  │                                  │
     │  DIRECT P2P Video Stream         │                                  │
     │◄════════════════════════════════════════════════════════════════════►│
```

**Key Points:**
- Server **only handles signaling** (room management, SDP/ICE relay)
- Actual video/audio streams are **peer-to-peer (P2P)** — server never sees the media
- Max 2 participants per room
- Session metadata recorded in `telemedicine_sessions` table (start/end times, participants)
- Room ID = Appointment ID (natural mapping)

### Signaling Protocol Messages

| Message Type | Direction | Purpose |
|---|---|---|
| `join` | Client → Server | Join a video room |
| `joined` | Server → Client | Confirmation + peer count |
| `peer-joined` | Server → Client | Notify that a second peer joined |
| `offer` | Client → Server → Client | SDP offer relay |
| `answer` | Client → Server → Client | SDP answer relay |
| `ice-candidate` | Client → Server → Client | ICE candidate relay |
| `call-end` | Client → Server | End the call |
| `call-ended` | Server → Client | Notify peer that call ended |
| `peer-left` | Server → Client | Peer disconnected |
| `error` | Server → Client | Room full, etc. |

---

## 10. FILE UPLOAD & STORAGE

### Upload System (Multer-based)

```
Upload Types:
├── Avatar Images     → /uploads/avatars/       (JPEG, PNG, WebP, GIF)
├── Verification Docs → /uploads/verification-docs/ (Images + PDF)
└── Vaccine Proofs    → /uploads/vaccine-proofs/ (Images + PDF)
```

**Configuration:**
- Max file size: 5 MB (configurable via `UPLOAD_MAX_MB`)
- 1 file per request
- Filename: `{timestamp}-{uuid}.{ext}` (prevents collisions)
- MIME type whitelist validation
- Static file serving via `express.static`
- Old files cleaned up on avatar update

### File Security
- MIME type validation (whitelist, not blacklist)
- File extension sanity check
- Max file size enforced at Multer level
- Files stored outside of project dir if configured

---

## 11. EMAIL SERVICE

### Architecture

```javascript
// Dual-mode email system:
// 1. Production:  SMTP/Gmail via EMAIL_USER + EMAIL_PASSWORD
// 2. Development: Ethereal Email (auto-generated fake SMTP account)
//                 → Console prints preview URL to view sent emails
```

### Email Types

| Email | Trigger | Template |
|---|---|---|
| Welcome Email | User registration | Branded HTML |
| Password Reset | Forgot password request | Contains reset link (1-hour expiry) |
| Password Reset Confirmation | After successful reset | Confirmation notice |
| Account Suspended | Admin suspends user | Reason included |
| Suspension Appeal | User appeals | Admin notification |

### Key Design: Non-Blocking

Welcome emails are sent asynchronously (`.catch()` swallowed) — registration doesn't fail if email fails:
```javascript
sendWelcomeEmail(email, name).catch(err =>
  console.error('Failed to send welcome email:', err.message)
);
```

---

## 12. THIRD-PARTY INTEGRATIONS

### Google Calendar (OAuth 2.0)

**Purpose:** Sync doctor appointments with Google Calendar

**Flow:**
1. Doctor clicks "Connect Google Calendar" → `/integrations/google/auth`
2. Redirect to Google OAuth consent screen
3. Callback at `/integrations/google/callback` → exchanges code for tokens
4. Tokens stored in `user_oauth_tokens` table
5. When appointment created → `createCalendarEvent()` adds to doctor's calendar
6. Token refresh handled automatically via `refreshAccessToken()`

### Jitsi (Video Meetings)

- Meeting rooms created for online consultations
- Room name follows format based on appointment ID
- Join URLs generated for both doctor and patient

---

## 13. SECURITY MEASURES

### Summary of All Security Layers

| Layer | Technique | Implementation |
|---|---|---|
| **Transport** | CORS with explicit origins | Production rejects wildcard `*` |
| **Headers** | Helmet.js | CSP, X-Frame-Options, HSTS, X-Content-Type-Options |
| **Authentication** | JWT with ≥32-char secret | 7-day expiry, verified on every protected request |
| **Password** | bcrypt 12 rounds | OWASP-recommended, common pattern rejection |
| **Rate Limiting** | 3-tier strategy | Global, auth-specific, admin export |
| **Input Sanitization** | XSS strip middleware | Removes `<>` from all string body fields |
| **SQL Injection** | Parameterized queries | All `query(sql, params)` calls use `?` placeholders |
| **File Upload** | MIME whitelist + size limit | Reject non-image/PDF, max 5MB |
| **Environment** | Zod validation at boot | Production fails if missing DB/JWT/CORS config |
| **Secrets** | `.dev_jwt_secret` auto-gen | Never committed to git, `mode: 0o600` |
| **Docker** | Non-root `node` user | `.env` files removed from image |
| **Admin Invite** | Invite code for admin registration | `ADMIN_INVITE_CODE` required |
| **Consent** | Doctor-patient consent check | Doctors can't access patient data without active consent |
| **Suspension** | Account suspension with appeal | Time-limited appeal token (15 min) |
| **Audit** | `audit_logs` table + triggers | Every admin action logged |
| **Graceful Shutdown** | SIGTERM/SIGINT handlers | DB pool closed, 10-second force timeout |

### Production Boot Validation

```javascript
// In production, the server REFUSES to start if:
// 1. JWT_SECRET is missing or < 32 chars
// 2. CORS_ORIGIN is wildcard
// 3. DB_HOST, DB_USER, DB_PASSWORD, DB_NAME are missing
// Validated with Zod schema
```

---

## 14. DEVOPS & DEPLOYMENT

### Docker Setup

**Multi-stage Dockerfile:**
```dockerfile
# Stage 1: Install deps (separate from code for layer caching)
FROM node:20-alpine AS deps
RUN npm ci --omit=dev

# Stage 2: Production image
FROM node:20-alpine
RUN apk add --no-cache tini     # PID 1 signal handling
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN rm -f .env .env.* .dev_jwt_secret  # Remove secrets
USER node                        # Non-root
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/index.js"]
```

**Docker Compose (3 services):**
```yaml
services:
  mysql:       # MySQL 8.0, persistent volume, healthcheck
  backend:     # Node.js app, depends on healthy MySQL
```

### Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `DB_HOST` | Yes (prod) | localhost | MySQL host |
| `DB_PORT` | No | 3306 | MySQL port |
| `DB_USER` | Yes (prod) | root | DB username |
| `DB_PASSWORD` | Yes (prod) | root | DB password |
| `DB_NAME` | No | neonest | DB name |
| `JWT_SECRET` | Yes (prod) | auto-generated | ≥32 char secret |
| `PORT` | No | 4000 | Server port |
| `CORS_ORIGIN` | Yes (prod) | * | Comma-separated origins |
| `NODE_ENV` | No | development | production / development |
| `EMAIL_USER` | No | - | SMTP username |
| `EMAIL_PASSWORD` | No | - | SMTP password |
| `GOOGLE_CLIENT_ID` | No | - | Google OAuth |
| `GOOGLE_CLIENT_SECRET` | No | - | Google OAuth |
| `ENABLE_OLLAMA` | No | false | Enable local AI |
| `OLLAMA_MODEL` | No | mistral | Which LLM model |
| `AI_DAILY_LIMIT` | No | 50 | Chat limit/user/day |
| `UPLOAD_MAX_MB` | No | 5 | Max upload size MB |

### Bootstrap Sequence

```
1. runMigrationsIfPending()    ← Run new database migrations
2. ensureAdminSchema()         ← Fallback SQL bootstrap if no migrations
3. assertCoreTables()          ← Verify users, user_profiles, roles, user_roles exist
4. ensureAppTables()           ← Create app_entities, app_user_meta, app_catalog
5. ensureChatHistoryTable()    ← Create chat_history if missing
6. seedAppData()               ← Seed hospitals, medicines, vaccine catalog, etc.
7. verifyEmailConfig()         ← Test email service
8. app.listen(port)            ← Start HTTP server
9. attachSignaling(server)     ← Attach WebSocket signaling
10. Register SIGTERM/SIGINT    ← Graceful shutdown handlers
```

---

## 15. DATABASE MIGRATION SYSTEM

### Custom migration runner (`migrateRunner.js`)

```
migrations/
├── 001_baseline.js        ← Initial schema
└── fix_doctor_identity_telemedicine.sql  ← Hotfix
```

**How it works:**
1. `schema_migrations` table tracks which migrations have been applied
2. On boot, compares migration files vs. applied → runs pending ones
3. Each migration has an `up()` function
4. Wrapped in database transaction (atomic: all-or-nothing)
5. Falls back to legacy SQL bootstrap if no migrations exist

---

## 16. ERROR HANDLING STRATEGY

### Global Error Handler

```javascript
export function createErrorHandler(maxUploadBytes, nodeEnv) {
  return (err, req, res, _next) => {
    // 1. File too large → 413
    // 2. Production 500s → "Internal server error" (no stack trace)
    // 3. Development → full error message
  };
}
```

### Pattern: Every route uses try/catch + next(err)

```javascript
router.get('/endpoint', requireAuth, async (req, res, next) => {
  try {
    // ... business logic
    sendSuccess(res, data);
  } catch (err) {
    next(err);  // Delegates to global error handler
  }
});
```

---

## 17. LIKELY VIVA Q&A (50+ Questions)

### Architecture & Design

**Q1: Why did you choose a modular monolith over microservices?**
> For a team project / MVP, a modular monolith gives us the organizational benefits of separation (separate route files, services, middleware) without the operational complexity of microservices (service discovery, inter-service communication, distributed transactions). We can extract microservices later if needed.

**Q2: Explain the EAV pattern you used in `app_entities`. What are its pros and cons?**
> **Entity-Attribute-Value** stores dynamic data as JSON in a `data` column, discriminated by a `type` column. **Pros:** No schema changes needed for new features, flexible schema, single CRUD interface. **Cons:** No column-level validation, harder to query specific fields (can't do `WHERE data.status = 'active'` without JSON functions), no foreign key constraints on embedded data.

**Q3: What design patterns are used in this project?**
> - **Factory Pattern:** `createAuthMiddleware()`, `createAppRouter()`, `createErrorHandler()` — inject dependencies
> - **Middleware Pattern:** Express middleware pipeline for cross-cutting concerns
> - **Repository Pattern:** `appStore.js` abstracts data access for EAV entities
> - **Strategy Pattern:** AI orchestrator selects between Ollama, Risk Predictor, or Fallback
> - **Observer Pattern:** WebSocket event handling (join, offer, answer events)

**Q4: How does your application handle concurrent requests to the database?**
> MySQL2's connection pool manages up to 25 connections (production) with `waitForConnections: true`. Requests queue if all connections are busy. For multi-step operations (like updating meeting data), we use explicit transactions via `withTransaction()` to prevent race conditions.

### Database

**Q5: Why UUID instead of auto-increment for primary keys?**
> UUIDs prevent enumeration attacks (attacker can't guess `/users/2`, `/users/3`), work in distributed systems without coordination, and can be generated client-side. Trade-off: larger index size and slightly slower lookups vs. integers.

**Q6: Explain the indexing strategy in your database.**
> We use: (1) Primary key indexes on all `id` columns, (2) Composite indexes like `idx_user_type(user_id, type)` on EAV table for efficient user-specific entity lookups, (3) Single-column indexes on frequently filtered columns like `role`, `status`, `health_id`, (4) Date-based indexes for time-range queries on `created_at`.

**Q7: What are database triggers and why do you have 20 of them?**
> Triggers are stored procedures that execute automatically on INSERT/UPDATE/DELETE events. We use them for: auto-calculating averages (doctor ratings), auto-creating notifications (high-risk alerts, low stock), enforcing business rules (payment-order sync), and audit logging — all without application code changes.

**Q8: How do you handle database schema changes in production?**
> We have a migration system. Files in `migrations/` have numeric prefixes for ordering. `migrateRunner.js` tracks applied migrations in `schema_migrations` table, runs pending ones inside transactions, and is idempotent (safe to run multiple times).

**Q9: Explain your transaction management approach.**
> We use `withTransaction()` which: (1) Gets a connection from the pool, (2) Begins a transaction, (3) Passes a wrapped connection to the callback, (4) Commits on success or rolls back on error, (5) Always releases the connection. This ensures ACID properties for multi-step operations like meeting data updates.

### Authentication & Security

**Q10: Why JWT over sessions?**
> JWT is stateless — the server doesn't store session data, making it horizontally scalable. The token contains the user ID and role, verified cryptographically. Trade-off: can't be immediately revoked (we use 7-day expiry as mitigation). For immediate revocation, we check suspension status from DB.

**Q11: Why bcrypt cost factor 12? What's the significance?**
> Cost factor is the number of rounds: 2^12 = 4,096 iterations. OWASP recommends ≥10 (we use 12 for extra security). Higher = slower = more resistant to brute-force. 12 rounds takes ~250ms to hash, which is fine for login but makes rainbow tables impractical.

**Q12: How do you prevent SQL injection?**
> All database queries use parameterized queries (`?` placeholders). We never concatenate user input into SQL strings. Example: `query('SELECT * FROM users WHERE email = ?', [email])`. The mysql2 driver handles proper escaping.

**Q13: How does rate limiting work in your system?**
> We use `express-rate-limit` with 3 tiers: (1) Global: 100 req/15min per IP, (2) Auth: 5 req/min for login/register (prevents brute force), (3) Admin export: 5 req/min (prevents data exfiltration). The key generator uses user ID when authenticated, IP address otherwise.

**Q14: How do you handle CORS? What would happen without it?**
> CORS restricts which domains can call our API. We whitelist specific frontend URLs. Without CORS, any website could make requests to our API using the user's cookies/tokens. In production, we reject wildcard `*` origins.

**Q15: Explain the medical consent system.**
> Privacy feature: doctors can only access a patient's medical data if the patient has granted active consent. Stored as EAV entity with type `medical_consent`, includes doctorId, status, and optional expiry date. The `requireConsentForPatient` middleware checks this before every patient data access.

### API Design

**Q16: Why REST over GraphQL?**
> REST is simpler, better cached (GET requests), has widespread tooling, and is sufficient for our CRUD-heavy workload. GraphQL would add complexity (schema definition, resolvers) without significant benefit since we don't have deeply nested data graphs.

**Q17: How do you handle pagination?**
> Standard offset-based pagination: `page` and `pageSize` query params parsed by `parsePagination()`, capped at max 100 per page. Response includes `meta: { page, pageSize, total, totalPages }`. Trade-off: offset pagination can be slow for deep pages — cursor-based would be better for millions of records.

**Q18: Why standardized response format?**
> `sendSuccess()` and `sendError()` ensure consistent JSON structure (`{ success, data/error, meta }`). Frontend can reliably check `response.success` without guessing response shapes. Every endpoint uses these helpers.

### AI Integration

**Q19: Why local Ollama instead of OpenAI API?**
> (1) **Privacy:** Medical data never leaves the server — critical for healthcare. (2) **Cost:** Zero API costs. (3) **Offline:** Works without internet. (4) **Compliance:** No third-party data sharing. Trade-off: smaller model, less capable than GPT-4, but sufficient for our curated use case.

**Q20: What happens if your AI model is unavailable?**
> Three-layer fallback: (1) Try Ollama LLM if enabled and available, (2) If unavailable, use fallback knowledge base — curated template responses matched by intent + keywords. (3) Every response includes a medical disclaimer. The user ALWAYS gets a response; zero 503 errors.

**Q21: How does intent classification work?**
> Regex-based pattern matching against 5 intent categories: mental-health, monitoring, nutrition, medical, general. It runs in O(n) time against the message before routing to the appropriate AI handler.

**Q22: Explain the risk predictor system.**
> A heuristic scoring algorithm that takes clinical data (BP, glucose, age, BMI, gestational week, medical conditions) and computes a 0–1 risk score. Based on evidence-based thresholds (e.g., systolic ≥ 140 = hypertension warning). Returns risk level + personalized recommendations.

### Real-Time Features

**Q23: Why WebSocket for video signaling? Why not HTTP polling?**
> WebSocket provides full-duplex, low-latency communication needed for real-time SDP/ICE candidate exchange. HTTP polling would add 100-500ms latency per message and waste bandwidth — unacceptable for video call setup which needs sub-second signaling.

**Q24: Is video data sent through your server?**
> **No.** Video/audio streams are peer-to-peer via WebRTC. Our server only handles signaling (room management, SDP offer/answer relay, ICE candidate relay). This means minimal server bandwidth usage regardless of video quality.

**Q25: What happens if WebRTC P2P connection fails?**
> When direct P2P fails (symmetric NAT, firewall), WebRTC uses TURN (Traversal Using Relays around NAT) servers as relay. We'd configure TURN server URLs in the client-side WebRTC configuration. The signaling server itself doesn't change.

### DevOps & Deployment

**Q26: Explain your Docker multi-stage build.**
> Stage 1 (`deps`): Installs `node_modules` (separate layer for caching). Stage 2: Copies only production deps + code, removes `.env` files, sets `USER node` (non-root), uses `tini` for proper PID 1 signal handling. This produces a smaller, more secure image.

**Q27: Why `tini` in Docker?**
> Node.js doesn't handle signals properly as PID 1 in Docker. Without `tini`, `SIGTERM` (sent by `docker stop`) isn't forwarded to Node.js, causing ungraceful shutdown. `tini` is a tiny init system that properly forwards signals.

**Q28: How does graceful shutdown work?**
> On SIGTERM/SIGINT: (1) Stop accepting new connections, (2) Wait for in-flight requests to complete, (3) Close database pool, (4) Exit cleanly. Force exit after 10 seconds if graceful shutdown hangs.

### Error Handling

**Q29: What happens when an unhandled error occurs?**
> Every route handler wraps its logic in try/catch and calls `next(err)`. The global error handler catches it, logs the error, and in production returns a generic "Internal server error" (no stack trace leakage). In development, the full error message is sent for debugging.

**Q30: How do you handle file upload errors?**
> Multer's `LIMIT_FILE_SIZE` error code is caught by the global error handler, which returns a 413 with a human-readable "File too large. Maximum size is 5MB" message.

### Node.js & Express Specifics

**Q31: What is the event loop and why does it matter for Node.js?**
> Node.js uses a single-threaded event loop that handles I/O asynchronously. When a DB query or file read starts, Node registers a callback and proceeds to handle other requests. This is why bcrypt (CPU-intensive) uses `bcryptjs` (written in JS with async support) rather than blocking the event loop.

**Q32: Why ES Modules (`import/export`) instead of CommonJS (`require`)?**
> ES Modules are the JavaScript standard, support top-level `await`, better static analysis for tree-shaking, and align with frontend code. We set `"type": "module"` in package.json.

**Q33: What's the purpose of `express-rate-limit's` `keyGenerator`?**
> It determines *who* to rate-limit. Default is IP address. For admin exports, we use user ID (from JWT) so rate limits are per-user rather than per-IP, which is more accurate when users are behind a shared IP/proxy.

**Q34: How do you serve static files securely?**
> `express.static` serves the `/uploads` directory. Combined with Helmet's `crossOriginResourcePolicy: 'cross-origin'`, files are accessible from the frontend. MIME type validation prevents serving executable files.

### Scalability

**Q35: How would you scale this to handle 100K users?**
> (1) Add read replicas for MySQL (separate read/write). (2) Move to connection pool size 50+. (3) Add Redis for rate limiting (distributed) and session caching. (4) Put behind a reverse proxy (Nginx) with load balancing. (5) Move uploads to S3/CDN. (6) Extract AI service as a separate microservice.

**Q36: What are the bottlenecks in your current architecture?**
> (1) Single MySQL instance (SPOF). (2) File uploads on local disk (not distributed). (3) In-memory WebSocket rooms (lost on restart). (4) Rate limiting is per-process (needs Redis for multi-instance). (5) EAV JSON queries can be slow without MySQL JSON index support.

### Testing & Quality

**Q37: How do you validate environment configuration?**
> At boot time, production config is validated using Zod schema. Missing `DB_HOST`, `JWT_SECRET < 32 chars`, or wildcard CORS causes the server to **refuse to start** with a clear error message.

**Q38: How is the seed data structured?**
> Seed data includes real Bangladesh hospitals (Dhaka Medical College, Square Hospital, etc.) with actual coordinates, medicines with local pricing, vaccine catalogs, and specialties. Doctor catalog entries are auto-created from users who register with role=doctor.

### Advanced Topics

**Q39: What is connection pooling and why is it important?**
> Instead of opening a new MySQL connection per request (expensive: TCP handshake + auth), we maintain a pool of 10-25 reusable connections. `pool.getConnection()` reuses an idle connection or queues the request. `conn.release()` returns it to the pool. This drastically reduces latency.

**Q40: How does your `withTransaction` prevent data inconsistency?**
> It acquires a dedicated connection, calls `BEGIN`, executes the callback's queries on that connection, calls `COMMIT` on success or `ROLLBACK` on error, then releases the connection. This ensures either all changes apply or none do — the **Atomicity** in ACID.

**Q41: What is `ON DUPLICATE KEY UPDATE` and when did you use it?**
> MySQL-specific syntax to atomically insert or update. Used for: `createOrUpdateOAuthToken()` (upsert OAuth tokens), `upsertSystemSetting()` (system config), `upsertBySubtype()` (EAV entity by subtype). Prevents race conditions in concurrent upserts.

**Q42: How does the role normalization work across the system?**
> A single `normalizeRoleValue()` function maps any alias to canonical form (e.g., "admin"→"system_admin", "patient"→"mother"). It's called in: JWT generation, JWT verification, role middleware, registration, admin routes. This prevents string mismatch bugs across the entire system.

**Q43: What are the CRUD operations for the EAV store?**
> `appStore.js` exposes: `createEntity()`, `getEntity()`, `updateEntity()`, `deleteEntity()`, `listEntities()`, `upsertBySubtype()`, `getBySubtype()`. Each takes `{type, userId, data}`. Data is stored as JSON string, parsed on read. All queries use indexes on `(user_id, type)`.

**Q44: How do you handle file cleanup on avatar update?**
> When a user uploads a new avatar: (1) Store old avatar URL, (2) Save new file, (3) Update `app_user_meta`, (4) Delete old file from disk via `removeUploadFileByUrl()`. The cleanup is in a try/catch so it doesn't break the request if deletion fails.

**Q45: What does the admin panel's raw table access do? Isn't that dangerous?**
> System admins can CRUD any of the 40+ tables via `/admin/:table`. Protected by: `requireAuth` + `requireRole('system_admin')` + `checkSuspensionStatus`. Table name is validated against a whitelist array. Column names come from `INFORMATION_SCHEMA` metadata query (not user input). Used for emergency data correction.

**Q46: How would you add a new feature (e.g., appointment reminders)?**
> (1) Create migration for any new SQL tables. (2) Add EAV entity type (e.g., `reminder_schedule`). (3) Add API routes in `appRoutes.js` with proper auth middleware. (4) Add business logic in a new service file. (5) The EAV pattern means most features don't need schema changes.

**Q47: What is `tini` and why is it needed in Docker?**
> `tini` is a minimal init system. In Docker, the application runs as PID 1. Normal init systems (systemd) handle zombie process reaping and signal forwarding. Without `tini`, `docker stop` sends SIGTERM to PID 1, but Node.js doesn't properly exit because it doesn't get the signal forwarded — leading to a 10-second force kill.

**Q48: Explain how the forgot password flow works end-to-end.**
> (1) User submits email to `/api/auth/forgot-password`. (2) Server generates a JWT with `purpose: 'password_reset'`, 1-hour expiry. (3) Token stored in `password_reset_tokens` table. (4) Email sent with reset link containing the token. (5) User clicks link → frontend sends token + new password to `/api/auth/reset-password`. (6) Server verifies token, checks it's unused, hashes new password, updates user, marks token as used.

**Q49: How is the Health ID system designed?**
> Each user gets a Health ID (`NG-` + first 8 chars of UUID uppercased). Users can request verification through a hospital. Hospitals review and approve/reject via `/hospital/verification-requests/:id/decision`. Status tracked in `users.health_id_verification_status`. Government resources table stores available verification endpoints.

**Q50: What happens during server bootstrap if the database is empty?**
> Bootstrap sequence: (1) Attempt migration runner → returns false if no migration files. (2) Fall back to SQL bootstrap: execute `database-schema.sql`, `create_system_tables.sql`, `admin_tables_schema.sql`, etc. — each statement wrapped in `CREATE TABLE IF NOT EXISTS`. (3) Assert core tables exist. (4) Create EAV tables. (5) Seed hospitals, medicines, vaccines. Server starts successfully even from a clean database.

**Q51: How do you handle the Bangladesh-specific phone validation?**
> Custom regex patterns supporting 3 formats: `+8801XXXXXXXXX`, `8801XXXXXXXXX`, `01XXXXXXXXX`. Validates the carrier prefix (1[3-9]) — covers Grameenphone, Robi, Banglalink, Teletalk, etc.

**Q52: What DBMS concepts are implemented in this project?**
> - **Normalization**: Separate `users`, `user_profiles`, `roles`, `user_roles` tables (3NF)
> - **Foreign Keys**: CASCADE and SET NULL referential actions
> - **Triggers**: 20 triggers for automated business logic
> - **Transactions**: ACID via `withTransaction()`
> - **Indexing**: Composite and single-column indexes
> - **Views**: Dashboard views (`create_dashboard_views.sql`)
> - **Connection Pooling**: mysql2 pool with configurable limits
> - **Prepared Statements**: Parameterized queries throughout

---

## QUICK REVISION CHEAT SHEET

```
BACKEND:   Node.js 20 + Express 4.21 + MySQL 8.0
AUTH:      JWT (7d expiry) + bcrypt (12 rounds) + RBAC (8 roles)
DB:        40+ SQL tables + EAV (app_entities) + 20 triggers
API:       REST, 120+ endpoints, standardized response envelope
AI:        Ollama (local) → Risk Predictor → Fallback KB (3-layer)
REALTIME:  WebSocket signaling for WebRTC P2P video calls
SECURITY:  Helmet, CORS, rate limiting (3 tiers), parameterized queries
             sanitization, Zod env validation, consent system
DEVOPS:    Docker multi-stage, tini, non-root, graceful shutdown
EMAIL:     Nodemailer (Gmail/SMTP prod, Ethereal dev)
DEPLOY:    docker-compose (MySQL + Backend), env-validated boot
```

---

*Good luck with your presentation! 🎯*
