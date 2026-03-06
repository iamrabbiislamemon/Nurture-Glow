# 📊 Dummy/Mock Data Inventory - Complete Project Analysis

**Date**: January 21, 2026  
**Scope**: Full codebase audit  
**Status**: DOCUMENTED

---

## 📍 Executive Summary

| Category | Count | Status | Risk |
|----------|-------|--------|------|
| **Seed Data Files** | 2 files | ✅ Proper seeding | LOW |
| **Mock API Data** | 8 endpoints | ⚠️ Hard-coded responses | MEDIUM |
| **Placeholder Images** | ~15+ uses | ✅ Fallback only | LOW |
| **Test Credentials** | 3 accounts | ✅ For development | LOW |
| **Fake User Data** | Multiple | ✅ In mock responses | MEDIUM |

---

## 1️⃣ SEED DATA (Persistent Database)

### Location
- **File 1**: `backend/src/seed.js` (Main seeding logic)
- **File 2**: `backend/seed-cli.js` (CLI entry point)
- **Trigger**: `npm run seed` or POST `/seed`

### What Gets Seeded

#### A. Hospital Data (3 Real Bangladeshi Hospitals)
```javascript
const hospitals = [
  { 
    name: 'Dhaka Medical College', 
    address: 'Ramna, Dhaka', 
    hotline: '+8802-9669340',
    lat: 23.7258, lng: 90.3976 
  },
  { 
    name: 'Square Hospital', 
    address: 'Panthapath, Dhaka', 
    hotline: '+8802-8144400',
    lat: 23.7507, lng: 90.3879 
  },
  { 
    name: 'Evercare Hospital', 
    address: 'Bashundhara, Dhaka', 
    hotline: '+8802-8401661',
    lat: 23.8124, lng: 90.4326 
  }
];
```

**Status**: ✅ Production-ready (Real hospital data)

#### B. Doctor Data (3 Dummy Doctors)
```javascript
const doctors = [
  { 
    full_name: 'Dr. Arifa Begum',      // DUMMY
    specialty: 'Gynecologist', 
    phone: '+8801711223344',            // FAKE
    email: 'arifa@example.com',         // FAKE
    fee_amount: 1000 
  },
  { 
    full_name: 'Dr. Mahbub Rahman',     // DUMMY
    specialty: 'Pediatrician', 
    phone: '+8801811223344',            // FAKE
    email: 'mahbub@example.com',        // FAKE
    fee_amount: 1200 
  },
  { 
    full_name: 'Dr. Nusrat Jahan',      // DUMMY
    specialty: 'Nutritionist', 
    phone: '+8801911223344',            // FAKE
    email: 'nusrat@example.com',        // FAKE
    fee_amount: 800 
  }
];
```

**Status**: ⚠️ Test data - Need real doctors before production

#### C. Product Data (3 Dummy Products)
```javascript
const products = [
  { 
    name: 'Prenatal Vitamins',          // Real product name
    category: 'Mother Care', 
    price: 450,                         // DUMMY PRICE
    stock_qty: 50                       // DUMMY STOCK
  },
  { 
    name: 'Folic Acid', 
    category: 'Mother Care', 
    price: 120,                         // DUMMY PRICE
    stock_qty: 100 
  },
  { 
    name: 'Baby Lotion', 
    category: 'Baby Care', 
    price: 320,                         // DUMMY PRICE
    stock_qty: 80 
  }
];
```

**Status**: ✅ Placeholder - Fine for development

#### D. Vendor Data (1 Default Vendor)
```javascript
{
  name: 'Nurture Glow Official',        // DUMMY
  phone: '+8801700000000',              // FAKE
  verified: true
}
```

**Status**: ⚠️ Placeholder vendor

#### E. Roles & Categories (System Data)
```javascript
// Roles
INSERT INTO roles: 'USER', 'DOCTOR', 'ADMIN'

// Doctor Specialties
'Gynecologist', 'Pediatrician', 'Nutritionist', 'Psychologist'

// Product Categories
'Mother Care', 'Baby Care', 'Nutrition', 'Medical Devices'
```

**Status**: ✅ These are correct system constants

### How to Use Seeding
```bash
# Method 1: CLI
npm run seed

# Method 2: REST API
curl -X POST http://localhost:4000/api/seed

# Result
✓ 3 hospitals created
✓ 3 dummy doctors created
✓ 1 vendor created
✓ 3 sample products created
✓ Roles and categories set up
```

---

## 2️⃣ MOCK API RESPONSES (Hard-Coded Fake Data)

### Location
`backend/src/appRoutes.js`

### What's Being Mocked

