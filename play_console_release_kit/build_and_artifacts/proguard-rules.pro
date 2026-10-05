# Flutter ProGuard / R8 Rules for Release Optimization

# Keep Flutter engine & framework bindings
-keep class io.flutter.app.** { *; }
-keep class io.flutter.plugin.**  { *; }
-keep class io.flutter.util.**  { *; }
-keep class io.flutter.view.**  { *; }
-keep class io.flutter.** { *; }
-keep class io.flutter.plugins.** { *; }

# Keep background service & isolate entry points
-keep class id.flutter.flutter_background_service.** { *; }
-keepattributes *Annotation*
-keepclassmembers class * {
    @com.google.android.gms.common.annotation.KeepName *;
}
-keepnames class * {
    @com.google.android.gms.common.annotation.KeepName *;
}

# Audioplayers and record audio codecs
-dontwarn com.ryanheise.audioservice.**
-keep class com.ryanheise.audioservice.** { *; }

# Ignore standard missing reference warnings in release mode
-dontwarn javax.annotation.**
-dontwarn org.conscrypt.**
-dontwarn okio.**
