import { useState, useEffect, useRef } from 'react';
import './App.css';

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
        const delay = index * 200;
        dot.animate([
          { transform: 'translate(0, 0)', opacity: 0.1 },
          { transform: 'translate(20px, -10px)', opacity: 0.3 },
          { transform: 'translate(0, 0)', opacity: 0.1 }
        ], {
          duration: 5000 + delay,
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
    
    // Check for View Transition API support
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
              content: "You are 'mellow', a friendly personalized AI study tutor. Talk naturally, like a smart friend. Avoid long paragraphs. Use clear, simple, conversational talk."
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
    <div className={`app-container ${isSessionActive ? 'active-session' : ''}`}>
      {/* Ambient Aura Layer */}
      <div className="aura-field">
        <div className="glow glow-1"></div>
        <div className="glow glow-2"></div>
        <div className="glow glow-3"></div>
      </div>

      <div className="theme-wave"></div>
      
      {/* 2D Neural Node Background */}
      <svg className="neural-graph" ref={graphRef} viewBox="0 0 1000 1000">
        <circle cx="20%" cy="30%" r="2" fill="currentColor" opacity="0.1" />
        <circle cx="80%" cy="20%" r="3" fill="currentColor" opacity="0.1" />
        <circle cx="50%" cy="80%" r="4" fill="currentColor" opacity="0.1" />
        <path d="M200,300 L800,200" stroke="currentColor" strokeWidth="0.5" opacity="0.05" />
        <path d="M800,200 L500,800" stroke="currentColor" strokeWidth="0.5" opacity="0.05" />
      </svg>

      <button className="theme-toggle" onClick={toggleTheme} title="Toggle Dark/Light Mode">
        {isDark ? (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
          </svg>
        )}
      </button>

      {/* Main UI */}
      {!isSessionActive && (
        <div className="logo-container">
          <div className="logo-text">mellow.</div>
          <h1 className="hero-text">Personalized<br />tutor.</h1>
        </div>
      )}

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

      <div className="input-pill-container">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#86868b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
        <input 
          ref={inputRef}
          type="text" 
          className="user-input" 
          placeholder="Ask anything" 
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
        <span>Not a member? <a className="action-link" href="#">Join the waitlist &rarr;</a></span>
      </div>
    </div>
  );
}

export default App;
