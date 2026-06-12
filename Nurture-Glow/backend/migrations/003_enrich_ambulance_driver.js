/**
 * Migration 003: Enrich Ambulance Driver
 * Adds rating and vehicle_type columns to the ambulance_drivers table.
 */
export default {
  async up(query) {
    try {
      await query(`
        ALTER TABLE ambulance_drivers 
        ADD COLUMN rating DECIMAL(3, 2) DEFAULT 5.00,
        ADD COLUMN vehicle_type VARCHAR(50) DEFAULT 'Standard ICU'
      `);
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME' || err.errno === 1060) {
        console.log("Columns already exist in 'ambulance_drivers', skipping ADD COLUMN.");
      } else {
        throw err;
      }
    }
  },

  async down(query) {
    try {
      await query(`
        ALTER TABLE ambulance_drivers 
        DROP COLUMN rating,
        DROP COLUMN vehicle_type
      `);
    } catch (err) {
      if (err.code === 'ER_CANT_DROP_FIELD_OR_KEY' || err.errno === 1091) {
        console.log("Columns do not exist in 'ambulance_drivers', skipping drop.");
      } else {
        throw err;
      }
    }
  }
};
