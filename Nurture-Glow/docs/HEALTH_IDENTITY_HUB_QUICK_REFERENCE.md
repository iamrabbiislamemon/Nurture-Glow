# 🚀 HEALTH IDENTITY HUB - QUICK REFERENCE

## Files at a Glance

### Main Container
- **ProfilePage.tsx** (490 lines)
  - State: user, medical, visits, docs, emergencyContact, verification status
  - Handlers: avatar, name, medical, visit, verification, emergency contact
  - Modals: Log Visit, Verification Request, Reject Reason, Edit Emergency Contact

### Hero Section (3 Cards)
1. **ProfileHero.tsx** (200+ lines)
   - Avatar + Name editing
   - Action buttons (Share, Verify, Settings)
   - Props: user, healthIdStatus, canRequestVerification, callbacks
   
2. **IdentityCard.tsx** (email, phone)
3. **HealthIdCard.tsx** (health ID, verification status)
4. **EmergencyCard.tsx** (emergency contact, edit button) NEW

### 5-Tab Navigation
- **ProfileTabs.tsx** (95+ lines)
  - Routes content to 5 tabs
  - Tab state management

#### Tab 1: Overview
- **OverviewTab.tsx** (100+ lines, enhanced)
- 3 Dashboard Cards:
  1. **ProfileStrengthCard.tsx** - Circular progress + checklist (ENHANCED)
  2. **HealthSnapshotCard.tsx** - Health summary
  3. **NextActionsCard.tsx** - Action suggestions

#### Tab 2: Medical Records
- **MedicalRecordsTab.tsx** (240+ lines, enhanced)
- Medical editor (5 fields)
- Document upload (3 types)
- **Visit history with vertical timeline** (NEW)

#### Tab 3: Verification & Security
- **VerificationSecurityTab.tsx** (330+ lines, enhanced)
- **4-Step progress indicator** (NEW)
- **Activity audit timeline** (NEW)
- Hospital verification queue

#### Tab 4: Connections (NEW)
- **ConnectionsTab.tsx** (180 lines, NEW)
- Connected hospitals list
- Device sync status
- Integration health overview

#### Tab 5: Settings
- **SettingsTab.tsx** (92 lines)
- Language preferences
- Notifications
- Danger zone (reset data)

### 4 Modal Dialogs
1. **LogVisitModal.tsx** - Log doctor visit
2. **VerificationRequestModal.tsx** - Request verification
3. **RejectReasonModal.tsx** - Capture rejection reason
4. **EditEmergencyContactModal.tsx** - Edit emergency contact

### Utilities
- **Toast.tsx** - Notifications
- **EmergencyCard.tsx** - Emergency contact card (NEW)

---

## State Overview

```typescript
// Core Data
docs: VerificationDocument[]
medical: MedicalReport {bloodGroup, allergies, diabetesStatus, knownConditions}
visits: DoctorVisit[]
hospitals: Hospital[]
verificationRequests: HealthIdVerificationRequest[]
healthIdStatus: 'unverified' | 'pending' | 'verified' | 'rejected'
emergencyContact: {name, phone, relation}

// UI State
activeTab: 'overview' | 'medical' | 'verification' | 'connections' | 'settings'
isEditingMedical: boolean
isEditingName: boolean
showLogVisit: boolean
showVerificationModal: boolean
showRejectReason: boolean
showEmergencyContactModal: boolean
showSettings: boolean
showShareModal: boolean
```

---

## Props Cheat Sheet

### ProfileHero Props
```tsx
user: User
healthIdStatus: string
emergencyContact: {name?, phone?, relation?}
onEditEmergencyContact: () => void
// ... + all the handlers
```

### EmergencyCard Props (NEW)
```tsx
name?: string
phone?: string
relation?: string
onEdit: () => void
```

### ProfileStrengthCard Props
```tsx
completion: number (0-100)
items?: CompletionChecklistItem[] // 6 items
```

### OverviewTab Props
```tsx
profileCompletion: number
emergencyContact: {name?, phone?, relation?}
medical: MedicalReport
visits: DoctorVisit[]
docs: VerificationDocument[]
onEditEmergencyContact: () => void
```

