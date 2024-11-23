const { Claude } = require('@anthropic-ai/sdk');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

// Initialize Claude client
const claude = new Claude({
  apiKey: process.env.CLAUDE_API_KEY,
});

// Initialize SQLite database
let db;
const initDb = async () => {
  if (!db) {
    db = await open({
      filename: path.join('/.tmp', 'batch_jobs.db'),
      driver: sqlite3.Database
    });
    
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
  }
  return db;
};

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const db = await initDb();
    const { messages, model_config } = JSON.parse(event.body);
    
    // Create batch job
    const job_id = Date.now().toString();
    await db.run(`
      INSERT INTO batch_jobs (
        job_id, status, progress, created_at, total_messages, 
        processed_messages, model_config
      ) VALUES (?, ?, ?, datetime('now'), ?, ?, ?)
    `, [job_id, 'created', 0, messages.length, 0, JSON.stringify(model_config)]);

    // Process messages in batches
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < messages.length; i += batchSize) {
      batches.push(messages.slice(i, i + batchSize));
    }

    // Update job status
    await db.run('UPDATE batch_jobs SET status = ? WHERE job_id = ?', 
      ['processing', job_id]);

    // Process batches
    const results = [];
    let processed = 0;

    for (const batch of batches) {
      const batchResponses = await Promise.all(batch.map(async (message) => {
        try {
          const response = await claude.messages.create({
            model: model_config.model || 'claude-3-opus-20240229',
            max_tokens: model_config.max_tokens || 4096,
            messages: [{ role: 'user', content: message }]
          });
          return response.content[0].text;
        } catch (error) {
          console.error('Error processing message:', error);
          return `Error: ${error.message}`;
        }
      }));

      results.push(...batchResponses);
      processed += batch.length;

      // Update progress
      const progress = (processed / messages.length) * 100;
      await db.run(
        'UPDATE batch_jobs SET processed_messages = ?, progress = ? WHERE job_id = ?',
        [processed, progress, job_id]
      );
    }

    // Update job completion
    await db.run(`
      UPDATE batch_jobs 
      SET status = ?, completed_at = datetime('now'), results = ? 
      WHERE job_id = ?
    `, ['completed', JSON.stringify(results), job_id]);

    return {
      statusCode: 200,
      body: JSON.stringify({ job_id, status: 'created' })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
