import { Router } from 'express';
import { getPool } from '../db';

export const transportRoutesRouter = Router();

transportRoutesRouter.get('/', async (req, res) => {
  const series = (req.query.series as string) || undefined;
  const pool = await getPool();
  const result = await pool
    .request()
    .input('series', series || null)
    .query(
      series
        ? 'SELECT * FROM routes WHERE series = @series AND is_published = 1 ORDER BY code'
        : 'SELECT * FROM routes ORDER BY code'
    );
  res.json(result.recordset);
});

transportRoutesRouter.get('/:code', async (req, res) => {
  const pool = await getPool();
  const result = await pool.request().input('code', req.params.code).query('SELECT * FROM routes WHERE code = @code');
  if (result.recordset.length === 0) return res.status(404).json({ message: 'Not found' });
  res.json(result.recordset[0]);
});

transportRoutesRouter.post('/', async (req, res) => {
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
    .input('is_published', is_published ? 1 : 1)
    .query(`
      DECLARE @id UNIQUEIDENTIFIER = NEWID();
      INSERT INTO routes (id, code, title, description, pdf_url, image_url, series, is_published)
      VALUES (@id, @code, @title, @description, @pdf_url, @image_url, @series, @is_published);
      SELECT * FROM routes WHERE id = @id;
    `);
  res.status(201).json(result.recordset[0]);
});

transportRoutesRouter.put('/:id', async (req, res) => {
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
    .input('is_published', is_published ? 1 : 1)
    .query(`
      UPDATE routes SET
        code = @code,
        title = @title,
        description = @description,
        pdf_url = @pdf_url,
        image_url = @image_url,
        series = @series,
        is_published = @is_published
      WHERE id = @id;
      SELECT * FROM routes WHERE id = @id;
    `);
  if (result.recordset.length === 0) return res.status(404).json({ message: 'Not found' });
  res.json(result.recordset[0]);
});

transportRoutesRouter.delete('/:id', async (req, res) => {
  const pool = await getPool();
  const result = await pool.request().input('id', req.params.id).query('DELETE FROM routes WHERE id = @id');
  if (result.rowsAffected[0] === 0) return res.status(404).json({ message: 'Not found' });
  res.status(204).send();
});


