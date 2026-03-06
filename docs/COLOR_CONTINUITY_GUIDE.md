# 🎨 Color Continuity Guide - Nurture Glow

## Design System Overview

This document ensures **visual consistency** across all roles and features in the Nurture Glow platform.

---

## 📊 Status Color Mapping

### Universal Status Colors
All features (appointments, orders, verifications, etc.) use this **consistent color scheme**:

| Status | Background Color | Text Color | Border Color | Hex Code | Usage |
|--------|-----------------|------------|--------------|----------|-------|
| **Scheduled / Pending** | `bg-blue-50` / `bg-blue-100` | `text-blue-600` / `text-blue-700` | `border-blue-200` | `#3B82F6` | New appointments, awaiting action |
| **In Progress / Processing** | `bg-teal-50` / `bg-teal-100` | `text-teal-600` / `text-teal-700` | `border-teal-200` | `#14B8A6` | Active consultations, processing orders |
| **Completed / Delivered** | `bg-green-50` / `bg-green-100` | `text-green-600` / `text-green-700` | `border-green-200` | `#10B981` | Successful completion |
| **Cancelled / Rejected** | `bg-red-50` / `bg-red-100` | `text-red-600` / `text-red-700` | `border-red-200` | `#EF4444` | Cancelled or declined |
| **Warning / Urgent** | `bg-yellow-50` / `bg-amber-100` | `text-yellow-600` / `text-amber-700` | `border-yellow-200` | `#F59E0B` | Alerts, urgent requests |
| **Info / Neutral** | `bg-gray-50` / `bg-gray-100` | `text-gray-600` / `text-gray-700` | `border-gray-200` | `#6B7280` | Informational states |

---

## 🩺 Appointment System Color Mapping

### Backend Status → Frontend Color
```javascript
// Backend status names (appRoutes.js)
'scheduled'     → Blue   (bg-blue-100 text-blue-700)
'in-progress'   → Teal   (bg-teal-100 text-teal-700)
'completed'     → Green  (bg-green-100 text-green-700)
'cancelled'     → Red    (bg-red-100 text-red-700)
```

### Component: `ConsultationList.tsx`
```typescript
const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':   return 'bg-green-100 text-green-700 border-green-200';
    case 'in-progress': return 'bg-teal-100 text-teal-700 border-teal-200';
    case 'scheduled':   return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'cancelled':   return 'bg-red-100 text-red-700 border-red-200';
    default:            return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};
```

### Appointment Cards (Appointments.tsx)
```tsx
// Status badge color
app.status === 'Upcoming'  ? 'bg-blue-50 text-blue-600'
                            : 'bg-green-50 text-green-600'
```

---

## 💊 Pharmacy Order System Color Mapping

### Backend Status → Frontend Color
```javascript
// Backend status names (appRoutes.js)
'pending'       → Blue   (awaiting pharmacy action)
'processing'    → Teal   (pharmacy preparing order)
'shipped'       → Purple (in transit)
'delivered'     → Green  (successfully delivered)
'cancelled'     → Red    (order cancelled)
```

### Order Status Badge Colors
```typescript
const getOrderStatusColor = (status: string) => {
  switch (status) {
    case 'pending':     return 'bg-blue-100 text-blue-700 border-blue-200';
    case 'processing':  return 'bg-teal-100 text-teal-700 border-teal-200';
    case 'shipped':     return 'bg-purple-100 text-purple-700 border-purple-200';
    case 'delivered':   return 'bg-green-100 text-green-700 border-green-200';
    case 'cancelled':   return 'bg-red-100 text-red-700 border-red-200';
    default:            return 'bg-gray-100 text-gray-700 border-gray-200';
  }
};
```

---

## 👨‍⚕️ Doctor Dashboard Color Scheme

### Stat Cards
```tsx
// Today's Consultations - Teal gradient
bg-gradient-to-br from-teal-50 to-teal-100/50
border-teal-200/40
text-teal-600/700/900

// Pending Appointments - Blue gradient
bg-gradient-to-br from-blue-50 to-blue-100/50
border-blue-200/40
text-blue-600/700/900

// Total Patients - Green gradient
bg-gradient-to-br from-green-50 to-green-100/50
border-green-200/40
text-green-600/700/900

// Rating - Purple gradient
bg-gradient-to-br from-purple-50 to-purple-100/50
border-purple-200/40
text-purple-600/700/900
```

### Action Buttons
```tsx
// Primary CTA - Teal
bg-teal-600 hover:bg-teal-700 text-white

// Secondary - White/Gray
bg-white border-gray-200 text-gray-700 hover:bg-gray-50

// Danger - Red
bg-red-500 hover:bg-red-600 text-white

// Join Call - Teal
bg-teal-600 hover:bg-teal-700 text-white shadow-lg
```

---

## 💼 Pharmacy Dashboard Color Scheme

### Stat Cards (Should match Doctor Dashboard pattern)
```tsx
// Today's Orders - Teal gradient
bg-gradient-to-br from-teal-50 to-teal-100/50

// Pending Orders - Blue gradient
bg-gradient-to-br from-blue-50 to-blue-100/50

// Processing Orders - Teal gradient
bg-gradient-to-br from-teal-50 to-teal-100/50

// Total Revenue - Green gradient
bg-gradient-to-br from-green-50 to-green-100/50
```

---

## 🎭 Role-Based Color Themes

