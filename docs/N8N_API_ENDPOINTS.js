// N8N API Endpoints for Nurture-Glow
// Add these to your backend/src/appRoutes.js

/**
 * N8N Integration Routes
 * These endpoints provide data to N8N workflows for automation
 */

// ============================================
// VACCINE-RELATED ENDPOINTS
// ============================================

/**
 * GET /api/vaccines/due-today
 * Returns all vaccines due today for all users
 * Used by: Daily Vaccine Reminder workflow
 */
app.get('/api/vaccines/due-today', async (req, res) => {
  try {
    const vaccines = await db.query(`
      SELECT 
        v.id as vaccineId,
        v.name as vaccineName,
        v.description,
        v.recommended_week as recommendedWeek,
        u.id as userId,
        u.email,
        u.name,
        u.phone,
        DATEDIFF(CURDATE(), user_pregnancies.created_at) / 7 as currentWeek
      FROM vaccines v
      JOIN user_vaccines uv ON v.id = uv.vaccine_id
      JOIN users u ON uv.user_id = u.id
      JOIN user_pregnancies ON u.id = user_pregnancies.user_id
      WHERE uv.status = 'PENDING'
      AND WEEK(DATE_ADD(user_pregnancies.created_at, INTERVAL v.recommended_week WEEK)) = WEEK(CURDATE())
      AND YEAR(DATE_ADD(user_pregnancies.created_at, INTERVAL v.recommended_week WEEK)) = YEAR(CURDATE())
      ORDER BY u.id
    `);
    
    res.json(vaccines);
  } catch (err) {
    console.error('Error fetching due vaccines:', err);
    res.status(500).json({ error: 'Failed to fetch vaccines' });
  }
});

/**
 * GET /api/vaccines/:vaccineId/upcoming
 * Get users with upcoming vaccines
 */
