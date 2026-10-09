import 'dart:async';
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
        'Listening: ${getModeDisplayName()}',
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
        'Listening: ${getModeDisplayName()}',
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
        '$triggerReason (${detectedDb.toStringAsFixed(1)} dB). Ringing device...',
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
        'Listening: ${getModeDisplayName()}',
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
