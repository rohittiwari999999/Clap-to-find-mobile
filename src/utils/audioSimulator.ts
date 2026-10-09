/**
 * Web Audio API Acoustic Simulator for testing Clap & Voice detection algorithms.
 * Mirrors the native Flutter isolate AudioRecorder multi-mode acoustic detection logic.
 */

export type DetectionMode = 'clap' | 'whistle' | 'preloaded_voice' | 'custom_voice';

export class WebAudioSimulator {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private sirenOscillator: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private sirenIntervalId: number | null = null;

  private ambientBaselineDb = -45;
  private lastTriggerTime = 0;
  private cooldownMs = 2800;

  private currentSensitivityDb = -16;
  public detectionMode: DetectionMode = 'clap';
  public preloadedVoicePhrase = 'Hey Phone!';
  public customVoiceProfile: string | null = null;

  private recentDbHistory: number[] = [];

  public onTelemetry?: (telemetry: {
    currentDb: number;
    ambientDb: number;
    isSpike: boolean;
    waveformData: Uint8Array;
  }) => void;

  public onAlertTriggered?: (db: number, reason: string) => void;

  /**
   * Initializes microphone capture and connects to AnalyserNode
   */
  public async startListening(sensitivityDb: number, mode: DetectionMode = 'clap'): Promise<boolean> {
    this.currentSensitivityDb = sensitivityDb;
    this.detectionMode = mode;

    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });

      this.audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const source = this.audioCtx.createMediaStreamSource(this.micStream);

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.2;
      source.connect(this.analyser);

      this.loop();
      return true;
    } catch (err) {
      console.warn('Microphone access denied or unavailable in this environment:', err);
      return false;
    }
  }

  public setSensitivity(db: number) {
    this.currentSensitivityDb = db;
  }

  public setMode(mode: DetectionMode) {
    this.detectionMode = mode;
  }

  public setCustomVoiceProfile(profile: string | null) {
    this.customVoiceProfile = profile;
  }

  private loop = () => {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const timeDataArray = new Uint8Array(bufferLength);
    const freqDataArray = new Uint8Array(bufferLength);

    this.analyser.getByteTimeDomainData(timeDataArray);
    this.analyser.getByteFrequencyData(freqDataArray);

    // Calculate RMS amplitude from time-domain PCM samples
    let sumSquares = 0;
    for (let i = 0; i < bufferLength; i++) {
      const normalized = (timeDataArray[i] - 128) / 128; // -1.0 to 1.0
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / bufferLength);

    // Convert RMS to dBFS: 20 * log10(rms)
    let currentDb = -100;
    if (rms > 0.0001) {
      currentDb = Math.max(-60, Math.min(0, 20 * Math.log10(rms)));
    }

    // Adaptive ambient noise floor update
    if (currentDb > -60 && currentDb < -25) {
      this.ambientBaselineDb = this.ambientBaselineDb * 0.95 + currentDb * 0.05;
    }

    this.recentDbHistory.push(currentDb);
    if (this.recentDbHistory.length > 20) {
      this.recentDbHistory.shift();
    }

    const delta = currentDb - this.ambientBaselineDb;
    const isLoud = currentDb >= this.currentSensitivityDb;
    const isCooled = Date.now() - this.lastTriggerTime > this.cooldownMs;

    let isTriggerMatch = false;
    let triggerReason = 'Clap Detected';

    if (this.detectionMode === 'clap') {
      // Clap: Sudden sharp acoustic spike
      const isSudden = delta >= 16;
      isTriggerMatch = isLoud && isSudden;
      triggerReason = 'Clap Sound';
    } else if (this.detectionMode === 'whistle') {
      // Whistle: High-pitch spectral concentration (bins 20 to 50 in 512-point FFT)
      let highFreqEnergy = 0;
      for (let i = 20; i < 55; i++) {
        highFreqEnergy += freqDataArray[i] || 0;
      }
      const avgHighFreq = highFreqEnergy / 35;
      isTriggerMatch = currentDb >= this.currentSensitivityDb - 5 && avgHighFreq > 90;
      triggerReason = 'Whistle Sound';
    } else if (this.detectionMode === 'preloaded_voice') {
      // Pre-loaded Voice: Multi-syllable speech burst
      const isSpeechBurst = currentDb >= this.currentSensitivityDb - 3 && delta >= 12;
      const speechPoints = this.recentDbHistory.filter((db) => db >= this.currentSensitivityDb - 6).length;
      isTriggerMatch = isSpeechBurst && speechPoints >= 3;
      triggerReason = `Voice Trigger ("${this.preloadedVoicePhrase}")`;
    } else if (this.detectionMode === 'custom_voice') {
      // Custom Voice: Matches voice envelope characteristics
      if (this.customVoiceProfile) {
        const isVoiceEnergy = currentDb >= this.currentSensitivityDb - 4 && delta >= 10;
        const voiceSustain = this.recentDbHistory.filter((db) => db >= this.currentSensitivityDb - 7).length;
        isTriggerMatch = isVoiceEnergy && voiceSustain >= 3 && voiceSustain <= 15;
      } else {
        isTriggerMatch = isLoud && delta >= 14;
      }
      triggerReason = 'Recorded Custom Voice Match';
    }

    if (this.onTelemetry) {
      this.onTelemetry({
        currentDb,
        ambientDb: this.ambientBaselineDb,
        isSpike: isTriggerMatch,
        waveformData: timeDataArray,
      });
    }

    if (isTriggerMatch && isCooled) {
      this.lastTriggerTime = Date.now();
      if (this.onAlertTriggered) {
        this.onAlertTriggered(currentDb, triggerReason);
      }
    }

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  /**
   * Synthesizes siren alarm audio using Web Audio Oscillator
   */
  public startSiren() {
    try {
      if (!this.audioCtx) {
        this.audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      this.stopSiren();

      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(800, this.audioCtx.currentTime);

      gain.gain.setValueAtTime(0.25, this.audioCtx.currentTime);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start();
      this.sirenOscillator = osc;
      this.sirenGain = gain;

      // Frequency wobble (siren warble: 650Hz to 1200Hz)
      let high = false;
      this.sirenIntervalId = window.setInterval(() => {
        if (!this.audioCtx || !this.sirenOscillator) return;
        const now = this.audioCtx.currentTime;
        const targetFreq = high ? 700 : 1150;
        this.sirenOscillator.frequency.setTargetAtTime(targetFreq, now, 0.15);
        high = !high;
      }, 250);

      if ('vibrate' in navigator) {
        navigator.vibrate([500, 200, 500, 200, 800, 200]);
      }
    } catch (e) {
      console.warn('Siren audio error:', e);
    }
  }

  public stopSiren() {
    if (this.sirenIntervalId !== null) {
      clearInterval(this.sirenIntervalId);
      this.sirenIntervalId = null;
    }
    if (this.sirenOscillator) {
      try {
        this.sirenOscillator.stop();
        this.sirenOscillator.disconnect();
      } catch (_) {}
      this.sirenOscillator = null;
    }
    if (this.sirenGain) {
      try {
        this.sirenGain.disconnect();
      } catch (_) {}
      this.sirenGain = null;
    }
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }
  }

  public stopListening() {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    this.stopSiren();
  }
}