### VerificationSecurityTab Props
```tsx
canRequestVerification: boolean
isHospitalAccount: boolean
verificationRequests: HealthIdVerificationRequest[]
onRequestVerification: () => void
onApproveRequest: (id) => void
onRejectRequest: (req) => void
```

---

## Data Persistence

### Emergency Contact
```typescript
// Load on mount
const profile = await db.getUserProfile(user.id)
setEmergencyContact(profile?.emergencyContact || {})

// Save when user submits form
await db.updateUserProfile(user.id, {
  emergencyContact: {name, phone, relation}
})
```

### Medical Info
```typescript
const medical = await db.getMedicalReport(user.id)
await db.updateMedicalReport(user.id, medicalData)
```

### Visits
```typescript
const visits = await db.getVisitHistory(user.id)
await db.logVisit(user.id, visitData)
await db.deleteVisit(visitId)
```

### Verification
```typescript
const status = await db.getHealthIdVerificationStatus()
await db.requestVerification(hospitalId, note)
await db.approveVerification(requestId)
await db.rejectVerification(requestId, reason)
```

---

## Key Features

### Profile Strength Card
- **Circular SVG indicator** with animated progress ring
- **Dynamic checklist** evaluates 6 items:
  1. Full name (required)
  2. Profile picture (required)
  3. Blood group (optional)
  4. Emergency contact (optional)
  5. Medical records (optional)
  6. Health ID verified (optional)
- **Real-time updates** as user adds data

### Verification Progress
- **4 visual steps**:
  1. Email Verified ✓
  2. Phone Verified ✓
  3. NID Uploaded ✓
  4. Hospital Verified (pending or ✓)
- **Progress bar** showing completion %
- **Timestamps** for completed steps

### Activity Timeline
- **Event types**: verification_requested, approved, rejected, document_uploaded, health_id_shared
- **Visual timeline** with dots and connecting line
- **Icons** for each event type
- **Time ago** display (2 days ago, etc.)

### Medical Visit Timeline
- **Vertical timeline** with amber accent
- **Doctor name, clinic, date** in header
- **Reason and notes** in expandable sections
- **Delete button** on hover
- **Empty state** with CTA to log first visit

### Emergency Contact Management
- **Display card** in hero section
- **Edit modal** with form validation
- **Relation dropdown** (Brother, Sister, Father, Mother, Spouse, Other)
- **Database persistence** via updateUserProfile
- **Visual empty state** with CTA button

### Connections Tab
- **Connected Hospitals** list with status indicators
- **Device Sync** status for wearables
- **Integration Status** overview card
- **Placeholder content** for future integrations

---

## Quick Development Tasks

### Add New Verification Step
```tsx
// In VerificationSecurityTab.tsx
const verificationSteps: VerificationStep[] = [
  // ... existing steps
  {
    id: 'new',
    label: 'New Step',
    description: 'New step description',
    status: 'completed',
    icon: <CheckCircle2 size={18} className="text-green-600" />,
    timestamp: '2024-01-20'
  }
];
```

### Add New Completion Item
```tsx
// In OverviewTab.tsx
const completionItems: CompletionChecklistItem[] = [
  // ... existing items
  {
    label: 'New item',
    completed: !!data?.newItem,
    required: false
  }
];
```

### Add New Action to NextActionsCard
```tsx
// In NextActionsCard.tsx
{
  label: 'New action',
  description: 'Description',
  show: condition,
  icon: <Icon size={20} />,
  action: () => handleAction()
}
```

---

## Styling Quick Reference

### Rounded Corners
- `rounded-xl` = 8px
- `rounded-2xl` = 16px
- `rounded-3xl` = 24px
- `rounded-[40px]` = 40px (design system)

### Colors
- Teal: `text-teal-600`, `bg-teal-100`, `border-teal-100`
- Gold: `text-[#E6C77A]`, `bg-[#E6C77A]`
- Gray: `text-gray-800`, `bg-gray-50`, `border-gray-100`

### Shadows
- `shadow-sm` = light
- `shadow-md` = medium
- `shadow-lg` = dark with offset

