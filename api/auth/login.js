export default function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  
  res.status(200).json({
    success: true,
    message: 'Login endpoint working!',
    body: req.body,
    timestamp: new Date().toISOString()
  });
}
