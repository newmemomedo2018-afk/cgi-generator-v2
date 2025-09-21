export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('Headers received:', req.headers);
    console.log('Request body:', req.body);

    if (req.method === 'GET') {
      return res.status(200).json([]);
    }

    if (req.method === 'POST') {
      const { title, productImageUrl, sceneImageUrl, contentType = 'image' } = req.body;
      
      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }
      
      if (!productImageUrl || !sceneImageUrl) {
        return res.status(400).json({ error: 'Images are required' });
      }

      const project = {
        id: Date.now(),
        title,
        productImageUrl,
        sceneImageUrl,
        contentType,
        status: 'completed',
        progress: 100,
        outputImageUrl: 'https://via.placeholder.com/1024x1024/4CAF50/white?text=CGI+Generated',
        createdAt: new Date().toISOString()
      };

      console.log('Project created:', project);
      return res.status(201).json(project);
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Server error',
      message: error.message,
      stack: error.stack
    });
  }
}
