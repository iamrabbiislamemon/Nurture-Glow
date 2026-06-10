import { query } from '../db.js';
import { createNotification, validateBangladeshPhone } from '../utils/index.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Send Emergency Notifications (SMS, WhatsApp, and In-App) to the user's emergency contact
 * @param {string} userId - The ID of the user triggering the emergency
 * @param {object} details - Custom notification details
 * @param {string} [details.message] - Custom message to send (optional)
 * @param {object} [details.location] - User's current location { lat, lng } (optional)
 * @returns {Promise<object>} Status summary of the notifications sent
 */
export async function sendEmergencyNotifications(userId, details = {}) {
  const { message: customMessage, location } = details;
  
  // 1. Fetch user's profile info
  const userRows = await query(
    `SELECT p.full_name, u.phone FROM users u 
     LEFT JOIN user_profiles p ON p.user_id = u.id 
     WHERE u.id = ? LIMIT 1`,
    [userId]
  );
  
  if (!userRows.length) {
    throw new Error('User not found');
  }
  
  const userName = userRows[0].full_name || 'Nurture-Glow User';
  const userPhone = userRows[0].phone || 'N/A';
  
  // 2. Fetch user's emergency contact
  const contactRows = await query(
    'SELECT contact_name, phone, relationship FROM emergency_contacts WHERE user_id = ? LIMIT 1',
    [userId]
  );
  
  if (!contactRows.length) {
    return {
      success: false,
      error: 'No emergency contact registered for this user'
    };
  }
  
  const contact = contactRows[0];
  const contactName = contact.contact_name || 'Emergency Contact';
  const contactRelation = contact.relationship || 'Contact';
  const rawContactPhone = contact.phone || '';
  
  // 3. Validate contact phone number (Bangladesh number validation check)
  const validationResult = validateBangladeshPhone(rawContactPhone);
  if (!validationResult.ok) {
    return {
      success: false,
      error: `Invalid emergency contact phone number format: ${rawContactPhone}. Error: ${validationResult.error}`
    };
  }
  
  // Normalize the phone number format for Twilio (requires E.164, e.g., +88017XXXXXXXX)
  let normalizedPhone = rawContactPhone.replace(/[\s\-()]/g, '');
  if (normalizedPhone.startsWith('01')) {
    normalizedPhone = '+88' + normalizedPhone;
  } else if (normalizedPhone.startsWith('8801')) {
    normalizedPhone = '+' + normalizedPhone;
  }
  
  // 4. Construct default message template if none provided
  const finalMessage = customMessage || 
    `🚨 EMERGENCY ALERT from Nurture-Glow: ${userName} (${userPhone}) has triggered an emergency alert. Please contact them immediately. Relationship: ${contactRelation}.`;

  // 5. Send In-App Notification
  let inAppNotificationStatus = 'FAILED';
  try {
    await createNotification(userId, {
      type: 'EMERGENCY_ALERT_SENT',
      title: 'Emergency Contact Notified',
      message: `An emergency alert was sent to your contact ${contactName} (${normalizedPhone}).`,
      link: '/profile'
    });
    inAppNotificationStatus = 'SENT';
  } catch (err) {
    console.error('Failed to create in-app notification:', err.message);
  }
  
  // 6. Log Emergency Request to database
  let dbLogStatus = 'FAILED';
  const requestId = uuidv4();
  try {
    await query(
      `INSERT INTO emergency_requests 
       (id, user_id, location_lat, location_lng, destination_hospital_id, ambulance_id, status, created_at) 
       VALUES (?, ?, ?, ?, NULL, NULL, 'triggered', CURRENT_TIMESTAMP)`,
      [
        requestId, 
        userId, 
        location?.lat ? parseFloat(location.lat) : null, 
        location?.lng ? parseFloat(location.lng) : null
      ]
    );
    dbLogStatus = 'SAVED';
  } catch (err) {
    console.error('Failed to insert emergency request into DB:', err.message);
  }

  // 7. Twilio Settings & Delivery Configuration
  const {
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_SMS_FROM,
    TWILIO_WHATSAPP_FROM
  } = process.env;
  
  const isTwilioConfigured = TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN;
  const results = {
    success: true,
    requestId,
    contact: {
      name: contactName,
      phone: normalizedPhone,
      relation: contactRelation
    },
    sms: { status: 'PENDING', details: '' },
    whatsapp: { status: 'PENDING', details: '' },
    inAppNotification: inAppNotificationStatus,
    databaseLog: dbLogStatus
  };

  // Helper to trigger Twilio API natively via fetch
  const sendTwilioMessage = async (to, from, body, isWhatsApp = false) => {
    const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    const authString = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    
    const formattedTo = isWhatsApp ? `whatsapp:${to}` : to;
    const formattedFrom = isWhatsApp ? `whatsapp:${from}` : from;
    
    const params = new URLSearchParams();
    params.append('To', formattedTo);
    params.append('From', formattedFrom);
    params.append('Body', body);
    
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });
    
    const responseData = await response.json();
    if (!response.ok) {
      throw new Error(responseData.message || `HTTP error ${response.status}`);
    }
    return responseData;
  };

  // 8. Dispatch SMS & WhatsApp
  if (isTwilioConfigured) {
    // A. Send SMS
    if (TWILIO_SMS_FROM) {
      try {
        const smsData = await sendTwilioMessage(normalizedPhone, TWILIO_SMS_FROM, finalMessage, false);
        results.sms = { status: 'SENT', details: `Sid: ${smsData.sid}` };
      } catch (err) {
        console.error('Twilio SMS delivery failed:', err.message);
        results.sms = { status: 'FAILED', details: err.message };
      }
    } else {
      results.sms = { status: 'SKIPPED', details: 'TWILIO_SMS_FROM env variable not configured' };
    }

    // B. Send WhatsApp
    if (TWILIO_WHATSAPP_FROM) {
      try {
        const waData = await sendTwilioMessage(normalizedPhone, TWILIO_WHATSAPP_FROM, finalMessage, true);
        results.whatsapp = { status: 'SENT', details: `Sid: ${waData.sid}` };
      } catch (err) {
        console.error('Twilio WhatsApp delivery failed:', err.message);
        results.whatsapp = { status: 'FAILED', details: err.message };
      }
    } else {
      results.whatsapp = { status: 'SKIPPED', details: 'TWILIO_WHATSAPP_FROM env variable not configured' };
    }
  } else {
    // 9. Mock Mode (Print to console)
    results.sms = { status: 'MOCKED_SENT', details: 'Twilio credentials not found. Message printed to server log.' };
    results.whatsapp = { status: 'MOCKED_SENT', details: 'Twilio credentials not found. Message printed to server log.' };
    
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🚨 EMERGENCY ALERT CHANNELS SIMULATED (MOCK MODE)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`👤 Triggered By User: ${userName} (${userPhone})`);
    console.log(`📞 Target Contact   : ${contactName} (${normalizedPhone}) [Relation: ${contactRelation}]`);
    console.log(`📝 Text Message     : "${finalMessage}"`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✉️  [MOCK SMS]      : Dispatching standard text SMS via BD gateway carrier...');
    console.log('💬  [MOCK WHATSAPP] : Dispatching WhatsApp template notification...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  }

  return results;
}
