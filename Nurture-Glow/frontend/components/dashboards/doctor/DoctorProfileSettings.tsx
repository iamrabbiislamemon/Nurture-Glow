import React, { useEffect, useState } from 'react';
import { Save, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { apiFetch } from '../../../services/api';

interface Specialty {
  id: number;
  name: string;
}

interface DoctorProfile {
  id: string;
  fullName: string;
  specialtyId: number | null;
  specialtyName: string | null;
  phone: string;
  email: string;
  feeAmount: number;
  verified: boolean;
  rating: number | null;
  availabilityStatus: string;
  consultationType: string;
  hospital: string;
  bio: string;
  experience: string;
  bmdcNumber: string;
  availableSpecialties: Specialty[];
}

const DoctorProfileSettings: React.FC = () => {
  const [profile, setProfile] = useState<DoctorProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [specialtyId, setSpecialtyId] = useState<number | string>('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [feeAmount, setFeeAmount] = useState('');
  const [consultationType, setConsultationType] = useState('Both');
  const [hospital, setHospital] = useState('');
  const [bio, setBio] = useState('');
  const [experience, setExperience] = useState('');
  const [bmdcNumber, setBmdcNumber] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiFetch<DoctorProfile>('/api/doctor/profile');
      setProfile(data);
      setFullName(data.fullName || '');
      setSpecialtyId(data.specialtyId ?? '');
      setPhone(data.phone || '');
      setEmail(data.email || '');
      setFeeAmount(String(data.feeAmount || ''));
      setConsultationType(data.consultationType || 'Both');
      setHospital(data.hospital || '');
      setBio(data.bio || '');
      setExperience(data.experience || '');
      setBmdcNumber(data.bmdcNumber || '');
    } catch (err: any) {
      setError(err?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      await apiFetch('/api/doctor/profile', {
        method: 'PUT',
        body: JSON.stringify({
          fullName,
          specialtyId: specialtyId ? Number(specialtyId) : null,
          phone,
          email,
          feeAmount: Number(feeAmount) || 0,
          consultationType,
          hospital,
          bio,
          experience,
          bmdcNumber
        })
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 text-teal-600 animate-spin" />
        <span className="ml-3 text-gray-600">Loading profile...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-br from-white/90 to-white/70 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/50 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900 mb-1">Profile &amp; Practice Settings</h2>
        <p className="text-sm text-gray-500">
          Configure your professional profile, consultation preferences, and payment settings.
          Patients will see these details when booking appointments.
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
          <AlertCircle size={18} className="text-red-500 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <CheckCircle size={18} className="text-emerald-500 flex-shrink-0" />
          <p className="text-sm text-emerald-700">Profile saved successfully!</p>
        </div>
      )}

      {/* Personal Information */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/40 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Dr. Full Name"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="doctor@example.com"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+880..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">BMDC Registration No.</label>
            <input
              type="text"
              value={bmdcNumber}
              onChange={(e) => setBmdcNumber(e.target.value)}
              placeholder="A-12345"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Professional Details */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/40 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Professional Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Specialty</label>
            <select
              value={specialtyId}
              onChange={(e) => setSpecialtyId(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent bg-white"
            >
              <option value="">Select specialty...</option>
              {(profile?.availableSpecialties || []).map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Years of Experience</label>
            <input
              type="text"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              placeholder="e.g. 10"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Hospital / Clinic Affiliation</label>
            <input
              type="text"
              value={hospital}
              onChange={(e) => setHospital(e.target.value)}
              placeholder="e.g. Dhaka Medical College Hospital"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Bio / About</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              placeholder="Tell patients about your qualifications and experience..."
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent resize-none"
            />
          </div>
        </div>
      </div>

      {/* Consultation Settings */}
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 border border-gray-200/40 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Consultation Settings</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Consultation Fee (BDT)</label>
            <input
              type="number"
              min="0"
              step="50"
              value={feeAmount}
              onChange={(e) => setFeeAmount(e.target.value)}
              placeholder="e.g. 1000"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Consultation Type</label>
            <div className="flex gap-3 mt-1">
              {['Online', 'Offline', 'Both'].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setConsultationType(type)}
                  className={`flex-1 py-2.5 rounded-xl font-medium text-sm border transition-all ${
                    consultationType === type
                      ? 'bg-teal-500 text-white border-teal-500 shadow-md'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-teal-300 hover:bg-teal-50'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {consultationType === 'Online' && 'Patients can book video/phone consultations only.'}
              {consultationType === 'Offline' && 'Patients can book in-person visits at your clinic only.'}
              {consultationType === 'Both' && 'Patients can choose between online and in-person visits.'}
            </p>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-teal-500 to-emerald-500 text-white font-semibold rounded-2xl shadow-lg hover:shadow-xl hover:scale-[1.02] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {saving ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Save size={18} />
          )}
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </div>
    </div>
  );
};

export default DoctorProfileSettings;
