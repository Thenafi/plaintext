import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  History, 
  Sun, 
  Moon, 
  Type,
  Download,
  Info,
  X,
  Lock,
  LockOpen,
  Shield,
} from 'lucide-react';
import { 
  cleanupOldDrafts, 
  createNewSessionId, 
  getDrafts, 
  saveDraft, 
  getDraftContent,
  getRetentionPeriod, 
  setRetentionPeriod,
  initializeCrypto,
  getEncryptionSettings,
  setEncryptionSettings,
} from './services/storage';
import { 
  isPasswordSetup, 
  verifyPassword, 
  setupPassword,
  isSessionUnlocked,
  lockSession,
} from './services/crypto';
import HistorySidebar from './components/HistorySidebar';
import PasswordModal from './components/PasswordModal';
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
  
  // Encryption state
  const [isCurrentNoteProtected, setIsCurrentNoteProtected] = useState(false);
  const [hasPassword, setHasPassword] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [passwordModalMode, setPasswordModalMode] = useState<'setup' | 'unlock'>('unlock');
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);
  const [requirePasswordOnStart, setRequirePasswordOnStart] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check session unlock status
  const checkUnlockStatus = useCallback(() => {
    setIsUnlocked(isSessionUnlocked());
  }, []);

  // Initialization
  useEffect(() => {
    const init = async () => {
      // 1. Initialize crypto (creates device key if needed)
      await initializeCrypto();
      
      // 2. Check if password is set up
      const passwordExists = await isPasswordSetup();
      setHasPassword(passwordExists);
      
      // 3. Check session status
      checkUnlockStatus();
      
      // 4. Load encryption settings
      const encSettings = getEncryptionSettings();
      setRequirePasswordOnStart(encSettings.requirePasswordOnStart);
      
      // 5. If require password on start and password exists, show modal
      if (encSettings.requirePasswordOnStart && passwordExists && !isSessionUnlocked()) {
        setPasswordModalMode('unlock');
        setIsPasswordModalOpen(true);
      }
      
      // 6. Cleanup old drafts
      await cleanupOldDrafts();

      // 7. Create a FRESH session ID for this tab
      setSessionId(createNewSessionId());

      // 8. Check system preference for dark mode
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        setIsDarkMode(true);
      }

      // 9. Load retention settings
      const ms = getRetentionPeriod();
      setRetentionDays(Math.floor(ms / (24 * 60 * 60 * 1000)));
      
      setIsInitialized(true);
    };
    
    init();
  }, [checkUnlockStatus]);

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
    if (!sessionId || !isInitialized) return;
    if (text.trim() === '') return; 

    setSaveStatus('saving');
    const timer = setTimeout(async () => {
      try {
        await saveDraft(sessionId, text, isCurrentNoteProtected);
        setSaveStatus('saved');
        
        // Brief delay to return to idle
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (error) {
        console.error('Failed to save:', error);
        setSaveStatus('idle');
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [text, sessionId, isCurrentNoteProtected, isInitialized]);

  // Handlers
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
  };

  const refreshDrafts = useCallback(async () => {
    const loadedDrafts = await getDrafts();
    setDrafts(loadedDrafts);
  }, []);

  const handleOpenHistory = async () => {
    await refreshDrafts();
    setIsHistoryOpen(true);
  };

  const handleSelectDraft = async (id: string, isProtected: boolean) => {
    try {
      const content = await getDraftContent(id, isProtected);
      if (content !== null) {
        setText(content);
        setIsCurrentNoteProtected(isProtected);
        // Create new session for the loaded draft
        setSessionId(createNewSessionId());
        setIsHistoryOpen(false);
      }
    } catch (error) {
      console.error('Failed to load draft:', error);
    }
  };

  const handleRequestUnlock = () => {
    if (hasPassword) {
      setPasswordModalMode('unlock');
    } else {
      setPasswordModalMode('setup');
    }
    setIsPasswordModalOpen(true);
  };

  const handlePasswordSuccess = () => {
    setIsPasswordModalOpen(false);
    checkUnlockStatus();
    setHasPassword(true);
    
    // Execute pending action if any
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const toggleProtection = async () => {
    if (!hasPassword) {
      // Need to set up password first
      setPasswordModalMode('setup');
      setPendingAction(() => () => setIsCurrentNoteProtected(true));
      setIsPasswordModalOpen(true);
      return;
    }
    
    if (!isUnlocked) {
      // Need to unlock first
      setPasswordModalMode('unlock');
      setPendingAction(() => () => setIsCurrentNoteProtected(!isCurrentNoteProtected));
      setIsPasswordModalOpen(true);
      return;
    }
    
    setIsCurrentNoteProtected(!isCurrentNoteProtected);
  };

  const handleLockSession = () => {
    lockSession();
    checkUnlockStatus();
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

  const handleRequirePasswordChange = (value: boolean) => {
    setRequirePasswordOnStart(value);
    setEncryptionSettings({ requirePasswordOnStart: value });
  };

  return (
    <div className={`min-h-screen w-full flex flex-col relative ${font}`}>
      <h1 className="sr-only">Pad - Minimalist Online Text Editor</h1>
      
      {/* Controls - Floating or Fixed Top Right */}
      <div className="fixed top-4 right-6 z-40 flex items-center gap-3 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm p-2 rounded-full shadow-sm border border-gray-200 dark:border-zinc-800 transition-opacity duration-300 opacity-40 hover:opacity-100">
        
        <div className="text-xs text-gray-400 font-sans mr-2 select-none flex items-center gap-2">
            {isCurrentNoteProtected && (
              <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                <Lock className="w-3 h-3" />
              </span>
            )}
            {saveStatus === 'saving' && 'Saving...'}
            {saveStatus === 'saved' && 'Saved'}
        </div>

        <div className="h-4 w-px bg-gray-300 dark:bg-zinc-700" />

        {/* Protection Toggle */}
        <button 
          onClick={toggleProtection}
          className={`p-2 rounded-full transition-colors ${
            isCurrentNoteProtected 
              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' 
              : 'hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400'
          }`}
          title={isCurrentNoteProtected ? 'Remove Protection' : 'Protect Note'}
          aria-label={isCurrentNoteProtected ? 'Remove password protection' : 'Add password protection'}
        >
          {isCurrentNoteProtected ? <Lock className="w-4 h-4" /> : <LockOpen className="w-4 h-4" />}
        </button>

        {/* Lock/Unlock Session */}
        {hasPassword && (
          <button 
            onClick={isUnlocked ? handleLockSession : handleRequestUnlock}
            className={`p-2 rounded-full transition-colors ${
              isUnlocked 
                ? 'hover:bg-gray-100 dark:hover:bg-zinc-800 text-green-600 dark:text-green-400' 
                : 'hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400'
            }`}
            title={isUnlocked ? 'Lock Session' : 'Unlock Session'}
            aria-label={isUnlocked ? 'Lock the session' : 'Unlock to view protected notes'}
          >
            <Shield className="w-4 h-4" />
          </button>
        )}

        <div className="h-4 w-px bg-gray-300 dark:bg-zinc-700" />

        <button 
          onClick={() => setIsInfoOpen(true)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400 rounded-full transition-colors"
          title="About"
          aria-label="About Pad"
        >
          <Info className="w-4 h-4" />
        </button>

        <button 
          onClick={toggleFont}
          className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400 rounded-full transition-colors"
          title="Toggle Font"
          aria-label="Toggle Font Family"
        >
          <Type className="w-4 h-4" />
        </button>

        <button 
          onClick={() => setIsDarkMode(!isDarkMode)}
          className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400 rounded-full transition-colors"
          title="Toggle Theme"
          aria-label="Toggle Dark Mode"
        >
          {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button 
          onClick={handleDownload}
          className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400 rounded-full transition-colors"
          title="Download Text"
          aria-label="Download Text File"
        >
          <Download className="w-4 h-4" />
        </button>

        <div className="h-4 w-px bg-gray-300 dark:bg-zinc-700" />

        <button 
          onClick={handleOpenHistory}
          className="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-600 dark:text-gray-400 rounded-full transition-colors"
          title="History"
          aria-label="View Draft History"
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
          <div className="bg-white dark:bg-zinc-900 w-full max-w-md p-6 rounded-2xl shadow-xl border border-gray-100 dark:border-zinc-800 relative animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <button 
              onClick={() => setIsInfoOpen(false)}
              className="absolute top-4 right-4 p-1 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-full text-gray-400 transition-colors"
              aria-label="Close Info Modal"
            >
              <X className="w-5 h-5" />
            </button>
            
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white font-sans">About Pad</h2>
            <div className="space-y-4 text-gray-600 dark:text-gray-300 text-sm leading-relaxed font-sans">
              <p>
                Pad is a minimalist, distraction-free writing environment designed to help you focus on your thoughts.
              </p>
              <ul className="list-disc pl-5 space-y-1">
                <li><strong>Auto-Save:</strong> Your work is automatically saved to your browser's local storage as you type.</li>
                <li><strong>Privacy First:</strong> No data leaves your device. Everything stays local.</li>
                <li><strong>Encryption:</strong> All notes are encrypted at rest with a device key.</li>
                <li><strong>Draft History:</strong> Access previous sessions via the history button. Drafts are kept for {retentionDays} days.</li>
                <li><strong>Customizable:</strong> Toggle between Serif, Sans-Serif, and Monospace fonts, and Light/Dark modes.</li>
              </ul>

              {/* Encryption Settings */}
              <div className="pt-4 border-t border-gray-100 dark:border-zinc-800">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Security Settings
                </h3>
                
                {hasPassword ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Password Protection</span>
                      <span className="text-xs text-green-600 dark:text-green-400 font-medium">Enabled</span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={requirePasswordOnStart}
                        onChange={(e) => handleRequirePasswordChange(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm">Require password on app start</span>
                    </label>
                    <p className="text-xs text-gray-400">
                      When enabled, you'll be prompted for your password every time you open Pad.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-500">
                      Set up a password to enable note protection.
                    </p>
                    <button
                      onClick={() => {
                        setIsInfoOpen(false);
                        setPasswordModalMode('setup');
                        setIsPasswordModalOpen(true);
                      }}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Set up password →
                    </button>
                  </div>
                )}
              </div>

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
                v1.1.0 &bull; Encrypted Local Storage &bull; No Cloud Sync
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Password Modal */}
      <PasswordModal
        isOpen={isPasswordModalOpen}
        onClose={() => {
          setIsPasswordModalOpen(false);
          setPendingAction(null);
        }}
        mode={passwordModalMode}
        onSuccess={handlePasswordSuccess}
        verifyPassword={verifyPassword}
        setupPassword={setupPassword}
      />

      {/* Components */}
      <HistorySidebar 
        isOpen={isHistoryOpen} 
        onClose={() => setIsHistoryOpen(false)} 
        drafts={drafts}
        onSelectDraft={handleSelectDraft}
        isSessionUnlocked={isUnlocked}
        onRequestUnlock={handleRequestUnlock}
      />
    </div>
  );
}

export default App;