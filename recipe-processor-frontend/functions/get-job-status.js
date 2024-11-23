const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');

// Initialize SQLite database
let db;
const initDb = async () => {
  if (!db) {
    db = await open({
      filename: path.join('/.tmp', 'batch_jobs.db'),
      driver: sqlite3.Database
    });
  }
  return db;
};

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const db = await initDb();
    const { job_id } = event.queryStringParameters;

    const job = await db.get('SELECT * FROM batch_jobs WHERE job_id = ?', [job_id]);
    
    if (!job) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Job not found' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify(job)
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