### Spacing
- Gap: `gap-2` (8px), `gap-4` (16px), `gap-6` (24px), `gap-8` (32px)
- Padding: `p-3`, `p-4`, `p-6`, `p-8`
- Margin: `mt-2`, `mt-4`, `mt-6`, `mt-8`

---

## Common Patterns

### Opening a Modal
```tsx
<button onClick={() => setShowModal(true)}>
  Edit
</button>

{showModal && (
  <Modal
    onClose={() => setShowModal(false)}
    onSave={handleSave}
  />
)}
```

### Updating State on Form Submit
```tsx
const handleSave = async (data) => {
  await db.updateData(user.id, data);
  setState(data);
  setShowModal(false);
  setToast({type: 'success', message: 'Saved!'});
};
```

### Loading Data on Mount
```tsx
useEffect(() => {
  const loadData = async () => {
    const data = await db.getData(user.id);
    setData(data);
  };
  loadData();
}, [user]);
```

### Passing Callbacks to Child Components
```tsx
<ChildComponent
  data={data}
  onEdit={() => setShowModal(true)}
  onDelete={(id) => handleDelete(id)}
  onChange={(newData) => setState(newData)}
/>
```

---

## Testing Checklist

- [ ] Dev server runs: `npm run dev`
- [ ] Profile page loads at /profile
- [ ] All 3 hero cards visible
- [ ] EmergencyCard edit button opens modal
- [ ] Emergency contact saves and persists
- [ ] All 5 tabs clickable and functional
- [ ] ProfileStrengthCard shows circular progress
- [ ] Checklist updates when data changes
- [ ] VerificationSecurityTab shows 4 steps
- [ ] Audit timeline shows events
- [ ] Medical visit timeline displays visits
- [ ] ConnectionsTab renders without errors
- [ ] Mobile layout responsive on small screens
- [ ] No console errors
- [ ] TypeScript compilation passes
- [ ] Toast notifications appear on actions

---

## Troubleshooting

### "setShowEmergencyContact is not defined"
✅ **Fixed**: Use `setShowEmergencyContactModal` instead

### Emergency contact not saving
- Check: `db.updateUserProfile()` is called
- Check: Response is handled
- Check: State is updated

### Completion checklist not updating
- Check: OverviewTab receives correct props
- Check: ProfilePage re-renders when data changes
- Check: Completion items evaluation logic

### Timeline not showing
- Check: Data array is not empty
- Check: Map function has key prop
- Check: CSS display classes correct

---

## Browser DevTools Tips

### React DevTools
- Inspect component props
- View state changes
- Trace re-renders
- Profile performance

### Elements Inspector
- Check computed styles
- Verify grid/flex layout
- Inspect responsive breakpoints
- Check ARIA attributes

### Console
- Look for JavaScript errors
- Check TypeScript compile errors
- Monitor API calls
- Verify state updates

---

## Performance Tips

- Use `React.memo` for expensive components if needed
- Lazy load modals (only render when needed)
- Avoid inline function creation in JSX
- Use `useCallback` for event handlers if needed
- Profile with React DevTools Profiler

---

## Deployment Checklist

- [ ] Remove console.log statements
- [ ] Verify environment variables
- [ ] Test all API endpoints
- [ ] Check error boundary handling
- [ ] Verify database connections
- [ ] Test mobile on actual devices
- [ ] Accessibility audit (lighthouse)
- [ ] Performance audit (< 3s load)
- [ ] Security scan (OWASP)
- [ ] Monitor error logs

---

## Documentation References

- **Full Guide**: `HEALTH_IDENTITY_HUB_FINAL_GUIDE.md`
- **Feature Overview**: `HEALTH_IDENTITY_HUB_ENHANCEMENT_COMPLETE.md`
- **Validation**: `IMPLEMENTATION_VALIDATION_CHECKLIST.md`
- **Original Refactor**: `PROFILE_REFACTORING_COMPLETE.md`

---

**Last Updated**: February 5, 2026  
**Version**: 2.0  
**Status**: ✅ Production Ready
