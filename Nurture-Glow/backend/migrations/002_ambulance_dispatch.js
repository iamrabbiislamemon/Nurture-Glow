/**
 * Migration 002: Ambulance Dispatch
 * Creates ambulance_drivers and ambulance_trips tables.
 */
export default {
  async up(query) {
    // 1. Create ambulance_drivers table
    await query(`
      CREATE TABLE IF NOT EXISTS ambulance_drivers (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        user_id VARCHAR(36) NOT NULL UNIQUE,
        vehicle_number VARCHAR(50) NOT NULL,
        is_available BOOLEAN NOT NULL DEFAULT TRUE,
        lat DECIMAL(10, 8) NULL,
        lng DECIMAL(11, 8) NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    // 2. Create ambulance_trips table
    await query(`
      CREATE TABLE IF NOT EXISTS ambulance_trips (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        patient_id VARCHAR(36) NOT NULL,
        driver_id VARCHAR(36) NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
        patient_lat DECIMAL(10, 8) NOT NULL,
        patient_lng DECIMAL(11, 8) NOT NULL,
        destination_hospital VARCHAR(255) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (driver_id) REFERENCES users(id) ON DELETE SET NULL
      )
    `);
  },

  async down(query) {
    await query(`DROP TABLE IF EXISTS ambulance_trips`);
    await query(`DROP TABLE IF EXISTS ambulance_drivers`);
  }
};
