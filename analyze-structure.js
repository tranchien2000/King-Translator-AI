const fs = require('fs');

console.log('Analyzing King-Translator-AI.user.js structure...\n');

const content = fs.readFileSync('./King-Translator-AI.user.js', 'utf8');
const lines = content.split('\n');

// Tìm các declaration chính
const patterns = [
  { name: 'IIFE start', regex: /^\(function\(\) \{$/ },
  { name: 'use strict', regex: /^  "use strict";$/ },
  { name: 'init check', regex: /if \(window\.kingTranslatorInitialized\)/ },
  { name: 'CONFIG start', regex: /^  const CONFIG = \{$/ },
  { name: 'DEFAULT_SETTINGS', regex: /^  const DEFAULT_SETTINGS = \{/ },
  { name: 'safeLocalStorageGet', regex: /^  function safeLocalStorageGet\(/ },
  { name: 'safeLocalStorageSet', regex: /^  function safeLocalStorageSet\(/ },
  { name: 'safeLocalStorageRemove', regex: /^  function safeLocalStorageRemove\(/ },
  { name: 'createElementFromHTML', regex: /^  function createElementFromHTML\(/ },
  { name: 'PersistentCache class', regex: /^  class PersistentCache \{/ },
  { name: 'MobileOptimizer class', regex: /^  class MobileOptimizer \{/ },
  { name: 'UserSettings class', regex: /^  class UserSettings \{/ },
  { name: 'APIKeyManager class', regex: /^  class APIKeyManager \{/ },
  { name: 'APIManager class', regex: /^  class APIManager \{/ },
  { name: 'InputTranslator class', regex: /^  class InputTranslator \{/ },
  { name: 'OCRManager class', regex: /^  class OCRManager \{/ },
  { name: 'MediaManager class', regex: /^  class MediaManager \{/ },
  { name: 'VideoStreamingTranslator', regex: /^  class VideoStreamingTranslator \{/ },
  { name: 'PageTranslator class', regex: /^  class PageTranslator \{/ },
  { name: 'FileUploader class', regex: /^  class FileUploader \{/ },
  { name: 'FileProcessor class', regex: /^  class FileProcessor \{/ },
  { name: 'FileManager class', regex: /^  class FileManager \{/ },
  { name: 'UIRoot class', regex: /^  class UIRoot \{/ },
  { name: 'UIManager class', regex: /^  class UIManager \{/ },
  { name: 'Translator class', regex: /^  class Translator \{/ },
  { name: 'initializeTranslator', regex: /^  async function initializeTranslator\(/ },
  { name: 'IIFE end', regex: /^\}\)\(\);$/ }
];

const found = [];

lines.forEach((line, idx) => {
  patterns.forEach(pattern => {
    if (pattern.regex.test(line)) {
      found.push({ line: idx + 1, name: pattern.name, content: line.substring(0, 80) });
    }
  });
});

console.log('Found declarations:\n');
found.forEach(item => {
  console.log(`Line ${item.line.toString().padStart(5)}: ${item.name.padEnd(30)} ${item.content}`);
});

console.log(`\nTotal lines: ${lines.length}`);
