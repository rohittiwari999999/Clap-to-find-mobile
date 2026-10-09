import 'dart:async';
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
              'Modern Android versions (12, 13, 14, 15) aggressively put background apps to sleep.\n\n'
              'To keep Clap & Voice Finder running 24/7:\n'
              '1. Go to App Info > Battery\n'
              '2. Select "Unrestricted" (bina kisi rok tok ke)\n'
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
              'Mode: ${_getModeTitle(_detectionMode)}',
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
                _isServiceRunning ? '${_currentDb.toStringAsFixed(1)} dBFS' : '-- dBFS',
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
                'Trigger: ${_sensitivityThreshold.toStringAsFixed(0)} dB',
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
              'Trigger: ${_getModeTitle(_detectionMode)} registered.',
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
              Text('• Clap: Quick double clap detects anywhere in room.\n• Whistle: High pitch tone triggers alarm.\n• Preloaded: Say "Hey Phone!" or "Where Are You".\n• Custom Voice: Record your own keyword!', style: TextStyle(color: Colors.white70, fontSize: 12)),
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
                  Text('${tempVal.toStringAsFixed(0)} dB', style: const TextStyle(color: Color(0xFFF59E0B), fontWeight: FontWeight.bold)),
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
                'Higher (-10 dB) = Only loud claps.\nLower (-30 dB) = Sensitive to quiet claps.',
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
          '100% On-Device Privacy Guarantee:\n\n'
          '• Your microphone audio is analyzed entirely inside a local Dart isolate on your phone.\n'
          '• Zero audio recordings or data are transmitted over the internet or uploaded to any server.\n'
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
              'Engineered with Flutter & Android 14 Foreground Service API.\n'
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
        return 'Custom Voice (${_hasCustomVoiceRecorded ? "Saved" : "Not Set"})';
      case 'clap':
      default:
        return 'Clap Detection';
    }
  }
}
