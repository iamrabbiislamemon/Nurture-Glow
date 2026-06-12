/**
 * Migration 005: Add Max Consultations to doctor_availability_slots
 */
export default {
  async up(query) {
    try {
      await query(`
        ALTER TABLE doctor_availability_slots 
        ADD COLUMN max_consultations INT DEFAULT 10 AFTER slot_duration_minutes
      `);
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060) {
        console.log("Column 'max_consultations' already exists in 'doctor_availability_slots', skipping.");
      } else {
        throw err;
      }
    }
  },

  async down(query) {
    try {
      await query(`
        ALTER TABLE doctor_availability_slots 
        DROP COLUMN max_consultations
      `);
    } catch (err) {
      if (err.code === 'ER_CANT_DROP_FIELD_OR_KEY' || err.errno === 1091) {
        console.log("Column 'max_consultations' does not exist in 'doctor_availability_slots', skipping drop.");
      } else {
        throw err;
      }
    }
  }
};
