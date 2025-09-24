/*
Creates database if it does not exist by connecting to master.
Usage: node scripts/create-db.js [dbName]
*/
const sql = require('mssql');

const dbName = process.argv[2] || process.env.SQL_DATABASE || 'ogretmenevi';
const config = {
  server: process.env.SQL_SERVER || '127.0.0.1',
  port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 1433,
  user: process.env.SQL_USER || 'sa',
  password: process.env.SQL_PASSWORD || 'YourStrong!Passw0rd',
  database: 'master',
  options: { encrypt: false, trustServerCertificate: true },
  pool: { max: 5, min: 1, idleTimeoutMillis: 30000 },
};

async function main() {
  const pool = await sql.connect(config);
  await pool
    .request()
    .query(`IF DB_ID('${dbName.replace(/'/g, "''")}') IS NULL CREATE DATABASE [${dbName.replace(/]/g, ']]')}]`);
  console.log(`Database ensured: ${dbName}`);
  await pool.close();
}

main().catch((err) => { console.error(err); process.exit(1); });
