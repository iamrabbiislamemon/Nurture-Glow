// ============================================================================
// USER ROLES - CENTRAL DEFINITION
// ============================================================================
export type UserRole = 
  | 'mother'           // Patient/Primary user
  | 'doctor'           // Medical professional
  | 'pharmacist'       // Pharmacy staff
  | 'nutritionist'     // Nutrition specialist
  | 'merchandiser'     // Product seller
  | 'driver'           // Ambulance driver
  | 'medical_admin'    // Medical facility admin
  | 'ops_admin'        // Operations administrator
  | 'system_admin';    // System administrator

export type Language = 'en' | 'bn';

export type NotificationType =
  | 'VACCINE'
  | 'APPOINTMENT'
  | 'APPOINTMENT_CANCELED'
  | 'APPOINTMENT_STATUS'
  | 'APPOINTMENT_REJECTED'
  | 'COMMUNITY'
  | 'HOSPITAL'
  | 'REPORT'
  | 'VERIFICATION'
  | 'SYSTEM'
  | 'health_id_verification_request'
  | 'health_id_verification_accepted'
  | 'health_id_verification_rejected';

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  entityId?: string;
  title: string;
  message: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export type HealthIdVerificationStatus = 'unverified' | 'pending' | 'accepted' | 'rejected';

export interface HealthIdVerificationRequest {
  id: number;
  user_id: string;
  hospital_id: string;
  status: HealthIdVerificationStatus;
  request_note?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
  health_id?: string;
  user_name?: string;
  area?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  healthId: string;
  avatar: string;
  verified: 'Not Submitted' | 'Pending' | 'Verified' | 'Rejected';
  preferredLanguage?: string;
  role?: UserRole;
  premium?: boolean;
}

export interface JournalEntry {
  id: string;
  userId: string;
  title: string;
  content: string;
  date: string;
  mood?: string;
  attachments: {
    name: string;
    url: string; // Base64
    type: string;
  }[];
}

export interface VerificationDocument {
  id: string;
  userId: string;
  type: 'NID' | 'BIRTH_CERT' | 'MARRIAGE_CERT' | 'MEDICAL_REPORT';
  document_type?: 'NID' | 'BIRTH_CERT' | 'MARRIAGE_CERT' | 'MEDICAL_REPORT'; // Added for compatibility with ProfilePage
  status: 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';
  fileUrl?: string;
  fileName?: string;
  uploadedAt?: string;
}

export interface MedicalReport {
  bloodGroup: string;
  allergies: string;
  diabetesStatus: boolean;
  knownConditions: string;
}

export interface DoctorVisit {
  id: string;
  userId: string;
  doctorName: string;
  clinic: string;
  date: string;
  reason: string;
  notes?: string;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  hospital: string;
  location: string;
  image: string;
  fee: number;
  availableSlots: string[];
  type: 'Online' | 'Offline' | 'Both';
  rating?: number;
  reviewCount?: number;
  bio?: string;
}

export interface Appointment {
  id: string;
  userId: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
  status: 'Upcoming' | 'Pending' | 'Completed' | 'Cancelled';
  type: 'Online' | 'Offline';
  meetingUrl?: string;
  meetingData?: MeetingData;
  notes?: string;
}

export interface MeetingData {
  provider: 'jitsi' | 'google_meet';
  roomName: string;
  joinUrl: string;
  calendarEventId?: string | null;
  status: 'scheduled' | 'started' | 'ended' | 'cancelled';
  createdAt: string;
  endedAt?: string | null;
  cancelledAt?: string | null;
}

export interface MeetingInfo {
  success: boolean;
  data?: {
    meetingData: MeetingData;
    appointment: Appointment;
  };
  message?: string;
  error?: string;
}

export interface DoctorReview {
  id: string;
  userId: string;
  doctorId: string;
  doctorName?: string;
  appointmentId?: string;
  rating: number;
  reviewText?: string;
  createdAt: string;
}

export interface VaccineRecord {
  id: string;
  userId: string;
  name: string;
  dueDate: string;
  status: 'Taken' | 'Pending' | 'Missed';
  notes?: string;
  administeredDate?: string | null;
  doseNumber?: number | string | null;
  location?: string | null;
  doctorUserId?: string | null;
  verificationStatus?: 'pending' | 'approved' | 'rejected' | 'auto';
  verificationReason?: string | null;
  verifiedByDoctorId?: string | null;
  verifiedAt?: string | null;
  createdByRole?: 'patient' | 'doctor';
  createdById?: string;
  proofFileName?: string | null;
  proofUrl?: string | null;
  reminders?: {
    preDue?: string;
    due?: string;
    overdue?: string;
  };
  patientName?: string;
  patientAge?: number | null;
}

