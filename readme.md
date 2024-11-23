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
- Git
- GitHub account
- Netlify account
- API keys for:
  - Claude API (Anthropic)
  - Gemini API (Google)
  - OpenAI API (optional)

## Local Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/fankitmedia-dev/recipe-processor.git
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

4. Install dependencies for both frontend and backend:
   ```bash
   cd recipe-processor-backend && npm install
   cd ../recipe-processor-frontend && npm install
   ```

5. Create `.env` files:

   Backend (.env):
   ```
   CLAUDE_API_KEY=your_claude_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here
   PORT=3001
   ```

6. Start the application:

   Backend:
   ```bash
   cd recipe-processor-backend
   npm start
   ```

   Frontend:
   ```bash
   cd recipe-processor-frontend
   npm start
   ```

## GitHub Setup

1. Create a new repository on GitHub:
   - Go to [GitHub](https://github.com)
   - Click "+" → "New repository"
   - Name: "recipe-processor"
   - Make it public or private
   - Click "Create repository"

2. Generate Personal Access Token (PAT):
   - Go to GitHub.com → Profile picture → Settings
   - Developer settings → Personal access tokens → Tokens (classic)
   - Generate new token (classic)
   - Name: "Recipe Processor Deploy"
   - Select scopes:
     - `repo` (all)
     - `workflow`
   - Copy the generated token

3. Configure Git:
   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "your@email.com"
   git remote set-url origin https://YOUR_PAT@github.com/your-username/recipe-processor.git
   ```

4. Push code:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push -u origin main
   ```

## Netlify Deployment

1. Connect to GitHub:
   - Go to [Netlify](https://app.netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Choose "Deploy with GitHub"
   - Select "recipe-processor" repository

2. Configure build settings:
   - Build command: `CI= npm install && npm run build`
   - Publish directory: `build`
   - Base directory: `recipe-processor-frontend`

3. Environment variables:
   - Go to Site settings → Environment variables
   - Add the following:
     ```
     CLAUDE_API_KEY=your_claude_api_key
     GEMINI_API_KEY=your_gemini_api_key
     OPENAI_API_KEY=your_openai_api_key (optional)
     ```

4. Deploy:
   - Click "Deploy site"
   - Wait for build and deployment
   - Your site will be available at `https://your-site-name.netlify.app`

## API Keys Setup

1. Claude API (Anthropic):
   - Go to [Anthropic Console](https://console.anthropic.com)
   - Sign up or log in
   - Go to API Keys section
   - Create a new API key
   - Copy and save it securely

2. Gemini API (Google):
   - Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create or select a project
   - Enable the Gemini API
   - Create credentials (API key)
   - Copy and save it securely

3. OpenAI API (Optional):
   - Go to [OpenAI Platform](https://platform.openai.com)
   - Sign up or log in
   - Go to API keys section
   - Create a new secret key
   - Copy and save it securely

## Environment Variables

Create these environment variables in both your local setup and Netlify:

```env
# Required
CLAUDE_API_KEY=your_claude_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here

# Optional
OPENAI_API_KEY=your_openai_api_key_here
```

## Database Schema

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

1. Build Issues:
   - Ensure all required files exist in the `public` directory
   - Check if environment variables are set correctly
   - Try running `CI= npm run build` locally

2. API Issues:
   - Verify API keys are correct
   - Check API quotas and limits
   - Look for error messages in the console

3. Database Issues:
   - Ensure SQLite is installed
   - Check file permissions
   - Verify database path is correct

## Support

For issues and support:
1. Check the console logs
2. Look for error messages in the UI
3. Check the batch job status
4. Create an issue on GitHub

## License

[Your License]

## Contributing

[Your Contributing Guidelines]
