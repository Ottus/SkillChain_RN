const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// The 'jose' library used by Privy expects a standard Web Crypto API.
// In Expo 53+, Metro's Package Exports feature might pick up the Node.js 
// entry point for 'jose', which causes bundling errors.
// Disabling it ensures Metro uses the browser/react-native compatible entry points.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
