# Backend Implementation Checklist - System Admin Features

## Quick Start: What Backend Needs to Do

The frontend is 100% ready with real-time infrastructure. Backend needs to:
1. Create WebSocket server
2. Implement API routes
3. Create database tables
4. Connect everything together

---

## Phase 1: Database Setup

### ✅ Verify Existing Tables
```sql
-- These tables should already exist from schema
SELECT * FROM users; -- Should have 'status' column
SELECT * FROM security_events;

-- Verify columns exist:
-- users: id, role, status, created_at
-- security_events: event_type, severity, user_id, ip_address, created_at
```

### ⚙️ Create New Tables

```sql
-- System Messages Table
CREATE TABLE IF NOT EXISTS system_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  content LONGTEXT NOT NULL,
  severity ENUM('info', 'warning', 'error') DEFAULT 'info',
  broadcast_to ENUM('all_users', 'specific_role', 'specific_user') DEFAULT 'all_users',
  target_role VARCHAR(50),
  target_user_id INT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id),
  FOREIGN KEY (target_user_id) REFERENCES users(id),
  INDEX idx_created_at (created_at DESC),
  INDEX idx_broadcast_to (broadcast_to)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- System Settings Table
CREATE TABLE IF NOT EXISTS system_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  key VARCHAR(255) UNIQUE NOT NULL,
  value LONGTEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_key (key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Admin Actions Audit Trail
CREATE TABLE IF NOT EXISTS admin_actions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admin_user_id INT NOT NULL,
  action_type VARCHAR(100) NOT NULL,
  description TEXT,
  result ENUM('success', 'failure', 'pending') DEFAULT 'pending',
  details JSON,
  ip_address VARCHAR(45),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (admin_user_id) REFERENCES users(id),
  INDEX idx_admin_id (admin_user_id),
  INDEX idx_timestamp (timestamp DESC),
  INDEX idx_action_type (action_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- IP Blacklist Table
CREATE TABLE IF NOT EXISTS ip_blacklist (
  id INT PRIMARY KEY AUTO_INCREMENT,
  ip_address VARCHAR(45) UNIQUE NOT NULL,
  reason TEXT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  FOREIGN KEY (created_by) REFERENCES users(id),
  INDEX idx_ip_address (ip_address),
  INDEX idx_created_at (created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- System Metrics Table
CREATE TABLE IF NOT EXISTS system_metrics (
  id INT PRIMARY KEY AUTO_INCREMENT,
  metric_type VARCHAR(50) NOT NULL,
  metric_value DECIMAL(10, 2),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  details JSON,
  INDEX idx_metric_type (metric_type),
  INDEX idx_timestamp (timestamp DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

**Status After Phase 1**: Tables ready for data

---

## Phase 2: WebSocket Server

### Create WebSocket Server File
**File**: `backend/src/websocket-server.js`

```javascript
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const db = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

class WebSocketServer {
  constructor(server) {
    this.wss = new WebSocket.Server({ server });
    this.connectedClients = new Map(); // userId -> { ws, role, connectedAt }
    this.setupWebSocket();
  }

  setupWebSocket() {
    this.wss.on('connection', this.handleConnection.bind(this));
  }

