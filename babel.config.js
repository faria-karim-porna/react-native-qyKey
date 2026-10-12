// Babel configuration — used by both the main Expo app bundle and the
// keyboard bundle (src/app/mainKeyboard → keyboard.bundle).
//
// react-native-reanimated 4 splits its babel transform into the
// react-native-worklets plugin, which is required for the circuit's
// UI-thread animations (useSharedValue / useAnimatedProps) to run.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-worklets/plugin'],
  };
};
