# Recipe Processor

A powerful tool for processing recipe data using AI. Supports batch processing with Claude, GPT, and Gemini models.

## Features

- Process large recipe datasets efficiently
- Support for multiple AI models (Claude, GPT, Gemini)
- Batch processing with 50% cost reduction
- Real-time progress tracking
- Persistent job storage
- Automatic result saving

## Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

## Quick Start

1. Clone the repository:
   ```bash
   git clone [your-repo-url]
   cd recipe-processor
   ```

2. Install setup dependencies:
   ```bash
   npm install sqlite3 sqlite
   ```

3. Run the setup script:
   ```bash
   node setup.js
   ```

4. Edit API keys in `recipe-processor-backend/.env`:
   ```
   CLAUDE_API_KEY=your_claude_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   ```

5. Install dependencies for both frontend and backend:
   ```bash
   cd recipe-processor-backend && npm install
   cd ../recipe-processor-frontend && npm install
   ```

6. Start the application:

   In one terminal:
   ```bash
   cd recipe-processor-backend
   npm start
   ```

   In another terminal:
   ```bash
   cd recipe-processor-frontend
   npm start
   ```

7. Open your browser and navigate to `http://localhost:3000`

## Batch Processing

The application now supports efficient batch processing using Claude's Batch API:

- Upload large datasets (up to 10,000 rows per batch)
- 50% cost reduction compared to standard processing
- Process multiple sheets simultaneously
- Track progress in real-time
- Results persist across app restarts

### How Batch Processing Works

1. Upload your sheet as normal
2. The system automatically creates a batch job
3. You can:
   - Keep the app open to see real-time progress
   - Close the app and come back later
   - Process multiple sheets at once
4. Results are saved automatically
5. Jobs are cleaned up after 29 days

## Development

### Project Structure

```
recipe-processor/
├── recipe-processor-frontend/   # React frontend
├── recipe-processor-backend/    # Express backend
├── setup.js                    # Setup script
└── README.md
```

### Database Schema

The application uses SQLite for persistent storage of batch jobs:

```sql
CREATE TABLE batch_jobs (
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
);
```

## Troubleshooting

### Common Issues

1. **Database Errors**
   - Ensure you've run `node setup.js`
   - Check file permissions in the backend directory

2. **API Key Issues**
   - Verify your API keys in `.env`
   - Ensure you have the correct permissions for the APIs

3. **Processing Errors**
   - Check your internet connection
   - Verify the input data format
   - Check the job status in the UI

### Getting Help

If you encounter any issues:
1. Check the console logs in both frontend and backend
2. Look for error messages in the UI
3. Check the batch job status in the database

## License

[Your License]

## Contributing

[Your Contributing Guidelines]
