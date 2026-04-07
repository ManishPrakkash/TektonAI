import { useState, useEffect, useRef } from 'react';
import './App.css';
import GrammarCheck from './GrammarCheck';
import FormatChecker from './FormatChecker';
import Questioner from './Questioner';

interface Message {
  role: 'user' | 'bot';
  content: string;
}

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isDark, setIsDark] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [activeTab, setActiveTab] = useState('analyzer');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const chatDisplayRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const graphRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    // Initial theme apply
    if (isDark) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }, [isDark]);

  useEffect(() => {
    // Neural Node Animation
    const dots = graphRef.current?.querySelectorAll('circle');
    if (dots) {
      dots.forEach((dot, index) => {
        const delay = index * 20000;
        dot.animate([
          { transform: 'translate(0, 0)', opacity: 0.1 },
          { transform: 'translate(20px, -10px)', opacity: 0.3 },
          { transform: 'translate(0, 0)', opacity: 0.1 }
        ], {
          duration: 50000 + delay,
          iterations: Infinity,
          easing: 'ease-in-out'
        });
      });
    }
  }, []);

  useEffect(() => {
    // Auto-scroll on new messages
    if (chatDisplayRef.current) {
      chatDisplayRef.current.scrollTop = chatDisplayRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const toggleTheme = () => {
    const nextTheme = !isDark;
    
    // @ts-ignore
    if (!document.startViewTransition) {
      setIsDark(nextTheme);
      localStorage.setItem('theme', nextTheme ? 'dark' : 'light');
      return;
    }

    // @ts-ignore
    document.startViewTransition(() => {
      setIsDark(nextTheme);
      localStorage.setItem('theme', nextTheme ? 'dark' : 'light');
    });
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg = input.trim();
    setInput('');
    
    if (!isSessionActive) {
      setIsSessionActive(true);
    }

    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsTyping(true);
    
    const apiKey = import.meta.env.VITE_GROQ_API_KEY;
    
    if (!apiKey) {
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          role: 'bot', 
          content: "Neural link missing. Please configure VITE_GROQ_API_KEY in your .env file." 
        }]);
        setIsTyping(false);
      }, 1000);
      return;
    }

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: "You are 'Tekton AI', a professional AI resume analyzer and career strategist. Your goal is to help users improve their resumes, provide feedback on job applications, and offer career advice. Talk naturally, professionally, but accessible. Avoid long winded responses."
            },
            {
              role: "user",
              content: userMsg
            }
          ],
          temperature: 0.7,
          max_completion_tokens: 1024
        })
      });

      const data = await response.json();
      const botReply = data.choices?.[0]?.message?.content || "Interference detected.";
      
      setMessages(prev => [...prev, { role: 'bot', content: botReply }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'bot', content: "Failed to connect to Groq. Network error." }]);
    } finally {
      setIsTyping(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="app-container">
      {/* Sidebar Toggle Button */}
      <button 
        className="sidebar-toggle" 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        style={{ left: isSidebarOpen ? '324px' : '24px' }}
        title="Toggle Sidebar"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line></svg>
      </button>

      {/* Sidebar */}
      <aside className={`sidebar ${!isSidebarOpen ? 'collapsed' : ''}`}>
        <div className="sidebar-logo">Tekton ai.</div>
        
        <nav className="sidebar-nav">
          <div 
            className={`nav-item ${activeTab === 'analyzer' ? 'active' : ''}`}
            onClick={() => setActiveTab('analyzer')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
            Resume Analyzer
          </div>
          <div 
            className={`nav-item ${activeTab === 'builder' ? 'active' : ''}`}
            onClick={() => setActiveTab('builder')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
            Resume Builder
          </div>
          <div 
            className={`nav-item ${activeTab === 'jobs' ? 'active' : ''}`}
            onClick={() => setActiveTab('jobs')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>
            Job Recommendations
          </div>
          <div 
            className={`nav-item ${activeTab === 'grammar' ? 'active' : ''}`}
            onClick={() => setActiveTab('grammar')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"></polyline><line x1="9" y1="20" x2="15" y2="20"></line><line x1="12" y1="4" x2="12" y2="20"></line></svg>
            Grammar Check
          </div>
          <div 
            className={`nav-item ${activeTab === 'format' ? 'active' : ''}`}
            onClick={() => setActiveTab('format')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
            Format Checker
          </div>
          <div 
            className={`nav-item ${activeTab === 'questioner' ? 'active' : ''}`}
            onClick={() => setActiveTab('questioner')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Questioner
          </div>
        </nav>

        <div className="sidebar-footer">
          v1.0.4 - Enterprise Edition
        </div>
      </aside>

      {/* Main Content */}
      <main className={`main-content ${isSessionActive ? 'active-session' : ''} ${activeTab === 'grammar' || activeTab === 'format' || activeTab === 'questioner' ? 'grammar-mode' : ''}`}>
        {/* Ambient Aura */}
        <div className="aura-field">
          <div className="glow glow-1"></div>
          <div className="glow glow-2"></div>
          <div className="glow glow-3"></div>
        </div>

        {/* 2D Neural Background */}
        <svg className="neural-graph" ref={graphRef} viewBox="0 0 1000 1000">
          <circle cx="20%" cy="30%" r="2" fill="currentColor" opacity="0.1" />
          <circle cx="80%" cy="20%" r="3" fill="currentColor" opacity="0.1" />
          <circle cx="50%" cy="80%" r="4" fill="currentColor" opacity="0.1" />
          <path d="M200,300 L800,200" stroke="currentColor" strokeWidth="0.5" opacity="0.05" />
          <path d="M800,200 L500,800" stroke="currentColor" strokeWidth="0.5" opacity="0.05" />
        </svg>

        <button className="theme-toggle" onClick={toggleTheme}>
          {isDark ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
          )}
        </button>

        {/* Tool Tabs */}
        {activeTab === 'grammar' ? (
          <GrammarCheck />
        ) : activeTab === 'format' ? (
          <FormatChecker />
        ) : activeTab === 'questioner' ? (
          <Questioner />
        ) : (
          <>
            {/* Hero Section */}
            {!isSessionActive && (
              <div className="logo-container">
                <div className="logo-text">tekton.</div>
                <h1 className="hero-text">Resume<br />Analyzer</h1>
              </div>
            )}

            {/* Chat Area */}
            <div className="chat-display" ref={chatDisplayRef}>
              {messages.map((msg, idx) => (
                <div key={idx} className={`message-bubble ${msg.role}`}>
                  <div className="message-content">
                    <p>{msg.content}</p>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="message-bubble bot">
                  <div className="message-content">
                    <p>Thinking...</p>
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="input-pill-container">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#86868b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
              <input 
                ref={inputRef}
                type="text" 
                className="user-input" 
                placeholder={activeTab === 'analyzer' ? "Paste your resume or ask for feedback..." : "Ask anything..."} 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                autoComplete="off"
              />
              <button className="send-action" onClick={handleSend} disabled={isTyping}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5"></line>
                  <polyline points="5 12 12 5 19 12"></polyline>
                </svg>
              </button>
            </div>

            <div className="sub-actions">
              <span>Explore premium features? <a className="action-link" href="#">Get Tekton Pro &rarr;</a></span>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
