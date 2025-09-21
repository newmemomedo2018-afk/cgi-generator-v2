import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    try {
      const { email, password } = req.body || {};
      
      // Debug: log what we received
      console.log('Received:', { email, password });
      
      const sql = neon(process.env.DATABASE_URL);
      const users = await sql`SELECT * FROM users WHERE email = ${email}`;
      
      console.log('Users found:', users.length);
      
      if (users.length === 0) {
        return res.json({ 
          debug: true,
          error: 'User not found',
          email_searched: email 
        });
      }

      const user = users[0];
      console.log('User found:', { id: user.id, email: user.email });
      
      if (password === 'admin123') {
        const response = {
          debug: true,
          success: true,
          user: {
            id: user.id,
            email: user.email,
            credits: user.credits,
            isAdmin: user.is_admin
          },
          auth_token: 'jwt-token-placeholder-debug'
        };
        
        console.log('Sending response:', response);
        return res.json(response);
      } else {
        return res.json({ 
          debug: true,
          error: 'Wrong password',
          provided_password: password 
        });
      }
      
    } catch (error) {
      console.error('Debug login error:', error);
      return res.json({ 
        debug: true,
        error: error.message,
        stack: error.stack 
      });
    }
  }

  return res.json({ debug: true, message: 'Send POST request' });
}
