import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token || token === 'jwt-token-placeholder') {
      // Check localStorage fallback
      const authToken = token || req.headers['x-auth-token'];
      
      if (!authToken) {
        return res.status(401).json({ error: 'No token provided' });
      }
    }

    // For now, return admin user if token exists
    // Later we'll implement proper JWT verification
    const sql = neon(process.env.DATABASE_URL);
    const users = await sql`SELECT * FROM users WHERE email = 'admin@cgi-generator.com'`;
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = users[0];
    
    return res.json({
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      credits: user.credits,
      isAdmin: user.is_admin
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
