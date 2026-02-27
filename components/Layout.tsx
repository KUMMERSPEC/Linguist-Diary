
import React, { useState } from 'react';
import { ViewState } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeView: ViewState;
  onViewChange: (view: ViewState, vocabId?: string) => void;
  user: { displayName?: string | null, photoURL?: string | null };
  onLogout: () => void;
  isMenuOpen: boolean;
  setIsMenuOpen: (open: boolean) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, onViewChange, user, onLogout, isMenuOpen, setIsMenuOpen }) => {
  const getNavLinkClass = (viewName: ViewState | ViewState[]) => {
    const isActive = Array.isArray(viewName)
      ? viewName.includes(activeView)
      : activeView === viewName;
    return `flex items-center space-x-3 px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all group ${
      isActive
        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100'
        : 'text-slate-500 hover:bg-slate-50'
    }`;
  };

  const NavItem = ({ view, label, icon }: { view: ViewState | ViewState[]; label: string; icon: string }) => (
    <button onClick={() => {
      onViewChange(Array.isArray(view) ? view[0] : view);
      setIsMenuOpen(false);
    }} className={getNavLinkClass(view)}>
      <span className="text-xl group-hover:scale-110 transition-transform">{icon}</span>
      <span>{label}</span>
    </button>
  );

  const MobileTab = ({ views, label, icon, activeIcon }: { views: ViewState | ViewState[]; label: string; icon: string; activeIcon: string }) => {
    const isActive = Array.isArray(views) ? views.includes(activeView) : activeView === views;
    return (
      <button 
        onClick={() => {
          onViewChange(Array.isArray(views) ? views[0] : views);
          setIsMenuOpen(false);
        }}
        className={`flex flex-col items-center justify-center flex-1 py-1 space-y-0.5 transition-all ${isActive ? 'text-indigo-600' : 'text-slate-400'}`}
      >
        <span className="text-2xl">{isActive ? activeIcon : icon}</span>
        <span className="text-[9px] font-bold uppercase tracking-widest leading-none">{label}</span>
      </button>
    );
  };

  return (
    <div className="flex w-full bg-slate-50 min-h-screen">
      {/* Desktop & Tablet Sidebar */}
      <aside className="hidden md:flex flex-col md:w-60 lg:w-64 bg-white border-r border-slate-100 p-6 shrink-0 h-screen sticky top-0 z-30">
        <div className="flex items-center space-x-3 pb-4 border-b border-slate-100">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-xl">🖋️</div>
          <h1 className="text-lg font-bold text-slate-900 serif-font">Linguist Diary</h1>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto no-scrollbar">
          <NavItem view="dashboard" label="主页 / Dashboard" icon="🏠" />
          <NavItem view="editor" label="撰写 / Editor" icon="✍️" />
          <NavItem view="chat" label="启发对话 / Guided Chat" icon="💬" />
          <NavItem view={['rehearsal', 'rehearsal_report']} label="展厅演练 / Rehearsal" icon="🎤" />
          <NavItem view={['vocab_list', 'vocab_practice', 'vocab_practice_detail']} label="珍宝与足迹 / Vocab & Practice" icon="💎" />
          <NavItem view="history" label="收藏馆 / History" icon="🏛️" />
        </nav>

        <div className="mt-auto space-y-4 pt-4 border-t border-slate-50">
          <button 
            onClick={() => onViewChange('profile')}
            className={`w-full flex items-center space-x-3 p-3 rounded-2xl border transition-all text-left group/usercard ${
              activeView === 'profile' 
                ? 'bg-indigo-50 border-indigo-200' 
                : 'bg-slate-50 border-slate-100 hover:border-indigo-200 hover:bg-white'
            }`}
          >
            <img 
              src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.displayName}`} 
              alt="User Avatar" 
              className="w-10 h-10 rounded-xl shadow-sm border border-white" 
            />
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-bold truncate transition-colors ${activeView === 'profile' ? 'text-indigo-600' : 'text-slate-700 group-hover/usercard:text-indigo-600'}`}>
                {user.displayName}
              </div>
              <div className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">首席馆长 / Curator</div>
            </div>
            <div className={`text-slate-300 transition-transform ${activeView === 'profile' ? 'translate-x-0 text-indigo-400' : 'group-hover/usercard:translate-x-1 group-hover/usercard:text-indigo-400'}`}>
              →
            </div>
          </button>
          
          <div className="text-[10px] text-slate-400 uppercase tracking-widest text-center pt-2">
            © {new Date().getFullYear()} Linguist Diary
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        <div className="flex-1 relative">
          {children}
        </div>

        {/* Overlay Backdrop for Menu - Placed here to sit between content and menu */}
        {isMenuOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 animate-in fade-in duration-300" 
            onClick={() => setIsMenuOpen(false)}
          ></div>
        )}

        {/* Mobile Bottom Navigation Bar - Optimized for Mobile Screen Bottoms */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-2 pt-2 pb-[calc(env(safe-area-inset-bottom)+8px)] flex items-center justify-around shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.12)] overflow-visible min-h-[72px] z-40">
          <MobileTab views="dashboard" label="主页" icon="🏠" activeIcon="🏠" />
          {/* Swapped: Gems moved to the left of the add button */}
          <MobileTab views={['vocab_list', 'vocab_practice', 'vocab_practice_detail']} label="珍宝" icon="💎" activeIcon="💎" />
          
          <div className="relative flex flex-col items-center justify-center flex-1 h-full overflow-visible min-w-[72px]">
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`w-14 h-14 absolute -top-8 rounded-full flex items-center justify-center shadow-2xl transition-all active:scale-90 z-50 ${isMenuOpen ? 'bg-indigo-700 text-white rotate-45' : 'bg-indigo-600 text-white'}`}
            >
              <span className="text-3xl leading-none">＋</span>
            </button>
            <span className="text-[9px] font-black uppercase tracking-widest mt-6 text-indigo-600">练习</span>
            
            {isMenuOpen && (
              <>
                <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-48 bg-white rounded-3xl shadow-2xl border border-slate-100 p-2 flex flex-col space-y-1 animate-in slide-in-from-bottom-4 zoom-in-95 z-50">
                  <button onClick={() => { onViewChange('editor'); setIsMenuOpen(false); }} className="flex items-center space-x-3 p-3 rounded-2xl hover:bg-slate-50 transition-colors text-slate-700">
                    <span className="text-lg">✍️</span>
                    <span className="text-xs font-bold">自由撰写</span>
                  </button>
                  <button onClick={() => { onViewChange('chat'); setIsMenuOpen(false); }} className="flex items-center space-x-3 p-3 rounded-2xl hover:bg-slate-50 transition-colors text-slate-700">
                    <span className="text-lg">💬</span>
                    <span className="text-xs font-bold">启发对话</span>
                  </button>
                  <button onClick={() => { onViewChange('rehearsal'); setIsMenuOpen(false); }} className="flex items-center space-x-3 p-3 rounded-2xl hover:bg-slate-50 transition-colors text-slate-700">
                    <span className="text-lg">🎤</span>
                    <span className="text-xs font-bold">展厅演练</span>
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Swapped: History moved to the right of the add button */}
          <MobileTab views="history" label="馆藏" icon="🏛️" activeIcon="🏛️" />
          <MobileTab views="profile" label="馆长" icon="👤" activeIcon="👤" />
        </div>
      </main>
    </div>
  );
};

export default Layout;