export interface VaccineDoctorOption {
  userId: string;
  doctorId?: string;
  name: string;
  specialty?: string | null;
}

export interface VaccineMessage {
  id: string;
  vaccineId: string;
  senderId: string;
  senderRole: 'patient' | 'doctor';
  message: string;
  createdAt: string;
}

export interface CommunityPost {
  id: string;
  userId: string;
  authorName: string;
  content: string;
  image?: string;
  createdAt: string;
  likes: string[]; // array of userIds
  comments: PostComment[];
}

export interface PostComment {
  id: string;
  userId: string;
  authorName: string;
  content: string;
  createdAt: string;
  replies: PostComment[];
}

export interface Hospital {
  id: string;
  name: string;
  location: string;
  contact: string;
  type: string;
  beds: 'Available' | 'Limited' | 'Unknown';
  lat: number;
  lng: number;
}

export interface Medicine {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
}

export interface Myth {
  id: string;
  myth: string;
  fact: string;
  category: string;
}

export interface MealLog {
  id: string;
  userId: string;
  name: string;
  calories: number;
  type: 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
  time: string;
}

export interface Donor {
  id: string;
  userId?: string; // Track which user registered to prevent duplicates
  name: string;
  bloodGroup: string;
  location: string;
  phone: string;
  verified?: boolean;
  lastDonation?: string; // Track last donation date
  availableToDate?: string; // When they'll be available again (3 months after last donation)
}

export interface BloodRequest {
  id: string;
  donorId: string;
  donorName: string;
  bloodGroup: string;
  area: string;
  requesterPhone: string;
  message?: string;
  createdAt: string;
  status: 'sent';
}

export type DeviceType =
  | 'smartphone'
  | 'smartwatch'
  | 'bloodPressure'
  | 'glucometer'
  | 'thermometer'
  | 'scale'
  | 'other';

export interface ConnectedDevice {
  id: string;
  userId: string;
  name: string;
  type: DeviceType;
  lastSync: string | null;
  syncedRecords: number;
  createdAt: string;
}

// ============================================================================
// TYPES BARREL — Central re-export for all application types
// ============================================================================
export type {
  AccessLevel,
  ConsentStatus,
  AuditLogEntry,
  DoctorProfile,
  PatientBasicInfo,
  Consultation,
  Prescription,
  Medication,
  DoctorSchedule,
  DoctorEarnings,
  DoctorDashboardData,
  DoctorNotification,
  DoctorVerificationRequest,
  HighRiskCase,
  ConsultationQualityMetric,
  EmergencyAlert,
  MedicalAdminDashboardData,
  SystemAlert,
  Card,
  CSRProgram,
  ServiceAnalytics,
  OpsAdminDashboardData,
  ActivityLog,
  UserAccount,
  RolePermission,
  SystemHealthMetrics,
  SecurityEvent,
  SystemAdminDashboardData,
  NutritionistProfile,
  NutritionPlan,
  PatientRef,
  NutritionistConsultation,
  NutritionistFollowUp,
  NutritionistDashboardData,
  DashboardApiResponse,
  ConsentGrant,
  ConsentRequest,
  EmergencyOverride,
} from './dashboard';

export type {
  ApiSuccessResponse,
  ApiErrorResponse,
  ApiResponse,
  PaginationMeta,
  PaginatedResponse,
  PaginationParams,
  SystemDashboardResponse,
  UsersListResponse,
  SecurityEventsResponse,
  BackupsListResponse,
  SystemMetricsResponse,
  SystemHealthResponse,
  BlacklistResponse,
  MessagesResponse,
  SettingsResponse,
  AppealsResponse,
  OpsDashboardResponse,
  CardBatchesResponse,
  HospitalsResponse,
  CsrProgramsResponse,
  SupportTicketsResponse,
  MedicalDashboardResponse,
  DoctorVerificationsResponse,
  HighRiskCasesResponse,
  ConsultationReviewsResponse,
  EmergencyLogsResponse,
  AdminNotificationsResponse,
  AdminActionsResponse,
  AdminInteractionsResponse,
  OverviewStatsResponse,
  MutationSuccessResponse,
  EntityCreatedResponse,
} from './api';
