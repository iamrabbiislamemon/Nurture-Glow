import { query, pool } from '../src/db.js';
import { sendEmergencyNotifications } from '../src/services/emergencyNotificationService.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('🧪 RUNNING EMERGENCY MESSAGE PIPELINE SMOKE TEST\n');

async function test() {
  try {
    // 1. Check if the database has any emergency contact. 
    // If not, seed a temporary test user and emergency contact for the test duration.
    let userId = '4768b0a8-d480-4ebe-a281-eeae43c9c50d'; // Seeded demo mother
    
    const userExists = await query('SELECT id FROM users WHERE id = ? LIMIT 1', [userId]);
    
    if (!userExists.length) {
      console.log('ℹ️ Seeded demo mother user not found. Inserting temporary test user...');
      userId = 'test-mom-uuid-1234-5678-9000';
      
      // Ensure role exists or just insert user directly
      await query(
        `INSERT IGNORE INTO users (id, phone, email, role, status) 
         VALUES (?, '+8801999999999', 'test_mother@nurtureglow.com', 'mother', 'active')`,
        [userId]
      );
      
      await query(
        `INSERT IGNORE INTO user_profiles (user_id, full_name, gender) 
         VALUES (?, 'Test Mother Vitals', 'female')`,
        [userId]
      );
      
      await query(
        `INSERT IGNORE INTO emergency_contacts (id, user_id, contact_name, relationship, phone) 
         VALUES ('test-ec-id-1', ?, 'Rahim Karim', 'Husband', '+8801712345678')`,
        [userId]
      );
      
      console.log(`✅ Temporary test mother and emergency contact created. ID: ${userId}`);
    } else {
      console.log(`✅ Found seeded mother user. ID: ${userId}`);
      // Ensure she has an emergency contact
      const contactExists = await query('SELECT id FROM emergency_contacts WHERE user_id = ? LIMIT 1', [userId]);
      if (!contactExists.length) {
        console.log('ℹ️ Seeding emergency contact for demo mother...');
        await query(
          `INSERT INTO emergency_contacts (id, user_id, contact_name, relationship, phone) 
           VALUES ('test-ec-id-1', ?, 'Karim Uddin', 'Husband', '+8801712345678')`,
          [userId]
        );
      }
    }
    
    // 2. Trigger the Emergency Notifications
    console.log('\n🚀 Triggering emergency notifications service...');
    const result = await sendEmergencyNotifications(userId, {
      message: '🚨 CRITICAL WARNING from Nurture-Glow: Patient has reported high pain levels. Urgent follow up needed.',
      location: { lat: 23.7451, lng: 90.3756 }
    });
    
    console.log('📦 Return Result Summary:');
    console.log(JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('\n✅ TEST PASSED: Core emergency notification service executed successfully!');
    } else {
      console.error('\n❌ TEST FAILED: Service returned success: false', result.error);
    }
    
    // 3. Verify that the request was logged in MySQL table `emergency_requests`
    console.log('\n🔍 Verifying MySQL database records...');
    const dbLogs = await query(
      'SELECT id, user_id, location_lat, location_lng, status, created_at FROM emergency_requests WHERE id = ?',
      [result.requestId]
    );
    
    if (dbLogs.length > 0) {
      console.log(`✅ Database Log Verified! Found emergency_requests record:`);
      console.log(`   ID        : ${dbLogs[0].id}`);
      console.log(`   User ID   : ${dbLogs[0].user_id}`);
      console.log(`   Lat/Lng   : ${dbLogs[0].location_lat}, ${dbLogs[0].location_lng}`);
      console.log(`   Status    : ${dbLogs[0].status}`);
      console.log(`   Timestamp : ${dbLogs[0].created_at}`);
    } else {
      console.error('❌ Database Log Verification Failed: No matching record found in emergency_requests table.');
    }
    
    // 4. Clean up if temporary user was inserted
    if (userId === 'test-mom-uuid-1234-5678-9000') {
      console.log('\n🧹 Cleaning up temporary test records...');
      await query('DELETE FROM emergency_requests WHERE user_id = ?', [userId]);
      await query('DELETE FROM emergency_contacts WHERE user_id = ?', [userId]);
      await query('DELETE FROM user_profiles WHERE user_id = ?', [userId]);
      await query('DELETE FROM users WHERE id = ?', [userId]);
      console.log('✅ Temporary test records deleted.');
    }
    
  } catch (err) {
    console.error('\n❌ FATAL TEST ERROR:', err);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection pool closed.');
  }
}

test();
