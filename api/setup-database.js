import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  try {
    const sql = neon(process.env.DATABASE_URL);
    
    // 1. Users Table - بطريقة Neon المدعومة
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        first_name VARCHAR(255),
        last_name VARCHAR(255),
        profile_image_url VARCHAR(500),
        credits INTEGER DEFAULT 5,
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
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
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
        id SERIAL PRIMARY KEY,
        type VARCHAR(100) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        project_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        priority INTEGER DEFAULT 0,
        attempts INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 3,
        progress INTEGER DEFAULT 0,
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

    // Add foreign keys separately
    try {
      await sql`ALTER TABLE projects ADD CONSTRAINT fk_projects_user_id FOREIGN KEY (user_id) REFERENCES users(id)`;
    } catch (e) {
      // Foreign key might already exist
    }

    try {
      await sql`ALTER TABLE transactions ADD CONSTRAINT fk_transactions_user_id FOREIGN KEY (user_id) REFERENCES users(id)`;
    } catch (e) {
      // Foreign key might already exist
    }

    try {
      await sql`ALTER TABLE job_queue ADD CONSTRAINT fk_job_queue_user_id FOREIGN KEY (user_id) REFERENCES users(id)`;
    } catch (e) {
      // Foreign key might already exist
    }

    try {
      await sql`ALTER TABLE job_queue ADD CONSTRAINT fk_job_queue_project_id FOREIGN KEY (project_id) REFERENCES projects(id)`;
    } catch (e) {
      // Foreign key might already exist
    }

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
