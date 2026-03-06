# NowWorking

**As of:** 2026-02-19  
**Scope:** Active, non-legacy role model and currently wired routes/services.

## 1. Project Snapshot
Nurture Glow is a role-based maternal care platform with privacy-first access control, where mothers own their data and other actors operate under consent and role boundaries.

## 2. Motto, Mission, Vision

### 2.1 Current Implemented Motto/Tagline
- Hero copy: **"Nurturing Every Step"** (landing hero text split as `Nurturing` + `Every Step`)
- Product line: **"Premium Mother, Pregnancy & Baby Care Platform."**

### 2.2 Full-Fledged Motto (Planning-Aligned)
**Privacy-first maternal care where mothers own their data and verified caregivers collaborate through role-based dashboards to deliver safe, timely support from pregnancy to early childhood.**

### 2.3 Mission (Operational)
- Protect maternal data ownership.
- Enforce role-based, least-privilege data access.
- Deliver unified care + operations + governance workflows in one platform.

### 2.4 Vision (Target State)
- Full multi-actor ecosystem (including nutritionist role completion).
- Real-time cross-dashboard coordination.
- Fully integrated telemedicine/compliance/mobile operations.
- Zero drift between architecture docs and implementation.

## 3. Actors And Stakeholders (Non-Legacy)

### 3.1 Canonical Roles Present In Code
1. `mother`
2. `doctor`
3. `pharmacist`
4. `nutritionist`
5. `merchandiser`
6. `medical_admin`
7. `ops_admin`
8. `system_admin`

### 3.2 Implementation Status By Role

| Role | Active Dashboard Route | Backend Role Logic | Status |
|---|---|---|---|
| `mother` | Yes (`/dashboard` default + patient pages) | Yes | Implemented |
| `doctor` | Yes (`/dashboard` role workspace tabs) | Yes (`/api/doctor/*`) | Implemented |
| `pharmacist` | Yes (`/dashboard` role workspace tabs) | Yes (`/api/pharmacy/*`, verification submit) | Implemented |
| `merchandiser` | Yes (`/dashboard` role workspace tabs) | Yes (`/api/merchandiser/*`) | Implemented |
| `medical_admin` | Yes (`/admin/medical*`) | Yes (`/api/admin/medical/*`) | Implemented |
| `ops_admin` | Yes (`/admin/operations*`) | Yes (`/api/admin/operations/*`) | Implemented |
| `system_admin` | Yes (`/admin/system*`) | Yes (`/api/admin/system/*`) | Implemented |
| `nutritionist` | No dedicated route | Role exists, no dedicated workflow endpoints | Not Implemented |

### 3.3 Actor Counts
- Roles defined: **8**
- Roles with active dashboard UI: **7**
- Planned but not implemented in dashboard/API workflow: **1** (`nutritionist`)

## 4. Parallel Route Architecture

## 4.1 Frontend Parallel Trees

### A) App/User Tree
- Public: `/`, `/about`, `/features`, `/pricing`, `/contact`, `/how-it-works`, `/mobile-app`, `/help-center`, `/privacy`, `/terms`, `/cookie-policy`, `/sitemap`
- Auth: `/login`, `/register`, `/signup`, `/reset-password`
- Main workspace entry: `/dashboard`
  - `doctor` -> `DoctorDashboard`
  - `pharmacist` -> `PharmacistDashboard`
  - `merchandiser` -> `MerchandiserDashboard`
  - default -> mother dashboard
- Mother routes: `/appointments`, `/vaccines`, `/nutrition`, `/pregnancy`, `/hospitals`, `/pharmacy`, `/pharmacy/cart`, `/community`, `/journal`, `/profile`, `/health`, `/assistant`, `/donors`, `/myths`, `/translator`

### B) Admin Tree
- Public admin auth: `/admin/login`, `/admin/register`
- Protected admin shell: `/admin/*`
- Medical admin: `/admin/medical`, `/admin/medical/verifications`, `/admin/medical/high-risk`, `/admin/medical/consultations`, `/admin/medical/emergency-access`
- Ops admin: `/admin/operations`, `/admin/operations/batches`, `/admin/operations/hospitals`, `/admin/operations/csr-programs`, `/admin/operations/support-tickets`
- System admin: `/admin/system`, `/admin/system/users`, `/admin/system/security`, `/admin/system/appeals`, `/admin/system/backup`, `/admin/system/monitoring`

## 4.2 Backend Parallel Trees
- Admin APIs mounted at: `/api/admin/*`
- App/user APIs mounted at: `/api/*`
- Compatibility aliases present:
  - `/api/system-admin/*` -> maps to `/api/admin/system/*`
  - `/api/ops-admin/*` -> maps to `/api/admin/operations/*`

## 5. Data Flow Routes And Dashboard Communication

