import React from 'react';
import { Link } from 'react-router-dom';
import { 
  Syringe, Calendar, Baby, Apple, Users, ShoppingBag, 
  BrainCircuit, Languages, LayoutDashboard, User, BookOpen, Droplet,
  ArrowRight, CheckCircle2
} from 'lucide-react';
import { useTranslations } from '../i18n/I18nContext';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import { SmoothScrollProvider } from '../components/landing/SmoothScrollProvider';
import { Reveal } from '../components/landing/motion/Reveal';
import { Stagger, StaggerItem } from '../components/landing/motion/Stagger';

const FeaturesPage: React.FC = () => {
  const { t } = useTranslations();

  const features = [
    { icon: <Calendar />, title: t('nav.appointments'), color: 'bg-amber-50 text-amber-700' },
    { icon: <Syringe />, title: t('nav.vaccines'), color: 'bg-emerald-50 text-emerald-700' },
    { icon: <Baby />, title: t('nav.pregnancy'), color: 'bg-yellow-50 text-yellow-800' },
    { icon: <Apple />, title: t('nav.nutrition'), color: 'bg-green-50 text-green-700' },
    { icon: <BookOpen />, title: t('nav.journal'), color: 'bg-amber-50 text-amber-800' },
    { icon: <Users />, title: t('nav.community'), color: 'bg-emerald-50 text-emerald-800' },
    { icon: <Droplet />, title: t('nav.donors'), color: 'bg-red-50 text-red-600' },
    { icon: <ShoppingBag />, title: t('nav.pharmacy'), color: 'bg-teal-50 text-teal-700' },
    { icon: <BrainCircuit />, title: t('nav.assistant'), color: 'bg-emerald-50 text-emerald-800' },
    { icon: <Languages />, title: t('nav.translator'), color: 'bg-yellow-50 text-yellow-700' },
    { icon: <User />, title: t('nav.profile'), color: 'bg-amber-50 text-amber-700' },
    { icon: <LayoutDashboard />, title: t('nav.dashboard'), color: 'bg-emerald-50 text-emerald-700' },
  ];

  return (
    <SmoothScrollProvider>
      <div className="min-h-screen bg-gradient-to-b from-yellow-50 via-amber-50 to-white">
        <Navbar />
        <main className="pt-24">
          {/* Hero */}
          <section className="py-20 px-6 text-center">
            <div className="max-w-4xl mx-auto">
              <Reveal>
                <span className="inline-block px-4 py-2 bg-yellow-200 text-yellow-900 font-bold text-xs uppercase tracking-[0.2em] mb-6 rounded-full shadow-sm">Platform Features</span>
                <h1 className="text-5xl md:text-7xl font-display font-bold text-gray-900 mb-6 tracking-tight leading-[1.1]">{t('featuresPage.title')}</h1>
              </Reveal>
              <Reveal delay={0.2}>
                <p className="text-xl text-gray-600 leading-relaxed font-sans">{t('featuresPage.subtitle')}</p>
              </Reveal>
            </div>
          </section>

          {/* Feature Grid */}
          <section className="py-20 bg-white">
            <div className="max-w-7xl mx-auto px-6">
              <Stagger staggerDelay={0.08}>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                  {features.map((f, i) => (
                    <StaggerItem key={i} y={18}>
                      <div className="p-8 bg-gradient-to-br from-yellow-50 to-amber-50 border border-amber-100 rounded-[40px] hover:scale-105 hover:shadow-xl transition-all group h-full flex flex-col">
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-sm ${f.color} group-hover:rotate-6 transition-transform`}>
                          {/* 
                            Fix: Using React.ReactElement<any> to allow the 'size' prop when cloning the icon element. 
                            Lucide icons accept size but React.ReactElement's default props type is unknown.
                          */}
                          {React.cloneElement(f.icon as React.ReactElement<any>, { size: 28 })}
                        </div>
                        <h3 className="text-lg font-bold text-gray-800 mb-2 font-display">{f.title}</h3>
                        <div className="mt-auto">
                          <Link to="/register" className="text-xs font-bold text-emerald-700 uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all">
                            Learn More <ArrowRight size={14} />
                          </Link>
                        </div>
                      </div>
                    </StaggerItem>
                  ))}
                </div>
              </Stagger>
            </div>
          </section>

          {/* How it Works */}
          <section className="py-24 px-6 bg-gradient-to-b from-amber-50 to-white">
            <div className="max-w-7xl mx-auto">
              <Reveal>
                <div className="text-center mb-16">
                  <span className="inline-block px-4 py-2 bg-yellow-200 text-yellow-900 font-bold text-xs uppercase tracking-[0.2em] mb-4 rounded-full shadow-sm">How It Works</span>
                  <h2 className="text-4xl font-display font-bold text-gray-900">{t('featuresPage.howItWorks')}</h2>
                </div>
              </Reveal>
              <Stagger staggerDelay={0.2}>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                  {[
                    { step: '01', title: t('featuresPage.step1'), desc: t('featuresPage.step1Desc') },
                    { step: '02', title: t('featuresPage.step2'), desc: t('featuresPage.step2Desc') },
                    { step: '03', title: t('featuresPage.step3'), desc: t('featuresPage.step3Desc') },
                  ].map((s, i) => (
                    <StaggerItem key={i} y={30}>
                      <div className="relative p-10 bg-white rounded-[48px] shadow-md border border-amber-100 h-full">
                        <div className="absolute -top-6 -left-6 w-16 h-16 bg-gradient-to-br from-amber-400 to-yellow-500 text-white font-sans font-bold text-2xl flex items-center justify-center rounded-2xl shadow-lg">
                          {s.step}
                        </div>
                        <h3 className="text-xl font-bold mb-4 mt-2 font-display text-gray-900">{s.title}</h3>
                        <p className="text-gray-500 text-sm leading-relaxed font-sans">{s.desc}</p>
                      </div>
                    </StaggerItem>
                  ))}
                </div>
              </Stagger>
            </div>
          </section>

          {/* CTA */}
          <section className="py-24 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white overflow-hidden relative">
            <Reveal y={50}>
              <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
                <span className="inline-block px-4 py-2 bg-white/10 text-amber-300 font-bold text-xs uppercase tracking-[0.2em] mb-6 rounded-full border border-white/20">Get Started Today</span>
                <h2 className="text-4xl md:text-5xl font-display font-bold mb-4 leading-[1.15] tracking-tight">Ready to start <span className="bg-gradient-to-r from-emerald-400 to-emerald-500 bg-clip-text text-transparent italic">your journey?</span></h2>
                <p className="text-gray-300 text-base mb-10 leading-relaxed max-w-lg mx-auto font-sans">Join thousands of mothers who trust Nurture Glow for their wellness journey.</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link to="/register" className="px-10 py-5 bg-gradient-to-r from-emerald-700 to-emerald-600 text-white rounded-xl font-bold shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all uppercase tracking-wider text-sm flex items-center justify-center gap-2">
                    Create Account <ArrowRight size={18} />
                  </Link>
                  <Link to="/login" className="px-10 py-5 bg-white/10 backdrop-blur-md text-white rounded-xl font-bold border border-white/20 hover:bg-white/20 transition-all uppercase tracking-wider text-sm">Sign In</Link>
                </div>
              </div>
            </Reveal>
            <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-[100px]"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px]"></div>
          </section>
        </main>
        <Footer />
      </div>
    </SmoothScrollProvider>
  );
};

export default FeaturesPage;
