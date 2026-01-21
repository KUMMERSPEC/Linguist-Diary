
import React from 'react';
import { ViewState } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeView: ViewState;
  onViewChange: (view: ViewState) => void;
  user: { displayName?: string | null, photoURL?: string | null };
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, onViewChange, user, onLogout }) => {
  const NavItem = ({ view, label, icon }: { view: ViewState, label: string, icon: string }) => (
    <button
      onClick={() => onViewChange(view)}
      className={`flex items-center space-x-3 w-full px-4 py-2.5 rounded-xl transition-all duration-200 ${
        activeView === view 
          ? 'bg-indigo-50 text-indigo-600 shadow-sm' 
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="font-medium text-sm md:text-[13px] lg:text-sm">{label}</span>
    </button>
  );

  const isChat = activeView === 'chat';

  return (
    <div className="flex h-screen w-screen bg-slate-50 overflow-hidden relative">
      {/* Sidebar (Desktop Only) */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col hidden md:flex h-full shrink-0">
        <div className="p-6 pb-4 shrink-0">
          <div className="flex items-center space-x-3 px-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xl shadow-lg shadow-indigo-100">
              🖋️
            </div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Linguist</h1>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto no-scrollbar px-6 space-y-1.5">
          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 py-2 mt-2">Menu</div>
          <NavItem view="dashboard" label="概览 / Dashboard" icon="📊" />
          <NavItem view="editor" label="标准写信 / Standard" icon="📝" />
          <NavItem view="rehearsal" label="展厅演练 / Rehearsal" icon="🎭" />
          <NavItem view="chat" label="启发聊天 / Guided Chat" icon="💬" />
          <NavItem view="review_vault" label="珍宝复习 / Review" icon="💎" />
          <NavItem view="history" label="博物馆 / Collection" icon="🏛️" />
        </nav>

        <div className="p-6 pt-4 border-t border-slate-100 shrink-0 bg-white">
          <div className="flex items-center space-x-3 mb-2 bg-slate-50 p-3 rounded-2xl border border-slate-100">
            {user?.photoURL ? (
              <img src={user.photoURL} className="w-9 h-9 rounded-full border border-white shadow-sm" alt="User" />
            ) : (
              <div className="w-9 h-9 bg-white rounded-full flex items-center justify-center text-slate-400 shadow-sm border border-slate-100 font-bold">
                {user?.displayName ? user.displayName[0] : 'U'}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-slate-800 truncate">{user?.displayName || "访客馆长"}</p>
              <button 
                onClick={onLogout}
                className="text-[9px] font-black text-indigo-600 uppercase hover:underline tracking-tighter"
              >
                退出登录 LOGOUT
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 h-full relative overflow-hidden">
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 shrink-0 z-50">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xs shadow-md shadow-indigo-100">
              🖋️
            </div>
            <h1 className="text-sm font-bold text-slate-800 tracking-tight serif-font">Linguist Diary</h1>
          </div>
          <div className="flex items-center space-x-3">
             <button onClick={onLogout} className="text-lg opacity-60">🚪</button>
          </div>
        </header>

        {/* 内容容器 */}
        <div className={`flex-1 overflow-hidden relative ${isChat ? 'pb-20' : 'pb-24'}`}>
          <div className={`h-full ${isChat ? 'px-0' : 'px-4 pt-4 md:px-8 md:py-8 overflow-y-auto'}`}>
            <div className={`mx-auto flex flex-col h-full ${isChat ? 'max-w-full' : 'max-w-5xl'}`}>
              {children}
            </div>
          </div>
        </div>

        {/* 彻底固定的移动端导航栏 */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 flex items-center justify-around bg-white/90 backdrop-blur-xl border-t border-slate-200 px-2 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-10px_25px_-5px_rgba(0,0,0,0.05)] z-[100]">
           <button onClick={() => onViewChange('dashboard')} className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all ${activeView === 'dashboard' ? 'text-indigo-600 bg-indigo-50/50 scale-110' : 'text-slate-300'}`}>
             <span className="text-xl">📊</span>
           </button>
           <button onClick={() => onViewChange('editor')} className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all ${activeView === 'editor' ? 'text-indigo-600 bg-indigo-50/50 scale-110' : 'text-slate-300'}`}>
             <span className="text-xl">📝</span>
           </button>
           <button onClick={() => onViewChange('rehearsal')} className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all ${activeView === 'rehearsal' ? 'text-indigo-600 bg-indigo-50/50 scale-110' : 'text-slate-300'}`}>
             <span className="text-xl">🎭</span>
           </button>
           <button onClick={() => onViewChange('chat')} className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all ${activeView === 'chat' ? 'text-indigo-600 bg-indigo-50/50 scale-110' : 'text-slate-300'}`}>
             <span className="text-xl">💬</span>
           </button>
           <button onClick={() => onViewChange('review_vault')} className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all ${activeView === 'review_vault' ? 'text-indigo-600 bg-indigo-50/50 scale-110' : 'text-slate-300'}`}>
             <span className="text-xl">💎</span>
           </button>
           <button onClick={() => onViewChange('history')} className={`flex flex-col items-center justify-center w-12 h-12 rounded-xl transition-all ${activeView === 'history' ? 'text-indigo-600 bg-indigo-50/50 scale-110' : 'text-slate-300'}`}>
             <span className="text-xl">🏛️</span>
           </button>
        </nav>
      </main>
    </div>
  );
};

export default Layout;
