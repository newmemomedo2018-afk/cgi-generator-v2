export default function handler(req, res) {
  // Handle all API requests here
  if (req.url === '/api/test') {
    return res.json({ message: 'Test working!' });
  }
  
  if (req.url === '/api/auth/login' && req.method === 'POST') {
    return res.json({ message: 'Login working!' });
  }
  
  res.json({ 
    message: 'API working!',
    path: req.url,
    method: req.method 
  });
}
