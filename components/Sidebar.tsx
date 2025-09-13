import React, { useState, useRef, useEffect } from 'react';
import { ChatSession } from '../types';
import { PlusIcon, MoreVertIcon, PinIcon, EditIcon, DeleteIcon } from './Icons';
import RenameModal from './RenameModal';
import DeleteConfirmModal from './DeleteConfirmModal';

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onDeleteSession: (id: string) => void;
  onPinSession: (id: string, isPinned: boolean) => void;
}

const SessionItem: React.FC<{
  session: ChatSession;
  isActive: boolean;
  onSelect: (id: string) => void;
  onOpenRenameModal: (session: ChatSession) => void;
  onOpenDeleteModal: (session: ChatSession) => void;
  onPin: (id: string, isPinned: boolean) => void;
}> = ({ session, isActive, onSelect, onOpenRenameModal, onOpenDeleteModal, onPin }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    const handleRenameClick = () => {
        onOpenRenameModal(session);
        setIsMenuOpen(false);
    };

    const handleDeleteClick = () => {
        onOpenDeleteModal(session);
        setIsMenuOpen(false);
    };
    
    const handlePinClick = () => {
        onPin(session.id, !session.isPinned);
        setIsMenuOpen(false);
    };

    return (
        <div className={`group flex items-center rounded-lg transition-colors duration-200 ${isActive ? 'bg-secondary-focus' : 'hover:bg-secondary'}`}>
            <a
                href="#"
                onClick={(e) => { e.preventDefault(); onSelect(session.id); }}
                className="flex-1 p-3 text-sm truncate"
            >
                <span className="flex-1 truncate">{session.title}</span>
            </a>
            <div className="relative" ref={menuRef}>
                <button
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className="p-1 rounded-full text-text-secondary opacity-0 group-hover:opacity-100 focus:opacity-100 hover:bg-surface mr-2"
                    aria-label="セッションオプション"
                >
                    <MoreVertIcon className="w-5 h-5" />
                </button>
                {isMenuOpen && (
                    <div className="absolute right-0 top-full mt-1 w-max bg-secondary rounded-lg shadow-xl z-10 py-1 animate-fade-in">
                        <button onClick={handlePinClick} className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-secondary-focus">
                            <PinIcon className="w-4 h-4" />
                            {session.isPinned ? '固定を解除' : '固定'}
                        </button>
                        <button onClick={handleRenameClick} className="w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-secondary-focus">
                            <EditIcon className="w-4 h-4" />
                            名前を変更
                        </button>
                        <button onClick={handleDeleteClick} className="w-full text-left px-4 py-2 text-sm text-red-400 flex items-center gap-2 hover:bg-secondary-focus">
                            <DeleteIcon className="w-4 h-4" />
                            削除
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const Sidebar: React.FC<SidebarProps> = ({ sessions, activeSessionId, onNewChat, onSelectSession, onRenameSession, onDeleteSession, onPinSession }) => {
  const [renameModalState, setRenameModalState] = useState<{ isOpen: boolean; session: ChatSession | null }>({ isOpen: false, session: null });
  const [deleteModalState, setDeleteModalState] = useState<{ isOpen: boolean; session: ChatSession | null }>({ isOpen: false, session: null });

  const pinnedSessions = sessions.filter(s => s.isPinned).sort((a, b) => a.title.localeCompare(b.title));
  const recentSessions = sessions.filter(s => !s.isPinned);

  const handleOpenRenameModal = (session: ChatSession) => {
    setRenameModalState({ isOpen: true, session });
  };

  const handleCloseRenameModal = () => {
    setRenameModalState({ isOpen: false, session: null });
  };

  const handleRename = (newTitle: string) => {
    if (renameModalState.session) {
        onRenameSession(renameModalState.session.id, newTitle);
    }
    handleCloseRenameModal();
  };

  const handleOpenDeleteModal = (session: ChatSession) => {
    setDeleteModalState({ isOpen: true, session });
  };

  const handleCloseDeleteModal = () => {
    setDeleteModalState({ isOpen: false, session: null });
  };

  const handleDeleteConfirm = () => {
    if (deleteModalState.session) {
        onDeleteSession(deleteModalState.session.id);
    }
    handleCloseDeleteModal();
  };


  const renderSessionList = (sessionList: ChatSession[]) => {
      return sessionList.map((session) => (
          <SessionItem
            key={session.id}
            session={session}
            isActive={activeSessionId === session.id}
            onSelect={onSelectSession}
            onOpenRenameModal={handleOpenRenameModal}
            onOpenDeleteModal={handleOpenDeleteModal}
            onPin={onPinSession}
          />
      ));
  };

  return (
    <>
      <aside className="w-64 bg-surface flex flex-col h-full p-2 text-text-primary no-scrollbar">
        <div className="flex-shrink-0 p-2">
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-between p-3 rounded-lg bg-secondary text-text-primary hover:bg-secondary-focus transition-colors duration-200"
          >
            <span className="font-semibold">チャットを新規作成</span>
            <PlusIcon className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto mt-4 space-y-1 no-scrollbar">
          {pinnedSessions.length > 0 && (
              <div className="mb-4">
                  <p className="px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">固定済み</p>
                  {renderSessionList(pinnedSessions)}
              </div>
          )}
          <p className="px-3 text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">最近</p>
          {sessions.length > 0 ? renderSessionList(recentSessions) : (
            <p className="px-3 text-sm text-text-secondary">まだチャットがありません。</p>
          )}
        </nav>
      </aside>
      <RenameModal 
        isOpen={renameModalState.isOpen}
        onClose={handleCloseRenameModal}
        onRename={handleRename}
        currentTitle={renameModalState.session?.title || ''}
      />
      <DeleteConfirmModal
        isOpen={deleteModalState.isOpen}
        onClose={handleCloseDeleteModal}
        onConfirm={handleDeleteConfirm}
        sessionTitle={deleteModalState.session?.title || ''}
      />
    </>
  );
};

export default Sidebar;