import { Router } from 'express';
import { getPool } from '../db';
import { requireAdmin, requireRoleAtLeast } from '../middleware/auth';
import { BlobSASPermissions, BlobServiceClient, SASProtocol, generateBlobSASQueryParameters, StorageSharedKeyCredential } from '@azure/storage-blob';
import { config } from '../config';

export const transportRoutesRouter = Router();

// Async error wrapper to prevent unhandled promise rejections from crashing the process
const wrap = <T extends (...args: any[]) => Promise<any>>(fn: T) => (req: any, res: any, next: any) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Public list with filters
transportRoutesRouter.get('/', wrap(async (req, res) => {
  const pool = await getPool();
  const series = (req.query.series as string) || undefined;
  const query = (req.query.query as string) || undefined;
  const published = (req.query.published as string | undefined)?.toLowerCase();
  // Filtreleme kuralları:
  // - published === 'true' | '1' => is_published = 1
  // - published === 'false' | '0' => is_published = 0
  // - published parametresi yok => varsayılan olarak is_published = 1 (public default)
  // - 'all' | 'hepsi' => filtre uygulanmaz
  const applyPublishedFilter = published !== 'all' && published !== 'hepsi';
  const forcePublishedTrue = published === 'true' || published === '1' || published === undefined;

  let sqlText = 'SELECT * FROM routes WHERE 1=1';
  if (applyPublishedFilter) {
    if (forcePublishedTrue) sqlText += ' AND is_published = 1';
    else sqlText += ' AND is_published = 0';
  }
  if (series) sqlText += ' AND series = @series';
  if (query) sqlText += ' AND (code LIKE @q OR title LIKE @q)';
  sqlText += ' ORDER BY code';

  const r = await pool
    .request()
    .input('series', series || null)
    .input('q', query ? `%${query}%` : null)
    .query(sqlText);
  res.json(r.recordset);
}));

// Series management endpoints
transportRoutesRouter.get('/series/list', wrap(async (_req, res) => {
  const pool = await getPool();
  // Prefer catalog if exists; fallback to distinct from routes
  try {
    const hasCatalog = await pool.request().query(`SELECT 1 FROM sys.objects WHERE name = 'route_series' AND type = 'U'`);
    if (hasCatalog.recordset.length) {
      const r = await pool.request().query(`SELECT name FROM route_series WHERE active = 1 ORDER BY name`);
      return res.json(r.recordset.map((x: any) => x.name));
    }
  } catch {}
  const r = await pool.request().query(`SELECT DISTINCT series FROM routes WHERE series IS NOT NULL ORDER BY series`);
  const values = r.recordset.map((row: any) => row.series).filter((s: any) => !!s);
  res.json(values);
}));

// Add or remove a series in catalog
transportRoutesRouter.post('/series', requireRoleAtLeast('editor'), async (req, res) => {
  const { name } = req.body as { name?: string };
  if (!name) return res.status(400).json({ message: 'name required' });
  const pool = await getPool();
  await pool.request().input('name', name).query(`
    IF NOT EXISTS (SELECT 1 FROM route_series WHERE name = @name)
      INSERT INTO route_series(name, active) VALUES(@name, 1)
    ELSE
      UPDATE route_series SET active = 1 WHERE name = @name
  `);
  res.json({ ok: true });
});

transportRoutesRouter.delete('/series/:name', requireRoleAtLeast('editor'), async (req, res) => {
  const name = req.params.name;
  const pool = await getPool();

  // Fetch routes under this series to optionally delete blobs
  const existing = await pool.request().input('name', name).query(`SELECT id, pdf_url, image_url FROM routes WHERE series = @name`);
  if (config.auth.deleteBlobsOnRouteDelete) {
    for (const row of existing.recordset) {
      await tryDeleteBlobByUrl(row.pdf_url);
      await tryDeleteBlobByUrl(row.image_url);
    }
  }

  // Delete all routes in the series
  await pool.request().input('name', name).query(`DELETE FROM routes WHERE series = @name`);

  // Deactivate series in catalog if present
  await pool.request().input('name', name).query(`
    IF EXISTS (SELECT 1 FROM route_series WHERE name = @name)
      UPDATE route_series SET active = 0 WHERE name = @name
  `);

  res.status(204).send();
});

