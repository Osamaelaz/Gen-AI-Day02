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
