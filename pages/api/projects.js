// Simple projects API without external dependencies
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Simple auth check (just check if token exists)
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    if (req.method === 'GET') {
      // Return empty array for now
      return res.status(200).json([]);
    }

    if (req.method === 'POST') {
      const { title, productImageUrl, sceneImageUrl, contentType = 'image' } = req.body;
      
      // Basic validation
      if (!title) {
        return res.status(400).json({ error: 'Title is required' });
      }
      
      if (!productImageUrl) {
        return res.status(400).json({ error: 'Product image required' });
      }
      
      if (!sceneImageUrl) {
        return res.status(400).json({ error: 'Scene image required' });
      }

      // Create mock successful project
      const project = {
        id: Date.now(),
        title,
        productImageUrl,
        sceneImageUrl,
        contentType,
        status: 'completed',
        progress: 100,
        outputImageUrl: 'https://via.placeholder.com/1024x1024/4CAF50/white?text=CGI+Success',
        outputVideoUrl: contentType === 'video' ? 'https://via.placeholder.com/400x300.mp4' : null,
        createdAt: new Date().toISOString()
      };

      return res.status(201).json({
        ...project,
        message: 'Project created successfully!'
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Projects API error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}
