import { Router } from 'express';
import { getPool } from '../db';
import { requireAdmin, requireRoleAtLeast } from '../middleware/auth';
import { BlobServiceClient, BlobSASPermissions, SASProtocol, generateBlobSASQueryParameters, StorageSharedKeyCredential } from '@azure/storage-blob';
import { config } from '../config';

export const exploreRouter = Router();

// Public list with filters
exploreRouter.get('/', async (req, res) => {
  const pool = await getPool();
  const category = (req.query.category as string) || '';
  const q = (req.query.q as string) || '';
  const publishedParam = (req.query.published as string | undefined);
  const parts: string[] = [];
  if (publishedParam === 'true') parts.push('is_published = 1');
  else if (publishedParam === 'false') parts.push('is_published = 0');
  if (category) parts.push('category = @category');
  if (q) parts.push('(name LIKE @q OR description LIKE @q)');
  const where = parts.length ? `WHERE ${parts.join(' AND ')}` : '';
  const sql = `SELECT p.id, p.name, p.category, p.lat, p.lng, p.map_url,
    p.image_url,
    p.cover_url AS cover_image,
    p.is_published,
    p.created_at
    FROM explore_places p ${where} ORDER BY p.created_at DESC`;
  const reqst = pool.request();
  if (category) reqst.input('category', category);
  if (q) reqst.input('q', `%${q}%`);
  const r = await reqst.query(sql);
  const data = r.recordset.map((row:any) => ({
    ...row,
    image_url: (()=>{ try { return row.image_url ? JSON.parse(row.image_url) : []; } catch { return []; } })(),
  }));
  res.json(data);
});

// Public detail by id
exploreRouter.get('/:id', async (req, res) => {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('id', req.params.id)
    .query(`SELECT TOP 1 p.id, p.name, p.category, p.description, p.address, p.lat, p.lng, p.map_url,
      p.image_url,
      p.cover_url AS cover_image,
      p.created_at
      FROM explore_places p WHERE p.id = @id AND p.is_published = 1`);
  if (!r.recordset.length) return res.status(404).json({ message: 'Not found' });
  const place = r.recordset[0];
  const parsed = {
    ...place,
    image_url: (()=>{ try { return place.image_url ? JSON.parse(place.image_url) : []; } catch { return []; } })(),
  };
  res.json(parsed);
});

// Set cover_url only
exploreRouter.put('/:id/cover', requireRoleAtLeast('editor'), async (req, res) => {
  const { cover_url } = req.body as { cover_url?: string | null };
  const pool = await getPool();
  await pool
    .request()
    .input('id', req.params.id)
    .input('cover', cover_url || null)
    .query('UPDATE explore_places SET cover_url = @cover, updated_at = SYSUTCDATETIME() WHERE id = @id');
  const r = await pool
    .request()
    .input('id', req.params.id)
    .query('SELECT *, cover_url AS cover_image FROM explore_places WHERE id = @id');
  if (!r.recordset.length) return res.status(404).json({ message: 'Not found' });
  res.json(r.recordset[0]);
});

// Admin detail (regardless of published)
exploreRouter.get('/admin/:id', requireRoleAtLeast('editor'), async (req, res) => {
  const pool = await getPool();
  const r = await pool
    .request()
    .input('id', req.params.id)
    .query(`SELECT TOP 1 p.id, p.name, p.category, p.description, p.address, p.lat, p.lng, p.map_url,
      p.image_url,
      p.cover_url AS cover_image,
      p.created_at
      FROM explore_places p WHERE p.id = @id`);
  if (!r.recordset.length) return res.status(404).json({ message: 'Not found' });
  const place = r.recordset[0];
  const parsed = {
    ...place,
    image_url: (()=>{ try { return place.image_url ? JSON.parse(place.image_url) : []; } catch { return []; } })(),
  };
  res.json(parsed);
});

// IMAGES API for explore (auth)
exploreRouter.get('/:id/images', requireRoleAtLeast('editor'), async (req, res) => {
  const pool = await getPool();
  const r = await pool.request().input('id', req.params.id).query('SELECT image_url FROM explore_places WHERE id = @id');
  if (!r.recordset.length) return res.status(404).json({ message: 'Not found' });
  const raw = r.recordset[0].image_url as string | null;
  const images: string[] = raw && (JSON.parse(raw) as string[]) || [];
  res.json({ images });
});

exploreRouter.put('/:id/images', requireRoleAtLeast('editor'), async (req, res) => {
  const { images } = req.body as { images: string[] };
  if (!Array.isArray(images)) return res.status(400).json({ message: 'images must be array' });
  const pool = await getPool();
  const json = JSON.stringify(images);
  await pool.request().input('id', req.params.id).input('json', json).query('UPDATE explore_places SET image_url = @json, updated_at = SYSUTCDATETIME() WHERE id = @id');
  res.json({ images });
});

