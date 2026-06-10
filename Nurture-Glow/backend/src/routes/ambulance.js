import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../db.js';
import { getBySubtype, getUserMeta } from '../appStore.js';
import { broadcastToUser, notifyDriversOfEmergency, notifyPatientOfAcceptance, notifyPatientOfStatusChange } from '../ambulanceSocket.js';

export function createAmbulanceRouter(deps = {}) {
  const requireAuth = deps.requireAuth || ((req, res, next) => next());
  const router = express.Router();

  // Helper: Get driver profile info (name, phone, vehicle, rating, vehicle_type, avatar)
  const getDriverDetails = async (driverUserId) => {
    const profileRows = await query(
      `SELECT p.full_name, u.phone, d.vehicle_number, d.rating, d.vehicle_type 
       FROM users u
       JOIN user_profiles p ON p.user_id = u.id
       JOIN ambulance_drivers d ON d.user_id = u.id
       WHERE u.id = ? LIMIT 1`,
      [driverUserId]
    );
    if (!profileRows.length) return null;
    const meta = await getUserMeta(driverUserId, ['avatar']);
    return {
      full_name: profileRows[0].full_name,
      phone: profileRows[0].phone,
      vehicle_number: profileRows[0].vehicle_number,
      rating: parseFloat(profileRows[0].rating) || 5.00,
      vehicle_type: profileRows[0].vehicle_type || 'Standard ICU',
      avatar: meta.avatar || `https://picsum.photos/seed/${driverUserId}/100/100`
    };
  };

  // Helper: Get patient details (name, phone, emergency contact) - Privacy Guard
  const getPatientDetails = async (patientId) => {
    const profileRows = await query(
      `SELECT p.full_name, u.phone 
       FROM users u
       JOIN user_profiles p ON p.user_id = u.id
       WHERE u.id = ? LIMIT 1`,
      [patientId]
    );

    const contactRows = await query(
      `SELECT contact_name, phone, relationship FROM emergency_contacts WHERE user_id = ? LIMIT 1`,
      [patientId]
    );

    return {
      name: profileRows[0]?.full_name || 'Patient',
      phone: profileRows[0]?.phone || '',
      emergencyContact: contactRows[0] ? {
        name: contactRows[0].contact_name,
        phone: contactRows[0].phone,
        relation: contactRows[0].relationship
      } : null
    };
  };

  // 1. POST /api/ambulance/request (Patient triggers emergency transport)
  router.post('/ambulance/request', requireAuth, async (req, res, next) => {
    try {
      const patientId = req.user.sub;
      const { lat, lng, destinationHospital } = req.body || {};

      if (!lat || !lng || !destinationHospital) {
        return res.status(400).json({ error: 'lat, lng, and destinationHospital are required' });
      }

      // Check if there is already an active trip for this patient
      const activeTrips = await query(
        `SELECT id FROM ambulance_trips 
         WHERE patient_id = ? AND status IN ('PENDING', 'EN_ROUTE', 'ARRIVED') 
         LIMIT 1`,
        [patientId]
      );

      if (activeTrips.length > 0) {
        return res.status(400).json({ error: 'You already have an active emergency trip request.' });
      }

      const tripId = uuidv4();
      await query(
        `INSERT INTO ambulance_trips (id, patient_id, status, patient_lat, patient_lng, destination_hospital)
         VALUES (?, ?, 'PENDING', ?, ?, ?)`,
        [tripId, patientId, lat, lng, destinationHospital]
      );

      // Get patient snapshot info to broadcast to drivers
      const patientInfo = await getPatientDetails(patientId);

      const trip = {
        id: tripId,
        patientId,
        status: 'PENDING',
        patientLat: lat,
        patientLng: lng,
        destinationHospital,
        createdAt: new Date().toISOString()
      };

      // Notify online, available drivers
      notifyDriversOfEmergency(trip, patientInfo);

      res.status(201).json({ success: true, trip });
    } catch (err) {
      next(err);
    }
  });

  // 2. GET /api/ambulance/active-trip (Get active trip for patient or driver)
  router.get('/ambulance/active-trip', requireAuth, async (req, res, next) => {
    try {
      const userId = req.user.sub;
      const role = req.user.role;

      let tripRows = [];
      if (role === 'driver') {
        tripRows = await query(
          `SELECT * FROM ambulance_trips 
           WHERE driver_id = ? AND status IN ('EN_ROUTE', 'ARRIVED') 
           ORDER BY created_at DESC LIMIT 1`,
          [userId]
        );
      } else {
        tripRows = await query(
          `SELECT * FROM ambulance_trips 
           WHERE patient_id = ? AND status IN ('PENDING', 'EN_ROUTE', 'ARRIVED') 
           ORDER BY created_at DESC LIMIT 1`,
          [userId]
        );
      }

      if (!tripRows.length) {
        return res.json({ trip: null });
      }

      const rawTrip = tripRows[0];
      const trip = {
        id: rawTrip.id,
        patientId: rawTrip.patient_id,
        driverId: rawTrip.driver_id,
        status: rawTrip.status,
        patientLat: parseFloat(rawTrip.patient_lat),
        patientLng: parseFloat(rawTrip.patient_lng),
        destinationHospital: rawTrip.destination_hospital,
        createdAt: rawTrip.created_at
      };

      // Populate driver details if assigned
      let driverDetails = null;
      if (trip.driverId) {
        driverDetails = await getDriverDetails(trip.driverId);
      }

      // Populate patient details
      const patientDetails = await getPatientDetails(trip.patientId);

      res.json({
        trip,
        driverDetails,
        patientDetails
      });
    } catch (err) {
      next(err);
    }
  });

  // 3. POST /api/ambulance/accept (Driver accepts pending trip)
  router.post('/ambulance/accept', requireAuth, async (req, res, next) => {
    try {
      const driverUserId = req.user.sub;
      const { tripId } = req.body || {};

      if (!tripId) {
        return res.status(400).json({ error: 'tripId is required' });
      }

      const result = await withTransaction(async (conn) => {
        // Check if trip is still pending
        const trips = await conn.query(
          `SELECT patient_id, status FROM ambulance_trips WHERE id = ? FOR UPDATE`,
          [tripId]
        );

        if (!trips.length) {
          return { success: false, status: 404, error: 'Trip not found' };
        }

        if (trips[0].status !== 'PENDING') {
          return { success: false, status: 400, error: 'Trip has already been accepted or cancelled' };
        }

        // Check if driver is currently available
        const drivers = await conn.query(
          `SELECT id, is_available FROM ambulance_drivers WHERE user_id = ? FOR UPDATE`,
          [driverUserId]
        );

        if (!drivers.length) {
          return { success: false, status: 404, error: 'Driver profile not configured' };
        }

        if (!drivers[0].is_available) {
          return { success: false, status: 400, error: 'You are already assigned to an active trip' };
        }

        // Assign driver and set status
        await conn.query(
          `UPDATE ambulance_trips SET driver_id = ?, status = 'EN_ROUTE' WHERE id = ?`,
          [driverUserId, tripId]
        );

        // Mark driver unavailable
        await conn.query(
          `UPDATE ambulance_drivers SET is_available = FALSE WHERE user_id = ?`,
          [driverUserId]
        );

        return { success: true, patientId: trips[0].patient_id };
      });

      if (!result.success) {
        return res.status(result.status).json({ error: result.error });
      }

      const driverDetails = await getDriverDetails(driverUserId);
      const patientDetails = await getPatientDetails(result.patientId);

      // Notify the patient via WebSocket
      notifyPatientOfAcceptance(result.patientId, {
        tripId,
        status: 'EN_ROUTE',
        driver: {
          id: driverUserId,
          name: driverDetails?.full_name || 'Ambulance Driver',
          phone: driverDetails?.phone || '',
          vehicleNumber: driverDetails?.vehicle_number || '',
          rating: driverDetails?.rating || 5.00,
          vehicleType: driverDetails?.vehicle_type || 'Standard ICU',
          avatar: driverDetails?.avatar || ''
        }
      });

      res.json({
        success: true,
        message: 'Trip accepted successfully',
        patientDetails
      });
    } catch (err) {
      next(err);
    }
  });

  // 4. POST /api/ambulance/arrive (Driver marks arrival at patient location)
  router.post('/ambulance/arrive', requireAuth, async (req, res, next) => {
    try {
      const driverUserId = req.user.sub;
      const { tripId } = req.body || {};

      if (!tripId) {
        return res.status(400).json({ error: 'tripId is required' });
      }

      const trips = await query(
        `SELECT patient_id, driver_id, status FROM ambulance_trips WHERE id = ? LIMIT 1`,
        [tripId]
      );

      if (!trips.length) {
        return res.status(404).json({ error: 'Trip not found' });
      }

      if (trips[0].driver_id !== driverUserId) {
        return res.status(403).json({ error: 'You are not assigned to this trip' });
      }

      if (trips[0].status !== 'EN_ROUTE') {
        return res.status(400).json({ error: 'Trip must be in EN_ROUTE state to mark arrived' });
      }

      await query(
        `UPDATE ambulance_trips SET status = 'ARRIVED' WHERE id = ?`,
        [tripId]
      );

      // Notify patient
      notifyPatientOfStatusChange(trips[0].patient_id, 'ARRIVED');

      res.json({ success: true, status: 'ARRIVED' });
    } catch (err) {
      next(err);
    }
  });

  // 5. POST /api/ambulance/complete (Driver completes trip)
  router.post('/ambulance/complete', requireAuth, async (req, res, next) => {
    try {
      const driverUserId = req.user.sub;
      const { tripId } = req.body || {};

      if (!tripId) {
        return res.status(400).json({ error: 'tripId is required' });
      }

      const result = await withTransaction(async (conn) => {
        const trips = await conn.query(
          `SELECT patient_id, driver_id, status FROM ambulance_trips WHERE id = ? FOR UPDATE`,
          [tripId]
        );

        if (!trips.length) {
          return { success: false, status: 404, error: 'Trip not found' };
        }

        if (trips[0].driver_id !== driverUserId) {
          return { success: false, status: 403, error: 'You are not assigned to this trip' };
        }

        // Update trip status to COMPLETED
        await conn.query(
          `UPDATE ambulance_trips SET status = 'COMPLETED' WHERE id = ?`,
          [tripId]
        );

        // Mark driver available again
        await conn.query(
          `UPDATE ambulance_drivers SET is_available = TRUE WHERE user_id = ?`,
          [driverUserId]
        );

        return { success: true, patientId: trips[0].patient_id };
      });

      if (!result.success) {
        return res.status(result.status).json({ error: result.error });
      }

      // Notify patient
      notifyPatientOfStatusChange(result.patientId, 'COMPLETED');

      res.json({ success: true, status: 'COMPLETED' });
    } catch (err) {
      next(err);
    }
  });

  // 6. POST /api/ambulance/cancel (Patient or driver cancels trip)
  router.post('/ambulance/cancel', requireAuth, async (req, res, next) => {
    try {
      const userId = req.user.sub;
      const role = req.user.role;
      const { tripId } = req.body || {};

      if (!tripId) {
        return res.status(400).json({ error: 'tripId is required' });
      }

      const result = await withTransaction(async (conn) => {
        const trips = await conn.query(
          `SELECT patient_id, driver_id, status FROM ambulance_trips WHERE id = ? FOR UPDATE`,
          [tripId]
        );

        if (!trips.length) {
          return { success: false, status: 404, error: 'Trip not found' };
        }

        const trip = trips[0];

        // Authorization check: Must be the patient or the assigned driver
        if (role === 'driver' && trip.driver_id !== userId) {
          return { success: false, status: 403, error: 'You are not authorized to cancel this trip' };
        }
        if (role !== 'driver' && trip.patient_id !== userId) {
          return { success: false, status: 403, error: 'You are not authorized to cancel this trip' };
        }

        if (trip.status === 'COMPLETED' || trip.status === 'CANCELLED') {
          return { success: false, status: 400, error: 'Trip is already ended' };
        }

        // Cancel trip
        await conn.query(
          `UPDATE ambulance_trips SET status = 'CANCELLED' WHERE id = ?`,
          [tripId]
        );

        // Release driver if assigned
        if (trip.driver_id) {
          await conn.query(
            `UPDATE ambulance_drivers SET is_available = TRUE WHERE user_id = ?`,
            [trip.driver_id]
          );
        }

        return { success: true, patientId: trip.patient_id, driverId: trip.driver_id };
      });

      if (!result.success) {
        return res.status(result.status).json({ error: result.error });
      }

      // Notify the other party via WS
      if (role === 'driver') {
        // Driver cancelled, notify patient
        notifyPatientOfStatusChange(result.patientId, 'CANCELLED');
      } else {
        // Patient cancelled, notify driver if assigned
        if (result.driverId) {
          broadcastToUser(result.driverId, { type: 'trip-cancelled', tripId });
        }
      }

      res.json({ success: true, status: 'CANCELLED' });
    } catch (err) {
      next(err);
    }
  });

  // 7. GET /api/ambulance/history (Driver trip history)
  router.get('/ambulance/history', requireAuth, async (req, res, next) => {
    try {
      const userId = req.user.sub;
      const role = req.user.role;

      if (role !== 'driver') {
        return res.status(403).json({ error: 'Only drivers can view trip history' });
      }

      const history = await query(
        `SELECT t.id, t.status, t.patient_lat, t.patient_lng, t.destination_hospital, t.created_at, p.full_name as patient_name
         FROM ambulance_trips t
         JOIN user_profiles p ON p.user_id = t.patient_id
         WHERE t.driver_id = ? AND t.status IN ('COMPLETED', 'CANCELLED')
         ORDER BY t.created_at DESC`,
        [userId]
      );

      res.json({
        items: history.map(row => ({
          id: row.id,
          status: row.status,
          patientLat: parseFloat(row.patient_lat),
          patientLng: parseFloat(row.patient_lng),
          destinationHospital: row.destination_hospital,
          createdAt: row.created_at,
          patientName: row.patient_name
        }))
      });
    } catch (err) {
      next(err);
    }
  });

  // 8. GET /api/ambulance/profile (Get driver profile/availability)
  router.get('/ambulance/profile', requireAuth, async (req, res, next) => {
    try {
      const driverUserId = req.user.sub;

      let rows = await query(
        `SELECT * FROM ambulance_drivers WHERE user_id = ? LIMIT 1`,
        [driverUserId]
      );

      if (!rows.length) {
        // Auto-create driver record if it doesn't exist yet (robustness)
        const id = uuidv4();
        const vehicle = `NG-AMB-${driverUserId.slice(0, 4).toUpperCase()}`;
        await query(
          `INSERT INTO ambulance_drivers (id, user_id, vehicle_number, is_available)
           VALUES (?, ?, ?, TRUE)`,
          [id, driverUserId, vehicle]
        );
        rows = [{
          id,
          user_id: driverUserId,
          vehicle_number: vehicle,
          is_available: 1,
          lat: null,
          lng: null
        }];
      }

      const driver = rows[0];
      res.json({
        driver: {
          id: driver.id,
          userId: driver.user_id,
          vehicleNumber: driver.vehicle_number,
          isAvailable: Boolean(driver.is_available),
          lat: driver.lat ? parseFloat(driver.lat) : null,
          lng: driver.lng ? parseFloat(driver.lng) : null
        }
      });
    } catch (err) {
      next(err);
    }
  });

  // 9. POST /api/ambulance/driver/toggle-availability (Toggle driver availability status)
  router.post('/ambulance/driver/toggle-availability', requireAuth, async (req, res, next) => {
    try {
      const driverUserId = req.user.sub;
      const { isAvailable } = req.body || {};

      if (isAvailable === undefined) {
        return res.status(400).json({ error: 'isAvailable is required' });
      }

      // Check if driver has an active assigned trip (cannot go offline during a trip)
      if (!isAvailable) {
        const activeTrips = await query(
          `SELECT id FROM ambulance_trips 
           WHERE driver_id = ? AND status IN ('EN_ROUTE', 'ARRIVED') 
           LIMIT 1`,
          [driverUserId]
        );
        if (activeTrips.length > 0) {
          return res.status(400).json({ error: 'Cannot go offline while assigned to an active trip' });
        }
      }

      // Perform update or insert if missing
      await query(
        `INSERT INTO ambulance_drivers (id, user_id, vehicle_number, is_available)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE is_available = VALUES(is_available)`,
        [uuidv4(), driverUserId, `NG-AMB-${driverUserId.slice(0, 4).toUpperCase()}`, isAvailable ? 1 : 0]
      );

      res.json({ success: true, isAvailable });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
