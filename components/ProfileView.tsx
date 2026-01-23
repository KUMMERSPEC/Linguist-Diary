
import React, { useState, useEffect } from 'react';

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
}

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
}) => {
  const [isEditing, setIsEditing] = useState(false);

  // 当进入编辑模式时，确保编辑状态同步为当前用户信息
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
        {/* Profile Display / Edit Card */}
        <div className="bg-white p-10 md:p-16 rounded-[3rem] border border-slate-200 shadow-2xl relative group overflow-hidden">
          <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-50 rounded-bl-[8rem] opacity-40 -mr-16 -mt-16 group-hover:scale-110 transition-transform duration-1000"></div>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-slate-50 rounded-tr-[5rem] opacity-30 -ml-8 -mb-8"></div>
          
          <div className="flex flex-col items-center space-y-8 relative z-10">
            {/* Avatar Section */}
            <div className="relative">
              <div className="w-40 h-40 md:w-48 md:h-48 rounded-full border-8 border-white shadow-2xl overflow-hidden bg-slate-50 group/avatar">
                <img
                  src={isEditing ? editPhoto : user.photoURL}
                  alt="Curator Avatar"
                  className="w-full h-full object-cover transition-all duration-500"
                />
                {isEditing && (
                  <button
                    onClick={() => setIsAvatarPickerOpen(!isAvatarPickerOpen)}
                    className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm opacity-0 group-hover/avatar:opacity-100 flex items-center justify-center transition-opacity"
                  >
                    <span className="text-white text-xs font-black uppercase tracking-widest">更换人像</span>
                  </button>
                )}
              </div>
              {!isEditing && (
                <button
                  onClick={handleStartEdit}
                  className="absolute bottom-2 right-2 w-12 h-12 bg-indigo-600 text-white rounded-full shadow-xl flex items-center justify-center hover:bg-indigo-700 transition-all active:scale-90"
                  title="修缮档案"
                >
                  🖋️
                </button>
              )}
            </div>

            {/* Name / Info Section */}
            <div className="text-center space-y-3 w-full max-w-sm">
              {isEditing ? (
                <div className="animate-in fade-in zoom-in duration-300">
                  <label htmlFor="displayName" className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                    馆长名号 NAME
                  </label>
                  <input
                    type="text"
                    id="displayName"
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-slate-50 border-2 border-transparent focus:border-indigo-500 focus:bg-white px-6 py-4 rounded-3xl text-center text-xl font-bold text-slate-800 transition-all outline-none"
                    placeholder="请输入馆长名号"
                  />
                </div>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                  <h3 className="text-3xl md:text-5xl font-black text-slate-900 serif-font tracking-tight">
                    {user.displayName}
                  </h3>
                  <div className="flex items-center justify-center space-x-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-4">
                    <span>首席馆长</span>
                    <span className="text-indigo-300">/</span>
                    <span>Chief Curator</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Slogan Area */}
        {!isEditing && (
          <div className="text-center py-6 px-4 animate-in fade-in slide-in-from-top-4 duration-1000 delay-300">
             <p className="text-slate-400 serif-font italic text-sm md:text-base leading-relaxed">
               “ 每一步语言的跨越，都是时光赠予馆长的最美勋章。 ”
             </p>
             <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-2">
               Every linguistic leap is a timeless medal for the curator.
             </p>
          </div>
        )}

        {/* Avatar Picker Panel */}
        {isEditing && isAvatarPickerOpen && (
          <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-xl animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8 text-center">选择馆长化身 SELECT AVATAR</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-8 gap-4">
              {avatarSeeds.map((avatar) => (
                <button
                  key={avatar.seed}
                  onClick={() => {
                    setEditPhoto(`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatar.seed}`);
                    setIsAvatarPickerOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all active:scale-95 ${
                    editPhoto.includes(avatar.seed)
                      ? 'bg-indigo-50 border-indigo-200 ring-4 ring-indigo-500/10'
                      : 'bg-slate-50 border-transparent hover:border-slate-200'
                  }`}
                >
                  <img
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatar.seed}`}
                    alt={avatar.label}
                    className="w-16 h-16 rounded-full object-cover mb-2 shadow-sm"
                  />
                  <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight text-center">
                    {avatar.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Persistent Footer Actions for Edit Mode */}
      {isEditing && (
        <footer className="mt-8 flex items-center justify-center space-x-4 shrink-0 px-2 md:px-0 animate-in slide-in-from-bottom-4 duration-500">
          <button
            onClick={handleCancel}
            className="px-8 py-4 rounded-3xl text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
          >
            取消 CANCEL
          </button>
          <button
            onClick={handleSave}
            disabled={isLoading || editName.trim() === ''}
            className={`bg-indigo-600 text-white px-10 py-4 rounded-3xl text-sm font-black uppercase tracking-widest shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center space-x-3 ${
              isLoading || editName.trim() === '' ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              '💾 保存修缮结果 SAVE'
            )}
          </button>
        </footer>
      )}
    </div>
  );
};

export default ProfileView;
