# King Translator AI - Improvement Plan

## 📊 Current State Analysis

### ✅ Strengths
- Modular codebase (src2/)
- Multi-provider support (Gemini, Claude, OpenAI, etc.)
- Rich features: OCR, video streaming, page translation, media
- Local proxy architecture
- 99%+ build accuracy

### ⚠️ Issues Found
- Debug logs everywhere (`console.log('[King_DEBUG]')` - 40+ instances)
- No error tracking/analytics
- No performance monitoring
- Hardcoded strings (không i18n đầy đủ)
- No tests
- No CI/CD

---

## 🎯 Improvement Priorities

### 🔴 Priority 1: Production Ready (1-2 days)

#### 1.1 Remove Debug Logs
**Problem:** 40+ debug logs trong video-streaming.js, còn nhiều files khác
```javascript
console.log('[King_DEBUG] ...')  // ❌ Không nên có trong production
```

**Solution:**
```javascript
// Add debug utility
const DEBUG = false; // Toggle via settings
const log = (...args) => DEBUG && console.log('[KingTranslator]', ...args);
```

**Impact:** Giảm noise console, tăng performance

---

#### 1.2 Error Handling & Logging
**Problem:** Errors không được track centralized

**Solution:**
```javascript
// src2/utils/error-tracker.js
class ErrorTracker {
  static report(error, context) {
    // Log locally
    console.error('[KingTranslator Error]', {error, context, timestamp: Date.now()});
    
    // Optional: Send to server for analytics
    if (CONFIG.ERROR_REPORTING_ENABLED) {
      // Send to Sentry, LogRocket, etc
    }
  }
}
```

**Benefits:**
- Debug issues từ user reports
- Track error rates
- Monitor API failures

---

#### 1.3 Performance Monitoring
**Problem:** Không biết feature nào chậm

**Solution:**
```javascript
// src2/utils/performance.js
class PerformanceMonitor {
  static measure(name, fn) {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    
    if (duration > 1000) {
      console.warn(`[Slow] ${name}: ${duration}ms`);
    }
    return result;
  }
}

// Usage
const result = await PerformanceMonitor.measure('translatePage', () => 
  translator.page.translatePage()
);
```

---

### 🟡 Priority 2: Developer Experience (2-3 days)

#### 2.1 Add Tests
**Files to test:**
- `src2/api/manager.js` - API routing
- `src2/core/cache.js` - Cache logic
- `src2/utils/*.js` - Utilities

**Framework:** Jest or Vitest

```javascript
// tests/api/manager.test.js
describe('APIManager', () => {
  it('should route to correct provider', () => {
    const manager = new APIManager(config, getSettings, _);
    expect(manager.currentProvider).toBe('localproxy');
  });
});
```

---

#### 2.2 TypeScript (Optional)
**Benefits:**
- Catch bugs at compile time
- Better IDE autocomplete
- Self-documenting code

**Effort:** High (2-3 weeks)
**Value:** Medium (chỉ nếu team >3 người)

---

#### 2.3 Hot Reload for Development
**Problem:** Phải reload extension mỗi lần edit

**Solution:**
```javascript
// dev-server.js
const fs = require('fs');
fs.watch('src2/', () => {
  console.log('Changes detected, rebuilding...');
  require('child_process').execSync('npm run build');
});
```

---

### 🟢 Priority 3: Features & UX (3-5 days)

#### 3.1 Offline Mode
**Feature:** Cache translations để dùng offline

```javascript
// IndexedDB storage
class OfflineCache {
  async set(text, translation) {
    await db.translations.put({text, translation, timestamp: Date.now()});
  }
  
  async get(text) {
    const cached = await db.translations.get(text);
    if (cached && Date.now() - cached.timestamp < 30 * 86400000) {
      return cached.translation;
    }
    return null;
  }
}
```

---

#### 3.2 Batch Translation
**Problem:** Dịch 100 đoạn = 100 API calls

**Solution:**
```javascript
// Batch multiple texts into one request
async translateBatch(texts) {
  const prompt = texts.map((t, i) => `[${i}] ${t}`).join('\n');
  const result = await api.request(prompt);
  return result.split('\n').map(line => line.replace(/^\[\d+\]\s*/, ''));
}
```

**Savings:** 100 calls → 10 calls (10x faster, rẻ hơn)

---

#### 3.3 Translation History
**Feature:** Lưu lịch sử dịch, search lại được

```javascript
// UI: Show history panel
GM_registerMenuCommand("📜 Translation History", () => {
  showHistoryPanel();
});

// Storage
const history = [];
async function saveHistory(original, translated) {
  history.push({original, translated, timestamp: Date.now()});
  if (history.length > 1000) history.shift();
  await GM_setValue('translation_history', JSON.stringify(history));
}
```

---

#### 3.4 Smart Context Menu
**Current:** Context menu luôn hiện
**Better:** Chỉ hiện khi có text selected

```javascript
document.addEventListener('contextmenu', (e) => {
  const selectedText = window.getSelection().toString().trim();
  if (selectedText) {
    // Show custom context menu
    showCustomMenu(e.pageX, e.pageY, selectedText);
  }
});
```

---

#### 3.5 Keyboard Shortcuts Customization
**Feature:** User tự define shortcuts

