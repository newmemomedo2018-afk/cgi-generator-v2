export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse multipart form data manually for Vercel
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    
    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Configure Cloudinary
    const { v2: cloudinary } = await import('cloudinary');
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });

    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const publicId = `user-uploads/${uniqueSuffix}`;

    const cloudinaryResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'auto',
          public_id: publicId,
          quality: 'auto:best',
          fetch_format: 'auto'
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      ).end(buffer);
    });

    res.json({ 
      url: cloudinaryResult.secure_url,
      imageUrl: cloudinaryResult.secure_url,
      publicId: cloudinaryResult.public_id
    });

  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ error: "Failed to upload file" });
  }
}
