const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Config các providers
const PROVIDERS = {
  '9router': {
    baseUrl: 'https://api.9router.com/v1/chat/completions',
    apiKey: process.env.NINEROUTER_KEY || '',
    models: {
      free: 'gpt-4o-mini-free',
      fast: 'gpt-4o-mini',
      balanced: 'claude-3-5-sonnet-20241022',
      pro: 'gpt-4o'
    }
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    apiKey: process.env.OPENROUTER_KEY || '',
    models: {
      free: 'google/gemma-2-9b-it:free',
      cheap: 'meta-llama/llama-3.1-8b-instruct:free'
    }
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    apiKey: process.env.GROQ_KEY || '',
    models: {
      fast: 'llama-3.3-70b-versatile',
      balanced: 'llama-3.1-70b-versatile'
    }
  },
  together: {
    baseUrl: 'https://api.together.xyz/v1/chat/completions',
    apiKey: process.env.TOGETHER_KEY || '',
    models: {
      free: 'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo'
    }
  }
};

// Endpoint chính
app.post('/v1/translate', async (req, res) => {
  try {
    const { text, provider = '9router', model, temperature = 0.7, options = {} } = req.body;

    const providerConfig = PROVIDERS[provider];
    if (!providerConfig) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    // Build request theo format OpenAI-compatible
    const requestBody = {
      model: model || providerConfig.models.free || providerConfig.models.fast,
      messages: [
        {
          role: 'user',
          content: text
        }
      ],
      temperature,
      ...options
    };

    // Call provider
    const response = await fetch(providerConfig.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${providerConfig.apiKey}`,
        ...(provider === 'openrouter' && {
          'HTTP-Referer': 'http://localhost:3000',
          'X-Title': 'King Translator'
        })
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Provider error: ${error}`);
    }

    const data = await response.json();

    // Parse response
    const translatedText = data.choices?.[0]?.message?.content || '';

    res.json({
      success: true,
      text: translatedText,
      provider,
      model: requestBody.model
    });

  } catch (error) {
    console.error('Translation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Endpoint cho multimodal (ảnh)
app.post('/v1/translate-image', async (req, res) => {
  try {
    const { text, image, provider = 'together', model } = req.body;

    const providerConfig = PROVIDERS[provider];

    const requestBody = {
      model: model || 'meta-llama/Llama-3.2-11B-Vision-Instruct-Turbo',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text },
            { type: 'image_url', image_url: { url: image } }
          ]
        }
      ]
    };

    const response = await fetch(providerConfig.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${providerConfig.apiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();
    const result = data.choices?.[0]?.message?.content || '';

    res.json({ success: true, text: result });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', providers: Object.keys(PROVIDERS) });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`AI Proxy server running on http://localhost:${PORT}`);
});
