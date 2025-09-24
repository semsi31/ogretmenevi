import dotenv from 'dotenv';
dotenv.config();

function parseDatabaseUrl(url?: string) {
  if (!url) return null;
  // Example: Server=127.0.0.1,1433;Database=antakya_app;User Id=sa;Password=...;Encrypt=false;TrustServerCertificate=true;
  const parts = Object.fromEntries(
    url.split(';').filter(Boolean).map((kv) => {
      const [k, ...rest] = kv.split('=');
      return [k.trim().toLowerCase(), rest.join('=').trim()];
    })
  );
  const server = parts['server'] as string | undefined;
  let host = server || 'localhost';
  let port: number | undefined = undefined;
  if (host.includes(',')) {
    const [h, p] = host.split(',');
    host = h;
    port = parseInt(p, 10);
  }
  return {
    server: host,
    port,
    database: (parts['database'] as string) || undefined,
    user: (parts['user id'] as string) || process.env.SQL_USER,
    password: (parts['password'] as string) || process.env.SQL_PASSWORD,
    encrypt: String(parts['encrypt'] ?? 'false'),
    trust: String(parts['trustservercertificate'] ?? 'true')
  };
}

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  sql: {
    ...(parseDatabaseUrl(process.env.DATABASE_URL) || {}),
    server: (parseDatabaseUrl(process.env.DATABASE_URL)?.server) || process.env.SQL_SERVER || 'localhost',
    port: (parseDatabaseUrl(process.env.DATABASE_URL)?.port) || (process.env.SQL_PORT ? parseInt(process.env.SQL_PORT, 10) : undefined),
    instance: process.env.SQL_INSTANCE,
    database: (parseDatabaseUrl(process.env.DATABASE_URL)?.database) || process.env.SQL_DATABASE || 'ogretmenevi',
    user: (parseDatabaseUrl(process.env.DATABASE_URL)?.user) || process.env.SQL_USER || 'sa',
    password: (parseDatabaseUrl(process.env.DATABASE_URL)?.password) || process.env.SQL_PASSWORD || 'YourStrong!Passw0rd',
    options: {
      encrypt: ((parseDatabaseUrl(process.env.DATABASE_URL)?.encrypt) || process.env.SQL_ENCRYPT || 'false').toLowerCase() === 'true',
      trustServerCertificate: ((parseDatabaseUrl(process.env.DATABASE_URL)?.trust) || process.env.SQL_TRUST_CERT || 'true').toLowerCase() === 'true'
    },
    pool: {
      max: 10,
      min: 1,
      idleTimeoutMillis: 30000
    }
  },
  cors: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001')
    .split(',')
    .map((o) => o.trim()),
  azure: {
    accountName: process.env.AZURE_STORAGE_ACCOUNT || process.env.AZURE_BLOB_ACCOUNT_NAME,
    accountKey: process.env.AZURE_STORAGE_KEY,
    container: process.env.AZURE_STORAGE_CONTAINER || process.env.AZURE_BLOB_CONTAINER || 'public',
    blobBaseUrl: process.env.BLOB_BASE_URL,
    sasUrl: process.env.AZURE_BLOB_SAS_URL,
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'dev-secret',
    deleteBlobsOnRouteDelete: (process.env.DELETE_BLOBS_ON_ROUTE_DELETE || 'false').toLowerCase() === 'true'
  }
};