| Flow | Route(s) | Source -> Target | Status |
|---|---|---|---|
| Appointment create/update | `POST /api/appointments`, `PATCH /api/doctor/appointments/:id` | Mother <-> Doctor with notifications | Implemented |
| Consent request/grant/revoke | `POST /api/medical/consent/request`, `POST /api/medical/consent/grant`, `DELETE /api/medical/consent/:id` | Doctor <-> Mother | Implemented |
| Doctor patient access scope | `GET /api/doctor/accessible-patients`, `GET /api/doctor/patients/:id` (consent middleware) | Mother -> Doctor (controlled access) | Implemented |
| Prescription lifecycle | `POST /api/doctor/prescriptions`, `GET /api/prescriptions`, `GET /api/doctor/prescriptions` | Doctor -> Mother | Implemented |
| Doctor verification submission/review | `POST /api/doctor/submit-verification`, `GET/PATCH /api/admin/medical/doctor-verifications*` | Doctor -> Medical Admin -> Doctor | Implemented |
| Pharmacist verification submission/review | `POST /api/pharmacist/submit-verification`, `GET/POST /api/admin/operations/pharmacists/*` | Pharmacist -> Ops Admin -> Pharmacist | Backend implemented; UI route gap |
| Hospital onboarding escalation | `POST /api/admin/operations/hospitals` (+ medical admin notification) | Ops Admin -> Medical Admin | Implemented |
| High-risk escalation | `POST /api/admin/medical/high-risk-cases` | Doctor/Medical Admin -> Medical Admin workflow | Implemented |
| Emergency access logs | `GET/POST /api/admin/medical/emergency-access-logs` | Medical/Admin actors | Implemented |
| Admin global messaging | `POST /api/admin/system/messages` | System Admin -> all/role/user targets | Implemented |
| Admin-to-admin coordination | `POST/GET/PATCH /api/admin/interactions*` | Medical/Ops/System admins | Implemented |
| Role-targeted announcements | `POST /api/admin/operations/announcements`, `GET /api/announcements` | Ops/System admin -> platform roles | Implemented |

## 6. Vision vs Implementation Gap

| Domain | Vision/Planning Intent | Current Reality | Gap Level |
|---|---|---|---|
| Role completeness | All declared caregiver roles have full workflows | `nutritionist` exists in role model + registration but no dedicated dashboard/API | High |
| Telemedicine ops | Integrated live controls, recording, moderation | Doctor telemedicine module explicitly shows "Not configured" controls | High |
| Compliance automation | Digital signature, audit-ready reporting, protection telemetry | Compliance module shows not connected/unavailable placeholders | High |
| Mobile clinical ops | Configurable mobile toggles and safety automation | Mobile feature toggles marked "Not configured" | Medium |
| Patient-doctor messaging | Secure portal messaging workflow | Patient portal messaging marked "Not configured" in doctor workspace | Medium |
| Admin operations coverage | Full ops workflows surfaced in admin dashboards | Backend has pharmacist/community/announcement ops routes not exposed in current admin navigation | Medium |
| Real-time coordination | Live websocket sync across admin dashboards | Frontend websocket client exists; backend `/ws` handler not present | Medium |
| Documentation alignment | Docs reflect active route model | Several docs still describe earlier route shapes and phased "next steps" already superseded | Medium |

## 7. Current Stage Assessment
- **Core platform stage:** Functional and operational for main actors (mother, doctor, pharmacist, merchandiser, medical/ops/system admin).
- **Governance stage:** Strong backend admin capability with role checks and cross-admin workflows.
- **Maturity constraint:** Advanced features and one role (`nutritionist`) are incomplete; doc-service-route drift exists in parts of the codebase.

## 8. Implemented vs Non-Implemented (Non-Legacy Scope)

### Implemented
- Role-based dashboard routing (user + admin split).
- Consent-enforced doctor access path.
- Appointment, prescription, verification, and notification flows.
- Admin dashboards for medical/operations/system domains.

### Partially Implemented
- Doctor advanced modules: telemedicine/compliance/mobile/patient messaging have visible UI but backend integration not fully wired.
- Ops workflow visibility: backend endpoints broader than current ops admin navigation.

### Not Implemented
- Dedicated `nutritionist` dashboard/API workflow.
- Websocket backend for real-time update service expected by frontend.

## 9. Key Alignment Risks (Actionable)
1. Route/API contract drift between `dashboardService.ts` legacy methods and current backend contracts.
2. Missing frontend coverage for some implemented operations-admin APIs.
3. Nonexistent endpoint usage risk (`/api/user/:id/profile`) in active profile emergency-contact save path.
4. Docs not fully synced with active route architecture (`/api/admin/*` canonical model).

## 10. Immediate Priorities To Close Gap
1. Implement nutritionist workspace (UI route + backend endpoints + permissions).
2. Add missing ops-admin pages for pharmacist verification and other already-implemented ops APIs.
3. Refactor/retire legacy dashboard service methods that target outdated or nonexistent endpoints.
4. Decide and implement real-time strategy: add websocket backend or remove websocket assumptions.
5. Update architecture docs to match active frontend/backend route contracts.
6. Fix profile emergency-contact save path to use an existing backend endpoint contract.

## 11. Source-Of-Truth Files Used
- `Nurture-Glow/frontend/components/Layout.tsx`
- `Nurture-Glow/frontend/components/AdminLayout.tsx`
- `Nurture-Glow/frontend/types.ts`
- `Nurture-Glow/frontend/services/dashboardService.ts`
- `Nurture-Glow/frontend/services/adminApi.ts`
- `Nurture-Glow/frontend/services/realtimeUpdateService.ts`
- `Nurture-Glow/frontend/pages/dashboards/DoctorDashboard.tsx`
- `Nurture-Glow/frontend/components/dashboards/doctor/TelemedicineHub.tsx`
- `Nurture-Glow/frontend/components/dashboards/doctor/ComplianceCenter.tsx`
- `Nurture-Glow/frontend/components/dashboards/doctor/MobileFeatures.tsx`
- `Nurture-Glow/frontend/components/dashboards/doctor/PatientManagement.tsx`
- `Nurture-Glow/frontend/pages/profile/ProfilePage.tsx`
- `Nurture-Glow/frontend/README.md`
- `Nurture-Glow/frontend/docs/DASHBOARD_ARCHITECTURE.md`
- `Nurture-Glow/frontend/docs/ROLE_PERMISSIONS.md`
- `Nurture-Glow/frontend/i18n/translations.ts`
- `Nurture-Glow/backend/src/index.js`
- `Nurture-Glow/backend/src/appRoutes.js`
- `Nurture-Glow/backend/src/adminRoutes.js`