// Public by code
transportRoutesRouter.get('/:code', wrap(async (req, res) => {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('code', req.params.code)
    .query('SELECT TOP 1 * FROM routes WHERE code = @code AND is_published = 1');
  if (!r.recordset.length) return res.status(404).json({ message: 'Not found' });
  res.json(r.recordset[0]);
}));

// Admin create
transportRoutesRouter.post('/', requireRoleAtLeast('editor'), wrap(async (req, res) => {
  const pool = await getPool();
  const { code, title, description, pdf_url, image_url, series, is_published } = req.body;
  const result = await pool
    .request()
    .input('code', code)
    .input('title', title || null)
    .input('description', description || null)
    .input('pdf_url', pdf_url || null)
    .input('image_url', image_url || null)
    .input('series', series || null)
    .input('is_published', is_published ? 1 : 0)
    .query(`
      DECLARE @id UNIQUEIDENTIFIER = NEWID();
      INSERT INTO routes (id, code, title, description, pdf_url, image_url, series, is_published)
      VALUES (@id, @code, @title, @description, @pdf_url, @image_url, @series, @is_published);
      SELECT * FROM routes WHERE id = @id;
    `);
  res.status(201).json(result.recordset[0]);
}));

// Admin update
transportRoutesRouter.put('/:id', requireRoleAtLeast('editor'), wrap(async (req, res) => {
  const pool = await getPool();
  const { code, title, description, pdf_url, image_url, series, is_published } = req.body;
  const result = await pool
    .request()
    .input('id', req.params.id)
    .input('code', code)
    .input('title', title || null)
    .input('description', description || null)
    .input('pdf_url', pdf_url || null)
    .input('image_url', image_url || null)
    .input('series', series || null)
    .input('is_published', is_published ? 1 : 0)
    .query(`
      UPDATE routes SET
        code = @code,
        title = @title,
        description = @description,
        pdf_url = @pdf_url,
        image_url = @image_url,
        series = @series,
        is_published = @is_published,
        updated_at = SYSUTCDATETIME()
      WHERE id = @id;
      SELECT * FROM routes WHERE id = @id;
    `);
  if (!result.recordset.length) return res.status(404).json({ message: 'Not found' });
  res.json(result.recordset[0]);
}));

// Admin delete (optional blob deletion)
transportRoutesRouter.delete('/:id', requireAdmin, wrap(async (req, res) => {
  const pool = await getPool();
  if (config.auth.deleteBlobsOnRouteDelete) {
    const existing = await pool.request().input('id', req.params.id).query('SELECT pdf_url, image_url FROM routes WHERE id = @id');
    const row = existing.recordset[0];
    if (row) {
      await tryDeleteBlobByUrl(row.pdf_url);
      await tryDeleteBlobByUrl(row.image_url);
    }
  }
  const result = await pool.request().input('id', req.params.id).query('DELETE FROM routes WHERE id = @id');
  if (result.rowsAffected[0] === 0) return res.status(404).json({ message: 'Not found' });
  res.status(204).send();
}));

// Admin: delete an existing blob by absolute URL (manual asset removal)
transportRoutesRouter.post('/delete-blob', requireRoleAtLeast('editor'), wrap(async (req, res) => {
  try {
    const { url } = req.body as { url?: string };
    if (!url || typeof url !== 'string') return res.status(400).json({ message: 'url required' });
    await tryDeleteBlobByUrl(url);
    return res.json({ ok: true });
  } catch (e) {
    console.error('[BLOB DELETE] error:', e);
    return res.status(500).json({ message: 'Blob delete failed' });
  }
}));