  handleConnection(ws, req) {
    try {
      // Extract token from URL
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');

      if (!token) {
        ws.close(1008, 'No token provided');
        return;
      }

      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET);
      const userId = decoded.userId || decoded.sub;
      const userRole = decoded.role;

      if (!userId) {
        ws.close(1008, 'Invalid token');
        return;
      }

      // Store client connection
      this.connectedClients.set(userId, {
        ws,
        userId,
        userRole,
        connectedAt: new Date()
      });

      console.log(`[WebSocket] User ${userId} (role: ${userRole}) connected`);

      // Handle messages from client
      ws.on('message', (data) => {
        this.handleClientMessage(userId, data);
      });

      // Handle disconnect
      ws.on('close', () => {
        this.connectedClients.delete(userId);
        console.log(`[WebSocket] User ${userId} disconnected`);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error(`[WebSocket] Error for user ${userId}:`, error);
      });

    } catch (error) {
      console.error('[WebSocket] Connection error:', error);
      ws.close(1008, 'Unauthorized');
    }
  }

  handleClientMessage(userId, data) {
    try {
      const message = JSON.parse(data);
      console.log(`[WebSocket] Message from user ${userId}:`, message.type);
      // Can add client-to-client messaging here if needed
    } catch (error) {
      console.error('Error parsing client message:', error);
    }
  }

  broadcast(payload) {
    const {
      type,
      data,
      broadcastTo,
      targetRole,
      targetUserId
    } = payload;

    const message = JSON.stringify({
      type,
      data,
      broadcastTo,
      targetRole,
      targetUserId,
      timestamp: new Date().toISOString()
    });

    let sentCount = 0;

    // Send to matching clients
    this.connectedClients.forEach((client, userId) => {
      let shouldSend = false;

      if (broadcastTo === 'all_users') {
        shouldSend = true;
      } else if (broadcastTo === 'specific_role') {
        shouldSend = (client.userRole === targetRole);
      } else if (broadcastTo === 'specific_user') {
        shouldSend = (userId === parseInt(targetUserId));
      }

      if (shouldSend && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
        sentCount++;
      }
    });

    console.log(`[WebSocket] Broadcast ${type} to ${sentCount} users`);
    return sentCount;
  }

  getConnectedCount() {
    return this.connectedClients.size;
  }

  getConnectionInfo() {
    return Array.from(this.connectedClients.values()).map(client => ({
      userId: client.userId,
      userRole: client.userRole,
      connectedAt: client.connectedAt
    }));
  }
}

module.exports = WebSocketServer;
```

### Initialize in Express App
**File**: `backend/src/app.js` or `backend/src/server.js`

```javascript
const express = require('express');
const http = require('http');
const WebSocketServer = require('./websocket-server');

const app = express();
const server = http.createServer(app);

// Initialize WebSocket
const wsServer = new WebSocketServer(server);

// Make available to routes
app.locals.wsServer = wsServer;

// Mount routes
app.use('/api/admin', require('./adminRoutes'));

// WebSocket endpoint (handled by WebSocketServer)
server.listen(3000, () => {
  console.log('Server running on port 3000');
  console.log('WebSocket ready at /ws');
});

module.exports = app;
```

**Status After Phase 2**: WebSocket server broadcasting ready

---

## Phase 3: API Routes

### Update `backend/src/adminRoutes.js`

Add these routes (or update existing ones):

```javascript
const express = require('express');
const router = express.Router();
const db = require('./database');
const { requireAuth, requireRole } = require('./middleware');

// ===========================
// SYSTEM MESSAGES ROUTES
// ===========================

