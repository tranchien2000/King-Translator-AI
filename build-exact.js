const fs = require('fs');
const path = require('path');

// Đọc metadata từ file gốc
const originalContent = fs.readFileSync('./King-Translator-AI.user.js', 'utf8');
const metadataMatch = originalContent.match(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/);
const metadata = metadataMatch ? metadataMatch[0] : '';

console.log('Building exact replica without webpack...\n');

// Thứ tự modules chính xác như file gốc
const modules = [
  'src/config/config.js',
  'src/config/defaults.js',
  'src/utils/storage.js',
  'src/utils/dom.js',
  'src/core/cache.js',
  'src/core/mobile.js',
  'src/core/settings.js',
  'src/api/key-manager.js',
  'src/api/manager.js',
  'src/features/input.js',
  'src/features/ocr.js',
  'src/features/media.js',
  'src/features/video-streaming.js',
  'src/features/page.js',
  'src/features/file/uploader.js',
  'src/features/file/processor.js',
  'src/features/file/manager.js',
  'src/ui/root.js',
  'src/ui/manager.js',
  'src/translator.js',
  'src/main.js'
];

// Đọc và concatenate tất cả modules
let combinedCode = '';

for (const modulePath of modules) {
  if (!fs.existsSync(modulePath)) {
    console.error(`❌ Module not found: ${modulePath}`);
    process.exit(1);
  }

  let moduleCode = fs.readFileSync(modulePath, 'utf8');

  // Loại bỏ import/export statements và auto-generated comments
  moduleCode = moduleCode
    .replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '')
    .replace(/^export\s+default\s+/gm, '')
    .replace(/^export\s+\{[^}]*\};?\s*$/gm, '')
    .replace(/^export\s+(const|let|var|class|function)\s+/gm, '$1 ')
    .replace(/^\/\/ Auto-generated from.*$/gm, '')
    .replace(/^\/\/ .*? (object|class)$/gm, '')
    .trim();

  combinedCode += moduleCode + '\n\n';
}

// Thêm initialization guard và IIFE wrapper như file gốc
const initCheck = `  if (window.kingTranslatorInitialized) {
    console.log("King Translator: Already initialized, skipping this execution.");
    return;
  }
  window.kingTranslatorInitialized = true;
`;

const wrappedCode = `(function() {
  "use strict";
${initCheck}
${combinedCode}
})();`;

// Kết hợp metadata + code
const finalCode = `${metadata}\n${wrappedCode}`;

// Ghi file output
const outputPath = './dist/King-Translator-AI-rebuilt.user.js';
fs.mkdirSync('./dist', { recursive: true });
fs.writeFileSync(outputPath, finalCode, 'utf8');

console.log('✅ Build completed!');
console.log(`📄 Output: ${outputPath}`);
console.log(`📊 Size: ${finalCode.length.toLocaleString()} bytes`);
console.log(`📝 Lines: ${finalCode.split('\n').length.toLocaleString()}`);
console.log('\nRun "node compare-output.js" to verify!');
