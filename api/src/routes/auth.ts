import { Router } from 'express';
import { getPool } from '../db';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export const authRouter = Router();

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) return res.status(400).json({ message: 'Missing creds' });
  const pool = await getPool();
  const r = await pool.request().input('email', email).query('SELECT TOP 1 * FROM users WHERE email = @email');
  const user = r.recordset[0];
  if (!user) return res.status(401).json({ message: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
  const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, config.auth.jwtSecret, { expiresIn: '12h' });
  res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
});


