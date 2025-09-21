// Simple test API for Vercel
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Check environment variables
    const envCheck = {
      DATABASE_URL: process.env.DATABASE_URL ? '✅ Set' : '❌ Missing',
      CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing',
      JWT_SECRET: process.env.JWT_SECRET ? '✅ Set' : '❌ Missing',
      NODE_ENV: process.env.NODE_ENV || 'undefined',
      VERCEL: process.env.VERCEL || 'undefined'
    };
    
    return res.status(200).json({
      success: true,
      message: 'API is working!',
      timestamp: new Date().toISOString(),
      environment: envCheck
    });
    
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
// Updated at Sun Sep 21 02:03:54 UTC 2025
