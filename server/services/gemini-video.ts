import { GoogleGenAI } from "@google/genai";

interface GeminiVideoResult {
  url: string;
  duration: number;
}

export async function generateVideoWithGemini(imageUrl: string, prompt: string, durationSeconds?: number): Promise<GeminiVideoResult> {
  const duration = durationSeconds || 5;
  
  try {
    console.log("Starting Gemini video generation with Veo 3:", {
      imageUrl,
      promptLength: prompt.length,
      duration,
      apiKeyExists: !!process.env.GEMINI_API_KEY
    });

    // Initialize Google GenAI client
    const genAI = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY
    });

    // Download the image from the URL to get bytes
    console.log("Downloading image for Veo 3 video generation...");
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to download image: ${imageResponse.status}`);
    }
    const imageBuffer = await imageResponse.arrayBuffer();
    const imageBytes = Buffer.from(imageBuffer).toString('base64');

    console.log("Image downloaded, starting video generation operation...");

    // Generate video with Veo 3 using the correct video generation API
    const operation = await genAI.models.generateVideos({
      model: "veo-3.0-generate-001",
      prompt: prompt,
      image: {
        imageBytes: imageBytes,
        mimeType: "image/jpeg"
      },
      config: {
        aspectRatio: "16:9",
        resolution: "720p",
        durationSeconds: duration
      }
    });

    console.log("Gemini video operation started, polling for completion...");

    // Poll for completion
    let currentOperation = operation;
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes timeout
    
    while (!currentOperation.done && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds (as per docs)
      
      console.log(`Polling video generation... attempt ${attempts + 1}/${maxAttempts}`);
      
      currentOperation = await genAI.operations.getVideosOperation({
        operation: currentOperation
      });
      
      attempts++;
    }
    
    if (!currentOperation.done) {
      throw new Error("Gemini video generation timeout");
    }
    
    if (!currentOperation.response || !currentOperation.response.generatedVideos || currentOperation.response.generatedVideos.length === 0) {
      throw new Error("No video generated in response");
    }

    const video = currentOperation.response.generatedVideos[0];
    console.log("Gemini video generation completed successfully:", {
      videoStructure: Object.keys(video),
      fullVideoData: video
    });

    // Extract the actual video URL from the response
    const videoData = video as any; // Type assertion to access dynamic properties
    const videoUrl = videoData.videoUrl || videoData.url || videoData.secure_url || videoData.downloadUrl;
    
    if (!videoUrl) {
      console.error("No video URL found in response. Available properties:", Object.keys(video));
      console.error("Full video object:", video);
      throw new Error("Video URL not found in Gemini response");
    }
    
    console.log("Video generation successful, URL:", videoUrl);
    
    return {
      url: videoUrl,
      duration: duration,
    };

  } catch (error) {
    console.error("Gemini video generation error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to generate video with Gemini Veo 3: ${errorMessage}`);
  }
}