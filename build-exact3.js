const fs = require('fs');

// Đọc metadata từ file gốc
const originalContent = fs.readFileSync('./King-Translator-AI.user.js', 'utf8');
const metadataMatch = originalContent.match(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/);
const metadata = metadataMatch ? metadataMatch[0] : '';

console.log('Building exact replica from src/...\n');

// Thứ tự chính xác như file gốc
const modules = [
  'src/config/config.js',
  'src/config/defaults.js',
  'src/core/mobile.js',
  'src/utils/storage.js',
  'src/utils/dom.js',
  'src/core/settings.js',
  'src/api/key-manager.js',
  'src/api/manager.js',
  'src/features/input.js',
  'src/features/ocr.js',
  'src/features/media.js',
  'src/features/video-streaming.js',
  'src/features/page.js',
  'src/core/cache.js',
  'src/features/file/uploader.js',
  'src/features/file/processor.js',
  'src/features/file/manager.js',
  'src/ui/root.js',
  'src/ui/manager.js',
  'src/translator.js',
  'src/utils/debounce.js',
  'src/main.js'
];

// Wrapper opening (lines 45-51 from original)
const wrapperStart = `(function() {
  "use strict";
  if (window.kingTranslatorInitialized) {
    console.log("King Translator: Already initialized, skipping this execution.");
    return;
  }
  window.kingTranslatorInitialized = true;
`;

// Đọc và concatenate modules
let combinedCode = '';
for (const modulePath of modules) {
  const content = fs.readFileSync(modulePath, 'utf8');
  combinedCode += content;
}

// Wrapper closing
const wrapperEnd = '})();\n';

// Kết hợp: metadata + wrapper_start + code + wrapper_end
const finalCode = `${metadata}\n${wrapperStart}${combinedCode}${wrapperEnd}`;

// Ghi output với LF line endings
fs.mkdirSync('./dist', { recursive: true });
fs.writeFileSync('./dist/King-Translator-AI-rebuilt.user.js', finalCode.replace(/\r\n/g, '\n'), 'utf8');

console.log('Build completed!');
console.log(`Output: dist/King-Translator-AI-rebuilt.user.js`);
console.log(`Size: ${finalCode.length.toLocaleString()} bytes`);
console.log(`Lines: ${finalCode.split('\n').length.toLocaleString()}`);
console.log('\nRun "node compare-output.js" to verify!');
