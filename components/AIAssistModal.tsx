import React, { useState } from 'react';
import { Sparkles, Loader2, X } from 'lucide-react';
import { enhanceText } from '../services/gemini';

interface AIAssistModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentText: string;
  onApply: (newText: string) => void;
}

const AIAssistModal: React.FC<AIAssistModalProps> = ({ isOpen, onClose, currentText, onApply }) => {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleEnhance = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setError(null);

    try {
      // If the text is very long, we might only send the last chunk for context, 
      // but for now, we assume reasonable draft size for the model.
      const result = await enhanceText(currentText, prompt);
      onApply(result);
      onClose();
      setPrompt('');
    } catch (err) {
      setError("Failed to generate content. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-md border border-gray-100 dark:border-zinc-700 overflow-hidden">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-500" />
              AI Assistant
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Ask Gemini to proofread, expand, or finish your thought.
          </p>

          <div className="space-y-3">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., 'Fix grammar', 'Continue this story', 'Summarize this'"
              className="w-full p-3 rounded-lg border border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-800 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none h-24 text-sm"
              autoFocus
            />

            {error && <p className="text-xs text-red-500">{error}</p>}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleEnhance}
              disabled={isLoading || !prompt.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Thinking...
                </>
              ) : (
                'Generate'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistModal;
