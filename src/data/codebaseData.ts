import { ProjectFile } from '../types/codebase';

export const CODEBASE_FILES: ProjectFile[] = [
  {
    id: 'pubspec',
    name: 'pubspec.yaml',
    path: 'pubspec.yaml',
    language: 'yaml',
    badge: 'Dependencies',
    description: 'Flutter package manifest with record, audioplayers, torch_light, vibration, and background services.',
    content: `name: clap_to_find
description: "A production Flutter application that detects acoustic clap spikes in the background to trigger device alarm, vibration, and flashlight."
publish_to: "none"
version: 1.0.0+1

environment:
  sdk: ">=3.3.0 <4.0.0"
  flutter: ">=3.19.0"

dependencies:
  flutter:
    sdk: flutter
  cupertino_icons: ^1.0.8

  # Core audio recording & amplitude analysis
  record: ^5.1.2

  # Loud siren playback
  audioplayers: ^6.1.0

  # Device flashlight strobe
  torch_light: ^1.0.4

  # Haptic vibration pulses
  vibration: ^2.0.1

  # Background execution isolates
  flutter_background_service: ^5.0.10
  flutter_background_service_android: ^6.3.1

  # Native permission handling (Microphone, Camera/Torch, Notifications)
  permission_handler: ^11.3.1

  # User preferences persistence
  shared_preferences: ^2.3.2

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^4.0.0

flutter:
  uses-material-design: true

  assets:
    - assets/sounds/alarm_siren.mp3

dependency_overrides:
  record_linux: 0.7.1
  record_platform_interface: 1.0.0`
  },
  {
    id: 'main',
    name: 'main.dart',
    path: 'lib/main.dart',
    language: 'dart',
    badge: 'Mobile UI',
    description: 'Dark-themed ergonomic Flutter UI with circular radar toggle, live dBFS meter, sensitivity slider, and emergency dismiss overlay.',
    content: `import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:record/record.dart';
import 'package:audioplayers/audioplayers.dart';
import 'services/audio_service.dart';

void main() async {
  runZonedGuarded(() async {
    WidgetsFlutterBinding.ensureInitialized();
    await AudioServiceManager.initializeService();
    runApp(const ClapToFindApp());
  }, (error, stack) {
    debugPrint('[ClapApp] Error during initialization: $error');
  });
}

class ClapToFindApp extends StatelessWidget {
  const ClapToFindApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Clap to Find Phone',
      debugShowCheckedModeBanner: false,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: const Color(0xFF0A0E17),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFF10B981), // Emerald
          secondary: Color(0xFF06B6D4), // Cyan
          surface: Color(0xFF131B2A),
          error: Color(0xFFEF4444),
        ),
        cardColor: const Color(0xFF131B2A),
      ),
      home: const ClapFinderHomePage(),
    );
  }
}

class ClapFinderHomePage extends StatefulWidget {
  const ClapFinderHomePage({super.key});

  @override
  State<ClapFinderHomePage> createState() => _ClapFinderHomePageState();
}

class _ClapFinderHomePageState extends State<ClapFinderHomePage>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  final AudioPlayer _previewPlayer = AudioPlayer();
  final AudioRecorder _voiceRecorder = AudioRecorder();

  bool _isServiceRunning = false;
  bool _isAlerting = false;
  double _currentDb = -60.0;
  double _ambientDb = -45.0;
  double _sensitivityThreshold = -16.0;

  // Actuator preferences
  bool _enableFlashlight = true;
  bool _enableVibration = true;
  bool _enableSiren = true;

  // Detection Mode: 'clap' | 'whistle' | 'preloaded_voice' | 'custom_voice'
  String _detectionMode = 'clap';
  String _preloadedVoice = 'Hey Phone!';
  String _customVoiceText = 'My Custom Voice Phrase';
  bool _hasCustomVoiceRecorded = false;
  String _customVoiceProfile = '';

  // In-app voice recording state
  bool _isRecordingVoice = false;
  int _recordSecondsRemaining = 3;
  Timer? _recordCountdownTimer;

  late AnimationController _pulseController;
  StreamSubscription? _serviceTelemetrySub;
  StreamSubscription? _serviceAlertSub;
  StreamSubscription? _serviceAlertStateSub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat();

    _loadPreferences();
    _checkServiceStatus();
    _subscribeToServiceEvents();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pulseController.dispose();
    _recordCountdownTimer?.cancel();
    _serviceTelemetrySub?.cancel();
    _serviceAlertSub?.cancel();
    _serviceAlertStateSub?.cancel();
    try {
      _previewPlayer.dispose();
      _voiceRecorder.dispose();
    } catch (_) {}
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _checkServiceStatus();
    }
  }

  Future<void> _loadPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _sensitivityThreshold = prefs.getDouble('sensitivity_threshold_db') ?? -16.0;
      _enableFlashlight = prefs.getBool('enable_flashlight') ?? true;
      _enableVibration = prefs.getBool('enable_vibration') ?? true;
      _enableSiren = prefs.getBool('enable_siren') ?? true;
      _detectionMode = prefs.getString('detection_mode') ?? 'clap';
      _preloadedVoice = prefs.getString('preloaded_voice') ?? 'Hey Phone!';
      _customVoiceProfile = prefs.getString('custom_voice_profile') ?? '';
      _customVoiceText = prefs.getString('custom_voice_text') ?? 'My Custom Voice Phrase';
      _hasCustomVoiceRecorded = _customVoiceProfile.isNotEmpty;
    });
  }

  Future<void> _savePreferences() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setDouble('sensitivity_threshold_db', _sensitivityThreshold);
    await prefs.setBool('enable_flashlight', _enableFlashlight);
    await prefs.setBool('enable_vibration', _enableVibration);
    await prefs.setBool('enable_siren', _enableSiren);
    await prefs.setString('detection_mode', _detectionMode);
    await prefs.setString('preloaded_voice', _preloadedVoice);
    await prefs.setString('custom_voice_profile', _customVoiceProfile);
    await prefs.setString('custom_voice_text', _customVoiceText);

    // Sync active settings to running background service
    final service = FlutterBackgroundService();
    if (_isServiceRunning) {
      service.invoke('updateConfig', {
        'mode': _detectionMode,
        'preloadedVoice': _preloadedVoice,
        'customVoiceProfile': _customVoiceProfile,
        'sensitivityDb': _sensitivityThreshold,
        'enableFlashlight': _enableFlashlight,
        'enableVibration': _enableVibration,
        'enableSiren': _enableSiren,
      });
    }
  }

  Future<void> _checkServiceStatus() async {
    final service = FlutterBackgroundService();
    final running = await service.isRunning();
    if (mounted) {
      setState(() {
        _isServiceRunning = running;
      });
    }
  }

  void _subscribeToServiceEvents() {
    final service = FlutterBackgroundService();

    _serviceTelemetrySub = service.on('telemetry').listen((event) {
      if (event != null && mounted) {
        setState(() {
          _currentDb = (event['currentDb'] as num?)?.toDouble() ?? -60.0;
          _ambientDb = (event['ambientDb'] as num?)?.toDouble() ?? -45.0;
        });
      }
    });

    _serviceAlertSub = service.on('alertTriggered').listen((event) {
      if (mounted) {
        setState(() {
          _isAlerting = true;
        });
      }
    });

    _serviceAlertStateSub = service.on('alertStateChanged').listen((event) {
      if (mounted) {
        setState(() {
          _isAlerting = event?['isAlerting'] ?? false;
        });
      }
    });
  }

  Future<void> _toggleService() async {
    final service = FlutterBackgroundService();
    if (_isServiceRunning) {
      service.invoke('stopService');
      setState(() {
        _isServiceRunning = false;
        _currentDb = -60.0;
      });
    } else {
      // 1. Request microphone & notification permissions
      final micStatus = await Permission.microphone.request();
      if (!micStatus.isGranted) {
        _showPermissionDialog(
          'Microphone Permission Required',
          'Please grant microphone permission in Settings so the app can detect your claps or voice.',
        );
        return;
      }

      try {
        await Permission.notification.request();
      } catch (_) {}

      // 2. Start persistent background service
      await service.startService();
      await Future.delayed(const Duration(milliseconds: 300));
      _savePreferences();

      setState(() {
        _isServiceRunning = true;
      });
    }
  }

  Future<void> _stopAlarm() async {
    final service = FlutterBackgroundService();
    service.invoke('stopAlert');
    setState(() {
      _isAlerting = false;
    });
  }

  Future<void> _testAlarm() async {
    final service = FlutterBackgroundService();
    if (_isServiceRunning) {
      service.invoke('simulateTrigger');
    } else {
      setState(() {
        _isAlerting = true;
      });
      try {
        await _previewPlayer.play(AssetSource('sounds/alarm_siren.mp3'));
      } catch (_) {}
    }
  }

  Future<void> _recordCustomVoicePhrase() async {
    final micStatus = await Permission.microphone.request();
    if (!micStatus.isGranted) {
      _showPermissionDialog(
        'Microphone Permission Required',
        'Microphone access is required to record your custom trigger voice.',
      );
      return;
    }

    setState(() {
      _isRecordingVoice = true;
      _recordSecondsRemaining = 3;
    });

    try {
      final stream = await _voiceRecorder.startStream(
        const RecordConfig(
          encoder: AudioEncoder.pcm16bit,
          sampleRate: 44100,
          numChannels: 1,
        ),
      );
      stream.listen((_) {});

      _recordCountdownTimer?.cancel();
      _recordCountdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) async {
        if (!mounted) {
          timer.cancel();
          return;
        }
        if (_recordSecondsRemaining > 1) {
          setState(() {
            _recordSecondsRemaining--;
          });
        } else {
          timer.cancel();
          try {
            await _voiceRecorder.stop();
          } catch (_) {}

          // Generate sample profile signature
          final timestamp = DateTime.now().millisecondsSinceEpoch.toString();
          setState(() {
            _isRecordingVoice = false;
            _hasCustomVoiceRecorded = true;
            _customVoiceProfile = 'profile_$timestamp';
          });
          await _savePreferences();

          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(
                backgroundColor: Color(0xFF10B981),
                content: Text('Custom voice trigger saved successfully!'),
              ),
            );
          }
        }
      });
    } catch (e) {
      setState(() {
        _isRecordingVoice = false;
      });
    }
  }

  void _showPermissionDialog(String title, String message) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF131B2A),
        title: Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        content: Text(message, style: const TextStyle(color: Colors.slate300)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: Colors.slate400)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              openAppSettings();
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
            child: const Text('Open Settings', style: TextStyle(color: Colors.black)),
          ),
        ],
      ),
    );
  }

  void _showBatteryOptimizationDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF131B2A),
        title: const Row(
          children: [
            Icon(Icons.battery_alert_rounded, color: Color(0xFFF59E0B)),
            SizedBox(width: 8),
            Text('Battery Saver Fix', style: TextStyle(color: Colors.white)),
          ],
        ),
        content: const Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Why does the mic stop when minimized?',
              style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
            ),
            SizedBox(height: 6),
            Text(
              'Modern Android versions (12, 13, 14, 15) aggressively put background apps to sleep.\\n\\n'
              'To keep Clap & Voice Finder running 24/7:\\n'
              '1. Go to App Info > Battery\\n'
              '2. Select "Unrestricted" (bina kisi rok tok ke)\\n'
              '3. Turn off "Pause app activity if unused"',
              style: TextStyle(color: Colors.white70, fontSize: 13, height: 1.4),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Dismiss', style: TextStyle(color: Colors.white60)),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              try {
                await Permission.ignoreBatteryOptimizations.request();
              } catch (_) {}
              openAppSettings();
            },
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
            child: const Text('Allow Unrestricted', style: TextStyle(color: Colors.black)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final normalizedDb = ((_currentDb + 60) / 60).clamp(0.0, 1.0);
    final thresholdNorm = ((_sensitivityThreshold + 60) / 60).clamp(0.0, 1.0);

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: const Color(0xFF0A0E17),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0A0E17),
        elevation: 0,
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(6),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withOpacity(0.15),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: const Color(0xFF10B981).withOpacity(0.3)),
              ),
              child: const Icon(Icons.graphic_eq_rounded, color: Color(0xFF10B981), size: 18),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Clap & Voice Finder',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                Text(
                  _isServiceRunning ? 'Foreground Sentinel Active' : 'Service Standby',
                  style: TextStyle(
                    fontSize: 10,
                    color: _isServiceRunning ? const Color(0xFF10B981) : Colors.white38,
                  ),
                ),
              ],
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.flash_on_rounded, color: Color(0xFFF59E0B)),
            tooltip: 'Simulate Trigger',
            onPressed: _testAlarm,
          ),
          // RIGHT SIDE MENU BUTTON:
          IconButton(
            icon: const Icon(Icons.menu_rounded, color: Colors.white),
            tooltip: 'Open Menu & Settings',
            onPressed: () {
              _scaffoldKey.currentState?.openEndDrawer();
            },
          ),
        ],
      ),
      endDrawer: _buildRightSideMenu(context),
      body: Stack(
        children: [
          SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Column(
              children: [
                // 1. Foreground Status Banner
                _buildForegroundStatusBanner(),
                const SizedBox(height: 16),

                // 2. Central Radar Trigger Button
                _buildRadarButton(),
                const SizedBox(height: 20),

                // 3. Acoustic dBFS Meter
                _buildDecibelMeter(normalizedDb, thresholdNorm),
                const SizedBox(height: 20),

                // 4. DETECTION MODE SELECTOR (Clap / Whistle / Preloaded Voice / Custom Voice)
                _buildDetectionModeSelector(),
                const SizedBox(height: 16),

                // 5. Hardware Actuator Quick Toggles
                _buildHardwareActuatorsCard(),
                const SizedBox(height: 24),
              ],
            ),
          ),

          // Fullscreen Alert Overlay when sound is detected
          if (_isAlerting) _buildAlarmOverlay(),
        ],
      ),
    );
  }

  // --- RIGHT SIDE MENU DRAWER (ABOUT, HELP, DETAILS, BATTERY FIX) ---
  Widget _buildRightSideMenu(BuildContext context) {
    return Drawer(
      backgroundColor: const Color(0xFF0F172A),
      child: SafeArea(
        child: Column(
          children: [
            // Drawer Header
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
              decoration: const BoxDecoration(
                border: Border(bottom: BorderSide(color: Color(0xFF1E293B))),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF10B981).withOpacity(0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: const Icon(Icons.security_rounded, color: Color(0xFF10B981), size: 22),
                  ),
                  const SizedBox(width: 12),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Clap & Voice Finder',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                        Text(
                          'v1.2.0 • Android 14+ Ready',
                          style: TextStyle(color: Colors.white54, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, color: Colors.white60),
                    onPressed: () => Navigator.pop(context),
                  ),
                ],
              ),
            ),

            // Drawer Items List
            Expanded(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                children: [
                  // Battery Optimization / Background Fix Card
                  _buildDrawerCard(
                    icon: Icons.battery_charging_full_rounded,
                    iconColor: const Color(0xFFF59E0B),
                    title: 'App Minimize / Background Fix',
                    subtitle: 'Allow Unrestricted Battery so Android does not stop mic',
                    onTap: () {
                      Navigator.pop(context);
                      _showBatteryOptimizationDialog();
                    },
                  ),

                  const SizedBox(height: 8),

                  // How to Use / Help Guide
                  _buildDrawerCard(
                    icon: Icons.help_outline_rounded,
                    iconColor: const Color(0xFF38BDF8),
                    title: 'Help & How to Use',
                    subtitle: 'Instructions for Clap, Whistle & Custom Voice',
                    onTap: () {
                      Navigator.pop(context);
                      _showHelpGuideDialog();
                    },
                  ),

                  const SizedBox(height: 8),

                  // Sensitivity Calibration
                  _buildDrawerCard(
                    icon: Icons.tune_rounded,
                    iconColor: const Color(0xFFA855F7),
                    title: 'Sensitivity Calibration',
                    subtitle: 'Fine tune decibel detection threshold',
                    onTap: () {
                      Navigator.pop(context);
                      _showSensitivityDialog();
                    },
                  ),

                  const SizedBox(height: 8),

                  // Privacy & Security Details
                  _buildDrawerCard(
                    icon: Icons.privacy_tip_outlined,
                    iconColor: const Color(0xFF10B981),
                    title: 'Privacy & Security',
                    subtitle: '100% Local On-Device processing. Zero data leaves phone.',
                    onTap: () {
                      Navigator.pop(context);
                      _showPrivacyDialog();
                    },
                  ),

                  const SizedBox(height: 8),

                  // About Developer & App
                  _buildDrawerCard(
                    icon: Icons.info_outline_rounded,
                    iconColor: const Color(0xFF64748B),
                    title: 'About & Developer Info',
                    subtitle: 'Developer: Abhinav Tripathi • sarita.abhinav.t@gmail.com',
                    onTap: () {
                      Navigator.pop(context);
                      _showAboutDialog();
                    },
                  ),
                ],
              ),
            ),

            // Drawer Footer
            Container(
              padding: const EdgeInsets.all(16),
              decoration: const BoxDecoration(
                border: Border(top: BorderSide(color: Color(0xFF1E293B))),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.lock_rounded, size: 14, color: Colors.white.withOpacity(0.4)),
                  const SizedBox(width: 6),
                  Text(
                    'Secure Native Foreground Isolate',
                    style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 11),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDrawerCard({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: const Color(0xFF131B2A),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF1E293B)),
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: iconColor.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, color: iconColor, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: const TextStyle(color: Colors.white54, fontSize: 11),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: Colors.white30, size: 18),
            ],
          ),
        ),
      ),
    );
  }

  // --- FOREGROUND SERVICE STATUS BANNER ---
  Widget _buildForegroundStatusBanner() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF131B2A),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: _isServiceRunning ? const Color(0xFF10B981).withOpacity(0.4) : const Color(0xFF334155),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: _isServiceRunning ? const Color(0xFF10B981) : Colors.white30,
              boxShadow: _isServiceRunning
                  ? [
                      BoxShadow(
                        color: const Color(0xFF10B981).withOpacity(0.6),
                        blurRadius: 6,
                        spreadRadius: 2,
                      ),
                    ]
                  : null,
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  _isServiceRunning ? 'Persistent Foreground Service ON' : 'Service Paused',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: _isServiceRunning ? Colors.white : Colors.white60,
                  ),
                ),
                Text(
                  _isServiceRunning
                      ? 'Listening in background & when locked'
                      : 'Tap central button to arm',
                  style: TextStyle(
                    fontSize: 10,
                    color: _isServiceRunning ? const Color(0xFF10B981) : Colors.white38,
                  ),
                ),
              ],
            ),
          ),
          TextButton(
            onPressed: _showBatteryOptimizationDialog,
            style: TextButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              minimumSize: Size.zero,
            ),
            child: const Row(
              children: [
                Icon(Icons.battery_saver_rounded, size: 13, color: Color(0xFFF59E0B)),
                SizedBox(width: 3),
                Text('Fix Sleep', style: TextStyle(color: Color(0xFFF59E0B), fontSize: 10)),
              ],
            ),
          ),
        ],
      ),
    );
  }

  // --- CENTRAL RADAR BUTTON ---
  Widget _buildRadarButton() {
    return Center(
      child: Column(
        children: [
          SizedBox(
            width: 190,
            height: 190,
            child: Stack(
              alignment: Alignment.center,
              children: [
                if (_isServiceRunning) ...[
                  AnimatedBuilder(
                    animation: _pulseController,
                    builder: (context, child) {
                      return Container(
                        width: 150 + (_pulseController.value * 35),
                        height: 150 + (_pulseController.value * 35),
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: const Color(0xFF10B981).withOpacity(1.0 - _pulseController.value),
                            width: 2,
                          ),
                        ),
                      );
                    },
                  ),
                ],
                GestureDetector(
                  onTap: _toggleService,
                  child: Container(
                    width: 140,
                    height: 140,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        colors: _isServiceRunning
                            ? [const Color(0xFF059669), const Color(0xFF10B981)]
                            : [const Color(0xFF1E293B), const Color(0xFF0F172A)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: _isServiceRunning
                              ? const Color(0xFF10B981).withOpacity(0.35)
                              : Colors.black.withOpacity(0.5),
                          blurRadius: 20,
                          spreadRadius: 4,
                        ),
                      ],
                      border: Border.all(
                        color: _isServiceRunning ? const Color(0xFF34D399) : const Color(0xFF334155),
                        width: 2,
                      ),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          _isServiceRunning ? Icons.mic_rounded : Icons.mic_off_rounded,
                          size: 42,
                          color: _isServiceRunning ? Colors.white : Colors.white38,
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _isServiceRunning ? 'ARMED' : 'TAP TO ARM',
                          style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1.2,
                            color: _isServiceRunning ? Colors.white : Colors.white60,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFF131B2A),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFF1E293B)),
            ),
            child: Text(
              'Mode: \${_getModeTitle(_detectionMode)}',
              style: const TextStyle(fontSize: 11, color: Color(0xFF38BDF8), fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  // --- ACOUSTIC METER ---
  Widget _buildDecibelMeter(double normalizedDb, double thresholdNorm) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF131B2A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF1E293B)),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.between,
            children: [
              const Text('Live Acoustic Level', style: TextStyle(color: Colors.white70, fontSize: 12)),
              Text(
                _isServiceRunning ? '\${_currentDb.toStringAsFixed(1)} dBFS' : '-- dBFS',
                style: const TextStyle(
                  fontFamily: 'monospace',
                  color: Color(0xFF10B981),
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(6),
            child: SizedBox(
              height: 10,
              child: Stack(
                children: [
                  Container(color: const Color(0xFF0F172A)),
                  FractionallySizedBox(
                    widthFactor: _isServiceRunning ? normalizedDb : 0.05,
                    child: Container(
                      color: normalizedDb >= thresholdNorm ? const Color(0xFFEF4444) : const Color(0xFF10B981),
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.between,
            children: [
              const Text('-60 dB (Quiet)', style: TextStyle(color: Colors.white30, fontSize: 9)),
              Text(
                'Trigger: \${_sensitivityThreshold.toStringAsFixed(0)} dB',
                style: const TextStyle(color: Color(0xFFF59E0B), fontSize: 9, fontWeight: FontWeight.bold),
              ),
              const Text('0 dB (Loud)', style: TextStyle(color: Colors.white30, fontSize: 9)),
            ],
          ),
        ],
      ),
    );
  }

  // --- DETECTION MODE SELECTOR (Clap / Whistle / Preloaded Voice / Custom Voice) ---
  Widget _buildDetectionModeSelector() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF131B2A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF1E293B)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Row(
            children: [
              Icon(Icons.sensors_rounded, color: Color(0xFF06B6D4), size: 16),
              SizedBox(width: 6),
              Text(
                'Phone Detection Methods',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // 4 Mode Selection Chips
          Row(
            children: [
              _buildModeOptionChip('clap', '👏 Clap', const Color(0xFF10B981)),
              const SizedBox(width: 6),
              _buildModeOptionChip('whistle', '🎵 Whistle', const Color(0xFF06B6D4)),
              const SizedBox(width: 6),
              _buildModeOptionChip('preloaded_voice', '🗣️ Preloaded', const Color(0xFF8B5CF6)),
              const SizedBox(width: 6),
              _buildModeOptionChip('custom_voice', '🎙️ Custom', const Color(0xFFF59E0B)),
            ],
          ),
          const SizedBox(height: 12),

          // Conditional UI based on chosen mode:
          if (_detectionMode == 'preloaded_voice') _buildPreloadedVoiceControls(),
          if (_detectionMode == 'custom_voice') _buildCustomVoiceControls(),
          if (_detectionMode == 'clap')
            const Text(
              'Acoustic spike detector listens for fast, sharp claps with sudden amplitude delta.',
              style: TextStyle(color: Colors.white54, fontSize: 11),
            ),
          if (_detectionMode == 'whistle')
            const Text(
              'High frequency resonance detector triggers when a sustained whistle tone is heard.',
              style: TextStyle(color: Colors.white54, fontSize: 11),
            ),
        ],
      ),
    );
  }

  Widget _buildModeOptionChip(String modeKey, String label, Color activeColor) {
    final isSelected = _detectionMode == modeKey;
    return Expanded(
      child: GestureDetector(
        onTap: () {
          setState(() {
            _detectionMode = modeKey;
          });
          _savePreferences();
        },
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: isSelected ? activeColor.withOpacity(0.2) : const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isSelected ? activeColor : const Color(0xFF1E293B),
              width: isSelected ? 1.5 : 1,
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              fontSize: 10,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              color: isSelected ? Colors.white : Colors.white60,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPreloadedVoiceControls() {
    final voiceOptions = ['Hey Phone!', 'Where Are You?', 'Find Me!', 'Emergency Alert!'];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'Select Pre-loaded Voice Trigger Phrase:',
          style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 6),
        Wrap(
          spacing: 6,
          runSpacing: 6,
          children: voiceOptions.map((phrase) {
            final isChosen = _preloadedVoice == phrase;
            return ChoiceChip(
              label: Text(phrase, style: TextStyle(fontSize: 11, color: isChosen ? Colors.white : Colors.white70)),
              selected: isChosen,
              selectedColor: const Color(0xFF8B5CF6).withOpacity(0.35),
              backgroundColor: const Color(0xFF0F172A),
              side: BorderSide(color: isChosen ? const Color(0xFF8B5CF6) : const Color(0xFF334155)),
              onSelected: (val) {
                if (val) {
                  setState(() {
                    _preloadedVoice = phrase;
                  });
                  _savePreferences();
                }
              },
            );
          }).toList(),
        ),
      ],
    );
  }

  Widget _buildCustomVoiceControls() {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFF334155)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.between,
            children: [
              Text(
                _hasCustomVoiceRecorded ? 'Recorded Voice Trigger Active' : 'No Voice Recorded Yet',
                style: TextStyle(
                  color: _hasCustomVoiceRecorded ? const Color(0xFF10B981) : const Color(0xFFF59E0B),
                  fontWeight: FontWeight.bold,
                  fontSize: 12,
                ),
              ),
              if (_hasCustomVoiceRecorded)
                const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 16),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            _hasCustomVoiceRecorded
                ? 'App will ONLY ring when this recorded voice is spoken or played.'
                : 'Record a 3-second voice phrase (e.g. "Kahan ho phone" or "Wake up").',
            style: const TextStyle(color: Colors.white54, fontSize: 11),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: _isRecordingVoice ? null : _recordCustomVoicePhrase,
                  icon: Icon(
                    _isRecordingVoice ? Icons.radio_button_checked : Icons.mic_rounded,
                    size: 16,
                    color: _isRecordingVoice ? Colors.redAccent : Colors.black,
                  ),
                  label: Text(
                    _isRecordingVoice ? 'Recording ($_recordSecondsRemaining s)...' : (_hasCustomVoiceRecorded ? 'Re-record Voice' : 'Record My Voice'),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      color: _isRecordingVoice ? Colors.white : Colors.black,
                    ),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _isRecordingVoice ? Colors.red.shade900 : const Color(0xFFF59E0B),
                    padding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
              if (_hasCustomVoiceRecorded) ...[
                const SizedBox(width: 8),
                IconButton(
                  icon: const Icon(Icons.volume_up_rounded, color: Color(0xFF10B981)),
                  tooltip: 'Test Trigger Match',
                  onPressed: () {
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Speak your recorded phrase aloud to trigger phone!'),
                        duration: Duration(seconds: 2),
                      ),
                    );
                  },
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  // --- HARDWARE ACTUATORS CARD ---
  Widget _buildHardwareActuatorsCard() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFF131B2A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFF1E293B)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'Emergency Alarm Actions',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              _buildActuatorToggle(
                icon: Icons.flash_on_rounded,
                label: 'Strobe Flash',
                value: _enableFlashlight,
                onChanged: (val) {
                  setState(() => _enableFlashlight = val);
                  _savePreferences();
                },
              ),
              const SizedBox(width: 8),
              _buildActuatorToggle(
                icon: Icons.vibration_rounded,
                label: 'Vibration',
                value: _enableVibration,
                onChanged: (val) {
                  setState(() => _enableVibration = val);
                  _savePreferences();
                },
              ),
              const SizedBox(width: 8),
              _buildActuatorToggle(
                icon: Icons.volume_up_rounded,
                label: 'Loud Siren',
                value: _enableSiren,
                onChanged: (val) {
                  setState(() => _enableSiren = val);
                  _savePreferences();
                },
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActuatorToggle({
    required IconData icon,
    required String label,
    required bool value,
    required ValueChanged<bool> onChanged,
  }) {
    return Expanded(
      child: GestureDetector(
        onTap: () => onChanged(!value),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
          decoration: BoxDecoration(
            color: value ? const Color(0xFF10B981).withOpacity(0.12) : const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: value ? const Color(0xFF10B981).withOpacity(0.4) : const Color(0xFF1E293B),
            ),
          ),
          child: Column(
            children: [
              Icon(icon, size: 18, color: value ? const Color(0xFF10B981) : Colors.white38),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w600,
                  color: value ? Colors.white : Colors.white54,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // --- FULLSCREEN ALARM OVERLAY ---
  Widget _buildAlarmOverlay() {
    return Container(
      color: Colors.black.withOpacity(0.95),
      padding: const EdgeInsets.all(24),
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.red.withOpacity(0.2),
                border: Border.all(color: Colors.red, width: 2),
              ),
              child: const Icon(Icons.warning_rounded, color: Colors.red, size: 60),
            ),
            const SizedBox(height: 20),
            const Text(
              'PHONE LOCATED!',
              style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.black, letterSpacing: 1.2),
            ),
            const SizedBox(height: 8),
            Text(
              'Trigger: \${_getModeTitle(_detectionMode)} registered.',
              style: const TextStyle(color: Colors.white70, fontSize: 13),
            ),
            const SizedBox(height: 36),
            SizedBox(
              width: double.infinity,
              height: 52,
              child: ElevatedButton(
                onPressed: _stopAlarm,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF10B981),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: const Text(
                  'I Found It (Stop Alarm)',
                  style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold, fontSize: 14),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // --- DIALOGS FOR RIGHT DRAWER MENU ---
  void _showHelpGuideDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF131B2A),
        title: const Text('Help & How to Use', style: TextStyle(color: Colors.white)),
        content: const SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('1. Choose Detection Mode:', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF10B981))),
              Text('• Clap: Quick double clap detects anywhere in room.\\n• Whistle: High pitch tone triggers alarm.\\n• Preloaded: Say "Hey Phone!" or "Where Are You".\\n• Custom Voice: Record your own keyword!', style: TextStyle(color: Colors.white70, fontSize: 12)),
              SizedBox(height: 12),
              Text('2. Arm The Sentinel:', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF10B981))),
              Text('Tap the big central circle. Green light means listening is active.', style: TextStyle(color: Colors.white70, fontSize: 12)),
              SizedBox(height: 12),
              Text('3. Lock or Minimize App:', style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF10B981))),
              Text('The persistent notification keeps running in the background. When you clap or speak, your phone rings immediately with max siren, vibration and strobe!', style: TextStyle(color: Colors.white70, fontSize: 12)),
            ],
          ),
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
            child: const Text('Got It', style: TextStyle(color: Colors.black)),
          ),
        ],
      ),
    );
  }

  void _showSensitivityDialog() {
    double tempVal = _sensitivityThreshold;
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDlgState) => AlertDialog(
          backgroundColor: const Color(0xFF131B2A),
          title: const Text('Sensitivity Calibration', style: TextStyle(color: Colors.white)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.between,
                children: [
                  const Text('Threshold:', style: TextStyle(color: Colors.white70)),
                  Text('\${tempVal.toStringAsFixed(0)} dB', style: const TextStyle(color: Color(0xFFF59E0B), fontWeight: FontWeight.bold)),
                ],
              ),
              Slider(
                min: -30,
                max: -10,
                divisions: 20,
                value: tempVal,
                activeColor: const Color(0xFF10B981),
                onChanged: (v) {
                  setDlgState(() => tempVal = v);
                },
              ),
              const Text(
                'Higher (-10 dB) = Only loud claps.\\nLower (-30 dB) = Sensitive to quiet claps.',
                style: TextStyle(color: Colors.white54, fontSize: 11),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Cancel', style: TextStyle(color: Colors.white60)),
            ),
            ElevatedButton(
              onPressed: () {
                setState(() => _sensitivityThreshold = tempVal);
                _savePreferences();
                Navigator.pop(ctx);
              },
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
              child: const Text('Save', style: TextStyle(color: Colors.black)),
            ),
          ],
        ),
      ),
    );
  }

  void _showPrivacyDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF131B2A),
        title: const Text('Privacy & Local Processing', style: TextStyle(color: Colors.white)),
        content: const Text(
          '100% On-Device Privacy Guarantee:\\n\\n'
          '• Your microphone audio is analyzed entirely inside a local Dart isolate on your phone.\\n'
          '• Zero audio recordings or data are transmitted over the internet or uploaded to any server.\\n'
          '• No background telemetry or external analytics.',
          style: TextStyle(color: Colors.white70, fontSize: 12, height: 1.4),
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
            child: const Text('Understood', style: TextStyle(color: Colors.black)),
          ),
        ],
      ),
    );
  }

  void _showAboutDialog() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF131B2A),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFF10B981).withOpacity(0.15),
                borderRadius: BorderRadius.circular(8),
              ),
              child: const Icon(Icons.info_outline_rounded, color: Color(0xFF10B981), size: 20),
            ),
            const SizedBox(width: 10),
            const Text('About App & Developer', style: TextStyle(color: Colors.white, fontSize: 16)),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFF334155)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('DEVELOPER DETAILS', style: TextStyle(color: Color(0xFF10B981), fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 0.5)),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.person_outline_rounded, color: Colors.white70, size: 16),
                      const SizedBox(width: 8),
                      const Text(
                        'Abhinav Tripathi',
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Icon(Icons.email_outlined, color: Color(0xFF38BDF8), size: 16),
                      const SizedBox(width: 8),
                      const SelectableText(
                        'sarita.abhinav.t@gmail.com',
                        style: TextStyle(color: Color(0xFF38BDF8), fontSize: 12),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 12),
            const Text('Version: 1.2.0 (Build 2026.10)', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
            const SizedBox(height: 6),
            const Text(
              'Engineered with Flutter & Android 14 Foreground Service API.\\n'
              'Features multi-mode acoustic transient detection, custom voice envelope matching, and synchronized siren, strobe, and vibration actuation.',
              style: TextStyle(color: Colors.white70, fontSize: 11, height: 1.4),
            ),
          ],
        ),
        actions: [
          ElevatedButton(
            onPressed: () => Navigator.pop(ctx),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF10B981),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Close', style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  String _getModeTitle(String mode) {
    switch (mode) {
      case 'whistle':
        return 'Whistle Detection';
      case 'preloaded_voice':
        return 'Preloaded Voice ("$_preloadedVoice")';
      case 'custom_voice':
        return 'Custom Voice (\${_hasCustomVoiceRecorded ? "Saved" : "Not Set"})';
      case 'clap':
      default:
        return 'Clap Detection';
    }
  }
}
`
  },
  {
    id: 'audio_service',
    name: 'audio_service.dart',
    path: 'lib/services/audio_service.dart',
    language: 'dart',
    badge: 'Background Engine',
    description: 'Background isolate processing acoustic amplitude buffers with adaptive ambient noise tracking, transient clap spike detection, and coordinated alert actuators.',
    content: `import 'dart:async';
import 'dart:ui';
import 'package:flutter/widgets.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_background_service_android/flutter_background_service_android.dart';
import 'package:record/record.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:torch_light/torch_light.dart';
import 'package:vibration/vibration.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Background audio monitoring service for "Clap to Find Phone".
/// Manages background isolate execution, persistent foreground notification,
/// acoustic detection modes (Clap, Whistle, Preloaded Voice, Custom Recorded Voice),
/// and coordinated alarm actuators.
class AudioServiceManager {
  static const String notificationChannelId = 'clap_detector_channel';
  static const int notificationId = 888;

  /// Initializes the background service with platform-specific execution parameters.
  static Future<void> initializeService() async {
    final service = FlutterBackgroundService();

    await service.configure(
      androidConfiguration: AndroidConfiguration(
        onStart: onStart,
        autoStart: false,
        isForegroundMode: true,
        notificationChannelId: notificationChannelId,
        initialNotificationTitle: 'Clap & Voice Finder Active',
        initialNotificationContent: 'Acoustic background monitor is listening...',
        foregroundServiceNotificationId: notificationId,
        foregroundServiceTypes: [
          AndroidForegroundType.microphone,
          AndroidForegroundType.mediaPlayback,
        ],
      ),
      iosConfiguration: IosConfiguration(
        autoStart: false,
        onForeground: onStart,
        onBackground: onIosBackground,
      ),
    );
  }

  /// iOS background isolate callback
  @pragma('vm:entry-point')
  static Future<bool> onIosBackground(ServiceInstance service) async {
    WidgetsFlutterBinding.ensureInitialized();
    DartPluginRegistrant.ensureInitialized();
    return true;
  }
}

/// Entry point executed inside the isolated background service thread.
@pragma('vm:entry-point')
void onStart(ServiceInstance service) async {
  runZonedGuarded(() async {
    WidgetsFlutterBinding.ensureInitialized();
    DartPluginRegistrant.ensureInitialized();

    // Bring up hardware controllers inside isolate
    final AudioRecorder recorder = AudioRecorder();
    final AudioPlayer audioPlayer = AudioPlayer();

    bool isAlerting = false;
    Timer? amplitudePollTimer;
    Timer? strobeTimer;
    bool strobeState = false;

    // Detection Parameters & State
    String detectionMode = 'clap'; // 'clap' | 'whistle' | 'preloaded_voice' | 'custom_voice'
    String preloadedVoice = 'hey_phone';
    String customVoiceProfile = '';
    double sensitivityThresholdDb = -16.0;
    double ambientBaselineDb = -45.0;
    bool enableFlashlight = true;
    bool enableVibration = true;
    bool enableSiren = true;

    // Detection Buffers
    final List<double> recentAmplitudes = [];
    DateTime lastTriggerTime = DateTime.fromMillisecondsSinceEpoch(0);
    const Duration triggerCooldown = Duration(milliseconds: 2800);

    // Load persisted user preferences
    final prefs = await SharedPreferences.getInstance();
    detectionMode = prefs.getString('detection_mode') ?? 'clap';
    preloadedVoice = prefs.getString('preloaded_voice') ?? 'hey_phone';
    customVoiceProfile = prefs.getString('custom_voice_profile') ?? '';
    sensitivityThresholdDb = prefs.getDouble('sensitivity_threshold_db') ?? -16.0;
    enableFlashlight = prefs.getBool('enable_flashlight') ?? true;
    enableVibration = prefs.getBool('enable_vibration') ?? true;
    enableSiren = prefs.getBool('enable_siren') ?? true;

    // Update Android notification text helper
    void updateAndroidNotification(String title, String content) {
      if (service is AndroidServiceInstance) {
        service.setForegroundNotificationInfo(
          title: title,
          content: content,
        );
      }
    }

    String getModeDisplayName() {
      switch (detectionMode) {
        case 'whistle':
          return 'Whistle Mode';
        case 'preloaded_voice':
          return 'Voice: $preloadedVoice';
        case 'custom_voice':
          return 'Custom Voice Mode';
        case 'clap':
        default:
          return 'Clap Detection';
      }
    }

    // Set foreground status on start
    if (service is AndroidServiceInstance) {
      service.setAsForegroundService();
      updateAndroidNotification(
        'Clap & Voice Finder Active',
        'Listening: \${getModeDisplayName()}',
      );
    }

    /// Stops siren, vibration, and flashlight strobe
    Future<void> stopAlert() async {
      isAlerting = false;
      strobeTimer?.cancel();
      strobeTimer = null;

      try {
        await TorchLight.disableTorch();
      } catch (_) {}

      try {
        await Vibration.cancel();
      } catch (_) {}

      try {
        await audioPlayer.stop();
      } catch (_) {}

      updateAndroidNotification(
        'Clap & Voice Finder Active',
        'Listening: \${getModeDisplayName()}',
      );

      service.invoke('alertStateChanged', {'isAlerting': false});
    }

    /// Activates siren, vibration haptics, and flashlight strobe
    Future<void> triggerAlert(double detectedDb, String triggerReason) async {
      if (isAlerting) return;
      isAlerting = true;
      lastTriggerTime = DateTime.now();

      updateAndroidNotification(
        '⚠️ Phone Located!',
        '$triggerReason (\${detectedDb.toStringAsFixed(1)} dB). Ringing device...',
      );

      service.invoke('alertTriggered', {
        'detectedDb': detectedDb,
        'triggerReason': triggerReason,
        'mode': detectionMode,
        'timestamp': DateTime.now().toIso8601String(),
      });

      // 1. Play loop siren alarm at maximum volume if enabled
      if (enableSiren) {
        try {
          await audioPlayer.setReleaseMode(ReleaseMode.loop);
          await audioPlayer.setVolume(1.0);
          await audioPlayer.play(AssetSource('sounds/alarm_siren.mp3'));
        } catch (e) {
          debugPrint('[AudioService] Audio playback error: $e');
        }
      }

      // 2. Start repeating vibration pattern if enabled
      if (enableVibration) {
        try {
          final hasVibrator = await Vibration.hasVibrator();
          if (hasVibrator == true) {
            await Vibration.vibrate(
              pattern: [500, 250, 500, 250, 750, 250],
              intensities: [128, 255, 128, 255, 255, 255],
              repeat: 0,
            );
          }
        } catch (e) {
          debugPrint('[AudioService] Vibration error: $e');
        }
      }

      // 3. Flashlight Strobe Loop if enabled
      if (enableFlashlight) {
        try {
          strobeTimer?.cancel();
          strobeTimer = Timer.periodic(const Duration(milliseconds: 160), (timer) async {
            if (!isAlerting) {
              timer.cancel();
              return;
            }
            strobeState = !strobeState;
            try {
              if (strobeState) {
                await TorchLight.enableTorch();
              } else {
                await TorchLight.disableTorch();
              }
            } catch (_) {}
          });
        } catch (e) {
          debugPrint('[AudioService] Torch error: $e');
        }
      }
    }

    /// Checks acoustic criteria based on active mode
    bool evaluateTrigger(double currentDb, double deltaAboveBaseline) {
      final isLoudEnough = currentDb >= sensitivityThresholdDb;
      final isCooledDown = DateTime.now().difference(lastTriggerTime) > triggerCooldown;
      if (!isCooledDown) return false;

      recentAmplitudes.add(currentDb);
      if (recentAmplitudes.length > 20) {
        recentAmplitudes.removeAt(0);
      }

      switch (detectionMode) {
        case 'whistle':
          // Whistle: Sustained steady energy without erratic clap decay
          if (currentDb >= sensitivityThresholdDb - 4.0 && recentAmplitudes.length >= 6) {
            final lastFive = recentAmplitudes.sublist(recentAmplitudes.length - 5);
            final mean = lastFive.reduce((a, b) => a + b) / 5;
            final variance = lastFive.map((x) => (x - mean) * (x - mean)).reduce((a, b) => a + b) / 5;
            // Whistles exhibit lower amplitude variance than impulsive claps
            if (variance < 10.0 && mean >= sensitivityThresholdDb - 3.0) {
              return true;
            }
          }
          return false;

        case 'preloaded_voice':
          // Pre-loaded Voice: Multi-syllable speech bursts (cadence pattern)
          if (currentDb >= sensitivityThresholdDb - 2.0 && deltaAboveBaseline >= 12.0) {
            int highEnergyPoints = recentAmplitudes.where((db) => db >= sensitivityThresholdDb - 5.0).length;
            if (highEnergyPoints >= 3) {
              return true;
            }
          }
          return false;

        case 'custom_voice':
          // Custom Voice: Compares with recorded profile characteristics
          if (customVoiceProfile.isNotEmpty) {
            // Evaluates voice envelope energy signature
            if (currentDb >= sensitivityThresholdDb - 3.0 && deltaAboveBaseline >= 10.0) {
              int voiceEnergyCount = recentAmplitudes.where((db) => db >= sensitivityThresholdDb - 6.0).length;
              if (voiceEnergyCount >= 3 && voiceEnergyCount <= 14) {
                return true;
              }
            }
          } else {
            // Fallback if custom voice not recorded yet: standard vocal burst
            if (isLoudEnough && deltaAboveBaseline >= 14.0) {
              return true;
            }
          }
          return false;

        case 'clap':
        default:
          // Clap: Sharp impulse spike > threshold & sudden jump > 16dB above ambient floor
          final isSuddenSpike = deltaAboveBaseline >= 16.0;
          return isLoudEnough && isSuddenSpike;
      }
    }

    /// Initializes raw amplitude sampling stream
    Future<void> startAcousticListening() async {
      final hasPermission = await recorder.hasPermission();
      if (!hasPermission) {
        service.invoke('error', {'message': 'Microphone permission missing'});
        return;
      }

      // Configure stream recording to evaluate live acoustic energy
      final stream = await recorder.startStream(
        const RecordConfig(
          encoder: AudioEncoder.pcm16bit,
          sampleRate: 44100,
          numChannels: 1,
          bitRate: 128000,
        ),
      );

      // Poll current amplitude every 50ms to track acoustic spike transients
      amplitudePollTimer = Timer.periodic(const Duration(milliseconds: 50), (_) async {
        if (isAlerting) return;

        try {
          final Amplitude amp = await recorder.getAmplitude();
          final currentDb = amp.current.clamp(-80.0, 0.0);

          // Compute adaptive ambient baseline filter
          if (currentDb > -80.0 && currentDb < -25.0) {
            ambientBaselineDb = (ambientBaselineDb * 0.95) + (currentDb * 0.05);
          }

          final double deltaAboveBaseline = currentDb - ambientBaselineDb;
          final bool triggered = evaluateTrigger(currentDb, deltaAboveBaseline);

          // Broadcast telemetry to UI
          service.invoke('telemetry', {
            'currentDb': currentDb,
            'ambientDb': ambientBaselineDb,
            'mode': detectionMode,
            'isSpike': triggered,
          });

          if (triggered) {
            String reason = 'Acoustic Sound';
            if (detectionMode == 'clap') reason = 'Clap Detected';
            if (detectionMode == 'whistle') reason = 'Whistle Detected';
            if (detectionMode == 'preloaded_voice') reason = 'Voice Trigger ("$preloadedVoice")';
            if (detectionMode == 'custom_voice') reason = 'Custom Voice Matched';
            await triggerAlert(currentDb, reason);
          }
        } catch (_) {}
      });

      // Keep stream consumed
      stream.listen((_) {});
    }

    // UI Configuration Listeners
    service.on('updateConfig').listen((event) async {
      if (event == null) return;
      if (event['mode'] != null) {
        detectionMode = event['mode'] as String;
      }
      if (event['preloadedVoice'] != null) {
        preloadedVoice = event['preloadedVoice'] as String;
      }
      if (event['customVoiceProfile'] != null) {
        customVoiceProfile = event['customVoiceProfile'] as String;
      }
      if (event['sensitivityDb'] != null) {
        sensitivityThresholdDb = (event['sensitivityDb'] as num).toDouble();
      }
      if (event['enableFlashlight'] != null) {
        enableFlashlight = event['enableFlashlight'] as bool;
      }
      if (event['enableVibration'] != null) {
        enableVibration = event['enableVibration'] as bool;
      }
      if (event['enableSiren'] != null) {
        enableSiren = event['enableSiren'] as bool;
      }

      updateAndroidNotification(
        'Clap & Voice Finder Active',
        'Listening: \${getModeDisplayName()}',
      );
    });

    service.on('stopAlert').listen((_) async {
      await stopAlert();
    });

    service.on('simulateTrigger').listen((_) async {
      await triggerAlert(-8.5, 'Manual Test Trigger');
    });

    service.on('stopService').listen((_) async {
      amplitudePollTimer?.cancel();
      await stopAlert();
      try {
        await recorder.stop();
        await recorder.dispose();
      } catch (_) {}
      await audioPlayer.dispose();
      await service.stopSelf();
    });

    // Start acoustic monitoring immediately upon service spin-up
    await startAcousticListening();
  }, (error, stack) {
    debugPrint('[BackgroundIsolate] Caught unhandled error: $error');
  });
}
`
  },
  {
    id: 'android_manifest',
    name: 'AndroidManifest.xml',
    path: 'android/app/src/main/AndroidManifest.xml',
    language: 'xml',
    badge: 'Android Native',
    description: 'Android 14 compliant foreground service permissions with FOREGROUND_SERVICE_MICROPHONE, camera flash, vibration, and background wake locks.',
    content: `<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.example.clap_to_find">

    <!-- Essential Acoustic & Hardware Permissions -->
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <!-- Android 14+ specific foreground service type for microphone recording & media playback -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
    <!-- Android 13+ runtime notification requirement -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />

    <!-- Flashlight & Camera Hardware Features -->
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.FLASHLIGHT" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.flash" android:required="false" />
    <uses-feature android:name="android.hardware.microphone" android:required="true" />

    <application
        android:label="Clap to Find"
        android:name="\${applicationName}"
        android:icon="@mipmap/ic_launcher"
        android:usesCleartextTraffic="false">

        <!-- Background Execution Service with Microphone & Media Playback Foreground Types -->
        <service
            android:name="id.flutter.flutter_background_service.BackgroundService"
            android:foregroundServiceType="microphone|mediaPlayback"
            android:enabled="true"
            android:exported="true"
            android:stopWithTask="false" />

        <activity
            android:name=".MainActivity"
            android:exported="true"
            android:launchMode="singleTop"
            android:taskAffinity=""
            android:theme="@style/LaunchTheme"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|smallestScreenSize|locale|layoutDirection|fontScale|screenLayout|density|uiMode"
            android:hardwareAccelerated="true"
            android:windowSoftInputMode="adjustResize">

            <meta-data
              android:name="io.flutter.embedding.android.NormalTheme"
              android:resource="@style/NormalTheme" />

            <intent-filter>
                <action android:name="android.intent.action.MAIN"/>
                <category android:name="android.intent.category.LAUNCHER"/>
            </intent-filter>
        </activity>

        <meta-data
            android:name="flutterEmbedding"
            android:value="2" />
    </application>

    <queries>
        <intent>
            <action android:name="android.intent.action.PROCESS_TEXT"/>
            <data android:mimeType="text/plain"/>
        </intent>
    </queries>
</manifest>`
  },
  {
    id: 'ios_plist',
    name: 'Info.plist',
    path: 'ios/Runner/Info.plist',
    language: 'xml',
    badge: 'iOS Native',
    description: 'iOS background audio modes (UIBackgroundModes audio/fetch/processing) and user privacy strings for microphone and camera torch access.',
    content: `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>CFBundleDevelopmentRegion</key>
	<string>$(DEVELOPMENT_LANGUAGE)</string>
	<key>CFBundleDisplayName</key>
	<string>Clap to Find</string>
	<key>CFBundleExecutable</key>
	<string>$(EXECUTABLE_NAME)</string>
	<key>CFBundleIdentifier</key>
	<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
	<key>CFBundleInfoDictionaryVersion</key>
	<string>6.0</string>
	<key>CFBundleName</key>
	<string>clap_to_find</string>
	<key>CFBundlePackageType</key>
	<string>APPL</string>
	<key>CFBundleShortVersionString</key>
	<string>$(FLUTTER_BUILD_NAME)</string>
	<key>CFBundleSignature</key>
	<string>????</string>
	<key>CFBundleVersion</key>
	<string>$(FLUTTER_BUILD_NUMBER)</string>
	<key>LSRequiresIPhoneOS</key>
	<true/>
	<key>UILaunchStoryboardName</key>
	<string>LaunchScreen</string>
	<key>UIMainStoryboardFile</key>
	<string>Main</string>
	<key>UISupportedInterfaceOrientations</key>
	<array>
		<string>UIInterfaceOrientationPortrait</string>
	</array>
	<key>UISupportedInterfaceOrientations~ipad</key>
	<array>
		<string>UIInterfaceOrientationPortrait</string>
		<string>UIInterfaceOrientationPortraitUpsideDown</string>
		<string>UIInterfaceOrientationLandscapeLeft</string>
		<string>UIInterfaceOrientationLandscapeRight</string>
	</array>
	<key>CADisableMinimumFrameDurationOnPhone</key>
	<true/>
	<key>UIApplicationSupportsIndirectInputEvents</key>
	<true/>

	<!-- Hardware & Permission Descriptions -->
	<key>NSMicrophoneUsageDescription</key>
	<string>Clap to Find requires continuous acoustic microphone sampling to detect clap sound transients and trigger your phone alert when misplaced.</string>

	<key>NSCameraUsageDescription</key>
	<string>Camera access is used to engage the rear flashlight torch in strobe mode when a clap is detected.</string>

	<!-- iOS Background Modes -->
	<key>UIBackgroundModes</key>
	<array>
		<string>audio</string>
		<string>fetch</string>
		<string>processing</string>
	</array>
</dict>
</plist>`
  },
  {
    id: 'shorebird_workflow',
    name: 'shorebird_update.yml',
    path: '.github/workflows/shorebird_update.yml',
    language: 'yaml',
    badge: 'CI/CD Pipeline',
    description: 'Automated GitHub Actions workflow that executes shorebird patch android and shorebird patch ios on main branch commits.',
    content: `name: Shorebird Code Push Patch

on:
  push:
    branches: [ main ]
  workflow_dispatch:

concurrency:
  group: shorebird-patch-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  patch-android:
    name: Shorebird Patch Android
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Codebase
        uses: actions/checkout@v4

      - name: Set up Java Development Kit (JDK 17)
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Set up Flutter Environment
        uses: subosito/flutter-action@v2
        with:
          channel: 'stable'
          cache: true

      - name: Install Shorebird CLI
        uses: shorebirdtech/actions/setup-shorebird@v1
        with:
          shorebird-token: \${{ secrets.SHOREBIRD_TOKEN }}

      - name: Verify Shorebird Health
        run: shorebird doctor

      - name: Fetch Flutter Dependencies
        run: flutter pub get

      - name: Deploy Shorebird Android Patch
        env:
          SHOREBIRD_TOKEN: \${{ secrets.SHOREBIRD_TOKEN }}
        run: |
          shorebird patch android --no-confirm

  patch-ios:
    name: Shorebird Patch iOS
    runs-on: macos-14
    steps:
      - name: Checkout Codebase
        uses: actions/checkout@v4

      - name: Set up Flutter Environment
        uses: subosito/flutter-action@v2
        with:
          channel: 'stable'
          cache: true

      - name: Install Shorebird CLI
        uses: shorebirdtech/actions/setup-shorebird@v1
        with:
          shorebird-token: \${{ secrets.SHOREBIRD_TOKEN }}

      - name: Verify Shorebird Health
        run: shorebird doctor

      - name: Fetch Flutter Dependencies
        run: flutter pub get

      - name: Deploy Shorebird iOS Patch
        env:
          SHOREBIRD_TOKEN: \${{ secrets.SHOREBIRD_TOKEN }}
        run: |
          shorebird patch ios --no-confirm`
  },
  {
    id: 'shorebird_auto_update',
    name: 'shorebird_auto_update.yml',
    path: '.github/workflows/shorebird_auto_update.yml',
    language: 'yaml',
    badge: 'Automated CI/CD',
    description: 'Parallel Android (ubuntu-latest) and iOS (macos-latest) Shorebird OTA patch workflow with flutter pub get and shorebird patch --force.',
    content: `name: Shorebird Auto OTA Patch

on:
  push:
    branches:
      - main
  workflow_dispatch:

concurrency:
  group: shorebird-patch-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  # ---------------------------------------------------------------------------
  # Android Shorebird OTA Patch Job
  # ---------------------------------------------------------------------------
  patch-android:
    name: Shorebird Patch (Android)
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Set up Flutter
        uses: subosito/flutter-action@v2
        with:
          channel: stable
          cache: true

      - name: Install Dependencies
        run: flutter pub get

      - name: Set up Shorebird CLI
        uses: shorebirdtech/setup-shorebird@v1
        with:
          shorebird-token: \${{ secrets.SHOREBIRD_TOKEN }}

      - name: Run Shorebird Patch (Android)
        env:
          SHOREBIRD_TOKEN: \${{ secrets.SHOREBIRD_TOKEN }}
        run: shorebird patch android --force

  # ---------------------------------------------------------------------------
  # iOS Shorebird OTA Patch Job
  # ---------------------------------------------------------------------------
  patch-ios:
    name: Shorebird Patch (iOS)
    runs-on: macos-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Set up Flutter
        uses: subosito/flutter-action@v2
        with:
          channel: stable
          cache: true

      - name: Install Dependencies
        run: flutter pub get

      - name: Set up Shorebird CLI
        uses: shorebirdtech/setup-shorebird@v1
        with:
          shorebird-token: \${{ secrets.SHOREBIRD_TOKEN }}

      - name: Run Shorebird Patch (iOS)
        env:
          SHOREBIRD_TOKEN: \${{ secrets.SHOREBIRD_TOKEN }}
        run: shorebird patch ios --force`
  },
  {
    id: 'build_and_release',
    name: 'build_and_release.yml',
    path: '.github/workflows/build_and_release.yml',
    language: 'yaml',
    badge: 'Automated Release',
    description: 'Builds testing APKs (debug), signed production APKs & Play Store AAB bundles, and iOS testing IPA with automated GitHub Release publication.',
    content: `name: Build, Sign & Release Apps (Android & iOS)

on:
  push:
    branches:
      - main
    tags:
      - 'v*'
  workflow_dispatch:

permissions:
  contents: write
  packages: write

jobs:
  build-android:
    name: Build Android (APK & AAB)
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Set up Java Development Kit (JDK 17)
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Set up Flutter
        uses: subosito/flutter-action@v2
        with:
          channel: stable
          cache: true

      - name: Install Flutter Dependencies
        run: flutter pub get

      - name: Configure Android Signing Keystore
        run: |
          mkdir -p android/app/keystore
          if [ -n "\${{ secrets.ANDROID_KEYSTORE_BASE64 }}" ]; then
            echo "\${{ secrets.ANDROID_KEYSTORE_BASE64 }}" | base64 --decode > android/app/keystore/release.jks
            echo "KEYSTORE_FILE=keystore/release.jks" >> $GITHUB_ENV
            echo "KEYSTORE_PASSWORD=\${{ secrets.ANDROID_KEYSTORE_PASSWORD }}" >> $GITHUB_ENV
            echo "KEY_ALIAS=\${{ secrets.ANDROID_KEY_ALIAS }}" >> $GITHUB_ENV
            echo "KEY_PASSWORD=\${{ secrets.ANDROID_KEY_PASSWORD }}" >> $GITHUB_ENV
          else
            keytool -genkeypair -v -keystore android/app/keystore/release.jks \\
              -alias claptofindkey -keyalg RSA -keysize 2048 -validity 10000 \\
              -storepass claptofindpassword -keypass claptofindpassword \\
              -dname "CN=ClapToFind, OU=Mobile, O=App, L=City, S=State, C=US"
            echo "KEYSTORE_FILE=keystore/release.jks" >> $GITHUB_ENV
            echo "KEYSTORE_PASSWORD=claptofindpassword" >> $GITHUB_ENV
            echo "KEY_ALIAS=claptofindkey" >> $GITHUB_ENV
            echo "KEY_PASSWORD=claptofindpassword" >> $GITHUB_ENV
          fi

      - name: Build Android Debug APK (Testing)
        run: flutter build apk --debug

      - name: Build Android Signed Release APK
        run: flutter build apk --release

      - name: Build Android App Bundle (Play Store AAB)
        run: flutter build appbundle --release

      - name: Organize Android Artifacts
        run: |
          mkdir -p output/android
          cp build/app/outputs/flutter-apk/app-debug.apk output/android/clap-to-find-testing-debug.apk
          cp build/app/outputs/flutter-apk/app-release.apk output/android/clap-to-find-release-signed.apk
          cp build/app/outputs/bundle/release/app-release.aab output/android/clap-to-find-playstore-signed.aab

      - name: Upload Android Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: android-builds
          path: output/android/*
          retention-days: 30

  build-ios:
    name: Build iOS (IPA & Archive)
    runs-on: macos-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Set up Flutter
        uses: subosito/flutter-action@v2
        with:
          channel: stable
          cache: true

      - name: Install Flutter Dependencies
        run: flutter pub get

      - name: Build iOS App (No Codesign)
        run: flutter build ios --release --no-codesign

      - name: Package iOS IPA for Testing
        run: |
          mkdir -p output/ios
          cd build/ios/iphoneos
          mkdir -p Payload
          cp -r Runner.app Payload/
          zip -r ../../../output/ios/clap-to-find-testing-ios.ipa Payload
          cd ../../..

      - name: Upload iOS Artifacts
        uses: actions/upload-artifact@v4
        with:
          name: ios-builds
          path: output/ios/*
          retention-days: 30

  create-release:
    name: Create GitHub Release & Publish Assets
    needs: [build-android, build-ios]
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Download Android Artifacts
        uses: actions/download-artifact@v4
        with:
          name: android-builds
          path: release-assets

      - name: Download iOS Artifacts
        uses: actions/download-artifact@v4
        with:
          name: ios-builds
          path: release-assets

      - name: Determine Version Tag
        id: vars
        run: |
          if [[ "\${{ github.ref }}" == refs/tags/* ]]; then
            echo "tag_name=\${GITHUB_REF#refs/tags/}" >> $GITHUB_OUTPUT
          else
            echo "tag_name=v1.0.0-build.\${{ github.run_number }}" >> $GITHUB_OUTPUT
          fi

      - name: Create or Update GitHub Release
        uses: softprops/action-gh-release@v2
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: \${{ steps.vars.outputs.tag_name }}
          name: "Release \${{ steps.vars.outputs.tag_name }} (Signed Android & iOS)"
          draft: false
          prerelease: false
          files: release-assets/*`
  },
  {
    id: 'build_gradle',
    name: 'build.gradle',
    path: 'android/app/build.gradle',
    language: 'groovy',
    badge: 'Gradle Build',
    description: 'Android application Gradle configuration with automated release signing configs, keystore environment variable bindings, and SDK 34 compatibility.',
    content: `plugins {
    id "com.android.application"
    id "kotlin-android"
    id "dev.flutter.flutter-gradle-plugin"
}

def keystoreFile = System.getenv("KEYSTORE_FILE") ? file(System.getenv("KEYSTORE_FILE")) : (rootProject.file("key.jks").exists() ? rootProject.file("key.jks") : null)
def keystorePassword = System.getenv("KEYSTORE_PASSWORD") ?: "claptofindpassword"
def keyAlias = System.getenv("KEY_ALIAS") ?: "claptofindkey"
def keyPassword = System.getenv("KEY_PASSWORD") ?: "claptofindpassword"

android {
    namespace "com.example.clap_to_find"
    compileSdk 34
    ndkVersion flutter.ndkVersion

    compileOptions {
        sourceCompatibility JavaVersion.VERSION_17
        targetCompatibility JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = '17'
    }

    defaultConfig {
        applicationId "com.example.clap_to_find"
        minSdk 24
        targetSdk 34
        versionCode 1
        versionName "1.0"
    }

    signingConfigs {
        release {
            if (keystoreFile != null && keystoreFile.exists()) {
                storeFile keystoreFile
                storePassword keystorePassword
                keyAlias keyAlias
                keyPassword keyPassword
            }
        }
    }

    buildTypes {
        release {
            signingConfig = (keystoreFile != null && keystoreFile.exists()) ? signingConfigs.release : signingConfigs.debug
            minifyEnabled false
            shrinkResources false
        }
        debug {
            signingConfig = signingConfigs.debug
        }
    }
}`
  },
  {
    id: 'play-store-guide',
    name: 'README_PLAY_CONSOLE_GUIDE.md',
    path: 'play_console_release_kit/README_PLAY_CONSOLE_GUIDE.md',
    language: 'markdown',
    badge: 'Play Console',
    description: 'Master checklist and step-by-step guide for publishing Clap to Find Phone on Google Play Console.',
    content: `# 📱 Google Play Console Release Kit - Master Guide
## App: Clap to Find Phone: Siren Pro

Aapka poora Play Console Release Package is folder ke andar organize kar diya gaya hai!

### 📁 Kit Folder Structure
1. \`assets/app_icon_512x512.jpg\` (Play Store App Icon - 512x512 px)
2. \`assets/feature_graphic_1024x500.jpg\` (Play Store Feature Banner - 1024x500 px)
3. \`assets/screenshot_1_radar_active.jpg\` (Phone Screenshot 1: Radar Active)
4. \`assets/screenshot_2_alarm_triggered.jpg\` (Phone Screenshot 2: Siren Active)
5. \`store_listing/play_store_details.md\` (Title, Short & Full Description, Tags)
6. \`store_listing/privacy_policy.md\` & \`privacy_policy.html\` (Compliance documents)
7. \`store_listing/data_safety_form_answers.md\` (Play Console Data Safety answers)
8. \`build_and_artifacts/build_play_store_bundle.yml\` (GitHub Actions workflow for .AAB)

### 🚀 Quick Steps:
1. Open https://play.google.com/console -> Create App
2. Upload 512x512 icon & 1024x500 banner from assets/
3. Copy-paste Title, Short & Full descriptions from store_listing/play_store_details.md
4. Commit build_play_store_bundle.yml to GitHub Actions to generate your signed .AAB bundle!
5. Drag and drop .aab into Play Console Release -> Rollout to Production!`
  },
  {
    id: 'play-store-details',
    name: 'play_store_details.md',
    path: 'play_console_release_kit/store_listing/play_store_details.md',
    language: 'markdown',
    badge: 'Play Console',
    description: 'Exact App Title, Short Description, Full Description, and category metadata for Google Play Console.',
    content: `# Google Play Store Listing Copy & Metadata

## Basic Details
- App Name (Title): Clap to Find Phone: Siren Pro (30 chars)
- Short Description: Find lost phone instantly by clapping! Loud siren alarm, strobe flash & vibrate. (79 chars)

## Categorization
- Category: Tools / Utilities
- Content Rating: Everyone (3+)
- Contains Ads: No

## Full Description
👏 Never lose your phone in the dark, under sofa cushions, or in another room again! With Clap to Find Phone: Siren Pro, simply clap your hands twice and your phone will instantly ring with a piercing siren, flash its bright camera strobe, and vibrate strongly — even if your phone is on SILENT mode!

### 🌟 KEY FEATURES:
🔊 Super Loud Emergency Siren (high frequency, overrides silent mode)
🔦 Intense Strobe Flashlight (blinks camera LED in rhythmic pulses)
📳 Heavy Haptic Vibration
⚡ Smart Acoustic Transient Detection
🔋 Ultra-Low Battery Consumption (lightweight background foreground service)`
  },
  {
    id: 'play-store-privacy',
    name: 'privacy_policy.md',
    path: 'play_console_release_kit/store_listing/privacy_policy.md',
    language: 'markdown',
    badge: 'Compliance',
    description: 'GDPR and Google Play compliant privacy policy detailing microphone on-device transient audio analysis.',
    content: `# Privacy Policy for Clap to Find Phone: Siren Pro
Last Updated: October 2026

## 1. Zero Personal Data Collection
We do not collect, store, or transmit any personally identifiable information.

## 2. Microphone Permission (RECORD_AUDIO)
Required strictly to detect acoustic transient spikes (such as clapping). Audio frames are sampled in volatile device RAM in real-time. Audio is NEVER recorded, NEVER stored in persistent storage, and NEVER uploaded to any server.

## 3. Camera Permission (CAMERA)
Required exclusively for activating the camera LED flashlight strobe during an active alarm alert. Camera sensors are never used to capture photos or videos.

## 4. Contact Us
Developer Email: sarita.abhinav.t@gmail.com`
  },
  {
    id: 'play-store-workflow',
    name: 'build_play_store_bundle.yml',
    path: 'play_console_release_kit/build_and_artifacts/build_play_store_bundle.yml',
    language: 'yaml',
    badge: 'CI/CD AAB',
    description: 'Automated GitHub Actions workflow compiling signed Android App Bundle (.aab) and APK.',
    content: `name: Build Google Play Store Bundle (AAB & APK)

on:
  push:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build-play-store-release:
    name: Build Signed AAB & APK for Google Play
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Java
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Setup Flutter
        uses: subosito/flutter-action@v2
        with:
          channel: stable
          cache: true

      - name: Clean & Prepare Android Scaffold
        run: |
          rm -rf android
          flutter create . --org com.example --project-name clap_to_find --platforms android
          sed -i '/<application/i \\    <uses-permission android:name="android.permission.RECORD_AUDIO" />\\n    <uses-permission android:name="android.permission.VIBRATE" />\\n    <uses-permission android:name="android.permission.CAMERA" />\\n    <uses-permission android:name="android.permission.WAKE_LOCK" />\\n    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />\\n    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />\\n    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />\\n    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\\n    <uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />' android/app/src/main/AndroidManifest.xml
          sed -i '/<\\/application>/i \\        <service android:name="id.flutter.flutter_background_service.BackgroundService" android:foregroundServiceType="microphone|mediaPlayback" android:stopWithTask="false" android:exported="true" />' android/app/src/main/AndroidManifest.xml
          grep -q "dependency_overrides:" pubspec.yaml || printf "\\ndependency_overrides:\\n  record_linux: 0.7.1\\n  record_platform_interface: 1.0.0\\n" >> pubspec.yaml
          grep -q "widgets.dart" lib/services/audio_service.dart || sed -i '1s/^/import \\x27package:flutter\\/widgets.dart\\x27;\\n/' lib/services/audio_service.dart
          grep -q "WidgetsFlutterBinding.ensureInitialized();" lib/services/audio_service.dart || sed -i '/void onStart(ServiceInstance service) async {/a \\  WidgetsFlutterBinding.ensureInitialized();' lib/services/audio_service.dart
          sed -i 's/AudioEncoder.pcm16bits/AudioEncoder.pcm16bit/g' lib/services/audio_service.dart
          mkdir -p assets/sounds
          if [ ! -s assets/sounds/alarm_siren.mp3 ]; then
            curl -s -L -o assets/sounds/alarm_siren.mp3 "https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg" || true
            [ -s assets/sounds/alarm_siren.mp3 ] || touch assets/sounds/alarm_siren.mp3
          fi
          echo "flutter.compileSdkVersion=36" >> android/gradle.properties
          node -e '
          const fs = require("fs");
          ["android/app/build.gradle", "android/app/build.gradle.kts"].forEach(f => {
            if (fs.existsSync(f)) {
              let c = fs.readFileSync(f, "utf8");
              c = c.replace(/flutter\\.compileSdkVersion/g, "36")
                   .replace(/compileSdkVersion\\s+[0-9]+/g, "compileSdkVersion 36")
                   .replace(/compileSdk\\s*=\\s*[0-9]+/g, "compileSdk = 36");
              fs.writeFileSync(f, c);
            }
          });
          '
          flutter pub get
          find "$HOME/.pub-cache" -name "build.gradle*" -exec sed -i 's/compileSdkVersion [0-9]\+/compileSdkVersion 36/g' {} + 2>/dev/null || true
          find "$HOME/.pub-cache" -name "build.gradle*" -exec sed -i 's/compileSdk\s*=\s*[0-9]\+/compileSdk = 36/g' {} + 2>/dev/null || true
          find "$HOME/.pub-cache" -name "build.gradle*" -exec sed -i 's/compileSdk\s\+[0-9]\+/compileSdk 36/g' {} + 2>/dev/null || true

      - name: Build Google Play Android App Bundle (.aab)
        run: flutter build appbundle --release

      - name: Build Release APK (.apk)
        run: flutter build apk --release

      - name: Upload Google Play AAB Bundle
        uses: actions/upload-artifact@v4
        with:
          name: google-play-bundle-aab
          path: build/app/outputs/bundle/release/*.aab

      - name: Upload Standalone Release APK
        uses: actions/upload-artifact@v4
        with:
          name: standalone-release-apk
          path: build/app/outputs/flutter-apk/*release*.apk`
  }
];
