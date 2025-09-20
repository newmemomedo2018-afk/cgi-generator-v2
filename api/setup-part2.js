import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  try {
    const sql = neon(process.env.DATABASE_URL);
    
    await sql`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        product_image_url VARCHAR(500) NOT NULL,
        scene_image_url VARCHAR(500),
        scene_video_url VARCHAR(500),
        content_type VARCHAR(50) DEFAULT 'image',
        video_duration_seconds INTEGER DEFAULT 5,
        status VARCHAR(50) DEFAULT 'pending',
        progress INTEGER DEFAULT 0,
        enhanced_prompt TEXT,
        output_image_url VARCHAR(500),
        output_video_url VARCHAR(500),
        credits_used INTEGER NOT NULL,
        actual_cost INTEGER DEFAULT 0,
        resolution VARCHAR(50) DEFAULT '1024x1024',
        quality VARCHAR(50) DEFAULT 'standard',
        error_message TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    return res.json({ success: true, message: 'Projects table created' });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
