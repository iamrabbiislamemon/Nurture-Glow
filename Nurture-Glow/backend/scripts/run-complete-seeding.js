import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import 'dotenv/config';

// Robust SQL splitter to handle strings/comments/semicolons correctly
function splitSqlStatements(sql) {
  const statements = [];
  let currentStatement = '';
  let inString = false;
  let stringChar = '';
  let inComment = false;
  let inLineComment = false;

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];
    const nextChar = sql[i + 1];

    if (inLineComment) {
      if (char === '\n' || char === '\r') {
        inLineComment = false;
      }
      continue;
    }

    if (inComment) {
      if (char === '*' && nextChar === '/') {
        inComment = false;
        i++;
      }
      continue;
    }

    if (!inString) {
      if (char === '-' && nextChar === '-') {
        inLineComment = true;
        i++;
        continue;
      }
      if (char === '/' && nextChar === '*') {
        inComment = true;
        i++;
        continue;
      }
    }

    if ((char === "'" || char === '"' || char === '`') && sql[i - 1] !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }

    if (char === ';' && !inString) {
      const stmt = currentStatement.trim();
      if (stmt) {
        statements.push(stmt);
      }
      currentStatement = '';
    } else {
      currentStatement += char;
    }
  }

  const stmt = currentStatement.trim();
  if (stmt) {
    statements.push(stmt);
  }

  return statements;
}

