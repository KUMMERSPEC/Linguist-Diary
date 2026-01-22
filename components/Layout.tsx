
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

  // Mobile NavItem for small screens - simpler text and no separate icon span
  const MobileNavItem = ({ view, label, icon }: { view: ViewState, label: string, icon: string }) => (
    <button
      onClick={() => onViewChange(view)}
      className={`flex flex-col items-center flex-1 px-2 py-2 transition-colors duration-200 ${
        activeView === view
          ? 'text-indigo-600'
          : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="text-[10px] font-medium mt-1 uppercase tracking-wider">{label}</span>
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
          {/* Updated navigation for vocab features */}
          <NavItem view="vocab_list" label="珍宝复习 / Vocab" icon="💎" />
          <NavItem view="practice_history" label="练习足迹 / Practice" icon="📜" />
          <NavItem view="history" label="博物馆 / Collection" icon="🏛️" />
        </nav>

        <div className="p-6 pt-4 border-t border-slate-100 shrink-0">
          <div className="flex items-center space-x-3 mb-4">
            <img src={user.photoURL || 'https://api.dicebear.com/7.x/avataaars/svg?seed=Curator'} alt="User Avatar" className="w-10 h-10 rounded-full border-2 border-slate-200 object-cover" />
            <div className="flex-1">
              <p className="font-semibold text-slate-800 text-sm truncate">{user.displayName || '馆长'}</p>
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Online</span>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex items-center space-x-3 w-full px-4 py-2.5 rounded-xl text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all duration-200"
          >
            <span className="text-xl">🚪</span>
            <span className="font-medium text-sm md:text-[13px] lg:text-sm">退出 / Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`flex-1 overflow-y-auto no-scrollbar relative transition-all duration-300 ${isChat ? 'p-0' : 'p-4 md:p-8'}`}>
        <div className={`max-w-7xl mx-auto h-full ${isChat ? 'px-0' : 'px-2'}`}>
          {children}
        </div>
      </main>

      {/* Mobile Navigation (Fixed Bottom) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around py-2 shadow-lg md:hidden z-50">
        <MobileNavItem view="dashboard" label="概览" icon="📊" />
        <MobileNavItem view="editor" label="撰写" icon="📝" />
        <MobileNavItem view="chat" label="聊天" icon="💬" />
        <MobileNavItem view="vocab_list" label="珍宝" icon="💎" />
        <MobileNavItem view="history" label="收藏" icon="🏛️" />
      </nav>
    </div>
  );
};

export default Layout;