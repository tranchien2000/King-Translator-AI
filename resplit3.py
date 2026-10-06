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

# Direct line ranges (0-indexed start, exclusive end)
modules = [
    ('src2/config/config.js', 51, 1920),
    ('src2/config/defaults.js', 1920, 2149),
    ('src2/core/mobile.js', 2149, 2256),
    ('src2/utils/storage.js', 2256, 2278),
    ('src2/utils/dom.js', 2278, 2307),
    ('src2/core/settings.js', 2307, 4232),
    ('src2/api/key-manager.js', 4232, 4438),
    ('src2/api/manager.js', 4438, 4694),
    ('src2/features/input.js', 4694, 5328),
    ('src2/features/ocr.js', 5328, 5822),
    ('src2/features/media.js', 5822, 5952),
    ('src2/features/video-streaming.js', 5952, 6926),
    ('src2/features/page.js', 6926, 7949),
    ('src2/core/cache.js', 7949, 8081),
    ('src2/features/file/uploader.js', 8081, 8164),
    ('src2/features/file/processor.js', 8164, 8311),
    ('src2/features/file/manager.js', 8311, 8509),
    ('src2/ui/root.js', 8509, 9086),
    ('src2/ui/manager.js', 9086, 13659),
    ('src2/translator.js', 13659, 14027),
    ('src2/utils/debounce.js', 14027, 14038),
    ('src2/main.js', 14038, 14583),
]

for path, start, end in modules:
    content = ''.join(lines[start:end]).rstrip()

    with open(path, 'w', encoding='utf-8', newline='\n') as f:
        f.write(content + '\n')

    print(f"OK {path} (lines {start+1}-{end})")

print("\nRe-split complete! Files in src2/")