async function runSeeding() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'neonest',
  });

  try {
    console.log('Connected to database successfully.');

    // Ensure missing tables are created first
    console.log('Ensuring additional tables exist...');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`subscription_plans\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`plan_name\` VARCHAR(100) NOT NULL,
        \`price\` DECIMAL(10, 2) NOT NULL,
        \`currency\` VARCHAR(10) DEFAULT 'BDT',
        \`billing_cycle\` VARCHAR(50) DEFAULT 'monthly',
        \`features\` JSON,
        \`is_featured\` BOOLEAN DEFAULT FALSE,
        \`is_popular\` BOOLEAN DEFAULT FALSE,
        \`badge_text\` VARCHAR(50),
        \`is_active\` BOOLEAN DEFAULT TRUE,
        \`sort_order\` INT DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`faqs\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`question\` TEXT NOT NULL,
        \`answer\` TEXT NOT NULL,
        \`category\` VARCHAR(50),
        \`is_active\` BOOLEAN DEFAULT TRUE,
        \`sort_order\` INT DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`nutrition_goals\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` VARCHAR(36) NULL,
        \`calorie_goal\` INT DEFAULT 2200,
        \`protein_goal\` INT DEFAULT 75,
        \`carbs_goal\` INT DEFAULT 180,
        \`fat_goal\` INT DEFAULT 60,
        \`water_goal\` INT DEFAULT 10,
        \`is_default\` BOOLEAN DEFAULT FALSE,
        FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`pregnancy_week_info\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`trimester\` INT NOT NULL,
        \`min_week\` INT NOT NULL,
        \`max_week\` INT NOT NULL,
        \`stage_name\` VARCHAR(100) NOT NULL,
        \`baby_size\` VARCHAR(100) NOT NULL,
        \`description\` TEXT NOT NULL,
        \`nutrients\` JSON,
        \`symptoms\` JSON
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`pregnancy_myths\` (
        \`id\` INT AUTO_INCREMENT PRIMARY KEY,
        \`locale\` VARCHAR(10) NOT NULL,
        \`myth_keyword\` VARCHAR(255) NOT NULL,
        \`claim\` TEXT NOT NULL,
        \`verdict\` VARCHAR(50) NOT NULL,
        \`explanation\` TEXT NOT NULL,
        \`safe_advice\` JSON,
        \`when_to_call_doctor\` JSON,
        \`sources_label\` VARCHAR(255)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`system_backups\` (
        \`id\` VARCHAR(36) PRIMARY KEY,
        \`filename\` VARCHAR(255) NOT NULL,
        \`size_mb\` DECIMAL(10, 2) DEFAULT 0,
        \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        \`created_by\` VARCHAR(36),
        \`status\` ENUM('PENDING', 'COMPLETED', 'FAILED') DEFAULT 'PENDING',
        \`storage_path\` VARCHAR(500),
        \`checksum\` VARCHAR(64),
        FOREIGN KEY (\`created_by\`) REFERENCES \`users\`(\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`vaccine_catalog\` (
        \`id\` VARCHAR(36) NOT NULL PRIMARY KEY,
        \`vaccine_name\` VARCHAR(255) NOT NULL,
        \`description\` LONGTEXT,
        \`recommended_week_start\` INT NULL,
        \`recommended_week_end\` INT NULL,
        \`is_required\` BOOLEAN DEFAULT TRUE,
        \`is_active\` BOOLEAN DEFAULT TRUE,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_vaccine_catalog_active\` (\`is_active\`),
        INDEX \`idx_vaccine_catalog_week\` (\`recommended_week_start\`, \`recommended_week_end\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`vaccine_suggestions\` (
        \`id\` VARCHAR(36) NOT NULL PRIMARY KEY,
        \`week_start\` INT NOT NULL,
        \`week_end\` INT NOT NULL,
        \`vaccine_names\` LONGTEXT NOT NULL,
        \`description\` LONGTEXT,
        \`is_active\` BOOLEAN DEFAULT TRUE,
        \`created_at\` DATETIME DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX \`idx_vaccine_suggestions_active\` (\`is_active\`),
        INDEX \`idx_vaccine_suggestions_week\` (\`week_start\`, \`week_end\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✓ Additional tables exist.');

    // 1. Truncate tables (except schema_migrations)
    console.log('Clearing database tables...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    const [tables] = await connection.query(
      "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'",
      [process.env.DB_NAME || 'neonest']
    );
    const tableNames = tables.map(t => t.TABLE_NAME || t.table_name);
    for (const tableName of tableNames) {
      if (tableName !== 'schema_migrations') {
        console.log(`Truncating ${tableName}...`);
        await connection.query(`TRUNCATE TABLE \`${tableName}\``);
      }
    }
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✓ Database cleared.');

    // 2. Insert basic static data: roles
    console.log('Inserting basic roles...');
    await connection.query("INSERT INTO roles (id, role_name) VALUES (1, 'USER'), (2, 'DOCTOR'), (3, 'ADMIN') ON DUPLICATE KEY UPDATE role_name = VALUES(role_name)");

    // 3. Insert specialties
    console.log('Inserting doctor specialties...');
    const specialties = [
      { id: 1, name: 'General Medicine' },
      { id: 2, name: 'Cardiology' },
      { id: 3, name: 'Pediatrics' },
      { id: 4, name: 'Gynecology' },
      { id: 5, name: 'Dermatology' },
      { id: 6, name: 'Gynecologist' },
      { id: 7, name: 'Pediatrician' },
      { id: 8, name: 'Nutritionist' },
      { id: 9, name: 'Psychologist' },
      { id: 10, name: 'MBBS (General Physician)' }
    ];
    for (const spec of specialties) {
      await connection.query('INSERT INTO doctor_specialties (id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)', [spec.id, spec.name]);
    }

    // 4. Insert product categories
    console.log('Inserting product categories...');
    const categories = [
      { id: 1, name: 'Mother Care' },
      { id: 2, name: 'Baby Care' },
      { id: 3, name: 'Nutrition' },
      { id: 4, name: 'Medical Devices' }
    ];
    for (const cat of categories) {
      await connection.query('INSERT INTO product_categories (id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)', [cat.id, cat.name]);
    }

    // 5. Insert hospitals with exact UUIDs expected by the seeds
    console.log('Inserting hospitals...');
    const hospitals = [
      { id: '48b1b64f-fe94-4efa-b196-94c80a91de83', name: 'Evercare Hospital', address: 'Bashundhara, Dhaka', hotline_phone: '+8802-8401661', lat: 23.8124, lng: 90.4326 },
      { id: 'd21ff2ad-11d2-4d4c-825f-e4bc9e8d7c31', name: 'Dhaka Medical College', address: 'Ramna, Dhaka', hotline_phone: '+8802-9669340', lat: 23.7258, lng: 90.3976 },
      { id: 'd8ed5c33-e45a-4000-8f43-4804d238ef25', name: 'Square Hospital', address: 'Panthapath, Dhaka', hotline_phone: '+8802-8144400', lat: 23.7507, lng: 90.3879 }
    ];
    for (const hosp of hospitals) {
      await connection.query(
        'INSERT INTO hospitals (id, name, address, hotline_phone, lat, lng) VALUES (?, ?, ?, ?, ?, ?)',
        [hosp.id, hosp.name, hosp.address, hosp.hotline_phone, hosp.lat, hosp.lng]
      );
    }

    // 6. Insert primary vendors
    console.log('Inserting vendors...');
    const vendorId = '22e8b924-3eb6-4a84-a197-1fdebb9f210a'; // Nurture Glow Official
    await connection.query(
      'INSERT INTO vendors (id, name, phone, verified) VALUES (?, ?, ?, ?)',
      [vendorId, 'Nurture Glow Official', '+8801700000000', true]
    );

    // 7. Insert products with exact UUIDs expected by the seeds
    console.log('Inserting products...');
    const products = [
      { id: '8ba9a063-592b-4ac1-97b6-0e717e6fd25a', name: 'Folic Acid', category_id: 1, price: 120.00, stock_qty: 100, image_url: 'https://picsum.photos/seed/folic/200' },
      { id: '8ec4ea00-0576-4b1f-9b31-3525b569808f', name: 'Prenatal Vitamins', category_id: 1, price: 450.00, stock_qty: 50, image_url: 'https://picsum.photos/seed/vit/200' },
      { id: 'a7142f7e-555e-41cc-87ae-6a934bffaecf', name: 'Baby Lotion', category_id: 2, price: 320.00, stock_qty: 80, image_url: 'https://picsum.photos/seed/lotion/200' }
    ];
    for (const prod of products) {
      await connection.query(
        'INSERT INTO products (id, vendor_id, category_id, name, price, stock_qty, status, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [prod.id, vendorId, prod.category_id, prod.name, prod.price, prod.stock_qty, 'active', prod.image_url]
      );
    }

    // 8. Insert users (bcrypt hash for "Password123" is: $2a$10$Xw.YhbpF5WIhjzB2yluh1etE720roGJ80L6s6wqapFKPdg5HMkEUy)
    console.log('Inserting demo & system users...');
    const users = [
      // Demo accounts
      { id: '4768b0a8-d480-4ebe-a281-eeae43c9c50d', phone: '+8801700000001', email: 'mother@nurtureglow.com', role: 'mother', name: 'Demo Mother' },
      { id: '64805c1c-9631-40a6-98e8-1f97ebfddc19', phone: '+8801700000002', email: 'doctor@nurtureglow.com', role: 'doctor', name: 'Demo Doctor' },
      { id: '5008285a-f2e1-445b-80e5-da5b770efffa', phone: '+8801700000003', email: 'pharmacist@nurtureglow.com', role: 'pharmacist', name: 'Demo Pharmacist' },
      { id: 'df4249a9-7e53-44d6-868e-5fcbeab9e484', phone: '+8801700000004', email: 'nutritionist@nurtureglow.com', role: 'nutritionist', name: 'Demo Nutritionist' },
      { id: '20317e06-0bf2-42fc-be2f-91c1c56989ed', phone: '+8801700000005', email: 'merchandiser@nurtureglow.com', role: 'merchandiser', name: 'Demo Merchandiser' },
      { id: 'admin-medical-001', phone: '+8801700000006', email: 'medical.admin@nurtureglow.com', role: 'medical_admin', name: 'Demo Medical Admin' },
      { id: 'admin-ops-001', phone: '+8801700000007', email: 'ops.admin@nurtureglow.com', role: 'ops_admin', name: 'Demo Operations Admin' },
      { id: 'admin-system-001', phone: '+8801700000008', email: 'system.admin@nurtureglow.com', role: 'system_admin', name: 'Demo System Admin' },
      
      // Relational complete-seeding users
      { id: '4d1576ee-97fb-42f6-a7cb-beadf200b67a', phone: '+8801700000009', email: 'rieshuvo@gmail.com', role: 'mother', name: 'Rie Shuvo' },
      { id: 'c8b77c7f-a4e1-4ee4-b793-5e21d1901b75', phone: '+8801700000010', email: 'awadhe12302@gmail.com', role: 'mother', name: 'Awadhe' },
      { id: 'f80d78ef-e699-4056-8fe7-f87f689691f1', phone: '+8801700000011', email: 'meherunnesasetu7@gmail.com', role: 'mother', name: 'Meherunnesa Setu' },
      { id: 'ff42ff57-1296-4d30-ad6a-d27b04b42fdd', phone: '+8801700000012', email: 'amiparama1234@gtmail.com', role: 'mother', name: 'Amiparama' },
      { id: '98a1fb6b-a74f-431a-899b-809253e85254', phone: '+8801700000013', email: 'iamrabbiislamemon@gmail.com', role: 'doctor', name: 'Dr. Nusrat Jahan' },
      { id: '6abf7e97-9653-4905-ab9b-bee5692676f5', phone: '+8801700000014', email: 'rabbiislamemon639@gmail.com', role: 'doctor', name: 'Dr. Rabbi Islam' },
      { id: 'efe0b731-4096-4be8-bdd4-b6d8461d7118', phone: '+8801700000015', email: 'mahbub@nurtureglow.com', role: 'doctor', name: 'Dr. Mahbub Rahman' },
      { id: 'setu-mother-001', phone: '+8801700000016', email: 'setumeherunnesa59@gmail.com', role: 'mother', name: 'Setu Meherunnesa' }
    ];

    const passHash = '$2a$12$/yvVYWkGYXzaZdJNxYRr4uCrFQmcKqhymImn4mi7WrWc6iP4/ye6.'; // Hashed "Password123"

    for (const u of users) {
      await connection.query(
        'INSERT INTO users (id, phone, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?)',
        [u.id, u.phone, u.email, passHash, u.role, 'active']
      );

      // Create profile record
      await connection.query(
        'INSERT INTO user_profiles (user_id, full_name, preferred_language) VALUES (?, ?, ?)',
        [u.id, u.name, 'en']
      );

      // Map roles table junction
      let roleId = 1; // USER
      if (u.role.endsWith('admin')) roleId = 3; // ADMIN
      else if (u.role === 'doctor') roleId = 2; // DOCTOR
      await connection.query(
        'INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)',
        [u.id, roleId]
      );
    }
    console.log('✓ Users and user_profiles seeded.');

    // 9. Seed doctor catalog entries (to prevent startup seed collisions and enable reviews/consultations)
    console.log('Inserting doctors into doctor catalog...');
    const doctors = [
      { id: '167bb282-25af-49e3-9b1e-bd54a8316532', user_id: '64805c1c-9631-40a6-98e8-1f97ebfddc19', full_name: 'Dr. Arifa Begum', specialty_id: 6, email: 'doctor@nurtureglow.com', phone: '+8801700000002', fee_amount: 500.00, rating: 4.80 },
      { id: '67ea0685-c2dc-43fb-ac3a-4bd25fad0ca3', user_id: '98a1fb6b-a74f-431a-899b-809253e85254', full_name: 'Dr. Nusrat Jahan', specialty_id: 8, email: 'nusrat@nurtureglow.com', phone: '+8801700000012', fee_amount: 400.00, rating: 4.65 },
      { id: 'd92bca99-a32d-4d1b-b728-20355c945dc7', user_id: 'efe0b731-4096-4be8-bdd4-b6d8461d7118', full_name: 'Dr. Mahbub Rahman', specialty_id: 7, email: 'mahbub@nurtureglow.com', phone: '+8801700000013', fee_amount: 600.00, rating: 4.90 }
    ];
    for (const doc of doctors) {
      await connection.query(
        'INSERT INTO doctors (id, user_id, full_name, specialty_id, email, phone, fee_amount, rating, verified) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [doc.id, doc.user_id, doc.full_name, doc.specialty_id, doc.email, doc.phone, doc.fee_amount, doc.rating, true]
      );
    }
    console.log('✓ Doctor catalog entries seeded.');

    // 10. Execute SQL files: seed_dbms_data, admin_test_data, seed_system_data, seed_complete_data
    const sqlFiles = [
      'seed_dbms_data.sql',
      'admin_test_data.sql',
      'seed_system_data.sql',
      'seed_complete_data.sql'
    ];

    console.log('Executing SQL seed scripts...');
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    
    for (const file of sqlFiles) {
      console.log(`Executing ${file}...`);
      const filePath = path.join(process.cwd(), 'sql', 'seeds', file);
      const sqlContent = fs.readFileSync(filePath, 'utf-8');
      const statements = splitSqlStatements(sqlContent);
      
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        try {
          await connection.query(stmt);
        } catch (stmtError) {
          // If duplicate key updates or updates fail due to mismatch, log warning but keep going.
          // In some cases we want to know what failed.
          console.warn(`Warning in ${file} at statement ${i + 1}: ${stmtError.message}\nStatement: ${stmt.slice(0, 100)}...`);
        }
      }
      console.log(`✓ Completed ${file}`);
    }
    
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('🎉 Database seeding complete!');
  } catch (error) {
    console.error('Fatal error during seeding:', error);
  } finally {
    await connection.end();
    console.log('Database connection closed.');
  }
}

runSeeding();
