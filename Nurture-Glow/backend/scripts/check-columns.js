import mysql from 'mysql2/promise';
import 'dotenv/config';

async function check() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'neonest',
  });

  try {
    const [cols] = await connection.query('DESCRIBE user_profiles');
    console.log('--- user_profiles columns ---');
    console.log(cols);

    const [userCols] = await connection.query('DESCRIBE users');
    console.log('\n--- users columns ---');
    console.log(userCols);
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

check();
