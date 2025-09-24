import { Router } from 'express';
import sql from 'mssql';
import multer from 'multer';
import { getPool } from '../db';
import { uploadBuffer } from '../azureBlob';
import { BlobSASPermissions, BlobServiceClient, SASProtocol, StorageSharedKeyCredential, generateBlobSASQueryParameters } from '@azure/storage-blob';
import { config } from '../config';
import { requireRoleAtLeast } from '../middleware/auth';

const upload = multer();
export const restaurantsRouter = Router();

function normalizePhone10(input: any): string | null {
  if (typeof input !== 'string') return null;
  const digits = input.replace(/\D+/g, '');
  if (!digits) return null;
  return digits.slice(-10);
}

// Strict normalization: accept 0XXXXXXXXXX, +90XXXXXXXXXX, 90XXXXXXXXXX, 0090XXXXXXXXXX
// Return national format starting with 0 and 11 digits or null if invalid
function normalizePhoneStrict(input: any): string | null {
  if (typeof input !== 'string') return null;
  let digits = input.replace(/\D+/g, '');
  if (!digits) return null;
  if (digits.startsWith('0090')) digits = digits.slice(4);
  if (digits.startsWith('90') && digits.length === 12) digits = '0' + digits.slice(2);
  if (digits.length === 10) digits = '0' + digits;
  if (digits.startsWith('0') && digits.length === 11) return digits;
  return null;
}

// Public list with filters
restaurantsRouter.get('/', async (req, res) => {
  const pool = await getPool();
  const published = (req.query.published as string | undefined)?.toLowerCase();
  // Tri-state handling: undefined => default only published; 'true' => 1; 'false' => 0; anything else => no filter
  let publishedValue: 1 | 0 | null;
  if (published === undefined) publishedValue = 1; // default behavior for public/mobile
  else if (published === 'true' || published === '1') publishedValue = 1;
  else if (published === 'false' || published === '0') publishedValue = 0;
  else publishedValue = null; // treat unknown as no filter
  const cuisine = (req.query.cuisine as string | undefined) || '';
  const q = (req.query.q as string | undefined) || '';

  const where: string[] = [];
  if (published !== undefined && published !== 'all' && published !== 'hepsi') where.push('is_published = @is_published');
  if (cuisine) where.push('cuisine = @cuisine');
  if (q) where.push('(name LIKE @q OR address LIKE @q)');

  const sql = `
    SELECT TOP (500) id, name, cuisine, phone, address, lat, lng, image_url, cover_url, is_sponsor, is_published
    FROM restaurants
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY created_at DESC
  `;
  const reqst = pool.request();
  if (cuisine) reqst.input('cuisine', cuisine);
  if (q) reqst.input('q', `%${q}%`);
  if (published !== undefined && published !== 'all' && published !== 'hepsi') reqst.input('is_published', publishedValue);
  const result = await reqst.query(sql);
  const data = result.recordset.map((row:any) => ({
    ...row,
    image_url: (()=>{ try { return row.image_url ? JSON.parse(row.image_url) : []; } catch { return []; } })(),
    cover_image: row.cover_url || null,
  }));
  res.json(data);
});

// Get by id
restaurantsRouter.get('/:id', async (req, res) => {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('id', req.params.id)
    .query('SELECT *, cover_url AS cover_image FROM restaurants WHERE id = @id');
  if (result.recordset.length === 0) return res.status(404).json({ message: 'Not found' });
  const row:any = result.recordset[0];
  const parsed = {
    ...row,
    image_url: (()=>{ try { return row.image_url ? JSON.parse(row.image_url) : []; } catch { return []; } })(),
  };
  res.json(parsed);
});

