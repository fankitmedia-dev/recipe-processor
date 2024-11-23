// server.js
import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import OpenAI from 'openai';
import { Anthropic } from '@anthropic-ai/sdk';
import axios from 'axios';
import rateLimit from 'express-rate-limit';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

dotenv.config();

const app = express();

// Configure rate limiters for different AI services
const createRateLimiter = (windowMs, max) => rateLimit({
  windowMs,
  max,
  message: { 
    success: false, 
    error: 'Rate limit exceeded',
    retryAfter: Math.ceil(windowMs / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Update these limits based on the model
const gptLimiter = createRateLimiter(60 * 1000, 10000);    // 10k requests per minute
const geminiLimiter = createRateLimiter(60 * 1000, 60);    // 60 requests per minute
const claudeLimiter = createRateLimiter(60 * 1000, 50);    // 50 requests per minute
const perplexityLimiter = createRateLimiter(60 * 1000, 50);

// Increase JSON limit and add error handling
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'https://your-netlify-url.netlify.app'],
  methods: ['GET', 'POST'],
  credentials: true
}));

// Initialize AI clients
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
  betas: ['message-batches-2024-09-24']
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Initialize database
let db;
const initDatabase = async () => {
  db = await open({
    filename: './batch_jobs.db',
    driver: sqlite3.Database
  });

  // Create jobs table if it doesn't exist
  await db.exec(`
    CREATE TABLE IF NOT EXISTS batch_jobs (
      job_id TEXT PRIMARY KEY,
      status TEXT,
      progress REAL,
      created_at DATETIME,
      completed_at DATETIME,
      total_messages INTEGER,
      processed_messages INTEGER,
      batch_id TEXT,
      error TEXT,
      results TEXT,
      model_config TEXT
    )
  `);
};

// Initialize database on startup
initDatabase().catch(console.error);

