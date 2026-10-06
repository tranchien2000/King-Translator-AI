#!/usr/bin/env python3
import os

# Đọc file nguồn
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

# Metadata (lines 1-44)
metadata = ''.join(lines[0:44])

# Boundaries từ grep output (0-indexed, inclusive start, exclusive end)
splits = {
    'CONFIG': (51, 1920),  # line 52-1920
    'DEFAULT_SETTINGS': (1920, 2149),  # line 1921-2149
    'MobileOptimizer': (2149, 2256),  # line 2150-2256
    'storage_utils': (2256, 2279),  # line 2257-2279
    'dom_utils': (2278, 2308),  # line 2279-2308
    'UserSettings': (2307, 4233),  # line 2308-4233
    'APIKeyManager': (4232, 4439),  # line 4233-4439
    'APIManager': (4438, 4695),  # line 4439-4695
    'InputTranslator': (4694, 5329),  # line 4695-5329
    'OCRManager': (5328, 5823),  # line 5329-5823
    'MediaManager': (5822, 5953),  # line 5823-5953
    'VideoStreamingTranslator': (5952, 6927),  # line 5953-6927
    'PageTranslator': (6926, 7950),  # line 6927-7950
    'PersistentCache': (7949, 8082),  # line 7950-8082
    'FileUploader': (8081, 8165),  # line 8082-8165
    'FileProcessor': (8164, 8312),  # line 8165-8312
    'FileManager': (8311, 8510),  # line 8312-8510
    'UIRoot': (8509, 9087),  # line 8510-9087
    'UIManager': (9086, 13660),  # line 9087-13660
    'Translator': (13659, 14028),  # line 13660-14028
    'debounce': (14027, 14045),  # line 14028-14045
    'init': (14044, 14584),  # line 14045-end (initializeTranslator + listeners)
}

# Extract theo thứ tự
def write_module(name, start, end, path):
    content = ''.join(lines[start:end]).strip()
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content + '\n')
    print(f"OK {path} (lines {start+1}-{end})")

# 1. CONFIG
write_module('CONFIG', splits['CONFIG'][0], splits['CONFIG'][1], 'src2/config/config.js')

# 2. DEFAULT_SETTINGS
write_module('DEFAULT_SETTINGS', splits['DEFAULT_SETTINGS'][0], splits['DEFAULT_SETTINGS'][1], 'src2/config/defaults.js')

# 3. MobileOptimizer
write_module('MobileOptimizer', splits['MobileOptimizer'][0], splits['MobileOptimizer'][1], 'src2/core/mobile.js')

# 4. Storage utils
write_module('storage_utils', splits['storage_utils'][0], splits['storage_utils'][1], 'src2/utils/storage.js')

# 5. DOM utils
write_module('dom_utils', splits['dom_utils'][0], splits['dom_utils'][1], 'src2/utils/dom.js')

# 6. UserSettings
write_module('UserSettings', splits['UserSettings'][0], splits['UserSettings'][1], 'src2/core/settings.js')

# 7. APIKeyManager
write_module('APIKeyManager', splits['APIKeyManager'][0], splits['APIKeyManager'][1], 'src2/api/key-manager.js')

# 8. APIManager
write_module('APIManager', splits['APIManager'][0], splits['APIManager'][1], 'src2/api/manager.js')

# 9. InputTranslator
write_module('InputTranslator', splits['InputTranslator'][0], splits['InputTranslator'][1], 'src2/features/input.js')

# 10. OCRManager
write_module('OCRManager', splits['OCRManager'][0], splits['OCRManager'][1], 'src2/features/ocr.js')

# 11. MediaManager
write_module('MediaManager', splits['MediaManager'][0], splits['MediaManager'][1], 'src2/features/media.js')

# 12. VideoStreamingTranslator
write_module('VideoStreamingTranslator', splits['VideoStreamingTranslator'][0], splits['VideoStreamingTranslator'][1], 'src2/features/video-streaming.js')

# 13. PageTranslator
write_module('PageTranslator', splits['PageTranslator'][0], splits['PageTranslator'][1], 'src2/features/page.js')

# 14. PersistentCache
write_module('PersistentCache', splits['PersistentCache'][0], splits['PersistentCache'][1], 'src2/core/cache.js')

# 15. FileUploader
write_module('FileUploader', splits['FileUploader'][0], splits['FileUploader'][1], 'src2/features/file/uploader.js')

# 16. FileProcessor
write_module('FileProcessor', splits['FileProcessor'][0], splits['FileProcessor'][1], 'src2/features/file/processor.js')

# 17. FileManager
write_module('FileManager', splits['FileManager'][0], splits['FileManager'][1], 'src2/features/file/manager.js')

# 18. UIRoot
write_module('UIRoot', splits['UIRoot'][0], splits['UIRoot'][1], 'src2/ui/root.js')

# 19. UIManager
write_module('UIManager', splits['UIManager'][0], splits['UIManager'][1], 'src2/ui/manager.js')

# 20. Translator
write_module('Translator', splits['Translator'][0], splits['Translator'][1], 'src2/translator.js')

# 21. debounce
write_module('debounce', splits['debounce'][0], splits['debounce'][1], 'src2/utils/debounce.js')

# 22. Init code
write_module('init', splits['init'][0], splits['init'][1], 'src2/main.js')

print("\nRe-split complete! Files in src2/")
