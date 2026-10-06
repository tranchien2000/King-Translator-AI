#!/usr/bin/env python3
"""
Script để tách King Translator UserScript thành modules
Dựa trên line numbers đã phân tích
"""

import os
import re

# Đọc file nguồn
with open('King-Translator-AI.user.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Tạo thư mục nếu chưa có
os.makedirs('src/config', exist_ok=True)
os.makedirs('src/i18n', exist_ok=True)
os.makedirs('src/utils', exist_ok=True)
os.makedirs('src/core', exist_ok=True)
os.makedirs('src/api', exist_ok=True)
os.makedirs('src/features/file', exist_ok=True)
os.makedirs('src/ui', exist_ok=True)

print("Starting file split...")

# 1. Extract CONFIG (lines 52-1920)
print("Extracting CONFIG...")
config_lines = lines[51:1920]  # 0-indexed
with open('src/config/config.js', 'w', encoding='utf-8') as f:
    f.write('// Auto-generated from King-Translator-AI.user.js\n')
    f.write('// CONFIG object\n\n')
    f.writelines(config_lines)
    f.write('\n\nexport default CONFIG;\n')

# 2. Extract DEFAULT_SETTINGS (lines 1921-2148)
print("Extracting DEFAULT_SETTINGS...")
defaults_lines = lines[1920:2148]
with open('src/config/defaults.js', 'w', encoding='utf-8') as f:
    f.write('// Auto-generated from King-Translator-AI.user.js\n')
    f.write('// DEFAULT_SETTINGS object\n\n')
    f.write('import CONFIG from "./config.js";\n\n')
    f.writelines(defaults_lines)
    f.write('\n\nexport default DEFAULT_SETTINGS;\n')

# 3. Extract MobileOptimizer class (lines 2150-2307)
print("Extracting MobileOptimizer...")
mobile_lines = lines[2149:2307]
with open('src/core/mobile.js', 'w', encoding='utf-8') as f:
    f.write('// Auto-generated from King-Translator-AI.user.js\n')
    f.write('// MobileOptimizer class\n\n')
    f.writelines(mobile_lines)
    f.write('\n\nexport default MobileOptimizer;\n')

# 4. Extract utility functions (lines 2257-2307)
print("Extracting utilities...")
utils_lines = lines[2256:2279]
with open('src/utils/storage.js', 'w', encoding='utf-8') as f:
    f.write('// Auto-generated from King-Translator-AI.user.js\n')
    f.write('// Storage utilities\n\n')
    f.writelines(utils_lines)
    f.write('\n\nexport { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove };\n')

# 5. createElementFromHTML
create_elem_lines = lines[2278:2280]
with open('src/utils/dom.js', 'w', encoding='utf-8') as f:
    f.write('// Auto-generated from King-Translator-AI.user.js\n')
    f.write('// DOM utilities\n\n')
    f.writelines(create_elem_lines)
    f.write('\n\nexport { createElementFromHTML };\n')

# 6. Extract UserSettings class (lines 2308-4232)
print("Extracting UserSettings...")
settings_lines = lines[2307:4232]
with open('src/core/settings.js', 'w', encoding='utf-8') as f:
    f.write('// Auto-generated from King-Translator-AI.user.js\n')
    f.write('// UserSettings class\n\n')
    f.write('import CONFIG from "../config/config.js";\n')
    f.write('import DEFAULT_SETTINGS from "../config/defaults.js";\n')
    f.write('import MobileOptimizer from "./mobile.js";\n\n')
    f.writelines(settings_lines)
    f.write('\n\nexport default UserSettings;\n')

# 7. Extract APIKeyManager (lines 4233-4438)
print("Extracting APIKeyManager...")
key_manager_lines = lines[4232:4438]
with open('src/api/key-manager.js', 'w', encoding='utf-8') as f:
    f.write('// Auto-generated from King-Translator-AI.user.js\n')
    f.write('// APIKeyManager class\n\n')
    f.writelines(key_manager_lines)
    f.write('\n\nexport default APIKeyManager;\n')

# 8. Extract APIManager (lines 4439-4694)
print("Extracting APIManager...")
api_manager_lines = lines[4438:4694]
with open('src/api/manager.js', 'w', encoding='utf-8') as f:
    f.write('// Auto-generated from King-Translator-AI.user.js\n')
    f.write('// APIManager class\n\n')
    f.write('import APIKeyManager from "./key-manager.js";\n\n')
    f.writelines(api_manager_lines)
    f.write('\n\nexport default APIManager;\n')

# 9. Extract InputTranslator (lines 4695-5328)
print("Extracting InputTranslator...")
input_lines = lines[4694:5328]
with open('src/features/input.js', 'w', encoding='utf-8') as f:
    f.write('// Auto-generated from King-Translator-AI.user.js\n')
    f.write('// InputTranslator class\n\n')
    f.writelines(input_lines)
    f.write('\n\nexport default InputTranslator;\n')

# 10. Extract OCRManager (lines 5329-5822)
print("Extracting OCRManager...")
ocr_lines = lines[5328:5822]
with open('src/features/ocr.js', 'w', encoding='utf-8') as f:
    f.write('// Auto-generated from King-Translator-AI.user.js\n')
    f.write('// OCRManager class\n\n')
    f.writelines(ocr_lines)
    f.write('\n\nexport default OCRManager;\n')

# 11. Extract MediaManager (lines 5823-5952)
print("Extracting MediaManager...")
media_lines = lines[5822:5952]
with open('src/features/media.js', 'w', encoding='utf-8') as f:
    f.write('// Auto-generated from King-Translator-AI.user.js\n')
    f.write('// MediaManager class\n\n')
    f.writelines(media_lines)
    f.write('\n\nexport default MediaManager;\n')

# 12. Extract VideoStreamingTranslator (lines 5953-6926)
print("Extracting VideoStreamingTranslator...")
video_lines = lines[5952:6926]
with open('src/features/video-streaming.js', 'w', encoding='utf-8') as f:
    f.write('// Auto-generated from King-Translator-AI.user.js\n')
    f.write('// VideoStreamingTranslator class\n\n')
    f.writelines(video_lines)
    f.write('\n\nexport default VideoStreamingTranslator;\n')

# 13. Extract PageTranslator (lines 6927-7949)
print("Extracting PageTranslator...")
page_lines = lines[6926:7949]
with open('src/features/page.js', 'w', encoding='utf-8') as f:
    f.write('// Auto-generated from King-Translator-AI.user.js\n')
    f.write('// PageTranslator class\n\n')
    f.writelines(page_lines)
    f.write('\n\nexport default PageTranslator;\n')

# 14. Extract PersistentCache (lines 7950-8081)
print("Extracting PersistentCache...")
cache_lines = lines[7949:8081]
with open('src/core/cache.js', 'w', encoding='utf-8') as f:
    f.write('// Auto-generated from King-Translator-AI.user.js\n')
    f.write('// PersistentCache class\n\n')
    f.writelines(cache_lines)
    f.write('\n\nexport default PersistentCache;\n')

# 15. Extract FileUploader (lines 8082-8164)
print("Extracting FileUploader...")
uploader_lines = lines[8081:8164]
with open('src/features/file/uploader.js', 'w', encoding='utf-8') as f:
    f.write('// Auto-generated from King-Translator-AI.user.js\n')
    f.write('// FileUploader class\n\n')
    f.writelines(uploader_lines)
    f.write('\n\nexport default FileUploader;\n')

# 16. Extract FileProcessor (lines 8165-8311)
print("Extracting FileProcessor...")
processor_lines = lines[8164:8311]
with open('src/features/file/processor.js', 'w', encoding='utf-8') as f:
    f.write('// Auto-generated from King-Translator-AI.user.js\n')
    f.write('// FileProcessor class\n\n')
    f.write('import FileUploader from "./uploader.js";\n\n')
    f.writelines(processor_lines)
    f.write('\n\nexport default FileProcessor;\n')

# 17. Extract RELIABLE_FORMATS + FileManager (lines 8298-8509)
print("Extracting RELIABLE_FORMATS + FileManager...")
formats_and_manager = lines[8297:8509]
with open('src/features/file/manager.js', 'w', encoding='utf-8') as f:
    f.write('// Auto-generated from King-Translator-AI.user.js\n')
    f.write('// RELIABLE_FORMATS + FileManager class\n\n')
    f.writelines(formats_and_manager)
    f.write('\n\nexport default FileManager;\n')

# 18. Extract UIRoot (lines 8510-9086)
print("Extracting UIRoot...")
uiroot_lines = lines[8509:9086]
with open('src/ui/root.js', 'w', encoding='utf-8') as f:
    f.write('// Auto-generated from King-Translator-AI.user.js\n')
    f.write('// UIRoot class\n\n')
    f.writelines(uiroot_lines)
    f.write('\n\nexport default UIRoot;\n')

# 19. Extract UIManager (lines 9087-13659)
print("Extracting UIManager...")
uimanager_lines = lines[9086:13659]
with open('src/ui/manager.js', 'w', encoding='utf-8') as f:
    f.write('// Auto-generated from King-Translator-AI.user.js\n')
    f.write('// UIManager class\n\n')
    f.writelines(uimanager_lines)
    f.write('\n\nexport default UIManager;\n')

# 20. Extract Translator (lines 13660-14001)
print("Extracting Translator...")
translator_lines = lines[13659:14001]
with open('src/translator.js', 'w', encoding='utf-8') as f:
    f.write('// Auto-generated from King-Translator-AI.user.js\n')
    f.write('// Translator class (main coordinator)\n\n')
    f.write('import UserSettings from "./core/settings.js";\n')
    f.write('import PersistentCache from "./core/cache.js";\n')
    f.write('import UIRoot from "./ui/root.js";\n')
    f.write('import FileProcessor from "./features/file/processor.js";\n')
    f.write('import VideoStreamingTranslator from "./features/video-streaming.js";\n')
    f.write('import APIManager from "./api/manager.js";\n')
    f.write('import PageTranslator from "./features/page.js";\n')
    f.write('import InputTranslator from "./features/input.js";\n')
    f.write('import OCRManager from "./features/ocr.js";\n')
    f.write('import MediaManager from "./features/media.js";\n')
    f.write('import FileManager from "./features/file/manager.js";\n')
    f.write('import UIManager from "./ui/manager.js";\n')
    f.write('import CONFIG from "./config/config.js";\n\n')
    f.writelines(translator_lines)
    f.write('\n\nexport default Translator;\n')

# 21. Extract standalone functions + init (lines 14002-14582)
print("Extracting main entry point...")
main_lines = lines[14001:14583]
with open('src/main.js', 'w', encoding='utf-8') as f:
    f.write('// Auto-generated from King-Translator-AI.user.js\n')
    f.write('// Main entry point\n\n')
    f.write('import Translator from "./translator.js";\n\n')
    f.writelines(main_lines)

print("\nDone!")
print("\nCreated files:")
print("  - src/config/config.js")
print("  - src/config/defaults.js")
print("  - src/core/mobile.js")
print("  - src/core/settings.js")
print("  - src/core/cache.js")
print("  - src/utils/storage.js")
print("  - src/utils/dom.js")
print("  - src/api/key-manager.js")
print("  - src/api/manager.js")
print("  - src/features/input.js")
print("  - src/features/ocr.js")
print("  - src/features/media.js")
print("  - src/features/video-streaming.js")
print("  - src/features/page.js")
print("  - src/features/file/uploader.js")
print("  - src/features/file/processor.js")
print("  - src/features/file/manager.js")
print("  - src/ui/root.js")
print("  - src/ui/manager.js")
print("  - src/translator.js")
print("  - src/main.js")
