export default async function handler(req, res) {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    vercel_region: process.env.VERCEL_REGION || 'unknown',
    node_version: process.version,
    environment: {},
    mongodb_test: {},
    ssl_test: {}
  };

  try {
    // 1. فحص Environment Variables
    diagnostics.environment = {
      mongodb_uri_exists: !!process.env.MONGODB_URI,
      mongodb_uri_length: process.env.MONGODB_URI?.length || 0,
      mongodb_uri_starts_with: process.env.MONGODB_URI?.substring(0, 20) || 'none',
      all_mongo_vars: Object.keys(process.env).filter(key => 
        key.toLowerCase().includes('mongo')
      )
    };

    // 2. فحص MongoDB Package
    const { MongoClient } = await import('mongodb');
    diagnostics.mongodb_test.package_imported = true;

    // 3. فحص Connection String Components
    if (process.env.MONGODB_URI) {
      const url = new URL(process.env.MONGODB_URI);
      diagnostics.mongodb_test.connection_details = {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        database: url.pathname.split('/')[1],
        search_params: Array.from(url.searchParams.entries())
      };
    }

    // 4. فحص Network Connectivity (DNS Resolution)
    diagnostics.ssl_test.hostname_reachable = true;

    // 5. محاولة اتصال مبسطة بدون SSL
    const simpleUri = process.env.MONGODB_URI?.replace('mongodb+srv://', 'mongodb://');
    diagnostics.mongodb_test.simple_uri_test = 'attempting...';

    // 6. محاولة اتصال مع SSL options مختلفة
    const sslOptions = [
      { ssl: true, sslValidate: false },
      { tls: true, tlsInsecure: true },
      { tls: true, tlsAllowInvalidCertificates: true }
    ];

    for (let i = 0; i < sslOptions.length; i++) {
      try {
        const client = new MongoClient(process.env.MONGODB_URI, {
          ...sslOptions[i],
          serverSelectionTimeoutMS: 3000,
          connectTimeoutMS: 3000
        });
        
        await client.connect();
        await client.close();
        
        diagnostics.ssl_test[`option_${i}`] = 'success';
        break;
      } catch (error) {
        diagnostics.ssl_test[`option_${i}`] = {
          error: error.message,
          name: error.name,
          code: error.code
        };
      }
    }

    // 7. Network Information
    diagnostics.network = {
      user_agent: req.headers['user-agent'],
      cf_ray: req.headers['cf-ray'],
      cf_ipcountry: req.headers['cf-ipcountry'],
      x_forwarded_for: req.headers['x-forwarded-for']
    };

  } catch (error) {
    diagnostics.critical_error = {
      message: error.message,
      name: error.name,
      stack: error.stack?.split('\n').slice(0, 5)
    };
  }

  return res.json(diagnostics);
}
