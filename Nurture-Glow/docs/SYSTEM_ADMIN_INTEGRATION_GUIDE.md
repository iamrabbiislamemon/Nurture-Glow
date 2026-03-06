# System Admin Features - Quick Integration Guide

## What Was Implemented

Three new services provide complete System Admin functionality with real-time database updates and live synchronization:

1. **systemAdminFeatures.ts** - API service for all admin operations
2. **realtimeUpdateService.ts** - WebSocket real-time updates  
3. **SystemAdminDashboard.tsx** - 4-tab admin dashboard UI

## How Real-time Updates Work

### The Flow
```
System Admin Changes Setting
         ↓
Frontend calls systemAdminFeatures.settings.update()
         ↓
API POST to /api/admin/system/settings
         ↓
Backend updates database table: system_settings
         ↓
Backend logs to admin_actions table for audit trail
         ↓
Backend broadcasts via WebSocket: { type: 'settings_update', data: newSettings }
         ↓
All affected users' clients receive WebSocket message
         ↓
Message filtered by role/user ID
         ↓
UI updates instantly WITHOUT page refresh
         ↓
All users see the change in real-time
```

## Key Features

### 1. System Messages
- Send broadcasts to all users, specific roles, or specific users
- Severity levels: info, warning, error
- Message history displayed with creator and timestamp
- Messages persist to database and broadcast in real-time

### 2. System Settings
- Centralized configuration management
- Changes broadcast to all running instances instantly
- Maintenance mode with custom message display
- All changes persisted to system_settings table

### 3. System Monitoring
- Real-time dashboard metrics
- System health status (CPU, memory, disk, API response)
- Active connection tracking
- Performance metrics (uptime %, response time)

### 4. User Management
- Suspend/reactivate accounts instantly
- Force password reset
- Change user roles
- Kick users offline (terminate sessions)
- User activity logs for each account

### 5. Security Management
- Security event logging and filtering
- IP blacklist/whitelist
- Security incident resolution tracking
- Attack pattern detection support

### 6. Backup & Recovery
- Automated backup creation
- Backup listing and restoration
- Backup download for external storage

## Database Tables Required

```sql
-- System Messages
CREATE TABLE system_messages (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  severity ENUM('info', 'warning', 'error'),
  broadcast_to ENUM('all_users', 'specific_role', 'specific_user'),
  target_role VARCHAR(50),
  target_user_id INT,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System Settings
CREATE TABLE system_settings (
  id INT PRIMARY KEY AUTO_INCREMENT,
  key VARCHAR(255) UNIQUE NOT NULL,
  value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Admin Actions (Audit Trail)
CREATE TABLE admin_actions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  admin_user_id INT NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  description TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  result VARCHAR(50),
  details JSON,
  FOREIGN KEY (admin_user_id) REFERENCES users(id)
);
```

## API Endpoints Needed

### Messages
```
POST /api/admin/system/messages
  Body: { title, content, severity, broadcast_to, target_role?, target_user_id? }
  Response: { id, message: "Message sent successfully" }

GET /api/admin/system/messages?limit=50
  Response: [{ id, title, content, severity, broadcast_to, created_by, created_at }, ...]
```

### Settings
```
GET /api/admin/system/settings
  Response: [{ key, value }, ...]

PATCH /api/admin/system/settings
  Body: { settings: [{ key, value }, ...] }
  Response: { message: "Settings updated" }
```

### Monitoring
```
GET /api/admin/system/health
  Response: { uptime, activeConnections, responseTime, status: 'healthy' }

POST /api/admin/system/maintenance
  Body: { enabled: boolean, message?: string }
  Response: { message: "Maintenance mode updated" }
```

## WebSocket Implementation

### Connect
```javascript
// Client already implements this in realtimeUpdateService
const ws = new WebSocket('ws://server/ws?token=' + authToken);

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  // message.type: 'dashboard_update', 'system_message', 'security_alert', etc.
  // message.data: the actual update data
  // message.broadcastTo: 'all_users', 'specific_role', 'specific_user'
};
```

### Server Broadcasting
```javascript
// Backend example
const usersToNotify = getRoleUsers('donor'); // Get all users with donor role
usersToNotify.forEach(user => {
  sendWebSocketMessage(user, {
    type: 'system_message',
    data: newMessage,
    broadcastTo: 'specific_role',
    target_role: 'donor'
  });
});
```

