import { MongoClient } from 'mongodb';
import bcrypt from 'bcrypt';

let cachedClient = null;

async function connectToDatabase() {
  if (cachedClient) return cachedClient;
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  cachedClient = client;
  return client;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    const client = await connectToDatabase();
    const db = client.db('cgi-generator');
    const users = db.collection('users');
    
    // Admin credentials
    const adminEmail = 'admin@cgi-generator.com';
    const adminPassword = 'admin123';
    
    // Check if admin already exists
    const existingAdmin = await users.findOne({ email: adminEmail });
    if (existingAdmin) {
      return res.status(409).json({ 
        message: 'Admin already exists',
        credentials: { email: adminEmail, password: adminPassword }
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(adminPassword, 12);

    // Create admin user
    const result = await users.insertOne({
      email: adminEmail,
      password: hashedPassword,
      name: 'Admin',
      credits: 1000, // 1000 credits for admin
      createdAt: new Date(),
      updatedAt: new Date(),
      isAdmin: true
    });

    return res.status(201).json({
      message: 'Admin user created successfully',
      credentials: {
        email: adminEmail,
        password: adminPassword,
        credits: 1000
      },
      userId: result.insertedId.toString()
    });

  } catch (error) {
    console.error('Create admin error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
