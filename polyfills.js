import 'fast-text-encoding';
import 'react-native-get-random-values';
import '@ethersproject/shims';
import { Buffer } from 'buffer';

global.Buffer = global.Buffer || Buffer;

// jose/Privy might need a basic crypto object for some check,
// but react-native-get-random-values already polyfills crypto.getRandomValues
// if it exists. Let's ensure it's at least an object.
if (typeof global.crypto !== 'object') {
  global.crypto = {};
}
