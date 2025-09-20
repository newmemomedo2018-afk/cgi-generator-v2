import { Pool } from '@neondatabase/serverless';
import jwt from 'jsonwebtoken';

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL
});

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Verify JWT token
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');
    
    if (req.method === 'GET') {
      // Get user's projects
      const result = await pool.query(
        'SELECT * FROM projects WHERE "userId" = $1 ORDER BY "createdAt" DESC',
        [payload.userId]
      );
      
      return res.status(200).json(result.rows);
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Projects API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
