import React from 'react';
import { User, ShieldCheck, Edit3, Camera, Check, X, Share2, Activity, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { useTranslations } from '../../../i18n/I18nContext';
import IdentityCard from './IdentityCard';
import HealthIdCard from './HealthIdCard';
import EmergencyCard from './EmergencyCard';

interface ProfileHeroProps {
  user: any;
  healthIdStatus: string;
  healthIdStatusLabels: Record<string, string>;
  healthIdStatusClasses: Record<string, string>;
  canRequestVerification: boolean;
  isEditingName: boolean;
  tempName: string;
  onStartEditName: () => void;
  onCancelEditName: () => void;
  onSaveName: () => void;
  onChangeName: (name: string) => void;
  onAvatarUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  avatarRef: React.RefObject<HTMLInputElement>;
  onShareHealth: () => void;
  onRequestVerification: () => void;
  onOpenSettings: () => void;
  showSettings: boolean;
  emergencyContact?: any;
  onEditEmergencyContact: () => void;
  onSavePhone?: (phone: string) => Promise<void>;
}

const ProfileHero: React.FC<ProfileHeroProps> = ({
  user,
  healthIdStatus,
  healthIdStatusLabels,
  healthIdStatusClasses,
  canRequestVerification,
  isEditingName,
  tempName,
  onStartEditName,
  onCancelEditName,
  onSaveName,
  onChangeName,
  onAvatarUpload,
  avatarRef,
  onShareHealth,
  onRequestVerification,
  onOpenSettings,
  showSettings,
  emergencyContact,
  onEditEmergencyContact,
  onSavePhone
}) => {
  const { t } = useTranslations();

  return (
    <div className="relative bg-gradient-to-br from-[#FAF8F5] via-[#EBE7DF]/40 to-[#FAF8F5] dark:from-[#0B0F19] dark:via-[#121826] dark:to-[#0B0F19] border-b border-[#C9A961]/20 dark:border-slate-800/80 py-8 md:py-16 overflow-hidden">
      {/* Drifting Kinetic Background Auras */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 right-10 w-96 h-96 bg-[#C9A961]/5 dark:bg-[#C9A961]/3 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-10 left-10 w-72 h-72 bg-emerald-500/5 dark:bg-emerald-500/3 rounded-full blur-2xl"></div>
      </div>



      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 space-y-12">
        {/* Main Profile Header - Premium Design */}
        <div className="flex flex-col md:flex-row gap-10 items-start md:items-center">
          {/* Avatar - Enhanced with Premium Styling */}
          <motion.div 
            className="relative group flex-shrink-0"
            whileHover={{ scale: 1.05 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
          >
            <div className="w-36 h-36 md:w-48 md:h-48 rounded-full overflow-hidden ring-4 ring-[#C9A961]/25 dark:ring-[#C9A961]/15 border-4 border-white dark:border-[#121826] shadow-2xl bg-gradient-to-br from-[#FFFFFF] to-[#FAF8F5] dark:from-[#121826] dark:to-[#0B0F19]">
              <img src={user.avatar} loading="lazy" className="w-full h-full object-cover" alt={user.name} />
            </div>
            {/* Premium camera button */}
            <motion.button
              onClick={() => avatarRef.current?.click()}
              className="absolute bottom-2 right-2 p-3 bg-[#1B4D3E] dark:bg-[#C9A961] text-[#FFFFFF] dark:text-[#0B0F19] rounded-full shadow-lg border-2 border-white dark:border-[#121826] cursor-pointer"
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.95 }}
            >
              <Camera size={20} />
            </motion.button>
            <input type="file" ref={avatarRef} className="hidden" accept="image/*" onChange={onAvatarUpload} />
          </motion.div>

          {/* Name & Basic Info - Premium Typography */}
          <div className="flex-1 space-y-6">
            <div className="space-y-3">
              {isEditingName ? (
                <div className="flex items-center gap-2">
                  <input
                    value={tempName}
                    onChange={(e) => onChangeName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') onSaveName();
                      if (e.key === 'Escape') onCancelEditName();
                    }}
                    autoFocus
                    className="text-4xl md:text-5xl font-serif font-bold text-[#1B4D3E] dark:text-[#FFFFFF] bg-white dark:bg-[#121826] rounded-2xl px-6 py-3 outline-none border-2 border-[#C9A961]/40 max-w-md transition-all shadow-inner"
                    aria-label={t('profile.editUsername')}
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={onSaveName}
                      className="p-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition-all active:scale-90"
                      aria-label={t('profile.saveName')}
                    >
                      <Check size={18} />
                    </button>
                    <button
                      onClick={onCancelEditName}
                      className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-all active:scale-90"
                      aria-label={t('profile.cancelEdit')}
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4 group/name">
                    <div className="space-y-1">
                      <h1 className="text-4xl md:text-5xl font-serif font-black text-[#1B4D3E] dark:text-[#FFFFFF] tracking-tight leading-tight">{user.name}</h1>
                      <p className="text-xs text-[#C9A961] font-serif italic tracking-widest uppercase mt-0.5">{t('profile.hero.member')}</p>
                    </div>
                    <button
                      onClick={onStartEditName}
                      className="p-2.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50/50 rounded-lg transition-all md:opacity-0 md:group-hover/name:opacity-100 focus:opacity-100"
                      aria-label={t('profile.editUsername')}
                    >
                      <Edit3 size={20} />
                    </button>
                  </div>
                  <div
                    className={`w-fit px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest flex items-center gap-1.5 border font-serif italic ${
                      user.verified === 'Verified' 
                        ? 'bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-450 border-emerald-200/50 dark:border-emerald-800/30' 
                        : 'bg-amber-50/50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-450 border-amber-200/50 dark:border-amber-800/30'
                    }`}
                  >
                    {user.verified === 'Verified' ? <ShieldCheck size={14} /> : <Activity size={14} />}
                    {user.verified === 'Verified' ? t('profile.verified') : t('profile.notVerified')}
                  </div>
                </div>
              )}
              <p className="text-slate-500 dark:text-slate-400 font-medium text-sm tracking-wide">{user.email}</p>
            </div>

            {/* Action Buttons - Premium Styling */}
            <div className="flex flex-wrap gap-3 pt-6">
              <motion.button
                onClick={onShareHealth}
                className="px-7 py-3.5 bg-gradient-to-r from-[#1B4D3E] to-[#143B2F] text-white rounded-xl font-semibold shadow-md shadow-emerald-950/20 flex items-center gap-2 text-[10px] uppercase tracking-widest cursor-pointer border-none font-bold shimmer-hover"
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.98 }}
              >
                <Share2 size={16} /> {t('profile.shareId')}
              </motion.button>
              <motion.button
                onClick={onRequestVerification}
                disabled={!canRequestVerification}
                className={`px-7 py-3.5 rounded-xl font-semibold shadow-md flex items-center gap-2 text-[10px] uppercase tracking-widest cursor-pointer shimmer-hover ${
                  canRequestVerification
                    ? 'bg-gradient-to-r from-[#C9A961] to-[#B3934A] text-[#FFFFFF] dark:text-[#0B0F19] shadow-[#C9A961]/25 border-none font-bold'
                    : 'opacity-40 cursor-not-allowed bg-slate-200 dark:bg-slate-800/60 text-slate-400 dark:text-slate-600 border border-transparent'
                }`}
                whileHover={canRequestVerification ? { scale: 1.03, y: -2 } : {}}
                whileTap={canRequestVerification ? { scale: 0.98 } : {}}
              >
                {t('profile.requestVerification')}
              </motion.button>
              <motion.button
                onClick={onOpenSettings}
                className={`p-3.5 rounded-xl cursor-pointer ${
                  showSettings
                    ? 'bg-gradient-to-br from-slate-800 to-slate-900 text-white shadow-md'
                    : 'bg-white dark:bg-[#121826] text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800'
                }`}
                whileHover={{ scale: 1.08, rotate: 45 }}
                whileTap={{ scale: 0.95 }}
              >
                <Settings size={20} />
              </motion.button>
            </div>
          </div>
        </div>

        {/* Hero Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <IdentityCard user={user} onSavePhone={onSavePhone} />
          <HealthIdCard
            user={user}
            healthIdStatus={healthIdStatus}
            healthIdStatusLabels={healthIdStatusLabels}
            healthIdStatusClasses={healthIdStatusClasses}
          />
          <EmergencyCard
            name={emergencyContact?.name}
            phone={emergencyContact?.phone}
            relation={emergencyContact?.relation}
            onEdit={onEditEmergencyContact}
          />
        </div>
      </div>
    </div>
  );
};

export default ProfileHero;
