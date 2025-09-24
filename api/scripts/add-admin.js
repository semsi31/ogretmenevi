/*
 Adds or updates a local admin user in the SQL Server database.
 Usage: node scripts/add-admin.js [email] [password] [role]
 Defaults: admin@example.com admin123 admin
*/
const sql = require('mssql');
const bcrypt = require('bcryptjs');

const email = process.argv[2] || process.env.ADMIN_EMAIL || 'admin@example.com';
const password = process.argv[3] || process.env.ADMIN_PASSWORD || 'admin123';
const role = process.argv[4] || process.env.ADMIN_ROLE || 'admin';

const config = {
  server: process.env.SQL_SERVER || '127.0.0.1',
  port: process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : 1433,
  database: process.env.SQL_DATABASE || 'ogretmenevi',
  user: process.env.SQL_USER || 'sa',
  password: process.env.SQL_PASSWORD || 'YourStrong!Passw0rd',
  options: { encrypt: false, trustServerCertificate: true },
  pool: { max: 5, min: 1, idleTimeoutMillis: 30000 }
};

async function main() {
  const hash = bcrypt.hashSync(password, 10);
  const pool = await sql.connect(config);
  // Ensure users table exists
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND type in (N'U'))
    BEGIN
      CREATE TABLE [dbo].[users] (
        [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
        [email] NVARCHAR(255) NOT NULL UNIQUE,
        [password_hash] NVARCHAR(255) NOT NULL,
        [role] NVARCHAR(50) NOT NULL DEFAULT 'viewer',
        [created_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
      );
    END
  `);
  await pool.request()
    .input('email', sql.NVarChar(255), email)
    .input('hash', sql.NVarChar(255), hash)
    .input('role', sql.NVarChar(50), role)
    .query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE email = @email)
      BEGIN
        INSERT INTO dbo.users (email, password_hash, role) VALUES (@email, @hash, @role);
      END
      ELSE
      BEGIN
        UPDATE dbo.users SET password_hash = @hash, role = @role WHERE email = @email;
      END
    `);
  console.log(`Admin upserted: ${email} / ${role}`);
  await pool.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


