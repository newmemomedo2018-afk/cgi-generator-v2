export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  const { email, password } = req.body;
  
  // Mock authentication - في الواقع هنا هنتحقق من database
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
