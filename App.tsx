import React, { useState, useEffect, useRef } from 'react';
import { 
  History, 
  Sun, 
  Moon, 
  Type,
  Download
} from 'lucide-react';
import { cleanupOldDrafts, createNewSessionId, getDrafts, saveDraft } from './services/storage';
import HistorySidebar from './components/HistorySidebar';
import { Draft } from './types';
import { EditorFont } from './constants';

function App() {
  // State
  const [text, setText] = useState('');
  const [sessionId, setSessionId] = useState<string>('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [font, setFont] = useState<EditorFont>(EditorFont.SERIF);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Initialization
  useEffect(() => {
    // 1. Cleanup old drafts
    cleanupOldDrafts();

    // 2. Create a FRESH session ID for this tab
    setSessionId(createNewSessionId());

    // 3. Check system preference for dark mode
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDarkMode(true);
    }
  }, []);

  // Dark Mode Effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Auto-save logic (Debounced)
  useEffect(() => {
    if (!sessionId) return;
    if (text.trim() === '') return; 

    setSaveStatus('saving');
    const timer = setTimeout(() => {
      saveDraft(sessionId, text);
      setSaveStatus('saved');
      
      // Brief delay to return to idle
      setTimeout(() => setSaveStatus('idle'), 2000);
    }, 1000);

    return () => clearTimeout(timer);
  }, [text, sessionId]);

  // Handlers
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const refreshDrafts = () => {
    setDrafts(getDrafts());
  };

  const handleOpenHistory = () => {
    refreshDrafts();
    setIsHistoryOpen(true);
  };

  const handleSelectDraft = (content: string) => {
    // Load the old draft into the CURRENT session
    // NOTE: This overwrites the current viewport but keeps the sessionId (or we could branch)
    // User request: "history in case I want to revisit". 
    // Let's overwrite current view.
    setText(content);
    setIsHistoryOpen(false);
  };

  const toggleFont = () => {
    if (font === EditorFont.SERIF) setFont(EditorFont.SANS);
    else if (font === EditorFont.SANS) setFont(EditorFont.MONO);
    else setFont(EditorFont.SERIF);
  };

  const handleDownload = () => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `draft-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`min-h-screen w-full flex flex-col relative ${font}`}>
      
      {/* Controls - Floating or Fixed Top Right */}
      <div className="fixed top-4 right-6 z-40 flex items-center gap-3 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm p-2 rounded-full shadow-sm border border-gray-200 dark:border-zinc-800 transition-opacity duration-300 opacity-40 hover:opacity-100">
        
        <div className="text-xs text-gray-400 font-sans mr-2 select-none">
            {saveStatus === 'saving' && 'Saving...'}
            {saveStatus === 'saved' && 'Saved'}
        </div>

        <div className="h-4 w-px bg-gray-300 dark:bg-zinc-700" />

        <button 
          onClick={toggleFont}
          className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400 rounded-full transition-colors"
          title="Toggle Font"
        >
          <Type className="w-4 h-4" />
        </button>

        <button 
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400 rounded-full transition-colors"
          title="Toggle Theme"
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button 
          onClick={handleDownload}
          className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400 rounded-full transition-colors"
          title="Download Text"
        >
          <Download className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-gray-300 dark:bg-zinc-700" />

        <button 
          onClick={handleOpenHistory}
          className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400 rounded-full transition-colors"
          title="History"
        >
          <History className="w-4 h-4" />
        </button>
      </div>

      {/* Main Writing Area */}
      <main className="flex-grow relative">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          placeholder="Start writing..."
          className={`
            w-full h-screen resize-none outline-none border-none p-8 md:p-16 lg:px-32 lg:py-20 
            bg-transparent text-lg md:text-xl leading-relaxed 
            placeholder:text-gray-300 dark:placeholder:text-zinc-700
            text-ink dark:text-zinc-300
            ${font}
          `}
          spellCheck={false}
          autoFocus
        />
      </main>

      {/* Components */}
      <HistorySidebar 
        isOpen={isHistoryOpen} 
        onClose={() => setIsHistoryOpen(false)} 
        drafts={drafts}
        onSelectDraft={handleSelectDraft}
      />
    </div>
  );
}

export default App;