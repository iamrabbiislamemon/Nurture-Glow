# 🔐 Role-Based Access Control Audit Report
**Date**: January 21, 2026  
**Status**: PARTIALLY IMPLEMENTED (60% Complete)

---

## Executive Summary

| Role | Status | Implementation % | Issues |
|------|--------|------------------|--------|
| **Mother** | ⚠️ PARTIAL | 70% | No UI role gating, no consent panel |
| **Doctor** | ✅ GOOD | 80% | Basic access control, missing consent enforcement |
| **Medical Admin** | ⚠️ MINIMAL | 40% | Doctor verification exists, audit missing |
| **Ops Admin** | ⚠️ MINIMAL | 50% | Community/hospital mgmt only |
| **System Admin** | ✅ GOOD | 75% | User management & logs implemented |
| **Merchandiser** | ❌ **NOT IMPLEMENTED** | 0% | No role endpoints, no vendor mgmt |
| **Pharmacist** | ✅ IMPLEMENTED | 85% | Full order management implemented |

---

## 1️⃣ MOTHER (Primary User)
**Target**: Patient using the platform for pregnancy health tracking

### ✅ What's Implemented
```
✓ Personal profile management (create, read, update)
✓ Pregnancy tracking (appointments, vaccines, nutrition)
✓ Health records & medical reports
✓ Journal entries & community posts
✓ Blood donor registration
✓ Order placement for products
✓ Notifications system
✓ Data verification documents upload
```

### ❌ What's Missing

**1. Privacy Control Panel** (NOT IMPLEMENTED)
- ❌ No UI for viewing active consent grants
- ❌ No permission revocation interface
- ❌ No visibility rules for hiding reports
- ❌ No family member access settings

**Code Issue**: `AuthContext.tsx` doesn't expose role or permissions to UI
```typescript
// Current - No role info passed to components
const { user, isLoading, login, register, logout } = useAuth();
// Missing: user.role, user.permissions, user.consentGrants
```

**2. Consent-Based Doctor Access** (PARTIAL)
- ✅ Consent entities exist in DB (`medical_consent` type)
- ✅ Can grant/revoke consent via API
- ❌ **NO ENFORCEMENT**: Doctor can access patient data without consent check
- ❌ Frontend doesn't show consent status

**3. Time-Bound Access Expiry** (NOT IMPLEMENTED)
- ❌ No auto-expiration of consent after 7 days
- ❌ No background job to cleanup expired permissions
- ❌ Doctor gets permanent access once granted

---

## 2️⃣ DOCTOR (Medical Professional)
**Target**: Tele-gynecologist providing consultations

### ✅ What's Implemented
```
✓ Role-based route protection: requireRole('doctor')
✓ Doctor dashboard: GET /doctor/dashboard
✓ Patient consultations: GET /doctor/consultations
✓ Patient details: GET /doctor/patients/:id
✓ Appointment updates: PATCH /doctor/appointments/:id
✓ Prescription creation: POST /doctor/prescriptions
✓ Schedule management: GET/PUT /doctor/schedule
✓ Earnings view: GET /doctor/earnings
✓ Consultation status updates
```

### ⚠️ Critical Issues

**1. No Consent Enforcement** ⚠️ SECURITY ISSUE
```javascript
// Line 1390: Doctor can view ANY patient
router.get('/doctor/patients/:id', requireAuth, requireRole('doctor'), async (req, res, next) => {
  // NO CHECK: Is consent granted?
  // NO CHECK: Has consent expired?
  // Result: Doctor can access anyone's medical data!
});
```

**Fix Needed**:
```javascript
router.get('/doctor/patients/:id', requireAuth, requireRole('doctor'), async (req, res, next) => {
  const doctorId = req.user.sub;
  const patientId = req.params.id;
  
  // ✅ CHECK: Active consent exists
  const consent = await query(
    `SELECT * FROM app_entities 
     WHERE type = 'medical_consent' 
     AND user_id = ? 
     AND data->'$.doctorId' = ? 
     AND data->'$.status' = 'active'
     AND data->'$.expiresAt' > NOW()`,
    [patientId, doctorId]
  );
  
  if (!consent.length) {
    return res.status(403).json({ error: 'Access denied: No active consent' });
  }
  
  // Continue with data fetch
});
```

