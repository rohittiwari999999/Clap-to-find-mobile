/**
 * Web Audio API Acoustic Simulator for testing Clap to Find algorithms.
 * Mirrors the native Dart / Flutter AudioRecorder spike detection logic in-browser.
 */

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
  private cooldownMs = 2500;

  public onTelemetry?: (telemetry: {
    currentDb: number;
    ambientDb: number;
    isSpike: boolean;
    waveformData: Uint8Array;
  }) => void;

  public onAlertTriggered?: (db: number) => void;

  /**
   * Initializes microphone capture and connects to AnalyserNode
   */
  public async startListening(sensitivityDb: number): Promise<boolean> {
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

      this.loop(sensitivityDb);
      return true;
    } catch (err) {
      console.warn('Microphone access denied or unavailable in this environment:', err);
      return false;
    }
  }

  private loop = (sensitivityDb: number) => {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteTimeDomainData(dataArray);

    // Calculate RMS amplitude from time-domain PCM samples
    let sumSquares = 0;
    for (let i = 0; i < bufferLength; i++) {
      const normalized = (dataArray[i] - 128) / 128; // -1.0 to 1.0
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

    // Spike criteria (identical to Flutter service)
    const delta = currentDb - this.ambientBaselineDb;
    const isLoud = currentDb >= sensitivityDb;
    const isSudden = delta >= 18;
    const isCooled = Date.now() - this.lastTriggerTime > this.cooldownMs;
    const isSpike = isLoud && isSudden;

    if (this.onTelemetry) {
      this.onTelemetry({
        currentDb,
        ambientDb: this.ambientBaselineDb,
        isSpike,
        waveformData: dataArray,
      });
    }

    if (isSpike && isCooled) {
      this.lastTriggerTime = Date.now();
      if (this.onAlertTriggered) {
        this.onAlertTriggered(currentDb);
      }
    }

    this.animFrameId = requestAnimationFrame(() => this.loop(sensitivityDb));
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

      // Trigger navigator.vibrate if available on device
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
