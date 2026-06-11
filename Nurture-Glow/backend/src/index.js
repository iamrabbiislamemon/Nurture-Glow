import express from 'express';
import { z } from 'zod';
import cors from 'cors';
import morgan from 'morgan';
import helmet from 'helmet';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, ensureChatHistoryTable, pool } from './db.js';
import { seedDatabase } from './seed.js';
import { attachSignaling } from './signaling.js';
import { attachAmbulanceDispatch } from './ambulanceSocket.js';
import { createAppRouter } from './routes/appRoutesIndex.js';
import { createAdminRouter } from './routes/admin/index.js';
import { createTablesAdminRouter } from './routes/admin/tables.js';
import { ensureAppTables, seedAppData, getUserMeta, listEntities, setUserMeta } from './appStore.js';
import { normalizeRoleValue } from './roles.js';
import {
  avatarUpload,
  buildPublicFileUrl,
  maxUploadBytes,
  removeUploadFileByUrl,
  uploadRoot,
  verificationDocUpload,
  vaccineProofUpload
} from './uploads.js';
import { verifyEmailConfig } from './emailService.js';
import 'dotenv/config';

// ─── Refactored modules ────────────────────────────────────────────
import { createAuthMiddleware } from './middleware/auth.js';
import { sanitizeInput } from './middleware/sanitize.js';
import { createErrorHandler } from './middleware/errorHandler.js';
import { createAuthRouter } from './routes/auth.js';
import { createProfileRouter } from './routes/profile.js';
import { createHealthRouter } from './routes/health.js';

const NODE_ENV = process.env.NODE_ENV || 'development';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = path.resolve(__dirname, '..');
const DEV_JWT_SECRET_PATH = path.join(BACKEND_ROOT, '.dev_jwt_secret');
const loadDevJwtSecret = () => {
  try {
    const secret = fsSync.readFileSync(DEV_JWT_SECRET_PATH, 'utf8').trim();
    if (secret.length >= 32) {
      return secret;
    }
  } catch (err) {
    // Ignore missing file
  }

  const generated = crypto.randomBytes(32).toString('hex');
  try {
    fsSync.writeFileSync(DEV_JWT_SECRET_PATH, generated, { encoding: 'utf8', mode: 0o600 });
  } catch (err) {
    console.warn('Failed to persist dev JWT secret:', err.message || err);
  }
  return generated;
};

const JWT_SECRET = (() => {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) {
    return process.env.JWT_SECRET;
  }
  if (NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set to a 32+ char value in production.');
  }
  console.warn('JWT_SECRET is missing or too short. Using a persisted dev secret.');
  return loadDevJwtSecret();
})();

const ADMIN_INVITE_CODE = process.env.ADMIN_INVITE_CODE || 'NURTURE_ADMIN_2026';

// Auth middleware from extracted module
const { requireAuth, checkSuspensionStatus, requireRole, requireConsentForPatient } =
  createAuthMiddleware(JWT_SECRET);

const app = express();

if (NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

const corsOriginRaw = process.env.CORS_ORIGIN || process.env.FRONTEND_URL || '*';
const corsOrigins = corsOriginRaw
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const allowAllOrigins = corsOrigins.includes('*');

if (NODE_ENV === 'production' && allowAllOrigins) {
  throw new Error('CORS_ORIGIN must be an explicit origin list in production.');
}
if (!allowAllOrigins && corsOrigins.length === 0) {
  throw new Error('CORS_ORIGIN resolved to an empty list.');
}

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);
app.use(cors({ origin: allowAllOrigins ? true : corsOrigins }));
app.use(express.json({ limit: '15mb' }));
app.use(morgan('dev'));
app.use('/uploads', express.static(uploadRoot));

const getTokenUserId = (req) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    return payload?.sub || null;
  } catch (err) {
    return null;
  }
};

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false
});

const adminExportLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => getTokenUserId(req) || ipKeyGenerator(req),
  skip: (req) => !req.path.includes('admin') || !req.path.includes('export')
});

// Unplugged for testing: Bypass API and Admin export rate limiting
// app.use(apiLimiter);
// app.use(adminExportLimiter);

// Auth-specific rate limiter (stricter for login/register)
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a minute.' }
});
// Unplugged for testing: Bypass auth rate limiting
// app.use('/auth/login', authLimiter);
// app.use('/auth/register', authLimiter);

// Input sanitization
app.use(sanitizeInput);

