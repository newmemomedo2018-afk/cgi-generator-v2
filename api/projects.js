import jwt from 'jsonwebtoken';

const testUser = { id: 1, email: 'admin@cgi-generator.com', credits: 1000 };
let projects = [];
let projectId = 1;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token' });
    
    jwt.verify(token, process.env.JWT_SECRET || 'fallback-secret');

    if (req.method === 'GET') {
      return res.status(200).json(projects);
    }

    if (req.method === 'POST') {
      const { title, productImageUrl, sceneImageUrl, contentType = 'image' } = req.body;
      
      if (!title || !productImageUrl || !sceneImageUrl) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const project = {
        id: projectId++,
        userId: 1,
        title,
        productImageUrl,
        sceneImageUrl,
        contentType,
        status: 'completed',
        progress: 100,
        outputImageUrl: 'https://via.placeholder.com/1024x1024/4CAF50/white?text=CGI+Generated',
        createdAt: new Date().toISOString()
      };

      projects.push(project);
      return res.status(201).json(project);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
}
