# Nurture-Glow Backend Service

The Nurture-Glow backend is built using Node.js and Express.

## Architecture & Routes

The backend routes are split into domain-specific modules inside `src/routes/`:
- `appointments.js`: Appointments & consultations booking
- `vaccines.js`: Patient vaccine tracking & catalog
- `doctors.js`: Doctor-facing dashboard & profiles
- `pharmacy.js`: Pharmacist order tracking
- `merchandiser.js`: Merchant catalog and dashboard
- `nutritionist.js`: Nutrition plans CRUD
- `community.js`: Community post forum
- `journal.js`: Mother health journals
- `notifications.js`: Patient notifications
- `blood.js`: Blood donor database
- `catalog.js`: Entities lists
- `orders.js`: Order handling
- `ai.js`: Pregnancy insights AI helper
- `consent.js`: Patient record access consent
- `prescriptions.js`: Prescriptions catalog & creation

## Database & SQL Setup

- **Schema**: Located in `sql/schema/`
- **Migrations**: Incremental updates in `sql/migrations/`
- **Seeds**: Seed data files in `sql/seeds/`
