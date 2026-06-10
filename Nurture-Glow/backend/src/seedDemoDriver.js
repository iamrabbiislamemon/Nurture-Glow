import { pool, query } from './db.js';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

async function seed() {
  const driverEmail = 'driver@nurtureglow.com';
  const driverPhone = '+8801712345679';
  const password = 'Password123!';
  
  console.log(`Checking for existing driver: ${driverEmail}`);
  const existing = await query('SELECT id FROM users WHERE email = ? LIMIT 1', [driverEmail]);

  let driverId;
  if (existing.length) {
    driverId = existing[0].id;
    console.log(`Driver user already exists with ID: ${driverId}`);
    // Update role to driver just in case
    await query("UPDATE users SET role = 'driver', status = 'active' WHERE id = ?", [driverId]);
  } else {
    driverId = uuidv4();
    console.log(`Creating driver user with ID: ${driverId}`);
    const hash = await bcrypt.hash(password, 12);
    const healthId = `NG-${driverId.slice(0, 8).toUpperCase()}`;

    await query(
      `INSERT INTO users (id, phone, email, password_hash, auth_provider, role, status, health_id)
       VALUES (?, ?, ?, ?, 'local', 'driver', 'active', ?)`,
      [driverId, driverPhone, driverEmail, hash, healthId]
    );

    await query(
      `INSERT INTO user_profiles (user_id, full_name, preferred_language)
       VALUES (?, 'Demo Ambulance Driver', 'en')`,
      [driverId]
    );
  }

  // Ensure ambulance_drivers record exists
  const driverRecords = await query('SELECT id FROM ambulance_drivers WHERE user_id = ? LIMIT 1', [driverId]);
  if (!driverRecords.length) {
    const ambId = uuidv4();
    console.log(`Creating ambulance_drivers record with ID: ${ambId}`);
    await query(
      `INSERT INTO ambulance_drivers (id, user_id, vehicle_number, is_available, rating, vehicle_type)
       VALUES (?, ?, 'NG-AMB-9999', TRUE, 4.95, 'Premium ICU Ambulance')`,
      [ambId, driverId]
    );
  } else {
    console.log(`Ambulance driver record already exists.`);
    await query(
      `UPDATE ambulance_drivers 
       SET is_available = TRUE, rating = 4.95, vehicle_type = 'Premium ICU Ambulance' 
       WHERE user_id = ?`,
      [driverId]
    );
  }

  console.log('🎉 Demo Driver seeding complete!');
  console.log(`Login credentials:\nEmail: ${driverEmail}\nPassword: ${password}`);
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
