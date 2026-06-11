import { v4 as uuidv4 } from 'uuid';
import { query, withTransaction } from '../src/db.js';

const mockDoctors = [
  {
    fullName: 'Dr. Sarah Rahman',
    email: 'sarah@nurtureglow.com',
    phone: '+8801700000101',
    specialtyId: 6, // Gynecologist
    fee: 800.00,
    rating: 4.8,
    hospital: 'Square Hospital',
    bio: 'Dr. Sarah is an expert Gynecologist with over 10 years of experience in high-risk pregnancies and prenatal care.',
    slots: [
      { day: 'Sunday', start: '09:00:00', end: '12:00:00' },
      { day: 'Tuesday', start: '14:00:00', end: '17:00:00' }
    ]
  },
  {
    fullName: 'Dr. Nafis Iqbal',
    email: 'nafis@nurtureglow.com',
    phone: '+8801700000102',
    specialtyId: 7, // Pediatrician
    fee: 700.00,
    rating: 4.7,
    hospital: 'Evercare Hospital',
    bio: 'Dr. Nafis is a dedicated Pediatrician specializing in neonatal care, infant nutrition, and childhood development.',
    slots: [
      { day: 'Monday', start: '10:00:00', end: '13:00:00' },
      { day: 'Thursday', start: '14:00:00', end: '17:00:00' }
    ]
  },
  {
    fullName: 'Dr. Tasnim Ara',
    email: 'tasnim@nurtureglow.com',
    phone: '+8801700000103',
    specialtyId: 8, // Nutritionist
    fee: 500.00,
    rating: 4.6,
    hospital: 'Dhaka Medical College',
    bio: 'Dr. Tasnim is a skilled Nutritionist with expertise in prenatal diets, gestational diabetes management, and postpartum recovery.',
    slots: [
      { day: 'Tuesday', start: '09:00:00', end: '12:00:00' },
      { day: 'Wednesday', start: '14:00:00', end: '17:00:00' }
    ]
  },
  {
    fullName: 'Dr. Mehdi Hasan',
    email: 'mehdi@nurtureglow.com',
    phone: '+8801700000104',
    specialtyId: 2, // Cardiology
    fee: 1000.00,
    rating: 4.9,
    hospital: 'Square Hospital',
    bio: 'Dr. Mehdi specializes in maternal cardiology, monitoring heart health during pregnancy and managing pre-existing cardiac conditions.',
    slots: [
      { day: 'Monday', start: '09:00:00', end: '12:00:00' },
      { day: 'Wednesday', start: '09:00:00', end: '12:00:00' }
    ]
  },
  {
    fullName: 'Dr. Farhana Chowdhury',
    email: 'farhana@nurtureglow.com',
    phone: '+8801700000105',
    specialtyId: 6, // Gynecologist
    fee: 900.00,
    rating: 4.85,
    hospital: 'Evercare Hospital',
    bio: 'Dr. Farhana is a leading obstetrician and Gynecologist focused on gentle birthing practices and maternal wellness.',
    slots: [
      { day: 'Wednesday', start: '10:00:00', end: '14:00:00' },
      { day: 'Saturday', start: '15:00:00', end: '18:00:00' }
    ]
  },
  {
    fullName: 'Dr. Riad Morshed',
    email: 'riad@nurtureglow.com',
    phone: '+8801700000106',
    specialtyId: 7, // Pediatrician
    fee: 600.00,
    rating: 4.5,
    hospital: 'Dhaka Medical College',
    bio: 'Dr. Riad is a passionate pediatrician providing comprehensive care from infancy through adolescence.',
    slots: [
      { day: 'Tuesday', start: '13:00:00', end: '16:00:00' },
      { day: 'Thursday', start: '10:00:00', end: '13:00:00' }
    ]
  },
  {
    fullName: 'Dr. Sayed Ahmed',
    email: 'sayed@nurtureglow.com',
    phone: '+8801700000107',
    specialtyId: 5, // Dermatology
    fee: 800.00,
    rating: 4.75,
    hospital: 'Square Hospital',
    bio: 'Dr. Sayed offers expert dermatological care for pregnancy-related skin conditions, eczema, and pediatric dermatology.',
    slots: [
      { day: 'Sunday', start: '14:00:00', end: '17:00:00' },
      { day: 'Thursday', start: '09:00:00', end: '12:00:00' }
    ]
  },
  {
    fullName: 'Dr. Tanjina Islam',
    email: 'tanjina@nurtureglow.com',
    phone: '+8801700000108',
    specialtyId: 9, // Psychologist
    fee: 1200.00,
    rating: 4.9,
    hospital: 'Evercare Hospital',
    bio: 'Dr. Tanjina is a compassionate psychologist specializing in perinatal depression, maternal anxiety, and postpartum mental wellness.',
    slots: [
      { day: 'Monday', start: '14:00:00', end: '18:00:00' },
      { day: 'Thursday', start: '14:00:00', end: '18:00:00' }
    ]
  },
  {
    fullName: 'Dr. Kamal Uddin',
    email: 'kamal@nurtureglow.com',
    phone: '+8801700000109',
    specialtyId: 1, // General Medicine
    fee: 400.00,
    rating: 4.6,
    hospital: 'Dhaka Medical College',
    bio: 'Dr. Kamal is a general physician handling common illnesses, cold, fever, and general health checkups for the family.',
    slots: [
      { day: 'Sunday', start: '10:00:00', end: '13:00:00' },
      { day: 'Wednesday', start: '10:00:00', end: '13:00:00' }
    ]
  },
  {
    fullName: 'Dr. Nabila Rahman',
    email: 'nabila@nurtureglow.com',
    phone: '+8801700000110',
    specialtyId: 6, // Gynecologist
    fee: 750.00,
    rating: 4.7,
    hospital: 'Square Hospital',
    bio: 'Dr. Nabila provides caring prenatal and postnatal consultations, helping mothers navigate their pregnancy journey safely.',
    slots: [
      { day: 'Monday', start: '09:00:00', end: '12:00:00' },
      { day: 'Tuesday', start: '14:00:00', end: '17:00:00' }
    ]
  },
  {
    fullName: 'Dr. Sajjad Hossain',
    email: 'sajjad@nurtureglow.com',
    phone: '+8801700000111',
    specialtyId: 2, // Cardiology
    fee: 1100.00,
    rating: 4.8,
    hospital: 'Evercare Hospital',
    bio: 'Dr. Sajjad is an experienced cardiologist focusing on adult and maternal cardiac assessments.',
    slots: [
      { day: 'Tuesday', start: '09:00:00', end: '12:00:00' },
      { day: 'Thursday', start: '13:00:00', end: '16:00:00' }
    ]
  }
];

