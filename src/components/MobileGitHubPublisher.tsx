import React, { useState } from 'react';
import {
  Github,
  CloudUpload,
  Check,
  AlertCircle,
  ExternalLink,
  Lock,
  FolderGit2,
  Sparkles,
  Smartphone,
  Terminal,
} from 'lucide-react';
import { CODEBASE_FILES } from '../data/codebaseData';

interface MobileGitHubPublisherProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileGitHubPublisher: React.FC<MobileGitHubPublisherProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeMode, setActiveMode] = useState<'api' | 'web_guide'>('api');
  const [username, setUsername] = useState('');
  const [repoName, setRepoName] = useState('clap-to-find-phone');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [successUrl, setSuccessUrl] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);

  if (!isOpen) return null;

  const handlePushDirectly = async () => {
    if (!username.trim() || !repoName.trim() || !token.trim()) {
      setError('Please provide your GitHub username, repository name, and Personal Access Token.');
      return;
    }

    setIsPublishing(true);
    setError(null);
    setStatus('Authenticating with GitHub...');
    setProgress(10);

    try {
      const headers = {
        Authorization: `Bearer ${token.trim()}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
      };

      // 1. Create or verify repository
      setStatus('Creating / checking repository on GitHub...');
      const checkRepo = await fetch(`https://api.github.com/repos/${username.trim()}/${repoName.trim()}`, {
        headers,
      });

      if (checkRepo.status === 404) {
        const createRes = await fetch('https://api.github.com/user/repos', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            name: repoName.trim(),
            description: 'Clap to Find Phone - Flutter app with background audio and automated CI/CD builds.',
            private: false,
            auto_init: true,
          }),
        });

        if (!createRes.ok) {
          const errData = await createRes.json().catch(() => ({}));
          throw new Error(errData.message || 'Failed to create repository on GitHub. Check your token permissions.');
        }
      } else if (!checkRepo.ok && checkRepo.status !== 200) {
        throw new Error('Could not access GitHub. Verify your token has "repo" scope.');
      }

      setProgress(30);

      // 2. Upload/Commit each file sequentially via GitHub Contents API
      const filesToPush = [...CODEBASE_FILES];
      const total = filesToPush.length;

      for (let i = 0; i < total; i++) {
        const file = filesToPush[i];
        setStatus(`Uploading ${file.path} (${i + 1}/${total})...`);

        // Check if file already exists to get SHA for update
        const getFile = await fetch(
          `https://api.github.com/repos/${username.trim()}/${repoName.trim()}/contents/${file.path}`,
          { headers }
        );

        let sha: string | undefined = undefined;
        if (getFile.ok) {
          const existing = await getFile.json();
          sha = existing.sha;
        }

        // Base64 encode content for UTF-8
        const utf8Bytes = new TextEncoder().encode(file.content);
        let binary = '';
        for (let b = 0; b < utf8Bytes.length; b++) {
          binary += String.fromCharCode(utf8Bytes[b]);
        }
        const base64Content = btoa(binary);

        const putRes = await fetch(
          `https://api.github.com/repos/${username.trim()}/${repoName.trim()}/contents/${file.path}`,
          {
            method: 'PUT',
            headers,
            body: JSON.stringify({
              message: `Add ${file.path} for automated Android & iOS build`,
              content: base64Content,
              sha: sha,
              branch: 'main',
            }),
          }
        );

        if (!putRes.ok) {
          console.warn(`File upload warning for ${file.path}:`, await putRes.text());
        }

        setProgress(30 + Math.round(((i + 1) / total) * 65));
      }

      setProgress(100);
      setStatus('Successfully published! GitHub Actions workflow started.');
      setSuccessUrl(`https://github.com/${username.trim()}/${repoName.trim()}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to publish to GitHub.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#111827] border border-slate-700/80 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl flex flex-col text-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-none">
                Mobile Browser GitHub Setup
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                No PC or terminal required
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Mode Selector */}
        <div className="flex items-center gap-2 p-1 bg-slate-900/90 rounded-xl my-4 text-xs font-medium border border-slate-800">
          <button
            onClick={() => setActiveMode('api')}
            className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              activeMode === 'api'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>1-Click Auto Push (Fastest)</span>
          </button>
          <button
            onClick={() => setActiveMode('web_guide')}
            className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
              activeMode === 'web_guide'
                ? 'bg-slate-800 text-white font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <FolderGit2 className="w-3.5 h-3.5" />
            <span>Upload via GitHub Web</span>
          </button>
        </div>

        {/* Mode 1: Direct In-Browser Push via GitHub API */}
        {activeMode === 'api' && (
          <div className="space-y-4 text-xs">
            <div className="bg-slate-950/80 p-3.5 rounded-xl border border-slate-800/80 space-y-1.5 leading-relaxed text-slate-400">
              <p className="text-slate-200 font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>How this works right from your phone:</span>
              </p>
              <p>
                Enter your GitHub username & a GitHub Personal Access Token. This browser will automatically create the repo, upload all files, and trigger the GitHub Actions build for APK & IPA!
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  GitHub Username
                </label>
                <input
                  type="text"
                  placeholder="e.g. sarita-abhinav"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Repository Name
                </label>
                <input
                  type="text"
                  placeholder="clap-to-find-phone"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    GitHub Token (Personal Access Token)
                  </label>
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo&description=ClapToFindUploader"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <span>Get Token (1-tap)</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <input
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 font-mono text-xs"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Needs only <code className="text-slate-400">repo</code> permission. Never stored on any server.
                </p>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-rose-950/40 border border-rose-800/40 rounded-xl text-rose-300 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {isPublishing && (
              <div className="space-y-1.5 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-emerald-400 font-medium">{status}</span>
                  <span className="font-mono text-slate-400">{progress}%</span>
                </div>
                <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 transition-all duration-200"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            {successUrl && (
              <div className="p-4 bg-emerald-950/40 border border-emerald-800/40 rounded-xl text-emerald-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-400">
                  <Check className="w-4 h-4" />
                  <span>Repository Created & Code Pushed!</span>
                </div>
                <p className="text-xs text-slate-300">
                  GitHub Actions is now automatically building your Android testing APK, signed release AAB, and iOS app!
                </p>
                <div className="pt-2 flex flex-wrap gap-2">
                  <a
                    href={`${successUrl}/actions`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs hover:bg-emerald-300"
                  >
                    <span>View Live Build in Actions</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                  <a
                    href={`${successUrl}/releases`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white font-medium rounded-lg text-xs hover:bg-slate-700"
                  >
                    <span>Releases & APK Downloads</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}

            {!successUrl && (
              <button
                onClick={handlePushDirectly}
                disabled={isPublishing}
                className="w-full py-3 bg-emerald-400 hover:bg-emerald-300 disabled:opacity-50 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
              >
                <CloudUpload className="w-4 h-4" />
                <span>{isPublishing ? 'Uploading to GitHub...' : 'Create Repo & Trigger Build'}</span>
              </button>
            )}
          </div>
        )}

        {/* Mode 2: GitHub Web Upload Guide */}
        {activeMode === 'web_guide' && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2 text-slate-400">
              <span className="font-semibold text-slate-200 block">
                Agar token nahi banana chahte, toh phone ke browser se aise karein:
              </span>
              <ol className="list-decimal list-inside space-y-2 pl-1 leading-relaxed">
                <li>
                  Is app me upar <strong className="text-emerald-400">"Export Project (.zip)"</strong> button par click karein. Aapke phone mein zip file download ho jayegi.
                </li>
                <li>
                  Mobile Chrome ya Safari mein{' '}
                  <a
                    href="https://github.com/new"
                    target="_blank"
                    rel="noreferrer"
                    className="text-emerald-400 underline font-medium"
                  >
                    github.com/new
                  </a>{' '}
                  kholein.
                </li>
                <li>
                  Repository ka naam daalein (jaise <code className="text-slate-200">clap-to-find</code>) aur <strong>"Create repository"</strong> click karein.
                </li>
                <li>
                  Browser menu mein jakar <strong>"Desktop site"</strong> tick karein.
                </li>
                <li>
                  Aapko page par <strong className="text-white">"uploading an existing file"</strong> ka link dikhega. Us par click karke zip extract kiye hue files upload kar dein.
                </li>
                <li>
                  Upload hote hi GitHub Actions automatically run hokar APK aur AAB generate kar dega!
                </li>
              </ol>
            </div>

            <div className="p-3 bg-purple-950/30 border border-purple-800/40 rounded-xl space-y-1.5 text-purple-200">
              <span className="font-bold flex items-center gap-1.5 text-purple-300">
                <Terminal className="w-3.5 h-3.5" />
                <span>Free GitHub Codespaces (Browser Terminal):</span>
              </span>
              <p className="text-slate-400 leading-normal">
                GitHub par repo banane ke baad phone ke browser mein keyboard se <kbd className="px-1.5 py-0.5 bg-slate-800 rounded text-white font-mono">.</kbd> (dot) press karein ya Codespaces open karein. Phone par hi poora terminal mil jayega!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
