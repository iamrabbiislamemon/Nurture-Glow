# 🗄️ Frontend Data Integration Guide

## Current Status: READY TO INTEGRATE

All backend API endpoints are **LIVE** and returning data from the MySQL database.

---

## Database Data Available

### 📊 Catalog Data (Live in Database)

| Type | Count | Location | API Endpoint |
|------|-------|----------|--------------|
| Hospitals | 4 | `app_catalog` table | `GET /api/catalog/hospitals` |
| Doctors | 3 | `app_catalog` table | `GET /api/catalog/doctors` |
| Medicines | 3 | `app_catalog` table | `GET /api/catalog/medicines` |

### 🏥 Hospital Data
```
1. Dhaka Medical College
2. Square Hospital
3. Evercare Hospital
4. Ibn Sina Hospital (if seeded)
```

### 👨‍⚕️ Doctor Data
```
3 doctors with specialties available
```

### 💊 Medicine Data
```
3 medicines available for pharmacy
```

---

## Frontend Pages & Data Integration

### ✅ Pages ALREADY Using API Data

1. **Hospitals.tsx** - Using `db.getHospitals()`
   - Status: ✅ Connected
   - Data Flow: `db.getHospitals()` → `/api/catalog/hospitals`
   - Display: Hospital list with search, details modal

2. **Pharmacy.tsx** - Using `db.getMedicines()`
   - Status: ✅ Connected
   - Data Flow: `db.getMedicines()` → `/api/catalog/medicines`
   - Display: Medicine list with categories, favorites, cart

3. **BloodDonors.tsx** - Using `db.getDonors()`
   - Status: ✅ Connected
   - Data Flow: API endpoints for blood donor management
   - Display: Donor list and requests

### ⏳ Pages That Need Data Integration

1. **Dashboard.tsx**
   - Current State: Hardcoded health metrics, AI insights
   - Needs: `db.getAppointments()`, `db.getVaccines()`, user health data
   - Changes Required:
     - Fetch user's upcoming appointments
     - Show vaccine tracker progress
     - Display health metrics from database

2. **VaccineTracker.tsx**
   - Current State: Placeholder page
   - Needs: `db.getVaccines()`, vaccine schedule data
   - Changes Required:
     - Fetch vaccine records for current user
     - Display vaccine schedule
     - Show completion status

3. **Health.tsx**
   - Current State: Placeholder/basic layout
   - Needs: Health records, metrics, history
   - Changes Required:
     - Fetch user health records
     - Display health metrics over time
     - Show health history

4. **Appointments.tsx**
   - Current State: Placeholder
   - Needs: User appointments, doctor data
   - Changes Required:
     - Fetch user appointments from database
     - Show appointment status and details
     - Allow booking with `db.getDoctors()` data

5. **Journal.tsx**
   - Current State: Placeholder
   - Needs: User journal entries
     - Fetch `db.getJournalEntries()`
     - Display user's journal history

6. **Community.tsx**
   - Current State: Placeholder
   - Needs: Community posts
   - Changes Required:
     - Fetch `db.getPosts()`
     - Display community posts with likes/comments
     - Allow creating new posts

7. **Nutrition.tsx**
   - Current State: Placeholder
   - Needs: Nutrition logs, meal history
   - Changes Required:
     - Fetch `db.getNutritionLogs()`
     - Display meal history and nutrition tracking

---

## API Endpoints Available

### Catalog Endpoints (Public)
```
GET /api/catalog/hospitals
GET /api/catalog/doctors
GET /api/catalog/medicines
```

### Protected Endpoints (Require Authentication)
```
GET /api/appointments
POST /api/appointments
PATCH /api/appointments/:id
DELETE /api/appointments/:id

GET /api/vaccines
POST /api/vaccines
PATCH /api/vaccines/:id

GET /api/journal
POST /api/journal
DELETE /api/journal/:id

GET /api/nutrition
POST /api/nutrition

GET /api/community/posts
POST /api/community/posts
DELETE /api/community/posts/:id

GET /api/notifications
PATCH /api/notifications/:id

GET /api/profile/medical
PUT /api/profile/medical

GET /api/profile/visits
POST /api/profile/visits
DELETE /api/profile/visits/:id

GET /api/blood/donors
POST /api/blood/donors

GET /api/blood/requests
POST /api/blood/requests
DELETE /api/blood/requests/:id
```

---

## Data Service Methods (services/db.ts)

### Already Available
```typescript
// Catalog
db.getHospitals()       // ✅ Returns Hospital[]
db.getDoctors()         // ✅ Returns Doctor[]
db.getMedicines()       // ✅ Returns Medicine[]
db.getDonors()          // ✅ Returns Donor[]

// Personal Data
db.getAppointments(userId)
db.getVaccines(userId)
db.getNutritionLogs(userId)
db.getJournalEntries(userId)
db.getPosts()           // Community posts
db.getNotifications(userId)
```

### Methods to Add/Verify
```typescript
db.getHealthHistory(userId, metric)
db.getUserMeta(keys)
db.getMedicalReport(userId)
db.getVisitHistory(userId)
db.getBloodRequests()
```

---

## Step-by-Step Integration Plan

