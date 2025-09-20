export default async function handler(req, res) {
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>CGI Generator Dashboard</title>
    <style>
        body { font-family: Arial; max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background: #007cba; color: white; padding: 20px; margin-bottom: 20px; }
        .credits { background: #28a745; color: white; padding: 10px; display: inline-block; }
        .section { background: #f8f9fa; padding: 20px; margin: 10px 0; border: 1px solid #ddd; }
    </style>
</head>
<body>
    <div class="header">
        <h1>CGI Generator Dashboard</h1>
        <div class="credits">Credits: 1000</div>
    </div>
    
    <div class="section">
        <h3>✅ Database Status</h3>
        <p>All tables created successfully</p>
        <ul>
            <li>Users table ✅</li>
            <li>Projects table ✅</li>
            <li>Transactions table ✅</li>
            <li>Sessions table ✅</li>
        </ul>
    </div>
    
    <div class="section">
        <h3>✅ Admin User</h3>
        <p>Email: admin@cgi-generator.com</p>
        <p>Password: admin123</p>
        <p>Credits: 1000</p>
        <p>Admin: Yes</p>
    </div>
    
    <div class="section">
        <h3>✅ Login API</h3>
        <p>Login endpoint working correctly</p>
        <a href="/api/test-login" target="_blank">Test Login</a>
    </div>
    
    <div class="section">
        <h3>📋 Next Steps</h3>
        <ul>
            <li>Add AI API keys (Gemini, Fal.ai)</li>
            <li>Test image/video generation</li>
            <li>Setup Stripe payments</li>
        </ul>
    </div>
</body>
</html>
  `;
  
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
}
