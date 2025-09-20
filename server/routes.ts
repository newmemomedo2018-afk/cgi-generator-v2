import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./auth";
import { insertProjectSchema, insertTransactionSchema } from "@shared/schema";
import { z } from "zod";
import { promises as fs, createReadStream, existsSync, mkdirSync } from 'fs';
import Stripe from 'stripe';
import path from 'path';
import { enhancePromptWithGemini, generateImageWithGemini } from './services/gemini';
import multer from 'multer';

import { COSTS, CREDIT_PACKAGES } from '@shared/constants';


export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);


  // Configure multer for memory storage (for Cloudinary upload)
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB limit
    },
    fileFilter: (req: any, file: any, cb: any) => {
      // Only allow image files
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    }
  });
  
  // Upload endpoint for product images - using Cloudinary
  app.post('/api/upload-product-image', isAuthenticated, upload.single('productImage'), async (req: any, res) => {
    try {
      if (!req.file) {
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
      
      console.log("Uploading to Cloudinary:", {
        originalName: req.file.originalname,
        fileSize: req.file.size,
        publicId
      });
      
      // Upload to Cloudinary
      const cloudinaryResult = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          {
            resource_type: 'auto',
            public_id: publicId,
            quality: 'auto:best',
            fetch_format: 'auto'
          },
          (error: any, result: any) => {
            if (error) {
              console.error("Cloudinary upload error:", error);
              reject(error);
            } else {
              console.log("Cloudinary upload success:", {
                public_id: result.public_id,
                url: result.secure_url,
                format: result.format,
                bytes: result.bytes
              });
              resolve(result);
            }
          }
        ).end(req.file.buffer);
      });
      
      res.json({ 
        url: (cloudinaryResult as any).secure_url,
        imageUrl: (cloudinaryResult as any).secure_url,
        publicId: (cloudinaryResult as any).public_id
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Product image endpoint - now using Cloudinary URLs directly
  app.put('/api/product-images', isAuthenticated, async (req: any, res) => {
    try {
      const { productImageURL } = req.body;
      
      if (!productImageURL) {
        return res.status(400).json({ error: "productImageURL is required" });
      }

      // Since we're using Cloudinary, we can use the URL directly
      res.status(200).json({
        imageUrl: productImageURL,
        success: true
      });
    } catch (error) {
      console.error("Error setting product image:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Legacy objects endpoint - redirect to Cloudinary
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req, res) => {
    // Objects are now served from Cloudinary directly
    // This endpoint exists for backwards compatibility only
    res.status(410).json({ 
      message: "Objects are now served from Cloudinary. Please use the direct Cloudinary URLs.",
      deprecated: true
    });
  });

  // File serving endpoint - Public access for generated content
  app.get('/api/files/*', async (req: any, res) => {
    try {
      const filename = req.params['0'] as string;
      // Using imported fs and path modules
      
      // SECURITY: Validate and sanitize the file path to prevent path traversal
      if (!filename || filename.includes('..') || filename.includes('\0') || path.isAbsolute(filename)) {
        return res.status(400).json({ message: "Invalid file path" });
      }
      
      const privateDir = '/tmp';
      const filePath = path.resolve(path.join(privateDir, filename));
      
      // SECURITY: Ensure the resolved path is still within the private directory
      if (!filePath.startsWith(path.resolve(privateDir))) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // SECURITY: Validate file path structure
      const pathParts = filename.split('/');
      if (pathParts.length < 2 || pathParts[0] !== 'uploads') {
        return res.status(403).json({ message: "Invalid file structure" });
      }
      
      if (!existsSync(filePath)) {
        return res.status(404).json({ message: "File not found" });
      }
      
      // SECURITY: Get proper MIME type based on file extension
      const ext = path.extname(filename).toLowerCase();
      const mimeTypes: { [key: string]: string } = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime'
      };
      
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      
      // Set appropriate headers
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'private, max-age=3600'); // Private cache for user files
      
      // Stream the file
      const fileStream = createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Error serving file:", error);
      res.status(500).json({ message: "Failed to serve file" });
    }
  });

  // Public files endpoint - now serves from Cloudinary or local files
  app.get('/public-objects/:filePath(*)', async (req: any, res) => {
    try {
      const filePath = req.params.filePath as string;
      
      // SECURITY: Validate and sanitize the file path to prevent path traversal
      if (!filePath || filePath.includes('..') || filePath.includes('\0') || path.isAbsolute(filePath)) {
        return res.status(400).json({ message: "Invalid file path" });
      }
      
      // For generated content, serve from /tmp directory
      if (filePath.startsWith('uploads/')) {
        const localFilePath = path.join('/tmp', filePath);
        
        if (existsSync(localFilePath)) {
          const ext = path.extname(filePath).toLowerCase();
          const mimeTypes: { [key: string]: string } = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.mp4': 'video/mp4',
            '.webm': 'video/webm',
            '.mov': 'video/quicktime'
          };
          
          const contentType = mimeTypes[ext] || 'application/octet-stream';
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=3600');
          
          const fileStream = createReadStream(localFilePath);
          fileStream.pipe(res);
          return;
        }
      }
      
      res.status(404).json({ message: "File not found" });
    } catch (error) {
      console.error("Error serving public file:", error);
      if (!res.headersSent) {
        res.status(500).json({ message: "Failed to serve file" });
      }
    }
  });

  // Projects endpoints
  app.get('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const projects = await storage.getUserProjects(userId);
      
      // Rehydrate URLs to use current request host
      const currentHost = `${req.protocol}://${req.get('host')}`;
      const rehydratedProjects = projects.map(project => {
        const rehydrateUrl = (url: string | null) => {
          if (!url) return url;
          if (url.includes('/public-objects/')) {
            // Extract the relative path after /public-objects/
            const pathMatch = url.match(/\/public-objects\/(.*)/);
            if (pathMatch) {
              return `${currentHost}/public-objects/${pathMatch[1]}`;
            }
          }
          return url;
        };
        
        return {
          ...project,
          productImageUrl: rehydrateUrl(project.productImageUrl),
          sceneImageUrl: rehydrateUrl(project.sceneImageUrl),
          outputImageUrl: rehydrateUrl(project.outputImageUrl),
          outputVideoUrl: rehydrateUrl(project.outputVideoUrl)
        };
      });
      
      res.json(rehydratedProjects);
    } catch (error) {
      console.error("Error fetching projects:", error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  app.post('/api/projects', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const projectData = insertProjectSchema.parse(req.body);
      
      // Check user credits
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const creditsNeeded = projectData.contentType === "image" ? 2 : 10; // New credit system: 2 for image, 10 for video
      const isAdmin = user.email === 'admin@test.com';
      
      if (!isAdmin && user.credits < creditsNeeded) {
        return res.status(400).json({ message: "Insufficient credits" });
      }

      // Create project
      const project = await storage.createProject({
        ...projectData,
        userId,
        creditsUsed: creditsNeeded,
        status: "pending"
      });

      // Deduct credits from user account (except for admin)
      if (!isAdmin) {
        await storage.updateUserCredits(userId, user.credits - creditsNeeded);
      }

      // Create job for async processing (Vercel compatible)
      const job = await storage.createJob({
        type: 'cgi_generation',
        projectId: project.id,
        userId: userId,
        data: {
          contentType: projectData.contentType,
          videoDurationSeconds: projectData.videoDurationSeconds,
          productImageUrl: projectData.productImageUrl,
          sceneImageUrl: projectData.sceneImageUrl,
          sceneVideoUrl: projectData.sceneVideoUrl,
          description: projectData.description
        },
        priority: projectData.contentType === 'video' ? 2 : 1 // Videos have higher priority
      });

      console.log(`🎯 Job created for project ${project.id}: ${job.id}`);

      res.json({
        ...project,
        jobId: job.id
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid project data", errors: error.errors });
      }
      console.error("Error creating project:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  app.get('/api/projects/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const project = await storage.getProject(req.params.id);
      
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }

      // Also get job status for this project
      const job = await storage.getJobByProjectId(project.id);

      res.json({
        ...project,
        job: job ? {
          id: job.id,
          status: job.status,
          progress: job.progress,
          statusMessage: job.statusMessage,
          errorMessage: job.errorMessage
        } : null
      });
    } catch (error) {
      console.error("Error fetching project:", error);
      res.status(500).json({ message: "Failed to fetch project" });
    }
  });

  // Credit packages imported from shared constants

  // Credit purchase endpoint with package validation
  app.post('/api/purchase-credits', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const { amount, credits, packageId } = req.body;
      
      if (!amount || !credits || !packageId) {
        return res.status(400).json({ message: "Missing amount, credits, or packageId" });
      }

      // Validate package against defined packages
      const validPackage = CREDIT_PACKAGES[packageId as keyof typeof CREDIT_PACKAGES];
      if (!validPackage || validPackage.price !== amount || validPackage.credits !== credits) {
        return res.status(400).json({ message: "Invalid package selected" });
      }

      // Create Stripe payment intent
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: 'usd',
        metadata: {
          userId,
          credits: credits.toString(),
          packageId: packageId
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      // Create transaction record with payment intent ID (amount in cents)
      const transaction = await storage.createTransaction({
        userId,
        amount: Math.round(amount * 100), // Convert to cents
        credits,
        stripePaymentIntentId: paymentIntent.id,
        status: 'pending'
      });

      res.json({
        clientSecret: paymentIntent.client_secret,
        transactionId: transaction.id,
        paymentIntentId: paymentIntent.id
      });
    } catch (error) {
      console.error("Error creating payment:", error);
      res.status(500).json({ message: "Failed to create payment" });
    }
  });

  // Job Processing Endpoints - SECURED
  app.post('/api/jobs/process', isAuthenticated, async (req, res) => {
    try {
      const job = await storage.getNextPendingJob();
      
      if (!job) {
        return res.json({ message: "No pending jobs" });
      }

      // Atomically claim the job
      const claimed = await storage.claimJob(job.id);
      if (!claimed) {
        return res.json({ message: "Job was already claimed by another worker" });
      }
      
      // Update attempts
      await storage.updateJob(job.id, {
        attempts: job.attempts + 1
      });

      console.log(`🚀 Processing job ${job.id} for project ${job.projectId}`);
      
      // Process the job asynchronously
      processJobAsync(job.id).catch(async (error) => {
        console.error(`❌ Job ${job.id} failed:`, error);
        await storage.markJobFailed(job.id, error.message);
      });

      res.json({ 
        message: "Job processing started",
        jobId: job.id,
        projectId: job.projectId
      });
    } catch (error) {
      console.error("Error processing job:", error);
      res.status(500).json({ error: "Failed to process job" });
    }
  });

  // Job Status Polling
  app.get('/api/jobs/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const job = await storage.getJob(req.params.id);
      
      if (!job) {
        return res.status(404).json({ error: "Job not found" });
      }

      // Verify user owns this job
      if (job.userId !== req.user.id) {
        return res.status(403).json({ error: "Access denied" });
      }

      res.json({
        id: job.id,
        status: job.status,
        progress: job.progress,
        statusMessage: job.statusMessage,
        errorMessage: job.errorMessage,
        result: job.result,
        createdAt: job.createdAt,
        completedAt: job.completedAt
      });
    } catch (error) {
      console.error("Error fetching job status:", error);
      res.status(500).json({ error: "Failed to fetch job status" });
    }
  });

  // Project Status with Job Info
  app.get('/api/projects/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const project = await storage.getProject(req.params.id);
      
      if (!project || project.userId !== userId) {
        return res.status(404).json({ error: "Project not found" });
      }

      const job = await storage.getJobByProjectId(project.id);

      res.json({
        project: {
          id: project.id,
          status: project.status,
          progress: project.progress,
          outputImageUrl: project.outputImageUrl,
          outputVideoUrl: project.outputVideoUrl,
          errorMessage: project.errorMessage
        },
        job: job ? {
          id: job.id,
          status: job.status,
          progress: job.progress,
          statusMessage: job.statusMessage,
          errorMessage: job.errorMessage
        } : null
      });
    } catch (error) {
      console.error("Error fetching project status:", error);
      res.status(500).json({ error: "Failed to fetch project status" });
    }
  });

  // Stripe webhook handler - raw body parsing applied at app level
  app.post('/api/webhooks/stripe', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    
    if (!sig) {
      return res.status(400).send('No stripe signature provided');
    }
    
    try {
      let event;
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      
      if (!webhookSecret) {
        console.error('STRIPE_WEBHOOK_SECRET environment variable is not set');
        return res.status(500).send('Webhook secret not configured');
      }
      
      // Production: verify webhook signature with the environment secret
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      
      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        const { userId, credits, packageId } = paymentIntent.metadata;
        
        if (!userId || !credits || !packageId) {
          console.error('Missing required metadata in payment intent:', paymentIntent.id);
          return res.status(400).send('Invalid payment metadata');
        }
        
        console.log(`💳 Payment succeeded: User ${userId} purchased ${credits} credits (PI: ${paymentIntent.id})`);
        
        // IDEMPOTENCY: Check if this payment intent was already processed
        let existingTransaction = await storage.getTransactionByPaymentIntent(paymentIntent.id);
        if (existingTransaction && existingTransaction.status === 'completed') {
          console.log(`⚠️ Payment intent ${paymentIntent.id} already processed, skipping credit fulfillment`);
          return res.json({ received: true, status: 'already_processed' });
        }
        
        // Validate package and amount against expected values
        const expectedPackage = CREDIT_PACKAGES[packageId as keyof typeof CREDIT_PACKAGES];
        if (!expectedPackage) {
          console.error(`Invalid package ID: ${packageId} for payment intent: ${paymentIntent.id}`);
          return res.status(400).send('Invalid package');
        }
        
        const expectedAmountCents = Math.round(expectedPackage.price * 100);
        if (paymentIntent.amount !== expectedAmountCents || 
            parseInt(credits) !== expectedPackage.credits) {
          console.error(`Amount/credits mismatch for PI ${paymentIntent.id}: expected ${expectedAmountCents}/${expectedPackage.credits}, got ${paymentIntent.amount}/${credits}`);
          return res.status(400).send('Amount validation failed');
        }
        
        // Update user credits (except for admin) - IDEMPOTENT
        const user = await storage.getUser(userId);
        if (user && user.email !== 'admin@test.com') {
          await storage.updateUserCredits(userId, user.credits + parseInt(credits));
          console.log(`✅ Credits updated: User ${userId} now has ${user.credits + parseInt(credits)} credits`);
        }
        
        // Mark transaction as completed to prevent duplicate processing
        if (existingTransaction) {
          await storage.updateTransaction(existingTransaction.id, { 
            status: 'completed',
            processedAt: new Date()
          });
        } else {
          // Create transaction record if not found (shouldn't happen but safety net)
          console.log(`⚠️ Creating transaction record for payment intent ${paymentIntent.id}`);
          await storage.createTransaction({
            userId,
            amount: paymentIntent.amount,
            credits: parseInt(credits),
            stripePaymentIntentId: paymentIntent.id,
            status: 'completed',
            processedAt: new Date()
          });
        }
        
        console.log(`🎯 Idempotent credit fulfillment completed for PI: ${paymentIntent.id}`);
      }
      
      res.json({ received: true });
    } catch (error) {
      console.error('Webhook error:', error);
      res.status(400).send(`Webhook Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  });

  // Download endpoint for completed projects
  app.get('/api/projects/:id/download', isAuthenticated, async (req: any, res) => {
    try {
      const projectId = req.params.id;
      const userId = req.user.id;
      
      const project = await storage.getProject(projectId);
      if (!project || project.userId !== userId) {
        return res.status(404).json({ message: "Project not found" });
      }
      
      if (project.status !== "completed") {
        return res.status(400).json({ message: "Project not completed" });
      }
      
      const outputUrl = project.contentType === "video" ? project.outputVideoUrl : project.outputImageUrl;
      if (!outputUrl) {
        return res.status(404).json({ message: "Output file not found" });
      }
      
      // If it's a local file, serve it directly
      if (outputUrl.startsWith('/api/files/')) {
        const filePath = outputUrl.replace('/api/files/', '');
        const fullPath = path.join(process.env.PRIVATE_OBJECT_DIR || '/tmp', filePath);
        
        try {
          const fileBuffer = await fs.readFile(fullPath);
          
          // Infer MIME type from file extension instead of hardcoding
          let mimeType: string;
          let fileExt: string;
          
          if (project.contentType === "video") {
            mimeType = "video/mp4";
            fileExt = "mp4";
          } else {
            // Extract file extension from outputImageUrl for proper MIME type
            const urlPath = outputUrl.includes('/public-objects/') 
              ? outputUrl.split('/public-objects/')[1] 
              : outputUrl;
            const detectedExt = path.extname(urlPath).toLowerCase();
            
            // Map extensions to MIME types
            const extToMime: { [key: string]: string } = {
              '.jpg': 'image/jpeg',
              '.jpeg': 'image/jpeg', 
              '.png': 'image/png',
              '.gif': 'image/gif',
              '.webp': 'image/webp'
            };
            
            mimeType = extToMime[detectedExt] || 'image/png'; // Fallback to PNG
            fileExt = detectedExt.replace('.', '') || 'png';
          }
          
          const fileName = `${project.title}_${project.id}.${fileExt}`;
          
          res.setHeader('Content-Type', mimeType);
          res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
          res.send(fileBuffer);
        } catch (error) {
          return res.status(404).json({ message: "File not found" });
        }
      } else {
        // For external URLs, redirect
        res.redirect(outputUrl);
      }
    } catch (error) {
      console.error("Error downloading project:", error);
      res.status(500).json({ message: "Failed to download project" });
    }
  });

  // Admin endpoint to make yourself admin (for development/testing)
  app.post('/api/admin/make-admin', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      
      // Update user to be admin
      await storage.updateUser(userId, { isAdmin: true });
      
      res.json({ message: "Admin privileges granted", isAdmin: true });
    } catch (error) {
      console.error("Error granting admin:", error);
      res.status(500).json({ message: "Failed to grant admin privileges" });
    }
  });

  // Admin endpoint to get all users
  app.get('/api/admin/users', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error getting users:", error);
      res.status(500).json({ message: "Failed to get users" });
    }
  });

  // Admin endpoint to get all projects
  app.get('/api/admin/projects', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const projects = await storage.getAllProjects();
      res.json(projects);
    } catch (error) {
      console.error("Error getting projects:", error);
      res.status(500).json({ message: "Failed to get projects" });
    }
  });

  // Endpoint to get actual costs for user projects
  app.get('/api/actual-costs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const projects = await storage.getUserProjects(userId);
      
      // Calculate total costs and breakdown
      let totalCostMillicents = 0;
      let imageProjects = 0;
      let videoProjects = 0;
      const projectCosts = projects.map(project => {
        const cost = project.actualCost || 0; // cost is in millicents
        totalCostMillicents += cost;
        
        if (project.contentType === 'image') imageProjects++;
        if (project.contentType === 'video') videoProjects++;
        
        return {
          id: project.id,
          title: project.title,
          contentType: project.contentType,
          status: project.status,
          actualCostMillicents: cost,
          actualCostCents: (cost / 10).toFixed(1), // Convert millicents to cents for backward compatibility
          actualCostUSD: (cost / 1000).toFixed(4), // Convert millicents to USD
          createdAt: project.createdAt
        };
      });
      
      res.json({
        totalCostMillicents,
        totalCostCents: (totalCostMillicents / 10).toFixed(1), // Convert to cents for backward compatibility
        totalCostUSD: (totalCostMillicents / 1000).toFixed(4), // Convert to USD
        breakdown: {
          totalProjects: projects.length,
          imageProjects,
          videoProjects,
          estimatedImageCostMillicents: imageProjects * 4, // 4 millicents per image project
          estimatedVideoCostMillicents: videoProjects * 504, // 504 millicents per video project (includes image cost)
          estimatedImageCostCents: (imageProjects * 4 / 10).toFixed(1), // backward compatibility
          estimatedVideoCostCents: (videoProjects * 504 / 10).toFixed(1) // backward compatibility
        },
        projects: projectCosts
      });
    } catch (error) {
      console.error("Error getting actual costs:", error);
      res.status(500).json({ message: "Failed to get actual costs" });
    }
  });

  // Admin endpoint to get platform stats
  app.get('/api/admin/stats', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const stats = await storage.getPlatformStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting stats:", error);
      res.status(500).json({ message: "Failed to get platform stats" });
    }
  });

  // 🚨 RECOVERY SYSTEM: Endpoint to recover "failed" projects that actually completed on Kling's side
  app.post("/api/projects/recover", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.id;
      console.log("🔄 RECOVERY: Starting recovery process for user:", userId);

      // Find projects that might need recovery:
      // 1. Status is "failed" or "processing" 
      // 2. Have Kling task IDs saved (klingVideoTaskId or klingSoundTaskId)
      const userProjects = await storage.getUserProjects(userId);
      const recoverableProjects = userProjects.filter(project => 
        (project.status === "failed" || project.status === "processing") &&
        (project.klingVideoTaskId || project.klingSoundTaskId)
      );

      console.log("🔍 RECOVERY: Found projects for potential recovery:", {
        total: userProjects.length,
        recoverable: recoverableProjects.length,
        recoverableIds: recoverableProjects.map(p => p.id)
      });

      if (recoverableProjects.length === 0) {
        return res.json({ 
          message: "No projects found for recovery",
          recovered: 0,
          total: 0
        });
      }

      const klingApiKey = process.env.KLING_API_KEY;
      if (!klingApiKey) {
        throw new Error("KLING_API_KEY environment variable is required");
      }

      let recoveredCount = 0;
      const recoveryResults = [];

      // Check each recoverable project
      for (const project of recoverableProjects) {
        console.log("🔎 RECOVERY: Checking project:", {
          projectId: project.id,
          title: project.title,
          status: project.status,
          hasVideoTaskId: !!project.klingVideoTaskId,
          hasSoundTaskId: !!project.klingSoundTaskId
        });

        try {
          let recovered = false;
          let videoUrl = project.outputVideoUrl;
          
          // Check video task if exists
          if (project.klingVideoTaskId && !project.outputVideoUrl) {
            console.log("🎬 RECOVERY: Checking video task:", project.klingVideoTaskId);
            
            const videoStatusResponse = await fetch(`https://api.piapi.ai/api/v1/task/${project.klingVideoTaskId}`, {
              headers: { 'X-API-Key': klingApiKey }
            });
            
            if (videoStatusResponse.ok) {
              const videoResult = await videoStatusResponse.json();
              const videoData = videoResult.data || videoResult;
              
              console.log("📺 RECOVERY: Video task status:", {
                taskId: project.klingVideoTaskId,
                status: videoData.status,
                hasOutput: !!videoData.output
              });
              
              if (videoData.status === 'completed' && videoData.output) {
                videoUrl = videoData.output;
                recovered = true;
                console.log("✅ RECOVERY: Found completed video:", videoUrl);
              }
            }
          }
          
          // Check audio task if exists and video was found
          if (project.klingSoundTaskId && videoUrl && project.includeAudio) {
            console.log("🔊 RECOVERY: Checking audio task:", project.klingSoundTaskId);
            
            const audioStatusResponse = await fetch(`https://api.piapi.ai/api/v1/task/${project.klingSoundTaskId}`, {
              headers: { 'X-API-Key': klingApiKey }
            });
            
            if (audioStatusResponse.ok) {
              const audioResult = await audioStatusResponse.json();
              const audioData = audioResult.data || audioResult;
              
              console.log("🎵 RECOVERY: Audio task status:", {
                taskId: project.klingSoundTaskId,
                status: audioData.status,
                hasOutput: !!audioData.output
              });
              
              if (audioData.status === 'completed' && audioData.output) {
                videoUrl = audioData.output; // Audio task returns video with audio
                recovered = true;
                console.log("✅ RECOVERY: Found completed video with audio:", videoUrl);
              }
            }
          }
          
          // Update project if we found completed content
          if (recovered && videoUrl) {
            await storage.updateProject(project.id, {
              status: "completed",
              outputVideoUrl: videoUrl,
              progress: 100,
              errorMessage: null // Clear error message
            });
            
            recoveredCount++;
            recoveryResults.push({
              projectId: project.id,
              title: project.title,
              status: "recovered",
              videoUrl: videoUrl
            });
            
            console.log("🎉 RECOVERY SUCCESS:", {
              projectId: project.id,
              title: project.title,
              videoUrl: videoUrl.substring(0, 50) + "..."
            });
          } else {
            recoveryResults.push({
              projectId: project.id,
              title: project.title,
              status: "still_processing_or_failed",
              reason: !videoUrl ? "No completed video found" : "Unknown issue"
            });
          }
          
        } catch (recoveryError) {
          console.error("❌ RECOVERY ERROR for project:", {
            projectId: project.id,
            error: recoveryError instanceof Error ? recoveryError.message : "Unknown error"
          });
          
          recoveryResults.push({
            projectId: project.id,
            title: project.title,
            status: "recovery_failed",
            error: recoveryError instanceof Error ? recoveryError.message : "Unknown error"
          });
        }
      }

      console.log("🏁 RECOVERY COMPLETE:", {
        totalChecked: recoverableProjects.length,
        recovered: recoveredCount,
        results: recoveryResults
      });

      res.json({
        message: `Recovery complete: ${recoveredCount} of ${recoverableProjects.length} projects recovered`,
        recovered: recoveredCount,
        total: recoverableProjects.length,
        results: recoveryResults
      });

    } catch (error) {
      console.error("❌ RECOVERY ENDPOINT ERROR:", error);
      res.status(500).json({ 
        error: "Recovery failed", 
        message: error instanceof Error ? error.message : "Unknown error" 
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}

// NEW: Job-based async processor for Vercel compatibility
async function processJobAsync(jobId: string) {
  try {
    const job = await storage.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const projectId = job.projectId;
    console.log(`🎯 Processing job ${jobId} for project ${projectId}`);

    // Process the project using the original logic
    await processProjectFromJob(job);
    
    console.log(`✅ Job ${jobId} completed successfully`);
  } catch (error) {
    console.error(`❌ Job ${jobId} failed:`, error);
    throw error;
  }
}

// Updated process function that works with job data
async function processProjectFromJob(job: any) {
  const projectId = job.projectId;
  const jobData = job.data;
  let totalCostMillicents = 0; // Track actual API costs in millicents (1/1000 USD)
  
  try {
    console.log(`🚀 Starting CGI processing for project ${projectId}`);
    
    // Get project details for debugging
    const project = await storage.getProject(projectId);
    console.log(`🔍 Project details:`, {
      id: projectId,
      contentType: project?.contentType,
      status: project?.status,
      title: project?.title
    });
    if (!project) {
      throw new Error("Project not found");
    }

    // Update both project and job status
    await storage.updateProject(projectId, { 
      status: "processing", 
      progress: 10 
    });
    
    await storage.updateJob(job.id, {
      progress: 10,
      statusMessage: "Starting CGI processing..."
    });

    // Step 1: Enhance prompt with Gemini AI
    await storage.updateProject(projectId, { 
      status: "enhancing_prompt", 
      progress: 25 
    });
    
    await storage.updateJob(job.id, {
      progress: 25,
      statusMessage: "Enhancing prompt with AI..."
    });

    // Helper function to extract relative path from full URL
    const extractRelativePath = (url: string): string => {
      try {
        const urlObj = new URL(url);
        // Extract path after /public-objects/
        const pathname = urlObj.pathname;
        const match = pathname.match(/\/public-objects\/(.+)/);
        return match ? match[1] : url; // Return relative path or original URL as fallback
      } catch (error) {
        console.warn("Could not parse URL, using as path:", url);
        return url; // Use original string as path if URL parsing fails
      }
    };

    // Use paths from job data or fallback to project data
    const productImagePath = jobData.productImageUrl || project.productImageUrl || "";
    const sceneImagePath = jobData.sceneImageUrl || project.sceneImageUrl || "";
    const sceneVideoPath = jobData.sceneVideoUrl || project.sceneVideoUrl || "";
    
    console.log("Media paths for Gemini:", { 
      productImagePath, 
      sceneImagePath, 
      sceneVideoPath, 
      contentType: project.contentType 
    });

    // Use appropriate scene path (prefer video over image for video projects)
    const scenePath = project.contentType === "video" && sceneVideoPath ? 
      sceneVideoPath : sceneImagePath;
    const isSceneVideo = project.contentType === "video" && sceneVideoPath;

    // Integrate with Gemini AI for prompt enhancement (use video-specific enhancement for video projects)
    let enhancedPrompt;
    let videoPromptData: {
      imageScenePrompt?: string;
      videoMotionPrompt?: string;
      qualityNegativePrompt?: string;
    } = {};
    
    try {
      if (project.contentType === "video") {
        const { enhanceVideoPromptWithGemini } = await import('./services/gemini');
        const result = await enhanceVideoPromptWithGemini(
          productImagePath,
          scenePath,
          project.description || "CGI video generation",
          {
            duration: project.videoDurationSeconds || undefined,
            isSceneVideo: !!isSceneVideo
          }
        );
        enhancedPrompt = result.enhancedPrompt;
        videoPromptData = {
          imageScenePrompt: result.imageScenePrompt,
          videoMotionPrompt: result.videoMotionPrompt,
          qualityNegativePrompt: result.qualityNegativePrompt
        };
        
        console.log("Video prompt separation:", {
          hasImageScene: !!videoPromptData.imageScenePrompt,
          hasVideoMotion: !!videoPromptData.videoMotionPrompt,
          hasNegativePrompt: !!videoPromptData.qualityNegativePrompt,
          imageSceneLength: videoPromptData.imageScenePrompt?.length || 0,
          videoMotionLength: videoPromptData.videoMotionPrompt?.length || 0
        });
      } else {
        enhancedPrompt = await enhancePromptWithGemini(
          productImagePath,
          scenePath,
          project.description || "CGI image generation"
        );
      }
    } finally {
      // Record cost even if call fails
      totalCostMillicents += COSTS.GEMINI_PROMPT_ENHANCEMENT;
    }

    await storage.updateProject(projectId, { 
      enhancedPrompt,
      progress: 50 
    });

    // Step 2: Generate image with Gemini 2.5 Flash Image
    await storage.updateProject(projectId, { 
      status: "generating_image", 
      progress: 60 
    });

    // Integrate with Gemini for multi-image generation - use imageScenePrompt if available
    let geminiImageResult;
    const imagePrompt = videoPromptData.imageScenePrompt || enhancedPrompt;
    console.log("Using prompt for image generation:", {
      usingImageScene: !!videoPromptData.imageScenePrompt,
      promptLength: imagePrompt.length,
      promptType: videoPromptData.imageScenePrompt ? "static-scene-focused" : "combined"
    });
    
    try {
      geminiImageResult = await generateImageWithGemini(
        productImagePath,
        sceneImagePath,
        imagePrompt // Use separated static scene prompt when available
      );
    } finally {
      // Record cost even if call fails
      totalCostMillicents += COSTS.GEMINI_IMAGE_GENERATION;
    }
    
    console.log("Gemini image generation result:", {
      base64Length: geminiImageResult.base64.length,
      mimeType: geminiImageResult.mimeType,
      timestamp: new Date().toISOString()
    });
    
    // Extract file extension from MIME type for proper file handling
    const mimeToExtension: { [key: string]: string } = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp'
    };
    
    const fileExtension = mimeToExtension[geminiImageResult.mimeType] || 'png';
    console.log("Using file extension:", fileExtension, "for MIME type:", geminiImageResult.mimeType);
    
    // Save the generated image to Cloudinary
    const imageBuffer = Buffer.from(geminiImageResult.base64, 'base64');
    
    // Scene preservation validation (basic check)
    if (imageBuffer.length < 1000) {
      console.warn("Generated image is suspiciously small - scene preservation may be insufficient");
    }
    console.log("Scene preservation check - generated image size:", imageBuffer.length, "bytes");
    
    // Upload to Cloudinary
    const { v2: cloudinary } = await import('cloudinary');
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const publicId = `cgi-generated/generated-${uniqueSuffix}`;
    
    console.log("Uploading to Cloudinary with public_id:", publicId);
    
    const cloudinaryResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          resource_type: 'image',
          public_id: publicId,
          folder: 'cgi-generated',
          format: fileExtension,
          quality: 'auto:best'
        },
        (error: any, result: any) => {
          if (error) {
            console.error("Cloudinary upload error:", error);
            reject(error);
          } else {
            console.log("Cloudinary upload success:", {
              public_id: result.public_id,
              url: result.secure_url,
              format: result.format,
              bytes: result.bytes
            });
            resolve(result);
          }
        }
      ).end(imageBuffer);
    });
    
    const imageResult = { url: (cloudinaryResult as any).secure_url };

    await storage.updateProject(projectId, { 
      outputImageUrl: imageResult.url,
      progress: 75 
    });

    // Step 2.5: Enhance video prompt from generated image (NEW STEP!)
    // Use motion-specific prompt if available, otherwise fallback to combined prompt
    let finalVideoPrompt = videoPromptData.videoMotionPrompt || enhancedPrompt;
    let audioPrompt: string | undefined = undefined;
    
    console.log("Base video prompt selection:", {
      usingMotionPrompt: !!videoPromptData.videoMotionPrompt,
      motionPromptLength: videoPromptData.videoMotionPrompt?.length || 0,
      fallbackPromptLength: enhancedPrompt.length,
      promptType: videoPromptData.videoMotionPrompt ? "motion-focused" : "combined"
    });
    
    if (project.contentType === "video") {
      console.log("🎬 Step 2.5: Analyzing generated image for optimal video production...");
      await storage.updateProject(projectId, { 
        status: "generating_video", 
        progress: 78 
      });

      try {
        const { enhanceVideoPromptFromGeneratedImage } = await import('./services/gemini');
        
        const videoEnhancement = await enhanceVideoPromptFromGeneratedImage(
          geminiImageResult, // Use the generated image data
          {
            duration: project.videoDurationSeconds || 10,
            includeAudio: false,
            userDescription: project.description || "",
            productName: project.title || "Product"
          }
        );

        // Merge video enhancement with existing motion prompt (don't overwrite!)
        const basePrompt = finalVideoPrompt; // This is videoMotionPrompt || enhancedPrompt
        finalVideoPrompt = `${basePrompt}

Camera and Production: ${videoEnhancement.enhancedVideoPrompt}`;
        
        console.log("🎬 Video prompt merged with enhancement:", {
          basePromptLength: basePrompt.length,
          enhancementLength: videoEnhancement.enhancedVideoPrompt.length,
          finalPromptLength: finalVideoPrompt.length,
          baseType: videoPromptData.videoMotionPrompt ? "motion-focused" : "combined"
        });
        audioPrompt = videoEnhancement.audioPrompt;

        // Add cost for video prompt enhancement
        totalCostMillicents += COSTS.GEMINI_VIDEO_ANALYSIS;

        console.log("🎬 Video prompt enhanced successfully:", {
          originalPromptLength: enhancedPrompt.length,
          enhancedPromptLength: finalVideoPrompt.length,
          cameraMovements: videoEnhancement.cameraMovements.substring(0, 80) + "...",
          audioIncluded: !!audioPrompt,
          additionalCost: "$0.003"
        });

      } catch (error) {
        console.warn("⚠️ Video prompt enhancement failed, using original:", error);
        // Continue with original prompt if enhancement fails
        await storage.updateProject(projectId, { 
          status: "generating_video", 
          progress: 80 
        });
      }
    }

    // Step 3: Generate video if requested
    console.log("🎬 Checking video generation condition:", {
      projectId,
      contentType: project.contentType,
      shouldGenerateVideo: project.contentType === "video",
      imageUrl: imageResult.url,
      promptLength: finalVideoPrompt.length
    });
    
    if (project.contentType === "video") {
      console.log("🎬 Starting video generation for project:", projectId);
      await storage.updateProject(projectId, { 
        status: "generating_video", 
        progress: 80 
      });

      try {
        // Integrate with Kling AI for video generation
        console.log("🎬 Attempting to import kling-video service...");
        const { generateVideoWithKling } = await import('./services/kling-video');
        console.log("🎬 kling-video service imported successfully:", typeof generateVideoWithKling);
        let videoResult;
        try {
          console.log("🎬 Calling generateVideoWithKling with:", {
            imageUrl: imageResult.url,
            promptLength: finalVideoPrompt.length,
            promptType: finalVideoPrompt === enhancedPrompt ? "original" : "video-enhanced",
            duration: project.videoDurationSeconds || 10,
            includeAudio: false,
            hasAudioPrompt: false
          });
          
          // Use the video-enhanced prompt and selected video duration with quality negative prompt
          const effectiveNegativePrompt = videoPromptData.qualityNegativePrompt || 
            "deformed, distorted, unnatural proportions, melting, morphing, blurry, low quality";
          
          console.log("🎬 Kling API negative prompt validation:", {
            hasCustomNegative: !!videoPromptData.qualityNegativePrompt,
            negativePromptLength: effectiveNegativePrompt.length,
            negativePromptPreview: effectiveNegativePrompt.substring(0, 50) + "..."
          });
          
          // Assert non-empty negative prompt
          if (!effectiveNegativePrompt || effectiveNegativePrompt.trim().length === 0) {
            throw new Error("Negative prompt must not be empty for video generation");
          }
          
          videoResult = await generateVideoWithKling(
            imageResult.url, 
            finalVideoPrompt, // Use enhanced video prompt instead of original
            project.videoDurationSeconds || 10,
            false, // Audio disabled
            effectiveNegativePrompt,
            // For recovery system
            projectId,
            storage
          );
          
          console.log("🎬 generateVideoWithKling returned:", {
            success: !!videoResult,
            hasUrl: !!videoResult?.url,
            videoUrl: videoResult?.url?.substring(0, 50) + "...",
            hasFullTaskDetails: !!videoResult?.fullTaskDetails,
            taskDetailsSize: videoResult?.fullTaskDetails ? JSON.stringify(videoResult.fullTaskDetails).length : 0
          });
          
          // Update video URL and full task details if generation succeeded
          await storage.updateProject(projectId, { 
            outputVideoUrl: videoResult.url,
            fullTaskDetails: videoResult.fullTaskDetails || null, // NEW: Save complete task details for UI display
            progress: 95 
          });
          
          console.log("Video generation completed successfully:", {
            projectId,
            videoUrl: videoResult.url,
            duration: videoResult.duration
          });
          
        } finally {
          // Record cost even if video generation fails
          totalCostMillicents += COSTS.VIDEO_GENERATION;
        }
      } catch (videoError) {
        console.error("❌ VIDEO GENERATION FAILED:", {
          projectId,
          errorMessage: videoError instanceof Error ? videoError.message : "Unknown error",
          errorStack: videoError instanceof Error ? videoError.stack : "No stack trace",
          imageUrl: imageResult.url,
          promptLength: finalVideoPrompt.length
        });
        
        // Store error in database instead of hiding it
        await storage.updateProject(projectId, { 
          errorMessage: `Video generation failed: ${videoError instanceof Error ? videoError.message : "Unknown error"}`,
          status: "failed"
        });
        
        // Don't continue as completed - mark as failed
        throw videoError;
      }
    }

    // Mark as completed and update actual cost
    console.log(`Total actual cost for project ${projectId}: $${(totalCostMillicents / 1000).toFixed(4)} (${totalCostMillicents} millicents)`);
    
    const finalImageUrl = imageResult?.url || null;
    const finalVideoUrl = project.contentType === "video" ? project.outputVideoUrl : null;
    
    await storage.updateProject(projectId, { 
      status: "completed", 
      progress: 100,
      actualCost: totalCostMillicents
    });

    // Mark job as completed with results
    await storage.markJobCompleted(job.id, {
      outputImageUrl: finalImageUrl,
      outputVideoUrl: finalVideoUrl,
      totalCost: totalCostMillicents,
      costInUSD: (totalCostMillicents / 1000).toFixed(4)
    });

    console.log(`CGI processing completed for project ${projectId}`);
  } catch (error) {
    console.error(`CGI processing failed for project ${projectId}:`, error);
    
    // Mark as failed and store error message with actual cost incurred
    console.log(`Actual cost incurred despite failure: $${(totalCostMillicents / 1000).toFixed(4)} (${totalCostMillicents} millicents)`);
    await storage.updateProject(projectId, { 
      status: "failed", 
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      actualCost: totalCostMillicents
    });
    
    // Mark job as failed
    await storage.markJobFailed(job.id, error instanceof Error ? error.message : "Unknown error");
  }
}
