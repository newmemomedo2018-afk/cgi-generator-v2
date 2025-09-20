export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  
  if (req.url.includes('/api/test')) {
    return res.status(200).json({ 
      success: true,
      message: 'Test working!',
      timestamp: new Date().toISOString()
    });
  }
  
  if (req.url.includes('/api/auth/login')) {
    return res.status(200).json({ 
      success: true,
      message: 'Login endpoint working',
      method: req.method
    });
  }
  
  return res.status(200).json({ 
    success: true,
    message: 'API working!',
    path: req.url,
    method: req.method 
  });
}
