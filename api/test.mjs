// Simple test function to debug environment and database
export default async function handler(req, res) {
  try {
    console.log('Function started, method:', req.method);
    console.log('Request URL:', req.url);
    
    // Check environment variables
    const envCheck = {
      DATABASE_URL: process.env.DATABASE_URL ? '✅ Set' : '❌ Missing',
      GEMINI_API_KEY: process.env.GEMINI_API_KEY ? '✅ Set' : '❌ Missing',
      FAL_API_KEY: process.env.FAL_API_KEY ? '✅ Set' : '❌ Missing',
      CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ Missing',
      JWT_SECRET: process.env.JWT_SECRET ? '✅ Set' : '❌ Missing',
      SESSION_SECRET: process.env.SESSION_SECRET ? '✅ Set' : '❌ Missing',
      NODE_ENV: process.env.NODE_ENV || 'undefined',
      VERCEL: process.env.VERCEL || 'undefined'
    };
    
    console.log('Environment check:', envCheck);
    
    // Simple response
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      environment: envCheck,
      message: 'Test function working!'
    });
    
  } catch (error) {
    console.error('Test function error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}