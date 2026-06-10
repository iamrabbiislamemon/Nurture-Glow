import React from 'react';
import { Sparkles, Calendar, ShieldCheck, Heart } from 'lucide-react';

export const SemanticDemoCard: React.FC = () => {
  return (
    <div className="min-h-screen bg-page flex items-center justify-center p-6 transition-colors duration-300">
      <div className="max-w-md w-full bg-surface border border-line rounded-3xl p-6 shadow-card hover:shadow-card-hover transition-all duration-300">
        
        {/* Card Header with Brand Colors */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-brand-emerald/10 flex items-center justify-center text-brand-emerald">
              <Heart size={20} fill="currentColor" />
            </div>
            <div>
              <h3 className="text-base font-bold text-heading font-display leading-tight">
                Nurture Glow Care
              </h3>
              <p className="text-xs text-muted-text font-medium uppercase tracking-wider">
                Premium Tier
              </p>
            </div>
          </div>
          
          <span className="flex items-center gap-1 px-3 py-1 bg-brand-gold/15 text-brand-gold text-[10px] font-bold uppercase tracking-wider rounded-full">
            <Sparkles size={10} />
            Active
          </span>
        </div>

        {/* Semantic Content Info Block */}
        <div className="space-y-4 mb-6">
          <h1 className="text-2xl font-bold text-heading font-display tracking-tight leading-snug">
            Your Pregnancy & Care Journey is Secured
          </h1>
          <p className="text-sm text-main-text leading-relaxed font-sans">
            Access certified professional guidelines, localized care schedules, and real-time medical updates tailored for your motherhood.
          </p>
        </div>

        {/* Nested Surface / Inner Input Container */}
        <div className="p-4 bg-inner rounded-2xl border border-line space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-text">
            <span className="flex items-center gap-1.5">
              <Calendar size={14} /> Next Checkup
            </span>
            <span className="text-main-text">Tomorrow, 10:00 AM</span>
          </div>
          
          <div className="h-px bg-line w-full" />
          
          <div className="flex items-center justify-between text-xs font-semibold text-muted-text">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} /> Doctor Assigned
            </span>
            <span className="text-brand-emerald font-bold">Dr. Fahmida Rahman</span>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center gap-3 mt-6">
          <button className="flex-1 py-3 bg-brand-emerald hover:bg-brand-emerald/90 text-white rounded-2xl text-sm font-semibold shadow-md transition-all">
            Contact Specialist
          </button>
          <button className="px-4 py-3 bg-inner hover:bg-line text-heading border border-line rounded-2xl text-sm font-semibold transition-all">
            Reschedule
          </button>
        </div>

      </div>
    </div>
  );
};
