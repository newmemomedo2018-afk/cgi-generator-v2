export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Parse request body manually for Vercel serverless
  let body = {};
  try {
    if (typeof req.body === 'string') {
      body = JSON.parse(req.body);
    } else {
      body = req.body || {};
    }
  } catch (error) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const { email, password } = body;
  
  console.log('Login attempt:', { email, password }); // Debug log
  
  // Mock authentication
  if (email === 'admin@test.com' && password === 'password') {
    return res.status(200).json({
      success: true,
      token: 'mock-jwt-token-12345',
      user: {
        id: 1,
        email: email,
        credits: 100
      }
    });
  }
  
  return res.status(401).json({
    success: false,
    error: 'Invalid credentials'
  });
}
