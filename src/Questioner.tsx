import { useState, useRef, useCallback, useEffect } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorker;

// ─── Types ────────────────────────────────────────────────────────────────────

interface Chunk {
  id: number;
  text: string;
  page: number;
  tfIdf: Map<string, number>;
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: number[];   // chunk IDs used for this answer
  isStreaming?: boolean;
}

// ─── TF-IDF Retrieval Engine ─────────────────────────────────────────────────

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 1);
}

const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with',
  'by','from','is','are','was','were','be','been','being','have','has',
  'had','do','does','did','will','would','could','should','may','might',
  'it','its','this','that','these','those','i','we','you','he','she','they',
]);

function buildTfIdf(chunks: { text: string; page: number }[]): Chunk[] {
  // Term frequency per doc
  const tokenized = chunks.map(c =>
    tokenize(c.text).filter(t => !STOP_WORDS.has(t))
  );

  // Document frequency
  const df = new Map<string, number>();
  for (const tokens of tokenized) {
    for (const term of new Set(tokens)) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }

  const N = chunks.length;
  return chunks.map((chunk, i) => {
    const tokens = tokenized[i];
    const tf = new Map<string, number>();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);

    const tfIdf = new Map<string, number>();
    for (const [term, freq] of tf) {
      const idf = Math.log((N + 1) / ((df.get(term) ?? 0) + 1)) + 1;
      tfIdf.set(term, (freq / tokens.length) * idf);
    }

    return { id: i, text: chunk.text, page: chunk.page, tfIdf };
  });
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0, normA = 0, normB = 0;
  for (const [t, va] of a) {
    dot += va * (b.get(t) ?? 0);
    normA += va * va;
  }
  for (const vb of b.values()) normB += vb * vb;
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function retrieveTopK(query: string, chunks: Chunk[], k = 5): Chunk[] {
  const qTokens = tokenize(query).filter(t => !STOP_WORDS.has(t));
  if (!qTokens.length) return chunks.slice(0, k);

  // Build query TF-IDF vector
  const qTf = new Map<string, number>();
  for (const t of qTokens) qTf.set(t, (qTf.get(t) ?? 0) + 1);
  const qVec = new Map<string, number>();
  for (const [t, freq] of qTf) qVec.set(t, freq / qTokens.length);

  return [...chunks]
    .map(c => ({ chunk: c, score: cosineSimilarity(qVec, c.tfIdf) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .filter(x => x.score > 0)
    .map(x => x.chunk);
}

// ─── PDF Extraction & Chunking ────────────────────────────────────────────────

async function extractAndChunk(file: File): Promise<Chunk[]> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const rawChunks: { text: string; page: number }[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Group items into lines by Y position
    const items = content.items as any[];
    const lines: string[] = [];
    let currentLine = '';
    let lastY: number | null = null;

    for (const item of items) {
      const y = Math.round(item.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        if (currentLine.trim()) lines.push(currentLine.trim());
        currentLine = '';
      }
      currentLine += item.str + ' ';
      lastY = y;
    }
    if (currentLine.trim()) lines.push(currentLine.trim());

    // Chunk by ~400 chars with 80-char overlap
    const pageText = lines.join('\n');
    const chunkSize = 400;
    const overlap = 80;

    if (pageText.length <= chunkSize) {
      if (pageText.trim()) rawChunks.push({ text: pageText, page: i });
    } else {
      let start = 0;
      while (start < pageText.length) {
        let end = start + chunkSize;
        // Snap to sentence boundary
        if (end < pageText.length) {
          const snap = pageText.lastIndexOf('. ', end);
          if (snap > start + 100) end = snap + 2;
        }
        const chunk = pageText.slice(start, end).trim();
        if (chunk) rawChunks.push({ text: chunk, page: i });
        start = end - overlap;
      }
    }
  }

  return buildTfIdf(rawChunks);
}

// ─── Groq API ─────────────────────────────────────────────────────────────────

async function askGroq(
  question: string,
  context: string,
  history: { role: string; content: string }[],
  apiKey: string
): Promise<string> {
  const systemPrompt = `You are a precise, helpful AI assistant that answers questions STRICTLY based on the resume content provided below. 

RESUME CONTEXT:
${context}

RULES:
1. Answer only using information found in the resume context above.
2. If the answer is not in the resume, say exactly: "The answer is not available in the uploaded resume."
3. Be concise but thorough. Use bullet points where appropriate.
4. Reference specific sections of the resume when relevant.
5. Do not fabricate, assume, or add information not present in the resume.`;

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-6).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
    { role: 'user', content: question },
  ];

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.3,
      max_completion_tokens: 1024,
    }),
  });

  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || 'Unable to generate an answer. Please try again.';
}

