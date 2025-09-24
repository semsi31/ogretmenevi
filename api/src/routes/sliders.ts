  import { Router } from 'express';
import { getPool } from '../db';
import { requireAdmin, requireRoleAtLeast } from '../middleware/auth';
import sql from 'mssql';
import { BlobServiceClient, BlobSASPermissions, SASProtocol, generateBlobSASQueryParameters, StorageSharedKeyCredential } from '@azure/storage-blob';
import { config } from '../config';

export const slidersRouter = Router();

// Public list
slidersRouter.get('/', async (req, res) => {
  const pool = await getPool();
  const published = ((req.query.published as string | undefined) || 'all').toLowerCase();
  const status = ((req.query.status as string | undefined) || '').toLowerCase();
  let where = '';
  if (published === 'true' || published === '1') where = 'WHERE is_published = 1';
  else if (published === 'false' || published === '0') where = 'WHERE is_published = 0';
  if (status === 'draft' || status === 'review' || status === 'published') {
    where = where ? `${where} AND status = @status` : 'WHERE status = @status';
  }
  const q = `SELECT id, image_url, position, is_published, status FROM sliders ${where} ORDER BY position ASC, created_at ASC`;
  const reqst = pool.request();
  if (status === 'draft' || status === 'review' || status === 'published') reqst.input('status', status);
  const r = await reqst.query(q);
  res.json(r.recordset);
});

// Admin create
slidersRouter.post('/', requireRoleAtLeast('editor'), async (req, res) => {
  const pool = await getPool();
  const { title, image_url, is_published } = req.body;
  const r = await pool
    .request()
    .input('title', title || null)
    .input('image_url', image_url)
    .input('is_published', is_published ? 1 : 0)
    .query(`
      DECLARE @id UNIQUEIDENTIFIER = NEWID();
      DECLARE @pos INT = (SELECT ISNULL(MAX(position),0) + 1 FROM sliders);
      INSERT INTO sliders (id, title, image_url, position, is_published)
      VALUES (@id, @title, @image_url, @pos, @is_published);
      SELECT * FROM sliders WHERE id = @id;
    `);
  res.status(201).json(r.recordset[0]);
});

// Admin update
slidersRouter.put('/:id', requireRoleAtLeast('editor'), async (req, res) => {
  const pool = await getPool();
  const { title, image_url, position, is_published, status } = req.body;
  const r = await pool
    .request()
    .input('id', sql.UniqueIdentifier, req.params.id)
    .input('title', title || null)
    .input('image_url', image_url || null)
    .input('position', sql.Int, position != null ? Number(position) : null)
    .input('is_published', sql.Bit, is_published ? 1 : 0)
    .input('status', (status === 'draft' || status === 'review' || status === 'published') ? status : null)
    .query(`
      UPDATE sliders SET
        title = @title,
        image_url = COALESCE(@image_url, image_url),
        position = COALESCE(@position, position),
        is_published = @is_published,
        status = COALESCE(@status, status)
      WHERE id = @id;
      SELECT * FROM sliders WHERE id = @id;
    `);
  if (!r.recordset.length) return res.status(404).json({ message: 'Not found' });
  res.json(r.recordset[0]);
});

// Publish toggle: set is_published only
slidersRouter.put('/:id/publish', requireRoleAtLeast('editor'), async (req, res) => {
  try {
    const { is_published } = req.body as { is_published?: boolean };
    if (typeof is_published !== 'boolean') return res.status(400).json({ message: 'is_published required' });
    const pool = await getPool();
    const r = await pool.request()
      .input('id', sql.UniqueIdentifier, req.params.id)
      .input('p', sql.Bit, is_published ? 1 : 0)
      .query(`UPDATE sliders SET is_published = @p, status = CASE WHEN @p = 1 THEN 'published' ELSE 'draft' END WHERE id = @id; SELECT id, image_url, position, is_published, status FROM sliders WHERE id = @id`);
    if (!r.recordset.length) return res.status(404).json({ message: 'Not found' });
    console.log('[sliders:publish]', { id: req.params.id, is_published });
    return res.json(r.recordset[0]);
  } catch (e:any) {
    console.error('[sliders:publish] error', e?.message || e);
    return res.status(500).json({ message: 'internal error' });
  }
});

// Admin delete
slidersRouter.delete('/:id', requireRoleAtLeast('admin'), async (req, res) => {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const r = await new sql.Request(tx).input('id', sql.UniqueIdentifier, req.params.id).query('DELETE FROM sliders WHERE id = @id');
    if (r.rowsAffected[0] === 0) { await tx.rollback(); return res.status(404).json({ message: 'Not found' }); }
    // Renumber 1..N
    await new sql.Request(tx).batch(`
      WITH ordered AS (
        SELECT id, ROW_NUMBER() OVER (ORDER BY position ASC, created_at ASC) AS rn FROM sliders
      )
      UPDATE s SET position = o.rn FROM sliders s JOIN ordered o ON o.id = s.id;
    `);
    await tx.commit();
    res.status(204).send();
  } catch (e) {
    try { await tx.rollback(); } catch {}
    console.error('[sliders:delete] error', e);
    res.status(500).json({ message: 'internal error' });
  }
});

