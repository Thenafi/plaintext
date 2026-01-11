import React, { useState, useEffect, useRef } from 'react';
import { 
  History, 
  Sun, 
  Moon, 
  Type,
  Download,
  Info,
  X
} from 'lucide-react';
import { cleanupOldDrafts, createNewSessionId, getDrafts, saveDraft, getRetentionPeriod, setRetentionPeriod } from './services/storage';
import HistorySidebar from './components/HistorySidebar';
import { Draft } from './types';
import { EditorFont } from './constants';

function App() {
  // State
  const [text, setText] = useState('');
  const [sessionId, setSessionId] = useState<string>('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [font, setFont] = useState<EditorFont>(EditorFont.SANS);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  const [retentionDays, setRetentionDays] = useState(14);

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

    // 4. Load retention settings
    const ms = getRetentionPeriod();
    setRetentionDays(Math.floor(ms / (24 * 60 * 60 * 1000)));
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

  const handleRetentionChange = (days: number) => {
    setRetentionDays(days);
    setRetentionPeriod(days * 24 * 60 * 60 * 1000);
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
          onClick={() => setIsInfoOpen(true)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400 rounded-full transition-colors"
          title="About"
        >
          <Info className="w-4 h-4" />
        </button>

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

      {/* Info Modal */}
      {isInfoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 relative animate-in fade-in zoom-in duration-200">
            <button 
              onClick={() => setIsInfoOpen(false)}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full text-gray-400 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white font-sans">About ZenDraft</h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-300 text-sm leading-relaxed font-sans">
              <p>
                ZenDraft is a minimalist, distraction-free writing environment designed to help you focus on your thoughts.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Auto-Save:</strong> Your work is automatically saved to your browser's local storage as you type.</li>
                <li><strong>Privacy First:</strong> No data leaves your device. Everything stays local.</li>
                <li><strong>Draft History:</strong> Access previous sessions via the history button. Drafts are kept for {retentionDays} days.</li>
                <li><strong>Customizable:</strong> Toggle between Serif, Sans-Serif, and Monospace fonts, and Light/Dark modes.</li>
              </ul>

              <div className="pt-4 border-t border-gray-100 dark:border-zinc-800">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Draft Retention Period
                </label>
                <select 
                  value={retentionDays}
                  onChange={(e) => handleRetentionChange(Number(e.target.value))}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-gray-200 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value={1}>1 Day</option>
                  <option value={3}>3 Days</option>
                  <option value={7}>7 Days</option>
                  <option value={14}>14 Days (Default)</option>
                  <option value={30}>30 Days</option>
                  <option value={90}>90 Days</option>
                  <option value={365}>1 Year</option>
                </select>
                <p className="text-xs text-gray-400 mt-2">
                  Expired drafts are automatically removed when you open the app.
                </p>
              </div>
              <p className="pt-2 text-xs text-gray-400">
                v1.0.0 &bull; Local Storage &bull; No Cloud Sync
              </p>
            </div>
          </div>
        </div>
      )}

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