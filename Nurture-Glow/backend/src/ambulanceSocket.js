import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import fsSync from 'fs';
import path from 'path';
import { query } from './db.js';

// Map of userId -> Set of active WebSocket connections
const connectedUsers = new Map();

const getJwtSecret = () => {
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length >= 32) {
    return process.env.JWT_SECRET;
  }
  try {
    // Try current directory and backend directory candidate
    const candidates = [
      path.resolve(process.cwd(), '.dev_jwt_secret'),
      path.resolve(process.cwd(), 'backend', '.dev_jwt_secret')
    ];
    for (const file of candidates) {
      if (fsSync.existsSync(file)) {
        return fsSync.readFileSync(file, 'utf8').trim();
      }
    }
  } catch (err) {
    // ignore
  }
  return 'fallback-dev-secret-if-nothing-else-works';
};

const JWT_SECRET = getJwtSecret();

/**
 * Attach the ambulance tracking WebSocket server to the existing HTTP server.
 * @param {import('http').Server} server
 */
export function attachAmbulanceDispatch(server) {
  const wss = new WebSocketServer({ server, path: '/ws/ambulance' });

  wss.on('connection', (ws, req) => {
    // Extract token from query parameters
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
      console.warn('[AmbulanceWS] Connection rejected: Missing token');
      ws.close(4001, 'Missing authorization token');
      return;
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      console.warn('[AmbulanceWS] Connection rejected: Invalid token', err.message);
      ws.close(4002, 'Invalid authorization token');
      return;
    }

    const userId = decoded.sub;
    const role = decoded.role || 'unknown';

    console.log(`[AmbulanceWS] Connected user: ${userId} (${role})`);

    // Add socket to user's connections
    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, new Set());
    }
    connectedUsers.get(userId).add(ws);

    // Handle messages
    ws.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        return;
      }

      if (msg.type === 'location-update') {
        const { tripId, lat, lng } = msg;
        if (!tripId || !lat || !lng) return;

        try {
          // 1. Update coordinate values in the ambulance drivers table
          await query(
            `UPDATE ambulance_drivers SET lat = ?, lng = ? WHERE user_id = ?`,
            [lat, lng, userId]
          );

          // 2. Fetch the patient ID associated with the trip
          const tripRows = await query(
            `SELECT patient_id FROM ambulance_trips WHERE id = ? LIMIT 1`,
            [tripId]
          );

          if (tripRows.length > 0) {
            const patientId = tripRows[0].patient_id;

            // 3. Stream coordinates to the patient's map
            broadcastToUser(patientId, {
              type: 'driver-location',
              tripId,
              lat: parseFloat(lat),
              lng: parseFloat(lng)
            });
          }
        } catch (err) {
          console.error('[AmbulanceWS] Error handling location update:', err.message);
        }
      }
    });

    ws.on('close', () => {
      console.log(`[AmbulanceWS] Closed connection: ${userId}`);
      const userConnections = connectedUsers.get(userId);
      if (userConnections) {
        userConnections.delete(ws);
        if (userConnections.size === 0) {
          connectedUsers.delete(userId);
        }
      }
    });

    ws.on('error', (err) => {
      console.error(`[AmbulanceWS] Error on socket for ${userId}:`, err.message);
      const userConnections = connectedUsers.get(userId);
      if (userConnections) {
        userConnections.delete(ws);
        if (userConnections.size === 0) {
          connectedUsers.delete(userId);
        }
      }
    });
  });

  console.log('[AmbulanceWS] Ambulance socket server attached at /ws/ambulance');
  return wss;
}

/**
 * Send a WebSocket message to all active sessions for a user ID.
 * @param {string} userId 
 * @param {object} data 
 */
export function broadcastToUser(userId, data) {
  const userConnections = connectedUsers.get(userId);
  if (userConnections) {
    const payload = JSON.stringify(data);
    for (const ws of userConnections) {
      if (ws.readyState === 1) { // OPEN
        ws.send(payload);
      }
    }
  }
}

/**
 * Broadcast emergency request details to all available drivers.
 * @param {object} trip 
 * @param {object} patientInfo 
 */
export async function notifyDriversOfEmergency(trip, patientInfo) {
  try {
    const availableDrivers = await query(
      `SELECT user_id FROM ambulance_drivers WHERE is_available = TRUE`
    );

    const payload = {
      type: 'emergency-alert',
      trip,
      patient: patientInfo
    };

    availableDrivers.forEach(driver => {
      broadcastToUser(driver.user_id, payload);
    });
  } catch (err) {
    console.error('[AmbulanceWS] Broadcast emergency error:', err.message);
  }
}

/**
 * Notify the patient when a driver accepts their request.
 * @param {string} patientId 
 * @param {object} data 
 */
export function notifyPatientOfAcceptance(patientId, data) {
  broadcastToUser(patientId, {
    type: 'trip-accepted',
    ...data
  });
}

/**
 * Send a simple status update notification to the patient.
 * @param {string} patientId 
 * @param {string} status 
 */
export function notifyPatientOfStatusChange(patientId, status) {
  broadcastToUser(patientId, {
    type: 'status-change',
    status
  });
}
