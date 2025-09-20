export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');

  try {
    let body = {};
    if (typeof req.body === 'string') {
      body = JSON.parse(req.body);
    } else {
      body = req.body || {};
    }

    const { email, password } = body;

    // Use MongoDB Data API instead of direct connection
    const response = await fetch('https://data.mongodb-api.com/app/data-dqhyb/endpoint/data/v1/action/findOne', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': process.env.MONGODB_DATA_API_KEY // نحتاج نضيف ده في Vercel
      },
      body: JSON.stringify({
        collection: "users",
        database: "cgi-generator",
        dataSource: "Cluster1",
        filter: { email: email }
      })
    });

    const data = await response.json();
    
    if (!data.document) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Simple password check (نضيف bcrypt لاحقاً)
    if (data.document.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    return res.status(200).json({
      token: 'temp-token-' + Date.now(),
      user: {
        id: data.document._id,
        email: data.document.email,
        credits: data.document.credits || 0
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
