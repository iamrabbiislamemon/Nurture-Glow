import React from 'react';
import { CheckCircle2, AlertCircle, Phone } from 'lucide-react';

interface NextActionsCardProps {
  medical: any;
  emergencyContact: any;
  healthIdStatus: string;
  hasVisits: boolean;
  hasDocs: boolean;
  onEditEmergencyContact: () => void;
}

const NextActionsCard: React.FC<NextActionsCardProps> = ({
  medical,
  emergencyContact,
  healthIdStatus,
  hasVisits,
  hasDocs,
  onEditEmergencyContact
}) => {
  const actions = [];

  if (!medical.bloodGroup) {
    actions.push({ text: 'Add blood group', type: 'medical' });
  }
  if (!emergencyContact.name) {
    actions.push({ text: 'Add emergency contact', type: 'contact', action: onEditEmergencyContact });
  }
  if (healthIdStatus === 'unverified' || healthIdStatus === 'rejected') {
    actions.push({ text: 'Request verification', type: 'verification' });
  }
  if (!hasVisits && !hasDocs) {
    actions.push({ text: 'Upload documents or log a visit', type: 'content' });
  }

  return (
    <div className="bg-white dark:bg-[#121826] rounded-3xl p-8 border border-[#C9A961]/25 dark:border-slate-800/80 shadow-sm hover:shadow-md transition-all">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-gradient-to-br from-amber-50 to-[#E6C77A]/25 dark:from-amber-950/20 dark:to-amber-900/10 rounded-2xl text-amber-600 dark:text-[#C9A961]">
          <AlertCircle size={24} />
        </div>
        <h3 className="text-lg font-serif font-black text-[#1B4D3E] dark:text-[#C9A961]">Next Actions</h3>
      </div>

      {actions.length === 0 ? (
        <div className="text-center py-8">
          <CheckCircle2 size={48} className="mx-auto text-teal-650 dark:text-teal-400 mb-3" />
          <p className="text-sm font-bold text-gray-800 dark:text-white">All set!</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Your profile is complete</p>
        </div>
      ) : (
        <div className="space-y-3">
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={action.action}
              className="w-full p-4 bg-gradient-to-r from-[#FAF9F5] to-white dark:from-slate-900/30 dark:to-[#121826] rounded-2xl border border-[#C9A961]/15 dark:border-slate-800 hover:border-[#C9A961]/40 dark:hover:border-[#C9A961]/35 hover:shadow-sm transition-all text-left group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white dark:bg-slate-900 rounded-lg text-amber-600 dark:text-[#C9A961] border border-amber-100/50 dark:border-slate-800 group-hover:bg-amber-50 dark:group-hover:bg-amber-950/20">
                  <AlertCircle size={16} />
                </div>
                <p className="text-sm font-bold text-gray-700 dark:text-slate-350 group-hover:text-amber-700 dark:group-hover:text-[#C9A961] transition-colors">
                  {action.text}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default NextActionsCard;