// POST /api/admin/system/messages - Send message
router.post('/system/messages', requireAuth, requireRole('system_admin'), async (req, res) => {
  try {
    const { title, content, severity, broadcast_to, target_role, target_user_id } = req.body;
    const adminUserId = req.user.id;

    // Validation
    if (!title || !content) {
      return res.status(400).json({ error: 'Title and content required' });
    }

    // Insert into database
    const query = `
      INSERT INTO system_messages 
      (title, content, severity, broadcast_to, target_role, target_user_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await db.execute(query, [
      title,
      content,
      severity || 'info',
      broadcast_to,
      target_role || null,
      target_user_id || null,
      adminUserId
    ]);

    const messageId = result.insertId;

    // Log admin action
    await logAdminAction(adminUserId, 'sent_message', `Sent: "${title}"`, 'success', {
      messageId,
      broadcast_to,
      severity
    });

    // Broadcast via WebSocket
    const wsServer = req.app.locals.wsServer;
    if (wsServer) {
      wsServer.broadcast({
        type: 'system_message',
        data: {
          id: messageId,
          title,
          content,
          severity,
          broadcast_to,
          target_role,
          created_by: req.user.email,
          created_at: new Date().toISOString()
        },
        broadcastTo: broadcast_to,
        targetRole: target_role,
        targetUserId: target_user_id
      });
    }

    res.json({ id: messageId, message: 'Message sent successfully' });

  } catch (error) {
    console.error('Failed to send message:', error);
    
    // Log failure
    await logAdminAction(req.user.id, 'sent_message', error.message, 'failure');
    
    res.status(500).json({ error: error.message });
  }
});

// GET /api/admin/system/messages - Get messages
router.get('/system/messages', requireAuth, requireRole('system_admin'), async (req, res) => {
  try {
    const limit = req.query.limit || 50;
    
    const query = `
      SELECT 
        sm.*,
        u.email as created_by_email
      FROM system_messages sm
      LEFT JOIN users u ON sm.created_by = u.id
      ORDER BY sm.created_at DESC
      LIMIT ?
    `;

    const messages = await db.query(query, [parseInt(limit)]);

    // Format response
    const formatted = messages.map(m => ({
      ...m,
      created_by: m.created_by_email
    }));

    res.json(formatted);

  } catch (error) {
    console.error('Failed to fetch messages:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===========================
// SYSTEM SETTINGS ROUTES
// ===========================

// GET /api/admin/system/settings - Get all settings
router.get('/system/settings', requireAuth, requireRole('system_admin'), async (req, res) => {
  try {
    const query = `SELECT key, value FROM system_settings ORDER BY key`;
    const settings = await db.query(query);
    res.json(settings);
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// PATCH /api/admin/system/settings - Update settings
router.patch('/system/settings', requireAuth, requireRole('system_admin'), async (req, res) => {
  try {
    const { settings } = req.body;
    const adminUserId = req.user.id;

    if (!Array.isArray(settings)) {
      return res.status(400).json({ error: 'Settings must be an array' });
    }

    // Update each setting
    for (const setting of settings) {
      const query = `
        INSERT INTO system_settings (key, value)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()
      `;
      await db.execute(query, [setting.key, setting.value, setting.value]);
    }

    // Log action
    await logAdminAction(adminUserId, 'updated_settings', 
      `Updated ${settings.length} settings`, 'success');

    // Broadcast update
    const wsServer = req.app.locals.wsServer;
    if (wsServer) {
      wsServer.broadcast({
        type: 'settings_update',
        data: { settings },
        broadcastTo: 'all_users'
      });
    }

    res.json({ message: 'Settings updated successfully' });

  } catch (error) {
    console.error('Failed to update settings:', error);
    await logAdminAction(req.user.id, 'updated_settings', error.message, 'failure');
    res.status(500).json({ error: error.message });
  }
});

// ===========================
// MONITORING ROUTES
// ===========================

// POST /api/admin/system/maintenance - Toggle maintenance mode
router.post('/system/maintenance', requireAuth, requireRole('system_admin'), async (req, res) => {
  try {
    const { enabled, message } = req.body;
    const adminUserId = req.user.id;

    // Update settings
    await db.execute(
      'INSERT INTO system_settings (key, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()',
      ['maintenance_mode', enabled ? 'true' : 'false', enabled ? 'true' : 'false']
    );

    if (message) {
      await db.execute(
        'INSERT INTO system_settings (key, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()',
        ['maintenance_message', message, message]
      );
    }

    // Log action
    await logAdminAction(adminUserId, 'maintenance_mode_' + (enabled ? 'enabled' : 'disabled'), 
      message || '', 'success');

    // Broadcast
    const wsServer = req.app.locals.wsServer;
    if (wsServer) {
      wsServer.broadcast({
        type: 'maintenance_mode',
        data: { enabled, message },
        broadcastTo: 'all_users'
      });
    }

    res.json({ message: 'Maintenance mode updated' });

  } catch (error) {
    console.error('Maintenance mode error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===========================
// HELPER FUNCTIONS
// ===========================

async function logAdminAction(adminUserId, actionType, description, result, details = {}) {
  try {
    const query = `
      INSERT INTO admin_actions 
      (admin_user_id, action_type, description, result, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    
    await db.execute(query, [
      adminUserId,
      actionType,
      description,
      result,
      JSON.stringify(details),
      null // Add IP if needed
    ]);
  } catch (error) {
    console.error('Failed to log admin action:', error);
  }
}

module.exports = router;
```

**Status After Phase 3**: API routes ready to handle system admin operations

---

## Phase 4: Integration Testing

### Test 1: WebSocket Connection
```bash
# Terminal 1: Start backend
npm start

# Terminal 2: Check connection
curl -i -N \
  -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  http://localhost:3000/ws?token=YOUR_JWT_TOKEN
```

### Test 2: Send Message via API
```bash
curl -X POST http://localhost:3000/api/admin/system/messages \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "Test Message",
    "content": "This is a test",
    "severity": "info",
    "broadcast_to": "all_users"
  }'
```

### Test 3: Verify Database Persistence
```bash
# In MySQL client
SELECT * FROM system_messages;
SELECT * FROM admin_actions WHERE action_type = 'sent_message';
```

### Test 4: Check WebSocket Broadcast
1. Open admin dashboard in browser
2. Open DevTools → Network → WS filter
3. Should see `/ws` connection
4. Send message via API or admin dashboard
5. Should see WebSocket message received in Network tab
6. Message should appear in "Recent Messages" tab

---

## Phase 5: Production Deployment

### Environment Variables
```bash
JWT_SECRET=your-secret-key
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=password
DB_NAME=nurture_glow
WS_PORT=8080
```

### Health Checks
```javascript
// Health endpoint
app.get('/health', (req, res) => {
  const wsConnections = req.app.locals.wsServer.getConnectedCount();
  res.json({
    status: 'healthy',
    database: 'connected',
    websocket: `${wsConnections} users connected`
  });
});
```

### Monitoring
- [ ] Log all WebSocket connections/disconnections
- [ ] Monitor message delivery rate
- [ ] Track database insert latency
- [ ] Alert on failed broadcasts
- [ ] Monitor admin_actions table growth

---

## Common Issues & Solutions

### WebSocket Not Broadcasting
**Problem**: Messages not reaching clients
**Solution**:
```javascript
// Ensure wsServer is passed to routes
app.locals.wsServer = wsServer;

// Check WebSocket is initialized
console.log('Connected clients:', wsServer.getConnectedCount());

// Verify broadcast method called
wsServer.broadcast({ type: 'test', data: {} });
```

### Database Inserts Slow
**Problem**: Message taking too long to save
**Solution**:
```sql
-- Add indexes
ALTER TABLE system_messages ADD INDEX idx_created_at (created_at DESC);
ALTER TABLE admin_actions ADD INDEX idx_admin_id (admin_user_id);

-- Use connection pooling
const pool = mysql.createPool({ connectionLimit: 10 });
```

### Clients Not Receiving WebSocket Messages
**Problem**: Connected but no messages
**Solution**:
1. Check token is valid JWT
2. Verify role extracted correctly
3. Check broadcast_to and role matching logic
4. Check client subscription setup
5. Check for firewall blocking WebSocket

---

## Quick Reference: Required Implementations

| Item | Status | File |
|------|--------|------|
| WebSocket Server | ⚙️ | `backend/src/websocket-server.js` |
| POST /system/messages | ⚙️ | `backend/src/adminRoutes.js` |
| GET /system/messages | ⚙️ | `backend/src/adminRoutes.js` |
| PATCH /system/settings | ⚙️ | `backend/src/adminRoutes.js` |
| GET /system/settings | ⚙️ | `backend/src/adminRoutes.js` |
| POST /system/maintenance | ⚙️ | `backend/src/adminRoutes.js` |
| Database tables | ⚙️ | Create from SQL above |
| Admin action logging | ⚙️ | `adminRoutes.js` |
| Broadcasting logic | ⚙️ | `websocket-server.js` |

---

## Estimated Implementation Time

- WebSocket Server: 2 hours
- API Routes: 2 hours
- Database Setup: 30 minutes
- Testing: 2 hours
- **Total: ~6.5 hours**

---

## Success Criteria

✅ Admin can send message via dashboard
✅ Message persisted to system_messages table
✅ Admin action logged in admin_actions table
✅ All target users receive WebSocket broadcast
✅ Message appears on recipient dashboards instantly
✅ No page refresh needed
✅ Audit trail complete
✅ Error handling works
✅ WebSocket reconnects on disconnect
✅ Settings changes broadcast platform-wide

---

**Ready to implement?** Start with Phase 1 (Database), then move to Phase 2 (WebSocket), then Phase 3 (Routes). Test at each phase!
