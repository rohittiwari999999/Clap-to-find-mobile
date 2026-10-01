import React, { useEffect, useRef, useState } from 'react';
import {
  Mic,
  MicOff,
  Zap,
  Volume2,
  VolumeX,
  Vibrate,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { WebAudioSimulator } from '../utils/audioSimulator';

interface PhoneSimulatorProps {
  onSimulateClapTriggered?: () => void;
}

export const PhoneSimulator: React.FC<PhoneSimulatorProps> = ({ onSimulateClapTriggered }) => {
  const [isArmed, setIsArmed] = useState(false);
  const [isAlerting, setIsAlerting] = useState(false);
  const [currentDb, setCurrentDb] = useState(-60);
  const [sensitivityDb, setSensitivityDb] = useState(-16);
  const [micActive, setMicActive] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const [enableTorch, setEnableTorch] = useState(true);
  const [enableVibrate, setEnableVibrate] = useState(true);
  const [enableSiren, setEnableSiren] = useState(true);

  const [detectedDb, setDetectedDb] = useState<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<WebAudioSimulator | null>(null);

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

    sim.onAlertTriggered = (db) => {
      triggerAlarm(db);
    };

    return () => {
      sim.stopListening();
    };
  }, [isArmed]);

  const triggerAlarm = (db: number) => {
    setIsAlerting(true);
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
        const ok = await simRef.current.startListening(sensitivityDb);
        setMicActive(ok);
        if (!ok) {
          setMicError('Microphone not accessible; use "Simulate Clap" below to test.');
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
    triggerAlarm(-9.2);
  };

  const normalizedDb = Math.min(1, Math.max(0, (currentDb + 60) / 60));
  const thresholdNorm = Math.min(1, Math.max(0, (sensitivityDb + 60) / 60));

  return (
    <div className="relative flex flex-col items-center">
      {/* Smartphone Hardware Frame */}
      <div className="relative w-[340px] sm:w-[380px] h-[720px] bg-slate-950 rounded-[48px] p-3 shadow-2xl shadow-emerald-950/20 border-4 border-slate-800 ring-1 ring-slate-700/50 flex flex-col overflow-hidden">
        {/* Top Notch Speaker / Dynamic Island */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center">
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
          <div className="pt-6 px-6 pb-2 flex items-center justify-between text-[11px] font-medium text-slate-400">
            <span>09:41</span>
            <div className="flex items-center gap-1.5">
              <span>5G</span>
              <div className="w-5 h-2.5 rounded-sm border border-slate-400 p-0.5 flex items-center">
                <div className="w-3 h-full bg-emerald-400 rounded-2xs" />
              </div>
            </div>
          </div>

          {/* Flutter App Bar */}
          <div className="px-5 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">Clap to Find</h2>
              <p className="text-[11px] text-slate-400">Background Audio Sentinel</p>
            </div>
            <button
              onClick={handleManualClap}
              title="Trigger simulated clap event"
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 rounded-md transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Simulate</span>
            </button>
          </div>

          {/* Service Status Chip Bar */}
          <div className="mx-4 mt-1 px-3 py-2 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  isArmed ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]' : 'bg-slate-600'
                }`}
              />
              <span className="text-xs font-semibold text-slate-200">
                {isArmed ? 'Service Active (Foreground)' : 'Service Disabled'}
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {isArmed ? (micActive ? 'Live Mic' : 'Armed') : 'Idle'}
            </span>
          </div>

          {micError && isArmed && (
            <div className="mx-4 mt-2 px-2.5 py-1.5 bg-amber-950/40 border border-amber-800/40 rounded-lg text-[10px] text-amber-200/90 leading-tight">
              {micError}
            </div>
          )}

          {/* Center Circular Radar Trigger */}
          <div className="flex-1 flex flex-col items-center justify-center relative py-4">
            {/* Pulsing Radar Waves */}
            {isArmed && (
              <>
                <div className="absolute w-44 h-44 rounded-full border border-emerald-500/20 animate-radar-1 pointer-events-none" />
                <div className="absolute w-44 h-44 rounded-full border border-emerald-500/30 animate-radar-2 pointer-events-none" />
                <div className="absolute w-44 h-44 rounded-full border border-emerald-500/40 animate-radar-3 pointer-events-none" />
              </>
            )}

            {/* Central Arming Button */}
            <button
              onClick={handleToggleArmed}
              className={`relative z-10 w-36 h-36 rounded-full flex flex-col items-center justify-center transition-all duration-300 shadow-xl active:scale-95 ${
                isArmed
                  ? 'bg-gradient-to-br from-emerald-600 to-emerald-500 text-white shadow-emerald-500/30'
                  : 'bg-gradient-to-br from-slate-800 to-slate-900 text-slate-400 border border-slate-700/60 shadow-black/50 hover:border-slate-600'
              }`}
            >
              {isArmed ? (
                <Mic className="w-10 h-10 text-white animate-pulse" />
              ) : (
                <MicOff className="w-10 h-10 text-slate-400" />
              )}
              <span className="mt-2 text-xs font-black tracking-wider uppercase text-white">
                {isArmed ? 'ARMED' : 'DISARMED'}
              </span>
              <span className="text-[10px] opacity-80 text-slate-200">
                {isArmed ? 'Tap to Pause' : 'Tap to Listen'}
              </span>
            </button>

            {/* Live Audio Waveform Canvas */}
            <div className="w-48 h-8 mt-4 bg-slate-950/60 rounded-md border border-slate-900 flex items-center justify-center overflow-hidden">
              {isArmed ? (
                <canvas ref={canvasRef} width={192} height={32} className="w-full h-full" />
              ) : (
                <span className="text-[10px] text-slate-600 font-mono">Audio engine standby</span>
              )}
            </div>
          </div>

          {/* Acoustic Decibels Progress Meter */}
          <div className="mx-4 px-3.5 py-2.5 bg-slate-900/60 border border-slate-800/80 rounded-xl">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-400 text-[11px] font-medium">Acoustic Input Level</span>
              <span className="font-mono text-emerald-400 text-xs font-semibold tabular-nums">
                {isArmed ? `${currentDb.toFixed(1)} dBFS` : '-- dBFS'}
              </span>
            </div>
            <div className="relative h-2.5 bg-slate-950 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-75 rounded-full ${
                  normalizedDb >= thresholdNorm ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${isArmed ? Math.max(4, normalizedDb * 100) : 4}%` }}
              />
              {/* Threshold indicator line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10"
                style={{ left: `${thresholdNorm * 100}%` }}
                title={`Threshold: ${sensitivityDb} dB`}
              />
            </div>
            <div className="flex items-center justify-between mt-1 text-[9px] text-slate-500 font-mono">
              <span>-60 dB (Quiet)</span>
              <span className="text-amber-400">Trigger: {sensitivityDb} dB</span>
              <span>0 dB (Clap)</span>
            </div>
          </div>

          {/* Sensitivity & Actuators Card */}
          <div className="mx-4 my-3 p-3 bg-slate-900/90 border border-slate-800 rounded-xl space-y-3">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="font-medium text-slate-300 text-[11px]">Detection Sensitivity</span>
                <span className="font-mono text-amber-400 text-[11px] tabular-nums font-semibold">
                  {sensitivityDb} dB
                </span>
              </div>
              <input
                type="range"
                min="-30"
                max="-10"
                step="1"
                value={sensitivityDb}
                onChange={(e) => setSensitivityDb(Number(e.target.value))}
                className="w-full accent-emerald-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-3 gap-1 pt-1 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setEnableTorch(!enableTorch)}
                className={`py-1.5 px-2 rounded-lg text-center flex flex-col items-center gap-0.5 transition-colors ${
                  enableTorch ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'text-slate-500 bg-slate-950/40 border border-transparent'
                }`}
              >
                <Zap className="w-3.5 h-3.5" />
                <span className="text-[10px] font-medium">Strobe</span>
              </button>

              <button
                type="button"
                onClick={() => setEnableVibrate(!enableVibrate)}
                className={`py-1.5 px-2 rounded-lg text-center flex flex-col items-center gap-0.5 transition-colors ${
                  enableVibrate ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'text-slate-500 bg-slate-950/40 border border-transparent'
                }`}
              >
                <Vibrate className="w-3.5 h-3.5" />
                <span className="text-[10px] font-medium">Vibrate</span>
              </button>

              <button
                type="button"
                onClick={() => setEnableSiren(!enableSiren)}
                className={`py-1.5 px-2 rounded-lg text-center flex flex-col items-center gap-0.5 transition-colors ${
                  enableSiren ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30' : 'text-slate-500 bg-slate-950/40 border border-transparent'
                }`}
              >
                {enableSiren ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                <span className="text-[10px] font-medium">Siren</span>
              </button>
            </div>
          </div>

          {/* Phone Bottom Home Bar */}
          <div className="pb-3 flex justify-center">
            <div className="w-28 h-1 bg-slate-700/80 rounded-full" />
          </div>

          {/* Fullscreen Alerting Overlay on Clap Detected */}
          {isAlerting && (
            <div className="absolute inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-6 text-center animate-in fade-in duration-200">
              <div className="w-16 h-16 rounded-full bg-rose-500/20 border-2 border-rose-500 flex items-center justify-center mb-4 animate-bounce">
                <AlertTriangle className="w-8 h-8 text-rose-500" />
              </div>
              <h3 className="text-xl font-black text-white tracking-wide">CLAP DETECTED!</h3>
              <p className="text-xs text-slate-300 mt-2 max-w-[240px]">
                {detectedDb ? `Spike registered at ${detectedDb.toFixed(1)} dBFS.` : 'Acoustic spike registered.'} High-priority alarm loop, vibration haptics, and flashlight strobe active.
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
        <span>Live Web Audio simulation mirror of Flutter foreground isolate.</span>
      </div>
    </div>
  );
};