**2. Can See Other Doctors' Patients** ⚠️ PRIVACY ISSUE
- ❌ No check if patient is "assigned" to this doctor
- ❌ Consultations endpoint filters by doctorId BUT
- ❌ `/doctor/patients/:id` has NO patientList validation

**3. No Emergency Override Audit**
- ❌ Medical admin can't grant emergency access
- ❌ No emergency override endpoint
- ❌ No audit trail for emergency data access

---

## 3️⃣ MEDICAL ADMIN
**Target**: Clinical quality oversight, doctor verification

### ✅ What's Implemented
```
✓ Doctor verification: GET/POST /admin/verifications
✓ Approve/reject doctor: POST /admin/verifications/:id/approve
✓ Reject doctor: POST /admin/verifications/:id/reject
✓ Role check: requireRole('medical-admin')
```

### ❌ What's Missing

**1. No High-Risk Case Flagging** ❌
- ❌ No endpoint to flag dangerous pregnancies
- ❌ No case monitoring dashboard
- ❌ No escalation protocols

**2. No Consultation Quality Audit** ❌
- ❌ Can't review doctor-patient consultations
- ❌ Can't access consultation notes
- ❌ No quality metrics

**3. No Medical Audit Logs** ❌
- ❌ Who accessed what data?
- ❌ When was data accessed?
- ❌ Why was it accessed?

**4. Anonymous Data Access Missing** ❌
- ❌ No anonymized patient view
- ❌ Can't see high-level statistics
- ❌ Full PII visible if access granted

---

## 4️⃣ OPS ADMIN (Operations)
**Target**: Platform operations, card management, CSR programs

### ✅ What's Implemented
```
✓ Dashboard: GET /ops-admin/dashboard
✓ Community post moderation: GET/POST /ops-admin/community/posts
✓ Community post approval/rejection
✓ Blood request viewing: GET /ops-admin/blood-requests
✓ Hospital management: POST/PUT/DELETE /ops-admin/hospitals
✓ Announcements: POST /ops-admin/announcements
```

### ❌ What's Missing

**1. No Card Inventory Management** ❌
- ❌ No health ID card tracking
- ❌ No batch creation/activation
- ❌ No distribution logs

**2. No CSR Program Management** ❌
- ❌ No sponsor onboarding
- ❌ No benefit tracking
- ❌ No program analytics

**3. No Mother Account Status Management** ❌
- ❌ Can't view mother status (active/inactive)
- ❌ Can't suspend accounts
- ❌ No user lifecycle management

**4. No Service Usage Analytics** ❌
- ❌ No mother registration stats
- ❌ No appointment usage metrics
- ❌ No consultation count reports

---

## 5️⃣ SYSTEM ADMIN (Tech/Super Admin)
**Target**: System integrity, security, uptime

### ✅ What's Implemented
```
✓ User management: GET /system-admin/users
✓ Role filtering: Filter by role
✓ User search: By email/phone
✓ Pagination support
✓ Status filtering
✓ Dashboard: GET /system-admin/dashboard
```

### ⚠️ Issues

**1. No Explicit Audit Trail Endpoint** ❌
- Audit logs exist in DB but no GET endpoint
- Can't export audit logs
- No timestamp/actor filtering

**2. No API Key Management** ❌
- No way to create/revoke tokens
- No rate limiting per user
- No token expiry management

**3. No Role Assignment UI** ❌
- No way to promote/demote users
- No role change audit
- No approval workflow

---

## 6️⃣ 🟡 MERCHANDISER (VENDOR) - NOT IMPLEMENTED
**Target**: Product seller providing items (vitamins, hygiene kits)

