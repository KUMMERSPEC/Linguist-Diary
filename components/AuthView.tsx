import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, signInAnonymously, Auth } from 'firebase/auth';

interface AuthViewProps {
  auth: Auth | null;
  onSandboxLogin: () => void;
}

const AuthView: React.FC<AuthViewProps> = ({ auth, onSandboxLogin }) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    if (!auth) {
      setErrorMsg("Firebase 未初始化：请检查配置或尝试【本地馆长模式】。");
      return;
    }
    setErrorMsg(null);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (error.code === 'auth/network-request-failed') {
        setErrorMsg("网络错误：无法连接到 Firebase 服务，请检查网络。");
      } else if (error.code === 'auth/api-key-not-valid.-please-pass-a-valid-api-key.') {
        setErrorMsg("Firebase 配置无效：API Key 错误。建议使用【本地馆长模式】预览。");
      } else {
        setErrorMsg("登录失败：" + error.message);
      }
    }
  };

  const handleGuestLogin = async () => {
    if (!auth) {
      onSandboxLogin();
      return;
    }
    try {
      await signInAnonymously(auth);
    } catch (error: any) {
      // If auth fails for any reason, fallback to sandbox
      onSandboxLogin();
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

          {errorMsg && (
            <div className="bg-red-50 border border-red-100 text-red-600 p-4 rounded-2xl text-xs text-left leading-relaxed animate-in fade-in zoom-in">
              <p className="font-bold mb-1">⚠️ 系统提示：</p>
              {errorMsg}
            </div>
          )}

          <div className="space-y-4">
            <button 
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center space-x-3 bg-white border-2 border-slate-100 hover:border-indigo-600 hover:bg-indigo-50 transition-all p-4 rounded-2xl font-semibold text-slate-700 shadow-sm"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
              <span>使用 Google 账号同步</span>
            </button>
            
            <button 
              onClick={handleGuestLogin}
              className="w-full bg-slate-900 text-white p-4 rounded-2xl font-bold shadow-lg hover:bg-indigo-600 transition-all active:scale-95"
            >
              ✨ 本地馆长模式 (Sandbox)
            </button>
            
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
              本地模式将数据保存在浏览器，无需 Firebase 配置
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