# AI Recipe Processor - Setup Guide

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v16 or higher)
- npm (Node Package Manager)

You'll also need API keys from the following services:
- OpenAI API key (for GPT)
- Google AI API key (for Gemini)
- Anthropic API key (for Claude)
- Perplexity API key (optional)

## Installation Steps

1. **Clone the Repository**
```bash
git clone [your-repository-url]
cd recipe-processor
```

2. **Run Setup Script**
```bash
chmod +x setup.sh
./setup.sh
```

3. **Configure API Keys**
Navigate to `recipe-processor-backend/.env` and update the API keys:
```env
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key
CLAUDE_API_KEY=your_claude_api_key
PERPLEXITY_API_KEY=your_perplexity_api_key
PORT=3001
```

4. **Start the Application**
```bash
npm start
```
This will start both the frontend and backend servers.

## Available Scripts

- `npm run install-all`: Install dependencies for both frontend and backend
- `npm run start-frontend`: Start only the frontend server
- `npm run start-backend`: Start only the backend server
- `npm start`: Start both frontend and backend servers
- `npm run build`: Build the frontend application

## Application Structure

```
recipe-processor/
├── recipe-processor-frontend/    # Frontend React application
│   ├── src/
│   │   ├── components/
│   │   │   └── AIProcessor.jsx  # Main component
│   │   ├── App.jsx
│   │   └── App.css
│   └── package.json
├── recipe-processor-backend/     # Backend Node.js server
│   ├── server.js                # Main server file
│   ├── package.json
│   └── .env                     # API keys configuration
├── package.json                 # Root package.json
└── setup.sh                     # Setup script
```

## Configuration Options

### AI Models
The application supports multiple AI models with different capabilities:

1. **GPT (OpenAI)**
   - Default Model: gpt4o-2024-06-06
   - Vision Model: gpt-4-vision-preview
   - Token Limit: 4000

2. **Gemini (Google)**
   - Default Model: gemini-1.5-flash
   - Vision Model: gemini-pro-vision
   - Token Limit: 8092

3. **Claude (Anthropic)**
   - Default Model: claude-3-5-sonnet-20240620
   - Vision Model: claude-3-opus-20240229
   - Token Limit: 4050

4. **Perplexity**
   - Default Model: llama-3.1-sonar-small-128k-online
   - Token Limit: 4050

### Rate Limits

The application includes built-in rate limiting:
- GPT: 10,000 requests per minute
- Gemini: 60 requests per minute
- Claude: 50 requests per minute
- Perplexity: 50 requests per minute

## Usage Guide

1. **Select AI Model**
   - Choose your preferred AI model from the dropdown
   - Configure model settings (model name, tokens, system prompt)
   - Enable vision capabilities if needed

2. **Upload Data**
   - Upload your CSV file containing the data to process
   - The application will display available columns

3. **Create Prompts**
   - Add prompts using the "Add Prompt" button
   - Configure prompt settings:
     - Name: Identifier for the prompt
     - Output Column: Where results will be saved
     - Vision Capability: Enable if processing images
     - Template: Your prompt template using {columnName} syntax

4. **Process Data**
   - Click "Process Data" to start
   - Monitor progress in real-time
   - Download results at any time
   - Use "Stop Processing" if needed

## Troubleshooting

1. **Connection Issues**
   - Verify both frontend and backend are running
   - Check if ports 3000 and 3001 are available
   - Ensure API keys are correctly set in .env

2. **Processing Errors**
   - Check API key validity
   - Verify model names are correct
   - Ensure CSV format is valid
   - Check network connectivity

3. **Vision Processing**
   - Verify image URLs are accessible
   - Ensure vision model names are correct
   - Check if selected AI service supports vision

## Support

For issues or questions:
1. Check the error messages in the browser console
2. Review the backend server logs
3. Verify your configuration matches the requirements
4. Ensure all dependencies are correctly installed

## Updates and Maintenance

To update the application:
1. Pull the latest changes from the repository
2. Run `npm run install-all` to update dependencies
3. Restart the application

Remember to backup your `.env` file before any updates. 