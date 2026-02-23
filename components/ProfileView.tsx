
import React, { useState } from 'react';
import { UserProfile } from '../types';

interface ProfileViewProps {
  user: { uid: string } & UserProfile;
  editName: string;
  setEditName: (name: string) => void;
  editPhoto: string;
  setEditPhoto: (photo: string) => void;
  isAvatarPickerOpen: boolean;
  setIsAvatarPickerOpen: (isOpen: boolean) => void;
  avatarSeeds: { seed: string; label: string }[];
  onSaveProfile: () => void;
  isLoading: boolean;
  iterationDay: number;
  onSetIterationDay: (day: number) => void;
  preferredLanguages: string[];
  onSetPreferredLanguages: (langs: string[]) => void;
  onActivatePro: (code: string) => Promise<boolean>;
}

const DAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

const ALL_LANG_ARRAY = [
  { code: 'English', label: 'English', flag: '🇬🇧' },
  { code: 'Japanese', label: '日语', flag: '🇯🇵' },
  { code: 'French', label: '法语', flag: '🇫🇷' },
  { code: 'Spanish', label: '西语', flag: '🇪🇸' },
  { code: 'German', label: '德语', flag: '🇩🇪' },
];

const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  editName,
  setEditName,
  editPhoto,
  setEditPhoto,
  isAvatarPickerOpen,
  setIsAvatarPickerOpen,
  avatarSeeds,
  onSaveProfile,
  isLoading,
  iterationDay,
  onSetIterationDay,
  preferredLanguages,
  onSetPreferredLanguages,
  onActivatePro
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isLearningPrefsOpen, setIsLearningPrefsOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [activationStatus, setActivationStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [showInputForPro, setShowInputForPro] = useState(false);

  const handleStartEdit = () => {
    setEditName(user.displayName);
    setEditPhoto(user.photoURL);
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setIsAvatarPickerOpen(false);
  };

  const handleSave = async () => {
    await onSaveProfile();
    setIsEditing(false);
  };

  const toggleLanguage = (code: string) => {
    let next;
    if (preferredLanguages.includes(code)) {
      if (preferredLanguages.length <= 1) return;
      next = preferredLanguages.filter(l => l !== code);
    } else {
      next = [...preferredLanguages, code];
    }
    onSetPreferredLanguages(next);
  };

  const handleActivate = async () => {
    if (!passcode.trim()) return;
    setActivationStatus('loading');
    const success = await onActivatePro(passcode);
    if (success) {
      setActivationStatus('success');
      setPasscode('');
      setShowInputForPro(false);
      setTimeout(() => setActivationStatus('idle'), 3000);
    } else {
      setActivationStatus('error');
      setTimeout(() => setActivationStatus('idle'), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-700 overflow-hidden w-full relative pb-10 md:pb-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between mb-10 px-4 md:px-0 gap-4 shrink-0">
        <div>
          <h2 className="text-2xl md:text-4xl font-black text-slate-900 serif-font tracking-tight">馆长档案 <span className="text-indigo-600">Profile</span></h2>
          <p className="text-slate-400 text-xs md:text-sm font-medium mt-1 uppercase tracking-widest">Curator of the Language Museum</p>
        </div>
        <div className="flex items-center space-x-3 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-5 py-2.5 rounded-2xl border border-slate-100 shadow-sm">
          <span className={`w-2 h-2 rounded-full animate-pulse ${user.isPro ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
          <span>{user.isPro ? 'PRO 尊享馆长' : '标准馆长'}</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-6 px-4 md:px-0 pb-12">
        <div className="bg-white p-10 md:p-14 rounded-[3rem] border border-slate-200 shadow-2xl relative group overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50 rounded-bl-[8rem] opacity-40 -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-1000"></div>
          
          <div className="flex flex-col items-center space-y-8 relative z-10">
            <div className="relative">
              <div className="w-36 h-36 md:w-44 md:h-44 rounded-full border-8 border-white shadow-2xl overflow-hidden bg-slate-50 group/avatar">
                <img src={isEditing ? editPhoto : user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                {isEditing && (
                  <button onClick={() => setIsAvatarPickerOpen(!isAvatarPickerOpen)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="text-white text-xs font-black uppercase tracking-widest">更换人像</span>
                  </button>
                )}
              </div>
              {!isEditing && (
                <button onClick={handleStartEdit} className="absolute bottom-2 right-2 w-10 h-10 bg-indigo-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-indigo-700 transition-all active:scale-90">
                  🖋️
                </button>
              )}
            </div>

            <div className="text-center space-y-2 w-full max-sm">
              {isEditing ? (
                <div className="animate-in fade-in zoom-in duration-300">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">馆长名号 NAME</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white px-6 py-3 rounded-2xl text-center text-lg font-bold text-slate-800 outline-none" />
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <h3 className="text-3xl md:text-4xl font-black text-slate-900 serif-font tracking-tight flex items-center justify-center">
                    {user.displayName}
                    {user.isPro && <span className="ml-2 text-xl" title="Pro Membership">✨</span>}
                  </h3>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">
                    {user.isPro ? 'PRO SENIOR CURATOR' : 'CHIEF CURATOR'}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 核心改动：Pro 与普通状态的激活码区域切换 */}
        {user.isPro && !showInputForPro ? (
          /* PRO 馆长专属卡片 */
          <section className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-xl overflow-hidden relative group animate-in zoom-in-95 duration-500">
            <div className="absolute top-0 right-0 w-48 h-48 bg-amber-500/10 rounded-bl-full -mr-16 -mt-16 blur-3xl group-hover:bg-indigo-500/10 transition-colors duration-1000"></div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-center space-x-5">
                <div className="w-14 h-14 bg-gradient-to-br from-amber-400 to-indigo-600 rounded-2xl flex items-center justify-center text-2xl shadow-lg shadow-indigo-500/20 animate-pulse">
                  ✨
                </div>
                <div>
                  <h4 className="text-xl font-black text-white serif-font">尊享馆长权益已生效</h4>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-amber-500 text-[9px] font-black uppercase tracking-widest">PRO STATUS ACTIVE</span>
                    <span className="w-1 h-1 bg-slate-700 rounded-full"></span>
                    <span className="text-indigo-400 text-[9px] font-black uppercase tracking-widest">无限配额解锁</span>
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col md:items-end">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">权益有效期至</span>
                <span className="text-white text-lg font-black tracking-tight serif-font">
                  {user.proExpiry ? new Date(user.proExpiry).toLocaleDateString() : '永久有效'}
                </span>
                <button 
                  onClick={() => setShowInputForPro(true)}
                  className="mt-2 text-[8px] font-black text-indigo-400/60 uppercase tracking-widest hover:text-indigo-400 transition-colors"
                >
                  我有新的激活码 / 续费 →
                </button>
              </div>
            </div>
          </section>
        ) : (
          /* 普通激活/输入激活码界面 */
          <section className="bg-slate-900 p-8 rounded-[2.5rem] border border-slate-800 shadow-xl overflow-hidden relative animate-in slide-in-from-bottom-4 duration-500">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-bl-full -mr-10 -mt-10 pointer-events-none"></div>
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <h4 className="text-xl font-black text-white serif-font">激活码兑换 <span className="text-indigo-400 text-sm">Passcode</span></h4>
                <p className="text-slate-400 text-[9px] uppercase font-black tracking-widest">
                  {showInputForPro ? '追加订阅时长以延续馆长特权' : '开启 Pro 权限，享受不限额度 AI 服务'}
                </p>
              </div>
              
              <div className="flex items-center space-x-2 bg-white/5 p-2 rounded-2xl border border-white/10 focus-within:border-indigo-500 transition-all">
                <input 
                  type="text" 
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="输入激活码..."
                  className="bg-transparent border-none focus:ring-0 text-white text-xs px-2 w-32"
                />
                <button 
                  onClick={handleActivate}
                  disabled={activationStatus === 'loading' || !passcode.trim()}
                  className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                    activationStatus === 'success' ? 'bg-emerald-500 text-white' : 
                    activationStatus === 'error' ? 'bg-rose-500 text-white' : 
                    'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
                >
                  {activationStatus === 'loading' ? '...' : 
                  activationStatus === 'success' ? '已激活' : 
                  activationStatus === 'error' ? '错误' : '激活'}
                </button>
              </div>
            </div>
            {showInputForPro && (
              <button 
                onClick={() => setShowInputForPro(false)}
                className="mt-4 text-[8px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-300 transition-colors"
              >
                取消返回
              </button>
            )}
          </section>
        )}

        <button 
          onClick={() => setIsLearningPrefsOpen(true)}
          className="w-full bg-white p-8 rounded-[2.5rem] text-slate-900 border border-slate-100 flex items-center justify-between shadow-lg hover:shadow-xl transition-all group overflow-hidden relative"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-bl-full -mr-10 -mt-10 transition-transform group-hover:scale-110 pointer-events-none"></div>
          <div className="flex items-center space-x-5 relative z-10">
            <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center text-2xl">⚙️</div>
            <div className="text-left">
              <h4 className="text-xl font-black serif-font">学习选项设定</h4>
              <p className="text-slate-400 text-[10px] uppercase font-black tracking-widest mt-1">Learning Preferences</p>
            </div>
          </div>
          <div className="flex flex-col items-end relative z-10">
            <span className="text-2xl text-indigo-600 group-hover:translate-x-2 transition-transform">→</span>
          </div>
        </button>

        {isEditing && isAvatarPickerOpen && (
          <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 text-center">选择馆长化身 SELECT AVATAR</h3>
            <div className="grid grid-cols-4 lg:grid-cols-8 gap-3">
              {avatarSeeds.map((avatar) => (
                <button key={avatar.seed} onClick={() => { setEditPhoto(`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatar.seed}`); setIsAvatarPickerOpen(false); }} className={`flex flex-col items-center p-2 rounded-2xl border transition-all ${editPhoto.includes(avatar.seed) ? 'bg-indigo-50 border-indigo-200 ring-4 ring-indigo-500/10' : 'bg-slate-50 border-transparent'}`}>
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatar.seed}`} alt={avatar.label} className="w-12 h-12 rounded-full object-cover mb-2" />
                  <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tight text-center">{avatar.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {isEditing && (
        <footer className="mt-4 mb-4 flex items-center justify-center space-x-4 shrink-0 animate-in slide-in-from-bottom-4 px-4">
          <button onClick={handleCancel} className="px-8 py-3 rounded-2xl text-[10px] font-black uppercase text-slate-400 hover:text-slate-600">取消 CANCEL</button>
          <button onClick={handleSave} disabled={isLoading} className="bg-indigo-600 text-white px-10 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-2xl hover:bg-indigo-700 transition-all flex items-center space-x-3">
            {isLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : '💾 保存修缮结果 SAVE'}
          </button>
        </footer>
      )}

      {isLearningPrefsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8 animate-in fade-in duration-300">
           <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsLearningPrefsOpen(false)}></div>
           
           <div className="relative w-full max-w-2xl bg-white rounded-[3rem] shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 slide-in-from-bottom-10 duration-500 max-h-full">
              <header className="p-8 border-b border-slate-50 flex items-center justify-between shrink-0">
                 <div className="flex items-center space-x-4">
                   <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-xl shadow-inner">🧬</div>
                   <div>
                     <h3 className="text-xl font-black serif-font text-slate-900">学习偏好控制台</h3>
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Preferences Dashboard</p>
                   </div>
                 </div>
                 <button onClick={() => setIsLearningPrefsOpen(false)} className="w-10 h-10 rounded-full hover:bg-slate-50 flex items-center justify-center text-slate-300 transition-colors">✕</button>
              </header>

              <div className="flex-1 overflow-y-auto no-scrollbar p-8 space-y-10">
                <section>
                  <div className="flex items-center justify-between mb-6">
                    <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em]">馆藏语种分馆分派 GEMS ARCHIVE BRANCHES</h4>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                    {ALL_LANG_ARRAY.map((lang) => {
                      const isActive = preferredLanguages.includes(lang.code);
                      return (
                        <button
                          key={lang.code}
                          onClick={() => toggleLanguage(lang.code)}
                          className={`flex flex-col items-center justify-center p-4 rounded-[1.8rem] border-2 transition-all active:scale-95 ${
                            isActive 
                              ? 'bg-indigo-50 border-indigo-600 text-indigo-700 shadow-lg shadow-indigo-100' 
                              : 'bg-slate-50 border-transparent text-slate-300 grayscale opacity-60 hover:grayscale-0'
                          }`}
                        >
                          <span className="text-2xl mb-1.5">{lang.flag}</span>
                          <span className="text-[9px] font-black uppercase tracking-tighter">{lang.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section>
                  <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-6">时光回响迭代策略 TIME'S ECHO STRATEGY</h4>
                  <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-100">
                    <div className="flex flex-col space-y-5">
                       <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <p className="text-xs font-black text-slate-600 uppercase tracking-widest">迭代建议日</p>
                          <div className="flex flex-wrap gap-1.5">
                            {DAYS.map((day, idx) => (
                              <button 
                                key={idx}
                                onClick={() => onSetIterationDay(idx)}
                                className={`px-2.5 py-1.5 rounded-xl text-[9px] font-black uppercase transition-all ${iterationDay === idx ? 'bg-indigo-600 text-white shadow-md scale-105' : 'bg-white text-slate-400 border border-slate-100 hover:bg-slate-50'}`}
                              >
                                {day.replace('星期', '')}
                              </button>
                            ))}
                          </div>
                       </div>
                    </div>
                  </div>
                </section>
              </div>

              <footer className="p-8 border-t border-slate-50 shrink-0 bg-slate-50/30">
                 <button 
                  onClick={() => setIsLearningPrefsOpen(false)}
                  className="w-full bg-slate-900 text-white py-4 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl active:scale-[0.98] transition-all"
                 >
                   完成设置 CLOSE
                 </button>
              </footer>
           </div>
        </div>
      )}

    </div>
  );
};

export default ProfileView;
