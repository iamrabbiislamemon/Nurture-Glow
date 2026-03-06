# Admin Access Guide

## 🔐 How Admin Login Works

### Admin Portal Access

Admins use a **completely separate system** from public users.

#### 1. **Admin Registration** 
Navigate to: `http://localhost:5173/#/admin/register`

**Requirements:**
- Valid invitation code: `NURTURE_ADMIN_2026`
- Select admin role:
  - 🩺 **Medical Admin** - Healthcare oversight & doctor verification
  - ⚙️ **Operations Admin** - Cards, hospitals, CSR programs
  - 🔧 **System Admin** - User management & security monitoring
- Complete registration form

**Security Features:**
- Invitation code required (prevents unauthorized admin creation)
- Only admin roles allowed (mother, doctor, etc. blocked)
- Dark slate/amber theme (distinct from public interface)

#### 2. **Admin Login**
Navigate to: `http://localhost:5173/#/admin/login`

**Process:**
1. Enter email and password
2. System verifies credentials
3. **Role verification** - Checks if user has admin role
4. If not admin role → Login denied with error message
5. If admin role → Redirects to role-specific dashboard:
   - `medical_admin` → `/admin/medical`
   - `ops_admin` → `/admin/operations`
   - `system_admin` → `/admin/system`

**Security Features:**
- Non-admin users cannot access admin portal
- Separate authentication flow from public users
- Role-based routing to appropriate dashboard

---

## 🎯 Quick Access URLs

| Purpose | URL | Required Role |
|---------|-----|---------------|
| Admin Registration | `/#/admin/register` | Invitation code |
| Admin Login | `/#/admin/login` | Any admin role |
| Medical Admin Dashboard | `/#/admin/medical` | `medical_admin` |
| Operations Admin Dashboard | `/#/admin/operations` | `ops_admin` |
| System Admin Dashboard | `/#/admin/system` | `system_admin` |

---

## 👥 Admin Roles & Permissions

### Medical Admin (`medical_admin`)
**Dashboard:** Purple/pink gradient theme

**Allowed:**
- ✅ Doctor verification & credentials
- ✅ Prescription review
- ✅ High-risk case management
- ✅ Emergency access logs
- ✅ Clinical quality assurance

**Denied:**
- ❌ Card inventory management
- ❌ Hospital onboarding
- ❌ CSR programs
- ❌ User role management

---

### Operations Admin (`ops_admin`)
**Dashboard:** Purple/pink gradient theme

**Allowed:**
- ✅ Card batch activation & management
- ✅ Hospital onboarding & monitoring
- ✅ CSR program management
- ✅ Call center access & support tickets

**Denied:**
- ❌ Medical records access
- ❌ Prescription viewing
- ❌ Clinical notes
- ❌ Doctor verification

---

### System Admin (`system_admin`)
**Dashboard:** Red/orange gradient theme

**Allowed:**
- ✅ User management (all roles)
- ✅ Role permissions configuration
- ✅ Security monitoring & alerts
- ✅ System logs & audit trails
- ✅ Database backup & recovery
- ✅ API monitoring

**Denied:**
- ❌ Medical records (privacy protected)
- ❌ Private messages (privacy protected)
- ❌ Consultation videos (HIPAA compliance)
- ⚠️ **Only anonymized data** for system monitoring

---

## 🔒 Security Architecture

### Separation of Concerns
```
PUBLIC SYSTEM                 ADMIN SYSTEM
├── /register                 ├── /admin/register
├── /login                    ├── /admin/login
├── /dashboard                ├── /admin/medical
├── /profile                  ├── /admin/operations
└── (mother, doctor, etc.)    └── /admin/system
```

### Authentication Flow
```
User enters credentials
        ↓
Backend validates
        ↓
Check user.role
        ↓
┌───────┴───────┐
│ Is admin role?│
└───────┬───────┘
    Yes │   No
        │    └──→ Access Denied
        ↓
Route to admin dashboard
```

### Invitation Code System
- **Current:** Hardcoded `NURTURE_ADMIN_2026`
- **Production:** Should use database with:
  - Expiring codes
  - Single-use tokens
  - Audit trail
  - Role-specific codes

---

## 🚀 Testing Admin Access

### Step 1: Create Admin Account
1. Navigate to `http://localhost:5173/#/admin/register`
2. Enter invitation code: `NURTURE_ADMIN_2026`
3. Select admin role (Medical/Operations/System)
4. Fill registration form
5. Submit

### Step 2: Login
1. Navigate to `http://localhost:5173/#/admin/login`
2. Enter credentials
3. Verify redirect to appropriate dashboard

### Step 3: Test Non-Admin Block
1. Create regular user at `/register`
2. Try logging in at `/admin/login`
3. Should see error: "Access denied. Admin credentials required."

---

## 📝 Implementation Notes

### Current State
✅ AdminLogin.tsx - Complete with role verification  
✅ AdminRegister.tsx - Complete with invitation system  
✅ MedicalAdminDashboard.tsx - Complete with stats & activities  
✅ OperationsAdminDashboard.tsx - Complete with hospital management  
✅ SystemAdminDashboard.tsx - Complete with security monitoring  
✅ Routes configured in Layout.tsx  

### Pending Backend Implementation
⚠️ **Invitation code validation** - Currently frontend-only  
⚠️ **Audit logging** - Admin actions should be logged  
⚠️ **Role-based API middleware** - Backend permission checks  
⚠️ **Admin role assignment** - Database-level role management  

---

## 🎨 Visual Identity

### Admin Theme
- **Background:** Dark slate (slate-900)
- **Accents:** 
  - Medical Admin: Purple/Pink (#8B5CF6)
  - Operations Admin: Purple/Pink (#A855F7)
  - System Admin: Red/Orange (#EF4444)
- **Cards:** Slate-800 with backdrop blur
- **Text:** White/gray-400

### Public Theme
- **Background:** Beige (#F7F5EF)
- **Accents:** Gold/Teal (#E6C77A, #BFE6DA)
- **Cards:** White with soft shadows
- **Text:** Gray-800/teal-600

This visual distinction helps prevent confusion between admin and public interfaces.

---

## 🔧 Troubleshooting

### "Access denied. Admin credentials required."
**Cause:** User doesn't have admin role  
**Solution:** Account must be registered via `/admin/register` with invitation code

### "Invalid invitation code"
**Cause:** Wrong code entered  
**Solution:** Use `NURTURE_ADMIN_2026` (case-sensitive)

### Redirect loop / blank screen
**Cause:** User logged in at wrong portal  
**Solution:** 
- Public users → `/login`
- Admin users → `/admin/login`

### Can't access admin dashboard
**Cause:** Routes not configured  
**Solution:** Verify Layout.tsx includes admin routes section

---

## 📚 Related Documentation
- [ROLE_PERMISSIONS.md](Nurture-Glow/docs/ROLE_PERMISSIONS.md) - Complete role architecture
- [AdminLogin.tsx](Nurture-Glow/pages/admin/AdminLogin.tsx) - Login implementation
- [AdminRegister.tsx](Nurture-Glow/pages/admin/AdminRegister.tsx) - Registration implementation
- [Layout.tsx](components/Layout.tsx) - Routing configuration
