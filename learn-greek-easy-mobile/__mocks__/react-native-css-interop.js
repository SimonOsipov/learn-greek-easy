// Manual mock for react-native-css-interop — used by jest tests.
// The babel plugin injects:
//   const _ReactNativeCSSInterop = require('react-native-css-interop')
//   and replaces React.createElement with _ReactNativeCSSInterop.createInteropElement
// We must provide createInteropElement as a passthrough so rendering works.
const React = require('react');

module.exports = {
  cssInterop: () => {},
  remapProps: () => {},
  createInteropElement: React.createElement.bind(React),
  StyleSheet: { create: (s) => s },
};