// Update single slider position with atomic swap
slidersRouter.put('/:id/update-position', requireRoleAtLeast('editor'), async (req, res) => {
  try {
    const id = String(req.params.id);
    const { position } = req.body as { position?: number };
    if (!position || !Number.isFinite(position) || position < 1) {
      return res.status(400).json({ message: 'position must be a positive integer' });
    }
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const rq = new sql.Request(tx);
      // fetch current row and bounds
      const cur = await rq.input('id', sql.UniqueIdentifier, id).query('SELECT id, position FROM sliders WHERE id = @id');
      if (!cur.recordset.length) { await tx.rollback(); return res.status(404).json({ message: 'Not found' }); }
      const currentPos: number = Number(cur.recordset[0].position);
      // count total
      const c = await new sql.Request(tx).query('SELECT COUNT(1) AS cnt FROM sliders');
      const total = Number(c.recordset[0].cnt);
      const targetPos = Math.max(1, Math.min(total, Math.trunc(position)));
      if (targetPos === currentPos) { await tx.commit(); return res.json({ id, position: currentPos }); }
      // find row at target position
      const at = await new sql.Request(tx).input('p', sql.Int, targetPos).query('SELECT id FROM sliders WHERE position = @p');
      if (at.recordset.length) {
        const otherId: string = String(at.recordset[0].id);
        // unique index safe swap using temporary high value
        const tempPos = total + 1000;
        await new sql.Request(tx).input('id', sql.UniqueIdentifier, id).input('tp', sql.Int, tempPos).query('UPDATE sliders SET position = @tp WHERE id = @id');
        await new sql.Request(tx).input('oid', sql.UniqueIdentifier, otherId).input('op', sql.Int, currentPos).query('UPDATE sliders SET position = @op WHERE id = @oid');
        await new sql.Request(tx).input('id', sql.UniqueIdentifier, id).input('np', sql.Int, targetPos).query('UPDATE sliders SET position = @np WHERE id = @id');
      } else {
        // no occupant at targetPos; just move safely
        const tempPos = total + 1000;
        await new sql.Request(tx).input('id', sql.UniqueIdentifier, id).input('tp', sql.Int, tempPos).query('UPDATE sliders SET position = @tp WHERE id = @id');
        await new sql.Request(tx).input('id', sql.UniqueIdentifier, id).input('np', sql.Int, targetPos).query('UPDATE sliders SET position = @np WHERE id = @id');
      }
      await tx.commit();
      console.info('[sliders:update-position]', { id, from: currentPos, to: targetPos });
      return res.json({ id, position: targetPos });
    } catch (e) {
      try { await tx.rollback(); } catch {}
      throw e;
    }
  } catch (e:any) {
    console.error('[sliders:update-position] error', e?.message || e);
    return res.status(500).json({ message: 'internal error' });
  }
});

// Move up/down by one based on current DB order (safer for UI +/- buttons)
slidersRouter.patch('/:id/move', requireRoleAtLeast('editor'), async (req, res) => {
  try {
    const id = String(req.params.id);
    const { direction } = req.body as { direction?: 'up' | 'down' };
    if (direction !== 'up' && direction !== 'down') return res.status(400).json({ message: 'direction must be up|down' });
    const pool = await getPool();
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const curQ = await new sql.Request(tx).input('id', sql.UniqueIdentifier, id)
        .query('SELECT id, position FROM sliders WHERE id = @id');
      if (!curQ.recordset.length) { await tx.rollback(); return res.status(404).json({ message: 'Not found' }); }
      const pos = Number(curQ.recordset[0].position);
      // neighbor query
      const neigh = direction === 'up'
        ? await new sql.Request(tx).input('p', sql.Int, pos).query('SELECT TOP 1 id, position FROM sliders WHERE position < @p ORDER BY position DESC')
        : await new sql.Request(tx).input('p', sql.Int, pos).query('SELECT TOP 1 id, position FROM sliders WHERE position > @p ORDER BY position ASC');
      if (!neigh.recordset.length) { await tx.commit(); return res.json({ id, position: pos }); }
      const otherId: string = String(neigh.recordset[0].id);
      const otherPos: number = Number(neigh.recordset[0].position);
      // unique index safe swap with temp
      const tmp = pos + 100000; // sufficiently high
      await new sql.Request(tx).input('id', sql.UniqueIdentifier, id).input('tp', sql.Int, tmp).query('UPDATE sliders SET position = @tp WHERE id = @id');
      await new sql.Request(tx).input('oid', sql.UniqueIdentifier, otherId).input('op', sql.Int, pos).query('UPDATE sliders SET position = @op WHERE id = @oid');
      await new sql.Request(tx).input('id', sql.UniqueIdentifier, id).input('np', sql.Int, otherPos).query('UPDATE sliders SET position = @np WHERE id = @id');
      await tx.commit();
      console.info('[sliders:move]', { id, direction, from: pos, to: otherPos });
      return res.json({ id, position: otherPos });
    } catch (e) {
      try { await tx.rollback(); } catch {}
      throw e;
    }
  } catch (e:any) {
    console.error('[sliders:move] error', e?.message || e);
    return res.status(500).json({ message: 'internal error' });
  }
});

