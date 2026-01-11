import React, { useState } from 'react';
import { Draft } from '../types';
import { X, Clock, Trash2, FileText, Search } from 'lucide-react';

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
  drafts: Draft[];
  onSelectDraft: (content: string) => void;
}

const HistorySidebar: React.FC<HistorySidebarProps> = ({ isOpen, onClose, drafts, onSelectDraft }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredDraft, setHoveredDraft] = useState<Draft | null>(null);

  // Determine formatting for date
  const formatDate = (timestamp: number) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(new Date(timestamp));
  };

  const filteredDrafts = drafts.filter(draft => 
    draft.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (draft.snippet && draft.snippet.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <>
      <div 
        className={`fixed inset-y-0 right-0 w-80 bg-white dark:bg-zinc-900 shadow-2xl transform transition-transform duration-300 ease-in-out z-50 flex flex-col border-l border-gray-200 dark:border-zinc-800 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="p-5 border-b border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2 text-lg font-semibold text-gray-800 dark:text-gray-100">
              <Clock className="w-5 h-5" />
              <h2>History</h2>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text"
              placeholder="Search history..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-sm text-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filteredDrafts.length === 0 ? (
            <div className="text-center text-gray-400 mt-10">
              <p>No matches found.</p>
              {drafts.length === 0 && <p className="text-xs mt-2">Drafts are saved automatically.</p>}
            </div>
          ) : (
            filteredDrafts.map((draft) => (
              <button
                key={draft.id}
                onClick={() => onSelectDraft(draft.content)}
                onMouseEnter={() => setHoveredDraft(draft)}
                onMouseLeave={() => setHoveredDraft(null)}
                className="w-full text-left group p-4 rounded-xl bg-gray-50 dark:bg-zinc-800/50 border border-transparent hover:border-gray-300 dark:hover:border-zinc-600 hover:shadow-sm transition-all duration-200"
              >
                <div className="flex justify-between items-start mb-1">
                   <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    {formatDate(draft.lastUpdated)}
                   </span>
                </div>
                <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-3 leading-relaxed font-serif">
                  {draft.snippet || "Empty note"}
                </p>
                <div className="mt-3 flex items-center text-xs text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  <FileText className="w-3 h-3 mr-1" />
                  Load this version
                </div>
              </button>
            ))
          )}
        </div>
        
        <div className="p-4 border-t border-gray-100 dark:border-zinc-800 text-xs text-center text-gray-400">
          Drafts expire after 14 days
        </div>
      </div>

      {/* Hover Preview Portal/Overlay */}
      {isOpen && hoveredDraft && (
        <div className="fixed right-80 top-0 bottom-0 flex items-center pr-4 pointer-events-none z-[60] w-[400px]">
          <div className="bg-white dark:bg-zinc-800 p-6 rounded-xl shadow-2xl border border-gray-100 dark:border-zinc-700 w-full max-h-[80vh] overflow-y-auto animate-in fade-in slide-in-from-right-4 duration-200">
             <div className="mb-2 text-xs font-medium text-gray-400 uppercase tracking-wider flex justify-between">
                <span>Preview</span>
                <span>{formatDate(hoveredDraft.lastUpdated)}</span>
             </div>
             <div className="prose dark:prose-invert prose-sm max-w-none text-gray-700 dark:text-gray-300 font-serif whitespace-pre-wrap">
                {hoveredDraft.content}
             </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HistorySidebar;
