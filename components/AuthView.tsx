
import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, Auth } from 'firebase/auth';

interface AuthViewProps {
  auth: Auth | null;
  isFirebaseValid: boolean;
  onLogin: (userData: { uid: string, displayName: string, photoURL: string }, isMock: boolean) => void;
}

const AuthView: React.FC<AuthViewProps> = ({ auth, isFirebaseValid, onLogin }) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [showDemoNotice, setShowDemoNotice] = useState(false);

  const handleGoogleLogin = async () => {
    if (!isFirebaseValid || !auth) {
      // 执行演示登录
      setIsLoggingIn(true);
      setShowDemoNotice(true);
      setTimeout(() => {
        onLogin({
          uid: 'demo_user',
          displayName: '演示馆长 (Demo)',
          photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'
        }, true);
        setIsLoggingIn(false);
      }, 1500);
      return;
    }
    
    setIsLoggingIn(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      onLogin({
        uid: result.user.uid,
        displayName: result.user.displayName || "馆长",
        photoURL: result.user.photoURL || ""
      }, false);
    } catch (error: any) {
      console.error("Login Error:", error);
      alert(`登录失败: ${error.message}\n建议使用“本地馆长模式”进入。`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 p-10 border border-slate-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full opacity-50 -mr-10 -mt-10"></div>
        
        <div className="relative z-10 text-center space-y-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-indigo-600 rounded-3xl text-white text-4xl shadow-xl shadow-indigo-200">
            🖋️
          </div>
          
          <div>
            <h1 className="text-3xl font-bold text-slate-900 serif-font">语言日记收藏馆</h1>
            <p className="text-slate-500 mt-3 leading-relaxed">
              欢迎来到您的私人语言空间。在这里，每一篇日记都是一件珍贵的馆藏。
            </p>
          </div>

          {showDemoNotice && (
            <div className="bg-amber-50 border border-amber-100 text-amber-700 p-4 rounded-2xl text-xs text-left leading-relaxed animate-in fade-in zoom-in">
              <p className="font-bold mb-1">🏛️ 环境提醒：</p>
              检测到未配置 Firebase。已为你开启“演示模式”，数据将保存在本地浏览器中。
            </div>
          )}

          <div className="space-y-4">
            <button 
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className={`w-full flex items-center justify-center space-x-3 bg-white border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all p-4 rounded-2xl font-semibold text-slate-700 shadow-sm ${isLoggingIn ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isLoggingIn ? (
                <div className="w-5 h-5 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin"></div>
              ) : (
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
              )}
              <span>{isLoggingIn ? '正在准备展厅...' : '使用 Google 账号进入'}</span>
            </button>
            
            <button 
              onClick={() => onLogin({ uid: 'local_user', displayName: '本地馆长', photoURL: '' }, true)}
              className="w-full bg-slate-900 text-white p-4 rounded-2xl font-bold shadow-lg hover:bg-indigo-600 transition-all active:scale-95"
            >
              ✨ 访客直接进入 (本地模式)
            </button>
            
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-relaxed">
              数据将加密存储在您的设备本地<br/>随时可以开始撰写
            </p>
          </div>

          <div className="pt-6 border-t border-slate-50">
            <div className="flex justify-center space-x-6">
              <div className="text-center">
                <p className="text-xl font-bold text-slate-800">∞</p>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">持久馆藏</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-slate-800">AI</p>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">智能纠错</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold text-slate-800">5+</p>
                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">支持语言</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthView;