#### ⚠️ ISSUE 1: Patient Details (Line 1395-1412)
```javascript
// GET /doctor/patients/:id
// PROBLEM: Always returns same fake patient
const patient = {
  name: 'Fatima Rahman',                        // SAME EVERY TIME
  age: 28,                                      // FAKE
  email: 'fatima@example.com',                  // FAKE
  healthId: 'NG-12345678',                      // FAKE
  currentPregnancy: {
    gestationalWeek: 24,                        // FAKE
    expectedDueDate: new Date(...).toISOString()
  },
  medicalHistory: [
    { condition: 'Anemia', diagnosedAt: '2023-01-15' }
  ],
  consultationHistory: 5,                       // FAKE
  lastConsultation: new Date(...).toISOString() // FAKE
};
```

**Impact**: 🔴 CRITICAL
- Every doctor sees same patient "Fatima Rahman"
- Patient ID in URL is IGNORED
- Data not from database

**Risk**: HIGH - Hides real patient data access issues

---

#### ⚠️ ISSUE 2: Doctor Schedule (Line 1542-1591)
```javascript
// GET /doctor/schedule
// PROBLEM: Hard-coded weekly schedule
const schedule = [
  {
    dayOfWeek: 'monday',
    available: true,
    startTime: '09:00',
    endTime: '17:00',
    maxConsultations: 12
  },
  // ... repeated for all days
];
```

**Impact**: 🟡 MEDIUM
- Same schedule for every doctor
- Not saved in database
- GET always returns same data

**Risk**: MEDIUM - Doctor can't customize schedule

---

#### ⚠️ ISSUE 3: Doctor Earnings (Line 1641-1655)
```javascript
// GET /doctor/earnings
// PROBLEM: Always returns same fake earnings
const earnings = {
  total: 45000,                      // FAKE
  thisMonth: 12000,                  // FAKE
  lastMonth: 10500,                  // FAKE
  consultationsThisMonth: 48,        // FAKE
  consultationsLastMonth: 42,        // FAKE
  pendingAmount: 2500,               // FAKE
  recentTransactions: [
    // ... fake transactions
  ]
};
```

**Impact**: 🟡 MEDIUM
- Same earnings for all doctors
- Not calculated from real consultations
- Will confuse doctors

**Risk**: HIGH - Financial data not trustworthy

---

#### 📊 Full List of Mock Endpoints

| Endpoint | Location | Status | Data Source | Impact |
|----------|----------|--------|-------------|--------|
| `GET /doctor/patients/:id` | Line 1390 | ⚠️ Mock | Hard-coded "Fatima Rahman" | CRITICAL |
| `GET /doctor/schedule` | Line 1542 | ⚠️ Mock | Hard-coded hours | MEDIUM |
| `GET /doctor/earnings` | Line 1641 | ⚠️ Mock | Hard-coded amounts | HIGH |
| `GET /doctor/consultations` | Line 1322 | ⚠️ Partial | Queries DB but returns mock fields | MEDIUM |
| `GET /doctor/dashboard` | Line 1253 | ⚠️ Partial | Some real, some mocked | MEDIUM |

---

## 3️⃣ PLACEHOLDER IMAGES (Safe)

### Picsum Photos Usage
Used as **fallback** when user hasn't uploaded real avatar:

```javascript
// Used ~15+ places in appRoutes.js
avatar: `https://picsum.photos/seed/${userId}/100/100`

