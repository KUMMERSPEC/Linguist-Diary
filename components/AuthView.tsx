
import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, Auth } from 'firebase/auth';

interface AuthViewProps {
  auth: Auth | null;
  isFirebaseValid: boolean;
  onLogin: (userData: { uid: string, displayName: string, photoURL: string }, isMock: boolean) => void;
}

const AuthView: React.FC<AuthViewProps> = ({ auth, isFirebaseValid, onLogin }) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(
    !isFirebaseValid
      ? "🚨 警告：未检测到有效的 Firebase 配置（FIREBASE_API_KEY）。云端同步功能将受限。如果你在本地运行，请设置 FIREBASE_API_KEY 环境变量，或使用『访客直接进入』进行本地体验。如果已部署到 GitHub Pages，请确保 Actions Secrets 已正确配置。"
      : null
  );

  const handleGoogleLogin = async () => {
    if (!isFirebaseValid || !auth) {
      // This case should ideally be covered by the initial errorMsg state,
      // but keeping this for explicit check before API call.
      setErrorMsg("未检测到 Firebase 配置，无法进行 Google 登录。请确保已设置 FIREBASE_API_KEY 或使用访客模式。");
      return;
    }
    
    setIsLoggingIn(true);
    setErrorMsg(null);
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
      if (error.code === 'auth/popup-blocked') {
        setErrorMsg("登录窗口被浏览器拦截，请允许弹出窗口后重试。");
      } else {
        setErrorMsg(`登录失败: ${error.message}`);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleDemoLogin = () => {
    onLogin({
      uid: 'demo_user',
      displayName: '演示馆长 (Local)',
      photoURL: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix'
    }, true);
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
              欢迎回来。请选择您的入馆方式：
            </p>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-2xl text-[10px] text-left leading-relaxed animate-in fade-in zoom-in">
              <p className="font-bold mb-1">🏛️ 配置提醒：</p>
              {errorMsg}
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <button 
                onClick={handleGoogleLogin}
                disabled={isLoggingIn || !isFirebaseValid} // Disable if Firebase is not valid
                className={`w-full flex items-center justify-center space-x-3 bg-white border-2 border-slate-100 transition-all p-4 rounded-2xl font-semibold text-slate-700 shadow-sm ${
                  isFirebaseValid 
                    ? 'hover:border-indigo-600 hover:bg-indigo-50' 
                    : 'opacity-50 cursor-not-allowed grayscale'
                }`}
              >
                {isLoggingIn ? (
                  <div className="w-5 h-5 border-2 border-indigo-600/30 border-t-indigo-600 rounded-full animate-spin"></div>
                ) : (
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5" alt="Google" />
                )}
                <span>{isLoggingIn ? '正在连接安全验证...' : '使用 Google 账号登录 (同步)'}</span>
              </button>
              {!isFirebaseValid && (
                 <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight">仅在正确配置 Firebase 后可用</p>
              )}
            </div>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
              <div className="relative flex justify-center text-[10px] uppercase font-bold text-slate-300"><span className="bg-white px-2">或者 OR</span></div>
            </div>

            <div className="space-y-2">
              <button 
                onClick={handleDemoLogin}
                className={`w-full p-4 rounded-2xl font-bold shadow-lg transition-all active:scale-95 ${
                  !isFirebaseValid // Promote if Firebase is NOT valid
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700 ring-4 ring-indigo-500/10' 
                    : 'bg-slate-900 text-white hover:bg-indigo-600'
                }`}
              >
                ✨ 访客直接进入 (本地存储)
              </button>
              {!isFirebaseValid && (
                 <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest animate-pulse">当前环境推荐使用此选项</p>
              )}
            </div>
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthView;