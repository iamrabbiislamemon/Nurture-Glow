import React from 'react';
import { TrendingUp, Check, Lock } from 'lucide-react';

interface CompletionChecklistItem {
  label: string;
  completed: boolean;
  required: boolean;
}

interface ProfileStrengthCardProps {
  completion: number;
  items?: CompletionChecklistItem[];
}

const ProfileStrengthCard: React.FC<ProfileStrengthCardProps> = ({ 
  completion,
  items = [
    { label: 'Full name', completed: true, required: true },
    { label: 'Profile picture', completed: true, required: true },
    { label: 'Blood group', completed: false, required: false },
    { label: 'Emergency contact', completed: false, required: false },
    { label: 'Medical records', completed: false, required: false },
    { label: 'Health ID verified', completed: false, required: false }
  ]
}) => {
  const completedItems = items.filter(item => item.completed).length;
  const requiredItems = items.filter(item => item.required);
  const allRequiredComplete = requiredItems.every(item => item.completed);

  // Circular progress indicator
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (completion / 100) * circumference;

  return (
    <div className="bg-white dark:bg-[#121826] rounded-3xl p-8 border border-[#C9A961]/25 dark:border-slate-800/80 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-gradient-to-br from-teal-50 to-[#BFE6DA]/20 dark:from-emerald-950/20 dark:to-emerald-900/10 rounded-2xl text-[#1B4D3E] dark:text-emerald-400">
          <TrendingUp size={24} />
        </div>
        <div>
          <h3 className="text-lg font-serif font-black text-[#1B4D3E] dark:text-[#C9A961]">Profile Strength</h3>
          <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-1">Complete your profile checklist</p>
        </div>
      </div>

      {/* Circular Progress Indicator */}
      <div className="flex flex-col items-center gap-6 mb-8">
        <div className="relative w-32 h-32">
          <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="#f3f4f6"
              strokeWidth="6"
              className="dark:stroke-slate-900"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="45"
              fill="none"
              stroke="url(#progressGradient)"
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              className="transition-all duration-500"
            />
            <defs>
              <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#1B4D3E" className="dark:stop-[#C9A961]" />
                <stop offset="100%" stopColor="#C9A961" className="dark:stop-[#BFE6DA]" />
              </linearGradient>
            </defs>
          </svg>
          {/* Center text */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-serif font-black text-[#1B4D3E] dark:text-[#C9A961]">{completion}%</span>
            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mt-0.5">Complete</span>
          </div>
        </div>

        {/* Status text */}
        <div className="text-center">
          <p className="text-sm font-bold text-gray-800 dark:text-white">
            {completedItems} of {items.length} items
          </p>
          <p className="text-xs text-[#C9A961] font-serif italic mt-1">
            {allRequiredComplete ? '✓ All required items complete' : 'Add required items to get verified'}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full h-2 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden mb-8">
        <div
          className="h-full bg-gradient-to-r from-[#1B4D3E] via-[#C9A961] to-[#1B4D3E] dark:from-[#C9A961] dark:via-[#BFE6DA] dark:to-[#C9A961] transition-all duration-500"
          style={{ width: `${completion}%` }}
        />
      </div>

      {/* Checklist */}
      <div className="space-y-4">
        {/* Completed Items */}
        {items.filter(item => item.completed).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Check size={14} className="text-green-600 dark:text-green-400" />
              Completed
            </h4>
            <div className="space-y-2 pl-6">
              {items.map((item, idx) => item.completed && (
                <div key={idx} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Missing Items */}
        {items.filter(item => !item.completed).length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <Lock size={14} className="text-slate-400 dark:text-slate-600" />
              Missing Items
            </h4>
            <div className="space-y-2 pl-6">
              {items.map((item, idx) => !item.completed && (
                <div key={idx} className="flex items-center gap-2 text-xs text-gray-500 dark:text-slate-500">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-slate-800"></div>
                  <span>
                    {item.label}
                    {item.required && <span className="text-red-500 ml-1">*</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-6 pt-6 border-t border-slate-100 dark:border-slate-850">
        * Required items needed for full verification
      </p>
    </div>
  );
};

export default ProfileStrengthCard;
