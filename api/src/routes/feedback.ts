import { Router } from 'express';
import { getPool } from '../db';
import rateLimit from 'express-rate-limit';
import { requireRoleAtLeast } from '../middleware/auth';

export const feedbackRouter = Router();

// 5/dk/IP rate-limit for public create
const createLimiter = rateLimit({ windowMs: 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false });

feedbackRouter.post('/', createLimiter, async (req, res) => {
  const pool = await getPool();
  const { name, email, message } = req.body;
  if (typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ message: 'message is required' });
  }
  const result = await pool
    .request()
    .input('name', name || null)
    .input('email', email || null)
    .input('message', message)
    .query(`
      DECLARE @id UNIQUEIDENTIFIER = NEWID();
      INSERT INTO feedback (id, name, email, message) VALUES (@id, @name, @email, @message);
      SELECT * FROM feedback WHERE id = @id;
    `);
  res.status(201).json(result.recordset[0]);
});

// Admin list (viewer+)
feedbackRouter.get('/', requireRoleAtLeast('viewer'), async (req, res) => {
  const pool = await getPool();
  const handled = (req.query.handled as string | undefined)?.toLowerCase();
  const q = (req.query.q as string | undefined) || '';
  const onlyHandled = handled === 'true' || handled === '1';
  const onlyUnHandled = handled === 'false' || handled === '0';
  const where: string[] = [];
  if (onlyHandled) where.push('handled = 1');
  if (onlyUnHandled) where.push('handled = 0');
  if (q) where.push('(name LIKE @q OR email LIKE @q)');
  const sql = `SELECT * FROM feedback ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`;
  const reqst = pool.request();
  if (q) reqst.input('q', `%${q}%`);
  const r = await reqst.query(sql);
  res.json(r.recordset);
});

// Admin update (editor+)
feedbackRouter.put('/:id', requireRoleAtLeast('editor'), async (req, res) => {
  const pool = await getPool();
  const { handled } = req.body as { handled?: boolean };
  const r = await pool
    .request()
    .input('id', req.params.id)
    .input('handled', handled ? 1 : 0)
    .query('UPDATE feedback SET handled = @handled WHERE id = @id; SELECT * FROM feedback WHERE id = @id;');
  if (!r.recordset.length) return res.status(404).json({ message: 'Not found' });
  res.json(r.recordset[0]);
});

// Admin export CSV (viewer+)
feedbackRouter.get('/export.csv', requireRoleAtLeast('viewer'), async (req, res) => {
  const pool = await getPool();
  const q = (req.query.q as string | undefined) || '';
  const handled = (req.query.handled as string | undefined)?.toLowerCase();
  const where: string[] = [];
  if (handled === 'true' || handled === '1') where.push('handled = 1');
  if (handled === 'false' || handled === '0') where.push('handled = 0');
  if (q) where.push('(name LIKE @q OR email LIKE @q)');
  const sql = `SELECT name, email, message, handled, created_at FROM feedback ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created_at DESC`;
  const reqst = pool.request();
  if (q) reqst.input('q', `%${q}%`);
  const r = await reqst.query(sql);
  const header = 'name,email,message,handled,created_at\n';
  const rows = r.recordset
    .map((row) =>
      [row.name ?? '', row.email ?? '', (row.message ?? '').replace(/\n|\r/g, ' '), row.handled ? '1' : '0', row.created_at.toISOString()].join(',')
    )
    .join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="feedback.csv"');
  res.send('\uFEFF' + header + rows + '\n');
});