// Create
restaurantsRouter.post('/', requireRoleAtLeast('editor'), upload.single('image'), async (req, res) => {
  const pool = await getPool();
  let imageUrl: string | null = (req.body?.image_url as string | undefined) ?? null;
  let coverUrl: string | null = (req.body?.cover_url as string | undefined) ?? null;
  if (!imageUrl && req.file) {
    imageUrl = await uploadBuffer(req.file.buffer, req.file.originalname, 'food');
  }
  const { name, cuisine, phone, address, lat, lng, is_sponsor, is_published } = req.body as any;
  // Required field validation
  if (!name || !cuisine || !phone || !address || typeof lat === 'undefined' || typeof lng === 'undefined') {
    return res.status(400).json({ message: 'Zorunlu alanlar eksik' });
  }
  const normalized = normalizePhoneStrict(String(phone));
  if (!normalized) {
    return res.status(400).json({ message: 'Geçerli bir telefon numarası giriniz' });
  }
  const nphone = normalizePhone10(normalized);
  // Unique name check (case-insensitive)
  const exists = await pool.request().input('name', name).query(`SELECT 1 FROM restaurants WHERE LOWER(name) = LOWER(@name)`);
  if (exists.recordset.length) {
    return res.status(409).json({ code: 'DUPLICATE_NAME', message: 'Aynı isimde restoran mevcut' });
  }
  // Unique phone check (normalized last 10 digits)
  const phoneDup = await pool.request().input('nphone', nphone).query(`
    SELECT 1 FROM restaurants
    WHERE RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(phone,'') ,' ',''),'-',''),'(',')'),'+' ,''),'.',''), 10) = @nphone
  `);
  if (phoneDup.recordset.length) {
    return res.status(409).json({ code: 'phone_taken', message: 'Aynı telefon numarası mevcut' });
  }
  const isSponsorBit = toBit(is_sponsor);
  const isPublishedBit = toBit(is_published);
  const result = await pool
    .request()
    .input('name', name)
    .input('cuisine', cuisine || null)
    .input('phone', normalized)
    .input('address', address || null)
    .input('lat', lat ? Number(lat) : null)
    .input('lng', lng ? Number(lng) : null)
    .input('image_url', imageUrl)
    .input('cover_url', coverUrl)
    .input('is_sponsor', isSponsorBit)
    .input('is_published', isPublishedBit)
    .query(`
      DECLARE @id UNIQUEIDENTIFIER = NEWID();
      INSERT INTO restaurants (id, name, cuisine, phone, address, lat, lng, image_url, cover_url, is_sponsor, is_published)
      VALUES (@id, @name, @cuisine, @phone, @address, @lat, @lng, @image_url, @cover_url, @is_sponsor, @is_published);
      SELECT * FROM restaurants WHERE id = @id;
    `);
  res.status(201).json(result.recordset[0]);
});

// Update
restaurantsRouter.put('/:id', requireRoleAtLeast('editor'), upload.single('image'), async (req, res) => {
  const pool = await getPool();
  let imageUrl: string | null | undefined = (req.body?.image_url as string | undefined);
  let coverUrl: string | null | undefined = (req.body?.cover_url as string | undefined);
  let imageSet = false;
  let coverSet = false;
  if (typeof imageUrl !== 'undefined') {
    imageSet = true;
    if (imageUrl !== null && typeof imageUrl === 'string' && imageUrl.trim() === '') imageUrl = null;
  }
  if (typeof coverUrl !== 'undefined') {
    coverSet = true;
    if (coverUrl !== null && typeof coverUrl === 'string' && coverUrl.trim() === '') coverUrl = null;
  }
  if (req.file) {
    imageUrl = await uploadBuffer(req.file.buffer, req.file.originalname, 'food');
    imageSet = true;
  }
  const { name, cuisine, phone, address, lat, lng, is_sponsor, is_published } = req.body as any;
  // Required field validation
  if (!name || !cuisine || !phone || !address || typeof lat === 'undefined' || typeof lng === 'undefined') {
    return res.status(400).json({ message: 'Zorunlu alanlar eksik' });
  }
  const normalized = normalizePhoneStrict(String(phone));
  if (!normalized) {
    return res.status(400).json({ message: 'Geçerli bir telefon numarası giriniz' });
  }
  // Unique name check excluding current id
  const dup = await pool
    .request()
    .input('id', sql.UniqueIdentifier, req.params.id)
    .input('name', name)
    .query(`SELECT 1 FROM restaurants WHERE LOWER(name) = LOWER(@name) AND id <> @id`);
  if (dup.recordset.length) {
    return res.status(409).json({ code: 'DUPLICATE_NAME', message: 'Aynı isimde restoran mevcut' });
  }
  // If phone unchanged (normalized), allow; else check duplicates excluding current id
  const existingRow = await pool.request().input('id', sql.UniqueIdentifier, req.params.id).query(`SELECT phone FROM restaurants WHERE id = @id`);
  const existingNorm = normalizePhone10(existingRow.recordset[0]?.phone || '');
  const nphone = normalizePhone10(normalized);
  if (nphone && nphone !== existingNorm) {
    const phoneDup2 = await pool.request()
      .input('id', sql.UniqueIdentifier, req.params.id)
      .input('nphone', nphone)
      .query(`
        SELECT 1 FROM restaurants
        WHERE id <> @id
          AND RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(ISNULL(phone,'') ,' ',''),'-',''),'(',')'),'+' ,''),'.',''), 10) = @nphone
      `);
    if (phoneDup2.recordset.length) {
      return res.status(409).json({ code: 'phone_taken', message: 'Aynı telefon numarası mevcut' });
    }
  }
  const isSponsorBit = toBit(is_sponsor);
  const isPublishedBit = toBit(is_published);
  const result = await pool
    .request()
    .input('id', req.params.id)
    .input('name', name)
    .input('cuisine', cuisine || null)
    .input('phone', normalized)
    .input('address', address || null)
    .input('lat', lat ? Number(lat) : null)
    .input('lng', lng ? Number(lng) : null)
    .input('image_url', (typeof imageUrl === 'undefined') ? null : imageUrl)
    .input('image_set', imageSet ? 1 : 0)
    .input('cover_url', (typeof coverUrl === 'undefined') ? null : coverUrl)
    .input('cover_set', coverSet ? 1 : 0)
    .input('is_sponsor', isSponsorBit)
    .input('is_published', isPublishedBit)
    .query(`
      UPDATE restaurants SET
        name = @name,
        cuisine = @cuisine,
        phone = @phone,
        address = @address,
        lat = @lat,
        lng = @lng,
        image_url = CASE WHEN @image_set = 1 THEN @image_url ELSE image_url END,
        cover_url = CASE WHEN @cover_set = 1 THEN @cover_url ELSE cover_url END,
        is_sponsor = @is_sponsor,
        is_published = @is_published
      WHERE id = @id;
      SELECT * FROM restaurants WHERE id = @id;
    `);
  if (result.recordset.length === 0) return res.status(404).json({ message: 'Not found' });
  res.json(result.recordset[0]);
});

