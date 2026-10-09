import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Zap,
  Volume2,
  VolumeX,
  Vibrate,
  AlertTriangle,
  Sparkles,
  Menu,
  X,
  BatteryCharging,
  HelpCircle,
  Sliders,
  ShieldCheck,
  Info,
  Radio,
  Music,
  UserCheck,
  Play,
  RotateCcw,
  Smartphone,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react';
import { WebAudioSimulator, DetectionMode } from '../utils/audioSimulator';

interface PhoneSimulatorProps {
  onSimulateClapTriggered?: () => void;
}

export const PhoneSimulator: React.FC<PhoneSimulatorProps> = ({ onSimulateClapTriggered }) => {
  const [isArmed, setIsArmed] = useState(false);
  const [isAlerting, setIsAlerting] = useState(false);
  const [alertReason, setAlertReason] = useState('Clap Sound');
  const [currentDb, setCurrentDb] = useState(-60);
  const [sensitivityDb, setSensitivityDb] = useState(-16);
  const [micActive, setMicActive] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  // Hardware Actuators
  const [enableTorch, setEnableTorch] = useState(true);
  const [enableVibrate, setEnableVibrate] = useState(true);
  const [enableSiren, setEnableSiren] = useState(true);

  // Detection Mode
  const [detectionMode, setDetectionMode] = useState<DetectionMode>('clap');
  const [preloadedVoice, setPreloadedVoice] = useState('Hey Phone!');
  const [hasCustomVoiceRecorded, setHasCustomVoiceRecorded] = useState(false);
  const [customVoiceName, setCustomVoiceName] = useState('My Voice Keyword');
  const [isRecordingCustomVoice, setIsRecordingCustomVoice] = useState(false);
  const [recordCountdown, setRecordCountdown] = useState(3);

  // Right Side Menu & Minimized Background State
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeMenuTab, setActiveMenuTab] = useState<'menu' | 'battery' | 'help' | 'privacy' | 'about'>('menu');
  const [isAppMinimized, setIsAppMinimized] = useState(false);

  const [detectedDb, setDetectedDb] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<WebAudioSimulator | null>(null);
  const recordTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const sim = new WebAudioSimulator();
    simRef.current = sim;

    sim.onTelemetry = ({ currentDb, waveformData }) => {
      setCurrentDb(currentDb);

      // Draw oscilloscope waveform on canvas
      const canvas = canvasRef.current;
      if (canvas && isArmed) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.lineWidth = 2;
          ctx.strokeStyle = '#10B981';
          ctx.beginPath();

          const sliceWidth = canvas.width / waveformData.length;
          let x = 0;

          for (let i = 0; i < waveformData.length; i++) {
            const v = waveformData[i] / 128.0;
            const y = (v * canvas.height) / 2;

            if (i === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
            x += sliceWidth;
          }

          ctx.stroke();
        }
      }
    };

    sim.onAlertTriggered = (db, reason) => {
      triggerAlarm(db, reason);
    };

    return () => {
      sim.stopListening();
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, [isArmed]);

  // Update simulator settings dynamically
  useEffect(() => {
    if (simRef.current) {
      simRef.current.setSensitivity(sensitivityDb);
      simRef.current.setMode(detectionMode);
      simRef.current.preloadedVoicePhrase = preloadedVoice;
      simRef.current.setCustomVoiceProfile(hasCustomVoiceRecorded ? 'profile_active' : null);
    }
  }, [sensitivityDb, detectionMode, preloadedVoice, hasCustomVoiceRecorded]);

  const triggerAlarm = (db: number, reason: string = 'Acoustic Sound') => {
    setIsAlerting(true);
    setAlertReason(reason);
    setDetectedDb(db);
    if (enableSiren && simRef.current) {
      simRef.current.startSiren();
    }
    if (enableVibrate && 'vibrate' in navigator) {
      navigator.vibrate([500, 200, 500, 200, 800, 200]);
    }
    onSimulateClapTriggered?.();
  };

  const handleToggleArmed = async () => {
    if (isArmed) {
      setIsArmed(false);
      setMicActive(false);
      simRef.current?.stopListening();
      setCurrentDb(-60);
      handleStopAlarm();
    } else {
      setIsArmed(true);
      setMicError(null);
      if (simRef.current) {
        const ok = await simRef.current.startListening(sensitivityDb, detectionMode);
        setMicActive(ok);
        if (!ok) {
          setMicError('Microphone permission needed. You can use "Simulate" to test triggers.');
        }
      }
    }
  };

  const handleStopAlarm = () => {
    setIsAlerting(false);
    simRef.current?.stopSiren();
  };

  const handleManualClap = () => {
    if (!isArmed) {
      setIsArmed(true);
    }
    let reason = 'Clap Sound';
    if (detectionMode === 'whistle') reason = 'Whistle Sound';
    if (detectionMode === 'preloaded_voice') reason = `Voice Trigger ("${preloadedVoice}")`;
    if (detectionMode === 'custom_voice') reason = `Custom Voice ("${customVoiceName}")`;
    triggerAlarm(-9.2, reason);
  };

  const handleStartCustomVoiceRecording = () => {
    setIsRecordingCustomVoice(true);
    setRecordCountdown(3);

    recordTimerRef.current = window.setInterval(() => {
      setRecordCountdown((prev) => {
        if (prev <= 1) {
          if (recordTimerRef.current) clearInterval(recordTimerRef.current);
          setIsRecordingCustomVoice(false);
          setHasCustomVoiceRecorded(true);
          setCustomVoiceName('Recorded Phrase ("Mera Phone")');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const normalizedDb = Math.min(1, Math.max(0, (currentDb + 60) / 60));
  const thresholdNorm = Math.min(1, Math.max(0, (sensitivityDb + 60) / 60));

  return (
    <div className="relative flex flex-col items-center">
      {/* Smartphone Hardware Frame */}
      <div className="relative w-[340px] sm:w-[380px] h-[720px] bg-slate-950 rounded-[48px] p-3 shadow-2xl shadow-emerald-950/20 border-4 border-slate-800 ring-1 ring-slate-700/50 flex flex-col overflow-hidden">
        {/* Top Notch Speaker / Dynamic Island */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center pointer-events-none">
          <div className="w-24 h-5 bg-black rounded-full flex items-center justify-between px-3">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-900 border border-slate-800" />
            <div className="w-3 h-3 rounded-full bg-slate-900/90 border border-emerald-500/40" />
          </div>
        </div>

        {/* Screen Bezel Area */}
        <div
          className={`relative flex-1 rounded-[38px] overflow-hidden flex flex-col bg-[#0A0E17] transition-all duration-300 ${
            isAlerting && enableTorch ? 'animate-strobe' : ''
          }`}
        >
          {/* iOS / Android Status Bar */}
          <div className="pt-6 px-6 pb-2 flex items-center justify-between text-[11px] font-medium text-slate-400 select-none z-10">
            <span>09:41</span>
            <div className="flex items-center gap-1.5">
              {isArmed && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-1.5 py-0.5 rounded">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Mic
                </span>
              )}
              <span>5G</span>
              <div className="w-5 h-2.5 rounded-sm border border-slate-400 p-0.5 flex items-center">
                <div className="w-3 h-full bg-emerald-400 rounded-2xs" />
              </div>
            </div>
          </div>

          {/* SIMULATED MINIMIZED HOME SCREEN (SHOWS PERSISTENT FOREGROUND NOTIFICATION) */}
          {isAppMinimized ? (
            <div className="flex-1 flex flex-col justify-between p-4 bg-gradient-to-b from-slate-900 via-slate-950 to-black animate-in fade-in duration-300">
              {/* Ongoing Android Sticky Notification */}
              <div className="mt-6 p-3 bg-slate-900/95 border border-emerald-500/40 rounded-2xl shadow-xl shadow-emerald-950/30 backdrop-blur-md">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                      <Mic className="w-4 h-4 animate-pulse" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white">Clap & Voice Finder</span>
                        <span className="text-[9px] px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded font-semibold">
                          FOREGROUND
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        {isArmed
                          ? `Monitoring active: ${
                              detectionMode === 'clap'
                                ? 'Clap Detection'
                                : detectionMode === 'whistle'
                                ? 'Whistle Mode'
                                : detectionMode === 'preloaded_voice'
                                ? `Voice: "${preloadedVoice}"`
                                : 'Custom Voice'
                            }`
                          : 'Service standby'}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono">Ongoing</span>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] text-emerald-400">
                  <span>✓ Mic running in background</span>
                  <button
                    onClick={handleManualClap}
                    className="px-2 py-1 bg-emerald-500 text-slate-950 font-bold rounded hover:bg-emerald-400 active:scale-95"
                  >
                    Simulate Sound
                  </button>
                </div>
              </div>

              {/* Wallpaper Icons */}
              <div className="my-auto text-center space-y-3">
                <p className="text-xs text-slate-400">
                  App is minimized to Phone Home Screen.
                  <br />
                  <span className="text-emerald-400 font-semibold">
                    The Native Foreground Service keeps listening!
                  </span>
                </p>
                <button
                  onClick={() => setIsAppMinimized(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold shadow-lg border border-slate-700 active:scale-95 transition-transform"
                >
                  Return to App Window
                </button>
              </div>

              {/* Home bar */}
              <div className="pb-1 flex justify-center">
                <div className="w-28 h-1 bg-slate-600 rounded-full" />
              </div>
            </div>
          ) : (
            <>
              {/* App Bar with Title & RIGHT SIDE MENU BUTTON */}
              <div className="px-5 py-2.5 flex items-center justify-between z-10">
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">Clap & Voice Finder</h2>
                  <p className="text-[10px] text-slate-400">Native Foreground Isolate</p>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={handleManualClap}
                    title="Simulate sound trigger"
                    className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors"
                  >
                    <Zap className="w-3 h-3" />
                    <span>Test</span>
                  </button>

                  {/* RIGHT SIDE MENU HAMBURGER BUTTON */}
                  <button
                    onClick={() => {
                      setIsMenuOpen(true);
                      setActiveMenuTab('menu');
                    }}
                    title="Open Menu & Details"
                    className="p-1.5 text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-700 border border-slate-700/80 rounded-lg transition-colors"
                  >
                    <Menu className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Service Status Chip Bar */}
              <div className="mx-4 mt-1 px-3 py-1.5 bg-slate-900/90 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      isArmed ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-600'
                    }`}
                  />
                  <span className="text-[11px] font-semibold text-slate-200">
                    {isArmed ? 'Foreground Active' : 'Service Paused'}
                  </span>
                </div>
                <button
                  onClick={() => setIsAppMinimized(true)}
                  title="Simulate pressing home button"
                  className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-medium bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20"
                >
                  <Smartphone className="w-3 h-3" />
                  <span>Test Minimize</span>
                </button>
              </div>

              {/* Center Radar / Arming Button */}
              <div className="flex-1 flex flex-col items-center justify-center relative py-2">
                {isArmed && (
                  <>
                    <div className="absolute w-40 h-40 rounded-full border border-emerald-500/20 animate-radar-1 pointer-events-none" />
                    <div className="absolute w-40 h-40 rounded-full border border-emerald-500/30 animate-radar-2 pointer-events-none" />
                    <div className="absolute w-40 h-40 rounded-full border border-emerald-500/40 animate-radar-3 pointer-events-none" />
                  </>
                )}

                <button
                  onClick={handleToggleArmed}
                  className={`relative z-10 w-32 h-32 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-xl active:scale-95 ${
                    isArmed
                      ? 'bg-gradient-to-br from-emerald-600 to-emerald-500 text-white shadow-emerald-500/30'
                      : 'bg-gradient-to-br from-slate-800 to-slate-900 text-slate-400 border border-slate-700/60 shadow-black/50 hover:border-slate-600'
                  }`}
                >
                  {isArmed ? (
                    <Mic className="w-9 h-9 text-white animate-pulse" />
                  ) : (
                    <MicOff className="w-9 h-9 text-slate-400" />
                  )}
                  <span className="mt-1 text-[11px] font-black tracking-wider uppercase text-white">
                    {isArmed ? 'ARMED' : 'DISARMED'}
                  </span>
                  <span className="text-[9px] opacity-80 text-slate-200">
                    {isArmed ? 'Tap to Pause' : 'Tap to Listen'}
                  </span>
                </button>

                {/* Oscilloscope Mini Waveform */}
                <div className="w-44 h-6 mt-3 bg-slate-950/70 rounded-md border border-slate-900 flex items-center justify-center overflow-hidden">
                  {isArmed ? (
                    <canvas ref={canvasRef} width={176} height={24} className="w-full h-full" />
                  ) : (
                    <span className="text-[9px] text-slate-600 font-mono">Audio engine standby</span>
                  )}
                </div>
              </div>

              {/* Live Decibel Progress Meter */}
              <div className="mx-4 px-3 py-2 bg-slate-900/60 border border-slate-800/80 rounded-xl">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-slate-400 text-[10px] font-medium">Acoustic dBFS</span>
                  <span className="font-mono text-emerald-400 text-[11px] font-semibold tabular-nums">
                    {isArmed ? `${currentDb.toFixed(1)} dBFS` : '-- dBFS'}
                  </span>
                </div>
                <div className="relative h-2 bg-slate-950 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-75 rounded-full ${
                      normalizedDb >= thresholdNorm ? 'bg-rose-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${isArmed ? Math.max(4, normalizedDb * 100) : 4}%` }}
                  />
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
                    style={{ left: `${thresholdNorm * 100}%` }}
                    title={`Threshold: ${sensitivityDb} dB`}
                  />
                </div>
                <div className="flex items-center justify-between mt-1 text-[8px] text-slate-500 font-mono">
                  <span>-60 dB</span>
                  <span className="text-amber-400">Trigger: {sensitivityDb} dB</span>
                  <span>0 dB</span>
                </div>
              </div>

              {/* BOTTOM SECTION: DETECTION OPTIONS SELECTOR */}
              <div className="mx-4 my-2 p-2.5 bg-slate-900/90 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-200">Detection Method</span>
                  <span className="text-[9px] text-emerald-400 font-medium">Select trigger sound</span>
                </div>

                {/* 4 Mode Buttons */}
                <div className="grid grid-cols-4 gap-1">
                  <button
                    onClick={() => setDetectionMode('clap')}
                    className={`py-1.5 px-1 rounded-lg text-center flex flex-col items-center gap-0.5 transition-colors ${
                      detectionMode === 'clap'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold'
                        : 'text-slate-400 bg-slate-950/40 border border-slate-800'
                    }`}
                  >
                    <span className="text-xs">👏</span>
                    <span className="text-[9px]">Clap</span>
                  </button>

                  <button
                    onClick={() => setDetectionMode('whistle')}
                    className={`py-1.5 px-1 rounded-lg text-center flex flex-col items-center gap-0.5 transition-colors ${
                      detectionMode === 'whistle'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                        : 'text-slate-400 bg-slate-950/40 border border-slate-800'
                    }`}
                  >
                    <span className="text-xs">🎵</span>
                    <span className="text-[9px]">Whistle</span>
                  </button>

                  <button
                    onClick={() => setDetectionMode('preloaded_voice')}
                    className={`py-1.5 px-1 rounded-lg text-center flex flex-col items-center gap-0.5 transition-colors ${
                      detectionMode === 'preloaded_voice'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold'
                        : 'text-slate-400 bg-slate-950/40 border border-slate-800'
                    }`}
                  >
                    <span className="text-xs">🗣️</span>
                    <span className="text-[9px]">Preload</span>
                  </button>

                  <button
                    onClick={() => setDetectionMode('custom_voice')}
                    className={`py-1.5 px-1 rounded-lg text-center flex flex-col items-center gap-0.5 transition-colors ${
                      detectionMode === 'custom_voice'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                        : 'text-slate-400 bg-slate-950/40 border border-slate-800'
                    }`}
                  >
                    <span className="text-xs">🎙️</span>
                    <span className="text-[9px]">Custom</span>
                  </button>
                </div>

                {/* Sub-controls depending on chosen mode */}
                {detectionMode === 'preloaded_voice' && (
                  <div className="pt-1.5 border-t border-slate-800/80">
                    <span className="text-[9px] text-slate-400 block mb-1">Pre-loaded Voice Keyword:</span>
                    <div className="flex flex-wrap gap-1">
                      {['Hey Phone!', 'Where Are You?', 'Find Me!'].map((phrase) => (
                        <button
                          key={phrase}
                          onClick={() => setPreloadedVoice(phrase)}
                          className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${
                            preloadedVoice === phrase
                              ? 'bg-purple-500/30 text-purple-200 border-purple-400'
                              : 'bg-slate-950/50 text-slate-400 border-slate-800'
                          }`}
                        >
                          {phrase}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {detectionMode === 'custom_voice' && (
                  <div className="pt-1.5 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="text-slate-300 font-medium">
                        {hasCustomVoiceRecorded ? 'Recorded Voice Active' : 'No Voice Recorded'}
                      </span>
                      {hasCustomVoiceRecorded && (
                        <span className="text-emerald-400 flex items-center gap-0.5 text-[9px]">
                          <CheckCircle2 className="w-2.5 h-2.5" /> Saved
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleStartCustomVoiceRecording}
                        disabled={isRecordingCustomVoice}
                        className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors ${
                          isRecordingCustomVoice
                            ? 'bg-red-500/20 text-red-300 border border-red-500 animate-pulse'
                            : 'bg-amber-500 hover:bg-amber-400 text-slate-950 active:scale-95'
                        }`}
                      >
                        <Mic className="w-3 h-3" />
                        <span>
                          {isRecordingCustomVoice
                            ? `Speaking (${recordCountdown}s)...`
                            : hasCustomVoiceRecorded
                            ? 'Re-record Voice'
                            : 'Record My Voice'}
                        </span>
                      </button>

                      {hasCustomVoiceRecorded && (
                        <button
                          onClick={handleManualClap}
                          title="Test trigger with custom voice"
                          className="p-1 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-[9px] flex items-center gap-0.5"
                        >
                          <Play className="w-2.5 h-2.5" />
                          <span>Test</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Phone Bottom Home Bar */}
              <div className="pb-2 flex justify-center">
                <div className="w-24 h-1 bg-slate-700/80 rounded-full" />
              </div>
            </>
          )}

          {/* SLIDE-IN RIGHT SIDE MENU DRAWER */}
          {isMenuOpen && (
            <div className="absolute inset-0 z-50 flex">
              {/* Backdrop */}
              <div
                onClick={() => setIsMenuOpen(false)}
                className="w-1/5 h-full bg-black/60 backdrop-blur-xs transition-opacity"
              />

              {/* Drawer Sheet */}
              <div className="w-4/5 h-full bg-[#0F172A] border-l border-slate-800 flex flex-col p-4 shadow-2xl animate-in slide-in-from-right duration-200">
                {/* Header */}
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-white">Menu & Settings</h3>
                    <p className="text-[10px] text-slate-400">Clap & Voice Finder v1.2</p>
                  </div>
                  <button
                    onClick={() => setIsMenuOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Drawer Body Tabs */}
                <div className="flex-1 overflow-y-auto py-3 space-y-2 text-xs">
                  {/* Item 1: App Minimize / Background Fix */}
                  <div
                    onClick={() => setActiveMenuTab('battery')}
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/40 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BatteryCharging className="w-4 h-4 text-amber-400" />
                        <span className="font-semibold text-white text-[11px]">Background / Sleep Fix</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Android battery saver guide to keep mic running when minimized.
                    </p>
                  </div>

                  {/* Item 2: Help & How to Use */}
                  <div
                    onClick={() => setActiveMenuTab('help')}
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-cyan-500/40 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <HelpCircle className="w-4 h-4 text-cyan-400" />
                        <span className="font-semibold text-white text-[11px]">Help & How to Use</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Full instructions for Clap, Whistle, and Custom Voice triggers.
                    </p>
                  </div>

                  {/* Item 3: Hardware Actuators */}
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex items-center gap-2">
                      <Sliders className="w-4 h-4 text-purple-400" />
                      <span className="font-semibold text-white text-[11px]">Alarm Actions</span>
                    </div>

                    <div className="grid grid-cols-3 gap-1 pt-1">
                      <button
                        onClick={() => setEnableTorch(!enableTorch)}
                        className={`py-1 px-1 rounded text-center text-[10px] font-medium border ${
                          enableTorch
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-950 text-slate-500 border-slate-800'
                        }`}
                      >
                        Torch {enableTorch ? 'ON' : 'OFF'}
                      </button>

                      <button
                        onClick={() => setEnableVibrate(!enableVibrate)}
                        className={`py-1 px-1 rounded text-center text-[10px] font-medium border ${
                          enableVibrate
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-950 text-slate-500 border-slate-800'
                        }`}
                      >
                        Vibrate {enableVibrate ? 'ON' : 'OFF'}
                      </button>

                      <button
                        onClick={() => setEnableSiren(!enableSiren)}
                        className={`py-1 px-1 rounded text-center text-[10px] font-medium border ${
                          enableSiren
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-950 text-slate-500 border-slate-800'
                        }`}
                      >
                        Siren {enableSiren ? 'ON' : 'OFF'}
                      </button>
                    </div>
                  </div>

                  {/* Item 4: Sensitivity Slider */}
                  <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-300 font-medium">Mic Sensitivity</span>
                      <span className="text-amber-400 font-mono font-bold">{sensitivityDb} dB</span>
                    </div>
                    <input
                      type="range"
                      min="-30"
                      max="-10"
                      step="1"
                      value={sensitivityDb}
                      onChange={(e) => setSensitivityDb(Number(e.target.value))}
                      className="w-full accent-emerald-500 h-1 bg-slate-800 rounded cursor-pointer"
                    />
                    <div className="flex justify-between text-[8px] text-slate-500">
                      <span>-30 dB (Sensitive)</span>
                      <span>-10 dB (Loud)</span>
                    </div>
                  </div>

                  {/* Item 5: Privacy */}
                  <div
                    onClick={() => setActiveMenuTab('privacy')}
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span className="font-semibold text-white text-[11px]">100% On-Device Privacy</span>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                  </div>

                  {/* Item 6: About */}
                  <div
                    onClick={() => setActiveMenuTab('about')}
                    className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Info className="w-4 h-4 text-emerald-400" />
                        <div>
                          <div className="font-semibold text-white text-[11px]">About & Developer Info</div>
                          <div className="text-[9px] text-slate-400">Abhinav Tripathi • Contact</div>
                        </div>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    </div>
                  </div>
                </div>

                {/* Sub-view Overlay if a tab is opened */}
                {activeMenuTab !== 'menu' && (
                  <div className="absolute inset-0 bg-[#0F172A] p-4 flex flex-col z-20">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                      <button
                        onClick={() => setActiveMenuTab('menu')}
                        className="text-xs text-emerald-400 font-bold hover:underline"
                      >
                        ← Back
                      </button>
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        {activeMenuTab}
                      </span>
                    </div>

                    <div className="flex-1 overflow-y-auto py-3 text-xs text-slate-300 space-y-2">
                      {activeMenuTab === 'battery' && (
                        <div className="space-y-2 leading-relaxed">
                          <h4 className="font-bold text-amber-400">Android Foreground Service Fix:</h4>
                          <p className="text-[11px]">
                            When an app is minimized, Android puts normal apps to sleep to save battery.
                          </p>
                          <p className="text-[11px]">
                            In this app, we implemented the official{' '}
                            <span className="text-emerald-400 font-mono">
                              FOREGROUND_SERVICE_MICROPHONE
                            </span>{' '}
                            with an ongoing sticky notification so the mic never shuts off!
                          </p>
                          <h5 className="font-bold text-white mt-2">Required Setting on Device:</h5>
                          <p className="text-[11px] bg-slate-950 p-2 rounded border border-slate-800">
                            1. Settings &gt; Apps &gt; Clap to Find
                            <br />
                            2. Battery &gt; Select "Unrestricted"
                            <br />
                            3. Turn OFF "Pause app if unused"
                          </p>
                        </div>
                      )}

                      {activeMenuTab === 'help' && (
                        <div className="space-y-2 text-[11px]">
                          <h4 className="font-bold text-cyan-400">How to Detect Phone:</h4>
                          <p>
                            <strong>1. Select Mode:</strong> Choose Clap, Whistle, Preload, or Custom Voice.
                          </p>
                          <p>
                            <strong>2. Tap ARMED:</strong> The circular button turns green.
                          </p>
                          <p>
                            <strong>3. Minimize App:</strong> Press Home or lock phone. The persistent notification
                            keeps listening.
                          </p>
                          <p>
                            <strong>4. Trigger Alarm:</strong> Make your sound or voice keyword to ring phone at max volume!
                          </p>
                        </div>
                      )}

                      {activeMenuTab === 'privacy' && (
                        <div className="space-y-2 text-[11px]">
                          <h4 className="font-bold text-emerald-400">100% Local Privacy:</h4>
                          <p>• Audio never leaves the phone memory isolate.</p>
                          <p>• Zero cloud uploads, zero telemetry, zero recordings saved online.</p>
                        </div>
                      )}

                      {activeMenuTab === 'about' && (
                        <div className="space-y-3 text-[11px]">
                          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                            <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                              Developer Information
                            </div>
                            <div className="flex items-center gap-2 text-white font-bold text-xs">
                              <span className="w-2 h-2 rounded-full bg-emerald-400" />
                              Abhinav Tripathi
                            </div>
                            <div className="flex items-center gap-1.5 text-sky-400 text-[11px] font-mono select-all">
                              <span>✉</span>
                              <a href="mailto:sarita.abhinav.t@gmail.com" className="hover:underline">
                                sarita.abhinav.t@gmail.com
                              </a>
                            </div>
                          </div>

                          <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1.5">
                            <h4 className="font-bold text-white">Clap & Voice Finder v1.2.0</h4>
                            <p className="text-slate-300">Target: Android 14+ / SDK 36 Foreground Isolate</p>
                            <p className="text-slate-300">Engine: Local Acoustic FFT & Transient Envelope Matcher</p>
                            <p className="text-slate-400 text-[10px] pt-1">
                              Built with persistent background foreground service, multi-mode sound triggers, and synchronized haptic, strobe, and siren actuators.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div className="pt-2 border-t border-slate-800 text-center text-[10px] text-slate-500">
                  Foreground Sentinel Ready
                </div>
              </div>
            </div>
          )}

          {/* Fullscreen Alerting Overlay when sound is detected */}
          {isAlerting && (
            <div className="absolute inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
              <div className="w-16 h-16 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center mb-4 animate-bounce">
                <AlertTriangle className="w-8 h-8 text-rose-500" />
              </div>
              <h3 className="text-xl font-black text-white tracking-wide">PHONE LOCATED!</h3>
              <p className="text-xs text-slate-300 mt-2 max-w-[240px]">
                {alertReason} registered at {detectedDb ? detectedDb.toFixed(1) : '-8.5'} dBFS. Siren, vibration, and
                strobe active.
              </p>
              <button
                onClick={handleStopAlarm}
                className="mt-8 w-full max-w-[240px] py-3.5 bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/30 transition-transform"
              >
                I Found It (Stop Alarm)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Simulator Help Footnote */}
      <div className="mt-3 flex items-center gap-2 text-xs text-slate-400">
        <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
        <span>Multi-mode Acoustic Sentinel with Persistent Foreground Notification.</span>
      </div>
    </div>
  );
};
