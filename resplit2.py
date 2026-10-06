#!/usr/bin/env python3
import os

# Đọc file
with open('King-Translator-AI.user.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Tạo thư mục
os.makedirs('src2/config', exist_ok=True)
os.makedirs('src2/utils', exist_ok=True)
os.makedirs('src2/core', exist_ok=True)
os.makedirs('src2/api', exist_ok=True)
os.makedirs('src2/features/file', exist_ok=True)
os.makedirs('src2/ui', exist_ok=True)

print("Re-splitting with exact boundaries...\n")

# Exact start lines (0-indexed)
boundaries = [
    51,    # CONFIG
    1920,  # DEFAULT_SETTINGS
    2149,  # MobileOptimizer
    2256,  # safeLocalStorageGet
    2264,  # safeLocalStorageSet
    2271,  # safeLocalStorageRemove
    2278,  # createElementFromHTML
    2307,  # UserSettings
    4232,  # APIKeyManager
    4438,  # APIManager
    4694,  # InputTranslator
    5328,  # OCRManager
    5822,  # MediaManager
    5952,  # VideoStreamingTranslator
    6926,  # PageTranslator
    7949,  # PersistentCache
    8081,  # FileUploader
    8164,  # FileProcessor
    8311,  # FileManager
    8509,  # UIRoot
    9086,  # UIManager
    13659, # Translator
    14027, # debounce
    # main.js starts at line 14045 (index 14044), not 14585
]

modules = [
    ('src2/config/config.js', 0, 1),
    ('src2/config/defaults.js', 1, 2),
    ('src2/core/mobile.js', 2, 3),
    ('src2/utils/storage.js', 3, 6),  # all 3 storage functions together
    ('src2/utils/dom.js', 6, 7),
    ('src2/core/settings.js', 7, 8),
    ('src2/api/key-manager.js', 8, 9),
    ('src2/api/manager.js', 9, 10),
    ('src2/features/input.js', 10, 11),
    ('src2/features/ocr.js', 11, 12),
    ('src2/features/media.js', 12, 13),
    ('src2/features/video-streaming.js', 13, 14),
    ('src2/features/page.js', 14, 15),
    ('src2/core/cache.js', 15, 16),
    ('src2/features/file/uploader.js', 16, 17),
    ('src2/features/file/processor.js', 17, 18),
    ('src2/features/file/manager.js', 18, 19),
    ('src2/ui/root.js', 19, 20),
    ('src2/ui/manager.js', 20, 21),
    ('src2/translator.js', 21, 22),
    ('src2/utils/debounce.js', 22, 23),
    ('src2/main.js', 23, 14583),  # from line 14038 to 14583 (before closing })();)
]

for path, start_idx, end_idx in modules:
    # Special case for main.js: end_idx is absolute line number
    if isinstance(end_idx, int) and end_idx > 1000:
        start = boundaries[start_idx]
        end = end_idx
    else:
        start = boundaries[start_idx]
        end = boundaries[end_idx]

    content = ''.join(lines[start:end]).rstrip()

    with open(path, 'w', encoding='utf-8', newline='\n') as f:  # Force LF
        f.write(content + '\n')

    print(f"OK {path} (lines {start+1}-{end})")

print("\nRe-split complete! Files in src2/")
