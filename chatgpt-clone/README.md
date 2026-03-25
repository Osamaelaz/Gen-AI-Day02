# ChatGPT Clone

A full-stack ChatGPT clone with React frontend and Node.js backend, supporting text chat and image generation using AI providers like Google Gemini and Hugging Face.

## Features

- **Text Chat**: Interactive chat interface with support for multiple AI models including Gemini 2.5 Flash, Zephyr-7B, and Mistral-7B
- **Image Generation**: Generate images from text prompts using SDXL-Turbo or Pollinations.ai as fallback
- **Streaming Responses**: Real-time streaming of chat responses for better user experience
- **Multi-Modal Support**: Handle both text and image inputs in chat conversations
- **Fallback Mechanisms**: Automatic fallback to alternative AI providers if primary ones fail
- **CORS Enabled**: Cross-origin resource sharing configured for seamless frontend-backend communication

## Technologies

- **Frontend**: React 19, React Scripts, UUID for unique identifiers
- **Backend**: Node.js, Express.js, CORS middleware
- **AI Providers**:
  - Google Generative AI (Gemini models)
  - Hugging Face Inference API
  - Pollinations.ai (free fallback for text and images)
- **Other**: dotenv for environment variables, web-vitals for performance monitoring

## Prerequisites

- Node.js (version 16 or higher)
- npm or yarn package manager
- API keys for AI providers:
  - Google Gemini API key
  - Hugging Face token (optional, for enhanced models)

## Installation

1. Clone the repository:
   ```bash
   git clone <repo-url>
   cd chatgpt-clone
   ```

2. Install dependencies for the client:
   ```bash
   cd client
   npm install
   cd ..
   ```

3. Install dependencies for the server:
   ```bash
   cd server
   npm install
   cd ..
   ```

4. Set up environment variables:
   Create a `.env` file in the `server` directory with the following content:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   HF_TOKEN=your_hugging_face_token_here
   PORT=5000  # Optional, defaults to 5000 if not set
   ```

## Project Structure

```
chatgpt-clone/
├── client/                 # React frontend application
│   ├── public/            # Static assets
│   ├── src/               # React source code
│   │   ├── App.js         # Main application component
│   │   ├── App.css        # Application styles
│   │   └── ...            # Other React components
│   ├── build/             # Built production assets
│   └── package.json       # Client dependencies and scripts
├── server/                 # Node.js backend server
│   ├── index.js           # Main server file
│   ├── package.json       # Server dependencies
│   ├── run_tests.js       # Test runner script
│   └── stream_body.json   # Test data for streaming
└── README.md              # Project documentation
```

## Usage

1. Start the backend server:
   ```bash
   cd server
   node index.js
   ```
   The server will start on `http://localhost:5000` and display available test endpoints.

2. In a new terminal, start the React client:
   ```bash
   cd client
   npm start
   ```
   The client will be available at `http://localhost:3000`.

3. Open your browser and navigate to `http://localhost:3000` to use the ChatGPT clone.

## API Documentation

### Chat Endpoint
**POST** `/api/chat`

Send chat messages to the AI models.

**Request Body:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?",
      "image": "base64_encoded_image_data" // Optional
    }
  ],
  "model": "gemini-2.5-flash" // Optional, defaults to gemini-2.5-flash
}
```

**Response:**
```json
{
  "content": "I'm doing well, thank you for asking!"
}
```

**Supported Models:**
- `gemini-2.5-flash` (primary)
- `zephyr-7b-beta`
- `mistral-7b`

### Image Generation Endpoint
**POST** `/api/image-gen`

Generate images from text prompts.

**Request Body:**
```json
{
  "prompt": "A beautiful sunset over mountains"
}
```

**Response:**
```json
{
  "imageUrl": "https://example.com/generated-image.png"
}
```

### Legacy Image Endpoint
**POST** `/api/image`

Alias for `/api/image-gen` for compatibility.

## Testing

The server includes built-in test endpoints for verifying AI provider integrations:

- **GET** `/test/chat` - Tests Gemini chat functionality
- **GET** `/test/hf-chat` - Tests Hugging Face chat models
- **GET** `/test/image` - Tests image generation capabilities

To run tests programmatically:
```bash
cd server
node run_tests.js
```

## Development

### Building the Client
To create a production build of the React app:
```bash
cd client
npm run build
```

### Running Tests
For the client:
```bash
cd client
npm test
```

## Troubleshooting

### Common Issues

1. **Server won't start**: Ensure all environment variables are set correctly in `server/.env`
2. **API key errors**: Verify your Gemini API key and Hugging Face token are valid
3. **CORS errors**: Make sure the server is running on port 5000 and client on 3000
4. **Image generation fails**: Check internet connection and API rate limits

### Environment Variables
- `GEMINI_API_KEY`: Required for text chat functionality
- `HF_TOKEN`: Optional, enhances model availability
- `PORT`: Optional, defaults to 5000

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Commit your changes: `git commit -am 'Add new feature'`
5. Push to the branch: `git push origin feature-name`
6. Submit a pull request

## License

This project is licensed under the ISC License - see the package.json files for details.

## Acknowledgments

- Google Generative AI for providing the Gemini models
- Hugging Face for the Inference API
- Pollinations.ai for free AI services