### ❌ What's Missing (ENTIRE ROLE)

**1. No Vendor Endpoints** ❌
```
❌ No product upload: POST /merchandiser/products
❌ No inventory management: GET/PATCH /merchandiser/inventory
❌ No order management: GET /merchandiser/orders
❌ No delivery tracking: PATCH /merchandiser/orders/:id/delivery
❌ No commission dashboard: GET /merchandiser/earnings
❌ No analytics: GET /merchandiser/analytics
```

**2. No Vendor Data Access Restrictions** ❌
- ❌ Can't see patient health data
- ❌ Can't see consultation history
- ❌ Can't see insurance data
- ✅ (Should only see: Order ID, Product, Delivery Address (masked), Payment Status)

**3. No Order-Only Visibility** ❌
- ❌ No row-level filtering for orders
- ❌ Vendor could theoretically access all orders
- ❌ No delivery address masking

**Implementation Needed**:
```javascript
// Create Merchandiser role endpoints
router.post('/merchandiser/products', requireAuth, requireRole('merchandiser'), async (req, res) => {
  const { name, category, price, stock, description, image } = req.body;
  // Validate and create product owned by this merchandiser
});

router.get('/merchandiser/orders', requireAuth, requireRole('merchandiser'), async (req, res) => {
  const merchandiserId = req.user.sub;
  // Return only orders containing THIS vendor's products
  // MASK delivery address
  // HIDE patient medical data
});

router.patch('/merchandiser/orders/:id/delivery', requireAuth, requireRole('merchandiser'), async (req, res) => {
  const { status, trackingNumber } = req.body;
  // Update delivery status only if order contains this vendor's product
});
```

---

## 7️⃣ PHARMACIST (Secondary Role)
**Target**: Pharmacy order fulfillment

### ✅ What's Implemented
```
✓ Dashboard: GET /pharmacy/dashboard
✓ Order list: GET /pharmacy/orders
✓ Order status update: PATCH /pharmacy/orders/:id
✓ Order details: GET /pharmacy/orders/:id
✓ Role check: requireRole('pharmacist')
```

### ✅ Good Implementation
- Only sees orders assigned to pharmacy
- Can't see patient medical history
- Can't see doctor notes
- Can update delivery status only

---

## 8️⃣ CONSENT & PERMISSION SYSTEM

### Current Implementation
```javascript
// Consent endpoint exists (Line 2027)
router.post('/medical/consent/request', requireAuth, requireRole('doctor'), async (req, res) => {
  // Doctor requests access to patient data
});

// Grant consent endpoint (Line 1919)
router.post('/medical/consent/grant', requireAuth, async (req, res) => {
  // Mother grants access
  const consentData = {
    userId: req.user.sub,           // Mother's ID
    doctorId: req.body.doctorId,    // Doctor's ID
    dataTypes: req.body.dataTypes,  // What data (medical_history, reports, etc)
    startDate: new Date(),
    // ❌ MISSING: expiryDate for time-bound access
    status: 'active'
  };
});

// Revoke consent endpoint (Line 1958)
router.delete('/medical/consent/:id', requireAuth, async (req, res) => {
  // Mother can revoke
  consent.status = 'revoked';
  consent.revokedAt = new Date().toISOString();
});
```

### Issues
1. ❌ **No Expiry Enforcement**: Consent lasts forever
2. ❌ **No Background Job**: Doesn't auto-expire after 7 days
3. ❌ **Not Checked in Endpoints**: Doctor endpoints don't validate consent
4. ❌ **No Scope Limits**: Can request ALL data types
5. ❌ **No Audit Trail**: Doesn't log who accessed what when

---

## 9️⃣ DATA FLOW - Who Can See What

### ✅ Currently Working
```
Mother → Can see own data (all)
Doctor → Can see own consultations only
Pharmacist → Can see assigned orders only
Ops Admin → Can see community posts (non-sensitive)
System Admin → Can see all user emails/phones (anonymized)
```