// Admin: generate SAS for client PUT upload
transportRoutesRouter.post('/upload-sas', requireRoleAtLeast('editor'), wrap(async (req, res) => {
  const { type, size, filename } = req.body as { type: 'pdf' | 'image'; size?: number; filename?: string };
  if (type !== 'pdf' && type !== 'image') return res.status(400).json({ message: 'Invalid type' });
  const max = type === 'pdf' ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
  if (typeof size === 'number' && size > max) return res.status(400).json({ message: `Max size ${max} bytes` });
  const folder = 'transport';
  const orig = (filename || '').toLowerCase();
  const safeBase = orig
    ? orig.replace(/[^a-z0-9_.-]+/g, '-')
    : `${Math.random().toString(36).slice(2)}.${type === 'pdf' ? 'pdf' : 'png'}`;
  const ext = safeBase.includes('.') ? safeBase.split('.').pop()! : (type === 'pdf' ? 'pdf' : 'png');
  if (type === 'pdf' && ext !== 'pdf') return res.status(400).json({ message: 'Expected PDF' });
  if (type === 'image' && !['png', 'jpg', 'jpeg', 'webp'].includes(ext)) return res.status(400).json({ message: 'Unsupported image type' });
  const uuid = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : require('crypto').randomUUID();
  const blobName = `${folder}/${uuid}-${safeBase}`;
  try {
    const sas = await generateWriteSas(blobName, type);
    res.json({ uploadUrl: sas.url, blobUrl: sas.blobUrl, expiresOn: sas.expiresOn });
  } catch (e) {
    console.error('[SAS] transport upload-sas error:', e);
    res.status(500).json({ message: 'SAS generation failed' });
  }
}));

async function generateWriteSas(blobName: string, type: 'pdf' | 'image') {
  const devConn =
    'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;';
  const conn = config.azure.connectionString || devConn;
  const client = BlobServiceClient.fromConnectionString(conn);
  const container = client.getContainerClient(config.azure.container);
  await container.createIfNotExists();
  try { await container.setAccessPolicy('container'); } catch {}
  await ensureCors(client);
  const credential = (client as any).credential as StorageSharedKeyCredential;
  const expiresOn = new Date(Date.now() + 10 * 60 * 1000);
  const permissions = BlobSASPermissions.parse('cw'); // create + write
  const sas = generateBlobSASQueryParameters(
    {
      containerName: container.containerName,
      blobName,
      permissions,
      protocol: SASProtocol.HttpsAndHttp,
      expiresOn
    },
    credential
  ).toString();
  const url = `${container.getBlockBlobClient(blobName).url}?${sas}`;
  return { url, blobUrl: container.getBlockBlobClient(blobName).url, expiresOn };
}

async function ensureCors(client: BlobServiceClient): Promise<void> {
  try {
    const props = await client.getProperties();
    const hasCors = Array.isArray((props as any).cors) && (props as any).cors.length > 0;
    if (!hasCors) {
      await client.setProperties({
        cors: [
          {
            allowedOrigins: '*',
            allowedMethods: 'PUT,GET,HEAD,OPTIONS',
            allowedHeaders: '*',
            exposedHeaders: '*',
            maxAgeInSeconds: 3600
          }
        ]
      });
    }
  } catch {}
}

async function tryDeleteBlobByUrl(url?: string | null) {
  if (!url) return;
  try {
    const client = BlobServiceClient.fromConnectionString(config.azure.connectionString!);
    const { containerName, blobName } = parseBlobUrl(url);
    if (!containerName || !blobName) return;
    const container = client.getContainerClient(containerName);
    await container.deleteBlob(blobName, { deleteSnapshots: 'include' });
  } catch {}
}

function parseBlobUrl(url: string): { containerName?: string; blobName?: string } {
  try {
    const u = new URL(url);
    const [, containerName, ...blobParts] = u.pathname.split('/');
    return { containerName, blobName: blobParts.join('/') };
  } catch {
    return {};
  }
}


