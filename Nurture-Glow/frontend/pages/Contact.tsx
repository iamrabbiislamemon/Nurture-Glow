import React, { useState } from 'react';
import { Mail, Phone, MapPin, Send, CheckCircle2 } from 'lucide-react';
import { useTranslations } from '../i18n/I18nContext';
import Navbar from '../components/landing/Navbar';
import Footer from '../components/landing/Footer';
import { SmoothScrollProvider } from '../components/landing/SmoothScrollProvider';
import { Reveal } from '../components/landing/motion/Reveal';
import { Stagger, StaggerItem } from '../components/landing/motion/Stagger';

const Contact: React.FC = () => {
  const { t } = useTranslations();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate database storage
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 5000);
    }, 1500);
  };

  return (
    <SmoothScrollProvider>
      <div className="min-h-screen bg-gradient-to-b from-yellow-50 via-amber-50 to-white">
        <Navbar />
        <main className="pt-24">
          {/* Hero */}
          <section className="py-20 px-6 text-center">
            <div className="max-w-4xl mx-auto">
              <Reveal>
                <span className="inline-block px-4 py-2 bg-yellow-200 text-yellow-900 font-bold text-xs uppercase tracking-[0.2em] mb-6 rounded-full shadow-sm">Get In Touch</span>
                <h1 className="text-5xl md:text-7xl font-display font-bold text-gray-900 mb-6 tracking-tight leading-[1.1]">{t('contact.title')}</h1>
              </Reveal>
              <Reveal delay={0.2}>
                <p className="text-xl text-gray-600 font-sans leading-relaxed">{t('contact.subtitle')}</p>
              </Reveal>
            </div>
          </section>

          <section className="py-20 bg-white">
            <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-20">
              {/* Contact Info */}
              <div className="space-y-12">
                <Reveal>
                  <h2 className="text-4xl font-display font-bold text-gray-900 leading-[1.15] tracking-tight">Let's Talk Care.</h2>
                </Reveal>
                
                <Stagger staggerDelay={0.15}>
                  <div className="space-y-8">
                    <StaggerItem y={15}>
                      <div className="flex gap-6 items-center group">
                        <div className="w-16 h-16 bg-gradient-to-br from-amber-50 to-yellow-100 text-amber-700 rounded-3xl flex items-center justify-center shadow-md border border-amber-100 group-hover:shadow-lg group-hover:scale-110 transition-all">
                          <Mail size={24} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 font-sans">Email Us</p>
                          <p className="text-xl font-bold text-gray-800 font-display">{t('contact.email')}</p>
                        </div>
                      </div>
                    </StaggerItem>
                    
                    <StaggerItem y={15}>
                      <div className="flex gap-6 items-center group">
                        <div className="w-16 h-16 bg-gradient-to-br from-emerald-50 to-green-100 text-emerald-700 rounded-3xl flex items-center justify-center shadow-md border border-emerald-100 group-hover:shadow-lg group-hover:scale-110 transition-all">
                          <Phone size={24} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 font-sans">Call Support</p>
                          <p className="text-xl font-bold text-gray-800 font-display">{t('contact.phone')}</p>
                        </div>
                      </div>
                    </StaggerItem>
                    
                    <StaggerItem y={15}>
                      <div className="flex gap-6 items-center group">
                        <div className="w-16 h-16 bg-gradient-to-br from-amber-50 to-yellow-100 text-amber-700 rounded-3xl flex items-center justify-center shadow-md border border-amber-100 group-hover:shadow-lg group-hover:scale-110 transition-all">
                          <MapPin size={24} />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 font-sans">Our Office</p>
                          <p className="text-xl font-bold text-gray-800 font-display">{t('contact.location')}</p>
                        </div>
                      </div>
                    </StaggerItem>
                  </div>
                </Stagger>
              </div>

              {/* Form */}
              <Reveal delay={0.3}>
                <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-amber-100 p-10 rounded-[48px] shadow-lg">
                  {submitted ? (
                    <div className="h-full flex flex-col items-center justify-center text-center space-y-4 animate-in zoom-in-95 duration-300">
                      <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-full flex items-center justify-center shadow-xl">
                        <CheckCircle2 size={40} />
                      </div>
                      <h3 className="text-2xl font-bold font-display text-gray-900">{t('contact.success')}</h3>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2 font-sans">{t('contact.formName')}</label>
                          <input 
                            required 
                            className="w-full p-4 bg-white border-2 border-transparent rounded-2xl focus:ring-4 focus:ring-amber-100 focus:border-amber-300 outline-none shadow-sm transition-all font-sans"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2 font-sans">{t('contact.formEmail')}</label>
                          <input 
                            type="email" 
                            required 
                            className="w-full p-4 bg-white border-2 border-transparent rounded-2xl focus:ring-4 focus:ring-amber-100 focus:border-amber-300 outline-none shadow-sm transition-all font-sans"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-gray-500 uppercase tracking-widest block mb-2 font-sans">{t('contact.formMsg')}</label>
                        <textarea 
                          required 
                          rows={5}
                          className="w-full p-4 bg-white border-2 border-transparent rounded-2xl focus:ring-4 focus:ring-amber-100 focus:border-amber-300 outline-none shadow-sm resize-none transition-all font-sans"
                        ></textarea>
                      </div>
                      <button 
                        disabled={loading}
                        className="w-full py-5 bg-gradient-to-r from-emerald-700 to-emerald-600 text-white rounded-2xl font-bold shadow-xl shadow-emerald-700/20 hover:shadow-2xl hover:-translate-y-1 active:translate-y-0 transition-all flex items-center justify-center gap-2 uppercase tracking-wider text-xs disabled:opacity-60"
                      >
                        {loading ? t('common.loading') : (
                          <>
                            {t('contact.send')}
                            <Send size={18} />
                          </>
                        )}
                      </button>
                    </form>
                  )}
                </div>
              </Reveal>
            </div>
          </section>

          {/* Map Placeholder */}
          <section className="py-24 px-6 bg-gradient-to-b from-amber-50 to-white">
            <Reveal y={40}>
              <div className="max-w-7xl mx-auto h-[400px] rounded-[48px] flex items-center justify-center relative overflow-hidden group border border-amber-100 shadow-xl">
                <img 
                  src="https://images.unsplash.com/photo-1524661135-423995f22d0b?auto=format&fit=crop&q=80&w=2000" 
                  alt="Map Background" 
                  loading="lazy"
                  className="w-full h-full object-cover opacity-50 grayscale group-hover:grayscale-0 transition-all duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-amber-300/10 to-emerald-700/10"></div>
                <div className="absolute p-8 bg-white/95 backdrop-blur-sm rounded-3xl shadow-2xl flex items-center gap-4 border border-amber-100">
                  <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                    <MapPin className="text-amber-700" size={20} />
                  </div>
                  <p className="font-bold font-display text-gray-900">Banani, Dhaka - 1213</p>
                </div>
              </div>
            </Reveal>
          </section>
        </main>
        <Footer />
      </div>
    </SmoothScrollProvider>
  );
};

export default Contact;
