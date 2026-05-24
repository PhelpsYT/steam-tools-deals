const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Disable Watchman - it's flaky on Windows.
config.watcher = {
  watchman: { enabled: false },
};

module.exports = config;
