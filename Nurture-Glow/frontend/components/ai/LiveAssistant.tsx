"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Square, Sparkles, AlertCircle, Loader2, Send, Keyboard } from 'lucide-react';

type VoiceState = 'idle' | 'recording' | 'transcribing' | 'thinking' | 'speaking';

export const LiveAssistant: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [state, setState] = useState<VoiceState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInput, setTextInput] = useState('');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const speechRecogRef = useRef<any>(null);
  const speechTextRef = useRef<string>('');

  useEffect(() => {
    return () => {
      cleanupAll();
      speechSynthesis.cancel();
    };
  }, []);

  const cleanupAll = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecorderRef.current?.state !== 'inactive') {
      try { mediaRecorderRef.current?.stop(); } catch {}
    }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (speechRecogRef.current) { try { speechRecogRef.current.abort(); } catch {} speechRecogRef.current = null; }
    mediaRecorderRef.current = null;
    speechTextRef.current = '';
  };

  const getAuthToken = (): string | null => localStorage.getItem('ng_auth_token');
  const getApiUrl = (): string => (import.meta.env.VITE_API_URL as string) || 'http://localhost:4000';

  const startRecording = useCallback(async () => {
    setErrorMessage(null);
    setTranscript(null);
    setAiResponse(null);
    setRecordingTime(0);
    speechTextRef.current = '';

    const token = getAuthToken();
    if (!token) { setErrorMessage('Please log in first to use the voice assistant.'); return; }

    try {
      // Request microphone — must be in a user-gesture handler
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // ---- Start MediaRecorder (audio backup for Whisper) ----
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
        .find(m => MediaRecorder.isTypeSupported(m)) || '';
      
      if (mimeType) {
        audioChunksRef.current = [];
        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;
        recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
        recorder.onerror = () => {}; // handled in stopRecording
        recorder.start(250);
      }

      // ---- Start Web Speech API (free real-time transcription) ----
      const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
      if (SpeechRecognition) {
        try {
          const recognizer = new SpeechRecognition();
          recognizer.continuous = true;
          recognizer.interimResults = true;
          recognizer.lang = 'en-US';
          recognizer.onresult = (event: any) => {
            let final = '';
            for (let i = 0; i < event.results.length; i++) {
              if (event.results[i].isFinal) final += event.results[i][0].transcript + ' ';
            }
            if (final.trim()) speechTextRef.current = final.trim();
          };
          recognizer.onerror = () => {}; // Silently ignore — Whisper is the backup
          recognizer.onend = () => {};
          recognizer.start();
          speechRecogRef.current = recognizer;
        } catch { /* Web Speech not available — will use Whisper */ }
      }

      setState('recording');

      // Recording timer with 30s auto-stop
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= 30) { stopRecording(); return prev; }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      const msg = err?.name === 'NotAllowedError'
        ? 'Microphone access was denied. Please allow permission in browser settings.'
        : err?.name === 'NotFoundError'
          ? 'No microphone detected. Please connect a microphone.'
          : `Microphone error: ${err?.message || 'Unknown'}`;
      setErrorMessage(msg);
      setState('idle');
    }
  }, []);

  const stopRecording = useCallback(() => {
    // Stop Web Speech API
    if (speechRecogRef.current) {
      try { speechRecogRef.current.stop(); } catch {}
    }

    // Stop MediaRecorder — triggers processAudio flow
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.onstop = async () => {
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

        // Decide which transcription to use
        const webSpeechText = speechTextRef.current.trim();
        
        if (webSpeechText) {
          // Web Speech API succeeded — use it directly (free, instant)
          await processTranscript(webSpeechText);
        } else {
          // Web Speech failed — try Whisper with the recorded audio
          const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm';
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          audioChunksRef.current = [];

          if (blob.size < 1000) {
            setErrorMessage('Recording too short. Please speak for at least 1-2 seconds.');
            setState('idle');
            return;
          }
          await processAudioWithWhisper(blob, mimeType);
        }
      };
      mediaRecorderRef.current.stop();
    } else {
      // MediaRecorder wasn't running — check Web Speech only
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }

      const webSpeechText = speechTextRef.current.trim();
      if (webSpeechText) {
        processTranscript(webSpeechText);
      } else {
        setErrorMessage('Could not capture your voice. Please try again or use the text input below.');
        setShowTextInput(true);
        setState('idle');
      }
    }
  }, []);

  const processTranscript = async (text: string) => {
    setTranscript(text);
    setState('thinking');

    const apiUrl = getApiUrl();
    const token = getAuthToken();
    if (!token) { setErrorMessage('Please log in again.'); setState('idle'); return; }

    try {
      const chatRes = await fetch(`${apiUrl}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ message: text, locale: 'en', includeContext: true })
      });

      if (!chatRes.ok) throw new Error('AI response failed');

      const chatData = await chatRes.json();
      const responseText = chatData.text || 'Sorry, I could not generate a response.';
      setAiResponse(responseText.length > 400 ? responseText.slice(0, 400) + '...' : responseText);

      // Speak the response
      setState('speaking');
      speechSynthesis.cancel();
      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(responseText);
        utterance.lang = 'en-US';
        utterance.rate = 0.95;
        utterance.pitch = 1;
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        speechSynthesis.speak(utterance);
        setTimeout(() => resolve(), 60000);
      });
      setState('idle');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to get AI response.');
      setState('idle');
    }
  };

  const processAudioWithWhisper = async (blob: Blob, mimeType: string) => {
    setState('transcribing');
    const apiUrl = getApiUrl();
    const token = getAuthToken();
    if (!token) { setErrorMessage('Please log in again.'); setState('idle'); return; }

    try {
      const arrayBuffer = await blob.arrayBuffer();
      const base64 = btoa(new Uint8Array(arrayBuffer).reduce((d, b) => d + String.fromCharCode(b), ''));

      const res = await fetch(`${apiUrl}/api/ai/transcribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ audio: base64, mimeType: mimeType.split(';')[0] })
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Transcription failed');
      }

      const data = await res.json();
      const text = data.text?.trim();
      if (!text) {
        setErrorMessage('No speech detected. Please speak clearly, or type your question below.');
        setShowTextInput(true);
        setState('idle');
        return;
      }

      await processTranscript(text);
    } catch (err: any) {
      console.error('Whisper error:', err);
      setErrorMessage('Voice transcription unavailable. Please type your question below.');
      setShowTextInput(true);
      setState('idle');
    }
  };

  const handleTextSubmit = async () => {
    const text = textInput.trim();
    if (!text) return;
    setTextInput('');
    setShowTextInput(false);
    setErrorMessage(null);
    await processTranscript(text);
  };

  const handleClose = () => { cleanupAll(); speechSynthesis.cancel(); onClose(); };
  const formatTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const stateLabel: Record<VoiceState, string> = {
    idle: 'Voice Assistant', recording: 'Recording...', transcribing: 'Transcribing...',
    thinking: 'AI is thinking...', speaking: 'Speaking...'
  };

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-md p-4">
      <div className="bg-white rounded-[28px] p-7 flex flex-col gap-3 shadow-2xl text-center animate-in zoom-in-95 duration-300 w-[clamp(360px,92vw,560px)] max-h-[90vh] overflow-y-auto relative">
        {/* Close Button */}
        <button onClick={handleClose} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors" aria-label="Close">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
        </button>

        {/* Mic visual */}
        <div className="relative mt-2">
          <div className={`w-28 h-28 rounded-full flex items-center justify-center mx-auto ring-8 transition-all duration-500 ${
            state === 'recording' ? 'bg-red-50 ring-red-100 scale-110' :
            state === 'transcribing' || state === 'thinking' ? 'bg-amber-50 ring-amber-100' :
            state === 'speaking' ? 'bg-[#BFE6DA]/20 ring-[#BFE6DA]/10' : 'bg-gray-50 ring-gray-100'
          }`}>
            {state === 'recording' ? (
              <div className="flex flex-col items-center gap-1">
                <div className="flex gap-1.5 items-end h-7">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-1.5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 120}ms`, height: `${30 + Math.random() * 70}%` }} />
                  ))}
                </div>
                <span className="text-xs font-mono font-bold text-red-600">{formatTime(recordingTime)}</span>
              </div>
            ) : state === 'transcribing' || state === 'thinking' ? (
              <Loader2 className="text-amber-500 animate-spin" size={40} />
            ) : state === 'speaking' ? (
              <div className="flex gap-1.5 items-end h-7">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="w-1.5 bg-teal-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms`, height: `${30 + Math.random() * 70}%` }} />
                ))}
              </div>
            ) : (
              <Mic className="text-gray-400" size={40} />
            )}
          </div>
          {state === 'recording' && <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-2.5 py-0.5 rounded-full animate-pulse uppercase tracking-widest">REC</div>}
        </div>

        <h3 className="text-xl font-bold text-gray-800 flex items-center justify-center gap-2">
          <Sparkles className="text-[#E6C77A]" size={18} /> {stateLabel[state]}
        </h3>

        {/* Error */}
        {errorMessage && (
          <div className="p-3 bg-red-50 rounded-2xl flex items-start gap-2 text-left">
            <AlertCircle size={16} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-red-700 font-medium leading-relaxed">{errorMessage}</p>
          </div>
        )}

        {/* Transcript */}
        {transcript && (
          <div className="p-3 bg-gray-50 rounded-2xl text-left">
            <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-1">You said:</p>
            <p className="text-sm text-gray-700">{transcript}</p>
          </div>
        )}

        {/* AI Response */}
        {aiResponse && (
          <div className="p-3 bg-teal-50 rounded-2xl text-left">
            <p className="text-[9px] font-bold text-teal-500 uppercase tracking-widest mb-1">AI Response:</p>
            <p className="text-sm text-teal-800 leading-relaxed whitespace-pre-wrap">{aiResponse}</p>
          </div>
        )}

        {/* Instructions */}
        {!errorMessage && !transcript && !aiResponse && state === 'idle' && !showTextInput && (
          <p className="text-sm text-gray-500">Tap <strong>Start Recording</strong>, speak your question, then tap <strong>Stop & Send</strong>.</p>
        )}

        {/* Text Input Fallback */}
        {showTextInput && state === 'idle' && (
          <div className="flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleTextSubmit()}
              placeholder="Type your question here..."
              className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-300 focus:border-teal-400"
              autoFocus
            />
            <button onClick={handleTextSubmit} disabled={!textInput.trim()} className="p-3 bg-teal-600 text-white rounded-2xl hover:bg-teal-700 disabled:opacity-50 transition-all">
              <Send size={18} />
            </button>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-2 pt-1">
          {state === 'idle' && (
            <button onClick={startRecording} className="w-full h-[48px] bg-teal-600 text-white rounded-3xl font-bold shadow-lg shadow-teal-600/20 hover:bg-teal-700 active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2">
              <Mic size={16} /> Start Recording
            </button>
          )}

          {state === 'recording' && (
            <button onClick={stopRecording} className="w-full h-[48px] bg-red-600 text-white rounded-3xl font-bold shadow-lg shadow-red-600/20 active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2 animate-pulse">
              <Square size={14} /> Stop & Send
            </button>
          )}

          {(state === 'transcribing' || state === 'thinking') && (
            <div className="w-full h-[48px] bg-gray-200 text-gray-500 rounded-3xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Processing...
            </div>
          )}

          {state === 'speaking' && (
            <button onClick={() => { speechSynthesis.cancel(); setState('idle'); }} className="w-full h-[48px] bg-amber-500 text-white rounded-3xl font-bold shadow-lg hover:bg-amber-600 active:scale-95 transition-all uppercase tracking-widest text-xs flex items-center justify-center gap-2">
              <MicOff size={14} /> Stop Speaking
            </button>
          )}

          {state === 'idle' && !showTextInput && (
            <button onClick={() => { setShowTextInput(true); setErrorMessage(null); }} className="w-full h-[36px] text-gray-500 hover:text-teal-600 text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors">
              <Keyboard size={14} /> Or type your question instead
            </button>
          )}

          <button onClick={handleClose} className="w-full h-[36px] bg-gray-100 text-gray-500 rounded-3xl font-bold hover:bg-gray-200 transition-all uppercase tracking-widest text-[10px] flex items-center justify-center">
            Close
          </button>

          <p className="text-[9px] text-gray-400 font-medium">Powered by AI. Your voice data is not stored.</p>
        </div>
      </div>
    </div>
  );
};
