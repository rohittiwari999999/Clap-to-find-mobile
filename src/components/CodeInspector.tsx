import React, { useState } from 'react';
import {
  FileCode,
  Copy,
  Check,
  Download,
  FolderTree,
  FileText,
  FileCheck,
  Terminal,
  ExternalLink,
} from 'lucide-react';
import JSZip from 'jszip';
import { CODEBASE_FILES } from '../data/codebaseData';
import { ProjectFile } from '../types/codebase';

interface CodeInspectorProps {
  activeFileId?: string;
}

export const CodeInspector: React.FC<CodeInspectorProps> = ({ activeFileId: propFileId }) => {
  const [selectedFileId, setSelectedFileId] = useState<string>(propFileId || 'main');
  const [copied, setCopied] = useState(false);
  const [isZipping, setIsZipping] = useState(false);

  const selectedFile =
    CODEBASE_FILES.find((f) => f.id === selectedFileId) || CODEBASE_FILES[0];

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(selectedFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error('Failed to copy code:', e);
    }
  };

  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();

      // Add each generated file into its proper directory hierarchy
      CODEBASE_FILES.forEach((file) => {
        zip.file(file.path, file.content);
      });

      // Add a comprehensive setup README.md
      const readme = `# Clap to Find Phone - Flutter Production Codebase

A production-grade mobile application that continuously monitors acoustic energy in a background service, identifies clap transient spikes (fast rise-time and rapid decay), and immediately triggers device alarms, flashlight strobe, and haptic vibrations.

## Project Structure
\`\`\`
.
├── pubspec.yaml                          # Core dependencies (record, audioplayers, torch_light, vibration, flutter_background_service)
├── lib/
│   ├── main.dart                         # Modern dark-themed Flutter UI & radar switch
│   └── services/
│       └── audio_service.dart            # Background isolate, amplitude analysis & alarm orchestrator
├── android/app/src/main/
│   └── AndroidManifest.xml               # Android 14+ FOREGROUND_SERVICE_MICROPHONE & wake lock configs
├── ios/Runner/
│   └── Info.plist                        # iOS UIBackgroundModes audio/fetch & privacy strings
└── .github/workflows/
    ├── shorebird_auto_update.yml         # Parallel Android & iOS Shorebird OTA patch on push to main
    └── shorebird_update.yml              # CI/CD workflow pushing Shorebird OTA patches on commit
\`\`\`

## Quick Start Instructions

1. **Install Dependencies**:
   \`\`\`bash
   flutter pub get
   \`\`\`

2. **Add Alarm Siren Sound Asset**:
   Place an alarm sound at \`assets/sounds/alarm_siren.mp3\` (or use the system ringtone/audioplayer asset).

3. **Android Configuration**:
   The app requests \`FOREGROUND_SERVICE_MICROPHONE\` which is strictly mandatory on Android 14 (API level 34). Ensure your Android compileSdkVersion is at least 34.

4. **iOS Setup**:
   In Xcode, verify that \`Background Modes\` -> \`Audio, AirPlay, and Picture in Picture\` is checked in the Signing & Capabilities tab.

5. **Shorebird Code Push Setup**:
   - Initialize Shorebird: \`shorebird init\`
   - Generate CI Token: \`shorebird login:ci\`
   - Add \`SHOREBIRD_TOKEN\` into your GitHub Repository Secrets.
   - Pushing new commits to \`main\` triggers \`.github/workflows/shorebird_update.yml\` for automatic over-the-air patches!
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
    } catch (err) {
      console.error('Failed to create project ZIP:', err);
    } finally {
      setIsZipping(false);
    }
  };

  const lineCount = selectedFile.content.split('\n').length;

  return (
    <div className="flex flex-col h-full bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      {/* Inspector Header with File Selector Tabs & Action Buttons */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-800 px-4 py-3 bg-slate-900/90 gap-3">
        {/* File Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 max-w-full">
          {CODEBASE_FILES.map((file) => {
            const isActive = file.id === selectedFile.id;
            return (
              <button
                key={file.id}
                onClick={() => setSelectedFileId(file.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                  isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>{file.name}</span>
              </button>
            );
          })}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700/80 rounded-lg transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy File</span>
              </>
            )}
          </button>

          <button
            onClick={handleDownloadZip}
            disabled={isZipping}
            className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isZipping ? 'Bundling...' : 'Download Project (.zip)'}</span>
          </button>
        </div>
      </div>

      {/* File Metadata Sub-Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-slate-950/60 border-b border-slate-800/80 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="font-mono text-slate-300">{selectedFile.path}</span>
          <span aria-hidden="true">·</span>
          <span>{selectedFile.badge}</span>
          <span aria-hidden="true">·</span>
          <span className="tabular-nums">{lineCount} lines</span>
        </div>
        <span className="text-slate-500 hidden sm:inline">{selectedFile.description}</span>
      </div>

      {/* Code Editor View with Line Numbers */}
      <div className="flex-1 overflow-auto bg-slate-950 p-4 font-mono text-[13px] leading-relaxed select-text">
        <pre className="text-slate-300">
          <code>
            {selectedFile.content.split('\n').map((line, idx) => (
              <div key={idx} className="table-row hover:bg-slate-900/50">
                <span className="table-cell pr-4 text-right select-none text-slate-600 font-mono text-xs tabular-nums w-10">
                  {idx + 1}
                </span>
                <span className="table-cell whitespace-pre">{line}</span>
              </div>
            ))}
          </code>
        </pre>
      </div>
    </div>
  );
};
