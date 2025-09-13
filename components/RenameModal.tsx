import React, { useState, useEffect } from 'react';

interface RenameModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRename: (newTitle: string) => void;
  currentTitle: string;
}

const RenameModal: React.FC<RenameModalProps> = ({ isOpen, onClose, onRename, currentTitle }) => {
  const [title, setTitle] = useState(currentTitle);

  useEffect(() => {
    if (isOpen) {
        setTitle(currentTitle);
    }
  }, [isOpen, currentTitle]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onRename(title.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
      <div className="bg-surface rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-semibold text-text-primary mb-4">チャットの名前を変更</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-secondary text-text-primary p-2 rounded-md border border-secondary-focus focus:ring-2 focus:ring-secondary-focus focus:outline-none"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
          />
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-md bg-secondary hover:bg-secondary-focus text-text-primary font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface focus:ring-secondary-focus">
              キャンセル
            </button>
            <button type="submit" disabled={!title.trim()} className="px-4 py-2 rounded-md bg-primary hover:bg-primary-focus text-primary-content font-semibold transition-colors disabled:bg-secondary disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface focus:ring-secondary-focus">
              名前を変更
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RenameModal;