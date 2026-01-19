
import React from 'react';

interface ApiKeySelectorProps {
  onActivate: () => void;
}

const ApiKeySelector: React.FC<ApiKeySelectorProps> = ({ onActivate }) => {
  const handleActivate = async () => {
    // 根据规范，调用环境提供的 openSelectKey 方法
    if (window.aistudio && window.aistudio.openSelectKey) {
      await window.aistudio.openSelectKey();
    }
    // 触发父组件状态更新
    onActivate();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 p-10 border border-slate-100 relative overflow-hidden text-center">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full opacity-50 -mr-10 -mt-10"></div>
        
        <div className="relative z-10 space-y-8">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-indigo-600 rounded-full text-white text-5xl shadow-xl shadow-indigo-200 animate-pulse">
            🔑
          </div>
          
          <div>
            <h1 className="text-3xl font-bold text-slate-900 serif-font">激活馆长钥匙</h1>
            <p className="text-slate-500 mt-4 leading-relaxed text-sm">
              为了驱动博物馆内的 AI 语言教授，您需要激活属于馆长本人的权限钥匙（Personal API Key）。
            </p>
          </div>

          <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl text-xs text-left text-amber-800">
            <p className="font-bold mb-1">📋 激活说明：</p>
            <ul className="list-disc list-inside space-y-1 opacity-90">
              <li>必须选择一个已启用账单的付费项目。</li>
              <li>您的密钥将仅用于当前的语言分析请求。</li>
              <li>详细了解 <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="underline font-bold decoration-amber-300">账单与额度</a>。</li>
            </ul>
          </div>

          <button 
            onClick={handleActivate}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-2xl font-bold shadow-lg shadow-indigo-200 transition-all active:scale-95 flex items-center justify-center space-x-2"
          >
            <span>✨ 配置馆长权限钥匙</span>
          </button>

          <p className="text-[10px] text-slate-400 font-medium">
            提示：激活后即可开启跨时空的语言重塑之旅
          </p>
        </div>
      </div>
    </div>
  );
};

export default ApiKeySelector;
