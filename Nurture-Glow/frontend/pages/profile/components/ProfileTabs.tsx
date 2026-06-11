import React from 'react';
import { BarChart3, FileText, ShieldAlert, Link2 } from 'lucide-react';
import { useTranslations } from '../../../i18n/I18nContext';
import OverviewTab from './tabs/OverviewTab';
import MedicalRecordsTab from './tabs/MedicalRecordsTab';
import VerificationSecurityTab from './tabs/VerificationSecurityTab';
import ConnectionsTab from './tabs/ConnectionsTab';
import type { Hospital, ConnectedDevice, DeviceType } from '../../../types';

interface ProfileTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  user: any;
  // Overview tab
  medical: any;
  visits: any[];
  docs: any[];
  emergencyContact: any;
  profileCompletion: number;
  healthIdStatus: string;
  // Medical Records tab
  isEditingMedical: boolean;
  onToggleMedicalEdit: () => void;
  onSaveMedical: () => void;
  onMedicalChange: (medical: any) => void;
  onDocUpload: (type: string) => void;
  onLogVisit: () => void;
  onDeleteVisit: (id: string) => void;
  // Verification & Security tab
  canRequestVerification: boolean;
  isHospitalAccount: boolean;
  verificationRequests: any[];
  isLoadingRequests: boolean;
  onRequestVerification: () => void;
  onApproveRequest: (id: number) => void;
  onRejectRequest: (req: any) => void;
  onEditEmergencyContact: () => void;
  // Connections tab
  connectedHospitals: Hospital[];
  connectedDevices: ConnectedDevice[];
  onAddDevice: (name: string, type: DeviceType) => Promise<void>;
  onRemoveDevice: (deviceId: string) => Promise<void>;
}

const ProfileTabs: React.FC<ProfileTabsProps> = (props) => {
  const { t } = useTranslations();

  const tabs = [
    { id: 'overview', label: t('profile.tabs.overview'), icon: BarChart3 },
    { id: 'medical', label: t('profile.tabs.medical'), icon: FileText },
    { id: 'verification', label: t('profile.tabs.verification'), icon: ShieldAlert },
    { id: 'connections', label: t('profile.tabs.connections'), icon: Link2 }
  ];

  return (
    <div className="space-y-8 overflow-hidden">
      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-3 pb-4 border-b border-[#C9A961]/25 dark:border-slate-800/80">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = props.activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => props.onTabChange(tab.id)}
              className={`flex items-center gap-2.5 px-6 py-3.5 font-serif font-bold text-xs uppercase tracking-wider rounded-xl transition-all duration-300 cursor-pointer border-none ${
                isActive
                  ? 'bg-gradient-to-r from-[#1B4D3E] to-[#143B2F] text-white shadow-md shadow-[#1B4D3E]/20 dark:from-[#C9A961] dark:to-[#B3934A] dark:text-[#0B0F19]'
                  : 'text-slate-600 hover:text-[#1B4D3E] dark:text-slate-400 dark:hover:text-[#C9A961] bg-white/40 hover:bg-white/80 dark:bg-slate-900/30 dark:hover:bg-slate-900/50 border border-slate-200 dark:border-slate-800'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="overflow-hidden">
        {props.activeTab === 'overview' && <OverviewTab {...props} />}
        {props.activeTab === 'medical' && <MedicalRecordsTab {...props} />}
        {props.activeTab === 'verification' && <VerificationSecurityTab {...props} />}
        {props.activeTab === 'connections' && (
          <ConnectionsTab
            hospitals={props.connectedHospitals}
            devices={props.connectedDevices}
            onAddDevice={props.onAddDevice}
            onRemoveDevice={props.onRemoveDevice}
          />
        )}
      </div>
    </div>
  );
};

export default ProfileTabs;