exploreRouter.post('/:id/images', requireRoleAtLeast('editor'), async (req, res) => {
  const { url } = req.body as { url: string };
  if (!url || typeof url !== 'string') return res.status(400).json({ message: 'url required' });
  const pool = await getPool();
  const r = await pool.request().input('id', req.params.id).query('SELECT image_url, cover_url FROM explore_places WHERE id = @id');
  if (!r.recordset.length) return res.status(404).json({ message: 'Not found' });
  const raw = r.recordset[0].image_url as string | null;
  const cover = r.recordset[0].cover_url as string | null;
  const arr: string[] = raw && (JSON.parse(raw) as string[]) || [];
  if (!arr.includes(url)) arr.push(url);
  const json = JSON.stringify(arr);
  const newCover = cover || url;
  await pool.request().input('id', req.params.id).input('json', json).input('cover', newCover).query('UPDATE explore_places SET image_url = @json, cover_url = COALESCE(cover_url, @cover), updated_at = SYSUTCDATETIME() WHERE id = @id');
  res.status(201).json({ images: arr, cover_url: newCover });
});

exploreRouter.delete('/:id/images', requireRoleAtLeast('editor'), async (req, res) => {
  const { url } = req.body as { url: string };
  if (!url || typeof url !== 'string') return res.status(400).json({ message: 'url required' });
  const pool = await getPool();
  const r = await pool.request().input('id', req.params.id).query('SELECT image_url, cover_url FROM explore_places WHERE id = @id');
  if (!r.recordset.length) return res.status(404).json({ message: 'Not found' });
  let arr: string[] = r.recordset[0].image_url ? (JSON.parse(r.recordset[0].image_url) as string[]) : [];
  arr = arr.filter((u) => u !== url);
  const json = JSON.stringify(arr);
  let cover = r.recordset[0].cover_url as string | null;
  if (cover === url) cover = arr[0] || null;
  await pool.request().input('id', req.params.id).input('json', json).input('cover', cover).query('UPDATE explore_places SET image_url = @json, cover_url = @cover, updated_at = SYSUTCDATETIME() WHERE id = @id');
  res.json({ images: arr, cover_url: cover });
});

// Admin create
exploreRouter.post('/', requireRoleAtLeast('editor'), async (req, res) => {
  const pool = await getPool();
  const { name, category, description, address, lat, lng, mapUrl, cover_url, image_url, is_published } = req.body;
  try { await ensureUniqueName(String(name)); } catch (e:any) { return res.status(409).json({ error: 'Bu ad zaten mevcut' }); }
  const isValidMap = (u?: string) => typeof u === 'string' && /^(https:\/\/www\.google\.com\/maps|https:\/\/goo\.gl\/maps)/i.test(u);
  const finalMapUrl = isValidMap(mapUrl) ? mapUrl : (typeof lat === 'number' && typeof lng === 'number' ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` : null);
  const result = await pool
    .request()
    .input('name', name)
    .input('category', category || null)
    .input('description', description || null)
    .input('address', address || null)
    .input('lat', lat ? Number(lat) : null)
    .input('lng', lng ? Number(lng) : null)
    .input('map_url', finalMapUrl)
    .input('cover_url', cover_url || null)
    .input('image_url', image_url || null)
    .input('is_published', is_published ? 1 : 0)
    .query(`
      DECLARE @id UNIQUEIDENTIFIER = NEWID();
      INSERT INTO explore_places (id, name, category, description, address, lat, lng, map_url, cover_url, image_url, is_published)
      VALUES (@id, @name, @category, @description, @address, @lat, @lng, @map_url, @cover_url, @image_url, @is_published);
      SELECT * FROM explore_places WHERE id = @id;
    `);
  res.status(201).json(result.recordset[0]);
});

// Admin update
exploreRouter.put('/:id', requireRoleAtLeast('editor'), async (req, res) => {
  const pool = await getPool();
  const { name, category, description, address, lat, lng, mapUrl, cover_url, image_url, is_published } = req.body;
  try { await ensureUniqueName(String(name), req.params.id); } catch (e:any) { return res.status(409).json({ error: 'Bu ad zaten mevcut' }); }
  const isValidMap = (u?: string) => typeof u === 'string' && /^(https:\/\/www\.google\.com\/maps|https:\/\/goo\.gl\/maps)/i.test(u);
  const finalMapUrl = isValidMap(mapUrl) ? mapUrl : (typeof lat === 'number' && typeof lng === 'number' ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` : null);
  const result = await pool
    .request()
    .input('id', req.params.id)
    .input('name', name)
    .input('category', category || null)
    .input('description', description || null)
    .input('address', address || null)
    .input('lat', lat ? Number(lat) : null)
    .input('lng', lng ? Number(lng) : null)
    .input('map_url', finalMapUrl)
    .input('cover_url', cover_url || null)
    .input('image_url', image_url || null)
    .input('is_published', is_published ? 1 : 0)
    .query(`
      UPDATE explore_places SET
        name = @name,
        category = @category,
        description = @description,
        address = @address,
        lat = @lat,
        lng = @lng,
        map_url = @map_url,
        cover_url = @cover_url,
        image_url = @image_url,
        is_published = @is_published,
        updated_at = SYSUTCDATETIME()
      WHERE id = @id;
      SELECT *, cover_url AS cover_image FROM explore_places WHERE id = @id;
    `);
  if (!result.recordset.length) return res.status(404).json({ message: 'Not found' });
  res.json(result.recordset[0]);
});

