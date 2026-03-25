const http = require('http');

const testEndpoint = (path, method = 'GET', body = null) => {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ statusCode: res.statusCode, data });
      });
    });

    req.on('error', (e) => {
      resolve({ error: e.message });
    });

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

async function runAllTests() {
  console.log("=== STARTING AUTOMATED API TESTS ===\n");

  // TEST 1: Get Models
  console.log("TEST 1: Fetching Models [/api/models]");
  const modelsRes = await testEndpoint('/api/models');
  console.log("Status:", modelsRes.statusCode);
  if (modelsRes.statusCode === 200) {
    const parsed = JSON.parse(modelsRes.data);
    console.log("Success! Models found:", parsed.models.map(m => m.label).join(", "));
  } else {
    console.log("Failed:", modelsRes.data || modelsRes.error);
  }
  console.log("-----------------------------------\n");

  // TEST 2: Chat Stream (Gemini)
  console.log("TEST 2: Chat Stream - Gemini [/api/chat/stream]");
  const geminiRes = await testEndpoint('/api/chat/stream', 'POST', {
    model: "gemini-2.5-flash",
    messages: [{ role: "user", content: "Say the word 'Test'" }]
  });
  console.log("Status:", geminiRes.statusCode);
  let geminiClean = geminiRes.data.replace(/data: /g, '').split('\n').filter(Boolean);
  let gContent = '';
  for (let c of geminiClean) {
    if (c === '[DONE]') break;
    try {
      let parsed = JSON.parse(c);
      if (parsed.error) gContent += "ERROR: " + parsed.error;
      else if (parsed.content) gContent += parsed.content;
    } catch(e) {}
  }
  console.log("Gemini Output:", gContent);
  console.log("-----------------------------------\n");

  // TEST 3: Chat Stream (OpenAI GPT-4o-Mini)
  console.log("TEST 3: Chat Stream - OpenAI [/api/chat/stream]");
  const openaiRes = await testEndpoint('/api/chat/stream', 'POST', {
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: "Say 'Hello from OpenAI'" }]
  });
  console.log("Status:", openaiRes.statusCode);
  let openClean = openaiRes.data.replace(/data: /g, '').split('\n').filter(Boolean);
  let oContent = '';
  for (let c of openClean) {
    if (c === '[DONE]') break;
    try {
      let parsed = JSON.parse(c);
      if (parsed.error) oContent += "ERROR: " + parsed.error;
      else if (parsed.content) oContent += parsed.content;
    } catch(e) {}
  }
  console.log("OpenAI Output:", oContent);
  console.log("-----------------------------------\n");

  // TEST 4: Image Generation (OpenAI DALL-E)
  console.log("TEST 4: Image Generation [/api/image-gen]");
  const imgRes = await testEndpoint('/api/image-gen', 'POST', {
    prompt: "A beautiful testing image"
  });
  console.log("Status:", imgRes.statusCode);
  if (imgRes.statusCode === 200) {
      console.log("Image Success (base64 or URL returned)");
  } else {
      console.log("Image Gen Failed:", imgRes.data);
  }
  console.log("-----------------------------------\n");

  // TEST 5: Vision Integration (Gemini Base64 Image)
  console.log("TEST 5: Vision / Image Upload [Gemini /api/chat/stream]");
  // Simple base64 for a 1x1 black pixel to test vision parsing
  const pixelB64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
  const visionRes = await testEndpoint('/api/chat/stream', 'POST', {
    model: "gemini-2.5-flash",
    messages: [{ role: "user", content: "What color is this image?", image: pixelB64 }]
  });
  console.log("Status:", visionRes.statusCode);
  if (visionRes.statusCode === 200) {
    console.log("Vision Payload successfully accepted and streamed by Gemini!");
  } else {
    console.log("Vision stream failed:", visionRes.data || visionRes.error);
  }
  console.log("-----------------------------------\n");

  // TEST 6: Local Ollama
  console.log("TEST 6: Local Execution [Ollama /api/chat/stream]");
  const localRes = await testEndpoint('/api/chat/stream', 'POST', {
    model: "ollama/llama3.2",
    messages: [{ role: "user", content: "Hello?" }]
  });
  console.log("Status:", localRes.statusCode);
  let ollamaClean = localRes.data.replace(/data: /g, '').split('\n').filter(Boolean);
  let ollamaError = '';
  for (let c of ollamaClean) {
    if (c === '[DONE]') break;
    try {
      let parsed = JSON.parse(c);
      if (parsed.error) ollamaError = parsed.error;
    } catch(e) {}
  }
  if (ollamaError) {
    console.log("Local Execution Failed:", ollamaError);
  } else {
    console.log("Local Execution Succeded!");
  }
  console.log("-----------------------------------\n");
}

runAllTests();
