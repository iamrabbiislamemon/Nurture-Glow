# Nurture-Glow Database Schema - Visual Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NURTURE-GLOW DATABASE ARCHITECTURE                       │
│                              (56 Tables Total)                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  🔐 USER MANAGEMENT & AUTHENTICATION (5 tables)                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  ├── users ⭐ (Enhanced with health_id fields)                               │
│  ├── user_profiles                                                           │
│  ├── roles                                                                   │
│  ├── user_roles                                                              │
│  └── password_reset_tokens                                                   │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  🤰 MATERNAL HEALTH (4 tables)                                               │
├──────────────────────────────────────────────────────────────────────────────┤
│  ├── mothers                                                                 │
│  ├── pregnancies                                                             │
│  ├── pregnancy_checkins                                                      │
│  └── emergency_contacts                                                      │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  👶 CHILD HEALTH & VACCINATION (6 tables)                                    │
├──────────────────────────────────────────────────────────────────────────────┤
│  ├── children                                                                │
│  ├── child_growth_logs                                                       │
│  ├── vaccine_schedules                                                       │
│  ├── vaccine_schedule_items                                                  │
│  ├── vaccination_events                                                      │
│  └── certificates                                                            │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  📋 HEALTH RECORDS (3 tables)                                                │
├──────────────────────────────────────────────────────────────────────────────┤
│  ├── health_records                                                          │
│  ├── health_record_files                                                     │
│  └── allergies                                                               │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  👨‍⚕️ DOCTOR & CONSULTATION SYSTEM (7 tables)                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│  ├── doctor_specialties                                                      │
│  ├── doctors                                                                 │
│  ├── doctor_availability_slots                                               │
│  ├── consultations                                                           │
│  ├── video_sessions                                                          │
│  ├── consultation_messages                                                   │
│  └── doctor_reviews                                                          │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  🏥 HOSPITAL & EMERGENCY SERVICES (5 tables)                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│  ├── hospitals                                                               │
│  ├── icu_status_updates                                                      │
│  ├── ambulances                                                              │
│  ├── emergency_requests                                                      │
│  └── emergency_status_events                                                 │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  🧠 MENTAL HEALTH (4 tables)                                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│  ├── mental_questions                                                        │
│  ├── mental_assessments                                                      │
│  ├── mental_answers                                                          │
│  └── referrals                                                               │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  🛍️ E-COMMERCE SYSTEM (7 tables)                                             │
├──────────────────────────────────────────────────────────────────────────────┤
│  ├── vendors                                                                 │
│  ├── product_categories                                                      │
│  ├── products                                                                │
│  ├── orders                                                                  │
│  ├── order_items                                                             │
│  ├── payments                                                                │
│  └── product_reviews                                                         │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  🩸 BLOOD DONATION SYSTEM ⭐ NEW (2 tables)                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│  ├── blood_donors (Registry with verification & availability)               │
│  └── blood_requests (Urgent requests with tracking)                         │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  🆔 HEALTH ID VERIFICATION ⭐ NEW (1 table)                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│  └── health_id_verification_requests (Government ID workflow)               │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  📦 FLEXIBLE ENTITY SYSTEM ⭐ NEW (3 tables)                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│  ├── app_entities (JSON storage: appointments, posts, notifications, etc.)  │
│  ├── app_user_meta (User preferences: hydration, pregnancy week, avatar)    │
│  └── app_catalog (System catalogs: doctors, hospitals, medicines)           │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  🔔 SYSTEM & SUPPORT (7 tables)                                              │
├──────────────────────────────────────────────────────────────────────────────┤
│  ├── reminders                                                               │
│  ├── reminder_deliveries                                                     │
│  ├── notifications ⭐ (Enhanced with verification workflow)                  │
│  ├── files                                                                   │
│  ├── file_links                                                              │
│  ├── addresses                                                               │
│  └── audit_logs                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│  🏛️ RESOURCES (2 tables)                                                     │
├──────────────────────────────────────────────────────────────────────────────┤
│  ├── gov_resources                                                           │
│  └── ngos                                                                    │
└──────────────────────────────────────────────────────────────────────────────┘

═══════════════════════════════════════════════════════════════════════════════
                            KEY RELATIONSHIPS
═══════════════════════════════════════════════════════════════════════════════

users (Central Hub)
  │
  ├──> user_profiles (1:1)
  ├──> user_roles (1:N) ──> roles (N:1)
  ├──> mothers (1:1) ──> pregnancies (1:N) ──> pregnancy_checkins (1:N)
  │                  ──> children (1:N) ──> child_growth_logs (1:N)
  │                                     ──> vaccine_schedules (1:N)
  │                                     ──> vaccination_events (1:N)
  │                                     ──> certificates (1:N)
  │
  ├──> consultations (1:N) ──> doctors (N:1)
  │                        ──> video_sessions (1:1)
  │                        ──> consultation_messages (1:N)
  │
  ├──> orders (1:N) ──> order_items (1:N) ──> products (N:1)
  │                 ──> payments (1:1)
  │
  ├──> blood_donors (1:1) ──> blood_requests (1:N)
  │
  ├──> health_id_verification_requests (1:N) ──> hospitals (N:1)
  │
  ├──> app_entities (1:N) - Dynamic entities (appointments, posts, etc.)
  │
  ├──> app_user_meta (1:N) - User preferences
  │
  ├──> emergency_requests (1:N) ──> ambulances (N:1)
  │                              ──> hospitals (N:1)
  │
  ├──> notifications (1:N)
  ├──> reminders (1:N)
  ├──> addresses (1:N)
  └──> audit_logs (1:N)

═══════════════════════════════════════════════════════════════════════════════
                         PERFORMANCE FEATURES
═══════════════════════════════════════════════════════════════════════════════

✓ 60+ Indexes for fast queries
✓ Foreign key constraints for data integrity
✓ Composite indexes on frequently joined columns
✓ JSON support for flexible data storage
✓ Optimized for both OLTP and reporting queries

═══════════════════════════════════════════════════════════════════════════════
                              USAGE STATS
═══════════════════════════════════════════════════════════════════════════════

Entity Types in app_entities:
  - appointment       (Doctor appointments)
  - notification      (System notifications)
  - order            (E-commerce orders)
  - community_post   (Forum posts)
  - community_comment (Post comments)
  - donor            (Blood donors - alternative storage)
  - journal_entry    (Personal journal)
  - health_history   (Health metric tracking)
  - audit_log        (Activity logs)
  - user_suspension  (Account suspension)
  - hospital         (Hospital data - alternative)
  - doctor           (Doctor data - alternative)
  - medicine         (Medicine catalog)

Catalog Types in app_catalog:
  - doctor           (Doctor directory)
  - hospital         (Hospital directory)
  - medicine         (Medicine directory)

User Meta Keys in app_user_meta:
  - hydration        (Daily water intake)
  - pregnancyWeek    (Current pregnancy week)
  - avatar           (Profile avatar URL)

═══════════════════════════════════════════════════════════════════════════════
                          STORAGE ESTIMATE
═══════════════════════════════════════════════════════════════════════════════

Typical database size for 10,000 users:

Traditional Tables:  ~500 MB
  - users, profiles, health records, orders, etc.

app_entities:       ~200 MB
  - Appointments, notifications, posts (JSON storage)

Indexes:           ~150 MB
  - Performance optimization

Total Estimated:   ~850 MB

═══════════════════════════════════════════════════════════════════════════════
