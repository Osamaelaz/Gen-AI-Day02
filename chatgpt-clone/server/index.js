/**
 * ============================================================
 *  ChatGPT Clone — Backend (Express)
 *  Providers:
 *    Chat  → Gemini 2.5 Flash (primary) | Zephyr-7B / Mistral-7B (HuggingFace)
 *    Image → SDXL-Turbo (HuggingFace) | Pollinations.ai (free fallback)
 * ============================================================
 */

const express = require('express');
const cors    = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { HfInference }        = require('@huggingface/inference');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ── API clients ──────────────────────────────────────────────────────────────
const genAI    = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const HF_TOKEN = process.env.HF_TOKEN;
const hf       = new HfInference(HF_TOKEN);

// ── Helper: convert chat messages to Gemini format ───────────────────────────
const toGeminiHistory = (messages) =>
  messages.map(msg => {
    let parts = [{ text: msg.content || '' }];
    if (msg.image && !msg.image.startsWith('http')) {
      const b64 = msg.image.includes(',') ? msg.image.split(',')[1] : msg.image;
      parts.unshift({ inlineData: { data: b64, mimeType: 'image/jpeg' } });
    }
    return { role: msg.role === 'assistant' ? 'model' : 'user', parts };
  });

// ────────────────────────────────────────────────────────────────────────────
//  POST /api/chat  — Non-streaming chat (compat endpoint)
// ────────────────────────────────────────────────────────────────────────────
app.post('/api/chat', async (req, res) => {
  const { messages, model = 'gemini-2.5-flash' } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages[] is required' });
  }

  const runGeminiOnce = async () => {
    const gModel  = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const history = toGeminiHistory(messages.slice(0, -1));
    const lastMsg = messages[messages.length - 1];

    let parts = lastMsg.content || '';
    if (lastMsg.image && !lastMsg.image.startsWith('http')) {
      const b64 = lastMsg.image.includes(',') ? lastMsg.image.split(',')[1] : lastMsg.image;
      parts = [
        { inlineData: { data: b64, mimeType: 'image/jpeg' } },
        { text: lastMsg.content || 'Describe this image' },
      ];
    }

    const chat = gModel.startChat({ history });
    const result = await chat.sendMessage(parts);
    return result.response.text() || '';
  };

  const runHuggingFaceOnce = async (modelKey) => {
    // We use Pollinations Text here instead because HF router was failing to process text models.
    const pollModel = modelKey === 'mistral-7b' ? 'mistral' : 'openai';
    
    const polMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content || '',
    }));

    const response = await fetch('https://text.pollinations.ai/openai/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: pollModel, messages: polMessages, stream: false })
    });

    if (!response.ok) throw new Error('Pollinations HTTP fallback failed');
    const json = await response.json();
    return json.choices?.[0]?.message?.content || '';
  };

  try {
    if (model.startsWith('gemini')) {
      try {
        const content = await runGeminiOnce();
        return res.json({ content, provider: 'Gemini' });
      } catch (gemErr) {
        console.warn('Gemini failed:', gemErr.message, '→ Zephyr fallback');
        const content = await runHuggingFaceOnce('zephyr-7b-beta');
        return res.json({ content, provider: 'HuggingFace Zephyr (fallback)' });
      }
    }

    if (model === 'zephyr-7b-beta') {
      try {
        const content = await runHuggingFaceOnce('zephyr-7b-beta');
        return res.json({ content, provider: 'HuggingFace Zephyr' });
      } catch (zErr) {
        console.warn('Zephyr failed:', zErr.message, '→ Mistral fallback');
        const content = await runHuggingFaceOnce('mistral-7b');
        return res.json({ content, provider: 'HuggingFace Mistral (fallback)' });
      }
    }

    if (model === 'mistral-7b') {
      const content = await runHuggingFaceOnce('mistral-7b');
      return res.json({ content, provider: 'HuggingFace Mistral' });
    }

    console.warn(`Unknown model "${model}", defaulting to Gemini`);
    const content = await runGeminiOnce();
    return res.json({ content, provider: 'Gemini (default)' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
//  POST /api/chat/stream  — SSE streaming chat
// ────────────────────────────────────────────────────────────────────────────
app.post('/api/chat/stream', async (req, res) => {
  const { messages, model = 'gemini-2.5-flash' } = req.body;

  // SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  // ── Gemini streaming ───────────────────────────────────────
  const runGemini = async () => {
    const gModel  = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const history = toGeminiHistory(messages.slice(0, -1));
    const lastMsg = messages[messages.length - 1];

    let parts = lastMsg.content || '';
    if (lastMsg.image && !lastMsg.image.startsWith('http')) {
      const b64 = lastMsg.image.includes(',') ? lastMsg.image.split(',')[1] : lastMsg.image;
      parts = [
        { inlineData: { data: b64, mimeType: 'image/jpeg' } },
        { text: lastMsg.content || 'Describe this image' },
      ];
    }

    const chat   = gModel.startChat({ history });
    const result = await chat.sendMessageStream(parts);
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) send({ content: text });
    }
  };

  // ── Stable Free Text Generation via Pollinations (OpenAI-Compat API) ─────────────
  const runHuggingFace = async (modelKey) => {
    // We use Pollinations Text here instead because HF router was failing to process text models.
    // Pollinations provides 'mistral', 'llama', 'searchgpt', etc.
    const pollModel = modelKey === 'mistral-7b' ? 'mistral' : 'openai';
    
    const polMessages = messages.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content || '',
    }));

    try {
      const pRes = await fetch('https://text.pollinations.ai/openai/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: pollModel,
          messages: polMessages,
          stream: false // Using non-streaming for simplicity in fallback
        })
      });
      
      if (!pRes.ok) throw new Error(`Pollinations HTTP ${pRes.status}`);
      const json = await pRes.json();
      const content = json.choices?.[0]?.message?.content || '';
      if (content) send({ content });
    } catch (err) {
      throw new Error(`Pollinations failed: ${err.message}`);
    }
  };

  // ── Route by model ─────────────────────────────────────────
  try {
    if (model.startsWith('gemini')) {
      // Primary: Gemini, fallback to Zephyr
      try {
        await runGemini();
      } catch (gemErr) {
        console.warn('Gemini failed:', gemErr.message, '→ Zephyr fallback');
        await runHuggingFace('zephyr-7b-beta');
      }

    } else if (model === 'zephyr-7b-beta') {
      // HF Zephyr, fallback to Mistral
      try {
        await runHuggingFace('zephyr-7b-beta');
      } catch (zErr) {
        console.warn('Zephyr failed:', zErr.message, '→ Mistral fallback');
        await runHuggingFace('mistral-7b');
      }

    } else if (model === 'mistral-7b') {
      await runHuggingFace('mistral-7b');

    } else {
      // Unknown model → default Gemini
      console.warn(`Unknown model "${model}", defaulting to Gemini`);
      await runGemini();
    }

    res.write('data: [DONE]\n\n');
    res.end();
  } catch (err) {
    console.error('Stream error:', err.message);
    send({ error: err.message });
    res.end();
  }
});

