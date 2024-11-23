const { Configuration, OpenAIApi } = require('openai');
// ... other imports

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { prompt, model, modelConfig } = JSON.parse(event.body);
    // Your existing processing logic here
    
    return {
      statusCode: 200,
      body: JSON.stringify({ result: response })
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
}; 