// IMAGES API for restaurants (auth)
restaurantsRouter.get('/:id/images', requireRoleAtLeast('editor'), async (req, res) => {
  const pool = await getPool();
  const r = await pool.request().input('id', req.params.id).query('SELECT image_url FROM restaurants WHERE id = @id');
  if (!r.recordset.length) return res.status(404).json({ message: 'Not found' });
  const raw = r.recordset[0].image_url as string | null;
  const images: string[] = raw && (JSON.parse(raw) as string[]) || [];
  res.json({ images });
});

restaurantsRouter.put('/:id/images', requireRoleAtLeast('editor'), async (req, res) => {
  const { images } = req.body as { images: string[] };
  if (!Array.isArray(images)) return res.status(400).json({ message: 'images must be array' });
  const pool = await getPool();
  const json = JSON.stringify(images);
  await pool.request().input('id', req.params.id).input('json', json).query('UPDATE restaurants SET image_url = @json WHERE id = @id');
  res.json({ images });
});

restaurantsRouter.post('/:id/images', requireRoleAtLeast('editor'), async (req, res) => {
  const { url } = req.body as { url: string };
  if (!url || typeof url !== 'string') return res.status(400).json({ message: 'url required' });
  const pool = await getPool();
  const r = await pool.request().input('id', req.params.id).query('SELECT image_url, cover_url FROM restaurants WHERE id = @id');
  if (!r.recordset.length) return res.status(404).json({ message: 'Not found' });
  const raw = r.recordset[0].image_url as string | null;
  const cover = r.recordset[0].cover_url as string | null;
  const arr: string[] = raw && (JSON.parse(raw) as string[]) || [];
  if (!arr.includes(url)) arr.push(url);
  const json = JSON.stringify(arr);
  const newCover = cover || url;
  await pool.request().input('id', req.params.id).input('json', json).input('cover', newCover).query('UPDATE restaurants SET image_url = @json, cover_url = COALESCE(cover_url, @cover) WHERE id = @id');
  res.status(201).json({ images: arr, cover_url: newCover });
});

restaurantsRouter.delete('/:id/images', requireRoleAtLeast('editor'), async (req, res) => {
  const { url } = req.body as { url: string };
  if (!url || typeof url !== 'string') return res.status(400).json({ message: 'url required' });
  const pool = await getPool();
  const r = await pool.request().input('id', req.params.id).query('SELECT image_url, cover_url FROM restaurants WHERE id = @id');
  if (!r.recordset.length) return res.status(404).json({ message: 'Not found' });
  let arr: string[] = r.recordset[0].image_url ? (JSON.parse(r.recordset[0].image_url) as string[]) : [];
  arr = arr.filter((u) => u !== url);
  const json = JSON.stringify(arr);
  let cover = r.recordset[0].cover_url as string | null;
  if (cover === url) cover = arr[0] || null;
  await pool.request().input('id', req.params.id).input('json', json).input('cover', cover).query('UPDATE restaurants SET image_url = @json, cover_url = @cover WHERE id = @id');
  res.json({ images: arr, cover_url: cover });
});

