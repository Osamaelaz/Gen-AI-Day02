import { useState, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import './App.css';

const STORAGE_KEY = 'aiclone_v3';
const API_BASE = 'http://localhost:5000/api';

const MODEL_GROUPS = [
  { group: '✦ Google Gemini', models: [
    { label: 'Gemini 2.5 Flash (Default)', value: 'gemini-2.5-flash' },
  ]},
  { group: '🤗 HuggingFace (Free)', models: [
    { label: 'Zephyr 7B Beta', value: 'zephyr-7b-beta' },
    { label: 'Mistral 7B Instruct', value: 'mistral-7b' },
  ]},
];

const playSpeech = (text) => {
  if (!window.speechSynthesis) return alert('TTS not supported');
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
};

// ── GeneratedImage with loading/error state ──────────────────────────
// Handles both base64 data: URLs (HuggingFace) and plain http URLs
function GeneratedImage({ src }) {
  const [status, setStatus] = useState('loading');

  // base64 images don't need network fetch — mark as loaded immediately
  useEffect(() => {
    if (src && src.startsWith('data:')) setStatus('loaded');
    else setStatus('loading');
  }, [src]);

  return (
    <div className="gen-img-wrapper">
      {status === 'loading' && (
        <div className="gen-img-loading">
          <div className="gen-img-spinner" />
          <span>Generating image… please wait</span>
        </div>
      )}
      {status === 'error' && (
        <div className="gen-img-error">
          ❌ Image failed to load.{' '}
          {!src?.startsWith('data:') && (
            <a href={src} target="_blank" rel="noreferrer">Open directly ↗</a>
          )}
        </div>
      )}
      <img
        src={src}
        alt="Generated"
        className={`msg-image ${status === 'loaded' ? 'img-visible' : 'img-hidden'}`}
        onLoad={() => setStatus('loaded')}
        onError={() => setStatus('error')}
      />
    </div>
  );
}

// ── ModelSelector ────────────────────────────────────────────────────
function ModelSelector({ model, setModel }) {
  return (
    <select className="model-select" value={model} onChange={e => setModel(e.target.value)}>
      {MODEL_GROUPS.map(g => (
        <optgroup key={g.group} label={g.group}>
          {g.models.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────
function Sidebar({ chats, currentChatId, onSelect, onCreate, onDelete }) {
  return (
    <aside className="sidebar">
      <button className="new-chat-btn" onClick={onCreate}>+ New Chat</button>
      <p className="sidebar-label">Chat History</p>
      <div className="chat-list">
        {chats.map(chat => (
          <div key={chat.id}
            className={`chat-item ${chat.id === currentChatId ? 'active' : ''}`}
            onClick={() => onSelect(chat.id)}
          >
            <span className="chat-icon">💬</span>
            <span className="chat-title">{chat.title || 'New Chat'}</span>
            <button className="delete-chat-btn"
              onClick={e => { e.stopPropagation(); onDelete(chat.id); }}
              title="Delete">🗑</button>
          </div>
        ))}
        {chats.length === 0 && <p className="no-chats">No chats yet</p>}
      </div>
    </aside>
  );
}

// ── MessageBubble ────────────────────────────────────────────────────
function MessageBubble({ msg, isLastAI, isLastUser, onRegenerate, onEdit, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(msg.content || '');
  const [copied, setCopied] = useState(false);
  const isUser = msg.role === 'user';

  const copy = () => {
    navigator.clipboard.writeText(msg.content || '').catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className={`msg-wrapper ${isUser ? 'msg-user' : 'msg-ai'}`}>
      <div className={`bubble ${isUser ? 'bubble-user' : 'bubble-ai'}`}>
        <div className="bubble-header">
          <span className="bubble-role">{isUser ? '👤 You' : '✦ AI'}</span>
          <div className="bubble-actions">
            <button onClick={copy} title="Copy">{copied ? '✅' : '📋'}</button>
            {!isUser && <button onClick={() => playSpeech(msg.content || '')} title="Read aloud">🔊</button>}
            {isLastAI && <button onClick={onRegenerate} title="Regenerate">🔄</button>}
            {isLastUser && <button onClick={() => setEditing(v => !v)} title="Edit">✏️</button>}
            <button className="danger-btn" onClick={onDelete} title="Delete">🗑</button>
          </div>
        </div>

        {editing ? (
          <div className="edit-box">
            <textarea className="edit-textarea" value={editText}
              onChange={e => setEditText(e.target.value)} rows={3} autoFocus />
            <div className="edit-btns">
              <button className="btn-primary" onClick={() => { onEdit(editText); setEditing(false); }}>Send ➤</button>
              <button className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="bubble-content">
            {(msg.content || '').split('\n').map((line, i) => <span key={i}>{line}<br /></span>)}
          </div>
        )}

        {/* Generated image (base64 or URL) vs. user-uploaded attachment */}
        {msg.image && (
          msg.isGenerated
            ? <GeneratedImage src={msg.image} />
            : <img src={msg.image} alt="attachment" className="msg-image img-visible" />
        )}
      </div>
    </div>
  );
}

// ── InputBar ─────────────────────────────────────────────────────────
function InputBar({ onSend, onGenImg, loading }) {
  const [text, setText] = useState('');
  const [imgPreview, setImgPreview] = useState(null);
  const [listening, setListening] = useState(false);

  const onImgFile = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => setImgPreview(ev.target.result);
    r.readAsDataURL(f); e.target.value = '';
  };

  const onTextFile = e => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = ev => setText(p => p + (p ? '\n\n[FILE: ' + f.name + ']\n' : '') + ev.target.result);
    r.readAsText(f); e.target.value = '';
  };

  const startSTT = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return alert('Speech recognition not supported.\nPlease use Chrome or Edge.');
    const rec = new SR();
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = false; // Only collect final sentence
    rec.maxAlternatives = 1;
    setListening(true);
    rec.start();

    rec.onresult = e => {
      const transcript = e.results[0][0].transcript;
      setText(prev => prev + (prev ? ' ' : '') + transcript);
    };

    rec.onend = () => {
      setListening(false);
    };

    rec.onerror = e => {
      setListening(false);
      if (e.error === 'not-allowed') alert('Microphone permission denied.\nAllow microphone in your browser\'s site settings.');
      else console.warn('STT error:', e.error);
    };
  };

  const send = () => {
    if (!text.trim() && !imgPreview) return;
    onSend(text, imgPreview);
    setText(''); setImgPreview(null);
  };

  return (
    <footer className="input-area">
      {imgPreview && (
        <div className="img-preview-wrap">
          <img src={imgPreview} alt="preview" />
          <button onClick={() => setImgPreview(null)}>✖</button>
        </div>
      )}
      <div className="input-toolbar">
        <label className="tool-btn" title="Upload Image (Vision)">
          📷 <input type="file" accept="image/*" hidden onChange={onImgFile} />
        </label>
        <label className="tool-btn" title="Upload File">
          📄 <input type="file" accept=".txt,.md,.py,.js,.ts,.json,.csv,.html,.css" hidden onChange={onTextFile} />
        </label>
        <button
          className={`tool-btn ${listening ? 'listening' : ''}`}
          onClick={startSTT} disabled={listening || loading}
          title="Speech to Text"
        >
          {listening ? '🔴 Listening…' : '🎤 STT'}
        </button>
        <button className="tool-btn gen-btn" onClick={() => onGenImg(text)} title="Generate Image">
          🎨 Gen Img
        </button>
      </div>
      <div className="input-row">
        <textarea className="msg-input" value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Message AI…  (Enter to send, Shift+Enter for new line)"
          rows={1} disabled={loading}
        />
        <button className={`send-btn ${loading ? 'loading' : ''}`}
          onClick={send} disabled={loading || (!text.trim() && !imgPreview)}>
          {loading ? '⏳' : '➤'}
        </button>
      </div>
      <p className="footer-note">
        Gemini · Zephyr · Mistral · HuggingFace · All free
      </p>
    </footer>
  );
}

// ── ChatContainer ────────────────────────────────────────────────────
function ChatContainer({ chat, loading, error, streaming, onSend, onGenImg, onRegenerate, onEdit, onDelete }) {
  const endRef = useRef(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chat?.messages, loading, streaming]);

  const msgs = chat?.messages || [];
  const lastAI = msgs.reduce((acc, m, i) => m.role === 'assistant' ? i : acc, -1);
  const lastUser = msgs.reduce((acc, m, i) => m.role === 'user' ? i : acc, -1);

  return (
    <main className="chat-main">
      <div className="chat-messages">
        {!chat && (
          <div className="empty-state">
            <div className="empty-icon">✦</div>
            <h2>Multi-Modal AI Assistant</h2>
            <p>Chat with Gemini 2.5 Flash, Zephyr 7B, or Mistral 7B via HuggingFace</p>
            <div className="feature-pills">
              <span>💬 Multi-chat</span><span>📷 Vision</span>
              <span>📄 Files</span><span>🎨 Image Gen</span>
              <span>🎤 STT</span><span>🔊 TTS</span>
              <span>🔄 Regenerate</span><span>✏️ Edit</span>
            </div>
          </div>
        )}
        {chat && msgs.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">✦</div>
            <h2>How can I help you today?</h2>
            <p>Upload images or files, generate art, or just chat!</p>
          </div>
        )}
        {msgs.map((msg, i) => (
          <MessageBubble key={i} msg={msg}
            isLastAI={i === lastAI} isLastUser={i === lastUser}
            onRegenerate={onRegenerate}
            onEdit={newText => onEdit(i, newText)}
            onDelete={() => onDelete(i)}
          />
        ))}

        {/* Streaming bubble */}
        {streaming !== null && (
          <div className="msg-wrapper msg-ai">
            <div className="bubble bubble-ai">
              <div className="bubble-header">
                <span className="bubble-role">✦ AI</span>
                <span className="streaming-badge">● streaming</span>
              </div>
              <div className="bubble-content">
                {(streaming || '').split('\n').map((l, i) => <span key={i}>{l}<br /></span>)}
                <span className="stream-cursor">▋</span>
              </div>
            </div>
          </div>
        )}

        {/* Loading dots (non-streaming) */}
        {loading && streaming === null && (
          <div className="msg-wrapper msg-ai">
            <div className="bubble bubble-ai">
              <div className="typing-dots"><span /><span /><span /></div>
            </div>
          </div>
        )}

        {error && <div className="error-banner">⚠️ {error}</div>}
        <div ref={endRef} />
      </div>
      <InputBar onSend={onSend} onGenImg={onGenImg} loading={loading} />
    </main>
  );
}

// ── App ──────────────────────────────────────────────────────────────
function App() {
  const [chats, setChats] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [model, setModel] = useState('gemini-2.5-flash');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [streaming, setStreaming] = useState(null); // null = not streaming, string = content so far

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const d = JSON.parse(saved);
        if (d?.chats?.length) { setChats(d.chats); setCurrentId(d.chats[0].id); }
      } catch {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ chats }));
  }, [chats]);

  const currentChat = chats.find(c => c.id === currentId) || null;

  const updateMsgs = (chatId, msgs, title) => {
    setChats(prev => prev.map(c => c.id !== chatId ? c : { ...c, messages: msgs, title: title || c.title }));
  };

  const sendMessages = async (chatId, msgsToSend) => {
    setLoading(true); setError(''); setStreaming('');
    try {
      const res = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgsToSend, model }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Server error'); }

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let full = '', buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split('\n'); buf = lines.pop();
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') continue;
          try {
            const p = JSON.parse(raw);
            if (p.error) throw new Error(p.error);
            if (p.content) { full += p.content; setStreaming(full); }
          } catch {}
        }
      }
      updateMsgs(chatId, [...msgsToSend, { role: 'assistant', content: full }]);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); setStreaming(null); }
  };

  const handleSend = async (text, base64Image) => {
    let chatId = currentId;
    let msgs = currentChat?.messages || [];

    if (!chatId) {
      chatId = uuidv4();
      const nc = { id: chatId, title: text.slice(0, 35) || 'New Chat', messages: [] };
      setChats(prev => [nc, ...prev]);
      setCurrentId(chatId);
      msgs = [];
    }

    const userMsg = { role: 'user', content: text, ...(base64Image && { image: base64Image }) };
    const updated = [...msgs, userMsg];
    const title = msgs.length === 0 ? (text.slice(0, 35) || 'Image Chat') : undefined;
    updateMsgs(chatId, updated, title);
    await sendMessages(chatId, updated);
  };

  const handleGenImg = async (prompt) => {
    if (!prompt) return alert('Type a prompt first, then click Gen Img.');
    let chatId = currentId;
    let msgs = currentChat?.messages || [];
    if (!chatId) {
      chatId = uuidv4();
      const nc = { id: chatId, title: prompt.slice(0, 35), messages: [] };
      setChats(prev => [nc, ...prev]);
      setCurrentId(chatId);
      msgs = [];
    }
    const userMsg = { role: 'user', content: '🎨 ' + prompt };
    const updated = [...msgs, userMsg];
    updateMsgs(chatId, updated, msgs.length === 0 ? prompt.slice(0, 35) : undefined);
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/image-gen`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Image gen failed');
      // Mark message with isGenerated so GeneratedImage component is used
      updateMsgs(chatId, [...updated, { role: 'assistant', content: 'Here is your generated image:', image: data.imageUrl, isGenerated: true }]);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const handleRegenerate = async () => {
    if (!currentChat) return;
    const msgs = currentChat.messages;
    const lastUserIdx = msgs.reduce((acc, m, i) => m.role === 'user' ? i : acc, -1);
    if (lastUserIdx === -1) return;
    const trimmed = msgs.slice(0, lastUserIdx + 1);
    updateMsgs(currentId, trimmed);
    await sendMessages(currentId, trimmed);
  };

  const handleEdit = async (index, newText) => {
    if (!currentChat) return;
    const before = currentChat.messages.slice(0, index);
    updateMsgs(currentId, before);
    const userMsg = { role: 'user', content: newText };
    const updated = [...before, userMsg];
    updateMsgs(currentId, updated, before.length === 0 ? newText.slice(0, 35) : undefined);
    await sendMessages(currentId, updated);
  };

  const handleDelete = (index) => {
    if (!currentChat) return;
    updateMsgs(currentId, currentChat.messages.filter((_, i) => i !== index));
  };

  const createChat = () => {
    const nc = { id: uuidv4(), title: 'New Chat', messages: [] };
    setChats(prev => [nc, ...prev]);
    setCurrentId(nc.id);
  };

  const deleteChat = (id) => {
    setChats(prev => prev.filter(c => c.id !== id));
    if (currentId === id) setCurrentId(null);
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <span className="header-icon">✦</span>
          <h1 className="header-title">Multi-Modal AI</h1>
        </div>
        <ModelSelector model={model} setModel={setModel} />
      </header>
      <div className="main-layout">
        <Sidebar chats={chats} currentChatId={currentId}
          onSelect={setCurrentId} onCreate={createChat} onDelete={deleteChat} />
        <ChatContainer
          chat={currentChat} loading={loading} error={error} streaming={streaming}
          onSend={handleSend} onGenImg={handleGenImg}
          onRegenerate={handleRegenerate} onEdit={handleEdit} onDelete={handleDelete}
        />
      </div>
    </div>
  );
}

export default App;