// ─── Suggested Questions ──────────────────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  'What are the key skills listed in this resume?',
  'What is the total years of work experience?',
  'What educational qualifications are mentioned?',
  'What was the most recent job role?',
  'Are any programming languages or tools listed?',
  'What certifications or achievements are highlighted?',
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Questioner() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [chunks, setChunks] = useState<Chunk[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [indexError, setIndexError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages, isThinking]);

  // Auto-resize textarea
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 140) + 'px';
  };

  // Drag & drop
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
  const handleDragLeave = useCallback(() => setIsDragging(false), []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.type === 'application/pdf') selectFile(f);
  }, []);

  const selectFile = async (f: File) => {
    setFile(f);
    setChunks([]);
    setMessages([]);
    setIsReady(false);
    setIndexError('');
    setIsIndexing(true);

    try {
      const extracted = await extractAndChunk(f);
      if (extracted.length === 0) throw new Error('No readable text found in this PDF.');
      setChunks(extracted);
      setIsReady(true);
      setMessages([{
        role: 'system',
        content: `✦ Resume indexed — **${extracted.length} chunks** ready · Ask me anything about this document.`,
      }]);
    } catch (err: any) {
      setIndexError(err.message || 'Failed to process PDF.');
    } finally {
      setIsIndexing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) selectFile(f);
  };

  const reset = () => {
    setFile(null); setChunks([]); setMessages([]);
    setIsReady(false); setIndexError(''); setInput('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSend = async (question?: string) => {
    const q = (question ?? input).trim();
    if (!q || isThinking || !isReady) return;

    setInput('');
    if (inputRef.current) { inputRef.current.style.height = 'auto'; }

    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setIsThinking(true);

    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    if (!apiKey) {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Missing Groq API key. Please set VITE_GROQ_API_KEY in your .env file.' }]);
      setIsThinking(false);
      return;
    }

    try {
      // RAG retrieval
      const topChunks = retrieveTopK(q, chunks, 5);
      const context = topChunks.map((c, i) => `[Chunk ${i + 1} | Page ${c.page}]\n${c.text}`).join('\n\n---\n\n');
      const history = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }));

      const answer = await askGroq(q, context, history, apiKey);

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: answer,
        sources: topChunks.map(c => c.page),
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Failed to connect to Groq API. Check your network and API key.',
      }]);
    } finally {
      setIsThinking(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // ── Upload Phase ─────────────────────────────────────────────────────────────
  if (!isReady && !isIndexing) {
    return (
      <div className="qr-page">
        <div className="qr-header">
          <div className="qr-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Questioner · RAG
          </div>
          <h1 className="qr-title">Resume Q&A</h1>
          <p className="qr-subtitle">Upload your resume to unlock an AI-powered chat that answers questions strictly from its content.</p>
        </div>

        <div
          className={`qr-upload-zone ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept=".pdf" onChange={handleFileChange} style={{ display: 'none' }} id="qr-pdf-input" />
          <div className="qr-upload-inner">
            <div className="qr-upload-icon">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
              </svg>
            </div>
            <p className="qr-upload-main">Drop your resume PDF here</p>
            <p className="qr-upload-sub">or <span className="qr-upload-link">browse files</span></p>
            <p className="qr-upload-hint">PDF only · Max 50 MB</p>
          </div>
        </div>

        {indexError && (
          <div className="qr-error-banner">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {indexError}
          </div>
        )}

        {/* How it works */}
        <div className="qr-how-it-works">
          {[
            { icon: '📄', title: 'Upload PDF', desc: 'Your resume is parsed locally in the browser.' },
            { icon: '🔍', title: 'Smart Chunking', desc: 'Text is split into semantic chunks with overlap.' },
            { icon: '⚡', title: 'Instant Retrieval', desc: 'TF-IDF similarity finds the most relevant sections.' },
            { icon: '🤖', title: 'AI Answers', desc: 'Groq LLM generates answers strictly from your resume.' },
          ].map((step, i) => (
            <div key={i} className="qr-step-card">
              <span className="qr-step-icon">{step.icon}</span>
              <span className="qr-step-title">{step.title}</span>
              <span className="qr-step-desc">{step.desc}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Indexing Phase ────────────────────────────────────────────────────────────
  if (isIndexing) {
    return (
      <div className="qr-page qr-indexing-page">
        <div className="qr-indexing-wrap">
          <div className="qr-rag-animation">
            <div className="qr-rag-pulse" />
            <div className="qr-rag-pulse qr-rag-pulse-2" />
            <div className="qr-rag-core">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
              </svg>
            </div>
          </div>
          <h2 className="qr-indexing-title">Building Knowledge Index</h2>
          <p className="qr-indexing-sub">Extracting text · Chunking · Computing TF-IDF vectors…</p>
          <p className="qr-indexing-file">{file?.name}</p>
        </div>
      </div>
    );
  }

  // ── Chat Phase ────────────────────────────────────────────────────────────────
  return (
    <div className="qr-chat-layout">
      {/* Sidebar panel */}
      <aside className="qr-sidebar">
        <div className="qr-sidebar-head">
          <div className="qr-file-pill">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            <span className="qr-file-name">{file?.name}</span>
          </div>
          <div className="qr-index-stats">
            <span className="qr-stat"><strong>{chunks.length}</strong> chunks</span>
            <span className="qr-stat-dot">·</span>
            <span className="qr-stat"><strong>{messages.filter(m => m.role === 'user').length}</strong> questions</span>
          </div>
        </div>

        <div className="qr-suggest-label">Suggested Questions</div>
        <div className="qr-suggestions">
          {SUGGESTED_QUESTIONS.map((q, i) => (
            <button
              key={i}
              className="qr-suggest-btn"
              onClick={() => handleSend(q)}
              disabled={isThinking}
            >
              {q}
            </button>
          ))}
        </div>

        <button className="qr-new-btn" onClick={reset} id="qr-new-session-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3"/>
          </svg>
          New Session
        </button>
      </aside>

      {/* Main chat */}
      <div className="qr-chat-main">
        {/* Header strip */}
        <div className="qr-chat-header">
          <div className="qr-chat-title">
            <span className="qr-ready-dot" />
            Resume Q&A
          </div>
          <div className="qr-chat-subtitle">Answers grounded strictly in your document</div>
        </div>

        {/* Messages */}
        <div className="qr-messages" ref={chatRef}>
          {messages.map((msg, idx) => {
            if (msg.role === 'system') {
              return (
                <div key={idx} className="qr-system-msg">
                  {msg.content}
                </div>
              );
            }
            return (
              <div key={idx} className={`qr-bubble-wrap ${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="qr-avatar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                    </svg>
                  </div>
                )}
                <div className="qr-bubble">
                  <p>{msg.content}</p>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="qr-sources">
                      {[...new Set(msg.sources)].sort((a, b) => a - b).map(pg => (
                        <span key={pg} className="qr-source-chip">p.{pg}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isThinking && (
            <div className="qr-bubble-wrap assistant">
              <div className="qr-avatar">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
              </div>
              <div className="qr-bubble qr-bubble-thinking">
                <span className="qr-dot" /><span className="qr-dot" /><span className="qr-dot" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="qr-input-area">
          <div className="qr-input-box">
            <textarea
              ref={inputRef}
              className="qr-textarea"
              placeholder="Ask anything about this resume…"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={isThinking}
              id="qr-question-input"
            />
            <button
              className="qr-send-btn"
              onClick={() => handleSend()}
              disabled={isThinking || !input.trim()}
              id="qr-send-btn"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
              </svg>
            </button>
          </div>
          <p className="qr-input-hint">Enter to send · Shift+Enter for new line · Answers sourced from your resume only</p>
        </div>
      </div>
    </div>
  );
}
