#!/usr/bin/env node
/**
 * Removes the stale `import com.facebook.react.bridge.JavaScriptModule;` line
 * from @supersami/rn-foreground-service's ForegroundServicePackage.java.
 *
 * JavaScriptModule was removed from the React Native bridge in RN 0.65.
 * The import is unused in the class, so removing it is safe.
 * This script runs as a postinstall hook so it applies on every `npm install`,
 * including the one EAS Build runs before compiling.
 */

const fs = require('fs');
const path = require('path');

const target = path.join(
  __dirname,
  '..',
  'node_modules',
  '@supersami',
  'rn-foreground-service',
  'android',
  'src',
  'main',
  'java',
  'com',
  'supersami',
  'foregroundservice',
  'ForegroundServicePackage.java'
);

if (!fs.existsSync(target)) {
  console.log('[patch-foreground-service] File not found, skipping:', target);
  process.exit(0);
}

const original = fs.readFileSync(target, 'utf8');
const patched = original.replace(
  /^import com\.facebook\.react\.bridge\.JavaScriptModule;\n?/m,
  ''
);

if (original === patched) {
  console.log('[patch-foreground-service] Already patched, nothing to do.');
} else {
  fs.writeFileSync(target, patched, 'utf8');
  console.log('[patch-foreground-service] Removed JavaScriptModule import from ForegroundServicePackage.java');
}
