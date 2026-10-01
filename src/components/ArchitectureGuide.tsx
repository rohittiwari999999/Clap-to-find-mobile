import React from 'react';
import {
  ShieldAlert,
  Cpu,
  Radio,
  GitBranch,
  Volume2,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Key,
} from 'lucide-react';

export const ArchitectureGuide: React.FC = () => {
  return (
    <div className="space-y-6 text-slate-300 text-sm">
      {/* 01. Architecture Overview */}
      <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
        <h3 className="text-base font-semibold text-white flex items-center gap-2">
          <Cpu className="w-4 h-4 text-emerald-400" />
          <span>Background Service & Isolate Topology</span>
        </h3>
        <p className="mt-2 text-slate-400 leading-relaxed">
          Flutter runs UI logic in the main isolate, while background audio recording and amplitude
          threshold monitoring run in a decoupled headless background isolate managed by{' '}
          <code className="text-emerald-400 font-mono text-xs">flutter_background_service</code>.
          This separation ensures continuous microphone sampling even when the app is minimized,
          the screen is locked, or memory pressure builds.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
            <div className="text-emerald-400 font-semibold text-xs uppercase tracking-wide">
              1. Acoustic Ingestion
            </div>
            <p className="text-xs text-slate-400 mt-1.5 leading-normal">
              Continuous PCM stream sampling via <code className="text-slate-300">record</code> at 60ms
              intervals to calculate instantaneous decibel levels (dBFS).
            </p>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
            <div className="text-emerald-400 font-semibold text-xs uppercase tracking-wide">
              2. Spike Transient Filter
            </div>
            <p className="text-xs text-slate-400 mt-1.5 leading-normal">
              Calculates dynamic ambient noise baseline with exponential moving average. Claps are
              classified by a steep rise-time (&gt;18 dB delta) and rapid decay.
            </p>
          </div>

          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-4">
            <div className="text-emerald-400 font-semibold text-xs uppercase tracking-wide">
              3. Alert Actuation
            </div>
            <p className="text-xs text-slate-400 mt-1.5 leading-normal">
              Tri-modal physical response: Looping max-volume siren (<code className="text-slate-300">audioplayers</code>),
              160ms flashlight strobe (<code className="text-slate-300">torch_light</code>), and haptic pulse patterns (<code className="text-slate-300">vibration</code>).
            </p>
          </div>
        </div>
      </section>

      {/* 02. Native Platform Requirements */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Android 14+ Requirements */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-emerald-400" />
            <span>Android 14 (API 34) Foreground Rules</span>
          </h4>
          <ul className="mt-3 space-y-2.5 text-xs text-slate-400">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-200">Mandatory Type:</strong> Android 14 mandates declaring{' '}
                <code className="text-emerald-400 font-mono text-[11px]">android:foregroundServiceType="microphone"</code>{' '}
                both in the manifest and at runtime via <code className="text-emerald-400 font-mono text-[11px]">AndroidForegroundType.microphone</code>.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-200">Notification Requirement:</strong> Android 13+ requires{' '}
                <code className="text-slate-300 font-mono text-[11px]">POST_NOTIFICATIONS</code> runtime permission. A sticky notification is persistently visible while monitoring.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-200">Doze / Battery Whitelist:</strong> To prevent OEM battery managers (Xiaomi, Samsung) from killing the service, request battery optimization exemption via <code className="text-slate-300 font-mono text-[11px]">permission_handler</code>.
              </span>
            </li>
          </ul>
        </div>

        {/* iOS Background Execution */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
          <h4 className="text-sm font-semibold text-white flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400" />
            <span>iOS Background Audio Mode & App Store Compliance</span>
          </h4>
          <ul className="mt-3 space-y-2.5 text-xs text-slate-400">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-200">UIBackgroundModes:</strong> Configured with{' '}
                <code className="text-cyan-300 font-mono text-[11px]">audio</code>,{' '}
                <code className="text-cyan-300 font-mono text-[11px]">fetch</code>, and{' '}
                <code className="text-cyan-300 font-mono text-[11px]">processing</code> in <code className="text-slate-300 font-mono text-[11px]">Info.plist</code>.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-200">Audio Session Category:</strong> Background listening requires an active audio session category (<code className="text-slate-300 font-mono text-[11px]">playAndRecord</code> with options <code className="text-slate-300 font-mono text-[11px]">mixWithOthers</code>).
              </span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                <strong className="text-slate-200">App Store Review:</strong> Apple Review Guideline 2.5.4 requires clear justification for background audio. Include a video demonstration showing the phone misplaced under a cushion responding to claps.
              </span>
            </li>
          </ul>
        </div>
      </section>

      {/* 03. Shorebird CI/CD Details */}
      <section className="bg-slate-900/40 border border-slate-800 rounded-2xl p-5">
        <h4 className="text-sm font-semibold text-white flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-purple-400" />
          <span>Shorebird Code Push Architecture & Auto-Update Workflow</span>
        </h4>
        <p className="mt-2 text-xs text-slate-400 leading-relaxed">
          Shorebird enables Over-The-Air (OTA) Dart code updates without needing to wait for Google Play
          or Apple App Store review cycles. When you push commits to <code className="text-purple-300 font-mono">main</code>,
          the workflow in <code className="text-emerald-400 font-mono">.github/workflows/shorebird_auto_update.yml</code> executes
          parallel patching jobs for Android and iOS using <code className="text-purple-300 font-mono">--force</code>.
        </p>

        {/* 3-Step Setup Grid */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            <span className="font-semibold text-slate-200 block mb-1">Step 1: Release Build</span>
            <code className="text-[11px] font-mono text-purple-400 block">shorebird release android</code>
            <code className="text-[11px] font-mono text-purple-400 block">shorebird release ios</code>
            <span className="text-[10px] text-slate-500 mt-1 block">Uploaded to app stores as base version.</span>
          </div>
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            <span className="font-semibold text-slate-200 block mb-1">Step 2: Generate CI Token</span>
            <code className="text-[11px] font-mono text-purple-400 block">shorebird login:ci</code>
            <span className="text-[10px] text-slate-500 mt-1 block">Prints token to store in GitHub Secrets.</span>
          </div>
          <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl">
            <span className="font-semibold text-slate-200 block mb-1">Step 3: Auto Push Patches</span>
            <code className="text-[11px] font-mono text-purple-400 block">git push origin main</code>
            <span className="text-[10px] text-slate-500 mt-1 block">Runs patch android/ios --force automatically.</span>
          </div>
        </div>

        {/* Detailed Secret Instructions Box */}
        <div className="mt-4 p-4 bg-slate-950/90 border border-purple-500/20 rounded-xl space-y-2 text-xs">
          <div className="flex items-center gap-2 text-purple-300 font-semibold">
            <Key className="w-4 h-4" />
            <span>How to Generate & Add SHOREBIRD_TOKEN</span>
          </div>
          <ol className="list-decimal list-inside space-y-1.5 text-slate-400 pl-1">
            <li>
              Open your terminal where Shorebird is installed and run:
              <pre className="mt-1 p-2 bg-slate-900 rounded font-mono text-emerald-400 text-[11px]">shorebird login:ci</pre>
            </li>
            <li>
              Follow the browser authentication prompt to authenticate with your Shorebird account. The terminal will print an authorization token string.
            </li>
            <li>
              Go to your GitHub repository in your web browser:
              <span className="text-slate-300 block font-medium mt-0.5">Settings &gt; Secrets and variables &gt; Actions</span>
            </li>
            <li>
              Click <span className="text-white font-medium">New repository secret</span>.
            </li>
            <li>
              Set Name to: <code className="text-purple-300 font-mono">SHOREBIRD_TOKEN</code>
            </li>
            <li>
              Paste the printed token string into the Secret field and click <span className="text-white font-medium">Add secret</span>.
            </li>
          </ol>
        </div>
      </section>
    </div>
  );
};