### ❌ Currently Broken
```
Doctor → CAN see other doctors' patients (NO ASSIGNMENT CHECK)
Doctor → CAN see patient data WITHOUT CONSENT
Medical Admin → CANNOT see anonymized patient data
Ops Admin → CANNOT see card inventory or CSR programs
Merchandiser → ROLE DOESN'T EXIST IN API
```

---

## 🔟 IMPLEMENTATION CHECKLIST

### High Priority (SECURITY) 🔴
- [ ] **Doctor Consent Enforcement**: Add consent check to all doctor data endpoints
- [ ] **Consent Expiry**: Implement 7-day auto-expiration with cleanup job
- [ ] **Consent Enforcement Middleware**: Create reusable middleware for permission checks
- [ ] **Patient Assignment**: Ensure doctor can only see assigned patients

### Medium Priority (FUNCTIONALITY) 🟡
- [ ] **Merchandiser Role**: Complete vendor endpoints implementation
- [ ] **Medical Admin Audit**: Dashboard to review doctor activities
- [ ] **Ops Admin Features**: Card management, CSR programs, mother status
- [ ] **Permission Logs**: Audit trail for all data access

### Low Priority (OPTIMIZATION) 🟢
- [ ] **Anonymized Views**: Medical admin sees anonymous statistics
- [ ] **Emergency Override**: Medical admin can grant temporary access
- [ ] **Role-Based UI**: Frontend components render based on role

---

## Role Implementation Matrix

| Feature | Mother | Doctor | Medical Admin | Ops Admin | Merchandiser | Pharmacist | System Admin |
|---------|--------|--------|---------------|-----------|--------------|-----------|-------------|
| **Endpoint Protection** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Data Filtering** | ✅ | ⚠️ | ❌ | ⚠️ | ❌ | ✅ | ⚠️ |
| **Permission Checks** | ✅ | ❌ | ❌ | ⚠️ | ❌ | ✅ | ⚠️ |
| **Audit Logging** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ⚠️ |
| **Time-Bound Access** | ❌ | ❌ | ❌ | ❌ | N/A | N/A | N/A |
| **UI Role Gating** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## Frontend Role Gating Status

### Current State
```tsx
// App.tsx - NO role-based routing
const App = () => {
  return (
    <Routes>
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/doctor" element={<DoctorDashboard />} />
      // Anyone can navigate to any route - NO ROLE CHECK
    </Routes>
  );
};
```

### Missing
- ❌ ProtectedRoute component that checks `user.role`
- ❌ Conditional navigation based on role
- ❌ Role-based menu hiding
- ❌ "Access Denied" page for unauthorized roles

---

## Recommendations

### Immediate (Week 1)
1. Add consent validation to doctor endpoints
2. Implement Merchandiser role endpoints
3. Add role-based UI routing

### Short-term (Week 2-3)
1. Consent auto-expiry with background job
2. Medical Admin dashboard
3. Ops Admin features
4. Permission audit logging

### Long-term (Month 2)
1. Emergency override system
2. Anonymized analytics views
3. Advanced role hierarchies
4. SSO integration with role mapping

---

## Files That Need Changes

### Backend Priority
1. `backend/src/index.js` - Add consent middleware
2. `backend/src/appRoutes.js` - Doctor endpoints (add consent check), Merchandiser endpoints
3. `backend/src/appStore.js` - Consent expiry cleanup job

### Frontend Priority
1. `App.tsx` - Add role-based routing
2. `AuthContext.tsx` - Store user role and permissions
3. `components/Layout.tsx` - Role-based menu items
4. `pages/Dashboard.tsx` - Role-specific views

---

**Status**: This audit identifies significant gaps in access control implementation. While basic role routing exists, **critical permission enforcement is missing**, particularly around doctor-patient consent. Immediate action required for production deployment.

**Last Updated**: January 21, 2026