// Delete
restaurantsRouter.delete('/:id', requireRoleAtLeast('admin'), async (req, res) => {
  const pool = await getPool();
  const result = await pool.request().input('id', req.params.id).query('DELETE FROM restaurants WHERE id = @id');
  if (result.rowsAffected[0] === 0) return res.status(404).json({ message: 'Not found' });
  res.status(204).send();
});

// Set cover_url only
restaurantsRouter.put('/:id/cover', requireRoleAtLeast('editor'), async (req, res) => {
  const { cover_url } = req.body as { cover_url?: string | null };
  const pool = await getPool();
  await pool.request().input('id', req.params.id).input('cover', cover_url || null).query('UPDATE restaurants SET cover_url = @cover WHERE id = @id');
  const r = await pool.request().input('id', req.params.id).query('SELECT *, cover_url AS cover_image FROM restaurants WHERE id = @id');
  if (!r.recordset.length) return res.status(404).json({ message: 'Not found' });
  res.json(r.recordset[0]);
});

// Admin: delete a blob by absolute URL
restaurantsRouter.post('/delete-blob', requireRoleAtLeast('editor'), async (req, res) => {
  try {
    const { url } = req.body as { url?: string };
    if (!url || typeof url !== 'string') return res.status(400).json({ message: 'url required' });
    const devConn =
      'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;';
    const conn = config.azure.connectionString || devConn;
    const client = BlobServiceClient.fromConnectionString(conn);
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    const accountName = config.azure.accountName || 'devstoreaccount1';
    // Handle both Azure (/<container>/<blob>) and Azurite (/<account>/<container>/<blob>) path styles
    const containerName = parts[0] === accountName ? parts[1] : parts[0];
    const blobName = (parts[0] === accountName ? parts.slice(2) : parts.slice(1)).join('/');
    if (!containerName || !blobName) return res.status(400).json({ message: 'invalid url' });
    const container = client.getContainerClient(containerName);
    try {
      await container.deleteBlob(blobName, { deleteSnapshots: 'include' });
    } catch (err: any) {
      // If blob not found, still consider success for idempotency
      const msg = String(err?.message || '');
      if (!/BlobNotFound/i.test(msg)) throw err;
    }
    res.json({ ok: true });
  } catch (e) {
    console.error('[food delete-blob] error', e);
    res.status(500).json({ message: 'Blob delete failed' });
  }
});

// Admin: generate SAS for food/ uploads (cover images)
restaurantsRouter.post('/upload-sas', requireRoleAtLeast('editor'), async (req, res) => {
  const { type, size, filename } = req.body as { type: 'image'; size?: number; filename?: string };
  if (type !== 'image') return res.status(400).json({ message: 'Invalid type' });
  if (typeof size === 'number' && size > 5 * 1024 * 1024) return res.status(400).json({ message: 'Max size 5MB' });
  const folder = 'food';
  const orig = (filename || '').toLowerCase();
  const safeBase = orig ? orig.replace(/[^a-z0-9_.-]+/g, '-') : `image-${Math.random().toString(36).slice(2)}.png`;
  const ext = safeBase.includes('.') ? safeBase.split('.').pop()! : 'png';
  if (!['png','jpg','jpeg','webp'].includes(ext)) return res.status(400).json({ message: 'Unsupported image type' });
  try {
    const devConn =
      'DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;';
    const conn = config.azure.connectionString || devConn;
    const client = BlobServiceClient.fromConnectionString(conn);
    const container = client.getContainerClient(config.azure.container);
    await container.createIfNotExists();
    try { await container.setAccessPolicy('container'); } catch {}
    const credential = (client as any).credential as StorageSharedKeyCredential;
    const expiresOn = new Date(Date.now() + 10 * 60 * 1000);
    const permissions = BlobSASPermissions.parse('cw');
    const blobName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const sas = generateBlobSASQueryParameters(
      { containerName: container.containerName, blobName, permissions, protocol: SASProtocol.HttpsAndHttp, expiresOn },
      credential
    ).toString();
    const url = `${container.getBlockBlobClient(blobName).url}?${sas}`;
    res.json({ uploadUrl: url, blobUrl: container.getBlockBlobClient(blobName).url, expiresOn });
  } catch (e) {
    console.error('[SAS] food upload-sas error:', e);
    res.status(500).json({ message: 'SAS generation failed' });
  }
});

function toBit(value: any): number {
  if (typeof value === 'number') return value ? 1 : 0;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return (v === '1' || v === 'true' || v === 'on' || v === 'yes') ? 1 : 0;
  }
  return 0;
}


