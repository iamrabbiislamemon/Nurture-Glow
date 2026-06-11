import React from 'react';
import { Heart, Droplet, AlertTriangle } from 'lucide-react';
import { useTranslations } from '../../../../i18n/I18nContext';

interface HealthSnapshotCardProps {
  medical: any;
  healthIdStatus: string;
  lastVisit: string | null;
}

const HealthSnapshotCard: React.FC<HealthSnapshotCardProps> = ({
  medical,
  healthIdStatus,
  lastVisit
}) => {
  const { t } = useTranslations();

  return (
    <div className="bg-white dark:bg-[#121826] rounded-3xl p-8 border border-[#C9A961]/25 dark:border-slate-800/80 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-gradient-to-br from-red-50 to-pink-50/50 dark:from-red-950/20 dark:to-red-900/10 rounded-2xl text-red-500 dark:text-red-400">
          <Heart size={24} />
        </div>
        <h3 className="text-lg font-serif font-black text-[#1B4D3E] dark:text-[#C9A961]">Health Snapshot</h3>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 bg-[#FAF9F5] dark:bg-slate-900/40 rounded-2xl border border-[#C9A961]/10 dark:border-slate-800/40">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Blood Group</span>
          <span className="text-base font-serif font-black text-[#1B4D3E] dark:text-white">{medical.bloodGroup || '—'}</span>
        </div>

        <div className="flex items-center justify-between p-4 bg-[#FAF9F5] dark:bg-slate-900/40 rounded-2xl border border-[#C9A961]/10 dark:border-slate-800/40">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Allergies</span>
          <span className="text-sm font-bold text-gray-800 dark:text-white">{medical.allergies ? '⚠️ Yes' : '✓ None'}</span>
        </div>

        <div className="flex items-center justify-between p-4 bg-[#FAF9F5] dark:bg-slate-900/40 rounded-2xl border border-[#C9A961]/10 dark:border-slate-800/40">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Diabetes</span>
          <span className="text-sm font-bold text-gray-800 dark:text-white">{medical.diabetesStatus ? '⚠️ Yes' : '✓ No'}</span>
        </div>

        <div className="pt-4 border-t border-slate-100 dark:border-slate-850">
          <p className="text-[9px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-widest mb-2">Status</p>
          <p className="text-sm font-bold text-gray-700 dark:text-slate-300">Health ID: <span className="text-[#1B4D3E] dark:text-[#C9A961] font-serif italic">{healthIdStatus}</span></p>
          {lastVisit && <p className="text-xs text-slate-450 dark:text-slate-500 mt-2 italic font-serif">Last visit: {lastVisit}</p>}
        </div>
      </div>
    </div>
  );
};

export default HealthSnapshotCard;