async function seed() {
  const passHash = '$2a$12$/yvVYWkGYXzaZdJNxYRr4uCrFQmcKqhymImn4mi7WrWc6iP4/ye6.'; // Hashed "Password123"

  for (const doc of mockDoctors) {
    try {
      await withTransaction(async (conn) => {
        // Check if user already exists
        const userRows = await conn.query('SELECT id FROM users WHERE email = ? LIMIT 1', [doc.email]);
        let userId;

        if (userRows.length > 0) {
          userId = userRows[0].id;
        } else {
          userId = uuidv4();
          // Insert into users
          await conn.query(
            'INSERT INTO users (id, phone, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, doc.phone, doc.email, passHash, 'doctor', 'active']
          );
          // Insert profile
          await conn.query(
            'INSERT INTO user_profiles (user_id, full_name, preferred_language) VALUES (?, ?, ?)',
            [userId, doc.fullName, 'en']
          );
          // Insert user_role mapping (role_id 2 = DOCTOR)
          await conn.query(
            'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
            [userId, 2]
          );
        }

        // Check if doctor catalog entry exists
        const docRows = await conn.query('SELECT id FROM doctors WHERE user_id = ? LIMIT 1', [userId]);
        let docCatalogId;

        if (docRows.length > 0) {
          docCatalogId = docRows[0].id;
          // Update details
          await conn.query(
            'UPDATE doctors SET full_name = ?, name = ?, specialty_id = ?, email = ?, phone = ?, fee_amount = ?, rating = ?, verified = ? WHERE id = ?',
            [doc.fullName, doc.fullName, doc.specialtyId, doc.email, doc.phone, doc.fee, doc.rating, true, docCatalogId]
          );
        } else {
          docCatalogId = uuidv4();
          // Insert into doctors
          await conn.query(
            'INSERT INTO doctors (id, user_id, full_name, name, specialty_id, email, phone, fee_amount, rating, verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [docCatalogId, userId, doc.fullName, doc.fullName, doc.specialtyId, doc.email, doc.phone, doc.fee, doc.rating, true]
          );
        }

        // Insert settings
        const settings = {
          hospital: doc.hospital,
          bio: doc.bio,
          consultationType: 'Both',
          experience: '8-15 years',
          updatedAt: new Date().toISOString()
        };

        const existingSettings = await conn.query(
          "SELECT id FROM app_entities WHERE type = 'doctor_settings' AND user_id = ? LIMIT 1",
          [userId]
        );

        if (existingSettings.length > 0) {
          await conn.query(
            "UPDATE app_entities SET data = ?, updated_at = NOW() WHERE id = ?",
            [JSON.stringify(settings), existingSettings[0].id]
          );
        } else {
          await conn.query(
            "INSERT INTO app_entities (id, user_id, type, subtype, data, created_at, updated_at) VALUES (?, ?, 'doctor_settings', 'profile', ?, NOW(), NOW())",
            [uuidv4(), userId, JSON.stringify(settings)]
          );
        }

        // Clean and insert availability slots
        await conn.query('DELETE FROM doctor_availability_slots WHERE doctor_id = ?', [docCatalogId]);
        for (const slot of doc.slots) {
          await conn.query(
            'INSERT INTO doctor_availability_slots (id, doctor_id, day_of_week, start_time, end_time, slot_duration_minutes, max_consultations) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [uuidv4(), docCatalogId, slot.day, slot.start, slot.end, 30, 10]
          );
        }
      });
      console.log(`Successfully seeded/updated doctor: ${doc.fullName}`);
    } catch (err) {
      console.error(`Failed to seed doctor ${doc.fullName}:`, err.message);
    }
  }
}

seed()
  .then(() => {
    console.log('Extra doctors seeding completed successfully!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal seeding error:', err);
    process.exit(1);
  });
