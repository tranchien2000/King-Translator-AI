#!/usr/bin/env python3
import re

# Đọc file
with open('King-Translator-AI.user.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Tìm tất cả class/function declarations với line numbers
patterns = [
    (r'^  const CONFIG = \{', 'CONFIG'),
    (r'^  const DEFAULT_SETTINGS = \{', 'DEFAULT_SETTINGS'),
    (r'^  class MobileOptimizer \{', 'MobileOptimizer'),
    (r'^  function safeLocalStorageGet\(', 'safeLocalStorageGet'),
    (r'^  function safeLocalStorageSet\(', 'safeLocalStorageSet'),
    (r'^  function safeLocalStorageRemove\(', 'safeLocalStorageRemove'),
    (r'^  function createElementFromHTML\(', 'createElementFromHTML'),
    (r'^  class UserSettings \{', 'UserSettings'),
    (r'^  class APIKeyManager \{', 'APIKeyManager'),
    (r'^  class APIManager \{', 'APIManager'),
    (r'^  class InputTranslator \{', 'InputTranslator'),
    (r'^  class OCRManager \{', 'OCRManager'),
    (r'^  class MediaManager \{', 'MediaManager'),
    (r'^  class VideoStreamingTranslator \{', 'VideoStreamingTranslator'),
    (r'^  class PageTranslator \{', 'PageTranslator'),
    (r'^  class PersistentCache \{', 'PersistentCache'),
    (r'^  class FileUploader \{', 'FileUploader'),
    (r'^  class FileProcessor \{', 'FileProcessor'),
    (r'^  class FileManager \{', 'FileManager'),
    (r'^  class UIRoot \{', 'UIRoot'),
    (r'^  class UIManager \{', 'UIManager'),
    (r'^  class Translator \{', 'Translator'),
    (r'^  function debounce\(', 'debounce'),
    (r'^  async function initializeTranslator\(', 'initializeTranslator'),
]

starts = {}
for i, line in enumerate(lines):
    for pattern, name in patterns:
        if re.match(pattern, line):
            starts[name] = i
            print(f"Line {i+1}: {name}")
            break

print(f"\nTotal: {len(starts)} declarations found")
print(f"File has {len(lines)} lines")
