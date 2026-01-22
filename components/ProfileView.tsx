
import React from 'react';

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
  return (
    <div className="flex flex-col h-full animate-in fade-in duration-500 overflow-hidden w-full relative pb-24 md:pb-8">
      <header className="flex flex-col md:flex-row md:items-end justify-between mb-8 px-2 md:px-0 gap-4">
        <div>
          <h2 className="text-2xl md:text-4xl font-bold text-slate-900 serif-font">个人档案 Curator Profile</h2>
          <p className="text-slate-500 text-sm md:text-base italic mt-1">管理您的个人资料和头像。</p>
        </div>
        <div className="flex items-center space-x-3 text-[10px] font-black text-slate-400 uppercase tracking-widest bg-white px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
          <span>{user.displayName}</span>
          <span className="text-slate-200">|</span>
          <span className="text-indigo-600">在线</span>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-8 p-2 md:p-0">
        {/* Profile Card */}
        <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl relative group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-[4rem] opacity-30 -mr-10 -mt-10 group-hover:scale-110 transition-transform"></div>
          
          <div className="flex flex-col items-center space-y-6 relative z-10">
            {/* Avatar */}
            <div className="relative">
              <img
                src={editPhoto || `https://api.dicebear.com/7.x/avataaars/svg?seed=${editName}`}
                alt="Profile Avatar"
                className="w-32 h-32 rounded-full border-4 border-white shadow-lg object-cover bg-slate-50"
              />
              <button
                onClick={() => setIsAvatarPickerOpen(!isAvatarPickerOpen)}
                className="absolute bottom-0 right-0 bg-indigo-600 text-white p-2 rounded-full shadow-md hover:bg-indigo-700 transition-all active:scale-95"
                title="更换头像"
              >
                ✏️
              </button>
            </div>

            {/* Name Input */}
            <div className="w-full max-w-sm">
              <label htmlFor="displayName" className="block text-sm font-semibold text-slate-700 mb-2">
                馆长名称 Display Name
              </label>
              <input
                type="text"
                id="displayName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-5 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all text-base text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Avatar Picker */}
        {isAvatarPickerOpen && (
          <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-500">
            <h3 className="text-xl font-black text-slate-900 serif-font mb-6">选择新头像 Select Avatar</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
              {avatarSeeds.map((avatar) => (
                <button
                  key={avatar.seed}
                  onClick={() => {
                    setEditPhoto(`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatar.seed}`);
                    setIsAvatarPickerOpen(false);
                  }}
                  className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all ${
                    editPhoto.includes(avatar.seed)
                      ? 'bg-indigo-50 border-indigo-200 ring-2 ring-indigo-400'
                      : 'bg-slate-50 border-transparent hover:border-slate-200'
                  }`}
                >
                  <img
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${avatar.seed}`}
                    alt={avatar.label}
                    className="w-16 h-16 rounded-full object-cover mb-2"
                  />
                  <span className="text-[10px] font-bold text-slate-700 uppercase tracking-widest text-center">
                    {avatar.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <footer className="mt-8 flex justify-end shrink-0 px-2 md:px-0">
        <button
          onClick={onSaveProfile}
          disabled={isLoading || editName.trim() === ''}
          className={`bg-indigo-600 text-white px-8 py-4 rounded-3xl text-lg font-black shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98] flex items-center justify-center space-x-3 ${
            isLoading || editName.trim() === '' ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isLoading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            '💾 保存更新 Save Profile'
          )}
        </button>
      </footer>
    </div>
  );
};

export default ProfileView;