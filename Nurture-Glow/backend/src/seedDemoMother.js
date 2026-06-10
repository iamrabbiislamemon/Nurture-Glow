import { pool, query } from './db.js';
import { v4 as uuidv4 } from 'uuid';

async function seed() {
  const userId = '4768b0a8-d480-4ebe-a281-eeae43c9c50d'; // mother@nurtureglow.com
  console.log('Seeding demo mother user: ' + userId);

  // 1. Meta
  await query("REPLACE INTO app_user_meta (user_id, meta_key, meta_value, updated_at) VALUES (?, 'hydration', '6', NOW())", [userId]);
  await query("REPLACE INTO app_user_meta (user_id, meta_key, meta_value, updated_at) VALUES (?, 'pregnancyWeek', '24', NOW())", [userId]);
  console.log('✓ Meta seeded');

  // Delete existing appointments/vaccines/health_history for this user to avoid clutter
  await query("DELETE FROM app_entities WHERE user_id = ? AND type IN ('appointment', 'vaccine', 'health_history')", [userId]);

  // 2. Appointments
  const appointments = [
    {
      id: uuidv4(),
      userId,
      doctorId: '167bb282-25af-49e3-9b1e-bd54a8316532',
      doctorName: 'Dr. Arifa Begum',
      specialty: 'Gynecologist',
      date: '2026-06-16',
      time: '10:00 AM',
      status: 'Scheduled',
      type: 'Online',
      notes: 'Routine 24-week prenatal checkup.'
    },
    {
      id: uuidv4(),
      userId,
      doctorId: '67ea0685-c2dc-43fb-ac3a-4bd25fad0ca3',
      doctorName: 'Dr. Nusrat Jahan',
      specialty: 'Nutritionist',
      date: '2026-06-19',
      time: '02:30 PM',
      status: 'Scheduled',
      type: 'Offline',
      notes: 'Gestational diabetes meal plan adjustments.'
    }
  ];

  for (const app of appointments) {
    await query(
      `INSERT INTO app_entities (id, user_id, type, subtype, data, created_at, updated_at) VALUES (?, ?, 'appointment', NULL, ?, NOW(), NOW())`,
      [app.id, userId, JSON.stringify(app)]
    );
  }
  console.log('✓ Appointments seeded');

  // 3. Vaccines
  const vaccines = [
    {
      id: uuidv4(),
      userId,
      name: 'Tdap (Tetanus, Diphtheria, Pertussis)',
      dueDate: '2026-05-01',
      status: 'Taken',
      administeredDate: '2026-05-01',
      verificationStatus: 'approved'
    },
    {
      id: uuidv4(),
      userId,
      name: 'Influenza (Flu Vaccine)',
      dueDate: '2026-04-15',
      status: 'Taken',
      administeredDate: '2026-04-15',
      verificationStatus: 'approved'
    },
    {
      id: uuidv4(),
      userId,
      name: 'Tetanus Toxoid Booster (TT)',
      dueDate: '2026-06-12', // in 4 days
      status: 'Pending',
      verificationStatus: 'pending'
    },
    {
      id: uuidv4(),
      userId,
      name: 'COVID-19 Maternal Dose',
      dueDate: '2026-06-25', // in 17 days
      status: 'Pending',
      verificationStatus: 'pending'
    },
    {
      id: uuidv4(),
      userId,
      name: 'Hepatitis B Maternal Dose',
      dueDate: '2026-06-05', // 3 days ago (Overdue!)
      status: 'Pending',
      verificationStatus: 'pending'
    }
  ];

  for (const vac of vaccines) {
    await query(
      `INSERT INTO app_entities (id, user_id, type, subtype, data, created_at, updated_at) VALUES (?, ?, 'vaccine', NULL, ?, NOW(), NOW())`,
      [vac.id, userId, JSON.stringify(vac)]
    );
  }
  console.log('✓ Vaccines seeded');

  // 4. Health History (for grid cards AND the Recharts chart)
  const healthMetrics = [
    // Today
    { subtype: 'Heart Rate', value: '72', date: '2026-06-08' },
    { subtype: 'Weight', value: '68.2', date: '2026-06-08' },
    { subtype: 'Sleep', value: '8', date: '2026-06-08' },
    // Yesterday
    { subtype: 'Heart Rate', value: '75', date: '2026-06-07' },
    { subtype: 'Weight', value: '68.1', date: '2026-06-07' },
    { subtype: 'Sleep', value: '7.5', date: '2026-06-07' },
    // 2 days ago
    { subtype: 'Heart Rate', value: '70', date: '2026-06-06' },
    { subtype: 'Weight', value: '68.0', date: '2026-06-06' },
    { subtype: 'Sleep', value: '8.5', date: '2026-06-06' },
    // 3 days ago
    { subtype: 'Heart Rate', value: '73', date: '2026-06-05' },
    { subtype: 'Weight', value: '67.9', date: '2026-06-05' },
    { subtype: 'Sleep', value: '7.0', date: '2026-06-05' },
    // 4 days ago
    { subtype: 'Heart Rate', value: '74', date: '2026-06-04' },
    { subtype: 'Weight', value: '67.8', date: '2026-06-04' },
    { subtype: 'Sleep', value: '8.0', date: '2026-06-04' },
    // 5 days ago
    { subtype: 'Heart Rate', value: '71', date: '2026-06-03' },
    { subtype: 'Weight', value: '67.8', date: '2026-06-03' },
    { subtype: 'Sleep', value: '9.0', date: '2026-06-03' },
    // 6 days ago
    { subtype: 'Heart Rate', value: '72', date: '2026-06-02' },
    { subtype: 'Weight', value: '67.7', date: '2026-06-02' },
    { subtype: 'Sleep', value: '7.5', date: '2026-06-02' },
  ];

  for (const m of healthMetrics) {
    const id = uuidv4();
    const payload = {
      id,
      date: m.date,
      value: m.value
    };
    await query(
      `INSERT INTO app_entities (id, user_id, type, subtype, data, created_at, updated_at) VALUES (?, ?, 'health_history', ?, ?, ?, ?)`,
      [id, userId, m.subtype, JSON.stringify(payload), m.date, m.date]
    );
  }
  console.log('✓ Health History seeded');

  // Check if there is an entry in the "mothers" table for this user
  const mothers = await query("SELECT id FROM mothers WHERE user_id = ? LIMIT 1", [userId]);
  if (!mothers.length) {
    await query("INSERT INTO mothers (id, user_id, blood_group, health_conditions) VALUES (?, ?, 'A+', 'Normal pregnancy')", [uuidv4(), userId]);
    console.log('✓ Mother entity created');
  }

  // Check if there is an entry in the "pregnancies" table
  const pregnancies = await query("SELECT id FROM pregnancies WHERE mother_id = (SELECT id FROM mothers WHERE user_id = ?) LIMIT 1", [userId]);
  if (!pregnancies.length) {
    await query("INSERT INTO pregnancies (id, mother_id, expected_due_date, gestational_age_weeks, status) VALUES (?, (SELECT id FROM mothers WHERE user_id = ?), '2026-10-01', 24, 'active')", [uuidv4(), userId]);
    console.log('✓ Pregnancy entity created');
  }

  console.log('🎉 Seeding complete!');
  process.exit(0);
}

seed().catch(err => {
  console.error(err);
  process.exit(1);
});
