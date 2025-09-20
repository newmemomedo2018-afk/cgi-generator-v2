import { neon } from '@neondatabase/serverless';

export default async function handler(req, res) {
  try {
    const sql = neon(process.env.DATABASE_URL);
    
    // First, let's check what columns actually exist
    const tableInfo = await sql`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'users'
    `;
    
    const adminExists = await sql`SELECT id FROM users WHERE email = 'admin@cgi-generator.com'`;
    if (adminExists.length === 0) {
      const bcrypt = await import('bcrypt');
      const hashedPassword = await bcrypt.hash('admin123', 12);
      
      // Use only the columns that definitely exist
      await sql`
        INSERT INTO users (email, password, credits, is_admin)
        VALUES ('admin@cgi-generator.com', ${hashedPassword}, 1000, TRUE)
      `;
    }

    return res.json({ 
      success: true, 
      message: 'Admin user created',
      table_columns: tableInfo.map(col => col.column_name),
      admin: { email: 'admin@cgi-generator.com', password: 'admin123', credits: 1000 }
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
