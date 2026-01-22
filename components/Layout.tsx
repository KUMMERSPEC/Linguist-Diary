
import React, { useState } from 'react';
import { ViewState } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeView: ViewState;
  onViewChange: (view: ViewState, vocabId?: string) => void;
  user: { displayName?: string | null, photoURL?: string | null };
  onLogout: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, onViewChange, user, onLogout }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
      onViewChange(Array.isArray(view) ? view[0] : view); // Navigate to the primary view of the group
      setIsMobileMenuOpen(false); // Close mobile menu on click
    }} className={getNavLinkClass(view)}>
      <span className="text-xl group-hover:scale-110 transition-transform">{icon}</span>
      <span>{label}</span>
    </button>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-100 p-6 space-y-6 shrink-0">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white text-xl">🖋️</div>
            <h1 className="text-lg font-bold text-slate-900 serif-font">Linguist Diary</h1>
          </div>
        </div>

        {/* User Profile */}
        <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
          <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.displayName}`} alt="User Avatar" className="w-9 h-9 rounded-full" />
          <div className="flex-1 text-sm font-semibold text-slate-700 truncate">{user.displayName}</div>
          <button onClick={onLogout} className="text-slate-400 hover:text-rose-500 transition-colors" title="登出">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-2">
          <NavItem view="dashboard" label="主页 / Dashboard" icon="🏠" />
          <NavItem view="editor" label="撰写 / Editor" icon="✍️" />
          <NavItem view="chat" label="启发对话 / Guided Chat" icon="💬" />
          <NavItem view={['rehearsal', 'rehearsal_report']} label="展厅演练 / Rehearsal" icon="🎤" />
          <NavItem view={['vocab_list', 'vocab_practice', 'vocab_practice_detail']} label="珍宝与足迹 / Vocab & Practice" icon="💎" />
          <NavItem view="history" label="收藏馆 / History" icon="🏛️" />
        </nav>

        {/* Footer */}
        <div className="text-[10px] text-slate-400 uppercase tracking-widest text-center border-t border-slate-100 pt-4">
          © {new Date().getFullYear()} Linguist Diary
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header (visible on smaller screens) */}
        <header className="lg:hidden flex items-center justify-between p-4 bg-white border-b border-slate-100 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xl">🖋️</div>
            <h1 className="text-lg font-bold text-slate-900 serif-font">Linguist Diary</h1>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 rounded-xl bg-slate-50 text-slate-500 hover:text-indigo-600">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
        </header>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
          <div className="fixed inset-0 bg-white z-50 flex flex-col p-6 animate-in slide-in-from-left-full duration-300">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xl">🖋️</div>
                <h1 className="text-lg font-bold text-slate-900 serif-font">Linguist Diary</h1>
              </div>
              <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 rounded-xl bg-slate-50 text-slate-500 hover:text-rose-500">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* User Profile in Mobile Menu */}
            <div className="flex items-center space-x-3 p-3 bg-slate-50 rounded-2xl border border-slate-100 mb-6">
              <img src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.displayName}`} alt="User Avatar" className="w-9 h-9 rounded-full" />
              <div className="flex-1 text-sm font-semibold text-slate-700 truncate">{user.displayName}</div>
              <button onClick={onLogout} className="text-slate-400 hover:text-rose-500 transition-colors" title="登出">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                </svg>
              </button>
            </div>

            {/* Mobile Navigation */}
            <nav className="flex-1 space-y-2">
              <NavItem view="dashboard" label="主页 / Dashboard" icon="🏠" />
              <NavItem view="editor" label="撰写 / Editor" icon="✍️" />
              <NavItem view="chat" label="启发对话 / Guided Chat" icon="💬" />
              <NavItem view={['rehearsal', 'rehearsal_report']} label="展厅演练 / Rehearsal" icon="🎤" />
              <NavItem view={['vocab_list', 'vocab_practice', 'vocab_practice_detail']} label="珍宝与足迹 / Vocab & Practice" icon="💎" />
              <NavItem view="history" label="收藏馆 / History" icon="🏛️" />
            </nav>

            {/* Mobile Footer */}
            <div className="text-[10px] text-slate-400 uppercase tracking-widest text-center border-t border-slate-100 pt-4 mt-auto">
              © {new Date().getFullYear()} Linguist Diary
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar pt-6 md:pt-10 pb-16 px-4 md:px-8">
          {children}
        </div>
      </main>
    </div>
  );
};

export default Layout;
    