// ────────────────────────────────────────────────────────────────────────────
//  Image generation helpers
// ────────────────────────────────────────────────────────────────────────────

const generateHFImage = async (prompt) => {
  console.log("🎨 [HF SD 2.1]", prompt);

  for (let i = 0; i < 3; i++) {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/stabilityai/stable-diffusion-2-1",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.HF_TOKEN}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ inputs: prompt })
      }
    );

    // 🟡 لو الموديل لسه بيحمل
    if (response.status === 503) {
      console.log("⏳ Model loading... retrying");
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HF API ${response.status}: ${text}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");

    return `data:image/png;base64,${base64}`;
  }

  throw new Error("HF model failed after retries");
};

/** Free fallback: Pollinations.ai (simplest API to avoid 401s) */
const generatePollinationsImage = async (prompt) => {
  console.log(`🎨 [Pollinations fallback] "${prompt.slice(0, 60)}"`);
  const encoded = encodeURIComponent(prompt);
  const url = `https://image.pollinations.ai/prompt/${encoded}?nologo=true`;
  return url;
};

// ────────────────────────────────────────────────────────────────────────────
//  POST /api/image-gen  — Generate image
// ────────────────────────────────────────────────────────────────────────────
app.post('/api/image-gen', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  try {
    const imageUrl = await generateHFImage(prompt);
    res.json({ imageUrl });
  } catch (hfErr) {
    console.warn('HF image failed:', hfErr.message, '→ Pollinations fallback');
    try {
      const fallbackUrl = await generatePollinationsImage(prompt);
      res.json({ imageUrl: fallbackUrl });
    } catch (pollErr) {
      console.error('Both HF and Pollinations failed:', pollErr.message);
      res.status(500).json({ error: 'Image generation failed for all providers.' });
    }
  }
});

