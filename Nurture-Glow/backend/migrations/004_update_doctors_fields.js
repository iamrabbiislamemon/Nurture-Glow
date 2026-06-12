/**
 * Migration 004: Update Doctors Fields
 * Adds name, specialization, hospital, location, experience_years, available_time, and contact_number to doctors table.
 */
export default {
  async up(query) {
    try {
      await query(`
        ALTER TABLE doctors 
        ADD COLUMN name VARCHAR(255) NULL,
        ADD COLUMN specialization VARCHAR(255) NULL,
        ADD COLUMN hospital VARCHAR(255) NULL,
        ADD COLUMN location VARCHAR(255) NULL,
        ADD COLUMN experience_years INT NULL,
        ADD COLUMN available_time VARCHAR(255) NULL,
        ADD COLUMN contact_number VARCHAR(20) NULL
      `);
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060) {
        console.log("Columns already exist in 'doctors', skipping ADD COLUMN.");
      } else {
        throw err;
      }
    }

    // Backfill existing data
    await query(`
      UPDATE doctors SET name = full_name WHERE name IS NULL
    `);
    await query(`
      UPDATE doctors SET contact_number = phone WHERE contact_number IS NULL
    `);
    await query(`
      UPDATE doctors d 
      LEFT JOIN doctor_specialties s ON d.specialty_id = s.id 
      SET d.specialization = s.name 
      WHERE d.specialization IS NULL
    `);
  },

  async down(query) {
    try {
      await query(`
        ALTER TABLE doctors 
        DROP COLUMN name,
        DROP COLUMN specialization,
        DROP COLUMN hospital,
        DROP COLUMN location,
        DROP COLUMN experience_years,
        DROP COLUMN available_time,
        DROP COLUMN contact_number
      `);
    } catch (err) {
      if (err.code === 'ER_CANT_DROP_FIELD_OR_KEY' || err.errno === 1091) {
        console.log("Columns do not exist in 'doctors', skipping drop.");
      } else {
        throw err;
      }
    }
  }
};
