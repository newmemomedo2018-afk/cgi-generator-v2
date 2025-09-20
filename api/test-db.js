import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  try {
    // Test if DATABASE_URL exists
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ 
        error: 'DATABASE_URL not found in environment variables' 
      });
    }

    const sql = neon(process.env.DATABASE_URL);
    
    // Simple database test
    const result = await sql`SELECT NOW() as current_time`;
    
    return res.json({
      success: true,
      message: 'Database connection successful',
      current_time: result[0].current_time,
      database_url_exists: !!process.env.DATABASE_URL
    });

  } catch (error) {
    return res.status(500).json({ 
      error: 'Database connection failed',
      details: error.message 
    });
  }
}