// Admin cover delete (idempotent)
exploreRouter.delete('/:id/cover', requireRoleAtLeast('editor'), async (req, res) => {
  const pool = await getPool();
  // Clear legacy column for compatibility
  await pool.request().input('id', req.params.id).query(`UPDATE explore_places SET cover_url = NULL, updated_at = SYSUTCDATETIME() WHERE id = @id`);
  // Remove gallery rows marked as cover
  /* Deprecated gallery table removed */
  return res.status(204).send();
});

// Uniqueness check on name (create/update via constraint-like logic)
async function ensureUniqueName(name: string, excludeId?: string) {
  const pool = await getPool();
  const reqst = pool.request().input('name', name);
  let q = 'SELECT TOP 1 id FROM explore_places WHERE name = @name';
  if (excludeId) { q += ' AND id <> @id'; reqst.input('id', excludeId); }
  const r = await reqst.query(q);
  if (r.recordset.length) {
    const err: any = new Error('Bu ad zaten mevcut');
    err.status = 409;
    throw err;
  }
}

// List distinct categories for select options (public read)
exploreRouter.get('/meta/categories', async (_req, res) => {
  const pool = await getPool();
  const r = await pool.request().query('SELECT DISTINCT category FROM explore_places WHERE category IS NOT NULL ORDER BY category');
  res.json(r.recordset.map((x:any)=> x.category).filter(Boolean));
});

// Admin delete (with cascade gallery)
exploreRouter.delete('/:id', requireRoleAtLeast('admin'), async (req, res) => {
  const pool = await getPool();
  const result = await pool.request().input('id', req.params.id).query('DELETE FROM explore_places WHERE id = @id');
  if (result.rowsAffected[0] === 0) return res.status(404).json({ message: 'Not found' });
  res.status(204).send();
});

// Removed gallery endpoints in new model (single image_url + cover_url)

// Admin: generate SAS for client PUT upload to explore/
exploreRouter.post('/upload-sas', requireRoleAtLeast('editor'), async (req, res) => {
  const { type, size, filename } = req.body as { type: 'image'; size?: number; filename?: string };
  if (type !== 'image') return res.status(400).json({ message: 'Invalid type' });
  if (typeof size === 'number' && size > 5 * 1024 * 1024) return res.status(400).json({ message: 'Max size 5MB' });
  const folder = 'explore';
  const orig = (filename || '').toLowerCase();
  const safeBase = orig ? orig.replace(/[^a-z0-9_.-]+/g, '-') : `image-${Math.random().toString(36).slice(2)}.png`;
  const ext = safeBase.includes('.') ? safeBase.split('.').pop()! : 'png';
  if (!['png','jpg','jpeg','webp'].includes(ext)) return res.status(400).json({ message: 'Unsupported image type' });
  const uuid = (typeof crypto !== 'undefined' && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : require('crypto').randomUUID();
  const blobName = `${folder}/${uuid}-${safeBase}`;
  try {
    const devConn =
      'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;';
    const conn = config.azure.connectionString || devConn;
    const client = BlobServiceClient.fromConnectionString(conn);
    const container = client.getContainerClient(config.azure.container);
    await container.createIfNotExists();
    try {
      await container.setAccessPolicy('container');
    } catch {}
    try {
      const props = await client.getProperties();
      const hasCors = Array.isArray((props as any).cors) && (props as any).cors.length > 0;
      if (!hasCors) {
        await client.setProperties({
          cors: [
            { allowedOrigins: '*', allowedMethods: 'PUT,GET,HEAD,OPTIONS', allowedHeaders: '*', exposedHeaders: '*', maxAgeInSeconds: 3600 }
          ]
        });
      }
    } catch {}
    const credential = (client as any).credential as StorageSharedKeyCredential;
    const expiresOn = new Date(Date.now() + 10 * 60 * 1000);
    const permissions = BlobSASPermissions.parse('cw');
    const sas = generateBlobSASQueryParameters(
      { containerName: container.containerName, blobName, permissions, protocol: SASProtocol.HttpsAndHttp, expiresOn },
      credential
    ).toString();
    const url = `${container.getBlockBlobClient(blobName).url}?${sas}`;
    res.json({ uploadUrl: url, blobUrl: container.getBlockBlobClient(blobName).url, expiresOn });
  } catch (e) {
    console.error('[SAS] explore upload-sas error:', e);
    res.status(500).json({ message: 'SAS generation failed' });
  }
});

// Reorder no longer supported (gallery removed)


