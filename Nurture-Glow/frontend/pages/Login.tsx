import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Loader2, ArrowRight, AlertCircle, Shield, X, CheckCircle2, Eye, EyeOff, Heart, Sparkles, Clock, Languages, Sun, Moon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslations } from '../i18n/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import { Logo } from '../constants';
import { validateEmail, validatePhone, RateLimiter, formatTimeRemaining, sanitizeInput } from '../utils/validation';

// Rate limiter for login attempts
const loginRateLimiter = new RateLimiter(5, 15 * 60 * 1000); // 5 attempts per 15 minutes

const Login: React.FC = () => {
  const { login } = useAuth();
  const { locale, setLocale, t, formatNumber } = useTranslations();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [identifierError, setIdentifierError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const [suspensionInfo, setSuspensionInfo] = useState<{ reason?: string | null; suspendedAt?: string | null } | null>(null);
  const [appealToken, setAppealToken] = useState<string | null>(null);
  const [appealMessage, setAppealMessage] = useState('');
  const [appealSending, setAppealSending] = useState(false);
  const [appealSent, setAppealSent] = useState(false);
  const [appealError, setAppealError] = useState<string | null>(null);
  const [showAppealModal, setShowAppealModal] = useState(false);

  // Forgot Password Modal States
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const from = (location.state as any)?.from?.pathname || "/dashboard";

  // Check for success message from password reset
  useEffect(() => {
    const message = (location.state as any)?.message;
    const showForgot = (location.state as any)?.showForgotPassword;
    
    if (message) {
      setSuccessMessage(message);
      // Clear message after 8 seconds
      setTimeout(() => setSuccessMessage(null), 8000);
      // Clear location state
      window.history.replaceState({}, document.title);
    }
    
    if (showForgot) {
      setShowForgotModal(true);
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  // Check rate limit status on component mount
  useEffect(() => {
    const rateLimitKey = 'login_attempts';
    if (!loginRateLimiter.canAttempt(rateLimitKey)) {
      setIsRateLimited(true);
      const remaining = loginRateLimiter.getRemainingTime(rateLimitKey);
      setRemainingTime(remaining);
      
      // Update countdown
      const interval = setInterval(() => {
        const remaining = loginRateLimiter.getRemainingTime(rateLimitKey);
        setRemainingTime(remaining);
        if (remaining === 0) {
          setIsRateLimited(false);
          clearInterval(interval);
        }
      }, 1000);

      return () => clearInterval(interval);
    }
  }, []);

  // Load remember me preference
  useEffect(() => {
    const savedEmail = localStorage.getItem('nurture_glow_remember_email');
    if (savedEmail) {
      setIdentifier(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // Validate identifier as user types
  const handleIdentifierChange = (value: string) => {
    setIdentifier(value);
    setIdentifierError(null);
    
    if (value.length === 0) return;
    
    // Determine if it's email or phone and validate
    const isEmail = value.includes('@');
    if (isEmail) {
      const emailValidation = validateEmail(value);
      if (!emailValidation.isValid && value.length > 3) {
        setIdentifierError(emailValidation.error || null);
      }
    } else if (value.length >= 10) {
      const phoneValidation = validatePhone(value);
      if (!phoneValidation.isValid) {
        setIdentifierError(phoneValidation.error || null);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIdentifierError(null);
    setSuspensionInfo(null);
    setAppealToken(null);
    setAppealSent(false);
    setAppealError(null);
    setShowAppealModal(false);

    // Check rate limiting
    const rateLimitKey = 'login_attempts';
    if (!loginRateLimiter.canAttempt(rateLimitKey)) {
      const remaining = loginRateLimiter.getRemainingTime(rateLimitKey);
      setRemainingTime(remaining);
      setIsRateLimited(true);
      setError(locale === 'bn' 
        ? `অতিরিক্ত চেষ্টা। দয়া করে ${formatNumber(formatTimeRemaining(remaining))} পর আবার চেষ্টা করুন।` 
        : `Too many login attempts. Please try again in ${formatTimeRemaining(remaining)}.`);
      return;
    }

    // Validate identifier
    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier) {
      setIdentifierError(t('auth.requiredEmailOrPhone'));
      return;
    }

    const isEmail = trimmedIdentifier.includes('@');
    if (isEmail) {
      const emailValidation = validateEmail(trimmedIdentifier);
      if (!emailValidation.isValid) {
        setIdentifierError(emailValidation.error || null);
        return;
      }
    } else {
      const phoneValidation = validatePhone(trimmedIdentifier);
      if (!phoneValidation.isValid) {
        setIdentifierError(phoneValidation.error || null);
        return;
      }
    }

    // Validate password
    if (!password) {
      setError(t('auth.requiredPassword'));
      return;
    }

    if (password.length < 6) {
      setError(t('auth.minPasswordLength'));
      return;
    }

    // Sanitize inputs
    const sanitizedIdentifier = sanitizeInput(trimmedIdentifier);

    setIsLoading(true);

    try {
      await login(sanitizedIdentifier, password);
      
      // Handle remember me
      if (rememberMe && isEmail) {
        localStorage.setItem('nurture_glow_remember_email', sanitizedIdentifier);
      } else {
        localStorage.removeItem('nurture_glow_remember_email');
      }
      
      // Reset rate limiter on successful login
      loginRateLimiter.reset(rateLimitKey);
      
      navigate(from, { replace: true });
    } catch (err: any) {
      const errorMessage = err?.message || t('auth.error');
      setError(errorMessage);
      
      // Show specific error messages
      if (errorMessage.toLowerCase().includes('credential')) {
        setError(t('auth.invalidCreds'));
      } else if (err?.data?.reason === 'suspended') {
        setError(t('auth.accountSuspendedDesc'));
        setSuspensionInfo({
          reason: err?.data?.suspension?.reason || null,
          suspendedAt: err?.data?.suspension?.suspendedAt || null
        });
        setAppealToken(err?.data?.appeal?.token || null);
        setShowAppealModal(true);
      } else if (errorMessage.toLowerCase().includes('verify')) {
        setError(t('auth.verifyEmailBeforeLogin'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleAppealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAppealError(null);
    setAppealSent(false);

    const safeIdentifier = sanitizeInput(identifier.trim());
    if (!appealToken && !safeIdentifier) {
      setAppealError(t('auth.appealErrorMissingContext'));
      return;
    }

    if (!appealMessage.trim()) {
      setAppealError(t('auth.appealErrorEmptyMessage'));
      return;
    }

    setAppealSending(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/auth/suspension-appeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appealToken, message: appealMessage.trim(), identifier: safeIdentifier })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || 'Failed to submit appeal');
      }
      setAppealSent(true);
      setAppealMessage('');
      setTimeout(() => setShowAppealModal(false), 1200);
    } catch (err: any) {
      setAppealError(err?.message || 'Failed to submit appeal. Please try again.');
    } finally {
      setAppealSending(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const emailValidation = validateEmail(forgotEmail);
    if (!emailValidation.isValid) {
      setResetError(emailValidation.error || "Please enter a valid email address.");
      return;
    }

    setResetError(null);
    setIsResetting(true);

    try {
      // Call backend API for password reset
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:4000'}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: sanitizeInput(forgotEmail.trim()) })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send reset link');
      }

      setIsResetting(false);
      setResetSent(true);
      
      // Show preview URL if available (test mode)
      if (data.previewUrl) {
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📧 VIEW PASSWORD RESET EMAIL IN BROWSER:');
        console.log(data.previewUrl);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        // Open preview in new tab
        window.open(data.previewUrl, '_blank');
      }
      
      setTimeout(() => {
        setShowForgotModal(false);
        setResetSent(false);
        setForgotEmail('');
        setResetError(null);
      }, 3000);
    } catch (err: any) {
      setResetError(err.message || 'Failed to send reset link. Please try again.');
      setIsResetting(false);
    }
  };

  return (
    <div className="h-screen w-screen overflow-hidden flex relative bg-white dark:bg-[#16171A]">
      {/* Top Right Language & Theme Switcher */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-3 bg-white/80 dark:bg-[#16171A]/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-gray-150 dark:border-[#23252A] shadow-sm">
        <button
          onClick={() => setLocale(locale === 'en' ? 'bn' : 'en')}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-250 hover:text-[#1B4D3E] dark:hover:text-[#34D399] transition-colors cursor-pointer"
          title={locale === 'en' ? 'বাংলা সংস্করণ' : 'English Version'}
        >
          <Languages size={14} />
          <span>{locale === 'en' ? 'বাং' : 'EN'}</span>
        </button>
        <div className="w-px h-4 bg-gray-200 dark:bg-[#23252A]" />
        <button
          onClick={toggleTheme}
          className="text-gray-700 dark:text-gray-250 hover:text-[#1B4D3E] dark:hover:text-[#34D399] transition-colors cursor-pointer"
          title={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
        >
          {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
        </button>
      </div>

      {/* Left Panel - Clean Visual Section */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden bg-[#f8f6f1] dark:bg-[#0F1012]">
        {/* Soft background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#e8f5e9]/60 via-[#f8f6f1] to-[#fff8e7]/50 dark:from-emerald-950/20 dark:via-[#0F1012] dark:to-amber-950/10" />
        
        {/* Decorative soft shapes */}
        <div className="absolute top-20 left-20 w-72 h-72 bg-emerald-100/40 dark:bg-emerald-900/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-amber-100/50 dark:bg-amber-900/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-teal-50/60 dark:bg-teal-900/10 rounded-full blur-3xl" />
        
        {/* Subtle geometric accents */}
        <div className="absolute top-24 right-32 w-16 h-16 border border-emerald-200/60 dark:border-emerald-800/30 rounded-2xl rotate-12" />
        <div className="absolute bottom-32 left-24 w-20 h-20 border border-[#E6C77A]/40 dark:border-[#E6C77A]/20 rounded-full" />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-14 w-full h-full">
          {/* Top - Logo */}
          <div className="flex items-center gap-3">
            <Logo />
            <span className="text-xl font-serif font-bold text-gray-800 dark:text-gray-100">Nurture Glow</span>
          </div>
          
          {/* Center - Main Content */}
          <div className="space-y-8 max-w-lg">
            <div>
              <p className="text-emerald-600 dark:text-[#34D399] text-sm font-medium uppercase tracking-widest mb-4">{t('auth.welcomeBack')}</p>
              <h1 className="text-5xl font-serif font-bold text-gray-800 dark:text-gray-100 leading-tight">
                {t('auth.loginJourneyTitle')}{' '}
                <span className="text-emerald-600 dark:text-[#34D399]">{t('auth.loginJourneyTitleSpan')}</span>
              </h1>
            </div>
            <p className="text-gray-600 dark:text-gray-305 text-lg leading-relaxed">
              {t('auth.loginJourneyDesc')}
            </p>
            
            {/* Stats with soft cards */}
            <div className="flex items-center gap-6 pt-4">
              <div className="bg-white/70 dark:bg-[#16171A]/70 backdrop-blur-sm px-5 py-4 rounded-2xl shadow-sm border border-gray-100/50 dark:border-[#23252A]/50">
                <p className="text-2xl font-bold text-emerald-600 dark:text-[#34D399]">{formatNumber(t('auth.stats.happyMothersCount'))}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('auth.stats.happyMothers')}</p>
              </div>
              <div className="bg-white/70 dark:bg-[#16171A]/70 backdrop-blur-sm px-5 py-4 rounded-2xl shadow-sm border border-gray-100/50 dark:border-[#23252A]/50">
                <p className="text-2xl font-bold text-[#d4a853] dark:text-[#E6C77A]">{formatNumber(t('auth.stats.rating'))}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('auth.stats.ratingLabel')}</p>
              </div>
              <div className="bg-white/70 dark:bg-[#16171A]/70 backdrop-blur-sm px-5 py-4 rounded-2xl shadow-sm border border-gray-100/50 dark:border-[#23252A]/50">
                <p className="text-2xl font-bold text-teal-600 dark:text-[#2DD4BF]">{formatNumber(t('auth.stats.support'))}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('auth.stats.supportLabel')}</p>
              </div>
            </div>
          </div>
          
          {/* Bottom - Quote */}
          <div className="bg-white/50 dark:bg-[#16171A]/50 backdrop-blur-sm rounded-2xl p-5 max-w-md border border-gray-100/20 dark:border-[#23252A]/20">
            <p className="text-gray-600 dark:text-gray-300 italic text-sm leading-relaxed">
              {t('auth.quote.text')}
            </p>
            <p className="text-emerald-600 dark:text-[#34D399] text-xs mt-2 font-medium">— {t('auth.quote.author')}</p>
          </div>
        </div>
      </div>

      {/* Right Panel - Login Form */}
      <div className="w-full lg:w-[45%] flex items-center justify-center p-6 lg:p-12 bg-white dark:bg-[#16171A]">
        {/* Forgot Password Modal */}
        {showForgotModal && (
          <div 
            className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-gray-900/50 dark:bg-black/70 backdrop-blur-sm"
            onClick={() => !isResetting && setShowForgotModal(false)}
          >
            <div 
              className="bg-white dark:bg-[#16171A] rounded-2xl p-8 shadow-2xl relative w-full max-w-md border border-gray-100 dark:border-[#23252A]"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setShowForgotModal(false)}
                className="absolute top-4 right-4 p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X size={20} />
              </button>

              {resetSent ? (
                <div className="text-center space-y-4 py-4 animate-in fade-in zoom-in duration-300">
                  <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-[#34D399] rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 size={32} />
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('auth.linkSent')}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('auth.resetSentMessage', { email: forgotEmail })}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="text-center space-y-1">
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{t('auth.resetPass')}</h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('auth.enterEmailLink')}</p>
                  </div>

                  <form onSubmit={handleForgotSubmit} className="space-y-4">
                    {resetError && (
                      <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-center gap-2 text-red-600 dark:text-red-400 text-sm">
                        <AlertCircle size={16} />
                        {resetError}
                      </div>
                    )}

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('auth.email')}</label>
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="name@example.com"
                        className="w-full px-4 py-3 bg-gray-50 dark:bg-[#1B1C20] border border-gray-200 dark:border-[#2E3036] rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:focus:ring-emerald-500/10 transition-all outline-none text-gray-800 dark:text-gray-200"
                        autoFocus
                      />
                    </div>

                    <button
                      disabled={isResetting}
                      className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white rounded-xl font-semibold shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isResetting ? (
                        <Loader2 className="animate-spin" size={18} />
                      ) : (
                        <>
                          <span className="text-sm">{t('auth.sendReset')}</span>
                          <ArrowRight size={16} />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="w-full max-w-sm">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-6">
            <Logo />
            <span className="text-xl font-serif font-bold text-gray-800 dark:text-gray-100">Nurture Glow</span>
          </div>

          {/* Header */}
          <div className="text-center lg:text-left mb-8">
            <h1 className="text-2xl lg:text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">{t('auth.welcomeBack')}</h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm">{t('auth.credsJourney')}</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {successMessage && (
              <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900/30 rounded-xl flex items-center gap-3 text-green-700 dark:text-green-400 animate-in fade-in slide-in-from-top-2">
                <CheckCircle2 size={20} className="flex-shrink-0" />
                <p className="text-sm font-medium">{successMessage}</p>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 rounded-xl flex items-center gap-2 text-red-600 dark:text-red-400 text-sm animate-in fade-in slide-in-from-top-2">
                <AlertCircle size={16} />
                <p className="font-medium">{error}</p>
              </div>
            )}

            {isRateLimited && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 rounded-xl flex items-center gap-2 text-amber-700 dark:text-amber-450 text-sm">
                <Clock size={16} />
                <p className="font-medium">
                  {locale === 'bn' 
                    ? `অতিরিক্ত চেষ্টা। দয়া করে ${formatNumber(formatTimeRemaining(remainingTime))} পর আবার চেষ্টা করুন` 
                    : `Too many attempts. Try again in ${formatTimeRemaining(remainingTime)}`}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('auth.emailOrPhone')}</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 group-focus-within:text-emerald-600 dark:group-focus-within:text-emerald-450 transition-colors">
                  <Mail size={18} />
                </div>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => handleIdentifierChange(e.target.value)}
                  placeholder={t('auth.emailOrPhonePlaceholder')}
                  disabled={isRateLimited}
                  className={`w-full pl-12 pr-4 py-3.5 bg-[#f8f6f1] dark:bg-[#1B1C20] border-2 rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:focus:ring-emerald-500/10 transition-all outline-none text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed ${
                    identifierError ? 'border-red-300 dark:border-red-900' : 'border-transparent'
                  }`}
                />
                {identifierError && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1 ml-1">{identifierError}</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-xs font-medium text-gray-600 dark:text-gray-400">{t('auth.password')}</label>
                <button 
                  type="button" 
                  onClick={() => {
                    setForgotEmail(identifier);
                    setShowForgotModal(true);
                  }}
                  className="text-xs font-medium text-emerald-600 dark:text-emerald-450 hover:text-emerald-700 dark:hover:text-emerald-350 transition-colors cursor-pointer"
                >
                  {t('auth.forgotPasswordLink')}
                </button>
              </div>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 group-focus-within:text-emerald-600 dark:group-focus-within:text-emerald-450 transition-colors">
                  <Lock size={18} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('auth.passwordPlaceholder')}
                  disabled={isRateLimited}
                  minLength={6}
                  className="w-full pl-12 pr-12 py-3.5 bg-[#f8f6f1] dark:bg-[#1B1C20] border border-transparent rounded-xl focus:bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:focus:ring-emerald-500/10 transition-all outline-none text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-450 transition-colors focus:outline-none cursor-pointer"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Remember Me Checkbox */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 focus:ring-2 cursor-pointer"
              />
              <label htmlFor="rememberMe" className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none">
                {t('auth.rememberMe')}
              </label>
            </div>

            <button
              disabled={isLoading || isRateLimited}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-700 dark:hover:bg-emerald-600 text-white rounded-xl font-semibold shadow-lg shadow-emerald-600/20 hover:shadow-xl hover:shadow-emerald-600/25 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  <span className="text-sm">{t('auth.signIn')}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Sign Up Link */}
          <div className="text-center mt-8">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('auth.noAccount')}{' '}
              <Link to="/register" className="text-emerald-600 dark:text-emerald-450 font-semibold hover:text-emerald-700 dark:hover:text-emerald-350 transition-colors">
                {t('auth.signUp')}
              </Link>
            </p>
          </div>

          {/* Security Badge */}
          <div className="mt-8 flex items-center justify-center gap-2 text-gray-400 dark:text-gray-500">
            <Shield size={14} />
            <span className="text-xs">{t('auth.secureBadge')}</span>
          </div>

          {/* Back to Home */}
          <Link to="/" className="block mt-4 text-center text-xs text-gray-400 dark:text-gray-500 hover:text-emerald-600 dark:hover:text-emerald-450 transition-colors">
            ← {t('auth.backLanding')}
          </Link>
        </div>
      </div>

      {showAppealModal && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-gray-900/50 dark:bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#16171A] rounded-2xl p-6 shadow-2xl relative w-full max-w-md border border-amber-100 dark:border-amber-900/20">
            <button
              onClick={() => setShowAppealModal(false)}
              className="absolute top-4 right-4 p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              disabled={appealSending}
            >
              <X size={20} />
            </button>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-[#E6C77A] flex items-center justify-center">
                  <AlertCircle size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('auth.accountSuspendedTitle')}</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{t('auth.accountSuspendedDesc')}</p>
                </div>
              </div>

              {suspensionInfo?.reason && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/30 text-amber-800 dark:text-amber-300 text-xs">
                  <span className="font-semibold">{t('auth.suspensionReasonLabel')}</span> {suspensionInfo.reason}
                </div>
              )}

              <form onSubmit={handleAppealSubmit} className="space-y-3">
                <label className="text-xs font-semibold text-amber-800 dark:text-amber-300 uppercase tracking-wider">{t('auth.showCauseMessageLabel')}</label>
                <textarea
                  value={appealMessage}
                  onChange={(e) => setAppealMessage(e.target.value)}
                  rows={4}
                  placeholder={t('auth.showCausePlaceholder')}
                  className="w-full px-4 py-3 rounded-xl border border-amber-200 dark:border-[#2E3036] bg-amber-50/30 dark:bg-[#1B1C20] text-gray-800 dark:text-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 dark:focus:ring-amber-500/20"
                />
                {appealError && <p className="text-xs text-red-600 dark:text-red-400">{appealError}</p>}
                {appealSent && <p className="text-xs text-emerald-700 dark:text-[#34D399]">{t('auth.appealSubmitted')}</p>}
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={appealSending}
                    className="flex-1 px-4 py-2 rounded-xl bg-amber-600 dark:bg-amber-700 text-white text-xs font-semibold hover:bg-amber-700 dark:hover:bg-amber-600 disabled:opacity-50"
                  >
                    {appealSending ? t('auth.appealSubmitting') : t('auth.appealSubmit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAppealModal(false)}
                    className="px-4 py-2 rounded-xl border border-gray-200 dark:border-[#2E3036] text-xs font-semibold text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-[#1D1E22]"
                  >
                    {t('auth.appealCancel')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