## Usage in Components

### Subscribe to Real-time Updates
```typescript
import { realtimeUpdateService } from '@/services/realtimeUpdateService';

useEffect(() => {
  // Connect to WebSocket
  await realtimeUpdateService.connect();
  
  // Subscribe to specific message types
  const unsubscribe = realtimeUpdateService.subscribe('system_message', (data) => {
    console.log('New message:', data);
    // Update your component state
  });

  return () => {
    unsubscribe();
    realtimeUpdateService.disconnect();
  };
}, []);
```

### Send Admin Actions
```typescript
import { systemAdminFeatures } from '@/services/systemAdminFeatures';

// Send message
await systemAdminFeatures.messages.send({
  title: 'Important Update',
  content: 'System will be down for maintenance',
  severity: 'warning',
  broadcast_to: 'all_users'
});

// Update settings
await systemAdminFeatures.settings.update([
  { key: 'maintenance_mode', value: 'true' },
  { key: 'maintenance_message', value: 'Down for 2 hours' }
]);

// Suspend user
await systemAdminFeatures.users.suspend('user-id', 'Suspicious activity', 7);
```

## Testing Scenario: Broadcast Message to All Donors

1. **System Admin Dashboard → Messages Tab**
   - Title: "New Donation Request"
   - Content: "O positive blood needed urgently"
   - Severity: "warning"
   - Broadcast To: "Specific Role"
   - Target Role: "donor"
   - Click "Send Message"

2. **Frontend Action**
   - `handleSendMessage()` validates form
   - Calls `systemAdminFeatures.messages.send()` with data

3. **Backend Processing**
   - Saves message to `system_messages` table
   - Logs action in `admin_actions` table
   - Queries all users where role = 'donor'
   - Broadcasts via WebSocket to those users

4. **Message Delivered**
   - All logged-in donor users receive WebSocket message
   - `realtimeUpdateService` receives and filters (role matches)
   - Callback executes and adds message to Recent Messages
   - UI updates without refresh
   - Donors see notification immediately

5. **Verification**
   - Message appears in "Recent Messages" list
   - All donor users see it simultaneously
   - Audit log shows admin action with timestamp
   - Database records message persistently

## Security Considerations

- ✅ All routes protected by `requireAuth` and `requireRole('system_admin')`
- ✅ JWT token validation on WebSocket connect
- ✅ Every action logged to admin_actions with admin_id
- ✅ Input validation and sanitization required on backend
- ✅ Rate limiting on message sending
- ✅ Message content length limits
- ✅ Role names validated against allowed roles
- ✅ User IDs validated before targeted messages

## Troubleshooting

### WebSocket Not Connecting
- Check browser console for connection errors
- Verify backend WebSocket server at `/ws` route
- Check authorization token is being passed
- Verify firewall allows WebSocket connections

### Messages Not Broadcasting
- Check backend is emitting WebSocket messages
- Verify message type matches subscription
- Check role/user ID filtering logic
- Look for errors in admin_actions table

### Real-time Sync Failing
- Check network tab for API responses
- Verify database updates are persisting
- Check for console errors in browser
- Review backend logs for WebSocket errors

### Database Errors
- Verify all tables exist (see schema above)
- Check table column names and types match API
- Verify foreign key relationships
- Check database user has appropriate permissions

## Performance Notes

- Message limit: 50 by default (configurable)
- Settings fetched on connect (cached locally)
- WebSocket reconnect: exponential backoff (3s, 6s, 12s, 24s, 48s, max 5 attempts)
- Security logs: most recent 5 shown in overview tab
- Scrollable lists: max-height 600px to prevent lag
- Debounce settings updates on rapid changes

## Migration Notes

If updating existing System Admin Dashboard:
- Old dashboard code backed up to SystemAdminDashboard_OLD.tsx
- Tab-based interface replaces single-view layout
- All existing data structures compatible
- API endpoints use same paths (just enhanced)
- Database schema compatible (new tables, existing tables unchanged)

---

**Status**: All frontend complete. Awaiting backend implementation of WebSocket server and API endpoints.