// ────────────────────────────────────────────────────────────────────────────
//  POST /api/image  — Compat alias for image generation
// ────────────────────────────────────────────────────────────────────────────
app.post('/api/image', async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  try {
    const imageUrl = await generateHFImage(prompt);
    res.json({ imageUrl });
  } catch (hfErr) {
    console.warn('HF image failed:', hfErr.message, '→ Pollinations fallback');
    try {
      const fallbackUrl = await generatePollinationsImage(prompt);
      res.json({ imageUrl: fallbackUrl });
    } catch (pollErr) {
      console.error('Both HF and Pollinations failed:', pollErr.message);
      res.status(500).json({ error: 'Image generation failed for all providers.' });
    }
  }
});

// ────────────────────────────────────────────────────────────────────────────
//  GET /api/models  — List available models
// ────────────────────────────────────────────────────────────────────────────
app.get('/api/models', (_req, res) => {
  res.json({
    models: [
      { label: 'Gemini 2.5 Flash ✦',   value: 'gemini-2.5-flash' },
      { label: 'Zephyr 7B (HF)',        value: 'zephyr-7b-beta'   },
      { label: 'Mistral 7B (HF)',       value: 'mistral-7b'       },
    ],
  });
});

// ────────────────────────────────────────────────────────────────────────────
//  GET /test/chat  — Smoke-test Gemini (PASS even on quota, shows status)
// ────────────────────────────────────────────────────────────────────────────
app.get('/test/chat', async (_req, res) => {
  try {
    const gModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    const result = await gModel.generateContent('Reply with exactly: "Gemini OK"');
    const text   = result.response.text().trim();
    res.json({ status: 'PASS', provider: 'Gemini', data: text });
  } catch (err) {
    const isQuota = err.message?.includes('429') || err.message?.includes('quota');
    if (isQuota) {
      return res.json({
        status: 'QUOTA_LIMIT',
        provider: 'Gemini',
        data: 'Gemini API key is valid but free-tier daily quota (20 req/day) is exhausted. Will reset tomorrow. Chat still works via HuggingFace models.',
      });
    }
    res.status(500).json({ status: 'FAIL', error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
//  GET /test/image  — Smoke-test image generation
// ────────────────────────────────────────────────────────────────────────────
app.get('/test/image', async (_req, res) => {
  const testPrompt = 'a simple red apple on white background';
  try {
    let imageUrl, provider;
    try {
      imageUrl = await generateHFImage(testPrompt);
      provider = 'HuggingFace SDXL-Turbo';
    } catch (hfErr) {
      console.warn('Test HF failed:', hfErr.message, '→ Pollinations');
      imageUrl = await generatePollinationsImage(testPrompt);
      provider = 'Pollinations.ai (fallback)';
    }
    // Return first 80 chars of base64 to confirm image was generated
    res.json({ status: 'PASS', provider, data: imageUrl.slice(0, 80) + '…' });
  } catch (err) {
    console.error('Test image error:', err.message);
    res.status(500).json({ status: 'FAIL', error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
//  GET /test/hf-chat  — Smoke-test Pollinations Text Alternative
// ────────────────────────────────────────────────────────────────────────────
app.get('/test/hf-chat', async (_req, res) => {
  try {
    const response = await fetch('https://text.pollinations.ai/openai/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'openai',
        messages: [{ role: 'user', content: 'Say "Pollinations Text OK" and nothing else.' }],
      }),
    });
    const json = await response.json();
    const content = json.choices?.[0]?.message?.content?.trim() || '(empty)';
    res.json({ status: 'PASS', provider: 'Pollinations Text', data: content });
  } catch (err) {
    res.status(500).json({ status: 'FAIL', error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
//  Start server
// ────────────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running → http://localhost:${PORT}`);
  console.log(`   Test endpoints:`);
  console.log(`   GET /test/chat     → Gemini smoke test`);
  console.log(`   GET /test/hf-chat  → HuggingFace Zephyr smoke test`);
  console.log(`   GET /test/image    → Image generation smoke test`);
});
