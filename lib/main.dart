import 'dart:async';
import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:record/record.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:torch_light/torch_light.dart';
import 'package:vibration/vibration.dart';

void main() async {
  runZonedGuarded(() async {
    WidgetsFlutterBinding.ensureInitialized();
    runApp(const ClapToFindApp());
  }, (error, stack) {
    debugPrint('[ClapApp] Caught error in zone: $error');
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
  final AudioRecorder _recorder = AudioRecorder();
  final AudioPlayer _audioPlayer = AudioPlayer();

  bool _isServiceRunning = false;
  bool _isAlerting = false;
  double _currentDb = -60.0;
  double _ambientDb = -45.0;
  double _sensitivityThreshold = -16.0;

  bool _enableFlashlight = true;
  bool _enableVibration = true;
  bool _enableSiren = true;

  late AnimationController _pulseController;
  Timer? _amplitudeTimer;
  Timer? _strobeTimer;
  bool _strobeState = false;
  DateTime _lastTriggerTime = DateTime.fromMillisecondsSinceEpoch(0);

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat();

    _loadPreferences();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _amplitudeTimer?.cancel();
    _strobeTimer?.cancel();
    _stopAlarm();
    try {
      _recorder.dispose();
    } catch (_) {}
    try {
      _audioPlayer.dispose();
    } catch (_) {}
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

  Future<void> _toggleService() async {
    if (_isServiceRunning) {
      await _stopListening();
    } else {
      await _startListening();
    }
  }

  Future<void> _startListening() async {
    // 1. Request microphone permission
    final micStatus = await Permission.microphone.request();
    if (!micStatus.isGranted) {
      _showPermissionDialog(
        'Microphone Access Required',
        'Please grant microphone permission in Settings so the app can listen for claps.',
      );
      return;
    }

    try {
      await Permission.notification.request();
    } catch (_) {}

    try {
      // Start real-time audio stream
      final stream = await _recorder.startStream(
        const RecordConfig(
          encoder: AudioEncoder.pcm16bit,
          sampleRate: 44100,
          numChannels: 1,
        ),
      );
      stream.listen((_) {});

      // Poll acoustic amplitude every 50ms
      _amplitudeTimer?.cancel();
      _amplitudeTimer = Timer.periodic(const Duration(milliseconds: 50), (_) async {
        if (_isAlerting) return;
        try {
          final amp = await _recorder.getAmplitude();
          final currentDb = amp.current.clamp(-80.0, 0.0);
          if (mounted) {
            setState(() {
              _currentDb = currentDb;
            });
          }

          // Adaptive background noise floor
          if (currentDb > -70.0 && currentDb < -25.0) {
            _ambientDb = (_ambientDb * 0.95) + (currentDb * 0.05);
          }

          final delta = currentDb - _ambientDb;
          final isLoud = currentDb >= _sensitivityThreshold;
          final isSpike = delta >= 16.0;
          final cooldownOk =
              DateTime.now().difference(_lastTriggerTime) > const Duration(milliseconds: 2000);

          if (isLoud && isSpike && cooldownOk) {
            _triggerAlert(currentDb);
          }
        } catch (_) {}
      });

      setState(() {
        _isServiceRunning = true;
      });
    } catch (e) {
      debugPrint('[Detector] Error starting audio stream: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Audio engine error: $e'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }

  Future<void> _stopListening() async {
    _amplitudeTimer?.cancel();
    _amplitudeTimer = null;
    try {
      await _recorder.stop();
    } catch (_) {}
    _stopAlarm();
    setState(() {
      _isServiceRunning = false;
      _currentDb = -60.0;
    });
  }

  Future<void> _triggerAlert(double detectedDb) async {
    if (_isAlerting) return;
    _lastTriggerTime = DateTime.now();
    setState(() {
      _isAlerting = true;
    });

    // 1. Play loop siren alarm at maximum volume
    if (_enableSiren) {
      try {
        await _audioPlayer.setReleaseMode(ReleaseMode.loop);
        await _audioPlayer.setVolume(1.0);
        await _audioPlayer.play(AssetSource('sounds/alarm_siren.mp3'));
      } catch (e) {
        debugPrint('[Alert] Siren error: $e');
      }
    }

    // 2. Continuous repeating haptic vibration pattern
    if (_enableVibration) {
      try {
        final hasVib = await Vibration.hasVibrator();
        if (hasVib == true) {
          Vibration.vibrate(
            pattern: [500, 250, 500, 250, 750, 250],
            intensities: [128, 255, 128, 255, 255, 255],
            repeat: 0,
          );
        }
      } catch (e) {
        debugPrint('[Alert] Vibration error: $e');
      }
    }

    // 3. High frequency flashlight strobe (160ms cycle)
    if (_enableFlashlight) {
      try {
        _strobeTimer?.cancel();
        _strobeTimer = Timer.periodic(const Duration(milliseconds: 160), (_) async {
          if (!_isAlerting) return;
          _strobeState = !_strobeState;
          try {
            if (_strobeState) {
              await TorchLight.enableTorch();
            } else {
              await TorchLight.disableTorch();
            }
          } catch (_) {}
        });
      } catch (e) {
        debugPrint('[Alert] Torch error: $e');
      }
    }
  }

  void _stopAlarm() {
    _strobeTimer?.cancel();
    _strobeTimer = null;
    try {
      TorchLight.disableTorch();
    } catch (_) {}
    try {
      Vibration.cancel();
    } catch (_) {}
    try {
      _audioPlayer.stop();
    } catch (_) {}
    setState(() {
      _isAlerting = false;
    });
  }

  void _simulateClap() {
    _triggerAlert(-8.5);
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
                // Top status bar
                _buildSystemStatusBanner(),

                const Spacer(flex: 1),

                // Center radar action button
                _buildMainRadarButton(),

                const SizedBox(height: 24),

                // Acoustic live energy meter
                _buildAcousticMeter(),

                const Spacer(flex: 2),

                // Sensitivity & Response settings card
                _buildControlsCard(),

                const SizedBox(height: 16),
              ],
            ),

            // Fullscreen active alarm alert banner overlay
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
              // Radiating Radar Rings (when active)
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

              // Central interactive disc
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
    // Normalize dBFS (-60 to 0) to 0.0 - 1.0 progress
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
                _isServiceRunning ? '${_currentDb.toStringAsFixed(1)} dBFS' : '-- dBFS',
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
              // Energy Bar
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
              // Sensitivity Marker
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
                '${_sensitivityThreshold.toStringAsFixed(0)} dB',
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
              SharedPreferences.getInstance().then((prefs) {
                prefs.setDouble('sensitivity_threshold_db', val);
              });
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
}
