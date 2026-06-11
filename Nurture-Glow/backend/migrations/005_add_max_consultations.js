/**
 * Migration 005: Add Max Consultations to doctor_availability_slots
 */
export default {
  async up(query) {
    await query(`
      ALTER TABLE doctor_availability_slots 
      ADD COLUMN max_consultations INT DEFAULT 10 AFTER slot_duration_minutes
    `);
  },

  async down(query) {
    await query(`
      ALTER TABLE doctor_availability_slots 
      DROP COLUMN max_consultations
    `);
  }
};
