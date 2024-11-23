const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const path = require('path');
const fs = require('fs');

async function setup() {
  console.log('🚀 Setting up Recipe Processor...');

  // Create backend .env if it doesn't exist
  const backendEnvPath = path.join(__dirname, 'recipe-processor-backend', '.env');
  if (!fs.existsSync(backendEnvPath)) {
    console.log('📝 Creating backend .env file...');
    const envContent = `CLAUDE_API_KEY=your_claude_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
OPENAI_API_KEY=your_openai_api_key_here
PORT=3001`;
    fs.writeFileSync(backendEnvPath, envContent);
    console.log('✅ Backend .env created');
  }

  // Initialize SQLite database
  console.log('🗄️  Setting up SQLite database...');
  const dbPath = path.join(__dirname, 'recipe-processor-backend', 'batch_jobs.db');
  
  try {
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    // Create jobs table
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

    console.log('✅ Database initialized successfully');
    await db.close();
  } catch (error) {
    console.error('❌ Error setting up database:', error);
    process.exit(1);
  }

  console.log(`
🎉 Setup completed successfully!

Next steps:
1. Edit recipe-processor-backend/.env and add your API keys
2. Install dependencies:
   cd recipe-processor-backend && npm install
   cd ../recipe-processor-frontend && npm install

3. Start the application:
   Backend: cd recipe-processor-backend && npm start
   Frontend: cd recipe-processor-frontend && npm start

For more information, check the README.md file.
`);
}

setup().catch(console.error);
