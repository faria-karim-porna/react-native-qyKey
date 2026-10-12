# ── QyKey Custom Classes ──────────────────────────────────────────────────
# These classes are added programmatically to the ReactHost/ReactPackage list,
# so R8 must be told to keep them explicitly.
-keep class com.qykey.** { *; }

# ── React Native + Expo (broad catch-all) ────────────────────────────────────
# Ensure no React Native or Expo runtime classes are stripped during minification.
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class expo.modules.** { *; }

# ── Keep annotations & debug info ────────────────────────────────────────────
-keepattributes *Annotation*
-keepattributes SourceFile,LineNumberTable
