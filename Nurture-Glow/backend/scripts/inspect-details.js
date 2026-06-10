import mysql from 'mysql2/promise';
import 'dotenv/config';

async function inspectDetails() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'neonest',
  });

  try {
    const [hospitals] = await pool.query('SELECT id, name FROM hospitals');
    console.log('--- Hospitals ---');
    console.log(hospitals);

    const [vendors] = await pool.query('SELECT id, name FROM vendors');
    console.log('\n--- Vendors ---');
    console.log(vendors);

    const [doctors] = await pool.query('SELECT id, user_id, full_name FROM doctors');
    console.log('\n--- Doctors ---');
    console.log(doctors);

    const [roles] = await pool.query('SELECT * FROM roles');
    console.log('\n--- Roles ---');
    console.log(roles);
    
    const [specialties] = await pool.query('SELECT * FROM doctor_specialties');
    console.log('\n--- Specialties ---');
    console.log(specialties);

    const [categories] = await pool.query('SELECT * FROM product_categories');
    console.log('\n--- Product Categories ---');
    console.log(categories);

    const [products] = await pool.query('SELECT id, name, vendor_id, category_id FROM products');
    console.log('\n--- Products ---');
    console.log(products);

  } catch (error) {
    console.error('Error querying DB:', error);
  } finally {
    await pool.end();
  }
}

inspectDetails();
