import React, { useState } from 'react';
import {
  Smartphone,
  Code2,
  BookOpen,
  Download,
  Github,
  CheckCircle,
  Activity,
  Layers,
  Sparkles,
  PackageCheck,
} from 'lucide-react';
import JSZip from 'jszip';
import { PhoneSimulator } from './components/PhoneSimulator';
import { CodeInspector } from './components/CodeInspector';
import { ArchitectureGuide } from './components/ArchitectureGuide';
import { MobileGitHubPublisher } from './components/MobileGitHubPublisher';
import { PlayConsoleKit } from './components/PlayConsoleKit';
import { CODEBASE_FILES } from './data/codebaseData';

export default function App() {
  const [activeTab, setActiveTab] = useState<'simulator' | 'code' | 'architecture' | 'play_console'>('simulator');
  const [triggerCount, setTriggerCount] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isMobilePublisherOpen, setIsMobilePublisherOpen] = useState(false);

  const handleDownloadAllZip = async () => {
    setIsExporting(true);
    try {
      const zip = new JSZip();

      CODEBASE_FILES.forEach((file) => {
        zip.file(file.path, file.content);
      });

      const readme = `# Clap to Find Phone - Production Flutter Codebase

Complete production-ready Flutter app architecture with background acoustic service, transient clap spike detection, hardware alarm actuators (siren, haptic vibration, flashlight strobe), native Android 14/iOS configs, and Shorebird CI/CD automation.

## Included Files
- \`pubspec.yaml\`: Flutter package dependencies (record, audioplayers, torch_light, vibration, flutter_background_service)
- \`lib/main.dart\`: Modern dark-themed Flutter UI widget with circular radar toggle and live dBFS meter
- \`lib/services/audio_service.dart\`: Background isolate acoustic monitor and coordinated alert trigger
- \`android/app/src/main/AndroidManifest.xml\`: Android 14 FOREGROUND_SERVICE_MICROPHONE, camera flash, vibration, and wake lock permissions
- \`ios/Runner/Info.plist\`: iOS UIBackgroundModes audio/fetch/processing and microphone/camera permission descriptions
- \`.github/workflows/shorebird_auto_update.yml\`: Automated parallel Android/iOS Shorebird OTA patch workflow on main branch push
- \`.github/workflows/shorebird_update.yml\`: Standard Shorebird CI/CD workflow

## Running the Application
\`\`\`bash
flutter pub get
flutter run
\`\`\`
`;
      zip.file('README.md', readme);

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'clap_to_find_flutter_project.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Failed to export zip:', e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* Top Bar Contract: Responsive Header for Desktop & Mobile */}
      <header className="sticky top-0 z-40 bg-[#0B0F19]/95 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-2">
        {/* Zone 1: Single text element wordmark */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Activity className="w-4 h-4" />
          </div>
          <span className="text-sm sm:text-base font-bold tracking-tight text-white truncate">
            Clap to Find Phone
          </span>
        </div>

        {/* Zone 2: Navigation tabs (hidden on mobile to prevent overflow; visible on desktop) */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-900/90 border border-slate-800/80 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === 'simulator'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Interactive Simulator</span>
          </button>

          <button
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === 'code'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Codebase & Files</span>
          </button>

          <button
            onClick={() => setActiveTab('architecture')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === 'architecture'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Architecture Blueprint</span>
          </button>

          <button
            onClick={() => setActiveTab('play_console')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'play_console'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10'
            }`}
          >
            <PackageCheck className="w-3.5 h-3.5" />
            <span>Play Console Kit</span>
          </button>
        </nav>

        {/* Zone 3: Primary Action CTA (Always visible on all screens!) */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setIsMobilePublisherOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-lg shadow-sm transition-all whitespace-nowrap active:scale-95 border border-purple-400/40"
          >
            <Smartphone className="w-3.5 h-3.5 text-purple-200" />
            <span>Push from Phone</span>
          </button>

          <button
            onClick={handleDownloadAllZip}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-1.5 sm:py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 active:scale-95 rounded-lg shadow-sm transition-all whitespace-nowrap disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Bundling...' : 'Export (.zip)'}</span>
          </button>
        </div>

        {/* Mobile secondary tab bar */}
        <div className="w-full flex md:hidden items-center justify-between gap-1 pt-1 border-t border-slate-800/60 mt-1">
          <button
            onClick={() => setActiveTab('simulator')}
            className={`flex-1 py-1.5 text-center text-xs font-medium rounded-lg ${
              activeTab === 'simulator' ? 'bg-slate-800 text-white' : 'text-slate-400'
            }`}
          >
            Simulator
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`flex-1 py-1.5 text-center text-xs font-medium rounded-lg ${
              activeTab === 'code' ? 'bg-slate-800 text-white' : 'text-slate-400'
            }`}
          >
            Code (8 Files)
          </button>
          <button
            onClick={() => setActiveTab('architecture')}
            className={`flex-1 py-1.5 text-center text-xs font-medium rounded-lg ${
              activeTab === 'architecture' ? 'bg-slate-800 text-white' : 'text-slate-400'
            }`}
          >
            Guide
          </button>
          <button
            onClick={() => setActiveTab('play_console')}
            className={`flex-1 py-1.5 text-center text-xs font-semibold rounded-lg ${
              activeTab === 'play_console' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'text-emerald-400'
            }`}
          >
            Play Kit
          </button>
        </div>
      </header>

      {/* Main Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 sm:py-6 flex flex-col pb-20 md:pb-8">
        {/* Prominent Mobile Action Card (Right at the top so it is impossible to miss!) */}
        <div className="p-4 bg-gradient-to-r from-purple-950/70 via-indigo-950/70 to-slate-900 border-2 border-purple-500/40 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl mb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400 animate-pulse" />
              <span className="text-xs font-bold text-purple-200 tracking-wide uppercase">
                📱 Mobile Browser? Terminal ki zaroorat nahi!
              </span>
            </div>
            <p className="text-xs text-slate-300">
              Yahan se direct GitHub par repository banaiye aur <strong>automatic Android APK & iOS app build</strong> shuru kijiye:
            </p>
          </div>
          <button
            onClick={() => setIsMobilePublisherOpen(true)}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-400 hover:to-indigo-400 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-purple-500/30 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <Smartphone className="w-4 h-4 text-purple-200" />
            <span>Open "Push from Phone" Tool</span>
          </button>
        </div>
        {/* Unboxed Metadata Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b border-slate-800/60 mb-6 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-slate-200 font-semibold">Flutter 3.19+ & Dart 3.3+</span>
            <span aria-hidden="true">·</span>
            <span>Android 14 Foreground Service</span>
            <span aria-hidden="true">·</span>
            <span>iOS Background Audio</span>
            <span aria-hidden="true">·</span>
            <span>Shorebird OTA CI/CD</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono">
            <span>
              Acoustic triggers registered: <strong className="text-emerald-400 tabular-nums">{triggerCount}</strong>
            </span>
          </div>
        </div>

        {/* Tab 1: Interactive Live Simulator */}
        {activeTab === 'simulator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Left: Device Simulator */}
            <div className="lg:col-span-5 flex justify-center">
              <PhoneSimulator
                onSimulateClapTriggered={() => setTriggerCount((c) => c + 1)}
              />
            </div>

            {/* Right: Real-time Diagnostics & Architecture Highlights */}
            <div className="lg:col-span-7 space-y-6">
              {/* Mobile Quick Publish Callout */}
              <div className="p-4 bg-gradient-to-r from-purple-950/40 to-slate-900 border border-purple-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-purple-950/20">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                    <span className="text-xs font-bold text-white tracking-wide uppercase">
                      Mobile Browser Friendly
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    No PC terminal? Create your GitHub repo & trigger Android/iOS builds right from this phone screen.
                  </p>
                </div>
                <button
                  onClick={() => setIsMobilePublisherOpen(true)}
                  className="px-3.5 py-1.5 bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs rounded-xl transition-all whitespace-nowrap active:scale-95 shadow-md shadow-purple-500/20"
                >
                  Push from Phone
                </button>
              </div>

              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6">
                <h3 className="text-base font-semibold text-white">
                  Acoustic Spike Detection in Flutter
                </h3>
                <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                  The application uses the <code className="text-emerald-400 font-mono text-xs">record</code> package
                  to continuously sample ambient audio buffers in a decoupled background isolate. Unlike continuous voice
                  or ambient city noise, a physical hand clap produces an instantaneous transient pressure spike with an
                  extremely fast rise time (&lt;80ms) and steep decay.
                </p>

                <div className="mt-5 space-y-3">
                  <div className="flex items-start gap-3 p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-semibold text-slate-200">Adaptive Noise Floor Tracking</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        A running exponential moving average calculates ambient background volume (e.g. -45 dB in a quiet room, -30 dB in a car) to dynamically calibrate trigger sensitivity.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-semibold text-slate-200">Tri-Modal Physical Feedback Alert</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Upon spike validation, the service commands maximum-volume siren audio loops (<code className="text-slate-300 font-mono">audioplayers</code>), 160ms strobe flashlight pulses (<code className="text-slate-300 font-mono">torch_light</code>), and repeating multi-frequency haptics (<code className="text-slate-300 font-mono">vibration</code>).
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 p-3 bg-slate-950/70 border border-slate-800/80 rounded-xl">
                    <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-semibold text-slate-200">Android 14 Foreground Compliance</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Includes strict <code className="text-emerald-400 font-mono">android:foregroundServiceType="microphone"</code> manifest and isolate parameters required on API 34+ to prevent termination.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-5 border-t border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    Ready to inspect or export the full Flutter codebase?
                  </span>
                  <button
                    onClick={() => setActiveTab('code')}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/30 rounded-lg transition-colors"
                  >
                    <span>View Code Files</span>
                    <Code2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Generated Files Quick List */}
              <div className="bg-slate-900/30 border border-slate-800/80 rounded-2xl p-5">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Delivered Production Files
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {CODEBASE_FILES.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => setActiveTab('code')}
                      className="p-3 bg-slate-950/60 hover:bg-slate-900 border border-slate-800/80 rounded-xl text-left transition-colors flex items-center justify-between group"
                    >
                      <div className="truncate mr-2">
                        <span className="font-mono text-slate-200 group-hover:text-emerald-400 font-medium block truncate">
                          {file.name}
                        </span>
                        <span className="text-[11px] text-slate-500 block truncate">
                          {file.path}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 shrink-0">
                        {file.badge}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Codebase & Files Inspector */}
        {activeTab === 'code' && (
          <div className="flex-1 min-h-[640px] flex flex-col">
            <CodeInspector />
          </div>
        )}

        {/* Tab 3: Architecture Blueprint & Platform Compliance */}
        {activeTab === 'architecture' && (
          <div className="space-y-6">
            <ArchitectureGuide />
          </div>
        )}

        {/* Tab 4: Google Play Console Release Kit */}
        {activeTab === 'play_console' && (
          <div className="space-y-6">
            <PlayConsoleKit />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 px-6 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span>Clap to Find Phone Architecture</span>
          <span aria-hidden="true">·</span>
          <span>Flutter, Android 14, iOS & Shorebird Code Push</span>
        </div>
        <span>Ready for immediate deployment with <code className="text-slate-400">flutter pub get</code></span>
      </footer>

      {/* Floating Action Bar for Mobile Screens (Always visible above thumb) */}
      <div className="fixed bottom-3 left-3 right-3 z-40 md:hidden flex gap-2 shadow-2xl">
        <button
          onClick={() => setIsMobilePublisherOpen(true)}
          className="flex-1 py-3 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-xs rounded-xl shadow-lg border border-purple-400/30 flex items-center justify-center gap-2 active:scale-95"
        >
          <Smartphone className="w-4 h-4 text-purple-200" />
          <span>Push from Phone (Build APK)</span>
        </button>
        <button
          onClick={handleDownloadAllZip}
          className="py-3 px-4 bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg flex items-center justify-center gap-1 active:scale-95"
        >
          <Download className="w-4 h-4" />
          <span>ZIP</span>
        </button>
      </div>

      {/* Mobile Browser GitHub Publisher Modal */}
      <MobileGitHubPublisher
        isOpen={isMobilePublisherOpen}
        onClose={() => setIsMobilePublisherOpen(false)}
      />
    </div>
  );
}
