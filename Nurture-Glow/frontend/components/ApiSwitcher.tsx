import React, { useState, useEffect, useCallback } from 'react';
import { Server, Check, Wifi, WifiOff, RefreshCw, X, AlertTriangle } from 'lucide-react';
import { API_BASE } from '../constants';

interface BackendPreset {
  name: string;
  url: string;
  description: string;
}

const PRESETS: BackendPreset[] = [
  {
    name: 'Local Backend',
    url: 'http://localhost:4000',
    description: 'Runs on your local computer'
  },
  {
    name: 'Deployed Render Backend',
    url: 'https://nurture-glow-4.onrender.com',
    description: 'Production cloud instance'
  }
];

export const ApiSwitcher: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentUrl, setCurrentUrl] = useState(API_BASE);
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [customUrl, setCustomUrl] = useState('');
  const [healthStatus, setHealthStatus] = useState<'checking' | 'online' | 'offline' | 'idle'>('idle');
  const [healthMessage, setHealthMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Determine preset on mount
  useEffect(() => {
    const matched = PRESETS.find(p => p.url.replace(/\/$/, '') === currentUrl.replace(/\/$/, ''));
    if (matched) {
      setSelectedPreset(matched.url);
      setCustomUrl('');
    } else {
      setSelectedPreset('custom');
      setCustomUrl(currentUrl);
    }
  }, [currentUrl]);

  // Check health of an API URL
  const checkHealth = useCallback(async (urlToCheck: string) => {
    if (!urlToCheck) {
      setHealthStatus('idle');
      return;
    }

    setHealthStatus('checking');
    setHealthMessage('Checking connection...');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

    try {
      // Remove trailing slash if present
      const cleanUrl = urlToCheck.replace(/\/$/, '');
      const response = await fetch(`${cleanUrl}/api/health`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        if (data.status === 'healthy') {
          setHealthStatus('online');
          setHealthMessage('Backend is reachable and healthy.');
        } else {
          setHealthStatus('offline');
          setHealthMessage('Reachable, but backend reported warnings.');
        }
      } else {
        setHealthStatus('offline');
        setHealthMessage(`Reachable, but returned error status: ${response.status}`);
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      setHealthStatus('offline');
      if (err.name === 'AbortError') {
        setHealthMessage('Connection timed out (no response in 6 seconds).');
      } else {
        setHealthMessage('Connection failed. Server might be down or CORS is blocking request.');
      }
    }
  }, []);

  // Run healthcheck when selection changes or switcher opens
  useEffect(() => {
    if (isOpen) {
      const activeUrl = selectedPreset === 'custom' ? customUrl : selectedPreset;
      checkHealth(activeUrl);
    }
  }, [isOpen, selectedPreset, customUrl, checkHealth]);

  const handleSave = () => {
    const finalUrl = selectedPreset === 'custom' ? customUrl.trim() : selectedPreset;
    
    if (!finalUrl) {
      alert('Please enter a valid API URL');
      return;
    }

    setIsSaving(true);
    
    // Set url in localStorage
    localStorage.setItem('ng_api_url', finalUrl);
    
    // Clear user and tokens to prevent token mismatch on the other DB
    localStorage.removeItem('ng_auth_token');
    localStorage.removeItem('ng_auth_user');
    
    // Give visual feedback and reload
    setTimeout(() => {
      window.location.reload();
    }, 800);
  };

  return (
    <div className="fixed bottom-24 md:bottom-6 right-6 z-[9999] font-sans">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 px-4 py-3 bg-[#1B4D3E]/90 hover:bg-[#1B4D3E] text-white rounded-full shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 group border border-emerald-500/25 cursor-pointer"
          title="Select API Server"
        >
          <Server size={18} className="animate-pulse group-hover:rotate-12 transition-transform" />
          <span className="text-xs font-bold tracking-wide hidden sm:inline">Backend: {currentUrl.includes('localhost') ? 'Local' : 'Render'}</span>
        </button>
      )}

      {/* Expanded Selector Panel */}
      {isOpen && (
        <div className="w-[320px] bg-white/95 dark:bg-[#1B1C20]/95 backdrop-blur-xl border border-gray-200/50 dark:border-[#2E3036] rounded-3xl p-5 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col gap-4 text-left">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-[#E6C77A]/15 rounded-lg text-[#E6C77A]">
                <Server size={16} />
              </div>
              <div>
                <h4 className="text-xs font-black text-gray-800 dark:text-white uppercase tracking-wider">Backend Config</h4>
                <p className="text-[10px] text-gray-400">Pair frontend with any API</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Active Connection Status */}
          <div className="p-3 bg-gray-50 dark:bg-[#15161A] rounded-2xl flex items-center justify-between border border-gray-150/40 dark:border-[#23252B]">
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-400 font-medium">Currently Selected</span>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-300 truncate max-w-[200px]">{currentUrl}</span>
            </div>
            
            <div className="flex items-center gap-1.5">
              {healthStatus === 'checking' && (
                <RefreshCw size={14} className="text-[#E6C77A] animate-spin" />
              )}
              {healthStatus === 'online' && (
                <div className="flex items-center gap-1 bg-emerald-100 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <Wifi size={10} className="text-emerald-600 dark:text-emerald-400 animate-pulse" />
                  <span className="text-[8px] font-black text-emerald-700 dark:text-emerald-450 uppercase">Online</span>
                </div>
              )}
              {healthStatus === 'offline' && (
                <div className="flex items-center gap-1 bg-red-100 dark:bg-red-950/40 px-2 py-0.5 rounded-full border border-red-500/20">
                  <WifiOff size={10} className="text-red-500 dark:text-red-400" />
                  <span className="text-[8px] font-black text-red-600 dark:text-red-400 uppercase">Offline</span>
                </div>
              )}
            </div>
          </div>

          {/* Presets List */}
          <div className="flex flex-col gap-2.5">
            <label className="text-[9px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">Select Server Environment</label>
            
            {PRESETS.map((preset) => (
              <button
                key={preset.url}
                onClick={() => setSelectedPreset(preset.url)}
                className={`w-full p-3 rounded-2xl border text-left flex items-start justify-between transition-all group hover:scale-[1.01] cursor-pointer ${
                  selectedPreset === preset.url
                    ? 'border-[#1B4D3E] bg-[#1B4D3E]/5 dark:border-[#34D399] dark:bg-[#34D399]/5'
                    : 'border-gray-200 dark:border-[#2E3036] hover:bg-gray-50 dark:hover:bg-[#1D1E22]'
                }`}
              >
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-800 dark:text-white">{preset.name}</span>
                  <span className="text-[10px] text-gray-400 font-mono mt-0.5 truncate max-w-[210px]">{preset.url}</span>
                  <span className="text-[9px] text-gray-400 dark:text-gray-500 mt-1 italic">{preset.description}</span>
                </div>
                {selectedPreset === preset.url && (
                  <div className="p-0.5 bg-[#1B4D3E] dark:bg-[#34D399] rounded-full text-white mt-1">
                    <Check size={10} />
                  </div>
                )}
              </button>
            ))}

            {/* Custom URL Option */}
            <div
              className={`p-3 rounded-2xl border transition-all flex flex-col gap-2 ${
                selectedPreset === 'custom'
                  ? 'border-[#1B4D3E] bg-[#1B4D3E]/5 dark:border-[#34D399] dark:bg-[#34D399]/5'
                  : 'border-gray-200 dark:border-[#2E3036] hover:bg-gray-50 dark:hover:bg-[#1D1E22]'
              }`}
            >
              <button
                onClick={() => setSelectedPreset('custom')}
                className="w-full text-left flex items-center justify-between cursor-pointer"
              >
                <div className="flex flex-col">
                  <span className="text-xs font-bold text-gray-800 dark:text-white">Custom Endpoint</span>
                  <span className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5">Use your own local port or tunnel</span>
                </div>
                {selectedPreset === 'custom' && (
                  <div className="p-0.5 bg-[#1B4D3E] dark:bg-[#34D399] rounded-full text-white">
                    <Check size={10} />
                  </div>
                )}
              </button>

              {selectedPreset === 'custom' && (
                <input
                  type="text"
                  placeholder="e.g. http://localhost:3000"
                  value={customUrl}
                  onChange={(e) => setCustomUrl(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white dark:bg-[#15161A] border border-gray-200 dark:border-[#2E3036] rounded-xl text-xs outline-none focus:border-[#1B4D3E] dark:focus:border-[#34D399] text-gray-700 dark:text-gray-300 font-mono"
                />
              )}
            </div>
          </div>

          {/* Health Diagnostics Alert */}
          {healthStatus !== 'idle' && (
            <div className={`p-2.5 rounded-xl text-[10px] leading-relaxed flex gap-2 ${
              healthStatus === 'online'
                ? 'bg-emerald-50 dark:bg-emerald-950/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/10'
                : healthStatus === 'offline'
                ? 'bg-red-50 dark:bg-red-950/10 text-red-700 dark:text-red-400 border border-red-500/10'
                : 'bg-amber-50 dark:bg-amber-950/10 text-amber-700 dark:text-amber-400 border border-[#E6C77A]/15'
            }`}>
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <span>{healthMessage}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1 border-t border-gray-150/40 dark:border-[#23252A]">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1 py-2 px-3 bg-[#1B4D3E] hover:bg-[#1B4D3E]/90 dark:bg-[#34D399] dark:hover:bg-[#34D399]/90 text-white dark:text-gray-900 rounded-xl text-xs font-bold shadow-md shadow-emerald-950/10 disabled:opacity-50 transition-all flex items-center justify-center gap-1 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <RefreshCw size={12} className="animate-spin" />
                  <span>Reloading...</span>
                </>
              ) : (
                <span>Apply & Reload</span>
              )}
            </button>
            
            <button
              onClick={() => {
                const activeUrl = selectedPreset === 'custom' ? customUrl : selectedPreset;
                checkHealth(activeUrl);
              }}
              className="py-2 px-3 border border-gray-200 dark:border-[#2E3036] hover:bg-gray-50 dark:hover:bg-[#1D1E22] text-gray-500 dark:text-gray-400 rounded-xl text-xs font-semibold transition-all cursor-pointer"
              title="Ping Backend"
            >
              <RefreshCw size={12} />
            </button>
          </div>

          {/* Security & Token Note */}
          <p className="text-[9px] text-gray-400 leading-normal text-center">
            🔒 Switching backends logs out your active local session to prevent token corruption.
          </p>
        </div>
      )}
    </div>
  );
};
