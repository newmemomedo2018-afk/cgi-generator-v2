export default async function handler(req, res) {
  try {
    const { MongoClient } = await import('mongodb');
    const bcrypt = await import('bcrypt');
    
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    const db = client.db('cgi-generator');
    const users = db.collection('users');
    
    const adminEmail = 'admin@cgi-generator.com';
    
    // Check if admin exists
    const existing = await users.findOne({ email: adminEmail });
    if (existing) {
      await client.close();
      return res.json({ 
        message: 'Admin already exists',
        email: adminEmail,
        password: 'admin123'
      });
    }
    
    // Create admin
    const hashedPassword = await bcrypt.hash('admin123', 12);
    const result = await users.insertOne({
      email: adminEmail,
      password: hashedPassword,
      name: 'Admin',
      credits: 1000,
      isAdmin: true,
      createdAt: new Date()
    });
    
    await client.close();
    
    return res.json({
      message: 'Admin created successfully!',
      email: adminEmail,
      password: 'admin123',
      credits: 1000
    });
    
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
