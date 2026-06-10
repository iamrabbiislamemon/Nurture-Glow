import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Loader2, ArrowRight, AlertCircle, Sparkles, CheckCircle, Phone, Users, Stethoscope, ShoppingBag, Shield, Eye, EyeOff, Check, X, Apple, Languages, Sun, Moon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useTranslations } from '../i18n/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import { Logo } from '../constants';
import { UserRole } from '../types';
import { 
  validateEmail, 
  validatePhone, 
  validateName, 
  validatePassword, 
  validatePasswordMatch, 
  checkPasswordStrength,
  sanitizeInput,
  PasswordStrength 
} from '../utils/validation';

const Register: React.FC = () => {
  const { register } = useAuth();
  const { locale, setLocale, t, formatNumber } = useTranslations();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [role, setRole] = useState<UserRole>('mother');
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  
  // Field-specific errors
  const [nameError, setNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  
  // Password strength
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null);

  // Roles (all visible)
  const roles: { value: UserRole; label: string; description: string; icon: React.ReactNode; color: string }[] = [
    { 
      value: 'mother', 
      label: t('auth.role.mother.label'), 
      description: t('auth.role.mother.desc'),
      icon: <Users size={18} />, 
      color: 'bg-[#F0E6FF] text-[#6B46C1] border-[#A78BFA] dark:bg-purple-950/20 dark:text-[#A78BFA] dark:border-[#6B46C1]' 
    },
    { 
      value: 'doctor', 
      label: t('auth.role.doctor.label'), 
      description: t('auth.role.doctor.desc'),
      icon: <Stethoscope size={18} />, 
      color: 'bg-[#E6EEF7] text-[#1D3B63] border-[#5A8FC9] dark:bg-blue-950/20 dark:text-[#5A8FC9] dark:border-[#1D3B63]' 
    },
    { 
      value: 'pharmacist', 
      label: t('auth.role.pharmacist.label'), 
      description: t('auth.role.pharmacist.desc'),
      icon: <ShoppingBag size={18} />, 
      color: 'bg-[#E5F4EA] text-[#1F5A3F] border-[#4FA37A] dark:bg-green-950/20 dark:text-[#4FA37A] dark:border-[#1F5A3F]' 
    },
    { 
      value: 'nutritionist', 
      label: t('auth.role.nutritionist.label'), 
      description: t('auth.role.nutritionist.desc'),
      icon: <Apple size={18} />, 
      color: 'bg-[#FFF8E7] text-[#8C6D1F] border-[#E6C77A] dark:bg-amber-950/20 dark:text-[#E6C77A] dark:border-[#8C6D1F]' 
    },
  ];

  // Get the accent color based on selected role
  const getRoleAccentColor = () => {
    const selectedRole = roles.find(r => r.value === role);
    if (!selectedRole) return '#C9A961'; // default golden
    
    // Extract border color from the color string
    const match = selectedRole.color.match(/border-\[([^\]]+)\]/);
    return match ? match[1] : '#C9A961';
  };

  const accentColor = getRoleAccentColor();
  const getFieldStyle = (hasValue: boolean, hasError: boolean) => ({
    borderColor: hasError ? '#FCA5A5' : (hasValue ? accentColor : `${accentColor}40`),
    background: `linear-gradient(135deg, ${accentColor}14, ${accentColor}08)`,
    boxShadow: hasValue ? `0 10px 15px -3px ${accentColor}15` : undefined
  });

  // Real-time validation handlers
  const handleNameChange = (value: string) => {
    setName(value);
    if (value.length > 0) {
      const validation = validateName(value);
      setNameError(validation.isValid ? null : validation.error || null);
    } else {
      setNameError(null);
    }
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (value.length > 3) {
      const validation = validateEmail(value);
      setEmailError(validation.isValid ? null : validation.error || null);
    } else {
      setEmailError(null);
    }
  };

  const handlePhoneChange = (value: string) => {
    setPhone(value);
    if (value.length >= 10) {
      const validation = validatePhone(value);
      setPhoneError(validation.isValid ? null : validation.error || null);
    } else {
      setPhoneError(null);
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (value.length > 0) {
      const strength = checkPasswordStrength(value);
      setPasswordStrength(strength);
      if (value.length >= 8) {
        const validation = validatePassword(value);
        setPasswordError(validation.isValid ? null : validation.error || null);
      } else {
        setPasswordError(null);
      }
    } else {
      setPasswordStrength(null);
      setPasswordError(null);
    }
    
    // Check confirm password match
    if (confirmPassword && value !== confirmPassword) {
      setConfirmPasswordError(t('auth.passwordsDoNotMatch'));
    } else {
      setConfirmPasswordError(null);
    }
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    if (value.length > 0 && password) {
      const validation = validatePasswordMatch(password, value);
      setConfirmPasswordError(validation.isValid ? null : validation.error || null);
    } else {
      setConfirmPasswordError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate all fields
    const nameValidation = validateName(name);
    if (!nameValidation.isValid) {
      setNameError(nameValidation.error || null);
      return;
    }

    const emailValidation = validateEmail(email);
    if (!emailValidation.isValid) {
      setEmailError(emailValidation.error || null);
      return;
    }

    const phoneValidation = validatePhone(phone);
    if (!phoneValidation.isValid) {
      setPhoneError(phoneValidation.error || null);
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.isValid) {
      setPasswordError(passwordValidation.error || null);
      setError(passwordValidation.error || null);
      return;
    }

    const passwordMatchValidation = validatePasswordMatch(password, confirmPassword);
    if (!passwordMatchValidation.isValid) {
      setConfirmPasswordError(passwordMatchValidation.error || null);
      setError(passwordMatchValidation.error || null);
      return;
    }

    if (!acceptTerms) {
      setError(t('auth.acceptTermsError'));
      return;
    }

    // Sanitize inputs
    const sanitizedName = sanitizeInput(name.trim());
    const sanitizedEmail = sanitizeInput(email.trim().toLowerCase());
    const sanitizedPhone = sanitizeInput(phone.trim());

    setIsLoading(true);

    try {
      await register(sanitizedName, sanitizedEmail, sanitizedPhone, password, role);
      navigate('/dashboard');
    } catch (err: any) {
      const errorMessage = err.message || t('auth.error');
      setError(errorMessage);
      
      // Show specific error messages
      if (errorMessage.toLowerCase().includes('email') && errorMessage.toLowerCase().includes('exist')) {
        setEmailError(t('auth.emailExistsError'));
        setError(t('auth.emailExistsErrorDetails'));
      } else if (errorMessage.toLowerCase().includes('phone') && errorMessage.toLowerCase().includes('exist')) {
        setPhoneError(t('auth.phoneExistsError'));
        setError(t('auth.phoneExistsErrorDetails'));
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-[#0F1012] dark:to-[#16171A] flex items-center justify-center p-3 relative overflow-hidden">
      {/* Top Right Language & Theme Switcher */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-3 bg-white/80 dark:bg-[#16171A]/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-gray-150 dark:border-[#23252A] shadow-sm">
        <button
          onClick={() => setLocale(locale === 'en' ? 'bn' : 'en')}
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-250 hover:text-emerald-600 dark:hover:text-[#34D399] transition-colors cursor-pointer"
          title={locale === 'en' ? 'বাংলা সংস্করণ' : 'English Version'}
        >
          <Languages size={14} />
          <span>{locale === 'en' ? 'বাং' : 'EN'}</span>
        </button>
        <div className="w-px h-4 bg-gray-200 dark:bg-[#23252A]" />
        <button
          onClick={toggleTheme}
          className="text-gray-700 dark:text-gray-250 hover:text-emerald-600 dark:hover:text-[#34D399] transition-colors cursor-pointer"
          title={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
        >
          {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
        </button>
      </div>

      {/* Floating background elements */}
      <div className="absolute inset-0 opacity-30 dark:opacity-10 pointer-events-none">
        <div className="absolute top-10 left-10 w-20 h-20 bg-gradient-to-br from-blue-200 to-purple-200 dark:from-blue-900 dark:to-purple-900 rounded-full blur-xl animate-pulse" style={{animationDuration: '3s'}}></div>
        <div className="absolute bottom-16 right-12 w-16 h-16 bg-gradient-to-br from-green-200 to-blue-200 dark:from-green-900 dark:to-blue-900 rounded-full blur-xl animate-pulse" style={{animationDuration: '4s', animationDelay: '1s'}}></div>
        <div className="absolute top-1/2 right-1/4 w-12 h-12 bg-gradient-to-br from-purple-200 to-pink-200 dark:from-purple-900 dark:to-pink-900 rounded-full blur-xl animate-pulse" style={{animationDuration: '5s', animationDelay: '2s'}}></div>
        <div className="absolute bottom-1/4 left-1/4 w-14 h-14 bg-gradient-to-br from-yellow-200 to-orange-200 dark:from-yellow-900 dark:to-orange-900 rounded-full blur-xl animate-pulse" style={{animationDuration: '4.5s', animationDelay: '0.5s'}}></div>
      </div>
      
      <div className="w-full max-w-xl lg:max-w-2xl relative z-10">
        <div className="text-center mb-5 animate-in fade-in slide-in-from-top duration-700">
          <div className="inline-block mb-2 scale-[0.45] hover:scale-[0.5] transition-transform duration-300">
            <Logo />
          </div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-1">{t('auth.createAccount')}</h1>
          <p className="text-gray-600 dark:text-gray-400 text-xs">{t('auth.startPremiumJourney')}</p>
        </div>

        <div 
          className="p-6 rounded-xl border shadow-lg transition-all duration-500 hover:shadow-xl hover:-translate-y-1 hover:scale-[1.01] animate-in fade-in slide-in-from-bottom duration-800 backdrop-blur-sm"
          style={{
            background: role ? `linear-gradient(135deg, ${theme === 'dark' ? 'rgba(10, 10, 10, 0.95)' : 'rgba(255,255,255,0.95)'}, ${accentColor}08, ${accentColor}04)` : undefined,
            borderColor: role ? `${accentColor}40` : undefined,
            boxShadow: role ? `0 10px 25px -5px ${accentColor}25, 0 4px 6px -1px ${accentColor}15` : undefined
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-3" role="form" aria-label="Registration form">
            {error && (
              <div className="p-2 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-400 text-xs">
                <div className="p-1 bg-red-100 dark:bg-red-900/50 rounded-full">
                  <AlertCircle size={14} className="text-red-600 dark:text-red-400" />
                </div>
                <p className="font-semibold flex-1">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <label
                className="text-[9px] font-bold uppercase tracking-widest ml-2"
                style={{ color: accentColor }}
                id="role-selection-label"
              >
                {t('auth.selectRole')}
              </label>
              
              {/* All Roles Displayed Horizontally with Labels */}
              <div 
                className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 rounded-lg border transition-all duration-300"
                style={{
                  background: role ? `linear-gradient(135deg, ${accentColor}10, ${accentColor}05)` : undefined,
                  borderColor: role ? `${accentColor}30` : undefined
                }}
              >
                {roles.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value)}
                    role="radio"
                    aria-checked={role === r.value}
                    aria-label={`${r.label} - ${r.description}`}
                    className={`relative p-3 rounded-xl border-2 transition-all duration-300 flex flex-col items-center justify-center gap-1.5 hover:scale-105 hover:-translate-y-0.5 hover:shadow-md group text-center min-h-[80px] ${
                      role === r.value
                        ? `${r.color} border-current shadow-md transform scale-105`
                        : 'bg-white/80 dark:bg-[#16171A]/80 backdrop-blur-sm border-gray-300 dark:border-[#2E3036] text-gray-600 dark:text-gray-400 hover:border-gray-400 hover:bg-white dark:hover:bg-[#1E1F24]'
                    }`}
                  >
                    <div className="flex-shrink-0 transition-transform duration-300 group-hover:scale-110">{r.icon}</div>
                    <span className="text-[10px] font-bold tracking-tight leading-tight">{r.label}</span>
                    {role === r.value && (
                      <CheckCircle size={14} className="absolute -top-1.5 -right-1.5 bg-white dark:bg-[#16171A] rounded-full shadow-lg animate-in zoom-in duration-300" style={{color: accentColor}} />
                    )}
                  </button>
                ))}
              </div>

              {/* Dynamic Role Description Banner */}
              <div 
                className="text-center text-[11px] text-gray-505 dark:text-gray-400 min-h-[2.5rem] transition-all duration-300 px-3 py-2 bg-gray-50/50 dark:bg-[#1B1C20]/50 rounded-lg border border-gray-100 dark:border-[#2E3036] flex items-center justify-center"
                style={{
                  background: role ? `linear-gradient(135deg, ${accentColor}05, ${accentColor}02)` : undefined,
                  borderColor: role ? `${accentColor}10` : undefined
                }}
              >
                <span className="font-medium text-gray-600 dark:text-gray-350">{roles.find(r => r.value === role)?.description}</span>
              </div>
            </div>

            {/* Two Column Layout for Name and Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {/* Name Field */}
              <div className="space-y-1 relative">
                <div className="relative group">
                  <div className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 transition-colors z-10" style={{ color: name ? accentColor : undefined }}>
                    <User size={14} />
                  </div>
                  <input
                    id="name-input"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => handleNameChange(e.target.value)}
                    placeholder=""
                    autoComplete="name"
                    aria-describedby={nameError ? 'name-error' : undefined}
                    aria-invalid={nameError ? 'true' : 'false'}
                    style={getFieldStyle(Boolean(name), Boolean(nameError))}
                    className={`peer w-full pl-9 pr-8 py-2.5 text-sm border-2 rounded-lg transition-colors outline-none font-medium text-gray-900 dark:text-gray-100 placeholder:text-transparent ${
                      nameError ? 'border-red-300 focus:border-red-400' : ''
                    }`}
                  />
                  <label
                    htmlFor="name-input"
                    style={{ color: name ? accentColor : undefined, backgroundColor: theme === 'dark' ? '#16171A' : '#ffffff' }}
                    className="absolute left-8 sm:left-9 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium transition-all duration-300 pointer-events-none peer-focus:top-0 peer-focus:left-2 peer-focus:text-[9px] peer-focus:font-bold peer-focus:px-1.5 peer-focus:py-0.5 peer-focus:rounded-full peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:left-2 peer-[:not(:placeholder-shown)]:text-[9px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:px-1.5 peer-[:not(:placeholder-shown)]:py-0.5 peer-[:not(:placeholder-shown)]:rounded-full"
                  >
                    {t('auth.fullNameLabel')}
                  </label>
                  {nameError && (
                    <p id="name-error" className="text-[9px] text-red-600 dark:text-red-400 mt-0.5 ml-2" role="alert">{nameError}</p>
                  )}
                  {name.length >= 2 && !nameError && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-500">
                      <Check size={14} />
                    </div>
                  )}
                </div>
              </div>

              {/* Email Field */}
              <div className="space-y-1 relative">
                <div className="relative group">
                  <div className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 transition-colors z-10" style={{ color: email ? accentColor : undefined }}>
                    <Mail size={14} />
                  </div>
                  <input
                    id="email-input"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => handleEmailChange(e.target.value)}
                    placeholder=""
                    autoComplete="email"
                    aria-describedby={emailError ? 'email-error' : undefined}
                    aria-invalid={emailError ? 'true' : 'false'}
                    style={getFieldStyle(Boolean(email), Boolean(emailError))}
                    className={`peer w-full pl-9 pr-8 py-2.5 text-sm border-2 rounded-lg transition-colors outline-none font-medium text-gray-900 dark:text-gray-100 placeholder:text-transparent ${
                      emailError ? 'border-red-300 focus:border-red-400' : ''
                    }`}
                  />
                  <label
                    htmlFor="email-input"
                    style={{ color: email ? accentColor : undefined, backgroundColor: theme === 'dark' ? '#16171A' : '#ffffff' }}
                    className="absolute left-8 sm:left-9 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium transition-all duration-300 pointer-events-none peer-focus:top-0 peer-focus:left-2 peer-focus:text-[9px] peer-focus:font-bold peer-focus:px-1.5 peer-focus:py-0.5 peer-focus:rounded-full peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:left-2 peer-[:not(:placeholder-shown)]:text-[9px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:px-1.5 peer-[:not(:placeholder-shown)]:py-0.5 peer-[:not(:placeholder-shown)]:rounded-full"
                  >
                    {t('auth.email')}
                  </label>
                  {emailError && (
                    <p className="text-[9px] text-red-600 dark:text-red-400 mt-0.5 ml-2">{emailError}</p>
                  )}
                  {email.length > 3 && !emailError && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-500">
                      <Check size={14} />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Two Column Layout for Phone and Password */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {/* Phone Field */}
              <div className="space-y-1 relative">
                <div className="relative group">
                  <div className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 transition-colors z-10" style={{ color: phone ? accentColor : undefined }}>
                    <Phone size={14} />
                  </div>
                  <input
                    id="phone-input"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                    placeholder=""
                    autoComplete="tel"
                    aria-describedby={phoneError ? 'phone-error' : undefined}
                    aria-invalid={phoneError ? 'true' : 'false'}
                    style={getFieldStyle(Boolean(phone), Boolean(phoneError))}
                    className={`peer w-full pl-8 sm:pl-9 pr-7 sm:pr-8 py-2 sm:py-2.5 text-xs sm:text-sm border-2 rounded-lg transition-all duration-300 outline-none font-medium text-gray-905 dark:text-gray-100 placeholder:text-transparent ${
                      phoneError ? 'border-red-300 focus:border-red-400' : ''
                    }`}
                  />
                  <label
                    htmlFor="phone-input"
                    style={{ color: phone ? accentColor : undefined, backgroundColor: theme === 'dark' ? '#16171A' : '#ffffff' }}
                    className="absolute left-8 sm:left-9 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium transition-all duration-300 pointer-events-none peer-focus:top-0 peer-focus:left-2 peer-focus:text-[9px] peer-focus:font-bold peer-focus:px-1.5 peer-focus:py-0.5 peer-focus:rounded-full peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:left-2 peer-[:not(:placeholder-shown)]:text-[9px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:px-1.5 peer-[:not(:placeholder-shown)]:py-0.5 peer-[:not(:placeholder-shown)]:rounded-full"
                  >
                    {t('auth.phoneNumberLabel')}
                  </label>
                  {phoneError && (
                    <p className="text-[9px] text-red-600 dark:text-red-400 mt-0.5 ml-2">{phoneError}</p>
                  )}
                  {phone.length >= 10 && !phoneError && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-500">
                      <Check size={14} />
                    </div>
                  )}
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1 relative">
                <div className="relative group">
                  <div className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 transition-colors z-10" style={{ color: password ? accentColor : undefined }}>
                    <Lock size={14} />
                  </div>
                  <input
                    id="password-input"
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    placeholder=""
                    minLength={8}
                    autoComplete="new-password"
                    aria-describedby={passwordError ? 'password-error' : 'password-strength'}
                    aria-invalid={passwordError ? 'true' : 'false'}
                    style={getFieldStyle(Boolean(password), Boolean(passwordError))}
                    className={`peer w-full pl-8 sm:pl-9 pr-9 sm:pr-10 py-2 sm:py-2.5 text-xs sm:text-sm border-2 rounded-lg transition-all duration-300 outline-none font-medium text-gray-900 dark:text-gray-100 placeholder:text-transparent ${
                      passwordError ? 'border-red-300 focus:border-red-400' : ''
                    }`}
                  />
                  <label
                    htmlFor="password-input"
                    style={{ color: password ? accentColor : undefined, backgroundColor: theme === 'dark' ? '#16171A' : '#ffffff' }}
                    className="absolute left-8 sm:left-9 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium transition-all duration-300 pointer-events-none peer-focus:top-0 peer-focus:left-2 peer-focus:text-[9px] peer-focus:font-bold peer-focus:px-1.5 peer-focus:py-0.5 peer-focus:rounded-full peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:left-2 peer-[:not(:placeholder-shown)]:text-[9px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:px-1.5 peer-[:not(:placeholder-shown)]:py-0.5 peer-[:not(:placeholder-shown)]:rounded-full"
                  >
                    {t('auth.password')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    style={{ color: password ? accentColor : undefined }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 transition-colors p-1 z-10"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                
                {/* Password Strength Indicator */}
                {passwordStrength && password.length > 0 && (
                  <div className="mt-0.5 ml-2 space-y-0.5">
                    <div className="flex items-center gap-1">
                      <div className="flex-1 h-1 bg-gray-200 dark:bg-[#2E3036] rounded-full overflow-hidden">
                        <div 
                          className="h-full transition-all duration-300"
                          style={{ 
                            width: `${(passwordStrength.score / 4) * 100}%`,
                            backgroundColor: passwordStrength.color 
                          }}
                        />
                      </div>
                      <span className="text-[8px] sm:text-[9px] font-semibold" style={{ color: passwordStrength.color }}>
                        {passwordStrength.label}
                      </span>
                    </div>
                  </div>
                )}
                
                {passwordError && (
                  <p className="text-[9px] text-red-600 dark:text-red-400 mt-0.5 ml-2">{passwordError}</p>
                )}
              </div>
            </div>

            {/* Confirm Password - Full Width */}
            <div className="space-y-1 relative">
              <div className="relative group">
                <div className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 transition-colors z-10" style={{ color: confirmPassword ? accentColor : undefined }}>
                  <CheckCircle size={14} />
                </div>
                <input
                  id="confirm-password-input"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => handleConfirmPasswordChange(e.target.value)}
                  placeholder=""
                  autoComplete="new-password"
                  aria-describedby={confirmPasswordError ? 'confirm-password-error' : undefined}
                  aria-invalid={confirmPasswordError ? 'true' : 'false'}
                  style={getFieldStyle(Boolean(confirmPassword), Boolean(confirmPasswordError))}
                  className={`peer w-full pl-8 sm:pl-9 pr-9 sm:pr-10 py-2 sm:py-2.5 text-xs sm:text-sm border-2 rounded-lg transition-all duration-300 outline-none font-medium text-gray-900 dark:text-gray-100 placeholder:text-transparent ${
                    confirmPasswordError ? 'border-red-300 focus:border-red-400' : ''
                  }`}
                />
                <label
                  htmlFor="confirm-password-input"
                  style={{ color: confirmPassword ? accentColor : undefined, backgroundColor: theme === 'dark' ? '#16171A' : '#ffffff' }}
                  className="absolute left-8 sm:left-9 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 text-xs sm:text-sm font-medium transition-all duration-300 pointer-events-none peer-focus:top-0 peer-focus:left-2 peer-focus:text-[9px] peer-focus:font-bold peer-focus:px-1.5 peer-focus:py-0.5 peer-focus:rounded-full peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:left-2 peer-[:not(:placeholder-shown)]:text-[9px] peer-[:not(:placeholder-shown)]:font-bold peer-[:not(:placeholder-shown)]:px-1.5 peer-[:not(:placeholder-shown)]:py-0.5 peer-[:not(:placeholder-shown)]:rounded-full"
                >
                  {t('auth.confirmPassword')}
                </label>
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  style={{ color: confirmPassword ? accentColor : undefined }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 transition-colors p-1 z-10"
                >
                  {showConfirmPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                {confirmPassword && !confirmPasswordError && password === confirmPassword && (
                  <div className="absolute right-8 sm:right-9 top-1/2 -translate-y-1/2 text-emerald-500">
                    <Check size={14} />
                  </div>
                )}
              </div>
              {confirmPasswordError && (
                <p className="text-[9px] text-red-600 dark:text-red-400 mt-0.5 ml-2">{confirmPasswordError}</p>
              )}
            </div>

            {/* Terms and Conditions */}
            <div className="flex items-center gap-2 mt-1">
              <input
                type="checkbox"
                id="acceptTerms"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                required
                style={{ accentColor }}
                className="w-4 h-4 rounded border-gray-300 dark:border-[#2E3036] focus:ring-1 cursor-pointer flex-shrink-0"
              />
              <label htmlFor="acceptTerms" className="text-xs text-gray-600 dark:text-gray-400 cursor-pointer select-none leading-relaxed">
                {t('auth.acceptTermsText')}{' '}
                <Link to="/terms" style={{ color: accentColor }} className="font-medium underline">
                  {t('auth.acceptTermsLink')}
                </Link>{' '}
                {t('auth.acceptTermsAnd')}{' '}
                <Link to="/privacy" style={{ color: accentColor }} className="font-medium underline">
                  {t('auth.acceptTermsPrivacyLink')}
                </Link>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading || !acceptTerms}
              aria-busy={isLoading}
              style={{
                background: `linear-gradient(to right, ${accentColor}, ${accentColor}dd)`,
                boxShadow: `0 4px 8px ${accentColor}30`
              }}
              className="w-full py-3 text-white rounded-lg font-semibold hover:shadow-lg transition-shadow flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-4 cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="animate-spin" size={18} />
              ) : (
                <>
                  <span className="text-sm">{t('auth.signUp')}</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="mt-4 text-center space-y-1.5">
            <p className="text-xs text-gray-400 dark:text-gray-500 font-medium">
              {t('auth.hasAccount')}{' '}
              <Link to="/login" style={{ color: accentColor }} className="font-bold hover:underline underline-offset-4">
                {t('auth.signIn')}
              </Link>
            </p>
            <div className="pt-1 flex items-center justify-center gap-1 text-[9px] font-bold text-gray-305 dark:text-gray-500 uppercase tracking-widest">
              <Sparkles size={8} style={{ color: accentColor }} />
              {t('auth.premiumCareFeatures')}
            </div>
          </div>
        </div>

        <Link to="/" className="block mt-5 text-center text-[9px] font-bold text-gray-405 dark:text-gray-500 uppercase tracking-widest hover:text-gray-600 dark:hover:text-gray-400 transition-colors">
          ← {t('auth.backLanding')}
        </Link>
      </div>
    </div>
  );
};

export default Register;
