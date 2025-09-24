import sql from 'mssql';
import bcrypt from 'bcryptjs';
import { config } from './config';

let pool: sql.ConnectionPool | null = null;

export async function getPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) return pool;
  const base: any = {
    server: config.sql.server,
    database: config.sql.database,
    user: config.sql.user,
    password: config.sql.password,
    options: config.sql.options as any,
    pool: config.sql.pool as any
  };
  if (config.sql.port) base.port = config.sql.port;
  if (config.sql.instance) base.options = { ...(base.options || {}), instanceName: config.sql.instance };
  try {
    pool = await sql.connect(base);
  } catch (err: any) {
    const msg = String(err?.message || '');
    const isDbMissing = msg.includes("Failed to open the explicitly specified database") || msg.includes('Cannot open database');
    if (!isDbMissing) throw err;
    // Connect to master and create the database, then reconnect
    const masterCfg = { ...base, database: 'master' };
    const master = await sql.connect(masterCfg as any);
    const dbName = base.database;
    await master.request().query(`IF DB_ID('${dbName.replace(/'/g, "''")}') IS NULL CREATE DATABASE [${dbName.replace(/]/g, ']]')}]`);
    await master.close();
    pool = await sql.connect(base);
  }
  return pool;
}

export async function ensureSchema(): Promise<void> {
  const p = await getPool();
  // Migration pivot: deprecate gallery/images; ensure image_url/cover_url columns exist
  try {
    await p.request().query(`
IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.restaurants') AND type in (N'U'))
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'image_url' AND Object_ID = Object_ID(N'dbo.restaurants'))
    ALTER TABLE dbo.restaurants ADD image_url NVARCHAR(512) NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'cover_url' AND Object_ID = Object_ID(N'dbo.restaurants'))
    ALTER TABLE dbo.restaurants ADD cover_url NVARCHAR(512) NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'status' AND Object_ID = Object_ID(N'dbo.restaurants'))
    ALTER TABLE dbo.restaurants ADD status NVARCHAR(20) NOT NULL CONSTRAINT DF_restaurants_status DEFAULT 'draft';
END

IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.explore_places') AND type in (N'U'))
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'image_url' AND Object_ID = Object_ID(N'dbo.explore_places'))
    ALTER TABLE dbo.explore_places ADD image_url NVARCHAR(MAX) NULL;
  ELSE ALTER TABLE dbo.explore_places ALTER COLUMN image_url NVARCHAR(MAX) NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'cover_url' AND Object_ID = Object_ID(N'dbo.explore_places'))
    ALTER TABLE dbo.explore_places ADD cover_url NVARCHAR(512) NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'status' AND Object_ID = Object_ID(N'dbo.explore_places'))
    ALTER TABLE dbo.explore_places ADD status NVARCHAR(20) NOT NULL CONSTRAINT DF_explore_status DEFAULT 'draft';
END
`);
    console.log('[DB] migrate: standardized image_url/cover_url');
  } catch (e) {
    console.error('[DB] migrate error (images->columns):', e);
  }

  // Failsafe: ensure status columns regardless of above block
  try {
    await p.request().query(`
IF COL_LENGTH('dbo.restaurants','status') IS NULL ALTER TABLE dbo.restaurants ADD status NVARCHAR(20) NOT NULL CONSTRAINT DF_restaurants_status2 DEFAULT 'draft';
IF COL_LENGTH('dbo.explore_places','status') IS NULL ALTER TABLE dbo.explore_places ADD status NVARCHAR(20) NOT NULL CONSTRAINT DF_explore_status2 DEFAULT 'draft';
IF COL_LENGTH('dbo.sliders','status') IS NULL ALTER TABLE dbo.sliders ADD status NVARCHAR(20) NOT NULL CONSTRAINT DF_sliders_status3 DEFAULT 'draft';
`);
  } catch (e) {
    console.error('[DB] migrate error (failsafe status):', e);
  }

  // Backfill single URL -> JSON array (idempotent)
  try {
    await p.request().query(`
    -- Explore: wrap non-JSON values
    UPDATE dbo.explore_places
    SET image_url = '[' + '"' + REPLACE(CAST(image_url AS NVARCHAR(MAX)), '"', '\\"') + '"' + ']'
    WHERE image_url IS NOT NULL AND ISJSON(image_url) <> 1;
    -- Restaurants: ensure MAX and wrap
    ALTER TABLE dbo.restaurants ALTER COLUMN image_url NVARCHAR(MAX) NULL;
    UPDATE dbo.restaurants
    SET image_url = '[' + '"' + REPLACE(CAST(image_url AS NVARCHAR(MAX)), '"', '\\"') + '"' + ']'
    WHERE image_url IS NOT NULL AND ISJSON(image_url) <> 1;
    `);
    console.log('[DB] migrate: image_url backfilled to JSON arrays');
  } catch (e) {
    console.error('[DB] migrate error (json backfill):', e);
  }
  // idempotent creation using IF NOT EXISTS patterns
  await p.request().query(`
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[sliders]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[sliders] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    [title] NVARCHAR(200) NULL,
    [image_url] NVARCHAR(1000) NOT NULL,
    [position] INT NOT NULL DEFAULT 0,
    [is_published] BIT NOT NULL DEFAULT 1,
    [created_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [row_version] ROWVERSION NOT NULL,
    [status] NVARCHAR(20) NOT NULL CONSTRAINT DF_sliders_status DEFAULT 'draft'
  );
END

-- Ensure row_version column exists (idempotent)
IF EXISTS (SELECT 1 FROM sys.objects WHERE object_id = OBJECT_ID(N'dbo.sliders') AND type in (N'U'))
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'row_version' AND Object_ID = Object_ID(N'dbo.sliders'))
    ALTER TABLE dbo.sliders ADD [row_version] ROWVERSION NOT NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'status' AND Object_ID = Object_ID(N'dbo.sliders'))
    ALTER TABLE dbo.sliders ADD [status] NVARCHAR(20) NOT NULL CONSTRAINT DF_sliders_status2 DEFAULT 'draft';
END

-- Unique index on position (1..N)
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_sliders_position' AND object_id = OBJECT_ID(N'dbo.sliders'))
BEGIN
  CREATE UNIQUE INDEX UX_sliders_position ON dbo.sliders(position);
END

-- Backfill status from is_published (guarded)
IF COL_LENGTH('dbo.sliders','status') IS NOT NULL
  UPDATE dbo.sliders SET status = CASE WHEN is_published = 1 THEN 'published' ELSE 'draft' END WHERE status IS NULL OR status = '';
IF COL_LENGTH('dbo.restaurants','status') IS NOT NULL
  UPDATE dbo.restaurants SET status = CASE WHEN is_published = 1 THEN 'published' ELSE 'draft' END WHERE status IS NULL OR status = '';
IF COL_LENGTH('dbo.explore_places','status') IS NOT NULL
  UPDATE dbo.explore_places SET status = CASE WHEN is_published = 1 THEN 'published' ELSE 'draft' END WHERE status IS NULL OR status = '';

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[restaurants]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[restaurants] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    [name] NVARCHAR(200) NOT NULL,
    [cuisine] NVARCHAR(120) NULL,
    [phone] NVARCHAR(40) NULL,
    [address] NVARCHAR(400) NULL,
    [lat] FLOAT NULL,
    [lng] FLOAT NULL,
    [image_url] NVARCHAR(1000) NULL,
    [is_sponsor] BIT NOT NULL DEFAULT 0,
    [is_published] BIT NOT NULL DEFAULT 1,
    [created_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[routes]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[routes] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    [code] NVARCHAR(20) NOT NULL,
    [title] NVARCHAR(200) NULL,
    [description] NVARCHAR(MAX) NULL,
    [pdf_url] NVARCHAR(1000) NULL,
    [image_url] NVARCHAR(1000) NULL,
    [series] NVARCHAR(10) NULL,
    [is_published] BIT NOT NULL DEFAULT 0,
    [created_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2 NULL
  );
  CREATE INDEX IX_routes_code ON routes(code);
END

-- Ensure unique index on routes.code
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UQ_routes_code' AND object_id = OBJECT_ID(N'routes'))
BEGIN
  CREATE UNIQUE INDEX UQ_routes_code ON routes(code);
END

-- route_series catalog table for managing available series options
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[route_series]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[route_series] (
    [name] NVARCHAR(20) NOT NULL PRIMARY KEY,
    [active] BIT NOT NULL DEFAULT 1,
    [created_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END

-- Bootstrap route_series with distinct existing series from routes
INSERT INTO route_series(name)
SELECT DISTINCT series FROM routes r
WHERE r.series IS NOT NULL AND NOT EXISTS (SELECT 1 FROM route_series s WHERE s.name = r.series);

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[explore_places]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[explore_places] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    [name] NVARCHAR(200) NOT NULL,
    [category] NVARCHAR(80) NULL,
    [description] NVARCHAR(MAX) NULL,
    [address] NVARCHAR(400) NULL,
    [lat] FLOAT NULL,
    [lng] FLOAT NULL,
    [map_url] NVARCHAR(1000) NULL,
    [cover_url] NVARCHAR(1000) NULL,
    [is_published] BIT NOT NULL DEFAULT 1,
    [created_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [updated_at] DATETIME2 NULL
  );
END

-- Deprecated: explore_place_gallery (removed)

-- Add map_url column to explore_places if missing (backward compatible)
IF EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[explore_places]') AND type in (N'U'))
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM sys.columns WHERE Name = N'map_url' AND Object_ID = Object_ID(N'explore_places')
  )
  BEGIN
    ALTER TABLE [dbo].[explore_places] ADD [map_url] NVARCHAR(1000) NULL;
  END
  -- no gallery backfill anymore
END

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[feedback]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[feedback] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    [name] NVARCHAR(120) NULL,
    [email] NVARCHAR(255) NULL,
    [message] NVARCHAR(MAX) NOT NULL,
    [created_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    [handled] BIT NOT NULL DEFAULT 0
  );
END

-- users table for admin roles
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[users]') AND type in (N'U'))
BEGIN
  CREATE TABLE [dbo].[users] (
    [id] UNIQUEIDENTIFIER NOT NULL DEFAULT NEWID() PRIMARY KEY,
    [email] NVARCHAR(255) NOT NULL UNIQUE,
    [password_hash] NVARCHAR(255) NOT NULL,
    [role] NVARCHAR(50) NOT NULL DEFAULT 'viewer', -- admin | editor | viewer
    [created_at] DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
  );
END

`);

  // Seed: ensure at least one admin user (dev-only default)
  if (process.env.NODE_ENV !== 'production') {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
    const hash = bcrypt.hashSync(adminPassword, 10);
    await p
      .request()
      .input('email', adminEmail)
      .input('hash', hash)
      .query(`
        IF NOT EXISTS (SELECT 1 FROM users WHERE email = @email)
        BEGIN
          INSERT INTO users (email, password_hash, role) VALUES (@email, @hash, 'admin');
        END
      `);
  }
}

export type Restaurant = {
  id: string;
  name: string;
  cuisine?: string | null;
  phone?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  image_url?: string | null;
  is_sponsor: boolean;
  is_published: boolean;
  created_at: Date;
};


