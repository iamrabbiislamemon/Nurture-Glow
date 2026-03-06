# Nurture Glow — Complete Feature Documentation

> **Version:** 1.0.0  
> **Platform:** Premium Mother, Pregnancy & Baby Care Platform  
> **Last Updated:** March 2026  
> **Tech Stack:** React 19 + TypeScript (Frontend) | Node.js + Express + MySQL (Backend)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture & Tech Stack](#2-architecture--tech-stack)
3. [User Roles & Access Control](#3-user-roles--access-control)
4. [Authentication & Security](#4-authentication--security)
5. [Patient/Mother Features](#5-patientmother-features)
   - 5.1 [Dashboard](#51-dashboard)
   - 5.2 [AI Health Assistant](#52-ai-health-assistant)
   - 5.3 [Appointments & Video Consultations](#53-appointments--video-consultations)
   - 5.4 [Vaccine Tracker](#54-vaccine-tracker)
   - 5.5 [Pregnancy Tracker](#55-pregnancy-tracker)
   - 5.6 [Nutrition & Hydration Tracker](#56-nutrition--hydration-tracker)
   - 5.7 [Health Metrics Tracking](#57-health-metrics-tracking)
   - 5.8 [Personal Journal](#58-personal-journal)
   - 5.9 [Community Forum](#59-community-forum)
   - 5.10 [Hospital Finder (Live Map)](#510-hospital-finder-live-map)
   - 5.11 [Blood Donor Network](#511-blood-donor-network)
   - 5.12 [Pharmacy & Shopping Cart](#512-pharmacy--shopping-cart)
   - 5.13 [AI Health Translator](#513-ai-health-translator)
   - 5.14 [Myth Buster](#514-myth-buster)
   - 5.15 [Health Identity Hub (Profile)](#515-health-identity-hub-profile)
   - 5.16 [Notifications System](#516-notifications-system)
6. [Doctor Dashboard](#6-doctor-dashboard)
7. [Pharmacist Dashboard](#7-pharmacist-dashboard)
8. [Nutritionist Dashboard](#8-nutritionist-dashboard)
9. [Merchandiser Dashboard](#9-merchandiser-dashboard)
10. [Admin Panel](#10-admin-panel)
    - 10.1 [System Admin](#101-system-admin)
    - 10.2 [Medical Admin](#102-medical-admin)
    - 10.3 [Operations Admin](#103-operations-admin)
11. [Public/Landing Pages](#11-publiclanding-pages)
12. [Cross-Cutting Features](#12-cross-cutting-features)
    - 12.1 [Internationalization (i18n)](#121-internationalization-i18n)
    - 12.2 [Voice Commands](#122-voice-commands)
    - 12.3 [Real-time Updates (WebSocket)](#123-real-time-updates-websocket)
    - 12.4 [Global Search](#124-global-search)
    - 12.5 [Code Splitting & Performance](#125-code-splitting--performance)
13. [Database Schema Overview](#13-database-schema-overview)
14. [API Endpoints Reference](#14-api-endpoints-reference)
15. [Workflow Diagrams](#15-workflow-diagrams)

---

## 1. Project Overview

**Nurture Glow** is a comprehensive maternal healthcare platform that connects mothers, doctors, pharmacists, nutritionists, and merchandisers in a unified ecosystem. It provides pregnancy tracking, doctor consultations (online + offline), vaccine management, nutrition planning, community forums, an AI health assistant, and a full e-commerce pharmacy — all backed by a role-based admin panel.

### Key Highlights
- **8 distinct user roles** with separate dashboards and permissions
- **AI-powered** health assistant, myth buster, and health insights (Google Gemini integration)
- **Live video consultations** via WebRTC/Jitsi with Google Calendar integration
- **Real-time** WebSocket updates across admin and user dashboards
- **Bilingual support** (English + Bangla) with voice command navigation
- **MySQL database** with 50+ tables for relational data integrity

---

## 2. Architecture & Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 19 | UI framework |
| TypeScript | Type safety |
| Vite 6 | Build tool & dev server |
| Tailwind CSS 4 | Utility-first styling |
| React Router 7 | Client-side routing (HashRouter) |
| Recharts | Dashboard charts & analytics |
| Framer Motion | Animations & transitions |
| Leaflet | Interactive hospital maps |
| Lucide React | Icon library |
| QRCode.react | Health ID QR code generation |

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express | REST API server |
| MySQL (mysql2) | Primary database |
| JWT (jsonwebtoken) | Authentication tokens |
| bcryptjs | Password hashing |
| Zod | Input validation |
| WebSocket (ws) | Real-time signaling & updates |
| Nodemailer | Email notifications |
| Multer | File uploads |
| Helmet + CORS | Security headers |
| express-rate-limit | API rate limiting |
| Google Auth Library | OAuth + Calendar integration |

### Project Structure
```
Nurture-Glow/
├── frontend/
│   ├── pages/              # All page-level components
│   │   ├── admin/          # Admin panel pages (19 pages)
│   │   ├── dashboards/     # Role-specific dashboards (4)
│   │   ├── appointments/   # Video session page
│   │   └── profile/        # Profile sub-components
│   ├── components/         # Reusable components
│   │   ├── ai/             # LiveAssistant
│   │   ├── appointments/   # VideoSessionButton
│   │   ├── dashboards/     # Doctor/Admin sub-components
│   │   ├── hospitals/      # HospitalFinder, Map, List
│   │   ├── landing/        # Navbar, Hero, Footer
│   │   ├── navigation/     # SidebarNav, MobileBottomBar
│   │   ├── notifications/  # NotificationBell
│   │   ├── search/         # GlobalSearch
│   │   └── voice/          # VoiceCommands, DebugPanel
│   ├── contexts/           # AuthContext, CartContext
│   ├── hooks/              # useDebounce, useGeolocation, useNearbyHospitals
│   ├── i18n/               # Translations (EN + BN)
│   ├── services/           # API layer, AI service, DB service, TTS
│   ├── types/              # TypeScript interfaces
│   └── utils/              # Validation, web vitals
├── backend/
│   ├── src/
│   │   ├── routes/         # auth.js, health.js, profile.js
│   │   ├── middleware/     # auth.js, sanitize.js, errorHandler.js
│   │   ├── services/       # aiService.js
│   │   ├── integrations/   # googleCalendar.js
│   │   ├── utils/          # validation.js, helpers.js, response.js
│   │   ├── index.js        # Server entry point
│   │   ├── appRoutes.js    # Application routes (5000+ lines)
│   │   ├── adminRoutes.js  # Admin routes (3700+ lines)
│   │   ├── appStore.js     # Generic CRUD for app_entities
│   │   ├── db.js           # MySQL connection pool & helpers
│   │   ├── signaling.js    # WebRTC signaling server
│   │   ├── uploads.js      # File upload config
│   │   └── emailService.js # Email sending
│   ├── migrations/         # SQL migration files
│   └── *.sql               # Schema & seed files
└── docker-compose.yml      # Docker setup
```

---

## 3. User Roles & Access Control

The platform supports **8 distinct roles**, each with tailored UI, navigation menus, and API permissions:

| Role | Code | Description | Access Level |
|---|---|---|---|
| **Mother/Patient** | `mother` | Primary user — tracks pregnancy, books appointments, logs health | Full patient features |
| **Doctor** | `doctor` | Healthcare provider — manages consultations, schedules, earnings | Doctor dashboard |
| **Pharmacist** | `pharmacist` | Manages pharmacy orders, product inventory, prescription verification | Pharmacist dashboard |
| **Nutritionist** | `nutritionist` | Creates nutrition plans, monitors patient diets | Nutritionist dashboard |
| **Merchandiser** | `merchandiser` | Sells products, manages inventory & analytics | Merchandiser dashboard |
| **Medical Admin** | `medical_admin` | Verifies doctors, monitors high-risk cases, reviews consultations | Admin panel (Medical) |
| **Operations Admin** | `ops_admin` | Manages hospitals, card batches, CSR programs, support tickets | Admin panel (Operations) |
| **System Admin** | `system_admin` | Full system control — user management, security, monitoring, settings | Admin panel (System) |

### Workflow: Role Selection at Registration
```
User opens /register
    → Selects role (Mother, Doctor, Pharmacist, Nutritionist, Merchandiser)
    → Fills registration form (name, email, phone, password)
    → Password strength is evaluated in real-time
    → Admin roles require a separate /admin/register with invite code
    → On success → JWT token issued → Redirected to role-specific dashboard
```

---

## 4. Authentication & Security

### 4.1 Registration Flow
```
[Register Page] 
    → User selects role from 5 options (visible role cards)
    → Enters: Name, Email, Phone, Password, Confirm Password
    → Real-time validation:
        • Email format check
        • Phone format check (Bangladeshi format support)
        • Password strength meter (Weak/Fair/Good/Strong)
        • Password match verification
        • Name length validation
    → Accepts Terms & Conditions
    → POST /auth/register → Server creates user → Returns JWT + user object
    → Token stored in localStorage → User redirected to /dashboard
```

### 4.2 Login Flow
```
[Login Page]
    → Enter email/phone + password
    → Rate limiting: 5 attempts per 15 minutes (client-side + server-side)
    → "Remember Me" option → saves email to localStorage
    → POST /auth/login → Server validates credentials → Returns JWT
    → If account suspended → Shows suspension info + appeal form
    → "Forgot Password" modal → sends reset email
    → On success → Redirected to previous page or /dashboard
```

### 4.3 Security Features
| Feature | Implementation |
|---|---|
| JWT Authentication | Tokens with user ID, role, issued at server |
| Password Hashing | bcryptjs with salt rounds |
| Rate Limiting | 100 req/15min general, 5 req/min for auth endpoints |
| Input Sanitization | Global middleware strips XSS vectors |
| CORS Protection | Configurable origin whitelist |
| Helmet | HTTP security headers |
| Admin Invite Code | Required for admin registration |
| Account Suspension | Admins can suspend users; users can appeal |
| Role-Based Route Guards | `ProtectedRoute` component + `requireRole` middleware |

---

## 5. Patient/Mother Features

### 5.1 Dashboard

**File:** `frontend/pages/Dashboard.tsx` (841 lines)  
**Route:** `/dashboard`

The central hub for mothers. Displays a personalized overview of all health data.

#### Workflow
```
User lands on /dashboard
    → Dashboard loads consolidated summary from API (GET /api/dashboard/summary)
    → Simultaneously loads:
        • Appointments (GET /api/appointments)
        • Vaccines (GET /api/vaccines)
        • Hydration data (GET /api/user/meta?keys=hydration)
        • Health history for metrics
        • AI health insights (POST /api/ai/insights)
    → Renders:
        ┌─────────────────────────────────────────────────────┐
        │ Welcome, {firstName}!                               │
        │                                                     │
        │ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐│
        │ │Pregnancy │ │Upcoming  │ │Vaccine   │ │Hydration││
        │ │Week: 24  │ │Appts: 3  │ │Progress  │ │ 5/8     ││
        │ │[Edit]    │ │          │ │ 75%      │ │ glasses ││
        │ └──────────┘ └──────────┘ └──────────┘ └─────────┘│
        │                                                     │
        │ ┌─────────────────────────────────────────────────┐ │
        │ │ Weekly Activity Chart (Recharts bar chart)      │ │
        │ │ [Mon] [Tue] [Wed] [Thu] [Fri] [Sat] [Sun]      │ │
        │ └─────────────────────────────────────────────────┘ │
        │                                                     │
        │ ┌─ AI Insights ──────────────────────────────────┐  │
        │ │ • Stay hydrated with 8-10 glasses daily        │  │
        │ │ • Week 24: Baby can hear your voice            │  │
        │ │ • Schedule your glucose screening test         │  │
        │ └────────────────────────────────────────────────┘  │
        │                                                     │
        │ ┌─ Quick Actions ────────────────────────────────┐  │
        │ │ [Book Appointment] [Log Meal] [Open Journal]   │  │
        │ └────────────────────────────────────────────────┘  │
        └─────────────────────────────────────────────────────┘
```

#### Key Data Points
- **Pregnancy Week**: Editable via modal (0–40 weeks), persisted per user
- **Upcoming Appointments**: Counted from server summary or client filter
- **Vaccine Progress**: Percentage of verified vaccines with status "Taken"
- **Hydration Tracker**: Glasses counter (goal: 8), with warning at 11+ and caution at 17+
- **AI Health Insights**: Generated personalized tips based on pregnancy week, vaccines due, hydration level

---

### 5.2 AI Health Assistant

**File:** `frontend/pages/Assistant.tsx` (285 lines)  
**Route:** `/assistant`

An AI-powered chatbot for health questions and pregnancy guidance.

#### Workflow
```
User opens /assistant
    → Chat interface with message input + send button
    → User types a health question
    → POST /api/ai/chat { message, locale, includeContext }
        → Backend AI service processes query
        → Routes to appropriate model (GPT-4, BioGPT, Risk Predictor)
        → Returns: { text, model_used, intent, sources, risk_level }
    → Response displayed in chat bubble with:
        • Model badge (e.g., "GPT-4", "BioGPT")
        • Intent tag (e.g., "Symptom Check", "Nutrition Advice")
        • Risk level indicator (Low/Medium/High)
        • Source references
    → User can click 🔊 to hear the response via TTS
    → "Live Assistant" mode available for real-time interaction
```

#### Sub-features
| Feature | Description |
|---|---|
| Multi-model AI | Routes to GPT-4, BioGPT, or Risk Predictor based on intent |
| Risk Assessment | Classifies responses as low/medium/high risk |
| Text-to-Speech | Plays AI responses aloud (native browser TTS or backend audio) |
| Live Assistant | Real-time streaming AI component (`LiveAssistant.tsx`) |
| Context Awareness | Can include user's health data for personalized responses |
| Bilingual | Works in English and Bangla |

---

### 5.3 Appointments & Video Consultations

**File:** `frontend/pages/Appointments.tsx` (726 lines)  
**Route:** `/appointments`

Complete doctor consultation booking system with video call support.

#### Workflow
```
User opens /appointments
    → Three tabs: [Online] [Offline] [My Appointments]
    
    ┌─ BOOKING FLOW ──────────────────────────────────────────┐
    │ 1. Browse doctors (loaded from GET /api/doctors)        │
    │    - Filtered by Online/Offline/Both                    │
    │    - Shows: name, specialty, fee, rating, hospital      │
    │ 2. Click "Book" on a doctor card                        │
    │ 3. Modal opens:                                         │
    │    - Select available time slot (from doctor's schedule) │
    │    - Add notes                                          │
    │ 4. POST /api/appointments                               │
    │    { doctorId, date, time, type, notes }                │
    │ 5. Appointment created with status "Pending"            │
    │ 6. Doctor confirms → status becomes "Upcoming"          │
    └─────────────────────────────────────────────────────────┘
    
    ┌─ MY APPOINTMENTS ───────────────────────────────────────┐
    │ • Calendar view with date filter                        │
    │ • Status badges: Upcoming | Pending | Completed | Cancel│
    │ • Actions per appointment:                              │
    │   - [Join Video] (if online + upcoming)                 │
    │   - [Cancel] with confirmation dialog                   │
    │   - [Leave Review] (if completed + not yet reviewed)    │
    └─────────────────────────────────────────────────────────┘
    
    ┌─ VIDEO CONSULTATION ────────────────────────────────────┐
    │ Route: /appointments/video/:appointmentId               │
    │ 1. Click "Join Video" on an upcoming online appointment │
    │ 2. Navigates to video session page                      │
    │ 3. WebRTC signaling via /ws/signaling WebSocket         │
    │ 4. Supports Jitsi or Google Meet                        │
    │ 5. Google Calendar event auto-created (if connected)    │
    └─────────────────────────────────────────────────────────┘
    
    ┌─ DOCTOR REVIEWS ────────────────────────────────────────┐
    │ After a completed appointment:                          │
    │ 1. "Leave Review" button appears                        │
    │ 2. Star rating (1-5) + review text                      │
    │ 3. POST /api/doctor-reviews                             │
    │ 4. Reviews visible on doctor profiles                   │
    └─────────────────────────────────────────────────────────┘
```

---

### 5.4 Vaccine Tracker

**File:** `frontend/pages/VaccineTracker.tsx` (528 lines)  
**Route:** `/vaccines`

Doctor-verified vaccination management with controlled approvals and patient-doctor collaboration.

#### Workflow
```
User opens /vaccines
    → Loads vaccine records (GET /api/vaccines)
    → Loads vaccine catalog (GET /api/catalog/vaccines-list) — from DB
    → Loads weekly vaccine suggestions (GET /api/vaccine-suggestions)
    → Loads available doctors for approval (GET /api/vaccines/doctors)
    → Loads current pregnancy week
    
    ┌─ MAIN VIEW ────────────────────────────────────────────┐
    │ [Search bar] [Filter: All/Taken/Pending/Missed] [Sort] │
    │                                                         │
    │ ┌─ Vaccine Card ──────────┐ ┌─ Vaccine Card ────────┐  │
    │ │ Hepatitis B             │ │ Tetanus Booster       │  │
    │ │ Due: 2026-03-15         │ │ Due: 2026-04-01       │  │
    │ │ Status: ✅ Taken        │ │ Status: ⏳ Pending    │  │
    │ │ Verification: Approved │ │ Verification: Pending │  │
    │ │ [Mark Pending]          │ │ [Mark Taken]          │  │
    │ └─────────────────────────┘ └────────────────────────┘  │
    │                                                         │
    │ [+ Add Vaccine] → Opens modal:                         │
    │    • Searchable vaccine name dropdown (from catalog)    │
    │    • Due date picker                                    │
    │    • Dose number + location                             │
    │    • Assigned doctor (required for approval)            │
    │    • Upload proof (vaccination card)                    │
    │    • Notes                                              │
    │                                                         │
    │ 💡 Suggested Vaccines (based on pregnancy week):        │
    │    Week 24-28: Glucose Tolerance Test, Rh Antibody      │
    └─────────────────────────────────────────────────────────┘
```

#### Approval Flow
```
Patient submits vaccine entry
    → Record status = Pending Approval
    → Doctor notified (Dashboard → Vaccine Reviews)
    → Doctor approves or rejects with reason
    → Patient notified and timeline updates
```

#### Key Features
- **Doctor-Verified Workflow**: Patient entries remain pending until a doctor approves or rejects
- **Doctor Adds Records**: Doctor-created entries are auto-verified
- **Proof Uploads**: Optional vaccination card upload per record
- **Timeline Categories**: Completed, Pending Approval, Rejected, Upcoming, Overdue
- **Smart Suggestions**: Based on current pregnancy week from `vaccine_suggestions` table
- **Reminders**: Due soon, due today, and overdue notifications
- **Messaging Thread**: Per-vaccine patient-doctor communication
- **Search & Sort**: Filter by status and category, sort by date/name

---

### 5.5 Pregnancy Tracker

**File:** `frontend/pages/Pregnancy.tsx` (158 lines)  
**Route:** `/pregnancy`

Week-by-week pregnancy progress and baby development information.

#### Workflow
```
User opens /pregnancy
    → Loads all pregnancy week info (GET /api/pregnancy/week-info) — from DB
    → Loads user's saved pregnancy week
    
    ┌─ PREGNANCY DASHBOARD ──────────────────────────────────┐
    │ Stage: Second Trimester                                │
    │ "Your Baby is the size of an Ear of Corn"              │
    │                                                        │
    │ ┌─ Stats ─────────────────────────────────────────┐    │
    │ │ Weeks to Go: 16 │ Due Date: In ~112 Days        │    │
    │ └─────────────────────────────────────────────────┘    │
    │                                                        │
    │ Week Selector: [◀] ████████████░░░░░░ [▶]  Week 24    │
    │                                                        │
    │ ┌─ This Week ────────────────────────────────────────┐ │
    │ │                                                    │ │
    │ │ 🍎 Nutrients: Iron, Calcium, Vitamin D             │ │
    │ │ ⚡ Symptoms: Back pain, Braxton Hicks              │ │
    │ │ 💡 Tips: Practice breathing exercises...           │ │
    │ └────────────────────────────────────────────────────┘ │
    └────────────────────────────────────────────────────────┘
```

#### Data Source
- All week data stored in `pregnancy_week_info` SQL table
- Fields per week: `stage_name`, `baby_size`, `tips[]`, `nutrients[]`, `symptoms[]`
- Week selection saved per user and synced across devices

---

### 5.6 Nutrition & Hydration Tracker

**File:** `frontend/pages/Nutrition.tsx` (205 lines)  
**Route:** `/nutrition`

Track daily meals, calorie intake, and water consumption.

#### Workflow
```
User opens /nutrition
    → Loads nutrition goals (GET /api/nutrition/goals) — from DB
    → Loads meal logs (GET /api/nutrition)
    → Loads hydration count (GET /api/user/meta?keys=hydration)
    
    ┌─ NUTRITION DASHBOARD ──────────────────────────────────┐
    │ ┌──────────────┐ ┌──────────────┐ ┌──────────────────┐│
    │ │Daily Calories│ │Target Protein│ │Water Intake      ││
    │ │1450 / 2200   │ │45g / 75g     │ │💧💧💧💧💧░░░░░  ││
    │ │[▓▓▓▓▓░░░]   │ │[▓▓▓▓░░]     │ │5 / 10 glasses   ││
    │ └──────────────┘ └──────────────┘ │[+] [-]          ││
    │                                    └──────────────────┘│
    │                                                        │
    │ ┌─ Today's Meals ────────────────────────────────────┐ │
    │ │ 🍳 Breakfast: Oatmeal — 320 cal     [🗑 Delete]   │ │
    │ │ 🍛 Lunch: Rice & Curry — 550 cal    [🗑 Delete]   │ │
    │ │ 🍎 Snack: Apple — 95 cal            [🗑 Delete]   │ │
    │ └────────────────────────────────────────────────────┘ │
    │                                                        │
    │ [+ Log Meal] → Modal: Name, Calories, Type            │
    │   Types: Breakfast | Lunch | Dinner | Snack            │
    └────────────────────────────────────────────────────────┘
```

#### Key Features
- **Nutrition Goals**: Loaded from `nutrition_goals` table (calories, protein, carbs, fat, water)
- **Meal Logging**: Add meals with name, calorie count, and meal type
- **Hydration Counter**: Increment/decrement water glasses, stored per user
- **Progress Bars**: Visual progress toward daily goals
- **Calorie Summary**: Auto-calculated total from logged meals

---

### 5.7 Health Metrics Tracking

**File:** `frontend/pages/Health.tsx` (294 lines)  
**Route:** `/health/:metric?`

Track and visualize four health metrics over time.

#### Workflow
```
User opens /health
    → Loads histories for all metrics from API
    
    ┌─ HEALTH METRICS ──────────────────────────────────────┐
    │                                                        │
    │ ┌─ Heart Rate ─┐ ┌─ Hydration ──┐ ┌─ Weight ────────┐│
    │ │ ❤️ 78 bpm    │ │ 💧 2.5 L     │ │ ⚖️ 65 kg       ││
    │ │ [View History]│ │ [View History]│ │ [View History]  ││
    │ │ [+ Add Entry]│ │ [+ Add Entry]│ │ [+ Add Entry]  ││
    │ └──────────────┘ └──────────────┘ └─────────────────┘│
    │                                                        │
    │ ┌─ Sleep ──────────────────────────────────────────┐   │
    │ │ 🌙 7h 30m                                       │   │
    │ │ [View History] [+ Add Entry]                     │   │
    │ └──────────────────────────────────────────────────┘   │
    │                                                        │
    │ Add Entry Modal:                                       │
    │   • Select date (default: today)                       │
    │   • Enter value                                        │
    │   • Validates range per metric                         │
    │   • POST /api/health/history/{metric}                  │
    └────────────────────────────────────────────────────────┘
```

#### Tracked Metrics
| Metric | Unit | Icon |
|---|---|---|
| Heart Rate | bpm | ❤️ Activity |
| Hydration | L | 💧 Droplet |
| Weight | kg | ⚖️ Weight |
| Sleep | hours | 🌙 Clock |

---

### 5.8 Personal Journal

**File:** `frontend/pages/Journal.tsx` (398 lines)  
**Route:** `/journal`

A private journal for mothers to document their pregnancy journey.

#### Workflow
```
User opens /journal
    → Loads journal entries (GET /api/journal)
    
    ┌─ JOURNAL ──────────────────────────────────────────────┐
    │ [+ New Entry]                                          │
    │                                                        │
    │ ┌─ March 1, 2026 ───────────────────────────────────┐  │
    │ │ Title: "Feeling Baby Kick!"                       │  │
    │ │ Content: Today I felt the baby kick for the...    │  │
    │ │ 📎 Attachments: ultrasound.jpg                    │  │
    │ │ [Edit] [Delete]                                   │  │
    │ └───────────────────────────────────────────────────┘  │
    │                                                        │
    │ New Entry Modal:                                       │
    │   • Title (optional)                                   │
    │   • Content (required)                                 │
    │   • Image/file attachments (max 2MB each, base64)      │
    │   • [Save] / [Cancel]                                  │
    │                                                        │
    │ Edit Flow:                                             │
    │   • Click Edit → Inline editing mode                   │
    │   • Modify title, content, attachments                 │
    │   • [Save Changes] / [Cancel]                          │
    │                                                        │
    │ Delete Flow:                                           │
    │   • Click Delete → Confirmation dialog                 │
    │   • "Are you sure?" → [Confirm] / [Cancel]             │
    └────────────────────────────────────────────────────────┘
```

---

### 5.9 Community Forum

**File:** `frontend/pages/Community.tsx` (279 lines)  
**Route:** `/community`

Social sharing space for mothers to connect, share experiences, and support each other.

#### Workflow
```
User opens /community
    → Loads all posts (GET /api/posts)
    
    ┌─ COMMUNITY FORUM ─────────────────────────────────────┐
    │ ┌─ New Post ──────────────────────────────────────┐    │
    │ │ [Write something...]                            │    │
    │ │ [📷 Add Image] [✨ Post]                        │    │
    │ └─────────────────────────────────────────────────┘    │
    │                                                        │
    │ ┌─ Post by Sarah ────────────────────────────────────┐ │
    │ │ "Just had my 20-week scan! Everything looks great" │ │
    │ │ [🖼️ Image attached]                               │ │
    │ │                                                     │ │
    │ │ ❤️ 12 likes   💬 3 comments    [Delete if owner]   │ │
    │ │                                                     │ │
    │ │ ┌─ Comments ──────────────────────────────────────┐│ │
    │ │ │ @Maria: "Congratulations! 🎉"                  ││ │
    │ │ │ @Fatima: "So happy for you!"                   ││ │
    │ │ │ [Write a comment...] [Send]                    ││ │
    │ │ └─────────────────────────────────────────────────┘│ │
    │ └─────────────────────────────────────────────────────┘ │
    └────────────────────────────────────────────────────────┘
```

#### Key Features
- **Post Creation**: Text + optional image (max 2MB, base64)
- **Like Toggle**: Like/unlike posts (tracked by user ID)
- **Comments**: Add, delete comments on any post
- **Post Deletion**: Owner-only with confirmation dialog
- **Real-time Updates**: Listens to `db-update` events for auto-refresh
- **Toast Notifications**: Success/error messages for all actions

---

### 5.10 Hospital Finder (Live Map)

**File:** `frontend/pages/Hospitals.tsx` → `components/hospitals/HospitalFinder.tsx`  
**Route:** `/hospitals`

Find nearby hospitals using live geolocation and interactive Leaflet map.

#### Workflow
```
User opens /hospitals
    → Browser requests geolocation permission
    → On permission granted:
        1. Gets user's lat/lng coordinates
        2. Queries Overpass API for nearby hospitals (configurable radius)
        3. Renders results on Leaflet map + list view
    
    ┌─ HOSPITAL FINDER ─────────────────────────────────────┐
    │ [📍 Update Location] [🔄 Refresh] [Radius: ▼ 5 km]   │
    │ Your location: 23.8103, 90.4125                        │
    │                                                        │
    │ ┌─ Map (Leaflet) ────────────┐ ┌─ Hospital List ────┐ │
    │ │                            │ │ 🏥 Dhaka Medical   │ │
    │ │    📍 You                  │ │    0.8 km away     │ │
    │ │    🏥 🏥                   │ │    [Get Directions] │ │
    │ │      🏥                    │ │                     │ │
    │ │                            │ │ 🏥 Holy Family     │ │
    │ │    🏥                      │ │    1.2 km away     │ │
    │ │                            │ │    [Get Directions] │ │
    │ └────────────────────────────┘ └─────────────────────┘ │
    │                                                        │
    │ Radius options: 1km | 3km | 5km | 10km                │
    └────────────────────────────────────────────────────────┘
```

#### Key Features
- **Live Geolocation**: Uses browser's Geolocation API (`useGeolocation` hook)
- **Overpass API**: Queries OpenStreetMap for real hospital data
- **Interactive Map**: Leaflet map with hospital markers + user location
- **Configurable Radius**: 1km, 3km, 5km, 10km options
- **Hospital Details**: Name, distance, type, directions link

---

### 5.11 Blood Donor Network

**File:** `frontend/pages/BloodDonors.tsx` (456 lines)  
**Route:** `/donors`

Find and connect with blood donors, register as a donor, send urgent requests.

#### Workflow
```
User opens /donors
    → Loads donors (GET /api/donors) and blood requests (GET /api/blood-requests)
    
    ┌─ BLOOD DONOR NETWORK ─────────────────────────────────┐
    │ [Search by name/location]                              │
    │ Filter: [All] [A+] [A-] [B+] [B-] [AB+] [AB-] [O+]  │
    │                                                        │
    │ ┌─ Donor Card ────────────────────────────────────┐    │
    │ │ 🩸 Rakib Ahmed                                  │    │
    │ │ Blood Group: O+  │  Location: Dhaka             │    │
    │ │ [📞 Call] [🆘 Urgent Request]                   │    │
    │ └─────────────────────────────────────────────────┘    │
    │                                                        │
    │ [🩸 Become a Donor] → Registration Modal:             │
    │   • Full Name (required)                               │
    │   • Blood Group (dropdown)                             │
    │   • Location (required)                                │
    │   • Phone Number (validated)                           │
    │   • Duplicate prevention (phone-based)                 │
    │                                                        │
    │ Urgent Request Modal:                                  │
    │   • Your phone number                                  │
    │   • Emergency message                                  │
    │   → POST /api/blood-requests                           │
    └────────────────────────────────────────────────────────┘
```

#### Key Features
- **Donor Registry**: Register with blood group, location, phone
- **Duplicate Prevention**: Server-side check by phone number (409 Conflict)
- **Blood Group Filter**: Filter donors by all 8 blood groups
- **Urgent Requests**: Send emergency blood requests to specific donors
- **Call Donor**: Opens phone dialer with donor's number
- **Verification Status**: Shows verified/unverified badge

---

### 5.12 Pharmacy & Shopping Cart

**Files:** `frontend/pages/Pharmacy.tsx` (297 lines), `Cart.tsx` (150 lines)  
**Routes:** `/pharmacy`, `/cart`

E-commerce module for ordering prenatal vitamins, supplements, and baby care products.

#### Workflow
```
┌─ PHARMACY ─────────────────────────────────────────────────┐
│ [🔍 Search] [Category: All ▼] [🛒 Cart (3)]              │
│                                                            │
│ Categories: All | Favourites | Vitamins | Baby Care | ...  │
│                                                            │
│ ┌─ Product Card ──────────┐ ┌─ Product Card ────────────┐ │
│ │ [🖼️ Product Image]      │ │ [🖼️ Product Image]        │ │
│ │ ❤️ (Favourite toggle)   │ │ ❤️                         │ │
│ │ VITAMINS                │ │ BABY CARE                  │ │
│ │ Prenatal Folic Acid     │ │ Baby Moisturizer           │ │
│ │ ৳350     [+]            │ │ ৳280     [+]               │ │
│ └─────────────────────────┘ └────────────────────────────┘ │
│                                                            │
│ Subscription: [🔔 Subscribe for Delivery] → SubscModal    │
└────────────────────────────────────────────────────────────┘

┌─ SHOPPING CART ────────────────────────────────────────────┐
│ [← Back to Pharmacy]                                      │
│                                                            │
│ ┌─ Cart Items ──────────────────────────────────────────┐  │
│ │ Prenatal Folic Acid  ৳350  [-] 2 [+]  ৳700  [🗑]    │  │
│ │ Baby Moisturizer     ৳280  [-] 1 [+]  ৳280  [🗑]    │  │
│ └───────────────────────────────────────────────────────┘  │
│                                                            │
│ ┌─ Order Summary ───────────────────────────────────────┐  │
│ │ Subtotal:     ৳980                                   │  │
│ │ Delivery:     ৳60                                    │  │
│ │ Total:        ৳1,040                                 │  │
│ │ [💳 Checkout]                                        │  │
│ └───────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

#### Key Features
- **Product Catalog**: Loaded from database via API
- **Category Filtering**: Dynamic categories + "Favourites" filter
- **Favourites**: Heart toggle, persisted in localStorage
- **Cart Context**: Global React context, persisted in localStorage
- **Quantity Control**: Increment/decrement with auto-remove at 0
- **Delivery Fee**: ৳60 flat fee when cart is not empty
- **Subscription Modal**: Subscribe for recurring deliveries

---

### 5.13 AI Health Translator

**File:** `frontend/pages/Translator.tsx` (228 lines)  
**Route:** `/translator`

Translate health-related terms between English and Bangla.

#### Workflow
```
User opens /translator
    → Direction toggle: English → Bangla / Bangla → English
    
    ┌─ AI HEALTH TRANSLATOR ─────────────────────────────────┐
    │                                                         │
    │ Direction: [English → Bangla] ↔ [Bangla → English]     │
    │                                                         │
    │ ┌─ Input ──────────────────────────────────────────┐    │
    │ │ "I have a headache and fever"                    │    │
    │ │ [Translate]                                      │    │
    │ └──────────────────────────────────────────────────┘    │
    │                                                         │
    │ ┌─ Output ─────────────────────────────────────────┐    │
    │ │ "আমার মাথাব্যথা এবং জ্বর"                         │    │
    │ │ [📋 Copy] [🔊 Speak]                              │    │
    │ └──────────────────────────────────────────────────┘    │
    │                                                         │
    │ Quick Symptoms: [Fever] [Cough] [Headache] [Nausea]     │
    └─────────────────────────────────────────────────────────┘
```

#### Key Features
- **Offline Translation**: Uses local phrase dictionary (`services/phrases.ts`)
- **Quick Symptom Buttons**: One-click translation for common symptoms
- **Text-to-Speech**: Browser-native speech synthesis for translated text
- **Copy to Clipboard**: Quick copy of translated text
- **Language Auto-detection**: Detects Bangla script in output for correct TTS voice

---

### 5.14 Myth Buster

**File:** `frontend/pages/Myths.tsx` (258 lines)  
**Route:** `/myths`

AI-powered pregnancy myth verification system.

#### Workflow
```
User opens /myths
    → Enters a health claim/myth
    
    ┌─ MYTH BUSTER ─────────────────────────────────────────┐
    │ "Is it true that...?"                                  │
    │                                                        │
    │ [Enter a health claim or myth]                         │
    │ [🔍 Check Myth]  [🔄 Reset]                           │
    │                                                        │
    │ ┌─ Result ─────────────────────────────────────────┐   │
    │ │ Verdict: ❌ FALSE                                │   │
    │ │                                                   │   │
    │ │ Claim: "Eating spicy food induces labor"          │   │
    │ │                                                   │   │
    │ │ Explanation: There is no scientific evidence...    │   │
    │ │                                                   │   │
    │ │ ✅ Safe Advice:                                   │   │
    │ │    • Eat a balanced diet                          │   │
    │ │    • Avoid extremely spicy foods if you have...   │   │
    │ │                                                   │   │
    │ │ 🏥 When to Call Doctor:                           │   │
    │ │    • If you experience contractions               │   │
    │ │                                                   │   │
    │ │ Source: Medical Database                          │   │
    │ │ [📋 Copy Result]                                  │   │
    │ └──────────────────────────────────────────────────┘   │
    └────────────────────────────────────────────────────────┘
```

#### Verdicts
| Verdict | Color | Meaning |
|---|---|---|
| True ✅ | Green | Scientifically supported |
| False ❌ | Red | Debunked myth |
| Mixed ⚠️ | Orange | Partially true |
| Depends 🔵 | Blue | Context-dependent |

API: `POST /api/ai/check-myth` → queries `pregnancy_myths` table + AI analysis

---

### 5.15 Health Identity Hub (Profile)

**File:** `frontend/pages/profile/ProfilePage.tsx` (598 lines)  
**Route:** `/profile`

Comprehensive health identity management system.

#### Workflow
```
User opens /profile
    → Loads: documents, medical report, visits, hospitals, 
      verification requests, emergency contacts, connected devices
    
    Tabs: [Overview] [Medical Records] [Verification & Security] [Settings]
    
    ┌─ OVERVIEW TAB ─────────────────────────────────────────┐
    │ ┌─ Profile Hero ───────────────────────────────────┐   │
    │ │ [Avatar] 📷 Upload                               │   │
    │ │ Name: Sarah Ahmed [✏️ Edit]                      │   │
    │ │ Email: sarah@email.com                           │   │
    │ │ Health ID: NG-2026-XXXX  [📤 Share] [QR Code]    │   │
    │ │ Verification: ✅ Verified / ⏳ Pending            │   │
    │ │ Profile Strength: ████████░░ 80%                 │   │
    │ └──────────────────────────────────────────────────┘   │
    │                                                        │
    │ ┌─ Health Snapshot ────────────────────────────────┐   │
    │ │ Blood Group: A+  | Allergies: None              │   │
    │ │ Diabetes: No     | Conditions: —                │   │
    │ └─────────────────────────────────────────────────┘   │
    │                                                        │
    │ ┌─ Emergency Contact ─────────────────────────────┐   │
    │ │ Name: Ahmed  │ Phone: +880...  │ Relation: Spouse│  │
    │ │ [Edit]                                           │   │
    │ └──────────────────────────────────────────────────┘   │
    │                                                        │
    │ Next Actions: [Upload Documents] [Log Visit] [Share ID]│
    └────────────────────────────────────────────────────────┘
    
    ┌─ MEDICAL RECORDS TAB ──────────────────────────────────┐
    │ • Medical Report (blood group, allergies, conditions)  │
    │ • Visit History — log doctor visits with notes          │
    │ • Connected Devices (smartphone, smartwatch, etc.)      │
    └────────────────────────────────────────────────────────┘
    
    ┌─ VERIFICATION & SECURITY TAB ──────────────────────────┐
    │ • Document Upload (NID, Birth Cert, Marriage Cert, etc.)│
    │ • Document verification status tracking                 │
    │ • Hospital verification requests                        │
    │ • Health ID sharing with QR code                        │
    └────────────────────────────────────────────────────────┘
    
    ┌─ SHARE HEALTH ID MODAL ────────────────────────────────┐
    │ • QR Code (generated with qrcode.react)                │
    │ • Copy health ID text                                   │
    │ • Download QR code as PNG                               │
    │ • Share via Web Share API                                │
    └────────────────────────────────────────────────────────┘
```

---

### 5.16 Notifications System

**File:** `frontend/components/notifications/NotificationBell.tsx`  
**API:** `GET /api/notifications`, `PATCH /api/notifications/:id`

#### Workflow
```
Notification Bell (always visible in top bar)
    → Shows unread count badge
    → Click → Dropdown with notification list
    → Types: VACCINE, APPOINTMENT, COMMUNITY, SYSTEM, VERIFICATION, etc.
    → Click notification → marks as read + navigates to relevant page
    → Real-time updates via WebSocket
```

---

## 6. Doctor Dashboard

**File:** `frontend/pages/dashboards/DoctorDashboard.tsx` (636 lines)  
**Route:** `/dashboard?tab=<tab>`

Full-featured workspace for healthcare providers.

### Tabs & Features

| Tab | Component | Features |
|---|---|---|
| **Overview** | Inline | Stats cards (patients today, pending, revenue), patient queue, quick actions |
| **Consultations** | `ConsultationList` | List all consultations, filter by status, update status (pending→in-progress→completed) |
| **Schedule** | `ScheduleManager` | Set availability slots (start/end time, duration), manage working days |
| **Earnings** | `EarningsOverview` | Revenue tracking, consultation fee management, payment history |
| **Telemedicine** | `TelemedicineHub` | Video call management, Google Calendar integration, meeting links |
| **Patient Care** | `PatientManagement` | Patient list, medical histories, care notes |
| **Vaccine Reviews** | `VaccineApprovals` | Review/approve/reject patient vaccine entries, add verified vaccines |
| **Clinical Tools** | `ClinicalTools` | Medical calculators, reference guides |
| **Practice** | `PracticeManagement` | Practice settings, document templates |
| **Analytics** | `AnalyticsReporting` | Charts for consultations, revenue, patient trends |
| **Compliance** | `ComplianceCenter` | Regulatory compliance tracking |
| **Mobile** | `MobileFeatures` | Mobile-optimized features |

### Fee Management Workflow
```
Doctor opens Dashboard → Overview tab
    → Current fee displayed (e.g., ৳500)
    → Click "Edit Fee" → Input field appears
    → Enter new amount → "Save" 
    → PUT /api/doctor/fee { fee: 600 }
    → Dashboard updates locally
    → Success toast: "Fee updated successfully"
```

---

## 7. Pharmacist Dashboard

**File:** `frontend/pages/dashboards/PharmacistDashboard.tsx` (696 lines)  
**Route:** `/dashboard?tab=<tab>`

### Tabs & Features

| Tab | Features |
|---|---|
| **Overview** | Order stats, active orders, pending verifications |
| **Orders** | All pharmacy orders, filter by status, update order status (pending→processing→shipped→delivered) |
| **Products** | Browse/manage pharmacy product catalog, search, filter by category |
| **Verification** | Pharmacy license verification form (name, license#, owner, address, phone, documents) |
| **Notifications** | Pharmacist-specific notifications |

### Order Processing Workflow
```
Patient orders products from Pharmacy
    → Order appears in Pharmacist's Orders tab (status: pending)
    → Pharmacist reviews order → Clicks "Process"
    → Status: pending → processing → shipped → delivered
    → Each status change triggers notification to patient
```

---

## 8. Nutritionist Dashboard

**File:** `frontend/pages/dashboards/NutritionistDashboard.tsx` (806 lines)  
**Route:** `/dashboard?tab=<tab>`

### Tabs & Features

| Tab | Features |
|---|---|
| **Overview** | Active patients count, plans created, analytics summary |
| **Patients** | Patient list with age, BMI, dietary restrictions, goals; filter by active/completed |
| **Nutrition Plans** | Create/edit plans (title, details, status); assign to patients; filter by draft/active/completed |
| **Analytics** | Patient progress charts, plan effectiveness |
| **Notifications** | Nutritionist-specific notifications |

### Nutrition Plan Workflow
```
Nutritionist opens Plans tab
    → Click "Create Plan"
    → Fill: Patient (dropdown), Title, Details
    → Status: Draft → Active → Completed
    → POST /api/nutritionist/plans
    → Plan appears in patient's recommendations
```

---

## 9. Merchandiser Dashboard

**File:** `frontend/pages/dashboards/MerchandiserDashboard.tsx` (632 lines)  
**Route:** `/dashboard?tab=<tab>`

### Tabs & Features

| Tab | Features |
|---|---|
| **Overview** | Product count, sales stats, low stock alerts |
| **Products** | Add/edit products (name, category, price, stock, image, description); status: draft/active/inactive |
| **Inventory** | Stock levels, low stock threshold management |
| **Analytics** | Sales charts, product performance |
| **Notifications** | Merchandiser-specific notifications |

### Product Management Workflow
```
Merchandiser opens Products tab
    → "Add Product" → Form: name, category, price, stock, threshold, image, description
    → Status: draft → active (listed in pharmacy) → inactive (hidden)
    → POST /api/merchandiser/products
    → Active products appear in patient's Pharmacy page
```

---

## 10. Admin Panel

**Separate authentication** at `/admin/login` with invite code required for registration.

### 10.1 System Admin

**File:** `frontend/pages/admin/SystemAdminDashboard.tsx` (1872 lines)  
**Route:** `/admin/system`

| Feature | Description |
|---|---|
| **User Management** | View all users, assign roles, suspend/unsuspend accounts, search & filter |
| **System Monitoring** | Server health, component status, uptime %, response times |
| **Security Logs** | Login attempts, suspicious activity, IP tracking |
| **System Messages** | Broadcast messages to all users, specific roles, or specific users |
| **System Settings** | Maintenance mode toggle, global configuration |
| **Database Backup** | Create/download MySQL backups via `mysqldump` |
| **Admin Actions Log** | Audit trail of all admin operations |
| **Real-time Dashboard** | WebSocket-powered live stats refresh |

### Sub-pages
| Page | Route | Purpose |
|---|---|---|
| `UserManagement` | `/admin/users` | CRUD users, role assignment |
| `SecuritySettings` | `/admin/security` | Security configuration |
| `SystemMonitoring` | `/admin/monitoring` | Real-time system health |
| `DatabaseBackup` | `/admin/backups` | Backup management |
| `SuspensionAppeals` | `/admin/appeals` | Review user suspension appeals |

### User Suspension Workflow
```
System Admin opens User Management
    → Finds user → Click "Suspend"
    → Enter suspension reason
    → POST /api/admin/users/:id/suspend { reason }
    → User receives email notification
    → Suspended user sees suspension screen on login
    → User can submit appeal with message
    → Admin reviews appeal in Suspension Appeals page
    → Approve → User unsuspended | Reject → Remains suspended
```

---

### 10.2 Medical Admin

**File:** `frontend/pages/admin/MedicalAdminDashboard.tsx` (388 lines)  
**Route:** `/admin/medical`

| Feature | Description |
|---|---|
| **Doctor Verifications** | Review pending doctor registrations, approve/reject with notes |
| **High-Risk Cases** | Monitor high-risk pregnancies (ACTIVE/RESOLVED/EMERGENCY/HOSPITALIZED) |
| **Consultation Reviews** | Audit doctor consultations (PENDING/IN_REVIEW/APPROVED/FLAGGED/ESCALATED) |
| **Emergency Access Logs** | Track emergency data access events |

### Sub-pages
| Page | Route | Purpose |
|---|---|---|
| `MedicalDoctorVerifications` | `/admin/medical/verifications` | Doctor credential verification |
| `MedicalHighRiskCases` | `/admin/medical/high-risk` | High-risk pregnancy monitoring |
| `MedicalConsultationReviews` | `/admin/medical/consultations` | Consultation quality review |
| `MedicalEmergencyAccessLogs` | `/admin/medical/emergency-access` | Emergency access audit |

### Doctor Verification Workflow
```
Doctor registers on platform
    → Verification request auto-created (status: PENDING)
    → Medical Admin notified
    → Admin opens Verifications page
    → Reviews doctor credentials, documents
    → Status flow: PENDING → UNDER_REVIEW → APPROVED / REJECTED / ADDITIONAL_INFO_REQUIRED
    → Doctor notified of decision
    → If APPROVED → Doctor can start accepting consultations
```

---

### 10.3 Operations Admin

**File:** `frontend/pages/admin/OperationsAdminDashboard.tsx` (486 lines)  
**Route:** `/admin/operations`

| Feature | Description |
|---|---|
| **Hospital Management** | Add/edit hospitals, manage status (pending/active/inactive) |
| **Card Batches** | Manage Health ID card production batches |
| **CSR Programs** | Corporate social responsibility program management |
| **Support Tickets** | Handle user support tickets (urgent/open/resolved) |
| **Doctor Ratings** | View aggregated doctor ratings and reviews |

### Sub-pages
| Page | Route | Purpose |
|---|---|---|
| `OperationsHospitals` | `/admin/operations/hospitals` | Hospital CRUD |
| `OperationsCardBatches` | `/admin/operations/cards` | Card batch management |
| `OperationsCSRPrograms` | `/admin/operations/csr` | CSR program tracking |
| `OperationsSupportTickets` | `/admin/operations/tickets` | Ticket management |
| `HealthIdVerifications` | `/admin/operations/health-id` | Health ID verification queue |

---

## 11. Public/Landing Pages

Accessible without authentication.

| Page | Route | Description |
|---|---|---|
| **Landing** | `/` | Hero section, feature showcase, about, testimonials, newsletter signup |
| **About** | `/about` | Company mission, team, statistics |
| **Features** | `/features` | Detailed feature descriptions |
| **Pricing** | `/pricing` | Subscription plans (loaded from DB), FAQs |
| **Contact** | `/contact` | Contact form |
| **How It Works** | `/how-it-works` | Step-by-step guide |
| **Privacy Policy** | `/privacy` | Privacy terms |
| **Terms of Service** | `/terms` | ToS |
| **Cookie Policy** | `/cookie-policy` | Cookie usage |

### Landing Page Components
- `Navbar` — Navigation with smooth scroll, auth links
- `Hero` — Animated hero with CTA buttons
- `Footer` — Links, social media, newsletter
- `SmoothScrollProvider` — Lenis-based smooth scrolling
- `Reveal` / `Stagger` — Framer Motion animation wrappers

---

## 12. Cross-Cutting Features

### 12.1 Internationalization (i18n)

**Files:** `frontend/i18n/I18nContext.tsx`, `frontend/i18n/translations.ts`

- **Languages**: English (`en`), Bangla (`bn`)
- **Implementation**: React Context with `useTranslations()` hook
- **Coverage**: Navigation, auth forms, dashboard labels, landing page, notifications
- **Locale Switching**: Available in sidebar settings

```
Translation Key Structure:
t('nav.dashboard')       → "Dashboard" / "ড্যাশবোর্ড"
t('landing.hero.title')  → "Nurturing" / "পরিচর্যা"
t('auth.login')          → "Login" / "লগইন"
```

---

### 12.2 Voice Commands

**Files:** `frontend/components/voice/useVoiceCommands.ts`, `frontend/services/voice.ts`

- **Technology**: Web Speech API (`SpeechRecognition`)
- **Languages**: English + Bangla voice recognition
- **Navigation Commands**: "Go to dashboard", "Open appointments", etc.
- **Intent Matching**: Maps spoken phrases to navigation paths
- **UI**: Microphone button in top bar, debug panel for development

```
Voice Command Examples:
"Open dashboard"       → navigates to /dashboard
"Book appointment"     → navigates to /appointments
"ড্যাশবোর্ড খুলুন"      → navigates to /dashboard (Bangla)
```

---

### 12.3 Real-time Updates (WebSocket)

**Files:** `frontend/services/realtimeUpdateService.ts`, `backend/src/signaling.js`

- **Protocol**: WebSocket (`ws://` / `wss://`)
- **Endpoints**: 
  - `/ws/signaling` — WebRTC video call signaling
  - Dashboard real-time updates
- **Message Types**:
  - `dashboard_update` — Refresh dashboard data
  - `system_message` — Admin broadcasts
  - `security_alert` — Security events
  - `user_status_change` — Role/suspension changes
  - `maintenance_mode` — System maintenance toggle
- **Auto-reconnect**: Up to 5 attempts with 3s delay

---

### 12.4 Global Search

**File:** `frontend/components/search/GlobalSearch.tsx`

- Searches across sidebar menu items
- Filters navigation options by label text
- Accessible from the sidebar

---

### 12.5 Code Splitting & Performance

- **Lazy Loading**: All page components loaded via `React.lazy()` with `Suspense`
- **Memoization**: `useMemo` for expensive calculations, `React.memo` for product cards
- **Context Optimization**: `useCallback` for stable context function references
- **Image Optimization**: `loading="lazy"` on all images
- **Bundle Splitting**: Vite automatic chunk splitting

---

## 13. Database Schema Overview

The MySQL database contains **50+ tables** organized into these domains:

### Core Tables
| Table | Purpose |
|---|---|
| `users` | User accounts (id, email, phone, password_hash, role, is_suspended) |
| `user_profiles` | Extended profile data (full_name, avatar_url, etc.) |
| `user_roles` | Role assignments (many-to-many) |
| `emergency_contacts` | Emergency contact per user |

### Health & Pregnancy
| Table | Purpose |
|---|---|
| `pregnancies` | Pregnancy records with due dates |
| `pregnancy_week_info` | Week-by-week pregnancy data (stage, baby_size, tips, nutrients, symptoms) |
| `pregnancy_checkins` | Weekly mood/symptom check-ins |
| `health_records` | Generic health record entries |
| `health_record_files` | Uploaded health documents |
| `vaccination_events` | Vaccination records per user |
| `vaccine_schedules` | Vaccine schedule templates |
| `nutrition_goals` | Per-user nutrition targets |

### Appointments & Doctors
| Table | Purpose |
|---|---|
| `doctors` | Doctor profiles (full_name, specialty_id, fee, rating) |
| `doctor_specialties` | Medical specialty catalog |
| `doctor_availability_slots` | Time slot configuration per doctor |
| `doctor_verification_requests` | Verification workflow for new doctors |
| `doctor_reviews` | Patient reviews and ratings |
| `app_entities` (type: appointment) | Appointment records |
| `meetings` | Video meeting data |

### Community & Content
| Table | Purpose |
|---|---|
| `app_entities` (type: post) | Community forum posts |
| `app_entities` (type: comment) | Post comments |
| `app_entities` (type: blood_donor) | Blood donor registrations |
| `app_entities` (type: blood_request) | Blood requests |
| `app_catalog` | Product catalog and legacy reference data |
| `vaccine_catalog` | Vaccine catalog for tracker |
| `vaccine_suggestions` | Week-based vaccine suggestions |
| `pregnancy_myths` | Myth database for the myth buster |

### Admin & Operations
| Table | Purpose |
|---|---|
| `admin_notifications` | Admin-specific notifications |
| `security_audit_log` | Security event logging |
| `system_settings` | Global system configuration |
| `suspension_appeals` | User appeal records |
| `support_tickets` | User support tickets |
| `card_batches` | Health ID card batch management |
| `csr_programs` | CSR program data |
| `hospital_registrations` | Hospital management |
| `subscription_plans` | Pricing/subscription plan data |
| `faqs` | FAQ entries |

---

## 14. API Endpoints Reference

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Authenticate user |
| GET | `/auth/me` | Get current user profile |
| POST | `/auth/forgot-password` | Initiate password reset |
| POST | `/auth/reset-password` | Complete password reset |

### Patient APIs
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/appointments` | List user's appointments |
| POST | `/api/appointments` | Book new appointment |
| PATCH | `/api/appointments/:id` | Update appointment status |
| DELETE | `/api/appointments/:id` | Delete appointment |
| GET | `/api/vaccines` | List user's vaccines |
| POST | `/api/vaccines` | Add vaccine record |
| PATCH | `/api/vaccines/:id` | Update vaccine record (resubmits for approval) |
| GET | `/api/vaccines/doctors` | List doctors available for vaccine approval |
| POST | `/api/vaccines/:id/proof` | Upload vaccination proof |
| GET | `/api/vaccines/:id/messages` | List vaccine messages |
| POST | `/api/vaccines/:id/messages` | Send vaccine message |
| GET | `/api/nutrition` | List meal logs |
| POST | `/api/nutrition` | Log new meal |
| GET | `/api/nutrition/goals` | Get nutrition goals |
| GET | `/api/posts` | List community posts |
| POST | `/api/posts` | Create new post |
| GET | `/api/donors` | List blood donors |
| POST | `/api/donors` | Register as donor |
| GET | `/api/blood-requests` | List blood requests |
| POST | `/api/blood-requests` | Send blood request |
| GET | `/api/doctors` | List available doctors |
| GET | `/api/notifications` | List notifications |
| PATCH | `/api/notifications/:id` | Mark notification read |
| GET | `/api/dashboard/summary` | Dashboard consolidated data |
| GET | `/api/user/meta` | Get user metadata |
| PUT | `/api/user/meta` | Set user metadata |

### Health & Profile APIs
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/health/history/:metric` | Get health metric history |
| POST | `/api/health/history/:metric` | Add health metric entry |
| GET | `/api/journal` | List journal entries |
| POST | `/api/journal` | Create journal entry |
| PUT | `/profile` | Update profile |
| PUT | `/profile/avatar` | Upload avatar |
| GET | `/api/catalog/vaccines-list` | Vaccine catalog |
| GET | `/api/vaccine-suggestions` | Week-based suggestions |
| GET | `/api/pregnancy/week-info` | All pregnancy week data |
| GET | `/api/subscription-plans` | Pricing plans |
| GET | `/api/faqs` | FAQ entries |

### AI APIs
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/ai/chat` | AI assistant chat |
| POST | `/api/ai/insights` | Health insights generation |
| POST | `/api/ai/check-myth` | Myth verification |

### Doctor APIs
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/doctor/dashboard` | Doctor dashboard data |
| PUT | `/api/doctor/fee` | Update consultation fee |
| GET | `/api/doctor/consultations` | List consultations |
| PATCH | `/api/doctor/consultations/:id` | Update consultation |
| GET | `/api/doctor/schedule` | Get availability slots |
| PUT | `/api/doctor/schedule` | Update availability |
| GET | `/api/doctor/vaccines` | List assigned vaccine entries |
| POST | `/api/doctor/vaccines` | Add verified vaccine for patient |
| PATCH | `/api/doctor/vaccines/:id` | Approve/reject vaccine entry |

### Admin APIs
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/admin/dashboard/:type` | Admin dashboard data |
| GET | `/api/admin/users` | List all users |
| POST | `/api/admin/users/:id/suspend` | Suspend user |
| POST | `/api/admin/users/:id/unsuspend` | Unsuspend user |
| POST | `/api/admin/users/:id/role` | Change user role |
| GET | `/api/admin/security-logs` | Security audit logs |
| POST | `/api/admin/system-messages` | Broadcast message |
| GET | `/api/admin/system-settings` | Get settings |
| PUT | `/api/admin/system-settings` | Update settings |
| POST | `/api/admin/backups` | Create database backup |
| GET | `/api/admin/doctor-verifications` | Verification queue |
| PATCH | `/api/admin/doctor-verifications/:id` | Update verification |
| GET | `/api/admin/high-risk-cases` | High-risk cases |
| GET | `/api/admin/support-tickets` | Support tickets |

---

## 15. Workflow Diagrams

### Complete User Journey
```
┌──────────────────────────────────────────────────────────────────┐
│                        NURTURE GLOW                              │
│                                                                  │
│  Landing Page (/)                                                │
│       │                                                          │
│       ├── [Get Started] → /register                              │
│       │        │                                                 │
│       │        ├── Role: Mother → /dashboard (Patient workspace) │
│       │        ├── Role: Doctor → /dashboard (Doctor workspace)  │
│       │        ├── Role: Pharmacist → /dashboard (Pharm ws)      │
│       │        ├── Role: Nutritionist → /dashboard (Nutr ws)     │
│       │        └── Role: Merchandiser → /dashboard (Merch ws)    │
│       │                                                          │
│       └── [Sign In] → /login → /dashboard (role-based routing)  │
│                                                                  │
│  Admin Panel (/admin)                                            │
│       │                                                          │
│       ├── /admin/login → /admin/register (invite code)           │
│       ├── System Admin → /admin/system                           │
│       ├── Medical Admin → /admin/medical                         │
│       └── Operations Admin → /admin/operations                   │
└──────────────────────────────────────────────────────────────────┘
```

### Patient Feature Navigation
```
┌─ Patient Dashboard ──────────────────────────────────────────────┐
│                                                                  │
│  CORE                           HEALTH                           │
│  ├── Dashboard (/)              ├── Appointments (/appointments) │
│  ├── AI Assistant (/assistant)  ├── Vaccines (/vaccines)         │
│  └── Profile (/profile)        ├── Pregnancy (/pregnancy)       │
│                                 ├── Hospitals (/hospitals)       │
│  LIFESTYLE                      └── Blood Donors (/donors)      │
│  ├── Journal (/journal)                                          │
│  ├── Nutrition (/nutrition)     COMMUNITY                        │
│  └── Pharmacy (/pharmacy)       ├── Community (/community)       │
│                                 └── Translator (/translator)     │
│  SHOPPING                                                        │
│  └── Cart (/cart)               FUN                              │
│                                 └── Myth Buster (/myths)        │
└──────────────────────────────────────────────────────────────────┘
```

### Data Flow Architecture
```
┌──────────┐     REST API      ┌──────────┐       SQL        ┌─────────┐
│ Frontend │ ◄───────────────► │ Backend  │ ◄──────────────► │ MySQL   │
│ (React)  │   POST/GET/PATCH  │ (Express)│   mysql2 pool    │ Database│
├──────────┤                   ├──────────┤                  ├─────────┤
│Services: │                   │Middleware│                  │50+ tables│
│ db.ts    │                   │ • auth   │                  │app_entities│
│ api.ts   │                   │ • sanitize│                 │users     │
│ aiService│                   │ • rateLimit│                │doctors   │
│ dashboard│                   │                             │vaccines  │
│ adminApi │                   │Routes:   │                  │posts     │
│ ttsServi │                   │ • auth   │                  │catalog   │
│          │   WebSocket       │ • app    │                  │etc.     │
│ realtime │ ◄───────────────► │ • admin  │                  │         │
│ Service  │   /ws/signaling   │ • health │                  │         │
│          │                   │ • profile│                  │         │
└──────────┘                   └──────────┘                  └─────────┘
                                    │
                                    │ External Services
                                    ├── Google Gemini (AI)
                                    ├── Google Calendar API
                                    ├── Nodemailer (SMTP)
                                    └── Overpass API (Hospitals)
```

---

## Feature Summary Matrix

| # | Feature | Category | Status | Key Files |
|---|---|---|---|---|
| 1 | User Registration (5 roles) | Auth | ✅ Complete | Register.tsx, auth.js |
| 2 | Login with Rate Limiting | Auth | ✅ Complete | Login.tsx, auth.js |
| 3 | Password Reset Flow | Auth | ✅ Complete | ResetPassword.tsx, emailService.js |
| 4 | JWT Authentication | Auth | ✅ Complete | AuthContext.tsx, middleware/auth.js |
| 5 | Role-Based Access Control | Auth | ✅ Complete | Layout.tsx, ProtectedRoute |
| 6 | Account Suspension & Appeals | Auth | ✅ Complete | Login.tsx, adminRoutes.js |
| 7 | Patient Dashboard | Patient | ✅ Complete | Dashboard.tsx |
| 8 | AI Health Insights | Patient | ✅ Complete | Dashboard.tsx, aiService.js |
| 9 | Pregnancy Week Tracker | Patient | ✅ Complete | Pregnancy.tsx, Dashboard.tsx |
| 10 | Hydration Tracker | Patient | ✅ Complete | Dashboard.tsx, Nutrition.tsx |
| 11 | AI Chat Assistant | Patient | ✅ Complete | Assistant.tsx, aiService.ts |
| 12 | Text-to-Speech | Patient | ✅ Complete | ttsService.ts, Assistant.tsx |
| 13 | Live AI Assistant | Patient | ✅ Complete | LiveAssistant.tsx |
| 14 | Doctor Browsing & Booking | Patient | ✅ Complete | Appointments.tsx |
| 15 | Video Consultations (WebRTC) | Patient | ✅ Complete | AppointmentVideo.tsx, signaling.js |
| 16 | Google Calendar Integration | Patient | ✅ Complete | googleCalendar.js |
| 17 | Doctor Reviews & Ratings | Patient | ✅ Complete | Appointments.tsx |
| 18 | Vaccine Tracking | Patient | ✅ Complete | VaccineTracker.tsx |
| 19 | Vaccine Catalog (DB) | Patient | ✅ Complete | VaccineTracker.tsx, appRoutes.js |
| 20 | Smart Vaccine Suggestions | Patient | ✅ Complete | VaccineTracker.tsx |
| 21 | Pregnancy Week-by-Week Info | Patient | ✅ Complete | Pregnancy.tsx |
| 22 | Nutrition & Meal Logging | Patient | ✅ Complete | Nutrition.tsx |
| 23 | Nutrition Goals (DB) | Patient | ✅ Complete | Nutrition.tsx, appRoutes.js |
| 24 | Health Metrics (HR, Weight, Sleep, Hydration) | Patient | ✅ Complete | Health.tsx |
| 25 | Personal Journal | Patient | ✅ Complete | Journal.tsx |
| 26 | Journal File Attachments | Patient | ✅ Complete | Journal.tsx |
| 27 | Community Forum | Patient | ✅ Complete | Community.tsx |
| 28 | Post Likes & Comments | Patient | ✅ Complete | Community.tsx |
| 29 | Hospital Finder (Live Map) | Patient | ✅ Complete | HospitalFinder.tsx, Leaflet |
| 30 | Geolocation Integration | Patient | ✅ Complete | useGeolocation.ts |
| 31 | Blood Donor Registry | Patient | ✅ Complete | BloodDonors.tsx |
| 32 | Urgent Blood Requests | Patient | ✅ Complete | BloodDonors.tsx |
| 33 | Pharmacy Store | Patient | ✅ Complete | Pharmacy.tsx |
| 34 | Shopping Cart | Patient | ✅ Complete | Cart.tsx, CartContext.tsx |
| 35 | Product Favourites | Patient | ✅ Complete | Pharmacy.tsx |
| 36 | Subscription Modal | Patient | ✅ Complete | SubscriptionModal.tsx |
| 37 | AI Health Translator (EN↔BN) | Patient | ✅ Complete | Translator.tsx |
| 38 | Text-to-Speech for Translations | Patient | ✅ Complete | Translator.tsx |
| 39 | AI Myth Buster | Patient | ✅ Complete | Myths.tsx |
| 40 | Health Identity Hub | Patient | ✅ Complete | ProfilePage.tsx |
| 41 | Health ID QR Code | Patient | ✅ Complete | ShareHealthIdModal.tsx |
| 42 | Document Verification | Patient | ✅ Complete | ProfilePage.tsx |
| 43 | Emergency Contact Management | Patient | ✅ Complete | ProfilePage.tsx |
| 44 | Connected Devices | Patient | ✅ Complete | ProfilePage.tsx |
| 45 | Visit History Logging | Patient | ✅ Complete | ProfilePage.tsx |
| 46 | Notification System | Patient | ✅ Complete | NotificationBell.tsx |
| 47 | Doctor Dashboard (11 tabs) | Doctor | ✅ Complete | DoctorDashboard.tsx |
| 48 | Consultation Management | Doctor | ✅ Complete | ConsultationList.tsx |
| 49 | Schedule/Availability Management | Doctor | ✅ Complete | ScheduleManager.tsx |
| 50 | Fee Management | Doctor | ✅ Complete | DoctorDashboard.tsx |
| 51 | Telemedicine Hub | Doctor | ✅ Complete | TelemedicineHub.tsx |
| 52 | Pharmacist Dashboard (5 tabs) | Pharmacist | ✅ Complete | PharmacistDashboard.tsx |
| 53 | Order Processing | Pharmacist | ✅ Complete | PharmacistDashboard.tsx |
| 54 | Pharmacy Verification | Pharmacist | ✅ Complete | PharmacistDashboard.tsx |
| 55 | Nutritionist Dashboard (5 tabs) | Nutritionist | ✅ Complete | NutritionistDashboard.tsx |
| 56 | Nutrition Plan Creation | Nutritionist | ✅ Complete | NutritionistDashboard.tsx |
| 57 | Patient Diet Monitoring | Nutritionist | ✅ Complete | NutritionistDashboard.tsx |
| 58 | Merchandiser Dashboard (5 tabs) | Merchandiser | ✅ Complete | MerchandiserDashboard.tsx |
| 59 | Product CRUD | Merchandiser | ✅ Complete | MerchandiserDashboard.tsx |
| 60 | Inventory Management | Merchandiser | ✅ Complete | MerchandiserDashboard.tsx |
| 61 | System Admin Dashboard | Admin | ✅ Complete | SystemAdminDashboard.tsx |
| 62 | User Management | Admin | ✅ Complete | UserManagement.tsx |
| 63 | System Monitoring | Admin | ✅ Complete | SystemMonitoring.tsx |
| 64 | Database Backup | Admin | ✅ Complete | DatabaseBackup.tsx |
| 65 | Admin System Messages | Admin | ✅ Complete | SystemAdminDashboard.tsx |
| 66 | Security Audit Logs | Admin | ✅ Complete | SecuritySettings.tsx |
| 67 | Suspension Appeals Management | Admin | ✅ Complete | SuspensionAppeals.tsx |
| 68 | Medical Admin Dashboard | Admin | ✅ Complete | MedicalAdminDashboard.tsx |
| 69 | Doctor Verification Workflow | Admin | ✅ Complete | MedicalDoctorVerifications.tsx |
| 70 | High-Risk Case Monitoring | Admin | ✅ Complete | MedicalHighRiskCases.tsx |
| 71 | Consultation Reviews | Admin | ✅ Complete | MedicalConsultationReviews.tsx |
| 72 | Emergency Access Logs | Admin | ✅ Complete | MedicalEmergencyAccessLogs.tsx |
| 73 | Operations Admin Dashboard | Admin | ✅ Complete | OperationsAdminDashboard.tsx |
| 74 | Hospital Management | Admin | ✅ Complete | OperationsHospitals.tsx |
| 75 | Card Batch Management | Admin | ✅ Complete | OperationsCardBatches.tsx |
| 76 | CSR Programs | Admin | ✅ Complete | OperationsCSRPrograms.tsx |
| 77 | Support Tickets | Admin | ✅ Complete | OperationsSupportTickets.tsx |
| 78 | Health ID Verifications | Admin | ✅ Complete | HealthIdVerifications.tsx |
| 79 | Landing Page | Public | ✅ Complete | Landing.tsx |
| 80 | Pricing & Plans (DB-driven) | Public | ✅ Complete | Products.tsx |
| 81 | Internationalization (EN/BN) | Cross-cut | ✅ Complete | i18n/ |
| 82 | Voice Command Navigation | Cross-cut | ✅ Complete | useVoiceCommands.ts |
| 83 | Real-time WebSocket Updates | Cross-cut | ✅ Complete | realtimeUpdateService.ts |
| 84 | Global Search | Cross-cut | ✅ Complete | GlobalSearch.tsx |
| 85 | Code Splitting (Lazy Loading) | Cross-cut | ✅ Complete | Layout.tsx |
| 86 | Responsive Design (Mobile + Desktop) | Cross-cut | ✅ Complete | MobileBottomBar.tsx |
| 87 | Error Boundary | Cross-cut | ✅ Complete | ErrorBoundary.tsx |
| 88 | Input Sanitization (XSS Prevention) | Security | ✅ Complete | middleware/sanitize.js |
| 89 | Rate Limiting (API + Auth) | Security | ✅ Complete | index.js |
| 90 | Email Notifications | Backend | ✅ Complete | emailService.js |
| 91 | File Upload (Avatar + Documents) | Backend | ✅ Complete | uploads.js |
| 92 | Docker Deployment | DevOps | ✅ Complete | docker-compose.yml |

---

> **Total Features: 92** — covering patient care, professional dashboards, admin management, security, AI integration, real-time communication, and internationalization.

---

*This documentation was generated by analyzing every file in the Nurture Glow codebase. For setup instructions, see the project README. For database schema details, see `backend/DATABASE_SCHEMA_DOCUMENTATION.md`.*
