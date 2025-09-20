import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  try {
    const sql = neon(process.env.DATABASE_URL);
    
    // Enable UUID extension first
    await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`;
    
    // 1. Users Table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR DEFAULT uuid_generate_v4() PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        profile_image_url VARCHAR(500),
        credits INTEGER DEFAULT 5 NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        stripe_customer_id VARCHAR(255),
        stripe_subscription_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // 2. Projects Table
    await sql`
      CREATE TABLE IF NOT EXISTS projects (
        id VARCHAR DEFAULT uuid_generate_v4() PRIMARY KEY,
        user_id VARCHAR NOT NULL,
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
        actual_cost INTEGER DEFAULT 0 NOT NULL,
        resolution VARCHAR(50) DEFAULT '1024x1024',
        quality VARCHAR(50) DEFAULT 'standard',
        error_message TEXT,
        kling_video_task_id VARCHAR(255),
        kling_sound_task_id VARCHAR(255),
        include_audio BOOLEAN DEFAULT FALSE,
        full_task_details JSONB,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // 3. Transactions Table
    await sql`
      CREATE TABLE IF NOT EXISTS transactions (
        id VARCHAR DEFAULT uuid_generate_v4() PRIMARY KEY,
        user_id VARCHAR NOT NULL,
        amount INTEGER NOT NULL,
        credits INTEGER NOT NULL,
        stripe_payment_intent_id VARCHAR(255) UNIQUE,
        status VARCHAR(50) DEFAULT 'pending',
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // 4. Job Queue Table
    await sql`
      CREATE TABLE IF NOT EXISTS job_queue (
        id VARCHAR DEFAULT uuid_generate_v4() PRIMARY KEY,
        type VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        project_id VARCHAR NOT NULL,
        user_id VARCHAR NOT NULL,
        priority INTEGER DEFAULT 0 NOT NULL,
        attempts INTEGER DEFAULT 0 NOT NULL,
        max_attempts INTEGER DEFAULT 3 NOT NULL,
        progress INTEGER DEFAULT 0 NOT NULL,
        status_message TEXT,
        error_message TEXT,
        data JSONB,
        result JSONB,
        scheduled_for TIMESTAMP DEFAULT NOW(),
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // 5. Sessions Table
    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        sid VARCHAR PRIMARY KEY,
        sess JSONB NOT NULL,
        expire TIMESTAMP NOT NULL
      )
    `;

    // Add foreign key constraints
    await sql`
      ALTER TABLE projects 
      ADD CONSTRAINT IF NOT EXISTS fk_projects_user_id 
      FOREIGN KEY (user_id) REFERENCES users(id)
    `;

    await sql`
      ALTER TABLE transactions 
      ADD CONSTRAINT IF NOT EXISTS fk_transactions_user_id 
      FOREIGN KEY (user_id) REFERENCES users(id)
    `;

    await sql`
      ALTER TABLE job_queue 
      ADD CONSTRAINT IF NOT EXISTS fk_job_queue_user_id 
      FOREIGN KEY (user_id) REFERENCES users(id)
    `;

    await sql`
      ALTER TABLE job_queue 
      ADD CONSTRAINT IF NOT EXISTS fk_job_queue_project_id 
      FOREIGN KEY (project_id) REFERENCES projects(id)
    `;

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_job_queue_status ON job_queue(status)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_sessions_expire ON sessions(expire)`;

    // Create admin user
    const adminExists = await sql`SELECT id FROM users WHERE email = 'admin@cgi-generator.com'`;
    if (adminExists.length === 0) {
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash('admin123', 12);
      
      await sql`
        INSERT INTO users (email, password, first_name, credits, is_admin)
        VALUES ('admin@cgi-generator.com', ${hashedPassword}, 'Admin', 1000, TRUE)
      `;
    }

    return res.status(200).json({
      success: true,
      message: 'Database setup completed successfully',
      tables_created: ['users', 'projects', 'transactions', 'job_queue', 'sessions'],
      admin_user: {
        email: 'admin@cgi-generator.com',
        password: 'admin123',
        credits: 1000
      }
    });

  } catch (error) {
    console.error('Database setup error:', error);
    return res.status(500).json({ 
      error: 'Database setup failed',
      details: error.message 
    });
  }
}