const DB_NAME = process.env.DB_NAME || 'neonest';
if (NODE_ENV === 'production') {
  const envSchema = z.object({
    DB_HOST: z.string().min(1),
    DB_USER: z.string().min(1),
    DB_PASSWORD: z.string().min(1),
    DB_NAME: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    CORS_ORIGIN: z.string().optional(),
    FRONTEND_URL: z.string().optional()
  }).refine((data) => Boolean(data.CORS_ORIGIN || data.FRONTEND_URL), {
    message: 'CORS_ORIGIN or FRONTEND_URL must be set in production'
  });

  const envCheck = envSchema.safeParse(process.env);
  if (!envCheck.success) {
    throw new Error(`Invalid production environment configuration: ${envCheck.error.message}`);
  }

  if (process.env.DB_USER === 'root' || process.env.DB_PASSWORD === 'root') {
    console.warn('Production DB credentials appear to be defaults. Set secure DB_USER/DB_PASSWORD.');
  }
}

const SQL_BOOTSTRAP_FILES = [
  { file: 'sql/schema/database-schema.sql', required: true },
  { file: 'sql/migrations/add_role_column.sql', required: false },
  { file: 'sql/schema/create_system_tables.sql', required: true },
  { file: 'sql/migrations/add_oauth_tokens.sql', required: false },
  { file: 'sql/schema/admin_tables_schema.sql', required: true },
  { file: 'sql/schema/create_dashboard_views.sql', required: false }
];

const stripSqlComments = (sql) => {
  const withoutBlock = sql.replace(/\/\*[\s\S]*?\*\//g, '');
  return withoutBlock
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('--') && !trimmed.startsWith('#');
    })
    .join('\n');
};

const splitSqlStatements = (sql) =>
  stripSqlComments(sql)
    .split(';')
    .map((stmt) => stmt.trim())
    .filter(Boolean);

const LOG_DUPLICATE_SCHEMA_WARNINGS =
  process.env.LOG_DUPLICATE_SCHEMA_WARNINGS === 'true';

const resolveSqlPath = async (fileName) => {
  const candidates = [
    path.resolve(process.cwd(), fileName),
    path.resolve(process.cwd(), 'backend', fileName),
    path.resolve(BACKEND_ROOT, fileName)
  ];

  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch (err) {
      // try next
    }
  }

  throw new Error(`SQL file not found: ${fileName}`);
};

async function runSqlFile(fileName) {
  const filePath = await resolveSqlPath(fileName);
  const raw = await fs.readFile(filePath, 'utf-8');
  const statements = splitSqlStatements(raw);
  for (const statement of statements) {
    try {
      await query(statement);
    } catch (err) {
      const msg = String(err?.message || err);
      if (
        msg.includes('Duplicate key name') ||
        msg.includes('Duplicate column name') ||
        msg.includes('already exists')
      ) {
        if (LOG_DUPLICATE_SCHEMA_WARNINGS) {
          console.warn('Ignored duplicate schema error:', msg);
        }
        continue;
      }
      throw err;
    }
  }
}

const STRICT_BOOTSTRAP = process.env.STRICT_BOOTSTRAP === 'true' || NODE_ENV === 'production';

async function ensureAdminSchema() {
  const failures = [];

  for (const entry of SQL_BOOTSTRAP_FILES) {
    const fileName = typeof entry === 'string' ? entry : entry.file;
    const required = typeof entry === 'string' ? false : Boolean(entry.required);
    try {
      await runSqlFile(fileName);
    } catch (err) {
      const message = err?.message || String(err);
      if (STRICT_BOOTSTRAP || required) {
        failures.push({ fileName, message });
      } else {
        console.warn(`Schema bootstrap skipped for ${fileName}:`, message);
      }
    }
  }

  if (failures.length) {
    const details = failures.map((f) => `${f.fileName}: ${f.message}`).join('; ');
    throw new Error(`Schema bootstrap failed: ${details}`);
  }
}