### Mother/Patient
- **Primary**: Teal/Emerald (`#14B8A6`, `#10B981`)
- **Accent**: Soft Pink (`#FDF2F8`)
- **Background**: Cream (`#F7F5EF`)

### Doctor
- **Primary**: Teal (`#14B8A6`)
- **Accent**: Blue (`#3B82F6`)
- **Background**: White/Light Gray

### Pharmacist
- **Primary**: Teal (`#14B8A6`)
- **Accent**: Purple (`#8B5CF6`)
- **Background**: White/Light Gray

### Nutritionist
- **Primary**: Green (`#10B981`)
- **Accent**: Lime (`#84CC16`)
- **Background**: White/Light Gray

### Admin
- **Primary**: Indigo (`#6366F1`)
- **Accent**: Gray (`#6B7280`)
- **Background**: White/Light Gray

---

## 🖼️ Background Color Hierarchy

```tsx
// Page background
bg-[#F7F5EF]

// Card backgrounds (glassmorphism)
bg-gradient-to-b from-white/80 via-white/70 to-white/60
backdrop-blur-sm

// Elevated cards
bg-white shadow-sm border border-gray-100

// Header gradients
bg-gradient-to-r from-teal-600 to-teal-500
```

---

## 🔔 Notification Color Mapping

| Notification Type | Color | Icon Color |
|------------------|-------|------------|
| Success | Green | `text-green-600` |
| Error | Red | `text-red-600` |
| Warning | Yellow/Amber | `text-yellow-600` |
| Info | Blue | `text-blue-600` |
| New Appointment | Teal | `text-teal-600` |
| Order Update | Purple | `text-purple-600` |

---

## ✅ Consistency Checklist

When adding new features, ensure:

- [ ] Status colors match the universal status color table
- [ ] Stat card gradients follow the same pattern (from-{color}-50 to-{color}-100/50)
- [ ] Border colors use /40 opacity for glassmorphism effect
- [ ] Text colors progress from 600 (light) → 700 (medium) → 900 (dark)
- [ ] Hover states darken by 100 (e.g., bg-teal-600 → hover:bg-teal-700)
- [ ] Shadows match the primary color (e.g., shadow-teal-200 for teal buttons)
- [ ] Background uses #F7F5EF for patient-facing pages
- [ ] Cards use backdrop-blur-sm for glassmorphism
- [ ] Icon colors match their context (teal for primary actions, red for danger)

---

## 🔄 Status Workflow Colors

### Appointment Flow
```
New Request  →  Scheduled  →  In Progress  →  Completed
(none)          BLUE          TEAL             GREEN
                               ↓
                          Cancelled (RED)
```

### Order Flow
```
Checkout  →  Pending  →  Processing  →  Shipped  →  Delivered
(none)      BLUE        TEAL           PURPLE      GREEN
                         ↓
                    Cancelled (RED)
```

### Health ID Verification
```
Request  →  Pending  →  Accepted / Rejected
(none)     YELLOW      GREEN / RED
```

---

## 🎨 Tailwind Color Classes Reference

### Primary Palette
```css
/* Teal (Primary Brand) */
bg-teal-50    #F0FDFA
bg-teal-100   #CCFBF1
bg-teal-600   #0D9488
bg-teal-700   #0F766E

/* Blue (Scheduled/Pending) */
bg-blue-50    #EFF6FF
bg-blue-100   #DBEAFE
bg-blue-600   #2563EB
bg-blue-700   #1D4ED8

/* Green (Success/Completed) */
bg-green-50   #F0FDF4
bg-green-100  #DCFCE7
bg-green-600  #16A34A
bg-green-700  #15803D

/* Red (Error/Cancelled) */
bg-red-50     #FEF2F2
bg-red-100    #FEE2E2
bg-red-600    #DC2626
bg-red-700    #B91C1C

/* Yellow (Warning) */
bg-yellow-50  #FEFCE8
bg-yellow-100 #FEF9C3
bg-amber-100  #FEF3C7
bg-yellow-600 #CA8A04
```

---

## 🚨 Breaking Changes to Avoid

**DO NOT change these without updating all related components:**

1. **Status names** (scheduled, in-progress, completed, cancelled)
2. **Primary brand color** (Teal #14B8A6)
3. **Background color** (#F7F5EF for patient pages)
4. **Glassmorphism pattern** (backdrop-blur-sm with /80 /70 /60 opacity gradient)

---

## 📱 Mobile Responsiveness

All colors should work at all screen sizes:
- Touch targets: Minimum 44px height
- Text contrast ratio: Minimum 4.5:1 for accessibility
- Hover states: Optional on mobile (use :hover only)

---

## 🔗 Related Files

**Frontend Components:**
- `components/dashboards/doctor/ConsultationList.tsx` - Appointment status colors
- `pages/Appointments.tsx` - Patient appointment view
- `pages/dashboards/DoctorDashboard.tsx` - Doctor stat cards
- `pages/dashboards/PharmacyDashboard.tsx` - (To be created - follow doctor pattern)

**Backend:**
- `backend/src/appRoutes.js` - Status values defined here

**Design System:**
- `constants.tsx` - Global constants (if needed)
- `tailwind.config.js` - Custom colors (if extended)

---

**Last Updated**: January 20, 2026  
**Maintained by**: GitHub Copilot  
**Status**: ✅ **Color Continuity Verified**
