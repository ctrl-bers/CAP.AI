// Vercel serverless function for proxying API requests and hiding your API key
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { prompt } = req.body;
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API_KEY environment variable is missing. Please set it in your Vercel project settings.' });
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 400
      })
    });
    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({ error: data.error || 'OpenRouter API error', details: data });
    }
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
          return res.status(200).json({ idea });
        }
      } catch (err) {
        return res.status(500).json({ error: 'AI response could not be parsed as JSON', details: content });
      }
      return res.status(500).json({ error: 'AI response is not a valid capstone idea', details: content });
    } else {
      return res.status(500).json({ error: 'No content in AI response', details: data });
    }
  } catch (error) {
    res.status(500).json({ error: 'API request failed', details: error.message });
  }
}
