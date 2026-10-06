const fs = require('fs');

// Đọc metadata từ file gốc
const originalContent = fs.readFileSync('./King-Translator-AI.user.js', 'utf8');
const metadataMatch = originalContent.match(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/);
const metadata = metadataMatch ? metadataMatch[0] : '';

console.log('Building exact replica from src2/...\n');

// Thứ tự chính xác như file gốc
const modules = [
  'src2/config/config.js',
  'src2/config/defaults.js',
  'src2/core/mobile.js',
  'src2/utils/storage.js',
  'src2/utils/dom.js',
  'src2/core/settings.js',
  'src2/api/key-manager.js',
  'src2/api/manager.js',
  'src2/features/input.js',
  'src2/features/ocr.js',
  'src2/features/media.js',
  'src2/features/video-streaming.js',
  'src2/features/page.js',
  'src2/core/cache.js',
  'src2/features/file/uploader.js',
  'src2/features/file/processor.js',
  'src2/features/file/manager.js',
  'src2/ui/root.js',
  'src2/ui/manager.js',
  'src2/translator.js',
  'src2/utils/debounce.js',
  'src2/main.js'
];

// Đọc và concatenate (không thêm extra newline)
let combinedCode = '';
for (const modulePath of modules) {
  const content = fs.readFileSync(modulePath, 'utf8');
  combinedCode += content;  // No extra \n
}

// Thêm IIFE wrapper và init guard như file gốc
const wrappedCode = `(function() {
  "use strict";
  if (window.kingTranslatorInitialized) {
    console.log("King Translator: Already initialized, skipping this execution.");
    return;
  }
  window.kingTranslatorInitialized = true;
${combinedCode}})();
`;

// Kết hợp metadata + code
const finalCode = `${metadata}\n${wrappedCode}`;

// Ghi output với LF line endings
fs.mkdirSync('./dist', { recursive: true });
fs.writeFileSync('./dist/King-Translator-AI-rebuilt.user.js', finalCode.replace(/\r\n/g, '\n'), 'utf8');

console.log('Build completed!');
console.log(`Output: dist/King-Translator-AI-rebuilt.user.js`);
console.log(`Size: ${finalCode.length.toLocaleString()} bytes`);
console.log(`Lines: ${finalCode.split('\n').length.toLocaleString()}`);
console.log('\nRun "node compare-output.js" to verify!');
