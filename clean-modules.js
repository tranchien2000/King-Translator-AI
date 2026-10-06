const fs = require('fs');
const path = require('path');

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

console.log('Cleaning all modules...\n');

modules.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skip: ${filePath} (not found)`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const originalSize = content.length;

  // Remove auto-generated comments
  content = content.replace(/^\/\/ Auto-generated from.*$/gm, '');
  content = content.replace(/^\/\/ .*? (object|class|utilities|functions)$/gm, '');

  // Remove leading indentation (2 spaces) from first line if const/class/function
  content = content.replace(/^  (const|class|function|async function)/gm, '$1');

  // Remove export statements
  content = content.replace(/^export default .*;?\s*$/gm, '');
  content = content.replace(/^export \{ [^}]+ \};?\s*$/gm, '');
  content = content.replace(/^export (const|let|var|class|function|async function) /gm, '$1 ');

  // Remove excessive blank lines (max 2 consecutive)
  content = content.replace(/\n{3,}/g, '\n\n');

  // Trim trailing whitespace
  content = content.trim() + '\n';

  fs.writeFileSync(filePath, content, 'utf8');

  const saved = originalSize - content.length;
  console.log(`✅ ${filePath} (${saved > 0 ? '-' : ''}${Math.abs(saved)} bytes)`);
});

console.log('\n✅ All modules cleaned!');
console.log('Run "node build-exact.js" to rebuild.');