async function assertCoreTables() {
  const requiredTables = ['users', 'user_profiles', 'roles', 'user_roles'];
  const placeholders = requiredTables.map(() => '?').join(', ');
  const rows = await query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_NAME IN (${placeholders})`,
    [DB_NAME, ...requiredTables]
  );
  const existing = new Set(rows.map((row) => row.TABLE_NAME || Object.values(row)[0]));
  const missing = requiredTables.filter((table) => !existing.has(table));
  if (missing.length) {
    throw new Error(
      `Missing core tables: ${missing.join(', ')}. Ensure database-schema.sql was applied.`
    );
  }
}

const DEFAULT_GENDER_UNIFIED_AVATAR = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTIiIGZpbGw9IiNFMkU4RjAiLz48Y2lyY2xlIGN4PSIxMiIgY3k9IjkuNSIgcj0iMy41IiBmaWxsPSIjOTRBM0I4Ii8+PHBhdGggZD0iTTEyIDE0LjVjLTQgMC03LjUgMi03LjUgNXYxLjVoMTV2LTEuNWMwLTMtMy41LTUtNy41LTV6IiBmaWxsPSIjOTRBM0I4Ii8+PC9zdmc+';

async function getUserProfile(userId) {
  const rows = await query(
    `SELECT u.id, u.phone, u.email, u.status, u.role, p.full_name, p.preferred_language
     FROM users u
     LEFT JOIN user_profiles p ON p.user_id = u.id
     WHERE u.id = ?
     LIMIT 1`,
    [userId]
  );

  if (!rows.length) return null;
  const row = rows[0];
  const meta = await getUserMeta(userId, ['avatar']);
  const verificationDocs = await listEntities({ type: 'verification_doc', userId });
  const verificationStatus = (() => {
    if (!verificationDocs.length) return 'Not Submitted';
    if (verificationDocs.some((doc) => doc.status === 'VERIFIED')) return 'Verified';
    if (verificationDocs.some((doc) => doc.status === 'PENDING')) return 'Pending';
    if (verificationDocs.some((doc) => doc.status === 'REJECTED')) return 'Rejected';
    return 'Not Submitted';
  })();
  return {
    id: row.id,
    phone: row.phone,
    email: row.email,
    name: row.full_name || 'User',
    healthId: `NG-${row.id.slice(0, 8).toUpperCase()}`,
    avatar: meta.avatar || DEFAULT_GENDER_UNIFIED_AVATAR,
    verified: verificationStatus,
    preferredLanguage: row.preferred_language || 'en',
    role: normalizeRoleValue(row.role || 'mother')
  };
}

// ─── Mount extracted routers ────────────────────────────────────────
app.use('/api', createHealthRouter({ requireAuth }));

app.use(
  createAuthRouter({
    JWT_SECRET,
    ADMIN_INVITE_CODE,
    requireAuth,
    checkSuspensionStatus,
    getUserProfile
  })
);

app.use(
  '/api',
  createProfileRouter({
    requireAuth,
    avatarUpload,
    buildPublicFileUrl,
    removeUploadFileByUrl,
    getUserProfile
  })
);

const adminRouter = createAdminRouter({ requireAuth, requireRole, checkSuspensionStatus });
const mapLegacyAdminPath = (prefix) => (req, res, next) => {
  const originalUrl = req.url;
  req.url = `${prefix}${originalUrl}`;
  adminRouter(req, res, (err) => {
    req.url = originalUrl;
    next(err);
  });
};

app.use('/api/admin', adminRouter);
app.use('/api/system-admin', mapLegacyAdminPath('/system'));
app.use('/api/ops-admin', mapLegacyAdminPath('/operations'));
app.use(
  '/api',
  createAppRouter({
    requireAuth,
    requireRole,
    requireConsentForPatient,
    verificationDocUpload,
    vaccineProofUpload,
    buildPublicFileUrl,
    removeUploadFileByUrl
  })
);

app.use('/admin', createTablesAdminRouter({ requireAuth, requireRole, checkSuspensionStatus }));

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handler
app.use(createErrorHandler(maxUploadBytes, NODE_ENV));

const port = Number(process.env.PORT || 4000);

async function bootstrap() {
  const { runMigrationsIfPending } = await import('./migrateRunner.js');
  const migrated = await runMigrationsIfPending();

  if (!migrated) {
    await ensureAdminSchema();
  }

  await assertCoreTables();
  await ensureAppTables();
  await ensureChatHistoryTable();
  await seedAppData();
  
  console.log('Verifying email configuration...');
  const emailConfigValid = await verifyEmailConfig();
  if (emailConfigValid) {
    console.log('✓ Email service is ready');
  } else {
    console.warn('⚠ Email service not configured. Password reset emails will not be sent.');
  }
  
  const server = app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
  });

  attachSignaling(server);
  attachAmbulanceDispatch(server);

  const shutdown = async (signal) => {
    console.log(`\n${signal} received — shutting down gracefully…`);
    server.close(async () => {
      try {
        await pool.end();
        console.log('Database pool closed.');
      } catch (err) {
        console.error('Error closing database pool:', err.message);
      }
      process.exit(0);
    });

    setTimeout(() => {
      console.error('Forced shutdown after timeout.');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

export { requireAuth, requireRole, requireConsentForPatient, checkSuspensionStatus };

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
