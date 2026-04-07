import { useState, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useParams, Link, useLocation } from "react-router-dom";
import './App.css';
import GrammarCheck from './GrammarCheck';
import FormatChecker from './FormatChecker';
import Questioner from './Questioner';

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

  // Only resumebuilder / analyzer / jobs get session history in sidebar
  const tool = path.includes('resumebuilder') ? 'resumebuilder' :
               path.includes('analyzer') ? 'analyzer' :
               path.includes('jobs') ? 'jobs' : null;

  const getToolTitle = (id: string) => {
    if (id === 'resumebuilder') return 'Resume Builder';
    if (id === 'analyzer') return 'Resume Analyzer';
    if (id === 'jobs') return 'Job Recommendations';
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
              <div className={`nav-item ${path === '/analyzer' || path.startsWith('/analyzer/') ? 'active' : ''}`} onClick={() => navigate('/analyzer')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>
                Resume Analyzer
              </div>
              <div className={`nav-item ${path === '/resumebuilder' || path.startsWith('/resumebuilder/') ? 'active' : ''}`} onClick={() => navigate('/resumebuilder')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
                Resume Builder
              </div>
              <div className={`nav-item ${path === '/jobs' || path.startsWith('/jobs/') ? 'active' : ''}`} onClick={() => navigate('/jobs')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
                Job Recommendations
              </div>
              <div className={`nav-item ${path === '/grammar' ? 'active' : ''}`} onClick={() => navigate('/grammar')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="12" y1="4" x2="12" y2="20"></line></svg>
                Grammar Check
              </div>
              <div className={`nav-item ${path === '/format' ? 'active' : ''}`} onClick={() => navigate('/format')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                Format Checker
              </div>
              <div className={`nav-item ${path === '/questioner' ? 'active' : ''}`} onClick={() => navigate('/questioner')}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                Resume Q&amp;A
              </div>
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
              <div className="user-card">
                <div className="user-avatar-gradient">MP</div>
                <div className="user-details">
                  <div className="user-name">Manish Prakkash</div>
                  <div className="user-status-pill">Elite Plan</div>
                </div>
                <button className="user-settings-btn">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z"/></svg>
                </button>
              </div>
            </div>
          </>
        )}
      </aside>
    </>
  );
};

// --- Utility: Derive Resume Data from Messages ---
const deriveResumeData = (messages: Message[]) => {
  const data: any = {
    name: "MANISH PRAKKASH MS",
    email: "manishprakkash.ms2024cse@sece.ac.in",
    education: [],
    projects: [],
    skills: {}
  };

  messages.forEach(msg => {
    const text = msg.content;
    if (text.includes("Project:")) {
      const match = text.match(/Project:\s*([^\n]+)/);
      if (match) {
        const name = match[1].trim();
        if (!data.projects.find((p: any) => p.title === name)) {
          data.projects.push({ title: name, date: "2025", bullets: [] });
        }
      }
    }
    if (text.includes("Bullet:")) {
      const match = text.match(/Bullet:\s*([^\n]+)/);
      if (match && data.projects.length > 0) {
        data.projects[data.projects.length - 1].bullets.push(match[1].trim());
      }
    }
  });

  if (data.projects.length === 0) {
    data.projects = [
      {
        title: "Artifex - AI Agent Builder Platform",
        date: "Jan 2025",
        stack: "FastAPI, Next.js, Multi-Agent Systems",
        bullets: ["Engineered an AI agent builder to transform natural language into multi-agent systems.", "Implemented automated architecture design logic."]
      },
      {
        title: "Cloud Meter - Cost Estimator",
        date: "Mar 2025",
        stack: "Node.js, AST Parsing, CLI",
        bullets: ["Built a CLI tool to analyze backend codebases for cost optimization.", "Implemented AST-based static analysis."]
      }
    ];
  }
  return data;
};

// --- Resume Modal ---
const ResumeModal = ({ isOpen, onClose, messages }: { isOpen: boolean, onClose: () => void, messages: Message[] }) => {
  if (!isOpen) return null;
  const data = deriveResumeData(messages);

  return (
    <div className="resume-modal-overlay" onClick={onClose}>
      <div className="resume-paper" onClick={e => e.stopPropagation()} contentEditable suppressContentEditableWarning>
        <div className="resume-header">
          <h1 className="resume-name">{data.name}</h1>
          <div className="resume-contact">
            <span>{data.email}</span>
            <span>|</span>
            <span>+91 8778984328</span>
            <span>|</span>
            <span>LinkedIn</span>
            <span>|</span>
            <span>GitHub</span>
          </div>
        </div>

        <div className="resume-section">
          <h2 className="resume-section-title">Education</h2>
          <div className="resume-entry">
            <span className="entry-title">Sri Eshwar College of Engineering | B.E. Computer Science</span>
            <span className="entry-date">2024 - 2028</span>
          </div>
        </div>

        <div className="resume-section">
          <h2 className="resume-section-title">Projects</h2>
          {data.projects.map((proj: any, idx: number) => (
            <div key={idx} style={{ marginBottom: '15px' }}>
              <div className="resume-entry">
                <span className="entry-title">{proj.title}</span>
                <span className="entry-date">{proj.date}</span>
              </div>
              {proj.stack && <div className="tech-stack">Stack: {proj.stack}</div>}
              <ul className="resume-list">
                {proj.bullets.map((b: string, i: number) => <li key={i}>{b}</li>)}
              </ul>
            </div>
          ))}
        </div>

        <div className="resume-section">
          <h2 className="resume-section-title">Technical Skills</h2>
          <table className="skills-table">
            <tbody>
              <tr><td className="skill-category">Languages:</td><td>C, C++, JavaScript (ES6+), Bash, Python</td></tr>
              <tr><td className="skill-category">Frameworks:</td><td>NodeJS, ExpressJS, ReactJS, ReactNative, FastAPI</td></tr>
              <tr><td className="skill-category">Database:</td><td>MongoDB, PostgreSQL, MySQL, Firebase, Supabase, Redis</td></tr>
              <tr><td className="skill-category">Deployment:</td><td>Vercel, Netlify, Render, Docker, Nginx</td></tr>
            </tbody>
          </table>
        </div>
      </div>
      <button className="generate-btn" style={{ right: '40px', bottom: '20px', top: 'auto', background: '#000', color: '#fff' }} onClick={() => window.print()}>Download PDF</button>
      <button className="generate-btn" style={{ right: '40px', bottom: '70px', top: 'auto', background: '#fff', color: '#000', border: '1px solid #000' }} onClick={onClose}>Close Preview</button>
    </div>
  );
};

// --- Workspace Component (Chat Interface) ---
const Workspace = () => {
  const { sessionId } = useParams();
  const location = useLocation();
  const tool = location.pathname.includes('resumebuilder') ? 'resumebuilder' :
               location.pathname.includes('analyzer') ? 'analyzer' :
               location.pathname.includes('jobs') ? 'jobs' : 'unknown';

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const chatDisplayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessionId) {
      const historyKey = `history_${tool}_${sessionId}`;
      const saved = localStorage.getItem(historyKey);
      if (saved) {
        setMessages(JSON.parse(saved));
      } else {
        if (sessionId === 'session_1775539040426') {
          setMessages([{
            role: 'bot',
            content: `Greetings Manish! I have reviewed your portfolio. Your work on Artifex and Cloud Meter represents significant engineering depth. To finalize your Gold Standard resume, I have three strategic questions:\n\n1. EXECUTIVE DISCOVERY: Regarding Artifex, what specific orchestration logic ensured agentic reliability and prevented recursive execution loops?\n\n2. TECHNICAL ARCHITECTURE: How did you bridge AST-based code analysis with precise cost-modeling in the Cloud Meter CLI?\n\n3. PERFORMANCE HIGHLIGHTS: Given your LeetCode standing, which specific algorithmic focus best represents your problem-solving style for this resume?`
          }]);
        } else {
          setMessages([{ role: 'bot', content: `Ready to assist with your ${tool.replace('resumebuilder', 'Resume Builder').replace('analyzer', 'Resume Analyzer')}. How can we start?` }]);
        }
      }
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

    if (tool === 'resumebuilder' && (userMsg.toLowerCase().includes('generate') || userMsg.toLowerCase().includes('preview') || newMessages.filter(m => m.role === 'user').length >= 3)) {
      setTimeout(() => {
        const botResponse = newMessages.filter(m => m.role === 'user').length >= 3
          ? 'I have gathered sufficient technical details. Initializing the Gold Standard formatting for your resume now...'
          : 'Understood. Initializing Gold Standard Resume formatting... Layout is now ready for your review.';
        setMessages([...newMessages, { role: 'bot', content: botResponse }]);
        setShowResume(true);
        setIsTyping(false);
      }, 1500);
      return;
    }

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
        const filteredTxt = botTxt.replace(/\*/g, '');
        setMessages([...newMessages, { role: 'bot', content: filteredTxt }]);
      }
      if (sessionId) {
        const finalBotTxt = botTxt.replace(/\*/g, '');
        localStorage.setItem(`history_${tool}_${sessionId}`, JSON.stringify([...newMessages, { role: 'bot', content: finalBotTxt }]));
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
      <div className="workspace-header">
        <div className="tool-info">
          <span className="tool-indicator"></span>
          <h2>{tool === 'resumebuilder' ? 'Resume Builder' : tool === 'analyzer' ? 'Resume Analyzer' : tool.toUpperCase()}</h2>
        </div>
        {tool === 'resumebuilder' && (
          <div className="header-actions">
            <button className="preview-action-btn" onClick={() => setShowResume(true)}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
              Preview Resume
            </button>
          </div>
        )}
      </div>

      <div className="chat-display" ref={chatDisplayRef}>
        {messages.length === 0 && !sessionId && (
          <div className="workspace-hero">
            <div className="tool-badge">{tool.toUpperCase()}</div>
            <h1>New Session</h1>
            <p>Paste your content or describe your goal to begin.</p>
          </div>
        )}
        {messages.map((msg, idx) => (
          <div key={idx} className={`message-bubble ${msg.role}`}>
            <div className="message-content"><p>{msg.content}</p></div>
          </div>
        ))}
        {isTyping && (
          <div className="message-bubble bot">
            <div className="message-content"><p>Thinking...</p></div>
          </div>
        )}
      </div>

      <div className="input-pill-container" style={{ margin: '0 auto 40px' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#86868b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input
          type="text"
          className="user-input"
          placeholder={tool === 'analyzer' ? "Paste your resume or ask for feedback..." : "Refine your details..."}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          autoComplete="off"
        />
        <button className="send-action" onClick={handleSend} disabled={isTyping || !sessionId}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="12" y1="19" x2="12" y2="5"></line><polyline points="5 12 12 5 19 12"></polyline></svg>
        </button>
      </div>

      <ResumeModal isOpen={showResume} onClose={() => setShowResume(false)} messages={messages} />
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

      {/* Sidebar */}
      <AppSidebar isOpen={isSidebarOpen} toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

      <Routes>
        {/* Home */}
        <Route path="/" element={
          <main className="main-content">
            <div className="logo-container">
              <div className="logo-text">tekton.</div>
              <h1 className="hero-text">Evolutionary AI<br/>Intelligence</h1>
              <p style={{ opacity: 0.6, marginTop: '20px' }}>Select a specialized tool to begin.</p>
            </div>
          </main>
        } />

        {/* Chat-based tools */}
        <Route path="/analyzer" element={<Workspace />} />
        <Route path="/analyzer/:sessionId" element={<Workspace />} />
        <Route path="/resumebuilder" element={<Workspace />} />
        <Route path="/resumebuilder/:sessionId" element={<Workspace />} />
        <Route path="/jobs" element={<Workspace />} />
        <Route path="/jobs/:sessionId" element={<Workspace />} />

        {/* Standalone tool pages */}
        <Route path="/grammar" element={
          <main className="main-content grammar-mode">
            <GrammarCheck />
          </main>
        } />
        <Route path="/format" element={
          <main className="main-content grammar-mode">
            <FormatChecker />
          </main>
        } />
        <Route path="/questioner" element={
          <main className="main-content grammar-mode">
            <Questioner />
          </main>
        } />
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