// Examples
avatar: 'https://picsum.photos/seed/patient1/100/100'
avatar: 'https://picsum.photos/seed/doctor456/100/100'
```

**Status**: ✅ FINE
- Only fallback (not real data)
- User can upload real photo
- Standard practice

---

## 4️⃣ TEST CREDENTIALS & ACCOUNTS

### Location: Documentation & Comments

#### Test Account 1: Mother
```
Email: test@example.com
Role: mother
Purpose: Development testing
```

**Status**: ✅ For development only

#### Test Account 2: Medical Admin
```
Email: medical_admin@example.com
Role: medical-admin
Purpose: Dashboard testing
```

**Status**: ✅ For development only

#### Test Account 3: Doctor
```
Email: arifa@example.com (from seed data)
Role: doctor
Purpose: Doctor endpoint testing
```

**Status**: ⚠️ Shares seed doctor data

---

## 5️⃣ IMPACT ANALYSIS

### What's Production-Ready ✅
- Hospital database seeding
- Role & category system setup
- Default vendor creation
- Placeholder images (fallback)
- Test credentials (documented)

### What Needs Fixing ⚠️
- Mock patient details (always same person)
- Mock doctor schedule (not saved)
- Mock earnings (not calculated)
- Mock consultation data (partial mock)
- Mock dashboard stats (not from DB)

### Before Production, Must:
1. ❌ Remove mock patient data endpoint
2. ❌ Make doctor schedule database-backed
3. ❌ Calculate earnings from real consultation data
4. ❌ Fetch consultations from database
5. ❌ Replace dummy doctors with real ones
6. ❌ Replace dummy products with real catalog

---

## 🔧 How to Replace Mock Data

### Example: Fix Patient Details Endpoint

**Current (MOCK)**:
```javascript
router.get('/doctor/patients/:id', requireAuth, requireRole('doctor'), async (req, res) => {
  const patient = {
    name: 'Fatima Rahman',  // ❌ HARD-CODED
    age: 28,
    // ...
  };
  res.json({ patient });
});
```

**Should Be (REAL)**:
```javascript
router.get('/doctor/patients/:id', requireAuth, requireRole('doctor'), async (req, res) => {
  const patientId = req.params.id;
  
  // Query real database
  const patientRows = await query(
    `SELECT u.id, p.full_name as name, p.date_of_birth, p.phone
     FROM users u
     LEFT JOIN user_profiles p ON p.user_id = u.id
     WHERE u.id = ?`,
    [patientId]
  );
  
  if (!patientRows.length) {
    return res.status(404).json({ error: 'Patient not found' });
  }
  
  const patient = patientRows[0];
  res.json({ patient });
});
```

---

## 📋 Cleanup Checklist

### High Priority (Production Blockers)
- [ ] Remove mock patient data (Line 1395-1412)
- [ ] Replace with real database query
- [ ] Remove mock earnings (Line 1641-1655)
- [ ] Calculate from real consultation records
- [ ] Remove hardcoded schedule (Line 1542-1591)
- [ ] Make persistent in database

### Medium Priority (Before Beta)
- [ ] Replace dummy doctors with real system
- [ ] Replace dummy products with real catalog
- [ ] Add real phone numbers to doctors
- [ ] Update all test credentials

### Low Priority (Polish)
- [ ] Update placeholder images
- [ ] Improve error messages
- [ ] Add data validation

---

## 🧪 Testing Mock Data

### To Verify What's Real vs Mock

**Check Patient Endpoint**:
```bash
# Call with different patient IDs
curl -H "Authorization: Bearer doctor_token" \
  http://localhost:4000/api/doctor/patients/user_123

curl -H "Authorization: Bearer doctor_token" \
  http://localhost:4000/api/doctor/patients/user_456

# If both return same "Fatima Rahman" -> IT'S MOCKED ❌
# If different data -> IT'S FROM DB ✅
```

**Check Schedule**:
```bash
# Try to update schedule
curl -X PUT http://localhost:4000/api/doctor/schedule \
  -H "Authorization: Bearer doctor_token" \
  -d '{ "schedule": [...] }'

# Then GET it back
curl http://localhost:4000/api/doctor/schedule

# If your update didn't persist -> IT'S MOCKED ❌
```

**Check Earnings**:
```bash
# Should show DIFFERENT values per doctor
curl http://localhost:4000/api/doctor/earnings?doctorId=doc_123
curl http://localhost:4000/api/doctor/earnings?doctorId=doc_456

# If both same -> IT'S MOCKED ❌
```

---

## 📊 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────┐
│           DUMMY DATA SOURCES IN PROJECT                 │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  SEED DATA (Persistent Database)                        │
│  ├── seed.js                                            │
│  │   ├── 3 Hospitals ✅ REAL                            │
│  │   ├── 3 Doctors ⚠️ DUMMY                             │
│  │   ├── 1 Vendor ⚠️ DUMMY                              │
│  │   └── 3 Products ⚠️ DUMMY                            │
│  │                                                      │
│  MOCK API RESPONSES (Hard-coded)                        │
│  ├── appRoutes.js                                       │
│  │   ├── Patient details ❌ ALWAYS SAME                 │
│  │   ├── Schedule ❌ NOT SAVED                          │
│  │   ├── Earnings ❌ NOT CALCULATED                     │
│  │   └── Dashboard ⚠️ PARTIAL                           │
│  │                                                      │
│  PLACEHOLDER IMAGES                                    │
│  ├── Picsum Photos ✅ FALLBACK ONLY                     │
│  │                                                      │
│  TEST CREDENTIALS                                      │
│  └── Documentation ✅ DOCUMENTED                        │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## ⚠️ Production Readiness

### NOT READY FOR PRODUCTION ❌
- Mock patient endpoint (will fail with real data)
- Mock earnings (doctors will see wrong income)
- Hardcoded schedule (users can't customize)
- Dummy doctors (no real team)

### READY FOR PRODUCTION ✅
- Seed system (proper database init)
- Roles & categories (correct system setup)
- Hospital data (real Bangladeshi hospitals)
- Placeholder images (safe fallback)

### RECOMMENDATION
**Do NOT deploy to production until:**
1. All mock endpoints replaced with DB queries
2. Real doctor & product data loaded
3. Earnings calculated from real consultations
4. Schedule persistence implemented
5. All test credentials removed from production

**Timeline**: 
- Fix critical mocks: 1-2 days
- Load real data: 1 day
- Test end-to-end: 1 day
- Deploy: Ready

---

**Last Updated**: January 21, 2026  
**Audit Scope**: Complete project  
**Next Action**: Replace mock endpoints with real database queries
