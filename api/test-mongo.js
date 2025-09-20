export default async function handler(req, res) {
  try {
    // Test if MongoDB package exists
    const { MongoClient } = await import('mongodb');
    
    // Test environment variable
    if (!process.env.MONGODB_URI) {
      return res.json({
        status: 'error',
        message: 'MONGODB_URI environment variable not found',
        env_vars: Object.keys(process.env).filter(key => key.includes('MONGO'))
      });
    }
    
    // Test connection
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    
    // Test database access
    const db = client.db('cgi-generator');
    const users = db.collection('users');
    const userCount = await users.countDocuments();
    
    await client.close();
    
    return res.json({
      status: 'success',
      message: 'MongoDB connection successful',
      database: 'cgi-generator',
      user_count: userCount,
      mongodb_uri_exists: true
    });
    
  } catch (error) {
    return res.json({
      status: 'error',
      message: error.message,
      error_name: error.name,
      mongodb_uri_exists: !!process.env.MONGODB_URI
    });
  }
}
