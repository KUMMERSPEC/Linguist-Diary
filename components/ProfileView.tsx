
import React, { useState } from 'react';

interface ProfileViewProps {
  user: { displayName: string; photoURL: string; };
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
}

const DAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

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
  onSetIterationDay
}) => {
  const [isEditing, setIsEditing] = useState(false);

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

  return (
    <div className="flex flex-col h-full animate-in fade-in duration-700 overflow-hidden w-full relative pb-24 md:pb-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between mb-10 px-2 md:px-0 gap-4">
        <div>
          <h2 className="text-2xl md:text-4xl font-black text-slate-900 serif-font tracking-tight">馆长档案 <span className="text-indigo-600">Profile</span></h2>
          <p className="text-slate-400 text-xs md:text-sm font-medium mt-1 uppercase tracking-widest">Curator of the Language Museum</p>
        </div>
        <div className="flex items-center space-x-3 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-5 py-2.5 rounded-2xl border border-slate-100 shadow-sm">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
          <span>云端认证 Online</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-8 p-2 md:p-0">
        <div className="bg-white p-10 md:p-16 rounded-[3rem] border border-slate-200 shadow-2xl relative group overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50 rounded-bl-[8rem] opacity-40 -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-1000"></div>
          
          <div className="flex flex-col items-center space-y-8 relative z-10">
            <div className="relative">
              <div className="w-40 h-40 md:w-48 md:h-48 rounded-full border-8 border-white shadow-2xl overflow-hidden bg-slate-50 group/avatar">
                <img src={isEditing ? editPhoto : user.photoURL} alt="Avatar" className="w-full h-full object-cover" />
                {isEditing && (
                  <button onClick={() => setIsAvatarPickerOpen(!isAvatarPickerOpen)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="text-white text-xs font-black uppercase tracking-widest">更换人像</span>
                  </button>
                )}
              </div>
              {!isEditing && (
                <button onClick={handleStartEdit} className="absolute bottom-2 right-2 w-12 h-12 bg-indigo-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-indigo-700 transition-all active:scale-90">
                  🖋️
                </button>
              )}
            </div>

            <div className="text-center space-y-3 w-full max-w-sm">
              {isEditing ? (
                <div className="animate-in fade-in zoom-in duration-300">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">馆长名号 NAME</label>
                  <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white px-6 py-4 rounded-3xl text-center text-xl font-bold text-slate-800 outline-none" />
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <h3 className="text-3xl md:text-5xl font-black text-slate-900 serif-font tracking-tight">{user.displayName}</h3>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-4">Chief Curator</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Iteration Day Setting */}
        <div className="bg-white p-8 md:p-10 rounded-[3rem] border border-slate-200 shadow-xl">
           <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6">时光回响设置 ITERATION SETTINGS</h4>
           <div className="space-y-4">
             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
               <div>
                 <p className="text-sm font-bold text-slate-800">每周迭代建议日</p>
                 <p className="text-[10px] text-slate-400 uppercase font-black">Designated Weekly Echo Day</p>
               </div>
               <div className="flex flex-wrap gap-2">
                 {DAYS.map((day, idx) => (
                   <button 
                     key={idx}
                     onClick={() => onSetIterationDay(idx)}
                     className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${iterationDay === idx ? 'bg-indigo-600 text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                   >
                     {day.replace('星期', '')}
                   </button>
                 ))}
               </div>
             </div>
             <p className="text-[10px] text-indigo-400 italic bg-indigo-50 p-4 rounded-2xl">
               💡 系统会在选定的日子为您自动推荐一篇一周前的日记进行迭代，帮助您直观感受语言能力的成长。
             </p>
           </div>
        </div>

        {isEditing && isAvatarPickerOpen && (
          <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8 text-center">选择馆长化身 SELECT AVATAR</h3>
            <div className="grid grid-cols-4 lg:grid-cols-8 gap-4">
              {avatarSeeds.map((avatar) => (
                <button key={avatar.seed} onClick={() => { setEditPhoto(`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatar.seed}`); setIsAvatarPickerOpen(false); }} className={`flex flex-col items-center p-3 rounded-2xl border transition-all ${editPhoto.includes(avatar.seed) ? 'bg-indigo-50 border-indigo-200 ring-4 ring-indigo-500/10' : 'bg-slate-50 border-transparent'}`}>
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatar.seed}`} alt={avatar.label} className="w-16 h-16 rounded-full object-cover mb-2" />
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight text-center">{avatar.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {isEditing && (
        <footer className="mt-8 flex items-center justify-center space-x-4 shrink-0 animate-in slide-in-from-bottom-4">
          <button onClick={handleCancel} className="px-8 py-4 rounded-3xl text-sm font-black uppercase text-slate-400">取消 CANCEL</button>
          <button onClick={handleSave} disabled={isLoading} className="bg-indigo-600 text-white px-10 py-4 rounded-3xl text-sm font-black uppercase tracking-widest shadow-2xl hover:bg-indigo-700 transition-all flex items-center space-x-3">
            {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : '💾 保存修缮结果 SAVE'}
          </button>
        </footer>
      )}
    </div>
  );
};

export default ProfileView;
