// Simple debug version of main function
import express from 'express';

const app = express();

// Basic middleware
app.use(express.json());

// Test routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('Login attempt:', req.body);
    
    const { email, password } = req.body;
    
    // Simple test response
    if (email === 'admin@test.com') {
      return res.json({
        success: true,
        message: 'Login successful (test mode)',
        user: { email, id: 'test-user-id' },
        token: 'test-token-123'
      });
    }
    
    return res.status(401).json({ message: 'Invalid credentials' });
    
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ 
      message: 'Login failed', 
      error: error.message 
    });
  }
});

// Catch-all for other routes
app.use('*', (req, res) => {
  res.status(404).json({ 
    message: 'Route not found',
    path: req.originalUrl,
    method: req.method
  });
});

// Export as serverless function
export default app;