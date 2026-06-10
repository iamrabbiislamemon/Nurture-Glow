# Nurture Glow - Demo Credentials for Testing

This document contains demo credentials for all the user roles in the Nurture Glow platform. These accounts have been seeded in the database and are ready to be used for testing the system.

## 🔑 Common Password
The password for **all** demo accounts listed below is:
```text
Password123
```

---

## 👥 Demo User Accounts

| Role | Name | Email Address | Phone Number | Description / Workspace |
| :--- | :--- | :--- | :--- | :--- |
| **Mother (Patient)** | Demo Mother | `mother@nurtureglow.com` | `+8801700000001` | Primary user. Accesses pregnancy check-ins, baby tracker, community, etc. |
| **Healthcare Provider** | Demo Doctor | `doctor@nurtureglow.com` | `+8801700000002` | Doctor dashboard. Reviews consultations, telemedicine calls, clinical tools. |
| **Pharmacist** | Demo Pharmacist | `pharmacist@nurtureglow.com` | `+8801700000003` | Pharmacist workspace. Manages orders, products, license verification. |
| **Nutritionist** | Demo Nutritionist | `nutritionist@nurtureglow.com` | `+8801700000004` | Nutrition specialist workspace. Creates diet and meal plans for mothers. |
| **Merchandiser** | Demo Merchandiser | `merchandiser@nurtureglow.com` | `+8801700000005` | Merchant dashboard. Manages store inventory, products, and order updates. |
| **Medical Admin** | Demo Medical Admin | `medical.admin@nurtureglow.com` | `+8801700000006` | Administrative role. Handles doctor verification requests and case reviews. |
| **Operations Admin** | Demo Operations Admin | `ops.admin@nurtureglow.com` | `+8801700000007` | Administrative role. Manages card batches, hospitals, and CSR campaigns. |
| **System Admin** | Demo System Admin | `system.admin@nurtureglow.com` | `+8801700000008` | Full system control. Manages user accounts, audit logs, and security events. |

---

## 🚪 Admin Login Portal
Administrative roles (`medical_admin`, `ops_admin`, `system_admin`) must log in via the dedicated admin sub-route:
- **Admin Portal Link**: `/admin/login` (accessible by clicking "Admin Portal" or entering the URL directly).

Other user roles (`mother`, `doctor`, `pharmacist`, `nutritionist`, `merchandiser`) log in through the main user login page:
- **Main Portal Link**: `/login`
