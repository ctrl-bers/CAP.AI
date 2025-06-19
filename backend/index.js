// Simple Express server to proxy API requests and hide your API key
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/proxy', async (req, res) => {
  console.log('POST /api/proxy called');
  const { prompt } = req.body;
  const apiKey = process.env.API_KEY;
  console.log('Using API Key:', apiKey ? apiKey.slice(0,8) + '...' : 'NOT FOUND');

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo', // Use a model known to work with OpenRouter
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400
      })
    });
    const data = await response.json();
    console.log('OpenRouter API response:', JSON.stringify(data, null, 2));
    if (!response.ok) {
      console.error('OpenRouter API error:', data);
      return res.status(response.status).json({ error: data.error || 'OpenRouter API error', details: data });
    }
    // Try to extract JSON from the AI response
    let content = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (content) {
      content = content.trim();
      if (content.startsWith('```')) {
        content = content.replace(/```(json)?/g, '').trim();
      }
      let idea;
      try {
        if (content.startsWith('{') && content.endsWith('}')) {
          idea = JSON.parse(content);
          return res.json({ idea });
        }
      } catch (err) {
        return res.status(500).json({ error: 'AI response could not be parsed as JSON', details: content });
      }
      return res.status(500).json({ error: 'AI response is not a valid capstone idea', details: content });
    } else {
      return res.status(500).json({ error: 'No content in AI response', details: data });
    }
  } catch (error) {
    console.error('Backend error:', error);
    res.status(500).json({ error: 'API request failed', details: error.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
