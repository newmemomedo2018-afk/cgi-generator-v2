// Backup of original index.mjs
// Vercel serverless function entry point
// This file proxies all requests to our compiled Express app

// Import the ES module handler
import handler from '../dist/index.js';

// Export the handler for Vercel serverless
export default handler;