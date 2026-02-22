
import React, { useState } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  Auth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';

interface AuthViewProps {
  auth: Auth | null;
  isFirebaseValid: boolean;
  onLogin: (userData: { uid: string, displayName: string, photoURL: string }, isMock: boolean) => void;
}

const AuthView: React.FC<AuthViewProps> = ({ auth, isFirebaseValid, onLogin }) => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authMode, setAuthMode] = useState<'options' | 'email'>('options');
  const [emailMode, setEmailMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(
    !isFirebaseValid
      ? "🚨 警告：未检测到有效的 Firebase 配置（FIREBASE_API_KEY）。云端同步功能将受限。如果你在本地运行，请设置 FIREBASE_API_KEY 环境变量，或使用『访客直接进入』进行本地体验。如果已部署到 GitHub Pages，请确保 Actions Secrets 已正确配置。"
      : null
  );

  const handleGoogleLogin = async () => {
    if (!isFirebaseValid || !auth) {
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

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFirebaseValid || !auth) {
      setErrorMsg("未检测到 Firebase 配置，无法进行邮箱登录。");
      return;
    }

    if (!email || !password) {
      setErrorMsg("请填写完整的邮箱和密码。");
      return;
    }

    setIsLoggingIn(true);
    setErrorMsg(null);

    try {
      let result;
      if (emailMode === 'login') {
        result = await signInWithEmailAndPassword(auth, email, password);
      } else {
        result = await createUserWithEmailAndPassword(auth, email, password);
      }
      
      onLogin({
        uid: result.user.uid,
        displayName: result.user.displayName || email.split('@')[0],
        photoURL: result.user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${result.user.uid}`
      }, false);
    } catch (error: any) {
      console.error("Email Auth Error:", error);
      let msg = "认证失败，请检查您的输入。";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        msg = "邮箱或密码错误。";
      } else if (error.code === 'auth/email-already-in-use') {
        msg = "该邮箱已被注册。";
      } else if (error.code === 'auth/weak-password') {
        msg = "密码强度不足（至少6位）。";
      } else if (error.code === 'auth/invalid-email') {
        msg = "无效的邮箱格式。";
      }
      setErrorMsg(msg);
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
              {authMode === 'options' ? '欢迎回来。请选择您的入馆方式：' : (emailMode === 'login' ? '使用邮箱登录' : '创建新馆长账号')}
            </p>
          </div>

          {errorMsg && (
            <div className="bg-rose-50 border border-rose-100 text-rose-600 p-4 rounded-2xl text-[10px] text-left leading-relaxed animate-in fade-in zoom-in">
              <p className="font-bold mb-1">🏛️ 配置提醒：</p>
              {errorMsg}
            </div>
          )}

          <div className="space-y-4">
            {authMode === 'options' ? (
              <>
                <div className="space-y-2">
                  <button 
                    onClick={handleGoogleLogin}
                    disabled={isLoggingIn || !isFirebaseValid}
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
                    <span>使用 Google 账号登录 (同步)</span>
                  </button>

                  <button 
                    onClick={() => setAuthMode('email')}
                    disabled={isLoggingIn || !isFirebaseValid}
                    className={`w-full flex items-center justify-center space-x-3 bg-white border-2 border-slate-100 transition-all p-4 rounded-2xl font-semibold text-slate-700 shadow-sm ${
                      isFirebaseValid 
                        ? 'hover:border-indigo-600 hover:bg-indigo-50' 
                        : 'opacity-50 cursor-not-allowed grayscale'
                    }`}
                  >
                    <span className="text-xl">✉️</span>
                    <span>使用邮箱登录</span>
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
                      !isFirebaseValid 
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
              </>
            ) : (
              <form onSubmit={handleEmailAuth} className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="space-y-3">
                  <div className="text-left">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">邮箱地址 EMAIL</label>
                    <input 
                      type="email" 
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="curator@museum.com"
                      className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white px-4 py-3 rounded-2xl text-sm font-medium text-slate-800 outline-none transition-all"
                      required
                    />
                  </div>
                  <div className="text-left">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">密码 PASSWORD</label>
                    <input 
                      type="password" 
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white px-4 py-3 rounded-2xl text-sm font-medium text-slate-800 outline-none transition-all"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <button 
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full bg-indigo-600 text-white p-4 rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center"
                  >
                    {isLoggingIn ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      <span>{emailMode === 'login' ? '立即入馆' : '注册并入馆'}</span>
                    )}
                  </button>
                  
                  <div className="flex items-center justify-between px-2">
                    <button 
                      type="button"
                      onClick={() => setEmailMode(emailMode === 'login' ? 'signup' : 'login')}
                      className="text-[10px] font-black uppercase text-indigo-600 tracking-widest hover:underline"
                    >
                      {emailMode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
                    </button>
                    <button 
                      type="button"
                      onClick={() => { setAuthMode('options'); setErrorMsg(null); }}
                      className="text-[10px] font-black uppercase text-slate-400 tracking-widest hover:text-slate-600"
                    >
                      返回选择
                    </button>
                  </div>
                </div>
              </form>
            )}
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