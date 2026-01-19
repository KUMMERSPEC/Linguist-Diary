
import React from 'react';
import { ViewState } from '../types';
import { User, Auth, signOut } from 'firebase/auth';

interface LayoutProps {
  children: React.ReactNode;
  activeView: ViewState;
  onViewChange: (view: ViewState) => void;
  user: User;
  auth: Auth;
}

const Layout: React.FC<LayoutProps> = ({ children, activeView, onViewChange, user, auth }) => {
  const NavItem = ({ view, label, icon }: { view: ViewState, label: string, icon: string }) => (
    <button
      onClick={() => onViewChange(view)}
      className={`flex items-center space-x-3 w-full px-4 py-3 rounded-xl transition-all duration-200 ${
        activeView === view 
          ? 'bg-indigo-50 text-indigo-600 shadow-sm' 
          : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
      }`}
    >
      <span className="text-xl">{icon}</span>
      <span className="font-medium text-sm md:text-base">{label}</span>
    </button>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col p-6 space-y-8 hidden md:flex">
        <div className="flex items-center space-x-3 px-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xl">
            🖋️
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Linguist</h1>
        </div>

        <nav className="flex-1 space-y-2">
          <NavItem view="dashboard" label="概览 / Dashboard" icon="📊" />
          <NavItem view="editor" label="普通写信 / Standard" icon="📝" />
          <NavItem view="chat" label="启发聊天 / Guided Chat" icon="💬" />
          <NavItem view="history" label="博物馆 / Collection" icon="🏛️" />
        </nav>

        {/* User Info & Logout */}
        <div className="pt-6 border-t border-slate-100">
          <div className="flex items-center space-x-3 mb-4">
            {user.photoURL ? (
              <img src={user.photoURL} className="w-10 h-10 rounded-full border border-slate-200" alt="User" />
            ) : (
              <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">👤</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">{user.displayName || "访客馆长"}</p>
              <button 
                onClick={() => signOut(auth)}
                className="text-[10px] font-bold text-indigo-600 uppercase hover:underline"
              >
                退出登录 Logout
              </button>
            </div>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl">
            <p className="text-xs font-semibold text-slate-400 uppercase mb-2">My Progress</p>
            <div className="flex justify-between items-end">
              <span className="text-2xl font-bold text-slate-800">...</span>
              <span className="text-xs text-indigo-600 font-medium">云同步已开启</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* Mobile Header */}
        <header className="md:hidden flex items-center justify-between p-4 bg-white border-b border-slate-200">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-lg">
              🖋️
            </div>
            <h1 className="text-lg font-bold">Linguist</h1>
          </div>
          <div className="flex items-center space-x-3">
             {user.photoURL && <img src={user.photoURL} className="w-8 h-8 rounded-full" alt="User" />}
             <button onClick={() => signOut(auth)} className="text-xl">🚪</button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-5xl mx-auto h-full">
            {children}
          </div>
        </div>

        {/* Mobile Nav Bar */}
        <nav className="md:hidden flex items-center justify-around bg-white border-t border-slate-200 p-2 pb-6">
           <button onClick={() => onViewChange('dashboard')} className={`p-2 ${activeView === 'dashboard' ? 'text-indigo-600' : 'text-slate-400'}`}>📊</button>
           <button onClick={() => onViewChange('editor')} className={`p-2 ${activeView === 'editor' ? 'text-indigo-600' : 'text-slate-400'}`}>📝</button>
           <button onClick={() => onViewChange('chat')} className={`p-2 ${activeView === 'chat' ? 'text-indigo-600' : 'text-slate-400'}`}>💬</button>
           <button onClick={() => onViewChange('history')} className={`p-2 ${activeView === 'history' ? 'text-indigo-600' : 'text-slate-400'}`}>🏛️</button>
        </nav>
      </main>
    </div>
  );
};

export default Layout;
