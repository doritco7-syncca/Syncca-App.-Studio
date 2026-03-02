import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Heart, ShieldAlert, Clock, RefreshCcw, User, Sparkles, Bookmark, X, Settings, MessageSquare, PenTool, LogOut, Activity } from 'lucide-react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { MidwifeService } from './services/midwifeService.ts';

import { AIRTABLE_SCHEMA } from './airtableSchema.ts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const Logo = () => (
  <svg viewBox="0 0 100 100" className="w-14 h-14 md:w-16 md:h-16 rotate-180" fill="none" xmlns="http://www.w3.org/2000/svg">
    {/* Outer Crescent - Orange-Red */}
    <path 
      d="M25 20C15 30 10 45 10 60C10 82 28 100 50 100C72 100 90 82 90 60C90 45 85 30 75 20C82 30 85 42 85 55C85 75 70 90 50 90C30 90 15 75 15 55C15 42 18 30 25 20Z" 
      fill="#ea580c" 
    />
    {/* Inner Crescent - Dark Blue */}
    <path 
      d="M40 35C35 40 32 48 32 58C32 70 40 80 50 80C60 80 68 70 68 58C68 48 65 40 60 35C65 40 68 48 68 55C68 65 60 73 50 73C40 73 32 65 32 55C32 48 35 40 40 35Z" 
      fill="#1e3a8a" 
    />
  </svg>
);

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(30 * 60); // 30 minutes in seconds
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ id: string; name: string; username?: string; fields?: any } | null>(() => {
    const saved = localStorage.getItem('syncca_user_session');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      console.error("Failed to parse saved session", e);
      return null;
    }
  });
  const [lexicon, setLexicon] = useState<any[]>([]);
  const [savedConcepts, setSavedConcepts] = useState<any[]>([]);
  const [selectedConcept, setSelectedConcept] = useState<any | null>(null);
  const [showSignUp, setShowSignUp] = useState(false);
  const [showMemberArea, setShowMemberArea] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [userInsights, setUserInsights] = useState('');
  const [userIntention, setUserIntention] = useState('');
  const [userFeedback, setUserFeedback] = useState('');
  const [userFullName, setUserFullName] = useState('');
  const [userFirstName, setUserFirstName] = useState('');
  const [userMaritalStatus, setUserMaritalStatus] = useState('');
  const [userAgeRange, setUserAgeRange] = useState('');
  const [userGender, setUserGender] = useState('');
  const [lastSyncStatus, setLastSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showBetaWelcome, setShowBetaWelcome] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackInput, setFeedbackInput] = useState('');
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  const runAirtableTest = async () => {
    try {
      setLastSyncStatus('idle');
      const res = await fetch('/api/test-airtable');
      if (!res.ok) {
        const text = await res.text();
        setDebugInfo({ error: `Server returned ${res.status}`, detail: text.substring(0, 100) });
        return;
      }
      const data = await res.json();
      setDebugInfo(data);
      console.log("Airtable Test Results:", data);
    } catch (e: any) {
      setDebugInfo({ error: "Fetch failed", message: e.message });
    }
  };
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));
  const midwifeRef = useRef<MidwifeService | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const userIdRef = useRef<string | null>(currentUser?.id || null);
  
  useEffect(() => {
    if (currentUser) {
      userIdRef.current = currentUser.id;
      localStorage.setItem('syncca_user_session', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('syncca_user_session');
    }
  }, [currentUser]);

  const [airtableStatus, setAirtableStatus] = useState<string>('checking');

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          setAirtableStatus(data.airtable?.status || 'Unknown');
          console.log("Health check result:", data);
        }
      } catch (e) {
        setAirtableStatus('Error connecting to server');
      }
    };
    checkHealth();
  }, []);

  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem('syncca_beta_welcome_seen');
    if (!hasSeenWelcome) {
      setShowBetaWelcome(true);
    }
  }, []);

  useEffect(() => {
    const fetchLexicon = async () => {
      try {
        const res = await fetch('/api/lexicon');
        if (res.ok) {
          const data = await res.json();
          setLexicon(data);
          console.log("Lexicon loaded successfully:", data.length, "terms");
          if (data.length === 0) {
            console.warn("Lexicon is empty! Check Airtable configuration.");
          }
        }
      } catch (e: any) {
        console.warn("Initial lexicon fetch failed (silent):", e.message);
      }
    };
    // Small delay to allow environment to stabilize
    const timer = setTimeout(fetchLexicon, 1500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const initFromSession = async () => {
      if (currentUser && !midwifeRef.current && lexicon.length > 0) {
        console.log("Initializing Syncca from saved session...");
        const learnedIds = currentUser.fields?.[AIRTABLE_SCHEMA.users.columns.learnedConcepts] || [];
        const userSavedConcepts = lexicon.filter(l => learnedIds.includes(l.id));
        
        const service = new MidwifeService();
        service.onNameUpdate = (name: string) => {
          updateUserField('firstName', name);
          setCurrentUser(prev => prev ? { ...prev, name } : null);
        };
        await service.init(userSavedConcepts, currentUser.name !== 'משתמש' ? currentUser.name : undefined);
        midwifeRef.current = service;
        setIsSessionActive(true);
      }
    };
    initFromSession();
  }, [currentUser, lexicon]);

  useEffect(() => {
    if (currentUser && currentUser.fields && lexicon.length > 0) {
      const learnedIds = currentUser.fields[AIRTABLE_SCHEMA.users.columns.learnedConcepts] || [];
      const initialSaved = lexicon.filter(l => learnedIds.includes(l.id));
      setSavedConcepts(initialSaved);
    }
  }, [currentUser, lexicon]);

  const updateUserField = async (field: string, value: string) => {
    if (!userIdRef.current) return;
    try {
      await fetch(`/api/users/${userIdRef.current}/fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, value })
      });
      console.log(`Updated user field ${field}`);
    } catch (e) {
      console.error(`Failed to update user field ${field}`, e);
    }
  };

  const submitFeedback = async () => {
    if (!feedbackInput.trim() || !userIdRef.current) return;
    
    setIsSubmittingFeedback(true);
    try {
      await updateUserField('feedback', feedbackInput);
      setShowFeedbackModal(false);
      window.location.reload(); // Refresh to start new session after feedback
    } catch (e) {
      console.error("Failed to submit feedback", e);
    } finally {
      setIsSubmittingFeedback(false);
    }
  };
  const toggleSaveConcept = async (concept: any) => {
    const newSaved = savedConcepts.find(c => c.id === concept.id)
      ? savedConcepts.filter(c => c.id !== concept.id)
      : [...savedConcepts, concept];
    
    setSavedConcepts(newSaved);

    // Sync with Airtable if user is logged in
    if (userIdRef.current) {
      try {
        await fetch(`/api/users/${userIdRef.current}/concepts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conceptIds: newSaved.map(c => c.id) })
        });
        console.log("Synced saved concepts with Airtable");
      } catch (e) {
        console.error("Failed to sync concepts with Airtable", e);
      }
    }
  };

  const renderContentWithConcepts = (content: any): any => {
    if (lexicon.length === 0) {
      return content;
    }

    if (typeof content === 'string') {
      const parts = content.split(/(\[\[.*?\]\])/g);
      return parts.map((part, i) => {
        if (part.startsWith('[[') && part.endsWith(']]')) {
          const termWithBrackets = part;
          const rawTerm = part.slice(2, -2).trim();
          
          // Helper to normalize terms for matching
          const normalize = (str: string, stripPrefixes = true) => {
            if (!str) return '';
            let normalized = str.trim()
              .toLowerCase()
              .replace(/_/g, ' ') // Underscores to spaces
              .replace(/\s+/g, ' ') // Normalize multiple spaces
              .replace(/[וי]/g, ''); // Basic spelling normalization (remove optional 'vav' and 'yod')
            
            if (stripPrefixes) {
              // Improved Hebrew prefix stripping: only strip if it's a known prefix and the word is long enough
              normalized = normalized.split(' ')
                .map(word => {
                  if (word.length <= 3) return word;
                  // Only strip common Hebrew prefixes (ה, ב, כ, ל, מ, ו)
                  return word.replace(/^[הבכלמו]/, '');
                })
                .join(' ');
            }
            return normalized;
          };

          const termNoPrefix = normalize(rawTerm, true);
          const termExact = normalize(rawTerm, false);
          
          const concept = lexicon.find(l => {
            const hTermNoPrefix = normalize(l.hebrew_term || '', true);
            const hTermExact = normalize(l.hebrew_term || '', false);
            const eTermNoPrefix = normalize(l.term || '', true);
            const eTermExact = normalize(l.term || '', false);
            
            // Try exact matches first
            if (hTermExact === termExact || eTermExact === termExact) return true;
            // Try normalized matches
            if (hTermNoPrefix === termNoPrefix || eTermNoPrefix === termNoPrefix) return true;
            // Try matching raw term against normalized lexicon
            if (hTermNoPrefix === termExact || eTermNoPrefix === termExact) return true;
            
            return false;
          });
          
          if (concept) {
            const isSaved = savedConcepts.some(c => c.id === concept.id);
            const displayTerm = rawTerm;
            const displayDefinition = concept.definition_he || concept.definition_en || 'אין הגדרה זמינה';

            return (
              <span 
                key={i} 
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedConcept({ ...concept, preferredDefinition: displayDefinition });
                }}
                className={cn(
                  "underline decoration-orange-500/50 underline-offset-4 cursor-pointer relative group/concept inline font-medium transition-colors",
                  "decoration-dashed md:decoration-solid",
                  isSaved ? "text-orange-800 decoration-orange-600" : "hover:text-orange-800 text-orange-700/90"
                )}
              >
                {displayTerm}
                <span className="hidden md:block absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-64 p-3 bg-white text-[#1a1a1a] text-xs rounded-xl shadow-2xl opacity-0 invisible group-hover/concept:opacity-100 group-hover/concept:visible pointer-events-none z-50 border border-orange-200 leading-relaxed whitespace-normal">
                  <div className="flex justify-between items-start mb-1">
                    <strong className="text-orange-800 font-bold">{concept.hebrew_term || concept.term}</strong>
                    {isSaved && <span className="text-[10px] text-orange-600 font-normal">Saved</span>}
                  </div>
                  <span className="text-orange-700 block">{displayDefinition}</span>
                  <span className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-white"></span>
                </span>
              </span>
            );
          }
          return termWithBrackets;
        }
        return part;
      });
    }
    
    if (Array.isArray(content)) {
      return content.map((child, i) => <React.Fragment key={i}>{renderContentWithConcepts(child)}</React.Fragment>);
    }
    
    if (React.isValidElement(content)) {
      const element = content as React.ReactElement<any>;
      if (element.props && element.props.children) {
        return React.cloneElement(element, {
          children: renderContentWithConcepts(element.props.children)
        });
      }
    }
    
    return content;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    let timer: number;
    if (isSessionActive && timeLeft > 0) {
      timer = window.setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isSessionActive, timeLeft]);

  const handleInitialClick = () => {
    setShowSignUp(true);
  };

  const completeSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setIsLoading(true);
    
    // Add a client-side timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
        setMessages([{
          id: 'timeout-error',
          role: 'assistant',
          content: 'החיבור לוקח יותר זמן מהרגיל. אנא בדקו את החיבור לאינטרנט או נסו שוב מאוחר יותר.',
          timestamp: new Date()
        }]);
      }
    }, 30000);

    try {
      // Create/Get User in Airtable
      const userRes = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: emailInput,
          fullName: 'משתמש Syncca'
        })
      });
      
      let userData;
      if (userRes.ok) {
        userData = await userRes.json();
      } else {
        // Fallback for preview mode
        console.warn("Airtable API failed, using fallback for preview");
        userData = { id: 'preview-user', fields: { [AIRTABLE_SCHEMA.users.columns.firstName]: 'אורח' } };
      }

      const firstName = userData.fields?.[AIRTABLE_SCHEMA.users.columns.firstName] || 'משתמש';
      console.log("User identification successful. Airtable ID:", userData.id);
      setCurrentUser({ id: userData.id, name: firstName, username: emailInput, fields: userData.fields });
      userIdRef.current = userData.id;
      
      // Load user fields into state
      setUserInsights(userData.fields?.[AIRTABLE_SCHEMA.users.columns.insights] || '');
      setUserIntention(userData.fields?.[AIRTABLE_SCHEMA.users.columns.intention] || '');
      setUserFeedback(userData.fields?.[AIRTABLE_SCHEMA.users.columns.feedback] || '');
      setUserFullName(userData.fields?.[AIRTABLE_SCHEMA.users.columns.fullName] || '');
      setUserFirstName(userData.fields?.[AIRTABLE_SCHEMA.users.columns.firstName] || '');
      setUserMaritalStatus(userData.fields?.[AIRTABLE_SCHEMA.users.columns.maritalStatus] || '');
      setUserAgeRange(userData.fields?.[AIRTABLE_SCHEMA.users.columns.ageRange] || '');
      setUserGender(userData.fields?.[AIRTABLE_SCHEMA.users.columns.gender] || '');

      // Extract saved concepts from user data to pass to midwife
      const learnedIds = userData.fields?.[AIRTABLE_SCHEMA.users.columns.learnedConcepts] || [];
      const userSavedConcepts = lexicon.filter(l => learnedIds.includes(l.id));

      const service = new MidwifeService();
      service.onNameUpdate = (name: string) => {
        updateUserField('firstName', name);
        setCurrentUser(prev => prev ? { ...prev, name } : null);
      };
      await service.init(userSavedConcepts, firstName !== 'משתמש' ? firstName : undefined);
      midwifeRef.current = service;
      
      setSessionStartTime(new Date());
      setIsSessionActive(true);
      setShowSignUp(false);
      
      // Get personalized welcome message
      const welcomeResponse = await service.sendMessage("START_SESSION_NEW_OR_RETURNING");
      
      setMessages([
        {
          id: 'welcome',
          role: 'assistant',
          content: welcomeResponse || 'היי, אני כאן. מה על הלב שלך היום?',
          timestamp: new Date(),
        },
      ]);
      clearTimeout(timeoutId);
    } catch (e) {
      console.error("Failed to complete sign up", e);
      clearTimeout(timeoutId);
    } finally {
      setIsLoading(false);
    }
  };

  const logToAirtable = async (fullTranscript: string) => {
    const userId = userIdRef.current || currentUser?.id;
    if (!userId) {
      console.warn("Cannot log to Airtable: No user ID available");
      return;
    }

    // Ensure userId is a string and valid
    const finalUserId = typeof userId === 'string' ? userId : (userId as any).id || userId;
    if (!finalUserId || typeof finalUserId !== 'string') {
      console.error("Invalid userId for logging:", finalUserId);
      return;
    }

    // Extract concepts from transcript
    const conceptsFound = Array.from(fullTranscript.matchAll(/\[\[(.*?)\]\]/g))
      .map(match => match[1])
      .filter((v, i, a) => a.indexOf(v) === i) // unique
      .join(', ');

    try {
      console.log("Attempting to log to Airtable for user:", finalUserId);
      const response = await fetch('/api/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: finalUserId,
          transcript: fullTranscript,
          conceptsApplied: conceptsFound, 
          selfReview: 'Logged from client',
          timestamp: new Date().toISOString()
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Airtable logging failed server-side:", errorData);
        setLastSyncStatus('error');
        // Show a small snippet of the error in debugInfo if possible
        setDebugInfo((prev: any) => ({ ...prev, lastLogError: errorData.message || errorData.details || 'Unknown error' }));
      } else {
        console.log("Airtable logging successful");
        setLastSyncStatus('success');
      }
    } catch (e: any) {
      console.error("Failed to call logging API:", e);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading || !midwifeRef.current) return;

    // Check if user provided an email in the chat to identify themselves
    const emailMatch = input.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch && (!currentUser || currentUser.username?.startsWith('guest_'))) {
      const email = emailMatch[0];
      console.log("Found email in input, identifying user:", email);
      try {
        const userRes = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: email,
            fullName: 'משתמש מזוהה'
          })
        });
        const userData = await userRes.json();
        console.log("User identified successfully:", userData.id);
        setCurrentUser({ id: userData.id, name: 'משתמש', username: email });
        userIdRef.current = userData.id;
      } catch (e) {
        console.error("Failed to identify user from email", e);
      }
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const responseText = await midwifeRef.current.sendMessage(input);
      console.log("AI Response received:", responseText);
      
      // Ensure loading is cleared even if response is malformed
      setIsLoading(false);
      
      if (!responseText || responseText.includes("סליחה, משהו השתבש")) {
        // Handle error message if needed
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText || 'סליחה, משהו השתבש. בוא ננסה שוב.',
        timestamp: new Date(),
      };
      
      const finalMessages = [...newMessages, assistantMessage];
      setMessages(finalMessages);

      // Log the full transcript after each exchange
      const transcript = finalMessages.map(m => `${m.role === 'user' ? 'User' : 'Syncca'}: ${m.content}`).join('\n\n');
      logToAirtable(transcript);

    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isSessionActive) {
    if (showSignUp) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 font-sans" dir="rtl">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full bg-[#e5e1d8] rounded-[32px] p-8 shadow-xl border border-[#d1cdc3] text-center"
          >
            <div className="w-24 h-24 flex items-center justify-center mx-auto mb-6">
              <Logo />
            </div>
            
            <h2 className="text-2xl font-serif text-[#1e3a8a] mb-2">ברוכים הבאים ל-Syncca</h2>
            <p className="text-[#5A5A40] text-sm mb-8 leading-relaxed">
              כדי להבטיח בקרת איכות ולשמור על התובנות שלך – נבקש ממך להזדהות.
            </p>
            
            <form onSubmit={completeSignUp} className="space-y-6">
              <div className="text-right">
                <label className="block text-xs font-mono uppercase tracking-widest text-orange-400 mb-2 mr-4">כתובת אימייל</label>
                <input 
                  type="email" 
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="your@email.com"
                  className="w-full bg-[#fdf8f3] border border-orange-100 rounded-full py-4 px-6 focus:ring-2 focus:ring-orange-500 transition-all outline-none text-[#1a1a1a] text-center"
                />
              </div>
              
              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={isLoading || !emailInput.trim()}
                  className="w-full bg-orange-700 hover:bg-orange-800 text-white py-5 rounded-full font-medium transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-sm flex items-center justify-center gap-3 border border-orange-600 relative group disabled:opacity-50"
                >
                  <div className="absolute -inset-1.5 border border-orange-100/50 rounded-full group-hover:border-orange-200/50 transition-colors"></div>
                  {isLoading ? (
                    <RefreshCcw className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span className="relative z-10">שמור והתחל שיחה</span>
                    </>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setEmailInput('guest@syncca.com');
                    setTimeout(() => {
                      const form = document.querySelector('form');
                      if (form) form.requestSubmit();
                    }, 100);
                  }}
                  className="text-orange-400 text-xs hover:text-orange-600 transition-colors underline underline-offset-4"
                >
                  המשך כאורח (ללא שמירת נתונים)
                </button>
              </div>
            </form>
            
            <div className="mt-8 pt-6 border-t border-orange-100">
              <button className="w-full bg-white border border-orange-200 hover:bg-orange-50 text-orange-500 py-3 rounded-full text-xs font-medium transition-all flex items-center justify-center gap-2">
                <img src="https://www.google.com/favicon.ico" className="w-3 h-3 grayscale opacity-70" alt="Google" />
                התחברות עם Google
              </button>
            </div>
            
            {airtableStatus !== 'Connected Successfully' && airtableStatus !== 'checking' && (
              <div className="mt-4 p-3 bg-red-50 rounded-2xl border border-red-100 flex items-center gap-3">
                <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                <div className="text-right">
                  <p className="text-xs font-bold text-red-900">Airtable Disconnected</p>
                  <p className="text-[10px] text-red-700">{airtableStatus}</p>
                </div>
              </div>
            )}
            
            <p className="mt-6 text-[10px] text-orange-400 uppercase tracking-[0.2em] font-mono">
              Secure & Private Connection
            </p>
            {lexicon.length === 0 && airtableStatus === 'Connected Successfully' && (
              <div className="mt-4 p-2 bg-amber-50 rounded-lg border border-amber-100">
                <p className="text-[9px] text-amber-600 font-mono">
                  Lexicon is empty. Check Relationship_Lexicon table.
                </p>
              </div>
            )}
          </motion.div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center p-4 font-sans" dir="rtl">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full bg-[#e5e1d8] rounded-[40px] p-10 shadow-2xl text-center border border-[#d1cdc3]"
        >
          <div className="w-32 h-24 flex items-center justify-center mx-auto mb-0 relative">
            <Logo />
          </div>
          
          <h1 className="text-6xl font-serif font-bold text-[#ea580c] mb-4 tracking-tight">Syncca</h1>
          
          <p className="text-[#ea580c] font-bold text-lg mb-6">
            המרחב שבו האהבה נושמת
          </p>
          
          <p className="text-[#4a5568] mb-10 leading-relaxed text-sm px-4">
            אנחנו כאן כדי לעזור לך להחליף את מאבקי הכוח שמכבים יום אחר יום את האהבה, בשפה של תקשורת ישירה ובוגרת, שרואה גם את עצמך וגם את האחר.
          </p>
          
          <div className="flex justify-center mb-10">
            <button
              onClick={handleInitialClick}
              className="bg-[#1e3a8a] hover:bg-[#162a63] text-white px-10 py-3 rounded-full font-bold transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg flex items-center justify-center gap-3 border border-[#ea580c]/30"
            >
              <RefreshCcw className="w-4 h-4" />
              <span>שניכנס ל"סינק"?</span>
            </button>
          </div>
          
          <p className="text-[10px] text-[#ea580c] uppercase tracking-[0.2em] font-mono font-bold">
            BETA PHASE • SECURE & PRIVATE
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col font-sans items-center" dir="rtl">
      {/* Main App Container - Boxed on desktop, full on mobile */}
      <div className="flex-1 flex flex-col w-full max-w-5xl bg-[#e5e1d8] shadow-2xl md:my-8 md:rounded-[32px] overflow-hidden border-x border-[#d1cdc3] md:border-y relative">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-md border-b border-orange-100 sticky top-0 z-50 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <h2 className="font-serif text-xl font-bold text-[#1e3a8a]">
              Syncca <span className="text-orange-600 font-normal text-sm md:inline hidden mr-1">| Conscious Love</span>
            </h2>
            <div className="flex items-center gap-1 text-[10px] text-orange-500 font-mono uppercase tracking-widest">
              <span className="w-1.5 h-1.5 bg-orange-500 rounded-full animate-pulse"></span>
              {currentUser?.name && currentUser.name !== 'משתמש' ? `מלווה את ${currentUser.name}` : 'מסונכרנת'}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="hidden lg:flex flex-col items-end gap-0.5">
            <div className="flex items-center gap-3">
              <span className={cn(
                "text-[9px] font-mono uppercase tracking-tighter",
                lexicon.length > 0 ? "text-emerald-600" : "text-amber-600"
              )}>
                LEX: {lexicon.length}
              </span>
              <span className={cn(
                "text-[9px] font-mono uppercase tracking-tighter",
                lastSyncStatus === 'success' ? "text-emerald-600" : 
                lastSyncStatus === 'error' ? "text-red-600" : "text-blue-400"
              )}>
                SYNC: {lastSyncStatus}
              </span>
              <button 
                onClick={runAirtableTest}
                className="text-[9px] font-mono uppercase tracking-tighter text-blue-400 hover:text-blue-600 underline"
              >
                TEST
              </button>
            </div>
            {debugInfo && (
              <div className="text-[8px] font-mono text-blue-300 max-w-[150px] truncate text-left" dir="ltr">
                UID: {userIdRef.current?.substring(0, 8)}... | {JSON.stringify(debugInfo)}
              </div>
            )}
          </div>

          <button 
            onClick={() => setShowMemberArea(true)}
            className="p-2 hover:bg-orange-100 rounded-full transition-colors relative group"
          >
            <Settings className="w-5 h-5 text-orange-500" />
            <span className="absolute top-full right-0 mt-2 whitespace-nowrap bg-[#1e3a8a] text-white text-[10px] py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">המרחב האישי שלי</span>
          </button>
          
          <div className={cn(
            "hidden md:flex items-center gap-2 px-4 py-2 rounded-full text-sm font-mono",
            timeLeft < 300 ? "bg-red-50 text-red-600 border border-red-100" : "bg-[#f5f2ed] text-[#5A5A40]"
          )}>
            <Clock className="w-4 h-4" />
            {formatTime(timeLeft)}
          </div>
        </div>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 max-w-4xl mx-auto w-full">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={cn(
                "flex w-full",
                msg.role === 'user' ? "justify-end" : "justify-start"
              )}
            >
              <div className={cn(
                "max-w-[85%] p-4 rounded-2xl shadow-sm relative group",
                msg.role === 'user' 
                  ? "bg-orange-100 text-orange-900 rounded-tr-none border border-orange-200/50" 
                  : "bg-white text-[#1a1a1a] rounded-tl-none border border-orange-100"
              )}>
                <div className="flex items-center gap-2 mb-1 opacity-50 text-[10px] uppercase tracking-wider font-mono">
                  {msg.role === 'user' ? <User className="w-3 h-3" /> : <div className="w-3 h-3"><Logo /></div>}
                  {msg.role === 'user' ? 'אני' : 'Syncca'}
                </div>
                <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-p:my-1 text-inherit">
                  <Markdown
                    components={{
                      p: ({ children }) => <p>{renderContentWithConcepts(children)}</p>,
                      li: ({ children }) => <li>{renderContentWithConcepts(children)}</li>,
                      strong: ({ children }) => <strong>{renderContentWithConcepts(children)}</strong>,
                      em: ({ children }) => <em>{renderContentWithConcepts(children)}</em>,
                    }}
                  >
                    {msg.content}
                  </Markdown>
                </div>
                <div className="text-[9px] mt-2 opacity-40 text-left">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="bg-blue-50 p-4 rounded-2xl rounded-tl-none flex flex-col gap-2 border border-blue-100/50">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-blue-900 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 bg-blue-900 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 bg-blue-900 rounded-full animate-bounce"></span>
              </div>
              <span className="text-[10px] text-blue-900 font-mono animate-pulse">
                {messages.filter(m => m.role === 'assistant').length <= 1 
                  ? "רגע, מתארגנת על עצמי..." 
                  : "קלטתי ותיכף אענה לך"}
              </span>
            </div>
          </motion.div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Saved Concepts Section */}
      <AnimatePresence>
        {savedConcepts.length > 0 && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-white border-t border-[#e5e1da] overflow-hidden"
          >
            <div className="max-w-4xl mx-auto p-4">
              <div className="flex items-center gap-2 mb-3 text-[10px] text-[#5A5A40] uppercase tracking-widest font-mono font-bold">
                <Bookmark className="w-3 h-3" />
                מושגים ששמרת
              </div>
              <div className="flex flex-wrap gap-2">
                {savedConcepts.map((concept) => (
                  <motion.div 
                    layout
                    key={concept.id}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    onClick={() => setSelectedConcept(concept)}
                    className="group relative bg-blue-50 border border-blue-100 rounded-full px-4 py-1.5 flex items-center gap-2 pr-8 cursor-pointer hover:bg-blue-100 transition-colors"
                  >
                    <span className="text-xs font-medium text-[#1a1a1a]">{concept.hebrew_term || concept.term}</span>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSaveConcept(concept);
                      }}
                      className="absolute left-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-blue-200 rounded-full"
                    >
                      <X className="w-3 h-3 text-blue-400" />
                    </button>
                    
                    {/* Desktop Tooltip for saved concept */}
                    <div className="hidden md:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-white text-[#1a1a1a] text-xs rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible pointer-events-none z-50 border border-blue-200 leading-relaxed whitespace-normal">
                      <strong className="block mb-1 text-blue-900 font-bold">{concept.hebrew_term || concept.term}</strong>
                      <span className="text-blue-700 block">{concept.definition || concept.definition_he || concept.definition_en || 'אין הגדרה זמינה'}</span>
                      <span className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-white"></span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Input Area */}
      <footer className="p-4 md:p-6 bg-white border-t border-[#e5e1da]">
        <div className="max-w-4xl mx-auto">
          <form 
            onSubmit={handleSend}
            className="relative flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="כתבו כאן..."
              disabled={isLoading || timeLeft <= 0}
              className="flex-1 bg-[#f5f2ed] border-none rounded-full py-4 px-6 focus:ring-2 focus:ring-[#5A5A40] transition-all outline-none text-[#1a1a1a] placeholder:text-gray-400"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading || timeLeft <= 0}
              className="bg-[#5A5A40] hover:bg-[#4a4a35] disabled:opacity-50 disabled:hover:bg-[#5A5A40] text-white p-4 rounded-full transition-all shadow-md active:scale-95"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
          <div className="mt-3 flex items-center justify-center gap-4 text-[10px] text-gray-400 uppercase tracking-widest font-mono">
            <span className="flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> מרחב בטוח</span>
            <span className="flex items-center gap-1"><RefreshCcw className="w-3 h-3" /> הקשבה פעילה</span>
          </div>
        </div>
      </footer>
    </div>

      {/* Member Area Modal */}
      <AnimatePresence>
        {showMemberArea && (
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[70] flex items-center justify-center p-4"
            onClick={() => setShowMemberArea(false)}
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl max-h-[90vh] rounded-[32px] shadow-2xl overflow-hidden flex flex-col relative"
              onClick={(e) => e.stopPropagation()}
            >
              <header className="p-6 border-b border-blue-100 flex items-center justify-between bg-blue-50/30">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="text-blue-900 w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-serif text-[#1e3a8a]">
                      {currentUser?.name && currentUser.name !== 'משתמש' ? `המרחב של ${currentUser.name}` : 'המרחב האישי שלי'}
                    </h3>
                    <p className="text-xs text-blue-700 font-mono">{currentUser?.username}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowMemberArea(false)}
                  className="p-2 hover:bg-blue-100 rounded-full transition-colors"
                >
                  <X className="w-5 h-5 text-blue-400" />
                </button>
              </header>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* My Terms */}
                <section>
                  <div className="flex items-center gap-2 mb-4 text-xs font-mono uppercase tracking-widest text-blue-900 font-bold">
                    <Bookmark className="w-4 h-4" />
                    מילון המושגים שלי
                  </div>
                  {savedConcepts.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {savedConcepts.map(concept => (
                        <div 
                          key={concept.id}
                          onClick={() => setSelectedConcept(concept)}
                          className="bg-blue-50 border border-blue-100 rounded-full px-4 py-2 text-sm font-medium text-blue-900 cursor-pointer hover:bg-blue-100 hover:border-blue-200 transition-all"
                        >
                          {concept.hebrew_term || concept.term}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-blue-400 text-sm italic">טרם שמרת מושגים בשיחה זו.</p>
                  )}
                </section>

                {/* Personal Details */}
                <section className="grid md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-4 text-xs font-mono uppercase tracking-widest text-blue-900 font-bold">
                      <User className="w-4 h-4" />
                      שם מלא
                    </div>
                    <input 
                      type="text"
                      value={userFullName}
                      onChange={(e) => setUserFullName(e.target.value)}
                      onBlur={() => updateUserField('fullName', userFullName)}
                      placeholder="השם המלא שלך..."
                      className="w-full bg-blue-50 border-none rounded-2xl p-4 text-sm text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-4 text-xs font-mono uppercase tracking-widest text-blue-900 font-bold">
                      <User className="w-4 h-4" />
                      שם פרטי
                    </div>
                    <input 
                      type="text"
                      value={userFirstName}
                      onChange={(e) => setUserFirstName(e.target.value)}
                      onBlur={() => {
                        updateUserField('firstName', userFirstName);
                        setCurrentUser(prev => prev ? { ...prev, name: userFirstName } : null);
                      }}
                      placeholder="השם הפרטי שלך..."
                      className="w-full bg-blue-50 border-none rounded-2xl p-4 text-sm text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </section>

                <section className="grid md:grid-cols-3 gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-4 text-xs font-mono uppercase tracking-widest text-blue-900 font-bold">
                      <Heart className="w-4 h-4" />
                      מצב משפחתי
                    </div>
                    <input 
                      type="text"
                      value={userMaritalStatus}
                      onChange={(e) => setUserMaritalStatus(e.target.value)}
                      onBlur={() => updateUserField('maritalStatus', userMaritalStatus)}
                      placeholder="למשל: נשוי/אה, בזוגיות..."
                      className="w-full bg-blue-50 border-none rounded-2xl p-4 text-sm text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-4 text-xs font-mono uppercase tracking-widest text-blue-900 font-bold">
                      <Activity className="w-4 h-4" />
                      טווח גילאים
                    </div>
                    <select 
                      value={userAgeRange}
                      onChange={(e) => {
                        setUserAgeRange(e.target.value);
                        updateUserField('ageRange', e.target.value);
                      }}
                      className="w-full bg-blue-50 border-none rounded-2xl p-4 text-sm text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                    >
                      <option value="">בחר טווח גילאים...</option>
                      <option value="18-25">18-25</option>
                      <option value="26-35">26-35</option>
                      <option value="36-45">36-45</option>
                      <option value="46-60">46-60</option>
                      <option value="60+">60+</option>
                    </select>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-4 text-xs font-mono uppercase tracking-widest text-blue-900 font-bold">
                      <User className="w-4 h-4" />
                      מגדר
                    </div>
                    <select 
                      value={userGender}
                      onChange={(e) => {
                        setUserGender(e.target.value);
                        updateUserField('gender', e.target.value);
                      }}
                      className="w-full bg-blue-50 border-none rounded-2xl p-4 text-sm text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                    >
                      <option value="">בחר מגדר...</option>
                      <option value="זכר">זכר</option>
                      <option value="נקבה">נקבה</option>
                      <option value="אחר">אחר</option>
                    </select>
                  </div>
                </section>

                {/* My Insights & Intention */}
                <section className="grid md:grid-cols-2 gap-6">
                  <div>
                    <div className="flex items-center gap-2 mb-4 text-xs font-mono uppercase tracking-widest text-blue-900 font-bold">
                      <PenTool className="w-4 h-4" />
                      התכוונות (מטרה)
                    </div>
                    <textarea 
                      value={userIntention}
                      onChange={(e) => setUserIntention(e.target.value)}
                      onBlur={() => updateUserField('intention', userIntention)}
                      placeholder="מה המטרה שחשובה לך לעבוד עליה?"
                      className="w-full bg-blue-50 border-none rounded-2xl p-4 text-sm text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none leading-relaxed"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-4 text-xs font-mono uppercase tracking-widest text-blue-900 font-bold">
                      <Sparkles className="w-4 h-4" />
                      תובנות שלי
                    </div>
                    <textarea 
                      value={userInsights}
                      onChange={(e) => setUserInsights(e.target.value)}
                      onBlur={() => updateUserField('insights', userInsights)}
                      placeholder="מה גילית על עצמך היום?"
                      className="w-full bg-blue-50 border-none rounded-2xl p-4 text-sm text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none h-32 resize-none leading-relaxed"
                    />
                  </div>
                </section>

                {/* My Voice (Feedback) */}
                <section>
                  <div className="flex items-center gap-2 mb-4 text-xs font-mono uppercase tracking-widest text-blue-900 font-bold">
                    <MessageSquare className="w-4 h-4" />
                    הקול שלי (פידבק)
                  </div>
                  <textarea 
                    value={userFeedback}
                    onChange={(e) => setUserFeedback(e.target.value)}
                    onBlur={() => updateUserField('feedback', userFeedback)}
                    placeholder="נשמח לשמוע הצעות לשיפור או פידבק על החוויה שלך..."
                    className="w-full bg-blue-50 border-none rounded-2xl p-4 text-sm text-blue-900 focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none leading-relaxed"
                  />
                </section>
              </div>

              <footer className="p-6 border-t border-blue-100 bg-blue-50/50 flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <div className="text-[10px] text-blue-400 font-mono uppercase tracking-wider">
                    Syncca Beta v1.1 • {lexicon.length} Concepts Loaded • Sync: {lastSyncStatus}
                  </div>
                  <button 
                    onClick={() => window.location.reload()}
                    className="flex items-center gap-2 text-xs text-red-400 hover:text-red-500 transition-colors font-medium"
                  >
                    <LogOut className="w-4 h-4" />
                    יציאה מהחשבון
                  </button>
                </div>
                {lexicon.length === 0 && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-[10px] text-red-600 font-mono text-center">
                    שגיאה: המילון לא נטען. אנא וודאו ש-Airtable מוגדר כראוי ב-Vercel.
                  </div>
                )}
              </footer>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {selectedConcept && (
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-[60] flex items-end md:items-center justify-center p-0 md:p-4"
            onClick={() => setSelectedConcept(null)}
          >
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-white w-full md:max-w-lg rounded-t-[32px] md:rounded-[32px] p-6 md:p-8 shadow-2xl relative"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Handle for mobile bottom sheet */}
              <div className="w-12 h-1.5 bg-blue-200 rounded-full mx-auto mb-6 md:hidden"></div>
              
              <button 
                onClick={() => setSelectedConcept(null)}
                className="absolute left-4 top-4 md:left-6 md:top-6 p-2 hover:bg-blue-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-blue-400" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                  <Bookmark className="w-5 h-5 text-blue-900" />
                </div>
                <h3 className="text-2xl font-serif text-[#1a1a1a]">{selectedConcept.hebrew_term || selectedConcept.term}</h3>
              </div>

              <div className="space-y-4 mb-8 text-right">
                <p className="text-blue-900 leading-relaxed text-lg whitespace-pre-wrap">
                  {selectedConcept.preferredDefinition || selectedConcept.definition || selectedConcept.definition_he || selectedConcept.definition_en || 'אין הגדרה זמינה למושג זה כרגע.'}
                </p>
                {selectedConcept.category && (
                  <div className="inline-block px-3 py-1 bg-blue-100 text-blue-900 text-xs rounded-full uppercase tracking-wider font-mono">
                    {selectedConcept.category}
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  toggleSaveConcept(selectedConcept);
                  setSelectedConcept(null);
                }}
                className={cn(
                  "w-full py-4 rounded-full font-medium transition-all flex items-center justify-center gap-2 shadow-md active:scale-95",
                  savedConcepts.some(c => c.id === selectedConcept.id)
                    ? "bg-blue-100 text-blue-900 hover:bg-blue-200"
                    : "bg-blue-900 text-white hover:bg-blue-950"
                )}
              >
                {savedConcepts.some(c => c.id === selectedConcept.id) ? (
                  <>
                    <X className="w-5 h-5" />
                    הסרה מהמושגים שלי
                  </>
                ) : (
                  <>
                    <Bookmark className="w-5 h-5" />
                    שמירה לארגז הכלים שלי
                  </>
                )}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Beta Welcome Modal */}
      <AnimatePresence>
        {showBetaWelcome && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden relative p-8 md:p-12 text-center"
            >
              <div className="w-24 h-24 flex items-center justify-center mx-auto mb-8">
                <Logo />
              </div>
              
              <h2 className="text-3xl font-serif text-[#1e3a8a] mb-4">ברוכים הבאים ל-<span className="text-blue-900 font-bold">Syncca</span></h2>
              <p className="text-blue-700 font-mono text-xs uppercase tracking-[0.3em] mb-8">Conscious Love • Pilot Phase</p>
              
              <div className="space-y-6 text-right mb-10">
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-900 font-serif">1</div>
                  <p className="text-blue-900 leading-relaxed">
                    המערכת מבוססת על מודל בינה מלאכותית שאומן עם מתודולוגיה של תקשורת בין אישית וזוגית שפותח במשך עשרים שנים.
                  </p>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-900 font-serif">2</div>
                  <p className="text-blue-900 leading-relaxed">
                    כל שיחה מוגבלת ל-**30 דקות**. זהו זמן המיועד להתבוננות ממוקדת ולעידוד חשיבה עצמאית.
                  </p>
                </div>
                
                <div className="flex gap-4">
                  <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-900 font-serif">3</div>
                  <p className="text-blue-900 leading-relaxed">
                    הפידבק שלך עוזר לנו לצמוח. בסיום השיחה, נשמח לשמוע מה היית מציע/ה להוסיף, להוריד או לשנות ב-Syncca.
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  localStorage.setItem('syncca_beta_welcome_seen', 'true');
                  setShowBetaWelcome(false);
                }}
                className="w-full bg-blue-900 hover:bg-blue-950 text-white py-5 rounded-full font-medium transition-all shadow-lg active:scale-95 text-lg"
              >
                הבנתי, בואו נתחיל
              </button>
              
              <p className="mt-6 text-[10px] text-blue-400 uppercase tracking-widest font-mono">
                Safe • Private • Conscious
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Time Warning & Feedback Overlay */}
      {timeLeft <= 0 && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[110] flex items-center justify-center p-4 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-[40px] p-8 md:p-12 max-w-lg w-full text-center shadow-2xl border border-blue-100"
          >
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="w-8 h-8 text-blue-900" />
            </div>
            
            <h3 className="text-3xl font-serif mb-4 text-[#1a1a1a]">זמן השיחה הסתיים</h3>
            <p className="text-blue-700 mb-8 leading-relaxed">
              הזמן המיועד להתבוננות ממוקדת הסתיים, וזהו רגע טוב לעצור ולעודד חשיבה עצמאית על הדברים שעלו.
            </p>
            
            <div className="bg-blue-50 rounded-3xl p-6 mb-8 text-right border border-blue-100">
              <label className="block text-sm font-serif mb-3 text-blue-900">
                לפני שנפרדים, מה היית מציע/ה להוסיף, להוריד או לשנות ב-Syncca?
              </label>
              <textarea
                value={feedbackInput}
                onChange={(e) => setFeedbackInput(e.target.value)}
                placeholder="הפידבק שלך עוזר לנו לצמוח..."
                className="w-full bg-white border border-blue-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all min-h-[120px] resize-none"
              />
            </div>

            <div className="flex flex-col gap-3">
              <button 
                onClick={submitFeedback}
                disabled={isSubmittingFeedback || !feedbackInput.trim()}
                className="w-full bg-blue-900 text-white py-4 rounded-full font-medium shadow-lg hover:bg-blue-950 transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100"
              >
                {isSubmittingFeedback ? 'שולח...' : 'שליחת פידבק וסיום'}
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="w-full text-blue-400 py-2 text-sm hover:text-blue-600 transition-colors"
              >
                דלג/י והתחל שיחה חדשה
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
