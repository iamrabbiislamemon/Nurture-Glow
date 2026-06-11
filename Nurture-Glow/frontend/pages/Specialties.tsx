import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Stethoscope, Baby, Apple, Heart, BrainCircuit, Sparkles, 
  Search, ArrowRight, UserPlus, Calendar, ChevronRight, Activity
} from 'lucide-react';
import { db } from '../services/db';
import { Doctor } from '../types';
import { useTranslations } from '../i18n/I18nContext';

interface Specialty {
  id: number;
  name: string;
  description: string | null;
}

export default function Specialties() {
  const navigate = useNavigate();
  const { locale } = useTranslations();
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function loadData() {
      try {
        const [specialtiesData, doctorsData] = await Promise.all([
          db.getSpecialties(),
          db.getDoctors()
        ]);
        setSpecialties(specialtiesData || []);
        setDoctors(doctorsData || []);
      } catch (err) {
        console.error('Failed to load specialties page data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  // Map specialty names to specific Lucide icons and gradient card themes
  const getSpecialtyConfig = (name: string) => {
    const normName = name.toLowerCase();
    if (normName.includes('gyneco') || normName.includes('obstet')) {
      return {
        icon: <Baby size={28} />,
        gradient: 'from-pink-500/10 to-rose-500/10 hover:from-pink-500/15 hover:to-rose-500/15',
        iconColor: 'text-rose-500 bg-rose-50 dark:bg-rose-950/30',
        borderColor: 'group-hover:border-rose-200'
      };
    }
    if (normName.includes('pediat')) {
      return {
        icon: <Activity size={28} />,
        gradient: 'from-blue-500/10 to-indigo-500/10 hover:from-blue-500/15 hover:to-indigo-500/15',
        iconColor: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/30',
        borderColor: 'group-hover:border-indigo-200'
      };
    }
    if (normName.includes('nutri') || normName.includes('diet')) {
      return {
        icon: <Apple size={28} />,
        gradient: 'from-emerald-500/10 to-teal-500/10 hover:from-emerald-500/15 hover:to-teal-500/15',
        iconColor: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/30',
        borderColor: 'group-hover:border-emerald-200'
      };
    }
    if (normName.includes('cardio') || normName.includes('heart')) {
      return {
        icon: <Heart size={28} />,
        gradient: 'from-red-500/10 to-orange-500/10 hover:from-red-500/15 hover:to-orange-500/15',
        iconColor: 'text-red-500 bg-red-50 dark:bg-red-950/30',
        borderColor: 'group-hover:border-red-200'
      };
    }
    if (normName.includes('psych') || normName.includes('mental')) {
      return {
        icon: <BrainCircuit size={28} />,
        gradient: 'from-purple-500/10 to-violet-500/10 hover:from-purple-500/15 hover:to-violet-500/15',
        iconColor: 'text-purple-500 bg-purple-50 dark:bg-purple-950/30',
        borderColor: 'group-hover:border-purple-200'
      };
    }
    if (normName.includes('derma') || normName.includes('skin')) {
      return {
        icon: <Sparkles size={28} />,
        gradient: 'from-amber-500/10 to-orange-500/10 hover:from-amber-500/15 hover:to-orange-500/15',
        iconColor: 'text-amber-500 bg-amber-50 dark:bg-amber-950/30',
        borderColor: 'group-hover:border-amber-200'
      };
    }
    return {
      icon: <Stethoscope size={28} />,
      gradient: 'from-teal-500/10 to-cyan-500/10 hover:from-teal-500/15 hover:to-cyan-500/15',
      iconColor: 'text-teal-600 bg-teal-50 dark:bg-teal-950/30',
      borderColor: 'group-hover:border-teal-200'
    };
  };

  const getDoctorCount = (specialtyName: string) => {
    return doctors.filter(doc => doc.specialty === specialtyName).length;
  };

  const filteredSpecialties = useMemo(() => {
    return specialties.filter(spec => 
      spec.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (spec.description && spec.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [specialties, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {locale === 'bn' ? 'বিশেষজ্ঞ বিভাগসমূহ' : 'Specialist Sectors'}
          </h1>
          <p className="text-gray-500">
            {locale === 'bn' ? 'আমাদের অত্যন্ত দক্ষ ও ভেরিফাইড চিকিৎসকদের সাথে যোগাযোগ করুন' : 'Connect with certified healthcare experts across different specialty fields.'}
          </p>
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder={locale === 'bn' ? 'বিভাগ খুঁজুন...' : 'Search sectors...'}
            className="w-full bg-white border border-gray-200 rounded-2xl pl-10 pr-4 py-2.5 text-sm focus:ring-2 focus:ring-teal-200 outline-none shadow-sm transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Specialties Grid */}
      {filteredSpecialties.length === 0 ? (
        <div className="bg-white p-16 rounded-3xl text-center border-2 border-dashed border-gray-100 space-y-4">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto text-gray-300">
            <Stethoscope size={28} />
          </div>
          <p className="text-gray-400 font-medium text-lg">
            {locale === 'bn' ? 'কোনো বিভাগ পাওয়া যায়নি' : 'No specialist sectors found.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSpecialties.map(spec => {
            const config = getSpecialtyConfig(spec.name);
            const docCount = getDoctorCount(spec.name);
            return (
              <div 
                key={spec.id}
                onClick={() => navigate(`/appointments?specialty=${encodeURIComponent(spec.name)}`)}
                className={`group cursor-pointer bg-gradient-to-br ${config.gradient} p-6 rounded-3xl border border-gray-100/50 hover:shadow-xl transition-all duration-300 relative flex flex-col justify-between`}
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-3 rounded-2xl ${config.iconColor} transition-all duration-300 group-hover:scale-110`}>
                      {config.icon}
                    </div>
                    <span className="text-xs font-bold bg-white text-gray-600 px-3 py-1 rounded-full border border-gray-100 shadow-sm">
                      {docCount} {docCount === 1 ? 'Doctor' : 'Doctors'}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-teal-700 transition-colors">
                    {spec.name}
                  </h3>
                  <p className="text-xs text-gray-550 leading-relaxed mb-6">
                    {spec.description || (locale === 'bn' ? 'বিশেষজ্ঞ যত্ন ও পরামর্শ সেশন।' : 'Expert care and consulting sessions.')}
                  </p>
                </div>
                
                <div className="flex items-center justify-between pt-4 border-t border-gray-250/20 text-teal-600 group-hover:text-teal-700 font-bold text-xs uppercase tracking-wider">
                  <span>View Doctors & Book</span>
                  <div className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    <ArrowRight size={14} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Info Section */}
      <div className="bg-gradient-to-r from-teal-800 to-emerald-800 p-8 rounded-3xl text-white flex flex-col md:flex-row justify-between items-center gap-6 shadow-xl shadow-teal-900/10">
        <div className="space-y-2 text-center md:text-left">
          <h3 className="text-xl font-bold">
            {locale === 'bn' ? 'জরুরি চিকিৎসকের পরামর্শ প্রয়োজন?' : 'Need Urgent Medical Advice?'}
          </h3>
          <p className="text-teal-100 text-sm max-w-xl">
            {locale === 'bn' 
              ? 'আমাদের স্বাস্থ্য সহকারীর সাথে চ্যাট করুন অথবা দ্রুত সংযোগ স্থাপন করতে সরাসরি ফোন করুন।' 
              : 'Chat with our AI Health Assistant or search our comprehensive hospital directory for immediate aid.'}
          </p>
        </div>
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={() => navigate('/assistant')}
            className="flex-1 md:flex-none px-6 py-3 bg-white text-teal-800 rounded-2xl text-sm font-bold hover:bg-teal-50 transition-all cursor-pointer shadow-md text-center"
          >
            Ask Assistant
          </button>
          <button 
            onClick={() => navigate('/appointments')}
            className="flex-1 md:flex-none px-6 py-3 bg-teal-700/50 hover:bg-teal-700 border border-teal-600/30 text-white rounded-2xl text-sm font-bold transition-all cursor-pointer text-center"
          >
            Book Session
          </button>
        </div>
      </div>
    </div>
  );
}
