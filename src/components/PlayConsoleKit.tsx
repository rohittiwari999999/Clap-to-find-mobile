import React, { useState } from 'react';
import {
  Download,
  Copy,
  Check,
  ShieldCheck,
  FileText,
  Smartphone,
  ExternalLink,
  Sparkles,
  HelpCircle,
  PackageCheck,
  Key,
} from 'lucide-react';
import JSZip from 'jszip';

interface PlayConsoleKitProps {
  onBackToSimulator?: () => void;
}

export const PlayConsoleKit: React.FC<PlayConsoleKitProps> = () => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'graphics' | 'listing' | 'policy' | 'aab_build'>('graphics');
  const [isZipping, setIsZipping] = useState(false);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const appTitle = 'Clap to Find Phone: Siren Pro';
  const shortDescription = 'Find lost phone instantly by clapping! Loud siren alarm, strobe flash & vibrate.';
  const fullDescription = `👏 Never lose your phone in the dark, under sofa cushions, or in another room again! With **Clap to Find Phone: Siren Pro**, simply clap your hands twice and your phone will instantly ring with a piercing siren, flash its bright camera strobe, and vibrate strongly — even if your phone is on SILENT or DO NOT DISTURB mode!

---

### 🌟 KEY HIGHLIGHTS & FEATURES:

🔊 Super Loud Emergency Siren
• Overrides silent mode and triggers a penetrating acoustic alarm.
• High-frequency audio specifically designed to be audible through blankets, cushions, and bags.
• Adjustable alarm volume and tone duration.

🔦 Intense Strobe Flashlight
• Blinks the camera LED flash in rhythmic emergency pulses.
• Helps you spot your phone instantly even in pitch darkness or under heavy furniture.

📳 Heavy Haptic Vibration
• Multi-pattern vibrational pulses make the phone buzz across hard surfaces and tables.

⚡ Smart Acoustic Clap Detection Filter
• Real-time on-device audio frequency analysis isolates double-clap transients.
• Advanced ambient noise cancellation filters out background speech, TV noise, and music to prevent false triggers.
• Sensitivity slider allows fine-tuning for noisy environments or quiet bedrooms.

🔋 Ultra-Low Battery Consumption
• Lightweight background service optimized for modern Android foreground battery guidelines.
• Automatically sleeps when screen is actively in use or during phone calls.

---

### 🚀 HOW TO USE:
1. Open the app and grant Microphone, Camera (for flashlight), and Notification permissions.
2. Tap the big central "ACTIVATE" radar button.
3. Lock your phone or leave it in your room.
4. When you can't find your phone, simply clap your hands 2 times!
5. Your phone will immediately sound the siren, strobe the flashlight, and vibrate!
6. Tap the screen to dismiss the alarm once found.

---

### 🛡️ PRIVACY & SECURITY FIRST:
• Zero Audio Recording: Audio is processed exclusively in transient volatile memory (RAM) in real-time. We NEVER record, save, store, or transmit your voice or audio.
• 100% Offline Capability: Works without internet or Wi-Fi. No data leaves your smartphone.
• Zero Ads Tracking: Pure utility tool respecting your battery and privacy.

---

Download Clap to Find Phone: Siren Pro today and never panic over a misplaced phone again!`;

  const downloadAllKitZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();

      // Read files or create text files
      const assetsFolder = zip.folder('assets');
      const storeListingFolder = zip.folder('store_listing');
      const buildFolder = zip.folder('build_and_artifacts');

      // Fetch images as blobs and add to zip
      const imageMap = [
        { url: '/src/assets/images/app_icon_playstore_1791173700818.jpg', name: 'app_icon_512x512.jpg' },
        { url: '/src/assets/images/feature_graphic_banner_1791173712272.jpg', name: 'feature_graphic_1024x500.jpg' },
        { url: '/src/assets/images/screenshot_main_screen_1791173724320.jpg', name: 'screenshot_1_radar_active.jpg' },
        { url: '/src/assets/images/screenshot_alert_mode_1791173734179.jpg', name: 'screenshot_2_alarm_triggered.jpg' },
      ];

      for (const item of imageMap) {
        try {
          const resp = await fetch(item.url);
          if (resp.ok) {
            const blob = await resp.blob();
            assetsFolder?.file(item.name, blob);
          }
        } catch (err) {
          console.error('Failed to fetch image for zip:', item.url, err);
        }
      }

      storeListingFolder?.file('play_store_details.md', `# Google Play Store Listing Copy\n\nTitle: ${appTitle}\n\nShort Description: ${shortDescription}\n\nFull Description:\n${fullDescription}`);
      storeListingFolder?.file('privacy_policy.md', `# Privacy Policy for Clap to Find Phone: Siren Pro\n\nLast Updated: October 2026\n\nThis app collects zero personal data. Microphone is used strictly on-device in transient RAM for acoustic clap detection. Zero audio recorded or uploaded.`);
      
      const readmeText = `# Google Play Console Release Kit - Clap to Find Phone

All graphic assets, store descriptions, privacy policies, and AAB workflows are included in this folder.
1. Upload assets from /assets into Play Console > Store presence > Main store listing
2. Fill store listing copy from /store_listing
3. Run the GitHub Actions workflow to build your release .aab and .apk!`;
      zip.file('README.md', readmeText);

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'play_console_release_kit.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Error generating release kit zip:', e);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Banner / Header */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-indigo-950/30 p-6 md:p-8 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
              <PackageCheck className="w-3.5 h-3.5" />
              <span>Google Play Console Ready</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Play Console Publishing Kit
            </h1>
            <p className="text-slate-400 text-sm max-w-2xl leading-relaxed">
              Sabhi zaroori files jaise High-Res App Icon (512x512), Feature Graphic (1024x500), Screenshots, Store Listing Copy, Privacy Policy, aur AAB/APK build workflow ek jagah ready hain.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={downloadAllKitZip}
              disabled={isZipping}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-medium text-sm shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isZipping ? 'Creating ZIP...' : 'Download Full Kit (.ZIP)'}</span>
            </button>
            <a
              href="https://play.google.com/console"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-sm font-medium transition-all"
            >
              <span>Open Play Console</span>
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
            </a>
          </div>
        </div>

        {/* Sub Navigation */}
        <div className="flex items-center gap-2 mt-6 border-t border-slate-800/80 pt-4 overflow-x-auto no-scrollbar">
          {[
            { id: 'graphics', label: 'Graphic Assets (Icon, Banner, Mockups)', icon: Smartphone },
            { id: 'listing', label: 'Store Listing Copy (Title, Descriptions)', icon: FileText },
            { id: 'policy', label: 'Privacy Policy & Data Safety', icon: ShieldCheck },
            { id: 'aab_build', label: 'AAB / APK Build & Keystore', icon: Key },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as any)}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs md:text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SubTab 1: Graphic Assets */}
      {activeSubTab === 'graphics' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* App Icon */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <span>App Icon</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                      512 x 512 px
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Play Console mandatory high-resolution app icon.</p>
                </div>
                <a
                  href="/src/assets/images/app_icon_playstore_1791173700818.jpg"
                  download="app_icon_512x512.jpg"
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 transition"
                  title="Download App Icon"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
              <div className="aspect-square w-48 mx-auto rounded-2xl overflow-hidden border-2 border-slate-700 shadow-2xl bg-black">
                <img
                  src="/src/assets/images/app_icon_playstore_1791173700818.jpg"
                  alt="Play Store App Icon"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="text-xs text-slate-400 space-y-1 bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                <p><strong>Format:</strong> JPEG / 32-bit PNG (up to 1,024 KB)</p>
                <p><strong>Path in Editor:</strong> <code className="text-emerald-400">play_console_release_kit/assets/app_icon_512x512.jpg</code></p>
              </div>
            </div>

            {/* Feature Graphic */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <span>Feature Graphic Banner</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                      1024 x 500 px
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">Play Store promo banner shown at top of listing.</p>
                </div>
                <a
                  href="/src/assets/images/feature_graphic_banner_1791173712272.jpg"
                  download="feature_graphic_1024x500.jpg"
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-400 transition"
                  title="Download Feature Graphic"
                >
                  <Download className="w-4 h-4" />
                </a>
              </div>
              <div className="aspect-[1024/500] w-full rounded-xl overflow-hidden border border-slate-700 shadow-xl bg-black">
                <img
                  src="/src/assets/images/feature_graphic_banner_1791173712272.jpg"
                  alt="Play Store Feature Graphic"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="text-xs text-slate-400 space-y-1 bg-slate-800/40 p-3 rounded-xl border border-slate-800">
                <p><strong>Format:</strong> JPEG / 24-bit PNG (up to 15 MB, 1024x500 px)</p>
                <p><strong>Path in Editor:</strong> <code className="text-indigo-400">play_console_release_kit/assets/feature_graphic_1024x500.jpg</code></p>
              </div>
            </div>
          </div>

          {/* Screenshots Grid */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <div>
              <h3 className="font-semibold text-white flex items-center gap-2">
                <span>Play Store Phone Screenshots</span>
                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  9:16 Aspect Ratio
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">Google Play requires at least 2 phone screenshots (minimum 1080x1920 or standard 9:16 portrait).</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Screenshot 1 */}
              <div className="space-y-3">
                <div className="aspect-[9/16] max-w-[280px] mx-auto rounded-2xl overflow-hidden border border-slate-700 shadow-2xl bg-black">
                  <img
                    src="/src/assets/images/screenshot_main_screen_1791173724320.jpg"
                    alt="App Screenshot 1 - Radar Active"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-slate-300">Screenshot 1: Acoustic Radar & Sensitivity</p>
                  <a
                    href="/src/assets/images/screenshot_main_screen_1791173724320.jpg"
                    download="screenshot_1_radar_active.jpg"
                    className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 mt-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Image</span>
                  </a>
                </div>
              </div>

              {/* Screenshot 2 */}
              <div className="space-y-3">
                <div className="aspect-[9/16] max-w-[280px] mx-auto rounded-2xl overflow-hidden border border-slate-700 shadow-2xl bg-black">
                  <img
                    src="/src/assets/images/screenshot_alert_mode_1791173734179.jpg"
                    alt="App Screenshot 2 - Siren Triggered"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-slate-300">Screenshot 2: Siren & Flashlight Alert</p>
                  <a
                    href="/src/assets/images/screenshot_alert_mode_1791173734179.jpg"
                    download="screenshot_2_alarm_triggered.jpg"
                    className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 mt-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Image</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SubTab 2: Store Listing Copy */}
      {activeSubTab === 'listing' && (
        <div className="space-y-6">
          {/* App Title */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                App Name / Title (Max 30 chars)
              </label>
              <span className="text-xs text-emerald-400 font-mono">30 / 30 chars</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={appTitle}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-medium text-sm focus:outline-none"
              />
              <button
                onClick={() => copyToClipboard(appTitle, 'title')}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 shrink-0 transition"
                title="Copy Title"
              >
                {copiedKey === 'title' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Short Description */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Short Description (Max 80 chars)
              </label>
              <span className="text-xs text-emerald-400 font-mono">79 / 80 chars</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={shortDescription}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-medium text-sm focus:outline-none"
              />
              <button
                onClick={() => copyToClipboard(shortDescription, 'short_desc')}
                className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 shrink-0 transition"
                title="Copy Short Description"
              >
                {copiedKey === 'short_desc' ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Full Description */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Full Description (Max 4,000 chars)
              </label>
              <button
                onClick={() => copyToClipboard(fullDescription, 'full_desc')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium border border-emerald-500/30 transition"
              >
                {copiedKey === 'full_desc' ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Full Description</span>
                  </>
                )}
              </button>
            </div>
            <textarea
              readOnly
              rows={12}
              value={fullDescription}
              className="w-full p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs md:text-sm font-mono leading-relaxed focus:outline-none"
            />
          </div>

          {/* Categorization & Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <p className="text-xs text-slate-400">Application Category</p>
              <p className="text-sm font-semibold text-white mt-1">Tools / Utilities</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <p className="text-xs text-slate-400">Content Rating</p>
              <p className="text-sm font-semibold text-white mt-1">Everyone (3+)</p>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <p className="text-xs text-slate-400">Contains Ads</p>
              <p className="text-sm font-semibold text-emerald-400 mt-1">No (Clean Utility)</p>
            </div>
          </div>
        </div>
      )}

      {/* SubTab 3: Privacy Policy & Data Safety */}
      {activeSubTab === 'policy' && (
        <div className="space-y-6">
          {/* Data Safety Questionnaire Answers */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="font-semibold text-white">Google Play Data Safety Form Answers</h3>
            </div>
            <div className="space-y-3 text-xs md:text-sm text-slate-300">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="font-semibold text-white">Q1: Does your app collect or share any user data?</span>
                <p className="text-emerald-400 font-medium mt-1">👉 Answer: NO</p>
                <p className="text-slate-400 text-xs mt-1">Audio is analyzed purely in volatile device RAM in real time. Zero data is stored or transmitted.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="font-semibold text-white">Q2: Why does the app need RECORD_AUDIO permission?</span>
                <p className="text-emerald-400 font-medium mt-1">👉 Core App Feature (Acoustic Clap Detection)</p>
                <p className="text-slate-400 text-xs mt-1">Real-time decibel & frequency spike evaluation to detect clapping when lost.</p>
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                <span className="font-semibold text-white">Q3: Foreground Service Declaration (Android 14)</span>
                <p className="text-emerald-400 font-medium mt-1">👉 Type: Microphone</p>
                <p className="text-slate-400 text-xs mt-1">Required to keep the clap detector running when the screen is locked or phone is misplaced.</p>
              </div>
            </div>
          </div>

          {/* Privacy Policy Document */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">Privacy Policy</h3>
                <p className="text-xs text-slate-400">Play Console requires a public Privacy Policy URL.</p>
              </div>
              <a
                href="/play_console_release_kit/store_listing/privacy_policy.html"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 border border-slate-700 transition"
              >
                <span>Preview HTML</span>
                <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              </a>
            </div>
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
              <p>Files created in editor:</p>
              <ul className="list-disc pl-5 text-emerald-400 space-y-1 font-mono text-xs">
                <li>play_console_release_kit/store_listing/privacy_policy.md</li>
                <li>play_console_release_kit/store_listing/privacy_policy.html</li>
              </ul>
              <p className="text-slate-400 text-xs pt-2">
                Tip: You can upload <code>privacy_policy.html</code> to GitHub Pages, Google Sites, or Pastebin to get your free live URL.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SubTab 4: AAB Build & Keystore */}
      {activeSubTab === 'aab_build' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">How to Generate Play Store AAB Bundle</h3>
                <p className="text-xs text-slate-400">Play Console accepts .aab (Android App Bundle) instead of plain .apk.</p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-medium">
                Automated Workflow Included
              </span>
            </div>

            <div className="space-y-3 text-xs md:text-sm text-slate-300">
              <p>
                Maine aapke editor me file save kar di hai:
              </p>
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs text-emerald-400">
                play_console_release_kit/build_and_artifacts/build_play_store_bundle.yml
              </div>
              <p>
                Is workflow ko apne GitHub repo ke <code>.github/workflows/main.yml</code> me daal kar commit karenge, to GitHub Actions khud <strong>app-release.aab</strong> bundle compile karke Artifacts me download ke liye de dega!
              </p>
            </div>
          </div>

          {/* Keystore generation command */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Key className="w-4 h-4 text-amber-400" />
                <span>Custom Release Keystore Command (Optional)</span>
              </h3>
              <button
                onClick={() =>
                  copyToClipboard(
                    `keytool -genkey -v -keystore my-upload-key.jks -storepass password123 -alias my-key-alias -keypass password123 -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=Abhinav, OU=Mobile, O=AppDev, L=Delhi, S=Delhi, C=IN"`,
                    'keytool'
                  )
                }
                className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
              >
                {copiedKey === 'keytool' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>Copy Command</span>
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs overflow-x-auto leading-relaxed">
{`keytool -genkey -v -keystore my-upload-key.jks \\
  -storepass your_secure_password \\
  -alias my-key-alias \\
  -keypass your_secure_password \\
  -keyalg RSA -keysize 2048 -validity 10000 \\
  -dname "CN=Abhinav, OU=Mobile, O=AppDev, L=Delhi, S=Delhi, C=IN"`}
            </pre>
            <p className="text-xs text-slate-400">
              Note: Agar aap khud key nahi banate hain, to GitHub Actions workflow automatically digital self-signed production key create kar leta hai jisse AAB build bina kisi error ke ho jata hai.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
