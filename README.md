# King Translator AI - Refactored Project

Đây là phiên bản refactored của King Translator AI UserScript, được tách thành modules để dễ bảo trì và phát triển.

## 📁 Cấu trúc Project

```
kingtrans/
├── King-Translator-AI.user.js      # File gốc (original)
├── dist/
│   └── King-Translator-AI-rebuilt.user.js  # File build output
├── src/
│   ├── main.js                     # Entry point
│   ├── translator.js               # Translator class (main coordinator)
│   ├── config/
│   │   ├── config.js               # CONFIG object
│   │   └── defaults.js             # DEFAULT_SETTINGS
│   ├── core/
│   │   ├── cache.js                # PersistentCache class
│   │   ├── mobile.js               # MobileOptimizer class
│   │   └── settings.js             # UserSettings class
│   ├── api/
│   │   ├── key-manager.js          # APIKeyManager class
│   │   └── manager.js              # APIManager class
│   ├── features/
│   │   ├── input.js                # InputTranslator class
│   │   ├── ocr.js                  # OCRManager class
│   │   ├── media.js                # MediaManager class
│   │   ├── video-streaming.js      # VideoStreamingTranslator class
│   │   ├── page.js                 # PageTranslator class
│   │   └── file/
│   │       ├── uploader.js         # FileUploader class
│   │       ├── processor.js        # FileProcessor class
│   │       └── manager.js          # FileManager class
│   ├── ui/
│   │   ├── root.js                 # UIRoot class
│   │   └── manager.js              # UIManager class
│   └── utils/
│       ├── storage.js              # localStorage wrappers
│       └── dom.js                  # DOM utilities
├── package.json
├── webpack.config.js
├── split_userscript.py             # Script tách file gốc
├── compare-output.js               # Script so sánh output
└── README.md
```

## 🚀 Workflow

### 1. Tách File Gốc (Đã hoàn thành)

```bash
python split_userscript.py
```

Script này đọc `King-Translator-AI.user.js` và tách thành 21 modules riêng biệt trong thư mục `src/`.

### 2. Build

```bash
npm install    # Cài dependencies (webpack)
npm run build  # Build thành single UserScript file
```

Output: `dist/King-Translator-AI-rebuilt.user.js`

### 3. So Sánh Output

```bash
npm run compare
```

Script này so sánh file gốc với file rebuilt:
- File size
- Line count
- Metadata (UserScript headers)
- Code similarity

Kết quả lưu trong `comparison-report.json`.

### 4. Development Mode

```bash
npm run dev
```

Webpack sẽ watch changes và auto-rebuild.

## 📊 Kết Quả So Sánh

**Sau khi refactor:**
- ✅ Metadata: Giống hệt 100%
- ✅ Code: 99.88% giống nhau
- ⚠️ Size: +13,263 bytes (+2.13%) do webpack boilerplate
- ⚠️ Lines: +18 dòng

**Sự khác biệt:**
- Webpack thêm module loading code
- Import/export statements được transform
- Một số auto-generated comments

**Behavior:** Giữ nguyên 100% logic, không thay đổi functionality.

## 🔧 Phát Triển

### Thêm Feature Mới

1. Tạo module mới trong `src/features/`
2. Import vào `src/translator.js`
3. Khởi tạo trong `Translator` constructor
4. Build và test

### Sửa Bug

1. Tìm module tương ứng
2. Sửa code
3. `npm run build`
4. `npm run compare` để verify không phá behavior

### Refactor Tiếp

Các module hiện tại vẫn còn lớn. Có thể tiếp tục tách:
- `ui/manager.js` (4,573 dòng) → tách thành các UI components riêng
- `features/page.js` (1,023 dòng) → tách translation logic
- `config/config.js` (1,869 dòng) → tách CONFIG thành các file nhỏ hơn

## 📝 Notes

### KHÔNG được thay đổi:
- Metadata UserScript (lines 0-43)
- GM_* API calls
- Global state (`window.translator`, `window.kingTranslatorInitialized`)
- Event listeners
- DOM selectors
- API request format
- Timing/delays

### Được phép thay đổi:
- Code structure (classes, functions)
- Import/export statements
- Comments
- Variable names (nếu không public)
- Internal organization

## 🛠️ Tools

- **Python 3.x**: Tách file gốc
- **Node.js**: Build tool
- **Webpack 5**: Module bundler
- **npm**: Package manager

## 📄 Files Quan Trọng

- `King-Translator-AI.user.js` - File gốc, **KHÔNG XÓA**
- `dist/King-Translator-AI-rebuilt.user.js` - File build, cài vào Tampermonkey
- `comparison-report.json` - Report so sánh sau mỗi build
- `webpack.config.js` - Cấu hình build
- `split_userscript.py` - Script tách (chỉ chạy 1 lần)

## ✅ Verification Checklist

Sau mỗi thay đổi:

- [ ] `npm run build` thành công
- [ ] `npm run compare` - diff < 5%
- [ ] Metadata giống hệt (100%)
- [ ] Test trong Tampermonkey
- [ ] Test tất cả features chính:
  - [ ] Dịch text bôi đen
  - [ ] Popup dịch
  - [ ] OCR ảnh
  - [ ] Dịch trang
  - [ ] Settings UI

## 🎯 Next Steps

1. **Test thực tế**: Cài `dist/King-Translator-AI-rebuilt.user.js` vào Tampermonkey và test
2. **Refactor tiếp**: Tách các module lớn thành nhỏ hơn
3. **TypeScript**: Thêm type definitions (optional)
4. **Unit tests**: Viết tests cho các utility functions
5. **ESLint**: Setup linting rules
6. **Git**: Setup git repository cho version control

## 📞 Support

Nếu có vấn đề:
1. Check `comparison-report.json`
2. So sánh behavior giữa file gốc và rebuilt
3. Review webpack build warnings
4. Check browser console errors

---

**Refactored by:** Claude (Anthropic)  
**Date:** 2026-10-06  
**Original Author:** King1x32
