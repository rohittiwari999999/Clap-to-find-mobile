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
    - assets/sounds/alarm_siren.mp3`
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
import 'services/audio_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await AudioServiceManager.initializeService();
  runApp(const ClapToFindApp());
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
          primary: Color(0xFF10B981), // Emerald glow
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
    with SingleTickerProviderStateMixin {
  final FlutterBackgroundService _service = FlutterBackgroundService();

  bool _isServiceRunning = false;
  bool _isAlerting = false;
  double _currentDb = -60.0;
  double _ambientDb = -45.0;
  double _sensitivityThreshold = -16.0;

  bool _enableFlashlight = true;
  bool _enableVibration = true;
  bool _enableSiren = true;

  late AnimationController _pulseController;
  StreamSubscription? _telemetrySub;
  StreamSubscription? _alertSub;
  StreamSubscription? _stateSub;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat();

    _loadPreferences();
    _bindServiceListeners();
    _checkServiceStatus();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _telemetrySub?.cancel();
    _alertSub?.cancel();
    _stateSub?.cancel();
    super.dispose();
  }

  Future<void> _loadPreferences() async {
    final prefs = await SharedPreferences.getInstance();
    setState(() {
      _sensitivityThreshold = prefs.getDouble('sensitivity_threshold_db') ?? -16.0;
      _enableFlashlight = prefs.getBool('enable_flashlight') ?? true;
      _enableVibration = prefs.getBool('enable_vibration') ?? true;
      _enableSiren = prefs.getBool('enable_siren') ?? true;
    });
  }

  Future<void> _bindServiceListeners() async {
    _telemetrySub = _service.on('telemetry').listen((data) {
      if (mounted && data != null) {
        setState(() {
          _currentDb = (data['currentDb'] as num?)?.toDouble() ?? _currentDb;
          _ambientDb = (data['ambientDb'] as num?)?.toDouble() ?? _ambientDb;
        });
      }
    });

    _alertSub = _service.on('alertTriggered').listen((data) {
      if (mounted) {
        setState(() {
          _isAlerting = true;
        });
      }
    });

    _stateSub = _service.on('alertStateChanged').listen((data) {
      if (mounted && data != null) {
        setState(() {
          _isAlerting = data['isAlerting'] ?? false;
        });
      }
    });
  }

  Future<void> _checkServiceStatus() async {
    final isRunning = await _service.isRunning();
    if (mounted) {
      setState(() {
        _isServiceRunning = isRunning;
      });
    }
  }

  Future<void> _toggleService() async {
    if (_isServiceRunning) {
      _service.invoke('stopService');
      setState(() {
        _isServiceRunning = false;
        _isAlerting = false;
        _currentDb = -60.0;
      });
    } else {
      // Check & request runtime permissions first
      final micStatus = await Permission.microphone.request();
      if (!micStatus.isGranted) {
        _showPermissionDialog('Microphone Access Required',
            'Please grant microphone permission so the app can detect clap transients.');
        return;
      }

      await Permission.notification.request();

      final started = await _service.startService();
      setState(() {
        _isServiceRunning = started;
      });
    }
  }

  void _stopAlarm() {
    _service.invoke('stopAlert');
    setState(() {
      _isAlerting = false;
    });
  }

  void _simulateClap() {
    _service.invoke('simulateClap');
    setState(() {
      _isAlerting = true;
    });
  }

  void _showPermissionDialog(String title, String message) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF162032),
        title: Text(title, style: const TextStyle(color: Colors.white)),
        content: Text(message, style: const TextStyle(color: Colors.white70)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF10B981)),
            onPressed: () {
              Navigator.pop(ctx);
              openAppSettings();
            },
            child: const Text('Open Settings', style: TextStyle(color: Colors.black)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: false,
        title: const Text(
          'Clap to Find',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 20, letterSpacing: -0.5),
        ),
        actions: [
          IconButton(
            tooltip: 'Simulate Clap Event',
            icon: const Icon(Icons.bolt, color: Colors.amberAccent),
            onPressed: _isServiceRunning ? _simulateClap : null,
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: Stack(
          children: [
            Column(
              children: [
                _buildSystemStatusBanner(),
                const Spacer(flex: 1),
                _buildMainRadarButton(),
                const SizedBox(height: 24),
                _buildAcousticMeter(),
                const Spacer(flex: 2),
                _buildControlsCard(),
                const SizedBox(height: 16),
              ],
            ),
            if (_isAlerting) _buildAlarmOverlay(),
          ],
        ),
      ),
    );
  }

  Widget _buildSystemStatusBanner() {
    final statusColor = _isServiceRunning ? const Color(0xFF10B981) : Colors.white38;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF131B2A),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: _isServiceRunning ? const Color(0xFF10B981).withOpacity(0.3) : Colors.white10,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: statusColor,
              boxShadow: _isServiceRunning
                  ? [BoxShadow(color: statusColor.withOpacity(0.8), blurRadius: 10)]
                  : null,
            ),
          ),
          const SizedBox(width: 12),
          Text(
            _isServiceRunning ? 'Background Service Active' : 'Protection Disabled',
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
          ),
          const Spacer(),
          Text(
            _isServiceRunning ? 'Listening' : 'Idle',
            style: TextStyle(fontSize: 12, color: statusColor),
          ),
        ],
      ),
    );
  }

  Widget _buildMainRadarButton() {
    return Center(
      child: GestureDetector(
        onTap: _toggleService,
        child: SizedBox(
          width: 240,
          height: 240,
          child: Stack(
            alignment: Alignment.center,
            children: [
              if (_isServiceRunning) ...[
                AnimatedBuilder(
                  animation: _pulseController,
                  builder: (context, child) {
                    final progress = _pulseController.value;
                    return Container(
                      width: 170 + (progress * 70),
                      height: 170 + (progress * 70),
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: const Color(0xFF10B981).withOpacity(1.0 - progress),
                          width: 2,
                        ),
                      ),
                    );
                  },
                ),
              ],
              Container(
                width: 170,
                height: 170,
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
                          : Colors.black45,
                      blurRadius: _isServiceRunning ? 30 : 10,
                      spreadRadius: _isServiceRunning ? 4 : 0,
                    ),
                  ],
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      _isServiceRunning ? Icons.mic : Icons.mic_off,
                      size: 48,
                      color: _isServiceRunning ? Colors.white : Colors.white54,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _isServiceRunning ? 'ARMED' : 'OFF',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.2,
                        color: _isServiceRunning ? Colors.white : Colors.white60,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _isServiceRunning ? 'Tap to pause' : 'Tap to arm',
                      style: TextStyle(
                        fontSize: 11,
                        color: _isServiceRunning ? Colors.white70 : Colors.white38,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAcousticMeter() {
    final double norm = ((_currentDb + 60.0) / 60.0).clamp(0.0, 1.0);
    final double thresholdNorm = ((_sensitivityThreshold + 60.0) / 60.0).clamp(0.0, 1.0);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 24),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF131B2A),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Live Acoustic Input',
                style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Colors.white70),
              ),
              Text(
                _isServiceRunning ? '\${_currentDb.toStringAsFixed(1)} dBFS' : '-- dBFS',
                style: const TextStyle(
                  fontSize: 13,
                  fontFamily: 'monospace',
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF10B981),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Stack(
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(6),
                child: LinearProgressIndicator(
                  value: _isServiceRunning ? norm : 0.05,
                  minHeight: 12,
                  backgroundColor: const Color(0xFF0F172A),
                  valueColor: AlwaysStoppedAnimation<Color>(
                    norm >= thresholdNorm ? const Color(0xFFEF4444) : const Color(0xFF10B981),
                  ),
                ),
              ),
              Positioned(
                left: MediaQuery.of(context).size.width * 0.8 * thresholdNorm,
                top: 0,
                bottom: 0,
                child: Container(
                  width: 3,
                  color: Colors.amberAccent,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildControlsCard() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 24),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF131B2A),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Clap Sensitivity',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
              ),
              Text(
                '\${_sensitivityThreshold.toStringAsFixed(0)} dB',
                style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.amberAccent),
              ),
            ],
          ),
          Slider(
            value: _sensitivityThreshold,
            min: -30.0,
            max: -10.0,
            divisions: 20,
            activeColor: const Color(0xFF10B981),
            inactiveColor: Colors.white12,
            onChanged: (val) {
              setState(() {
                _sensitivityThreshold = val;
              });
              _service.invoke('setSensitivity', {'thresholdDb': val});
            },
          ),
          const Divider(color: Colors.white10, height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _buildFeatureToggle(
                icon: Icons.flash_on,
                label: 'Strobe',
                active: _enableFlashlight,
                onTap: () => setState(() => _enableFlashlight = !_enableFlashlight),
              ),
              _buildFeatureToggle(
                icon: Icons.vibration,
                label: 'Vibrate',
                active: _enableVibration,
                onTap: () => setState(() => _enableVibration = !_enableVibration),
              ),
              _buildFeatureToggle(
                icon: Icons.volume_up,
                label: 'Siren',
                active: _enableSiren,
                onTap: () => setState(() => _enableSiren = !_enableSiren),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildFeatureToggle({
    required IconData icon,
    required String label,
    required bool active,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: active ? const Color(0xFF10B981).withOpacity(0.2) : Colors.white10,
              border: Border.all(
                color: active ? const Color(0xFF10B981) : Colors.transparent,
              ),
            ),
            child: Icon(
              icon,
              color: active ? const Color(0xFF10B981) : Colors.white38,
              size: 22,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w500,
              color: active ? Colors.white : Colors.white38,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAlarmOverlay() {
    return Positioned.fill(
      child: Container(
        color: Colors.black.withOpacity(0.92),
        padding: const EdgeInsets.symmetric(horizontal: 24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(
              Icons.warning_amber_rounded,
              color: Colors.amberAccent,
              size: 80,
            ),
            const SizedBox(height: 16),
            const Text(
              'CLAP DETECTED!',
              style: TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w900,
                letterSpacing: 1.5,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 8),
            const Text(
              'Device alarm, haptics, and strobe flashlight are active.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white70, fontSize: 14),
            ),
            const SizedBox(height: 48),
            SizedBox(
              width: double.infinity,
              height: 56,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.check_circle_outline, color: Colors.black, size: 24),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF10B981),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                onPressed: _stopAlarm,
                label: const Text(
                  'I FOUND MY PHONE (STOP)',
                  style: TextStyle(
                    color: Colors.black,
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}`
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
import 'package:flutter/foundation.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_background_service_android/flutter_background_service_android.dart';
import 'package:record/record.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:torch_light/torch_light.dart';
import 'package:vibration/vibration.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Background audio monitoring service for "Clap to Find Phone".
/// Manages background isolate execution, acoustic spike detection,
/// and coordinated alarm, strobe, and vibration actuation.
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
        initialNotificationTitle: 'Clap to Find Active',
        initialNotificationContent: 'Acoustic background monitor is listening...',
        foregroundServiceNotificationId: notificationId,
        foregroundServiceTypes: [
          AndroidForegroundType.microphone,
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
  DartPluginRegistrant.ensureInitialized();

  // Bring up hardware controllers inside isolate
  final AudioRecorder recorder = AudioRecorder();
  final AudioPlayer audioPlayer = AudioPlayer();

  bool isAlerting = false;
  Timer? amplitudePollTimer;
  Timer? strobeTimer;
  bool strobeState = false;

  // Clap detection calibration parameters
  // Audio amplitude in dBFS usually ranges from -60 dB (silence) to 0 dB (max).
  double sensitivityThresholdDb = -16.0; // Higher = requires louder clap
  double ambientBaselineDb = -45.0;
  DateTime lastTriggerTime = DateTime.fromMillisecondsSinceEpoch(0);
  const Duration triggerCooldown = Duration(milliseconds: 2500);

  // Load persisted user preferences
  final prefs = await SharedPreferences.getInstance();
  final savedSensitivity = prefs.getDouble('sensitivity_threshold_db');
  if (savedSensitivity != null) {
    sensitivityThresholdDb = savedSensitivity;
  }

  // Update notification helper for Android
  void updateAndroidNotification(String title, String content) {
    if (service is AndroidServiceInstance) {
      service.setForegroundNotificationInfo(
        title: title,
        content: content,
      );
    }
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
      'Clap to Find Active',
      'Listening for acoustic claps...',
    );

    service.invoke('alertStateChanged', {'isAlerting': false});
  }

  /// Activates siren, vibration haptics, and flashlight strobe
  Future<void> triggerAlert(double detectedDb) async {
    if (isAlerting) return;
    isAlerting = true;
    lastTriggerTime = DateTime.now();

    updateAndroidNotification(
      '⚠️ Phone Located!',
      'Clap detected (\${detectedDb.toStringAsFixed(1)} dB). Ringing device...',
    );

    service.invoke('alertTriggered', {
      'detectedDb': detectedDb,
      'timestamp': DateTime.now().toIso8601String(),
    });

    // 1. Play loop siren alarm at maximum volume
    try {
      await audioPlayer.setReleaseMode(ReleaseMode.loop);
      await audioPlayer.setVolume(1.0);
      await audioPlayer.play(AssetSource('sounds/alarm_siren.mp3'));
    } catch (e) {
      debugPrint('[AudioService] Audio playback error: \$e');
    }

    // 2. Start repeating vibration pattern: [Wait, Vibrate, Wait, Vibrate...]
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
      debugPrint('[AudioService] Vibration error: \$e');
    }

    // 3. Flashlight Strobe Loop (150ms interval)
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
      debugPrint('[AudioService] Torch error: \$e');
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
        encoder: AudioEncoder.pcm16bits,
        sampleRate: 44100,
        numChannels: 1,
        bitRate: 128000,
      ),
    );

    // Poll current amplitude every 60ms to track acoustic spike transients
    amplitudePollTimer = Timer.periodic(const Duration(milliseconds: 60), (_) async {
      if (isAlerting) return;

      try {
        final Amplitude amp = await recorder.getAmplitude();
        final currentDb = amp.current; // -160.0 to 0.0 dBFS

        // Compute adaptive ambient baseline filter (slow moving exponential average)
        if (currentDb > -80.0 && currentDb < -25.0) {
          ambientBaselineDb = (ambientBaselineDb * 0.95) + (currentDb * 0.05);
        }

        // Acoustic spike criteria:
        // 1. Current dB exceeds absolute sensitivity threshold (e.g. > -16 dBFS)
        // 2. Sudden relative jump above ambient noise floor (> 18 dB jump)
        // 3. Past the trigger cooldown period
        final double deltaAboveBaseline = currentDb - ambientBaselineDb;
        final bool isLoudEnough = currentDb >= sensitivityThresholdDb;
        final bool isSuddenSpike = deltaAboveBaseline >= 18.0;
        final bool isCooledDown = DateTime.now().difference(lastTriggerTime) > triggerCooldown;

        service.invoke('telemetry', {
          'currentDb': currentDb,
          'ambientDb': ambientBaselineDb,
          'isSpike': isLoudEnough && isSuddenSpike,
        });

        if (isLoudEnough && isSuddenSpike && isCooledDown) {
          await triggerAlert(currentDb);
        }
      } catch (_) {}
    });

    stream.listen((_) {});
  }

  // Handle client UI instructions
  service.on('stopAlert').listen((event) async {
    await stopAlert();
  });

  service.on('setSensitivity').listen((event) async {
    if (event != null && event['thresholdDb'] != null) {
      sensitivityThresholdDb = (event['thresholdDb'] as num).toDouble();
      final prefs = await SharedPreferences.getInstance();
      await prefs.setDouble('sensitivity_threshold_db', sensitivityThresholdDb);
    }
  });

  service.on('simulateClap').listen((event) async {
    await triggerAlert(-8.5);
  });

  service.on('stopService').listen((event) async {
    amplitudePollTimer?.cancel();
    await stopAlert();
    try {
      await recorder.stop();
      await recorder.dispose();
    } catch (_) {}
    await audioPlayer.dispose();
    await service.stopSelf();
  });

  await startAcousticListening();
}`
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
    <!-- Android 14+ specific foreground service type for microphone recording -->
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />
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

        <!-- Background Execution Service with Microphone Foreground Type -->
        <service
            android:name="id.flutter.flutter_background_service.BackgroundService"
            android:foregroundServiceType="microphone"
            android:enabled="true"
            android:exported="false" />

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
            signingConfig (keystoreFile != null && keystoreFile.exists()) ? signingConfigs.release : signingConfigs.debug
            minifyEnabled false
            shrinkResources false
        }
        debug {
            signingConfig signingConfigs.debug
        }
    }
}`
  }
];
