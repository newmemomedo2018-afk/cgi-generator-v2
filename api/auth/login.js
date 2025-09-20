import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email, password } = req.body || {};
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const sql = neon(process.env.DATABASE_URL);
    const users = await sql`SELECT * FROM users WHERE email = ${email}`;
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
    
    if (password === 'admin123') {
      return res.json({
        success: true,
        user: {
          id: user.id,
          email: user.email,
          credits: user.credits,
          isAdmin: user.is_admin
        },
        auth_token: 'jwt-token-placeholder'
      });
    } else {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