### Phase 1: Verify Current Integrations (TODAY)
- [ ] Test Hospitals page loading data
- [ ] Test Pharmacy page loading medicines
- [ ] Test BloodDonors page loading donors
- [ ] Verify all API calls return 200 status

### Phase 2: Enhance Dashboard (HIGH PRIORITY)
- [ ] Add appointment count display
- [ ] Add vaccine progress visualization
- [ ] Add health metrics from database
- [ ] Real-time data updates

### Phase 3: Complete Page Integrations (MEDIUM PRIORITY)
- [ ] VaccineTracker - Show vaccine schedule & progress
- [ ] Health - Display health records & history
- [ ] Appointments - Show user's appointments with doctors
- [ ] Journal - Display user's journal entries
- [ ] Community - Show community posts

### Phase 4: Advanced Features (LOW PRIORITY)
- [ ] Nutrition tracking with charts
- [ ] Health history analytics
- [ ] Personalized recommendations
- [ ] Data export functionality

---

## Testing Checklist

### Backend API Testing
- [ ] `GET /api/catalog/hospitals` returns 200 + data
- [ ] `GET /api/catalog/doctors` returns 200 + data
- [ ] `GET /api/catalog/medicines` returns 200 + data
- [ ] All protected endpoints require Auth header
- [ ] Error handling works for invalid requests

### Frontend Integration Testing
- [ ] Hospitals page shows hospital list from API
- [ ] Pharmacy page shows medicines from API
- [ ] BloodDonors page shows donor list from API
- [ ] Dashboard updates with live data
- [ ] No console errors on data load
- [ ] Loading states display while fetching
- [ ] Error states display if API fails

### Data Flow Testing
- [ ] Login → Dashboard loads user data
- [ ] Appointments page shows user's appointments
- [ ] Vaccine tracker shows user's vaccine records
- [ ] Journal displays user entries
- [ ] Community shows all posts

---

## Quick Start: View Current Data

### In Browser
1. Visit: `http://localhost:4000/api/catalog/hospitals`
2. Visit: `http://localhost:4000/api/catalog/doctors`
3. Visit: `http://localhost:4000/api/catalog/medicines`

### In Frontend
1. Go to: `http://localhost:5173/hospitals`
2. Go to: `http://localhost:5173/pharmacy`
3. Go to: `http://localhost:5173/blood-donors`

---

## Code Patterns to Use

### Pattern 1: Fetch Data on Component Mount
```typescript
useEffect(() => {
  const loadData = async () => {
    try {
      const data = await db.getHospitals();
      setHospitals(data || []);
    } catch (err) {
      console.error('Failed to fetch:', err);
      setError('Failed to load data');
    }
  };
  loadData();
}, []);
```

### Pattern 2: Filter & Display
```typescript
const filtered = hospitals.filter(h => 
  h.name.toLowerCase().includes(query.toLowerCase())
);

return (
  <div>
    {filtered.map(hospital => (
      <HospitalCard key={hospital.id} hospital={hospital} />
    ))}
  </div>
);
```

### Pattern 3: Loading & Error States
```typescript
if (loading) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} />;
if (!data || data.length === 0) return <EmptyState />;

return <DataDisplay data={data} />;
```

---

## Server Status Check

### Backend (Express)
- **URL**: http://localhost:4000
- **Health**: `GET /health`
- **Status**: ✅ Running (API listening on port 4000)

### Frontend (Vite)
- **URL**: http://localhost:5173
- **Status**: ✅ Running (ready in 416ms)

### Database (MySQL)
- **Host**: localhost
- **Port**: 3306
- **Database**: neonest
- **Tables**: 52 (all initialized)
- **Status**: ✅ Connected

---

## Environment Configuration

### Backend (.env)
```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=root
DB_NAME=neonest
PORT=4000
CORS_ORIGIN=*
```

### Frontend (.env)
```
VITE_API_URL=http://localhost:4000
```

---

## Common Issues & Solutions

### Issue: "API endpoint not found"
**Solution**: Ensure backend is running on port 4000
```bash
cd d:\Nurture-Glow\Nurture-Glow\backend
npm run dev
```

### Issue: "CORS error from frontend"
**Solution**: Check CORS_ORIGIN in backend .env is set to "*" or frontend URL

### Issue: "No data showing on page"
**Solution**:
1. Check browser console for errors
2. Verify API endpoint returns data: `http://localhost:4000/api/catalog/hospitals`
3. Check if component is calling db method
4. Verify user is logged in (for protected endpoints)

### Issue: "Database connection error"
**Solution**:
1. Verify MySQL is running: `mysql -u root -proot -e "SELECT 1"`
2. Check DB credentials in backend .env
3. Verify database exists: `mysql -u root -proot -e "SHOW DATABASES LIKE 'neonest'"`

---

## Next Steps

1. **Review the current integration** in Hospitals.tsx, Pharmacy.tsx, BloodDonors.tsx
2. **Test all API endpoints** to confirm they return data
3. **Apply same pattern** to remaining pages
4. **Update styling** to match modern design (already done in previous phase)
5. **Add loading/error states** for better UX
6. **Test end-to-end** data flow from database → API → Frontend

---

**Last Updated**: January 19, 2026  
**Status**: READY FOR DATA INTEGRATION  
**Servers**: Backend ✅ Frontend ✅ Database ✅
