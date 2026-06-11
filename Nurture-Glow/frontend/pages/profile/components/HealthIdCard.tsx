import React from 'react';
import { ShieldCheck, Hash, CheckCircle2 } from 'lucide-react';

interface HealthIdCardProps {
  user: any;
  healthIdStatus: string;
  healthIdStatusLabels: Record<string, string>;
  healthIdStatusClasses: Record<string, string>;
}

const HealthIdCard: React.FC<HealthIdCardProps> = ({
  user,
  healthIdStatus,
  healthIdStatusLabels,
  healthIdStatusClasses
}) => {
  return (
    <div className="relative bg-white dark:bg-[#121826] rounded-3xl p-6 border border-[#C9A961]/25 dark:border-slate-800/80 shadow-sm hover:shadow-md transition-all overflow-hidden group">
      {/* Subtle decorative accent */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#C9A961] via-[#E6C77A] to-[#C9A961] rounded-t-3xl" />

      {/* Header */}
      <div className="flex items-center gap-2.5 mt-1 mb-4">
        <div className="p-2 bg-amber-50 dark:bg-amber-950/20 rounded-xl text-amber-600 dark:text-amber-400">
          <ShieldCheck size={18} />
        </div>
        <h3 className="text-sm font-serif font-black text-[#1B4D3E] dark:text-[#C9A961] uppercase tracking-wider">Health ID</h3>
      </div>

      {/* Info rows */}
      <div className="space-y-3">
        {/* Health ID Number */}
        <div className="flex items-center gap-3 p-3.5 bg-[#FAF9F5] dark:bg-slate-900/40 rounded-2xl border border-[#C9A961]/10 dark:border-slate-800/40">
          <div className="p-1.5 bg-white dark:bg-[#121826] rounded-lg shadow-sm text-slate-400 dark:text-slate-505 border border-slate-100 dark:border-slate-800">
            <Hash size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Your Health ID Number</p>
            <p className="text-sm font-bold text-gray-800 dark:text-white tracking-tight">{user.healthId}</p>
          </div>
        </div>

        {/* Verification Status */}
        <div className={`flex items-center gap-3 p-3.5 rounded-2xl border min-w-0 transition-all ${
          healthIdStatus === 'accepted' 
            ? 'bg-emerald-55/30 dark:bg-emerald-950/10 border-emerald-100/30 dark:border-emerald-900/20' 
            : healthIdStatus === 'pending' 
              ? 'bg-amber-55/30 dark:bg-amber-950/10 border-amber-100/30 dark:border-amber-900/20' 
              : 'bg-[#FAF9F5] dark:bg-slate-900/40 border-[#C9A961]/10 dark:border-slate-800/40'
        }`}>
          <div className={`p-1.5 bg-white dark:bg-[#121826] rounded-lg shadow-sm border ${
            healthIdStatus === 'accepted' ? 'text-emerald-500 border-emerald-100 dark:border-emerald-900/30' 
            : healthIdStatus === 'pending' ? 'text-amber-500 border-amber-100 dark:border-amber-900/30' 
            : 'text-slate-400 border-slate-100 dark:border-slate-800'
          }`}>
            <CheckCircle2 size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Verification Status</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`w-2 h-2 rounded-full ${
                healthIdStatus === 'accepted' ? 'bg-emerald-500' : healthIdStatus === 'pending' ? 'bg-amber-500' : 'bg-slate-400'
              }`} />
              <p className={`text-sm font-bold ${
                healthIdStatus === 'accepted' ? 'text-emerald-700 dark:text-emerald-400' 
                : healthIdStatus === 'pending' ? 'text-amber-700 dark:text-amber-400' 
                : 'text-gray-800 dark:text-white'
              }`}>
                {healthIdStatusLabels[healthIdStatus]}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HealthIdCard;
