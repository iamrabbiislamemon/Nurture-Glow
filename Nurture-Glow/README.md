# Nurture-Glow

Premium Mother, Pregnancy & Baby Care Platform.

## Project Structure

```
Nurture-Glow/
├── backend/
│   ├── sql/                 # Structured SQL schema, migrations, and seeds
│   │   ├── schema/
│   │   ├── migrations/
│   │   └── seeds/
│   ├── src/
│   │   ├── helpers/         # Extracted domain helpers
│   │   ├── middleware/      # Authentication & sanitize middleware
│   │   ├── routes/          # Extracted domain-specific routes
│   │   └── index.js         # Entry point (Express server & WS signaling)
│   └── package.json
└── frontend/
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   └── types/           # Consolidated TypeScript type definitions
    └── package.json
```

## Technology Stack

- **Backend**: Node.js, Express, WebSocket (for signaling), MySQL
- **Frontend**: React, Vite, TypeScript, Recharts, Framer Motion, Lucide-React
- **Database**: MySQL

## Setup Instructions

### Backend Setup
1. Navigate to `backend/`
2. Run `npm install`
3. Configure environment variables in `.env` (see `.env.example`)
4. Run `npm run dev` to start the server

### Frontend Setup
1. Navigate to `frontend/`
2. Run `npm install`
3. Run `npm run dev` to start the development client