app.get('/api/vaccines/:vaccineId/upcoming', async (req, res) => {
  try {
    const { vaccineId } = req.params;
    const users = await db.query(`
      SELECT u.*, uv.status
      FROM users u
      JOIN user_vaccines uv ON u.id = uv.user_id
      WHERE uv.vaccine_id = ? AND uv.status = 'PENDING'
    `, [vaccineId]);
    
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ============================================
// APPOINTMENT-RELATED ENDPOINTS
// ============================================

/**
 * GET /api/appointments/tomorrow
 * Returns appointments scheduled for tomorrow
 * Used by: 24-Hour Reminder workflow
 */
app.get('/api/appointments/tomorrow', async (req, res) => {
  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    
    const appointments = await db.query(`
      SELECT 
        a.id as appointmentId,
        a.appointment_date as appointmentDate,
        a.appointment_time as appointmentTime,
        a.status,
        u.id as userId,
        u.name,
        u.email,
        u.phone,
        d.id as doctorId,
        d.name as doctorName,
        h.id as hospitalId,
        h.name as hospitalName,
        h.location
      FROM appointments a
      JOIN users u ON a.user_id = u.id
      JOIN doctors d ON a.doctor_id = d.id
      JOIN hospitals h ON a.hospital_id = h.id
      WHERE DATE(a.appointment_date) = ?
      AND a.status IN ('CONFIRMED', 'PENDING')
      AND a.reminder_sent = 0
      ORDER BY a.appointment_time
    `, [tomorrowStr]);
    
    res.json(appointments);
  } catch (err) {
    console.error('Error fetching tomorrow appointments:', err);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

/**
 * POST /api/appointments/:id/confirm-sent
 * Mark appointment confirmation as sent
 */
app.post('/api/appointments/:id/confirm-sent', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`
      UPDATE appointments 
      SET confirmation_sent = 1, confirmation_sent_at = NOW()
      WHERE id = ?
    `, [id]);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

/**
 * POST /api/appointments/:id/reminder-sent
 * Mark appointment reminder as sent
 */
app.post('/api/appointments/:id/reminder-sent', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`
      UPDATE appointments 
      SET reminder_sent = 1, reminder_sent_at = NOW()
      WHERE id = ?
    `, [id]);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

/**
 * GET /api/appointments/upcoming-week
 * Get appointments for the next 7 days
 */
app.get('/api/appointments/upcoming-week', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextWeekStr = nextWeek.toISOString().split('T')[0];
    
    const appointments = await db.query(`
      SELECT 
        a.*, u.email, u.name, u.phone,
        d.name as doctorName,
        h.name as hospitalName
      FROM appointments a
      JOIN users u ON a.user_id = u.id
      JOIN doctors d ON a.doctor_id = d.id
      JOIN hospitals h ON a.hospital_id = h.id
      WHERE DATE(a.appointment_date) BETWEEN ? AND ?
      AND a.status = 'CONFIRMED'
      ORDER BY a.appointment_date, a.appointment_time
    `, [today, nextWeekStr]);
    
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// ============================================
// HEALTH METRIC ENDPOINTS
// ============================================

/**
 * GET /api/health/alerts
 * Get health metrics that are out of normal range
 */
app.get('/api/health/alerts', async (req, res) => {
  try {
    const alerts = await db.query(`
      SELECT 
        hm.id,
        hm.metric_type as metricType,
        hm.value,
        hm.unit,
        hm.status,
        hm.recorded_at as recordedAt,
        u.id as userId,
        u.email,
        u.name,
        u.phone,
        d.id as doctorId,
        d.email as doctorEmail,
        d.name as doctorName
      FROM health_metrics hm
      JOIN users u ON hm.user_id = u.id
      LEFT JOIN appointments a ON u.id = a.user_id
      LEFT JOIN doctors d ON a.doctor_id = d.id
      WHERE hm.status != 'NORMAL'
      AND hm.alert_sent = 0
      AND hm.recorded_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
      ORDER BY hm.recorded_at DESC
      LIMIT 100
    `);
    
    res.json(alerts);
  } catch (err) {
    console.error('Error fetching health alerts:', err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

/**
 * POST /api/health/alert/:id/sent
 * Mark health alert as sent
 */
app.post('/api/health/alert/:id/sent', async (req, res) => {
  try {
    const { id } = req.params;
    await db.query(`
      UPDATE health_metrics 
      SET alert_sent = 1, alert_sent_at = NOW()
      WHERE id = ?
    `, [id]);
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update health metric' });
  }
});

// ============================================
// COMMUNITY ENDPOINTS
// ============================================

/**
 * GET /api/community/posts
 * Get community posts from the past N days
 * Query: ?days=7
 */
app.get('/api/community/posts', async (req, res) => {
  try {
    const days = req.query.days || 7;
    const posts = await db.query(`
      SELECT 
        p.id,
        p.title,
        p.content,
        p.created_at as createdAt,
        p.likes,
        COUNT(c.id) as comments,
        u.id as userId,
        u.name as authorName
      FROM community_posts p
      LEFT JOIN community_comments c ON p.id = c.post_id
      JOIN users u ON p.user_id = u.id
      WHERE p.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY p.id
      ORDER BY p.created_at DESC
    `, [days]);
    
    res.json({
      posts,
      summary: {
        totalPosts: posts.length,
        dateRange: `Last ${days} days`
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

/**
 * GET /api/community/stats
 * Get community statistics for digest
 */
app.get('/api/community/stats', async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT 
        COUNT(DISTINCT p.id) as totalPosts,
        COUNT(DISTINCT p.user_id) as activeUsers,
        COUNT(DISTINCT u.id) as newMembers,
        MAX(p.likes) as topPostLikes
      FROM community_posts p
      JOIN users u ON p.user_id = u.id
      WHERE p.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      AND u.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
    `);
    
    res.json(stats[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ============================================
// USER ENDPOINTS
// ============================================

/**
 * GET /api/users/digest-subscribers
 * Get users who have subscribed to digest
 */
app.get('/api/users/digest-subscribers', async (req, res) => {
  try {
    const users = await db.query(`
      SELECT id, email, name, phone, language
      FROM users
      WHERE receive_digest = 1
      AND is_active = 1
      ORDER BY created_at DESC
    `);
    
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /api/users/missing-nutrition-logs
 * Get users who haven't logged nutrition today
 */
app.get('/api/users/missing-nutrition-logs', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const users = await db.query(`
      SELECT DISTINCT u.id, u.email, u.name, u.phone
      FROM users u
      WHERE u.is_active = 1
      AND u.receive_reminders = 1
      AND NOT EXISTS (
        SELECT 1 FROM nutrition_logs nl
        WHERE nl.user_id = u.id
        AND DATE(nl.created_at) = ?
      )
      ORDER BY u.created_at DESC
    `, [today]);
    
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

/**
 * GET /api/users/new-registered
 * Get newly registered users (last 24 hours)
 */
app.get('/api/users/new-registered', async (req, res) => {
  try {
    const users = await db.query(`
      SELECT id, email, name, phone, created_at
      FROM users
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
      ORDER BY created_at DESC
    `);
    
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ============================================
// NOTIFICATION LOGGING
// ============================================

/**
 * POST /api/notifications/log
 * Log a notification sent by N8N workflow
 */
app.post('/api/notifications/log', async (req, res) => {
  try {
    const { userId, type, channel, vaccineId, appointmentId, metadata } = req.body;
    
    await db.query(`
      INSERT INTO notification_logs (user_id, type, channel, vaccine_id, appointment_id, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [userId, type, channel, vaccineId || null, appointmentId || null, JSON.stringify(metadata || {})]);
    
    res.json({ success: true });
  } catch (err) {
    console.error('Error logging notification:', err);
    res.status(500).json({ error: 'Failed to log notification' });
  }
});

/**
 * GET /api/notifications/sent
 * Get notification logs
 */
app.get('/api/notifications/sent', async (req, res) => {
  try {
    const limit = req.query.limit || 100;
    const notifications = await db.query(`
      SELECT 
        nl.id,
        nl.user_id as userId,
        nl.type,
        nl.channel,
        nl.created_at as sentAt,
        u.name, u.email
      FROM notification_logs nl
      JOIN users u ON nl.user_id = u.id
      ORDER BY nl.created_at DESC
      LIMIT ?
    `, [parseInt(limit)]);
    
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// ============================================
// WEBHOOK FOR REAL-TIME TRIGGERS
// ============================================

/**
 * POST /api/webhooks/health-metric
 * Webhook triggered when health metric is logged
 * Forward to N8N for real-time alerts
 */
app.post('/api/webhooks/health-metric', async (req, res) => {
  try {
    // Trigger N8N workflow
    await fetch('http://localhost:5678/webhook/health-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    }).catch(err => console.log('N8N webhook failed:', err));
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

/**
 * POST /api/webhooks/appointment-booked
 * Webhook triggered when appointment is booked
 */
app.post('/api/webhooks/appointment-booked', async (req, res) => {
  try {
    await fetch('http://localhost:5678/webhook/appointment-confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    }).catch(err => console.log('N8N webhook failed:', err));
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

/**
 * POST /api/webhooks/user-registered
 * Webhook triggered when new user registers
 */
app.post('/api/webhooks/user-registered', async (req, res) => {
  try {
    await fetch('http://localhost:5678/webhook/user-onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    }).catch(err => console.log('N8N webhook failed:', err));
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process webhook' });
  }
});

module.exports = app;
