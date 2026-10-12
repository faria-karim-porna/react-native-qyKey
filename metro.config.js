const { getDefaultConfig } = require('@expo/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 */
const config = getDefaultConfig(__dirname);

// Compile .svg files into react-native-svg components at bundle time
// (react-native-svg-transformer). SVGs then render synchronously as real
// components instead of being fetched + parsed at runtime via SvgUri.
config.transformer.babelTransformerPath = require.resolve('react-native-svg-transformer');
config.resolver.assetExts = config.resolver.assetExts.filter((ext) => ext !== 'svg');
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg'];

module.exports = config;