```javascript
// Settings UI
<input type="text" id="shortcut-translate" 
       placeholder="e.g., Ctrl+Shift+T"
       value="${settings.shortcuts.translate}">

// Detect shortcut
document.addEventListener('keydown', (e) => {
  const key = `${e.ctrlKey?'Ctrl+':''}${e.shiftKey?'Shift+':''}${e.key}`;
  if (key === settings.shortcuts.translate) {
    translateSelection();
  }
});
```

---

### 🔵 Priority 4: Infrastructure (1 week)

#### 4.1 CI/CD Pipeline
**GitHub Actions:**

```yaml
# .github/workflows/build.yml
name: Build & Test
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm run build
      - run: npm test
      - run: npm run compare
      # Upload artifact if success
      - uses: actions/upload-artifact@v3
        with:
          name: userscript
          path: dist/King-Translator-AI-rebuilt.user.js
```

---

#### 4.2 Automated Releases
**Feature:** Auto publish to GreasyFork/GitHub

```yaml
# On tag push (v5.5)
on:
  push:
    tags:
      - 'v*'
jobs:
  release:
    - name: Create Release
      uses: actions/create-release@v1
      with:
        files: dist/*.user.js
```

---

#### 4.3 Update Checker
**Feature:** Notify user khi có version mới

```javascript
async function checkUpdate() {
  const current = GM_info.script.version;
  const latest = await fetch('https://api.github.com/repos/king1x32/King-Translator-AI/releases/latest')
    .then(r => r.json())
    .then(d => d.tag_name);
  
  if (latest > current) {
    showNotification(`New version ${latest} available!`, 'info');
  }
}
```

---

### 🟣 Priority 5: Advanced Features (2+ weeks)

#### 5.1 Multi-Language Support
**Current:** Chỉ EN/VI
**Goal:** Support 20+ languages

```javascript
// i18n structure
const LANG_DATA = {
  en: { ... },
  vi: { ... },
  zh: { ... }, // Chinese
  ja: { ... }, // Japanese
  ko: { ... }, // Korean
  es: { ... }, // Spanish
  // etc
};
```

---

#### 5.2 Plugin System
**Feature:** User có thể viết custom plugins

```javascript
// Plugin API
window.KingTranslator.registerPlugin({
  name: 'MyCustomPlugin',
  onTranslate: (text) => {
    // Custom preprocessing
    return text.toUpperCase();
  },
  onResult: (result) => {
    // Custom postprocessing
    return result + ' [Processed]';
  }
});
```

---

#### 5.3 Cloud Sync
**Feature:** Sync settings/history across devices

```javascript
// Firebase/Supabase integration
async function syncSettings() {
  const userId = GM_getValue('user_id');
  const settings = loadSettings();
  
  await firebase.database().ref(`users/${userId}/settings`).set(settings);
}
```

---

#### 5.4 AI Quality Checker
**Feature:** Verify translation quality

```javascript
async function checkQuality(original, translated) {
  const prompt = `Rate this translation 1-10:\nOriginal: ${original}\nTranslated: ${translated}`;
  const score = await api.request(prompt);
  
  if (score < 6) {
    // Retry with different model
    return await retryTranslation(original);
  }
  return translated;
}
```

---

## 📈 Implementation Roadmap

### Week 1: Production Ready
- [ ] Remove all debug logs
- [ ] Add error tracking
- [ ] Performance monitoring
- [ ] Update metadata (@connect localhost:3000)

### Week 2: Developer Experience
- [ ] Setup Jest tests
- [ ] Write core tests (10+ tests)
- [ ] Hot reload dev server
- [ ] ESLint + Prettier

### Week 3: Features
- [ ] Offline mode
- [ ] Batch translation
- [ ] Translation history
- [ ] Smart context menu

### Week 4: Infrastructure
- [ ] CI/CD setup
- [ ] Automated releases
- [ ] Update checker
- [ ] Documentation site

---

## 💰 Cost/Benefit Analysis

| Feature | Effort | Value | Priority |
|---------|--------|-------|----------|
| Remove debug logs | 1h | High | 🔴 P1 |
| Error tracking | 4h | High | 🔴 P1 |
| Performance monitor | 2h | Medium | 🔴 P1 |
| Tests | 8h | High | 🟡 P2 |
| Offline mode | 6h | Medium | 🟢 P3 |
| Batch translation | 4h | High | 🟢 P3 |
| History | 3h | Medium | 🟢 P3 |
| CI/CD | 4h | High | 🔵 P4 |
| Plugin system | 16h | Low | 🟣 P5 |
| Cloud sync | 12h | Medium | 🟣 P5 |

---

## 🎯 Quick Wins (Start Today)

1. **Remove debug logs** (1 hour) → Immediate cleaner console
2. **Add @connect localhost:3000** to metadata (5 min) → Local proxy works
3. **Fix typos in UI** (30 min) → Better UX
4. **Add loading spinner** (1 hour) → Better feedback

---

## 🤝 Community Contributions

Encourage users to:
- Report bugs via GitHub Issues
- Submit translations for new languages
- Share custom prompts
- Write documentation

---

## 📊 Success Metrics

Track these monthly:
- Active users
- API error rate
- Average translation time
- User retention
- GitHub stars

---

## 🚀 Next Steps

**Choose ONE priority to start:**
- Quick win: Remove debug logs (1 hour)
- High value: Add tests (1 day)
- User facing: Add history (half day)

**What do you want to tackle first?**
