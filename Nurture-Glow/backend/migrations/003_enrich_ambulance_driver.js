/**
 * Migration 003: Enrich Ambulance Driver
 * Adds rating and vehicle_type columns to the ambulance_drivers table.
 */
export default {
  async up(query) {
    await query(`
      ALTER TABLE ambulance_drivers 
      ADD COLUMN rating DECIMAL(3, 2) DEFAULT 5.00,
      ADD COLUMN vehicle_type VARCHAR(50) DEFAULT 'Standard ICU'
    `);
  },

  async down(query) {
    await query(`
      ALTER TABLE ambulance_drivers 
      DROP COLUMN rating,
      DROP COLUMN vehicle_type
    `);
  }
};
