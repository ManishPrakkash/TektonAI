import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, Link, useLocation } from 'react-router-dom';
import './App.css';

// --- Types ---
interface Message {
  role: 'user' | 'bot';
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  timestamp: number;
}

// --- Unified Sidebar ---
const AppSidebar = ({ isOpen, toggleSidebar }: { isOpen: boolean, toggleSidebar: () => void }) => {
  const navigate = useNavigate();
  const { sessionId } = useParams();
  const location = useLocation();
  const [sessions, setSessions] = useState<ChatSession[]>([]);

  const path = location.pathname;
  const tool = path.includes('resumebuilder') ? 'resumebuilder' : 
               path.includes('analyzer') ? 'analyzer' : 
               path.includes('jobs') ? 'jobs' : 
               path.includes('grammar') ? 'grammar' : null;

  const getToolTitle = (id: string) => {
    if (id === 'resumebuilder') return 'Resume Builder';
    if (id === 'analyzer') return 'Resume Analyzer';
    if (id === 'jobs') return 'Job Recommendations';
    if (id === 'grammar') return 'Grammar Check';
    return 'Tekton AI';
  };

  useEffect(() => {
    if (tool) {
      const saved = localStorage.getItem(`sessions_${tool}`);
      if (saved) setSessions(JSON.parse(saved));
      else setSessions([]);
    }
  }, [tool]);

  const createNewChat = () => {
    if (!tool) return;
    const newId = `session_${Date.now()}`;
    const newSession = { id: newId, title: 'New Chat', timestamp: Date.now() };
    const updated = [newSession, ...sessions];
    setSessions(updated);
    localStorage.setItem(`sessions_${tool}`, JSON.stringify(updated));
    navigate(`/${tool}/${newId}`);
  };

  const deleteSession = (id: string, e: any) => {
    e.stopPropagation();
    if (!tool) return;
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    localStorage.setItem(`sessions_${tool}`, JSON.stringify(updated));
    if (sessionId === id) navigate(`/${tool}`);
  };

  return (
    <>
      <button className="sidebar-toggle" onClick={toggleSidebar}>
        {isOpen ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>
        )}
      </button>

      <aside className={`sidebar ${!isOpen ? 'collapsed' : ''}`}>
        {!tool ? (
          <>
            <div className="sidebar-logo">tekton ai.</div>
            <nav className="sidebar-nav">
              <div className={`nav-item ${path.includes('analyzer') ? 'active' : ''}`} onClick={() => navigate('/analyzer')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>Resume Analyzer</div>
              <div className={`nav-item ${path.includes('resumebuilder') ? 'active' : ''}`} onClick={() => navigate('/resumebuilder')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>Resume Builder</div>
              <div className={`nav-item ${path.includes('jobs') ? 'active' : ''}`} onClick={() => navigate('/jobs')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>Job Recommendations</div>
              <div className={`nav-item ${path.includes('grammar') ? 'active' : ''}`} onClick={() => navigate('/grammar')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="12" y1="4" x2="12" y2="20"></line></svg>Grammar Check</div>
            </nav>
            <div className="sidebar-footer">V1.0.9 - Tekton OS</div>
          </>
        ) : (
          <>
            <div className="sidebar-header">
              <Link to="/" className="sidebar-back-btn">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              </Link>
              <div className="sidebar-tool-title">{getToolTitle(tool)}</div>
            </div>

            <button className="new-chat-btn" onClick={createNewChat}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              New Chat
            </button>

            <div className="history-list">
              <div className="history-section-title">Recent Chats</div>
              {sessions.map(s => (
                <div key={s.id} className={`history-item ${sessionId === s.id ? 'active' : ''}`} onClick={() => navigate(`/${tool}/${s.id}`)}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                  <span className="truncate">{s.title}</span>
                  <button className="delete-chat" onClick={(e) => deleteSession(s.id, e)}>×</button>
                </div>
              ))}
              {sessions.length === 0 && <div className="empty-history">No history yet</div>}
            </div>

            <div className="sidebar-footer">
              <div className="user-profile">
                <div className="avatar">MP</div>
                <div className="user-info">
                  <span className="user-name">Manish Prakkash</span>
                  <span className="user-plan">Elite Plan</span>
                </div>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
};

// --- Workspace Component ---
const Workspace = () => {
  const { sessionId } = useParams();
  const location = useLocation();
  const tool = location.pathname.includes('resumebuilder') ? 'resumebuilder' : 
               location.pathname.includes('analyzer') ? 'analyzer' : 
               location.pathname.includes('jobs') ? 'jobs' : 
               location.pathname.includes('grammar') ? 'grammar' : 'unknown';

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatDisplayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessionId) {
      const historyKey = `history_${tool}_${sessionId}`;
      const saved = localStorage.getItem(historyKey);
      if (saved) setMessages(JSON.parse(saved));
      else setMessages([{ role: 'bot', content: `Ready to assist with your ${tool.replace('resumebuilder', 'Resume Builder')}. How can we start?` }]);
    } else {
      setMessages([]);
    }
  }, [sessionId, tool]);

  useEffect(() => {
    if (chatDisplayRef.current) {
      chatDisplayRef.current.scrollTop = chatDisplayRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const userMsg = input.trim();
    setInput('');
    const newMessages = [...messages, { role: 'user', content: userMsg } as Message];
    setMessages(newMessages);
    setIsTyping(true);

    try {
      const response = await fetch('http://localhost:5001/chat-builder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: sessionId || 'default', message: userMsg }),
      });
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let botTxt = "";
      while (true) {
        const { done, value } = await (reader?.read() || { done: true, value: null });
        if (done) break;
        botTxt += decoder.decode(value);
        setMessages([...newMessages, { role: 'bot', content: botTxt }]);
      }
      
      if (sessionId) {
        localStorage.setItem(`history_${tool}_${sessionId}`, JSON.stringify([...newMessages, { role: 'bot', content: botTxt }]));
        const sessions = JSON.parse(localStorage.getItem(`sessions_${tool}`) || '[]');
        const idx = sessions.findIndex((s: any) => s.id === sessionId);
        if (idx !== -1 && sessions[idx].title === 'New Chat') {
          sessions[idx].title = userMsg.substring(0, 30);
          localStorage.setItem(`sessions_${tool}`, JSON.stringify(sessions));
        }
      }
    } catch (e) {
      setMessages([...newMessages, { role: 'bot', content: "Brain disconnected. Try again." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <main className="main-content active-session">
      <div className="chat-display" ref={chatDisplayRef}>
        {messages.length === 0 && !sessionId && (
          <div className="workspace-hero">
            <div className="tool-badge">{tool.toUpperCase()}</div>
            <h1>New Session</h1>
            <p>Paste your content or describe your goal to begin.</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`message-bubble ${msg.role}`}><div className="message-content"><p>{msg.content}</p></div></div>
        ))}
        {isTyping && <div className="message-bubble bot"><div className="message-content">...</div></div>}
      </div>

      <div className="input-pill-container" style={{ margin: '0 auto 40px' }}>
        <input type="text" className="user-input" placeholder="Compose..." value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()} />
        <button className="send-action" onClick={handleSend} disabled={isTyping || !sessionId}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
        </button>
      </div>
    </main>
  );
};

// --- Root Application Component ---
const AppInner = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (isDark) document.body.classList.add('dark-mode');
    else document.body.classList.remove('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  }, [isDark]);

  const toggleTheme = () => {
    if ((document as any).startViewTransition) {
      (document as any).startViewTransition(() => setIsDark(!isDark));
    } else {
      setIsTransitioning(true);
      setTimeout(() => {
        setIsDark(!isDark);
        setTimeout(() => setIsTransitioning(false), 800);
      }, 50);
    }
  };

  return (
    <div className="app-container">
      {/* Premium Background Aura */}
      <div className="aura-field">
        <div className="glow glow-1"></div>
        <div className="glow glow-2"></div>
        <div className="glow glow-3"></div>
      </div>

      {/* Theme Transition Overlay */}
      <div className={`theme-wave ${isTransitioning ? 'animate' : ''}`}></div>

      {/* Global Theme Toggle */}
      <button className="theme-toggle" onClick={toggleTheme}>
        {isDark ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
        )}
      </button>

      {/* Sidebar with Toggle State */}
      <AppSidebar isOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

      <Routes>
        <Route path="/" element={
          <main className="main-content">
            <div className="logo-container">
              <div className="logo-text">tekton.</div>
              <h1 className="hero-text">Evolutionary AI<br/>Intelligence</h1>
              <p style={{ opacity: 0.6, marginTop: '20px' }}>Select a specialized tool to begin.</p>
            </div>
          </main>
        } />
        <Route path="/analyzer" element={<Workspace />} />
        <Route path="/analyzer/:sessionId" element={<Workspace />} />
        <Route path="/resumebuilder" element={<Workspace />} />
        <Route path="/resumebuilder/:sessionId" element={<Workspace />} />
        <Route path="/jobs" element={<Workspace />} />
        <Route path="/jobs/:sessionId" element={<Workspace />} />
        <Route path="/grammar" element={<Workspace />} />
        <Route path="/grammar/:sessionId" element={<Workspace />} />
      </Routes>
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}

export default App;