// Admin: reorder positions
// Reorder with explicit API: { ids: GUID[] }
slidersRouter.put('/reorder', requireRoleAtLeast('editor'), async (req, res) => {
  try {
    const body = req.body as any;
    const ids = (body && Array.isArray(body.ids)) ? (body.ids as any[]) : undefined;
    const keys = body && typeof body === 'object' ? Object.keys(body) : [];
    const isGuid = (v: string) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/.test(String(v));
    console.info('[sliders:reorder] incoming', { keys, body, length: Array.isArray(ids) ? ids.length : 0 });
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ message: 'ids must be a non-empty array' });
    const badIndex = ids.findIndex((x) => typeof x !== 'string' || !isGuid(x));
    if (badIndex !== -1) {
      console.info('[sliders:reorder] invalid id', { index: badIndex, value: ids[badIndex] });
      return res.status(400).json({ message: `invalid id at index ${badIndex}` });
    }
    const uniq = new Set(ids);
    if (uniq.size !== ids.length) return res.status(400).json({ message: 'ids must be unique' });

    const pool = await getPool();
    // Validate existence
    const allRows = await pool.request().query('SELECT id FROM sliders ORDER BY position ASC, created_at ASC');
    const allIds: string[] = (allRows.recordset || []).map((r: any) => String(r.id));
    const set = new Set(allIds.map((x)=>x.toLowerCase()));
    if (!ids.every((id) => set.has(id.toLowerCase()))) return res.status(400).json({ message: 'ids contain unknown slider id' });
    // Require full ordering: ids must cover all rows
    if (ids.length !== allIds.length) return res.status(409).json({ message: 'ids length mismatch' });

    const finalOrder = ids; // exact order provided by client

    // Transactional reorder: position = index in finalOrder (1..N)
    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      const req = new sql.Request(tx);
      finalOrder.forEach((id, i) => {
        req.input(`id${i}`, sql.UniqueIdentifier, id);
        req.input(`pos${i}`, sql.Int, i + 1);
      });
      const statements = finalOrder.map((_, i) => `UPDATE sliders SET position = @pos${i} WHERE id = @id${i};`).join('\n');
      const result: any = await req.batch(statements);
      const affected = Array.isArray(result?.rowsAffected) ? (result.rowsAffected as number[]).reduce((a,b)=>a+b,0) : 0;
      if (affected !== finalOrder.length) {
        throw Object.assign(new Error('affected rows mismatch'), { status: 409 });
      }
      console.log('[sliders:reorder] applied', { affected });
      await tx.commit();
    } catch (e) {
      try { await tx.rollback(); } catch {}
      throw e;
    }
    return res.status(204).send();
  } catch (e: any) {
    console.error('[sliders:reorder] error', e?.message || e);
    return res.status(500).json({ message: 'internal error' });
  }
});

// Admin: generate SAS for home/ uploads
slidersRouter.post('/upload-sas', requireRoleAtLeast('editor'), async (req, res) => {
  const { type, size, filename } = req.body as { type: 'image'; size?: number; filename?: string };
  if (type !== 'image') return res.status(400).json({ message: 'Invalid type' });
  if (typeof size === 'number' && size > 5 * 1024 * 1024) return res.status(400).json({ message: 'Max size 5MB' });
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
    const blobName = `home/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const sas = generateBlobSASQueryParameters(
      { containerName: container.containerName, blobName, permissions, protocol: SASProtocol.HttpsAndHttp, expiresOn },
      credential
    ).toString();
    const url = `${container.getBlockBlobClient(blobName).url}?${sas}`;
    res.json({ uploadUrl: url, blobUrl: container.getBlockBlobClient(blobName).url, expiresOn });
  } catch (e) {
    console.error('[SAS] sliders upload-sas error:', e);
    res.status(500).json({ message: 'SAS generation failed' });
  }
});


