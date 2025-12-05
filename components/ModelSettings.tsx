
import React from 'react';
import { ModelType, AspectRatio } from '../types';
import { Settings2, Zap, Crown, Box, RectangleHorizontal, RectangleVertical } from 'lucide-react';

interface ModelSettingsProps {
  modelType: ModelType;
  setModelType: (type: ModelType) => void;
  aspectRatio: AspectRatio;
  setAspectRatio: (ratio: AspectRatio) => void;
  disabled: boolean;
}

const ModelSettings: React.FC<ModelSettingsProps> = ({
  modelType,
  setModelType,
  aspectRatio,
  setAspectRatio,
  disabled
}) => {
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-5 shadow-lg mb-6">
      <div className="flex items-center gap-2 mb-4 text-zinc-300 font-semibold text-sm">
        <Settings2 size={16} />
        Generation Settings
      </div>

      <div className="space-y-5">
        {/* Model Selection */}
        <div>
          <label className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-2 block">
            Model Engine
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setModelType('standard')}
              disabled={disabled}
              className={`
                relative p-3 rounded-xl border flex flex-col items-center gap-2 transition-all
                ${modelType === 'standard' 
                  ? 'bg-zinc-800 border-zinc-600 text-white shadow-inner' 
                  : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:border-zinc-700'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <Zap size={20} className={modelType === 'standard' ? "text-yellow-400" : "text-zinc-600"} />
              <div className="text-center">
                <div className="text-xs font-bold">Flash Lite</div>
                <div className="text-[10px] opacity-60">Fast & Efficient</div>
              </div>
            </button>

            <button
              onClick={() => setModelType('pro')}
              disabled={disabled}
              className={`
                relative p-3 rounded-xl border flex flex-col items-center gap-2 transition-all
                ${modelType === 'pro' 
                  ? 'bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border-purple-500 text-white shadow-lg shadow-purple-900/20' 
                  : 'bg-zinc-900/50 border-zinc-800 text-zinc-500 hover:bg-zinc-800 hover:border-zinc-700'}
                ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              `}
            >
              <div className="absolute top-1 right-2 text-[8px] bg-gradient-to-r from-yellow-500 to-orange-500 text-black px-1.5 rounded-full font-bold">
                PRO
              </div>
              <Crown size={20} className={modelType === 'pro' ? "text-purple-400" : "text-zinc-600"} />
              <div className="text-center">
                <div className="text-xs font-bold">Banana Pro</div>
                <div className="text-[10px] opacity-60">High Quality</div>
              </div>
            </button>
          </div>
        </div>

        {/* Aspect Ratio Selection */}
        <div>
          <label className="text-xs text-zinc-500 font-bold uppercase tracking-wider mb-2 block">
            Aspect Ratio
          </label>
          <div className="grid grid-cols-5 gap-1">
            {(['1:1', '3:4', '4:3', '9:16', '16:9'] as AspectRatio[]).map((ratio) => (
              <button
                key={ratio}
                onClick={() => setAspectRatio(ratio)}
                disabled={disabled}
                className={`
                  py-2 rounded-lg text-[10px] font-bold border transition-all flex flex-col items-center justify-center gap-1
                  ${aspectRatio === ratio 
                    ? 'bg-zinc-800 border-zinc-500 text-white' 
                    : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:bg-zinc-800'}
                   ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
                `}
              >
                {ratio === '1:1' && <Box size={14} />}
                {(ratio === '3:4' || ratio === '9:16') && <RectangleVertical size={14} className={ratio === '9:16' ? "scale-y-125" : ""} />}
                {(ratio === '4:3' || ratio === '16:9') && <RectangleHorizontal size={14} className={ratio === '16:9' ? "scale-x-125" : ""} />}
                {ratio}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelSettings;
