# Multi-Model AI Chat Application

A professional, lightweight chat app with a unified backend abstraction layer and a modern frontend UI.

Supported providers:

- OpenAI (GPT-4o mini)
- Anthropic (Claude)
- DeepSeek
- Grok (xAI)

## Highlights

- Unified provider interface: all providers expose the same `chat` contract.
- Swappable architecture: adding a new provider requires one new file and one registry entry.
- Normalized request/response format across providers.
- Robust API error handling for invalid keys, rate limits, and upstream failures.
- Minimal, fast React UI with:
  - prominent model selector
  - polished chat bubbles
  - typing indicator and fade-in animation
  - dark/light mode support

## Project Structure

```text
chatgpt-clone/
├── README.md
├── client/
│   ├── package.json
│   ├── public/
│   └── src/
│       ├── App.js
│       ├── App.css
│       ├── App.test.js
│       ├── index.js
# ChatGPT Clone

This project is a ChatGPT clone with a React frontend and a Node.js backend.

## Project Structure

- `client/`: React frontend application
- `server/`: Node.js backend server

## Getting Started

### Prerequisites
- Node.js (v16 or higher recommended)
- npm or yarn

### Setup

1. **Install dependencies**
   - For the client:
     ```bash
     cd client
     npm install
     ```
   - For the server:
     ```bash
     cd ../server
     npm install
     ```

2. **Run the applications**
   - Start the backend server:
     ```bash
     npm start
     ```
   - Start the frontend (in a new terminal):
     ```bash
     cd ../client
     npm start
     ```

3. **Open in browser**
   - Visit `http://localhost:3000` to use the app.

## Features
- Chat interface similar to ChatGPT
- Connects to multiple AI providers (OpenAI, Anthropic, Gemini, etc.)
- Modern React UI

## Customization
- Configure API keys and providers in `server/.env` and `server/src/providers/`

## License
MIT
## Run

Start backend:

```bash
cd server
npm start
```

Start frontend (new terminal):

```bash
cd client
npm start
```

Open `http://localhost:3000`.

## API Endpoints

### GET `/api/health`

Returns backend health information.

### GET `/api/models`

Returns available providers/models for the UI selector.

### POST `/api/chat`

Unified chat endpoint for all providers.

Request body:

```json
{
  "provider": "openai",
  "messages": [
    { "role": "system", "content": "You are a helpful assistant." },
    { "role": "user", "content": "Explain vector databases briefly." }
  ],
  "temperature": 0.7
}
```

Success response:

```json
{
  "provider": "openai",
  "model": "gpt-4o-mini",
  "message": {
    "role": "assistant",
    "content": "Vector databases store embeddings for similarity search..."
  },
  "usage": {}
}
```

Error response:

```json
{
  "error": "OpenAI request failed (401): ...",
  "code": "HTTP_401",
  "userMessage": "OpenAI API key is invalid or missing.",
  "provider": "openai"
}
```

## Notes

- This app intentionally avoids heavy UI frameworks to keep bundle size and startup time low.
- Server-side normalization ensures each provider returns the same message format to the frontend.
- If a provider changes API shape, only its handler file needs updates.
