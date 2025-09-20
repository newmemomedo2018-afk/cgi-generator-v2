import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  try {
    const sql = neon(process.env.DATABASE_URL);
    
    const adminExists = await sql`SELECT id FROM users WHERE email = 'admin@cgi-generator.com'`;
    if (adminExists.length === 0) {
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash('admin123', 12);
      
      await sql`
        INSERT INTO users (email, password, first_name, credits, is_admin)
        VALUES ('admin@cgi-generator.com', ${hashedPassword}, 'Admin', 1000, TRUE)
      `;
    }

    return res.json({ 
      success: true, 
      message: 'Admin user created',
      admin: { email: 'admin@cgi-generator.com', password: 'admin123', credits: 1000 }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
