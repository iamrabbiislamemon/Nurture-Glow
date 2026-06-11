import React, { useState } from 'react';
import { User, Mail, Phone, Edit3, Check, X } from 'lucide-react';
import { useTranslations } from '../../../i18n/I18nContext';

interface IdentityCardProps {
  user: any;
  onSavePhone?: (phone: string) => Promise<void>;
}

const IdentityCard: React.FC<IdentityCardProps> = ({ user, onSavePhone }) => {
  const { t } = useTranslations();
  const [isEditingPhone, setIsEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState(user.phone || '');

  const handleSavePhone = async () => {
    if (!phoneValue.trim() || !onSavePhone) return;
    await onSavePhone(phoneValue.trim());
    setIsEditingPhone(false);
  };

  return (
    <div className="relative bg-white dark:bg-[#121826] rounded-3xl p-6 border border-[#C9A961]/25 dark:border-slate-800/80 shadow-sm hover:shadow-md transition-all overflow-hidden group">
      {/* Subtle decorative accent */}
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-[#1B4D3E] via-[#C9A961] to-[#1B4D3E] rounded-t-3xl" />

      {/* Header */}
      <div className="flex items-center gap-2.5 mt-1 mb-4">
        <div className="p-2 bg-emerald-50 dark:bg-emerald-950/20 rounded-xl text-[#1B4D3E] dark:text-emerald-400">
          <User size={18} />
        </div>
        <h3 className="text-sm font-serif font-black text-[#1B4D3E] dark:text-[#C9A961] uppercase tracking-wider">Personal Identity</h3>
      </div>

      {/* Info rows */}
      <div className="space-y-3">
        {/* Email row */}
        <div className="flex items-center gap-3 p-3.5 bg-[#FAF9F5] dark:bg-slate-900/40 rounded-2xl border border-[#C9A961]/10 dark:border-slate-800/40">
          <div className="p-1.5 bg-white dark:bg-[#121826] rounded-lg shadow-sm text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-800">
            <Mail size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Email Address</p>
            <p className="text-sm font-bold text-gray-800 dark:text-white truncate">{user.email}</p>
          </div>
        </div>

        {/* Phone row */}
        <div className="flex items-center gap-3 p-3.5 bg-emerald-50/30 dark:bg-emerald-950/10 rounded-2xl border border-emerald-100/30 dark:border-emerald-900/20 min-w-0">
          <div className="p-1.5 bg-white dark:bg-[#121826] rounded-lg shadow-sm text-[#1B4D3E] dark:text-emerald-400 border border-emerald-100/50 dark:border-emerald-900/30">
            <Phone size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              {t('profile.phone.title')}
            </p>
            {isEditingPhone ? (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="tel"
                  value={phoneValue}
                  onChange={(e) => setPhoneValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSavePhone();
                    if (e.key === 'Escape') setIsEditingPhone(false);
                  }}
                  placeholder={t('profile.phone.placeholder')}
                  autoFocus
                  className="text-sm font-bold text-gray-800 dark:text-white bg-white dark:bg-[#121826] rounded-lg px-2 py-1 outline-none border border-emerald-300 dark:border-emerald-800 w-full"
                />
                <button
                  onClick={handleSavePhone}
                  className="p-1 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 transition-all cursor-pointer"
                >
                  <Check size={12} />
                </button>
                <button
                  onClick={() => setIsEditingPhone(false)}
                  className="p-1 bg-slate-200 text-slate-600 rounded-md hover:bg-slate-300 transition-all cursor-pointer"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <a href={user.phone ? `tel:${user.phone}` : undefined} className="text-sm font-bold text-gray-800 dark:text-white hover:text-[#1B4D3E] dark:hover:text-[#C9A961] truncate">
                  {user.phone || '—'}
                </a>
                {onSavePhone && (
                  <button
                    onClick={() => {
                      setPhoneValue(user.phone || '');
                      setIsEditingPhone(true);
                    }}
                    className="p-1 text-slate-400 hover:text-emerald-600 rounded transition-all cursor-pointer"
                    title={t('profile.phone.edit')}
                  >
                    <Edit3 size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default IdentityCard;
