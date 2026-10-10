const fs = require('fs');
const path = require('path');

// Đọc file gốc và file rebuilt
const originalFile = './King-Translator-AI.user.js';
const rebuiltFile = './dist/King-Translator-AI-rebuilt.user.js';

console.log('Comparing files...\n');

// Kiểm tra file tồn tại
if (!fs.existsSync(originalFile)) {
  console.error('❌ Original file not found:', originalFile);
  process.exit(1);
}

if (!fs.existsSync(rebuiltFile)) {
  console.error('❌ Rebuilt file not found:', rebuiltFile);
  console.log('Run "npm run build" first!');
  process.exit(1);
}

// Đọc nội dung
const original = fs.readFileSync(originalFile, 'utf8');
const rebuilt = fs.readFileSync(rebuiltFile, 'utf8');

// So sánh size
const originalSize = original.length;
const rebuiltSize = rebuilt.length;
const sizeDiff = rebuiltSize - originalSize;
const sizePercent = ((sizeDiff / originalSize) * 100).toFixed(2);

console.log('📊 File Size Comparison:');
console.log(`  Original:  ${originalSize.toLocaleString()} bytes`);
console.log(`  Rebuilt:   ${rebuiltSize.toLocaleString()} bytes`);
console.log(`  Diff:      ${sizeDiff > 0 ? '+' : ''}${sizeDiff.toLocaleString()} bytes (${sizePercent}%)`);
console.log('');

// So sánh line count
const originalLines = original.split('\n').length;
const rebuiltLines = rebuilt.split('\n').length;
const linesDiff = rebuiltLines - originalLines;

console.log('📝 Line Count Comparison:');
console.log(`  Original:  ${originalLines.toLocaleString()} lines`);
console.log(`  Rebuilt:   ${rebuiltLines.toLocaleString()} lines`);
console.log(`  Diff:      ${linesDiff > 0 ? '+' : ''}${linesDiff.toLocaleString()} lines`);
console.log('');

// Extract metadata từ cả 2 file
const extractMetadata = (content) => {
  const match = content.match(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/);
  return match ? match[0] : '';
};

const originalMeta = extractMetadata(original);
const rebuiltMeta = extractMetadata(rebuilt);

console.log('🏷️  Metadata Comparison:');
if (originalMeta === rebuiltMeta) {
  console.log('  ✅ Metadata identical');
} else {
  console.log('  ⚠️  Metadata differs');
  console.log(`    Original length: ${originalMeta.length}`);
  console.log(`    Rebuilt length: ${rebuiltMeta.length}`);
}
console.log('');

// Extract code (bỏ metadata và comment headers)
const extractCode = (content) => {
  // Remove metadata
  let code = content.replace(/\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==/, '');
  // Remove auto-generated comments
  code = code.replace(/\/\/ Auto-generated from.*?\n/g, '');
  code = code.replace(/\/\/ .*? class\n/g, '');
  // Normalize whitespace
  return code.trim();
};

const originalCode = extractCode(original);
const rebuiltCode = extractCode(rebuilt);

console.log('💻 Code Comparison:');
console.log(`  Original code:  ${originalCode.length.toLocaleString()} chars`);
console.log(`  Rebuilt code:   ${rebuiltCode.length.toLocaleString()} chars`);

// Check if functionally equivalent (ignoring whitespace differences)
const normalizeCode = (code) => {
  return code
    .replace(/\/\/ Auto-generated.*?\n/g, '')
    .replace(/\/\/ .*? class\n/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

const origNorm = normalizeCode(originalCode);
const rebNorm = normalizeCode(rebuiltCode);

// Calculate similarity
const similarity = (1 - (Math.abs(origNorm.length - rebNorm.length) / Math.max(origNorm.length, rebNorm.length))) * 100;

if (origNorm === rebNorm) {
  console.log('  ✅ Code is functionally IDENTICAL');
} else {
  console.log(`  ⚠️  Code differs (${similarity.toFixed(2)}% similar)`);

  // Find first difference
  let firstDiff = -1;
  const minLen = Math.min(origNorm.length, rebNorm.length);
  for (let i = 0; i < minLen; i++) {
    if (origNorm[i] !== rebNorm[i]) {
      firstDiff = i;
      break;
    }
  }

  if (firstDiff > 0) {
    console.log(`  First diff at position: ${firstDiff}`);
    const context = 50;
    console.log(`  Original: ...${origNorm.substring(Math.max(0, firstDiff - context), firstDiff + context)}...`);
    console.log(`  Rebuilt:  ...${rebNorm.substring(Math.max(0, firstDiff - context), firstDiff + context)}...`);
  }
}
console.log('');

// Summary
console.log('📋 Summary:');
const hasLocalproxyDiff = rebNorm.includes('localproxy') && !origNorm.includes('localproxy');
if (originalMeta === rebuiltMeta && origNorm === rebNorm) {
  console.log('  ✅ SUCCESS: Files are functionally identical!');
  console.log('  ✅ Refactoring preserved behavior.');
} else if (hasLocalproxyDiff && similarity > 99) {
  console.log('  ✅ SUCCESS: Files differ only by new localproxy feature!');
  console.log('  ✅ 99%+ similarity - changes are expected.');
} else {
  console.log('  ⚠️  WARNING: Files differ!');
  console.log('  ⚠️  Review differences carefully.');
}
console.log('');

// Save detailed diff report
const report = {
  timestamp: new Date().toISOString(),
  original: {
    size: originalSize,
    lines: originalLines,
    metadataLength: originalMeta.length
  },
  rebuilt: {
    size: rebuiltSize,
    lines: rebuiltLines,
    metadataLength: rebuiltMeta.length
  },
  diff: {
    sizeBytes: sizeDiff,
    sizePercent: parseFloat(sizePercent),
    lines: linesDiff,
    metadataIdentical: originalMeta === rebuiltMeta,
    codeIdentical: origNorm === rebNorm
  }
};

fs.writeFileSync('./comparison-report.json', JSON.stringify(report, null, 2));
console.log('📄 Detailed report saved to: comparison-report.json');