// Helper functions for job management
const jobManager = {
  async createJob(jobId, totalMessages, modelConfig) {
    await db.run(
      `INSERT INTO batch_jobs (
        job_id, status, progress, created_at, total_messages, 
        processed_messages, results, model_config
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [jobId, 'created', 0, new Date().toISOString(), 
       totalMessages, 0, '[]', JSON.stringify(modelConfig)]
    );
  },

  async updateJob(jobId, updates) {
    const setClauses = [];
    const values = [];
    
    Object.entries(updates).forEach(([key, value]) => {
      setClauses.push(`${key} = ?`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
    });
    
    values.push(jobId);
    await db.run(
      `UPDATE batch_jobs SET ${setClauses.join(', ')} WHERE job_id = ?`,
      values
    );
  },

  async getJob(jobId) {
    const job = await db.get('SELECT * FROM batch_jobs WHERE job_id = ?', jobId);
    if (job && job.results) {
      job.results = JSON.parse(job.results);
    }
    if (job && job.model_config) {
      job.model_config = JSON.parse(job.model_config);
    }
    return job;
  },

  async cleanupOldJobs() {
    const CLEANUP_DAYS = 29;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - CLEANUP_DAYS);
    
    await db.run(
      'DELETE FROM batch_jobs WHERE completed_at < ?',
      [cutoffDate.toISOString()]
    );
  }
};

// Error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('Error:', err);
  
  // Handle specific API errors
  if (err.response) {
    const status = err.response.status;
    const message = err.response.data?.error || err.message;
    
    if (status === 429) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: 60
      });
    }
    
    return res.status(status).json({
      success: false,
      error: message
    });
  }

  // Handle aborted requests
  if (err.name === 'AbortError') {
    return res.status(499).json({
      success: false,
      error: 'Request cancelled'
    });
  }

  // Handle other errors
  res.status(500).json({
    success: false,
    error: err.message || 'An unknown error occurred'
  });
};

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, {
    body: req.body,
    timestamp: new Date().toISOString()
  });
  next();
});

// Apply rate limiters based on model
app.use('/process', (req, res, next) => {
  const model = req.body.model?.toLowerCase();
  switch(model) {
    case 'gemini':
      return geminiLimiter(req, res, next);
    case 'gpt':
      return gptLimiter(req, res, next);
    case 'claude':
      return claudeLimiter(req, res, next);
    case 'perplexity':
      return perplexityLimiter(req, res, next);
    default:
      next();
  }
});

const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

// Add these helper functions at the top of the file
const isValidImageUrl = async (url) => {
  try {
    const response = await axios.head(url);
    const contentType = response.headers['content-type'];
    return contentType.startsWith('image/');
  } catch (error) {
    return false;
  }
};

const processImageUrl = async (url) => {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const base64Image = Buffer.from(response.data).toString('base64');
    return `data:${response.headers['content-type']};base64,${base64Image}`;
  } catch (error) {
    throw new Error(`Failed to process image URL: ${error.message}`);
  }
};

// Helper to poll batch status
const pollBatchStatus = async (batchId, maxAttempts = 60, delayMs = 5000) => {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const batch = await anthropic.beta.messages.batches.retrieve(batchId);
    if (batch.processing_status === 'ended') {
      return batch;
    }
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  throw new Error('Batch processing timeout');
};

// Process batch with Claude API
const processBatchClaude = async (messages, modelConfig) => {
  try {
    // Create batch requests with unique custom_ids
    const requests = messages.map((msg, index) => ({
      custom_id: `msg_${Date.now()}_${index}`,
      params: {
        model: modelConfig.model,
        max_tokens: modelConfig.token,
        messages: [{ role: 'user', content: msg.content }],
        system: modelConfig.systemPrompt
      }
    }));

    // Create batch
    const batch = await anthropic.beta.messages.batches.create({ requests });
    console.log(`Created batch ${batch.id}, waiting for processing...`);

    // Poll for completion
    const completedBatch = await pollBatchStatus(batch.id);
    
    // Stream and process results
    const results = [];
    for await (const result of anthropic.beta.messages.batches.results(batch.id)) {
      switch (result.result.type) {
        case 'succeeded':
          results[parseInt(result.custom_id.split('_')[2])] = result.result.message.content[0].text;
          break;
        case 'errored':
          console.error(`Error processing request ${result.custom_id}:`, result.result.error);
          results[parseInt(result.custom_id.split('_')[2])] = `Error: ${result.result.error.message}`;
          break;
        case 'expired':
          console.error(`Request ${result.custom_id} expired`);
          results[parseInt(result.custom_id.split('_')[2])] = 'Error: Request expired';
          break;
      }
    }

    return results;
  } catch (error) {
    console.error('Batch processing error:', error);
    throw error;
  }
};

// Update the /process route
app.post('/process', async (req, res, next) => {
  try {
    const { prompt, model, modelConfig, targetColumn, batchMessages } = req.body;

    if (!prompt && !batchMessages) {
      return res.status(400).json({
        success: false,
        error: 'Prompt or batch messages are required'
      });
    }

    let result;
    const isVisionRequest = modelConfig.visionEnabled && modelConfig.visionModel;

    if (isVisionRequest && modelConfig.imageUrls.length > 0) {
      // Process all image URLs
      const processedImages = await Promise.all(
        modelConfig.imageUrls.map(async (url) => {
          if (await isValidImageUrl(url)) {
            return processImageUrl(url);
          }
          return null;
        })
      );

      const validImages = processedImages.filter(img => img !== null);

      if (validImages.length === 0) {
        // Fallback to regular text processing if no valid images
        isVisionRequest = false;
      } else {
        switch(model.toLowerCase()) {
          case 'gemini':
            const geminiVisionModel = genAI.getGenerativeModel({
              model: modelConfig.visionModel
            });

            const geminiVisionPrompt = modelConfig.systemPrompt
              ? `${modelConfig.systemPrompt}\n\n${prompt}`
              : prompt;

            const geminiContent = [geminiVisionPrompt];
            validImages.forEach(image => {
              geminiContent.push({
                inlineData: { data: image.split(',')[1], mimeType: 'image/jpeg' }
              });
            });

            const geminiResult = await geminiVisionModel.generateContent(geminiContent);
            result = geminiResult.response.text();
            break;

          case 'gpt':
            const content = [{ type: "text", text: prompt }];
            validImages.forEach(image => {
              content.push({
                type: "image_url",
                image_url: { url: image }
              });
            });

            const visionResponse = await openai.chat.completions.create({
              model: modelConfig.visionModel,
              messages: [{ role: "user", content }],
              max_tokens: modelConfig.token
            });
            result = visionResponse.choices[0].message.content;
            break;

          case 'claude':
            const claudeContent = [{ type: 'text', text: prompt }];
            validImages.forEach(image => {
              claudeContent.push({
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: image.split(',')[1]
                }
              });
            });

            const claudeMessage = await anthropic.messages.create({
              model: modelConfig.visionModel,
              max_tokens: modelConfig.token,
              messages: [{ role: 'user', content: claudeContent }]
            });
            result = claudeMessage.content[0].text;
            break;

          default:
            throw new Error(`Vision not supported for model: ${model}`);
        }
      }
    }

    if (!result) {
      // Fallback to regular text processing
      switch(model.toLowerCase()) {
        case 'gemini':
          const geminiModel = genAI.getGenerativeModel({ model: modelConfig.model });
          const geminiResult = await geminiModel.generateContent(prompt);
          result = geminiResult.response.text();
          break;

        case 'gpt':
          const gptResponse = await openai.chat.completions.create({
            model: modelConfig.model,
            messages: [{ role: "user", content: prompt }],
            max_tokens: modelConfig.token
          });
          result = gptResponse.choices[0].message.content;
          break;

        case 'claude':
          if (Array.isArray(batchMessages)) {
            // Handle batch processing
            result = await processBatchClaude(batchMessages, modelConfig);
          } else {
            // Handle single message (existing code)
            const claudeResponse = await anthropic.messages.create({
              model: modelConfig.model,
              max_tokens: modelConfig.token,
              messages: [{ role: 'user', content: prompt }]
            });
            result = claudeResponse.content[0].text;
          }
          break;

        case 'perplexity':
          // Add Perplexity API implementation here
          break;

        default:
          throw new Error(`Unsupported model: ${model}`);
      }
    }

    if (!result) {
      throw new Error('No result generated');
    }

    // Store the result in the specified column format
    const formattedResult = {
      success: true,
      result: result,
      targetColumn: targetColumn
    };

    res.json(formattedResult);

  } catch (error) {
    next(error);
  }
});

// Modified batch endpoints to use persistent storage
app.post('/batch', async (req, res) => {
  try {
    const { messages, modelConfig } = req.body;
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store job in database
    await jobManager.createJob(jobId, messages.length, modelConfig);

    // Start processing in background
    processBatchAsync(jobId, messages, modelConfig);

    res.json({
      jobId,
      status: 'created',
      message: 'Batch job created successfully'
    });
  } catch (error) {
    console.error('Error creating batch job:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/batch/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await jobManager.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Batch job not found' });
    }

    res.json(job);
  } catch (error) {
    console.error('Error fetching job:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/batch/:jobId/results', async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await jobManager.getJob(jobId);
    
    if (!job) {
      return res.status(404).json({ error: 'Batch job not found' });
    }

    if (job.status !== 'completed') {
      return res.status(400).json({ error: 'Batch job not completed yet' });
    }

    res.json({ results: job.results });
  } catch (error) {
    console.error('Error fetching results:', error);
    res.status(500).json({ error: error.message });
  }
});

// Modified batch processing function to use persistent storage
const processBatchAsync = async (jobId, messages, modelConfig) => {
  try {
    // Create batch requests with unique custom_ids
    const requests = messages.map((msg, index) => ({
      custom_id: `${jobId}_${index}`,
      params: {
        model: modelConfig.model,
        max_tokens: modelConfig.token,
        messages: [{ role: 'user', content: msg.content }],
        system: modelConfig.systemPrompt
      }
    }));

    // Update job status
    await jobManager.updateJob(jobId, {
      status: 'processing',
      progress: 0
    });

    // Create batch
    const batch = await anthropic.beta.messages.batches.create({ requests });
    await jobManager.updateJob(jobId, {
      batch_id: batch.id,
      status: 'waiting'
    });

    // Poll for completion
    const completedBatch = await pollBatchStatus(batch.id);
    
    // Process results
    const results = new Array(messages.length);
    let processedCount = 0;
    
    for await (const result of anthropic.beta.messages.batches.results(batch.id)) {
      const index = parseInt(result.custom_id.split('_')[2]);
      
      switch (result.result.type) {
        case 'succeeded':
          results[index] = result.result.message.content[0].text;
          break;
        case 'errored':
          results[index] = `Error: ${result.result.error.message}`;
          break;
        case 'expired':
          results[index] = 'Error: Request expired';
          break;
      }

      // Update progress
      processedCount++;
      await jobManager.updateJob(jobId, {
        processed_messages: processedCount,
        progress: (processedCount / messages.length) * 100
      });
    }

    // Update job with results
    await jobManager.updateJob(jobId, {
      status: 'completed',
      results: results,
      completed_at: new Date().toISOString()
    });

    // Clean up old jobs
    await jobManager.cleanupOldJobs();
  } catch (error) {
    console.error(`Error processing batch job ${jobId}:`, error);
    await jobManager.updateJob(jobId, {
      status: 'failed',
      error: error.message
    });
  }
};

// Apply error handling middleware
app.use(errorHandler);

const PORT = process.env.PORT || 3001;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  // Implement any necessary cleanup here
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err);
  // Implement any necessary cleanup here
});