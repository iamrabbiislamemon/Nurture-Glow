import React from 'react';
import { AlertCircle, Phone, Edit3, User, Heart } from 'lucide-react';

interface EmergencyCardProps {
  name?: string;
  phone?: string;
  relation?: string;
  onEdit: () => void;
}

const EmergencyCard: React.FC<EmergencyCardProps> = ({
  name,
  phone,
  relation,
  onEdit
}) => {
  const isComplete = name && phone && relation;

  return (
    <div className="relative bg-white dark:bg-[#121826] rounded-3xl p-6 border border-[#C9A961]/25 dark:border-slate-800/80 shadow-sm hover:shadow-md transition-all overflow-hidden group">
      {/* Subtle decorative accent */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#1B4D3E] via-[#C9A961] to-red-500 rounded-t-3xl" />

      {/* Header */}
      <div className="flex items-center justify-between gap-3 mt-1 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-red-50 dark:bg-red-950/20 rounded-xl text-red-500 dark:text-red-400">
            <AlertCircle size={18} />
          </div>
          <h3 className="text-sm font-serif font-black text-[#1B4D3E] dark:text-[#C9A961] uppercase tracking-wider">Emergency Contact</h3>
        </div>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-serif italic text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900 hover:bg-[#EBE7DF]/60 dark:hover:bg-slate-800/80 rounded-lg border border-slate-200 dark:border-slate-800 transition-all cursor-pointer"
          aria-label="Edit emergency contact"
        >
          <Edit3 size={13} />
          <span>Edit</span>
        </button>
      </div>

      {isComplete ? (
        <div className="space-y-3">
          {/* Name row */}
          <div className="flex items-center gap-3 p-3.5 bg-[#FAF9F5] dark:bg-slate-900/40 rounded-2xl border border-[#C9A961]/10 dark:border-slate-800/40">
            <div className="p-1.5 bg-white dark:bg-[#121826] rounded-lg shadow-sm text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-800">
              <User size={15} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Name</p>
              <p className="text-sm font-bold text-gray-800 dark:text-white truncate">{name}</p>
            </div>
          </div>

          {/* Phone & Relation row */}
          <div className="grid grid-cols-[1fr,auto] gap-3">
            <a
              href={`tel:${phone}`}
              className="flex items-center gap-3 p-3.5 bg-emerald-50/30 dark:bg-emerald-950/10 rounded-2xl border border-emerald-100/30 dark:border-emerald-900/20 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors min-w-0"
            >
              <div className="p-1.5 bg-white dark:bg-[#121826] rounded-lg shadow-sm text-[#1B4D3E] dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30">
                <Phone size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Phone</p>
                <p className="text-sm font-bold text-gray-800 dark:text-white truncate">{phone}</p>
              </div>
            </a>

            <div className="flex items-center gap-3 p-3.5 bg-purple-50/30 dark:bg-purple-950/10 rounded-2xl border border-purple-100/30 dark:border-purple-900/20 min-w-[110px]">
              <div className="p-1.5 bg-white dark:bg-[#121826] rounded-lg shadow-sm text-purple-500 dark:text-purple-400 border border-purple-100/50 dark:border-purple-900/30">
                <Heart size={15} />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Relation</p>
                <p className="text-sm font-bold text-gray-800 dark:text-white capitalize truncate">{relation}</p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 bg-gradient-to-br from-red-50/30 to-[#FAF9F5] dark:from-red-950/5 dark:to-slate-900/20 rounded-2xl border border-dashed border-[#C9A961]/30 dark:border-slate-800 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100/80 dark:bg-red-950/40 rounded-full">
            <AlertCircle size={22} className="text-red-500 dark:text-red-400" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-800 dark:text-white">No Contact Added</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Add someone to reach in urgent situations</p>
          </div>
          <button
            onClick={onEdit}
            className="w-full px-4 py-3 bg-gradient-to-r from-[#1B4D3E] to-[#143B2F] text-white text-[10px] font-bold uppercase tracking-widest rounded-xl hover:from-[#143B2F] hover:to-[#0E2A21] transition-all shadow-md shadow-emerald-950/20 active:scale-[0.98] cursor-pointer border-none"
          >
            + Add Emergency Contact
          </button>
        </div>
      )}
    </div>
  );
};

export default EmergencyCard;
