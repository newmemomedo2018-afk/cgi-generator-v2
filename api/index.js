// Vercel serverless function entry point
// This file proxies all requests to our compiled Express app

const app = require('../dist/index.js');

// Export the Express app as a serverless function
module.exports = app;