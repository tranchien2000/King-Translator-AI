  class UIManager {
    constructor(translator) {
      if (!translator) {
        throw new Error("Translator instance is required");
      }
      this.translator = translator;
      this.settings = this.translator.userSettings.settings;
      this._ = this.translator.userSettings._;
      this.translatingStatus = null;
      this.ignoreNextSelectionChange = false;
      this.touchCount = 0;
      this.currentTranslateButton = null;
      this.isProcessing = false;
      this.touchEndProcessed = false;
      this.currentOverlay = null;
      this.currentSelectionBox = null;
      this.currentStatusContainer = null;
      this.currentGuide = null;
      this.currentCancelBtn = null;
      this.currentStyle = null;
      this.voiceStorage = {};
      this.selectSource = null;
      this.selectVoice = null;
      this.isTTSSpeaking = false;
      this.currentTTSAudio = null;
      this.translationButtonEnabled = true;
      this.translationTapEnabled = true;
      this.mediaElement = null;
      this.googleTranslateActive = false;
      this.googleTranslateAttempts = 0;
      this.container = this.translator.uiRoot.getContainer();
      this.shadowRoot = this.translator.uiRoot.getRoot();
      if (this.settings.translatorTools?.enabled && safeLocalStorageGet("translatorToolsEnabled") === null) {
        safeLocalStorageSet("translatorToolsEnabled", "true");
      }
      this.mobileOptimizer = new MobileOptimizer(this);
      this.page = this.translator.page;
      this.ocr = new OCRManager(translator);
      this.media = new MediaManager(translator);
      this.handleSettingsShortcut = this.handleSettingsShortcut.bind(this);
      this.handleTranslationShortcuts =
        this.handleTranslationShortcuts.bind(this);
      this.handleTranslateButtonClick =
        this.handleTranslateButtonClick.bind(this);
      this.setupClickHandlers = this.setupClickHandlers.bind(this);
      this.setupSelectionHandlers = this.setupSelectionHandlers.bind(this);
      this.showTranslatingStatus = this.showTranslatingStatus.bind(this);
      this.removeTranslatingStatus = this.removeTranslatingStatus.bind(this);
      this.resetState = this.resetState.bind(this);
      this.settingsShortcutListener = this.handleSettingsShortcut;
      this.translationShortcutListener = this.handleTranslationShortcuts;
      this.handleGeminiFileOrUrlTranslation = this.handleGeminiFileOrUrlTranslation.bind(this);
      this.setupEventListeners();
      if (document.readyState === "complete") {
        if (
          this.settings.pageTranslation.autoTranslate
        ) {
          this.page.checkAndTranslate();
        }
        if (
          this.settings.pageTranslation
            .showInitialButton
        ) {
          this.setupQuickTranslateButton();
        }
      } else {
        window.addEventListener("load", () => {
          if (
            this.settings.pageTranslation.autoTranslate
          ) {
            this.page.checkAndTranslate();
          }
          if (
            this.settings.pageTranslation
              .showInitialButton
          ) {
            this.setupQuickTranslateButton();
          }
        });
      }
      setTimeout(() => {
        if (!this.$(".translator-tools-container")) {
          let isEnabled = false;
          if (safeLocalStorageGet("translatorToolsEnabled") === null) safeLocalStorageGet("translatorToolsEnabled") === "true";
          if (safeLocalStorageGet("translatorToolsEnabled") === "true") isEnabled = true;
          if (this.settings.translatorTools?.enabled && isEnabled) {
            this.setupTranslatorTools();
          }
        }
      }, 5000);
      this.debouncedCreateButton = debounce((selection, x, y) => {
        this.createTranslateButton(selection, x, y);
      }, 100);
    }
    $(selector) {
      return this.shadowRoot.querySelector(selector);
    }
    $$(selector) {
      return this.shadowRoot.querySelectorAll(selector);
    }
    createCloseButton() {
      const button = document.createElement("span");
      button.textContent = "x";
      Object.assign(button.style, {
        position: "absolute",
        top: "0px",
        right: "0px",
        cursor: "pointer",
        color: "black",
        fontSize: "14px",
        fontWeight: "bold",
        padding: "4px 8px",
        lineHeight: "14px"
      });
      button.onclick = () => button.parentElement.remove();
      return button;
    }
    showTranslationBelow(translatedText, targetElement, text) {
      if (
        targetElement.nextElementSibling?.classList.contains(
          "translator-content"
        )
      ) {
        return;
      }
      const settings = this.settings.displayOptions;
      const mode = settings.translationMode;
      const showSource = settings.languageLearning.showSource;
      let formattedTranslation = "";
      if (mode === "translation_only") {
        formattedTranslation = translatedText;
      } else if (mode === "parallel") {
        formattedTranslation = `<div style="margin-bottom: 8px">${this._("original_label")}: ${text}</div>
<div>${this._("translation_label")}: ${translatedText.split("<|>")[2] || translatedText}</div>`;
      } else if (mode === "language_learning") {
        let sourceHTML = "";
        if (showSource) {
          sourceHTML = `<div style="margin-bottom: 8px">[${this._("original_label")}]: ${text}</div>`;
        }
        formattedTranslation = `${sourceHTML}
<div>[${this._("pinyin_label")}]: ${translatedText.split("<|>")[1] || ""}</div>
<div>[${this._("translation_label")}]: ${translatedText.split("<|>")[2] || translatedText}</div>`;
      }
      const translationDiv = document.createElement("div");
      translationDiv.classList.add("translator-content");
      Object.assign(translationDiv.style, {
        ...CONFIG.STYLES.translation,
        fontSize: settings.fontSize
      });
      translationDiv.innerHTML = formattedTranslation;
      const themeMode = this.settings.theme;
      const theme = CONFIG.THEME[themeMode];
      translationDiv.appendChild(this.createCloseButton());
      targetElement.insertAdjacentElement('afterend', translationDiv);
      translationDiv.style.cssText = `
display: block; /* Giữ cho phần dịch không bị kéo dài hết chiều ngang */
max-width: fit-content; /* Giới hạn chiều rộng */
width: auto; /* Để nó co giãn theo nội dung */
min-width: 150px;
color: ${theme.text};
background-color: ${theme.background};
padding: 10px 20px 10px 10px;
margin-top: 10px;
border-radius: 8px;
position: relative;
z-index: 2147483647;
border: 1px solid ${theme.border};
white-space: normal; /* Cho phép xuống dòng nếu quá dài */
overflow-wrap: break-word; /* Ngắt từ nếu quá dài */
`;
      const cleanup = () => {
        document.removeEventListener("keydown", handleEscape);
        document.removeEventListener("click", handleClickOutside);
        translationDiv.style.opacity = "0";
        translationDiv.style.display = "none";
        translationDiv.style.animation = "popupEntrance 0.3s cubic-bezier(0.4, 0, 0.6, 1) reverse";
        setTimeout(() => translationDiv.remove(), 300);
      };
      translationDiv.addEventListener("click", (e) => e.stopPropagation());
      const handleClickOutside = (e) => {
        if (translationDiv && !translationDiv.contains(e.target)) cleanup();
      };
      document.addEventListener("click", handleClickOutside);
      const handleEscape = (e) => {
        if (e.key === "Escape") cleanup();
      };
      document.removeEventListener("keydown", handleEscape);
      document.addEventListener("keydown", handleEscape);
    }
    displayPopup(translatedText, originalText, title = "Bản dịch", pinyin = "") {
      console.log('ori:' + originalText, '\nipa:' + pinyin, '\ntrans:' + translatedText);
      this.removeTranslateButton();
      const settings = this.settings;
      const themeMode = settings.theme;
      const theme = CONFIG.THEME[themeMode];
      const isDark = themeMode === "dark";
      const displayOptions = settings.displayOptions;
      const sourceLang = displayOptions.sourceLanguage === 'auto' ? this.page.languageCode : displayOptions.sourceLanguage;
      const baseFontSize = displayOptions.fontSize || "14px";
      const minWidth = displayOptions.minPopupWidth || "300px";
      const maxWidth = displayOptions.maxPopupWidth || "90vw";
      const isParallelMode = displayOptions.translationMode === "parallel";
      const convertToPixels = (value, isFont = false) => {
        if (typeof value === 'number') return value;
        if (typeof value !== 'string') return isFont ? 14 : 300;
        const numValue = parseFloat(value);
        const unit = value.replace(numValue.toString(), '').trim().toLowerCase();
        const tempElement = document.createElement('div');
        tempElement.style.position = 'absolute';
        tempElement.style.visibility = 'hidden';
        tempElement.style.top = '-9999px';
        document.body.appendChild(tempElement);
        let pixelValue;
        try {
          switch (unit) {
            case 'px':
              pixelValue = numValue;
              break;
            case '%':
              if (isFont) {
                pixelValue = (numValue / 100) * 16;
              } else {
                pixelValue = (numValue / 100) * window.innerWidth;
              }
              break;
            case 'vw':
              pixelValue = (numValue / 100) * window.innerWidth;
              break;
            case 'vh':
              pixelValue = (numValue / 100) * window.innerHeight;
              break;
            case 'vmin':
              pixelValue = (numValue / 100) * Math.min(window.innerWidth, window.innerHeight);
              break;
            case 'vmax':
              pixelValue = (numValue / 100) * Math.max(window.innerWidth, window.innerHeight);
              break;
            case 'rem':
              tempElement.style.fontSize = '1rem';
              const rootFontSize = parseFloat(getComputedStyle(tempElement).fontSize);
              pixelValue = numValue * rootFontSize;
              break;
            case 'em':
              tempElement.style.fontSize = '1em';
              const parentFontSize = parseFloat(getComputedStyle(tempElement).fontSize);
              pixelValue = numValue * parentFontSize;
              break;
            case 'pt':
              pixelValue = numValue * 1.333;
              break;
            case 'pc':
              pixelValue = numValue * 16;
              break;
            case 'in':
              pixelValue = numValue * 96;
              break;
            case 'cm':
              pixelValue = numValue * 37.8;
              break;
            case 'mm':
              pixelValue = numValue * 3.78;
              break;
            case 'ex':
              tempElement.style.height = '1ex';
              pixelValue = numValue * parseFloat(getComputedStyle(tempElement).height);
              break;
            case 'ch':
              tempElement.style.width = '1ch';
              tempElement.textContent = '0';
              pixelValue = numValue * parseFloat(getComputedStyle(tempElement).width);
              break;
            default:
              pixelValue = numValue || (isFont ? 14 : 300);
          }
        } catch (error) {
          console.warn(`Cannot convert ${value} to pixels:`, error);
          pixelValue = isFont ? 14 : 300;
        } finally {
          document.body.removeChild(tempElement);
        }
        return Math.max(pixelValue, isFont ? 8 : 100);
      };
      const baseFontSizePx = convertToPixels(baseFontSize, true);
      const minWidthPx = convertToPixels(minWidth);
      const maxWidthPx = convertToPixels(maxWidth);
      const style = document.createElement('style');
      style.textContent = `
@keyframes popupEntrance {
  0% {
    opacity: 0;
    transform: translate(-50%, -50%) scale(0.8) rotateY(-15deg);
  }
  100% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1) rotateY(0deg);
  }
}
@keyframes ripple {
  to {
    transform: scale(4);
    opacity: 0;
  }
}
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-2px); }
}
.translator-popup {
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  background: ${isDark ? 'linear-gradient(135deg, rgba(26,32,46,0.95) 0%, rgba(31,41,55,0.95) 50%, rgba(17,24,39,0.95) 100%)' : 'linear-gradient(135deg, rgba(255,255,255,0.95) 0%, rgba(248,250,252,0.95) 50%, rgba(241,245,249,0.95) 100%)'};
  border: 1px solid ${isDark ? 'rgba(99,102,241,0.4)' : 'rgba(59,130,246,0.4)'};
  box-shadow: ${isDark ? '0 25px 60px rgba(0,0,0,0.6)' : '0 25px 60px rgba(0,0,0,0.25)'}, inset 0 1px 0 ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)'};
  animation: popupEntrance 0.4s cubic-bezier(0.34, 1.2, 0.64, 1);
  font-size: ${baseFontSize};
  min-width: ${isParallelMode ? `max(${minWidthPx}px, 700px)` : minWidth};
  max-width: ${isParallelMode ? `min(${maxWidthPx}px, 90vw)` : maxWidth};
}
.translator-content::-webkit-scrollbar {
  width: 6px;
}
.translator-content::-webkit-scrollbar-track {
  background: transparent;
}
.translator-content::-webkit-scrollbar-thumb {
  background: ${isDark ? 'rgba(99,102,241,0.3)' : 'rgba(59,130,246,0.3)'};
  border-radius: 3px;
  transition: all 0.3s ease;
}
.translator-content::-webkit-scrollbar-thumb:hover {
  background: ${isDark ? 'rgba(99,102,241,0.5)' : 'rgba(59,130,246,0.5)'};
}
.container-hover {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow-x: hidden;
  overflow-y: auto;
}
.container-hover::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg,
    transparent,
    ${isDark ? 'rgba(99,102,241,0.1)' : 'rgba(59,130,246,0.1)'},
    transparent
  );
  transition: left 0.5s ease;
}
.container-hover:hover::before {
  left: 100%;
}
.container-hover:hover {
  transform: translateY(-3px);
  box-shadow:
    ${isDark ? '0 15px 35px rgba(99,102,241,0.2)' : '0 15px 35px rgba(59,130,246,0.2)'},
    ${isDark ? '0 5px 15px rgba(0,0,0,0.3)' : '0 5px 15px rgba(0,0,0,0.1)'};
  border-color: ${isDark ? 'rgba(99,102,241,0.4)' : 'rgba(59,130,246,0.4)'};
}
.drag-handle {
  background: ${isDark ?
          'linear-gradient(135deg, rgba(99,102,241,0.8) 0%, rgba(139,92,246,0.8) 100%)' :
          'linear-gradient(135deg, rgba(59,130,246,0.9) 0%, rgba(99,102,241,0.9) 100%)'
        };
  position: relative;
  overflow: hidden;
}
.drag-handle::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
  animation: shimmer 3s infinite;
}
.glass-button {
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  background: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.2)'};
  border: 1px solid ${isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.3)'};
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;
}
.glass-button:hover {
  background: ${isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.3)'};
  transform: translateY(-1px);
  box-shadow: 0 8px 25px ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)'};
}
.glass-button:active {
  transform: translateY(0px);
}
.floating-icon {
  animation: float 3s ease-in-out infinite;
}
.section-divider {
  height: 1px;
  background: ${isDark ?
          'linear-gradient(90deg, transparent, rgba(99,102,241,0.5), transparent)' :
          'linear-gradient(90deg, transparent, rgba(59,130,246,0.5), transparent)'
        };
  margin: 16px 0;
}
/* Responsive design */
@media (max-width: 768px) {
  .translator-popup {
    min-width: min(${minWidthPx}px, 90vw) !important;
    max-width: min(${maxWidthPx}px, 95vw) !important;
    max-height: 90vh !important;
  }
}
@media (max-width: 480px) {
  .translator-popup {
    min-width: min(${minWidthPx}px, 95vw) !important;
    max-width: min(${maxWidthPx}px, 98vw) !important;
    font-size: max(${baseFontSizePx - 2}px, 12px) !important;
  }
}
/* Parallel Layout Styles */
.parallel-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  height: 100%;
  position: relative;
  max-height: calc(60vh - 40px);
  padding-bottom: 8px;
}
.parallel-section {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.parallel-section:first-child { animation: slideInLeft 0.5s ease; }
.parallel-section:last-child { animation: slideInRight 0.5s ease; }
@keyframes slideInLeft {
  0% { opacity: 0; transform: translateX(-30px); }
  100% { opacity: 1; transform: translateX(0); }
}
@keyframes slideInRight {
  0% { opacity: 0; transform: translateX(30px); }
  100% { opacity: 1; transform: translateX(0); }
}
.vertical-divider {
  position: absolute;
  left: 50%;
  top: 8px;
  bottom: 8px;
  width: 1px;
  background: ${isDark ? 'linear-gradient(180deg, transparent, rgba(99,102,241,0.5), transparent)' : 'linear-gradient(180deg, transparent, rgba(59,130,246,0.5), transparent)'};
  transform: translateX(-50%);
  z-index: 1;
}
.parallel-content {
  flex: 1;
  overflow-x: hidden;
  overflow-y: auto;
  padding-right: 8px;
  padding-bottom: 16px;
  min-height: 0;
  max-height: calc(50vh - 60px);
}
.translator-content {
  padding-bottom: 20px !important;
  margin-bottom: 4px;
}
.vertical-layout {
  display: flex;
  flex-direction: column;
  gap: 20px;
}
`;
      this.shadowRoot.appendChild(style);
      const popup = document.createElement("div");
      popup.className = "draggable translator-popup";
      Object.assign(popup.style, {
        position: "fixed",
        borderRadius: "20px",
        minWidth: isParallelMode ? `max(${minWidth}, 700px)` : minWidth,
        maxWidth: isParallelMode ? `min(${maxWidth}, 90vw)` : maxWidth,
        fontSize: baseFontSize,
        padding: "0",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 2147483647,
        userSelect: "text"
      });
      const adjustPopupSize = () => {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const currentMinWidthPx = convertToPixels(minWidth);
        const currentMaxWidthPx = convertToPixels(maxWidth);
        const currentFontSizePx = convertToPixels(baseFontSize, true);
        if (isParallelMode) {
          const parallelMinWidth = Math.max(currentMinWidthPx, 700);
          const parallelMaxWidth = Math.min(currentMaxWidthPx, viewportWidth * 0.9);
          popup.style.minWidth = Math.min(parallelMinWidth, viewportWidth * 0.9) + "px";
          popup.style.maxWidth = parallelMaxWidth + "px";
          if (viewportWidth <= 1024) {
            popup.style.maxHeight = Math.min(viewportHeight * 0.8, 700) + "px";
          } else {
            popup.style.maxHeight = Math.min(viewportHeight * 0.75, 650) + "px";
          }
        } else {
          if (viewportWidth <= 768) {
            popup.style.minWidth = Math.min(currentMinWidthPx, viewportWidth * 0.9) + "px";
            popup.style.maxWidth = Math.min(currentMaxWidthPx, viewportWidth * 0.95) + "px";
            if (viewportWidth <= 480) {
              popup.style.fontSize = Math.max(currentFontSizePx - 2, 12) + "px";
            }
          } else {
            popup.style.minWidth = minWidth;
            popup.style.maxWidth = maxWidth;
            popup.style.fontSize = baseFontSize;
          }
          popup.style.maxHeight = Math.min(viewportHeight * 0.9, 800) + "px";
        }
      };
      adjustPopupSize();
      const resizeHandler = () => adjustPopupSize();
      window.addEventListener('resize', resizeHandler);
      const dragHandle = document.createElement("div");
      dragHandle.className = "drag-handle";
      Object.assign(dragHandle.style, {
        color: "#ffffff",
        padding: "20px 24px",
        borderTopLeftRadius: "19px",
        borderTopRightRadius: "19px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        cursor: "move",
        userSelect: "none",
        minHeight: "60px"
      });
      const titleSpan = document.createElement("span");
      const svgString = `
<svg width="18" height="18" style="margin-right: 8px;" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4z"/>
</svg>`;
      const svgElement = createElementFromHTML(svgString);
      const textSpan = document.createElement("span");
      textSpan.style.cssText = `font-size: calc(${baseFontSize} + 2px); font-weight: 600; letter-spacing: 0.5px;`;
      textSpan.textContent = title;
      titleSpan.appendChild(svgElement);
      titleSpan.appendChild(textSpan);
      Object.assign(titleSpan.style, {
        display: "flex",
        alignItems: "center"
      });
      const layoutToggle = document.createElement("button");
      if (isParallelMode) {
        layoutToggle.className = "glass-button";
        layoutToggle.innerHTML = `
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="3" y="3" width="7" height="18"/>
  <rect x="14" y="3" width="7" height="18"/>
</svg>
`;
        Object.assign(layoutToggle.style, {
          border: "none",
          color: "#fff",
          cursor: "pointer",
          borderRadius: "8px",
          width: "36px",
          height: "36px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginRight: "10px"
        });
        layoutToggle.title = this._("notifications.switch_layout");
        this.addRippleEffect(layoutToggle);
      }
      const closeButton = document.createElement("button");
      closeButton.className = "glass-button";
      closeButton.innerHTML = `
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <line x1="18" y1="6" x2="6" y2="18"></line>
  <line x1="6" y1="6" x2="18" y2="18"></line>
</svg>
`;
      Object.assign(closeButton.style, {
        border: "none",
        color: "#fff",
        cursor: "pointer",
        borderRadius: "12px",
        width: "40px",
        height: "40px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      });
      closeButton.title = this._("notifications.close_popup");
      this.addRippleEffect(closeButton);
      const headerControls = document.createElement("div");
      headerControls.style.display = "flex";
      headerControls.style.alignItems = "center";
      if (isParallelMode) headerControls.appendChild(layoutToggle);
      headerControls.appendChild(closeButton);
      dragHandle.appendChild(titleSpan);
      dragHandle.appendChild(headerControls);
      const contentContainer = document.createElement("div");
      contentContainer.className = "translator-content";
      Object.assign(contentContainer.style, {
        padding: isParallelMode ? "16px" : "24px",
        maxHeight: isParallelMode ? "calc(75vh - 120px)" : "calc(90vh - 120px)",
        overflowX: "hidden",
        overflowY: "auto",
        fontSize: baseFontSize,
        position: "relative",
        paddingBottom: isParallelMode ? "20px" : "24px"
      });
      const textContainer = document.createElement("div");
      Object.assign(textContainer.style, {
        display: "flex",
        flexDirection: "column",
        gap: "20px"
      });
      const createContentSection = (title, content, icon, lang = null) => {
        const container = document.createElement("div");
        container.className = "container-hover";
        Object.assign(container.style, {
          background: isDark ?
            'linear-gradient(135deg, rgba(30,41,59,0.4) 0%, rgba(51,65,85,0.4) 100%)' :
            'linear-gradient(135deg, rgba(248,250,252,0.6) 0%, rgba(255,255,255,0.6) 100%)',
          borderRadius: "16px",
          padding: "20px",
          border: `1px solid ${isDark ? 'rgba(75,85,99,0.3)' : 'rgba(229,231,235,0.6)'}`,
          position: "relative",
          backdropFilter: "blur(10px)"
        });
        const header = document.createElement("div");
        Object.assign(header.style, {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px"
        });
        const titleDiv = document.createElement("div");
        titleDiv.innerHTML = `${icon}<span style="margin-left: 8px; font-weight: 600; font-size: calc(${baseFontSize} + 1px);">${title}</span>`;
        Object.assign(titleDiv.style, {
          color: theme.title,
          display: "flex",
          alignItems: "center"
        });
        const buttonsContainer = document.createElement("div");
        Object.assign(buttonsContainer.style, {
          display: "flex",
          gap: "10px",
          alignItems: "center"
        });
        const ttsButton = this.createTTSButton(theme, isDark, content, lang);
        const copyButton = this.createCopyButton(theme, isDark, content, baseFontSize);
        if (ttsButton) {
          buttonsContainer.appendChild(ttsButton);
        }
        buttonsContainer.appendChild(copyButton);
        header.appendChild(titleDiv);
        header.appendChild(buttonsContainer);
        const contentDiv = document.createElement("div");
        Object.assign(contentDiv.style, {
          lineHeight: "1.7",
          color: theme.text,
          fontSize: baseFontSize,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word"
        });
        const cleanedText = title === this._("notifications.translation_label") ? content.replace(
          /(\*\*)(.*?)\1/g,
          `<span style="color: ${isDark ? '#60A5FA' : '#2563EB'}; font-weight: 600; background: ${isDark ? 'rgba(96,165,250,0.1)' : 'rgba(37,99,235,0.1)'}; padding: 2px 6px; border-radius: 6px;">$2</span>`
        ) : content;
        contentDiv.innerHTML = this.formatTranslation(cleanedText, theme, isDark, baseFontSize);
        container.appendChild(header);
        const divider = document.createElement("div");
        divider.className = "section-divider";
        container.appendChild(divider);
        container.appendChild(contentDiv);
        return { container };
      };
      const createParallelSection = (title, content, icon, lang = null) => {
        const container = document.createElement("div");
        container.className = `container-hover parallel-section`;
        Object.assign(container.style, {
          background: isDark ? 'linear-gradient(135deg, rgba(30,41,59,0.4) 0%, rgba(51,65,85,0.4) 100%)' : 'linear-gradient(135deg, rgba(248,250,252,0.6) 0%, rgba(255,255,255,0.6) 100%)',
          borderRadius: "12px",
          padding: "12px",
          paddingBottom: "5px",
          border: `1px solid ${isDark ? 'rgba(75,85,99,0.3)' : 'rgba(229,231,235,0.6)'}`,
          position: "relative",
          backdropFilter: "blur(10px)",
          height: "100%",
          minHeight: "0",
          marginBottom: "4px"
        });
        const header = document.createElement("div");
        Object.assign(header.style, {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "8px",
          flexShrink: "0"
        });
        const titleDiv = document.createElement("div");
        titleDiv.innerHTML = `${icon}<span style="margin-left: 8px; font-weight: 600; font-size: calc(${baseFontSize} + 1px);">${title}</span>`;
        Object.assign(titleDiv.style, {
          color: theme.title,
          display: "flex",
          alignItems: "center"
        });
        const buttonsContainer = document.createElement("div");
        Object.assign(buttonsContainer.style, {
          display: "flex",
          gap: "8px",
          alignItems: "center"
        });
        const ttsButton = this.createTTSButton(theme, isDark, content, lang);
        const copyButton = this.createCopyButton(theme, isDark, content, baseFontSize);
        if (ttsButton) {
          buttonsContainer.appendChild(ttsButton);
        }
        buttonsContainer.appendChild(copyButton);
        header.appendChild(titleDiv);
        header.appendChild(buttonsContainer);
        const contentDiv = document.createElement("div");
        contentDiv.className = "parallel-content";
        Object.assign(contentDiv.style, {
          lineHeight: "1.6",
          color: theme.text,
          fontSize: baseFontSize,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          flex: "1",
          overflowX: "hidden",
          overflowY: "auto",
          paddingRight: "8px"
        });
        const cleanedText = title === this._("notifications.translation_label") ? content.replace(
          /(\*\*)(.*?)\1/g,
          `<span style="color: ${isDark ? '#60A5FA' : '#2563EB'}; font-weight: 600; background: ${isDark ? 'rgba(96,165,250,0.1)' : 'rgba(37,99,235,0.1)'}; padding: 2px 6px; border-radius: 6px;">$2</span>`
        ) : content;
        contentDiv.innerHTML = this.formatTranslation(cleanedText, theme, isDark, baseFontSize);
        container.appendChild(header);
        const divider = document.createElement("div");
        divider.className = "section-divider";
        container.appendChild(divider);
        container.appendChild(contentDiv);
        return container;
      };
      const buildParallelLayout = () => {
        const parallelContainer = document.createElement("div");
        parallelContainer.className = "parallel-layout";
        const divider = document.createElement("div");
        divider.className = "vertical-divider";
        parallelContainer.appendChild(divider);
        const leftSection = createParallelSection(
          this._("notifications.original_label"), originalText,
          `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>`,
          sourceLang
        );
        const rightSection = createParallelSection(
          this._("notifications.translation_label"), translatedText,
          `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>`,
          displayOptions.targetLanguage
        );
        parallelContainer.appendChild(leftSection);
        parallelContainer.appendChild(rightSection);
        return parallelContainer;
      };
      const buildVerticalLayout = () => {
        const textContainer = document.createElement("div");
        Object.assign(textContainer.style, {
          display: "flex",
          flexDirection: "column",
          gap: "20px"
        });
        if (isParallelMode || displayOptions.translationMode === "language_learning" && displayOptions.languageLearning.showSource === true) {
          const { container: originalContainer } = createContentSection(
            this._("notifications.original_label"), originalText,
            `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>`,
            sourceLang
          );
          textContainer.appendChild(originalContainer);
        }
        if (displayOptions.translationMode === "language_learning" && pinyin) {
          const { container: pinyinContainer } = createContentSection(
            this._("notifications.ipa_label"), pinyin,
            `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z"/>
            </svg>`,
            sourceLang
          );
          textContainer.appendChild(pinyinContainer);
        }
        const { container: translationContainer } = createContentSection(
          this._("notifications.translation_label"), translatedText,
          `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
          </svg>`,
          displayOptions.targetLanguage
        );
        textContainer.appendChild(translationContainer);
        return textContainer;
      };
      if (isParallelMode) {
        let currentLayout = window.innerWidth <= 1024 ? 'vertical' : 'parallel';
        const updateToggleButton = () => {
          if (currentLayout === 'parallel') {
            layoutToggle.innerHTML = `
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="3" y="3" width="7" height="18"/>
  <rect x="14" y="3" width="7" height="18"/>
</svg>
`;
            layoutToggle.title = this._("notifications.switch_layout_ver");
          } else {
            layoutToggle.innerHTML = `
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <rect x="3" y="3" width="18" height="7"/>
  <rect x="3" y="14" width="18" height="7"/>
</svg>
`;
            layoutToggle.title = this._("notifications.switch_layout_hor");
          }
        };
        updateToggleButton();
        const cleanupContainer = () => {
          while (contentContainer.firstChild) {
            contentContainer.removeChild(contentContainer.firstChild);
          }
          Object.assign(contentContainer.style, {
            padding: currentLayout === 'parallel' ? "16px" : "24px",
            maxHeight: "calc(75vh - 120px)",
            overflowY: "auto",
            overflowX: "hidden",
            fontSize: baseFontSize,
            position: "relative",
            paddingBottom: currentLayout === 'parallel' ? "20px" : "24px"
          });
        };
        const rebuildLayout = () => {
          cleanupContainer();
          requestAnimationFrame(() => {
            if (currentLayout === 'vertical') {
              contentContainer.appendChild(buildVerticalLayout());
            } else {
              contentContainer.appendChild(buildParallelLayout());
            }
            updateToggleButton();
            adjustPopupSize();
          });
        };
        layoutToggle.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          layoutToggle.disabled = true;
          layoutToggle.style.opacity = "0.6";
          currentLayout = currentLayout === 'parallel' ? 'vertical' : 'parallel';
          rebuildLayout();
          setTimeout(() => {
            layoutToggle.disabled = false;
            layoutToggle.style.opacity = "1";
          }, 300);
        };
        // const handleResize = () => {
        //   const newViewportWidth = window.innerWidth;
        //   // Tự động chuyển về vertical trên mobile
        //   if (newViewportWidth <= 1024 && currentLayout === 'parallel') {
        //     currentLayout = 'vertical';
        //     rebuildLayout();
        //   }
        //   // Tự động chuyển về parallel trên desktop (nếu muốn)
        //   else if (newViewportWidth > 1024 && currentLayout === 'vertical') {
        //     currentLayout = 'parallel';
        //     rebuildLayout();
        //   }
        // };
        // window.addEventListener('resize', handleResize);
      }
      const buildResponsiveLayout = () => {
        const viewportWidth = window.innerWidth;
        if (isParallelMode) {
          if (viewportWidth <= 1024) {
            return buildVerticalLayout();
          } else {
            return buildParallelLayout();
          }
        } else {
          return buildVerticalLayout();
        }
      };
      contentContainer.appendChild(buildResponsiveLayout());
      popup.appendChild(dragHandle);
      popup.appendChild(contentContainer);
      this.shadowRoot.appendChild(popup);
      const cleanup = () => {
        speechSynthesis.cancel();
        this.voiceStorage = {};
        this.selectSource = null;
        this.selectVoice = null;
        window.removeEventListener('resize', resizeHandler);
        document.removeEventListener("keydown", handleEscape);
        document.removeEventListener("click", handleClickOutside);
        popup.style.opacity = "0";
        popup.style.display = "none";
        popup.style.transform = "translate(-50%, -50%) scale(0.8)";
        popup.style.animation = "popupEntrance 0.3s cubic-bezier(0.4, 0, 0.6, 1) reverse";
        setTimeout(() => popup.remove(), 300);
      };
      closeButton.onclick = cleanup;
      this.makeDraggable(popup, dragHandle);
      popup.addEventListener("click", (e) => e.stopPropagation());
      const handleClickOutside = (e) => {
        if (popup && !popup.contains(e.target)) cleanup();
      };
      document.addEventListener("click", handleClickOutside);
      const handleEscape = (e) => {
        if (e.key === "Escape") cleanup();
      };
      document.removeEventListener("keydown", handleEscape);
      document.addEventListener("keydown", handleEscape);
    }
    async playTTS(text, voiceName, lang, options, playButton = null, isDark = false, menuItem = null) {
      if (this.isTTSSpeaking) {
        this.stopTTS();
        return;
      }
      this.isTTSSpeaking = true;
      if (playButton) this.updateButtonState(playButton, isDark);
      if (menuItem) this.onSpeechEndCallback(menuItem);
      try {
        const provider = this.selectSource;
        if (provider === 'local') {
          this.currentTTSAudio = await this.playLocalTTS(text, voiceName, options, playButton, isDark, menuItem);
          return;
        }
        const cacheEnabled = this.translator.userSettings.settings.cacheOptions.tts.enabled;
        const optionsString = `${options.speedValue}-${options.pitchValue}-${options.volumeValue}`;
        const cacheKey = `${provider}_${voiceName || lang}_${optionsString}_${text}`;
        let audioBuffer = null;
        if (cacheEnabled) {
          const cachedBase64 = await this.translator.ttsCache.get(cacheKey);
          if (cachedBase64) {
            console.log("TTS found in persistent cache.");
            audioBuffer = PersistentCache.base64ToArrayBuffer(cachedBase64);
          }
        }
        if (!audioBuffer) {
          console.log("TTS not in cache, fetching from API.");
          const fetcherMap = {
            'google_translate': () => this.fetchGoogleTranslateTTS(text, lang),
            'google': () => this.fetchGoogleTTS(text, voiceName, lang, options),
            'gemini': () => this.fetchGeminiTTS(text, voiceName),
            'openai': () => this.fetchOpenAITTS(text, voiceName, options),
          };
          if (!fetcherMap[provider]) {
            throw new Error(`TTS provider "${provider}" is not supported for caching.`);
          }
          audioBuffer = await fetcherMap[provider]();
          if (!audioBuffer) {
            throw new Error("Received no audio data from the API.");
          }
          if (cacheEnabled) {
            const base64Audio = PersistentCache.arrayBufferToBase64(audioBuffer);
            await this.translator.ttsCache.set(cacheKey, base64Audio);
          }
        }
        this.currentTTSAudio = await this.playAudio(audioBuffer, options.volumeValue, playButton, isDark, menuItem);
      } catch (error) {
        console.error('TTS Playback Error:', error);
        this.showNotification(this._("notifications.tts_playback_error") + ": " + error.message, "error");
        this.isTTSSpeaking = false;
        if (playButton) this.updateButtonState(playButton, isDark);
        if (menuItem) this.onSpeechEndCallback(menuItem);
      }
    }
    stopTTS() {
      if (this.currentTTSAudio) {
        if (this.currentTTSAudio?.stop) {
          this.currentTTSAudio.stop();
        }
        if (this.currentTTSAudio?.disconnect) {
          this.currentTTSAudio.disconnect();
        }
        if (this.currentTTSAudio?.pause) {
          this.currentTTSAudio.pause();
        }
        this.isTTSSpeaking = false;
        this.currentTTSAudio = null;
      }
      speechSynthesis.cancel();
    }
    updateButtonState(playButton, isDark) {
      playButton.innerHTML = this.isTTSSpeaking ?
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>' :
        '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
      playButton.title = this.isTTSSpeaking ? this._("notifications.stop_tts") : this._("notifications.play_tts");
      playButton.style.backgroundColor = this.isTTSSpeaking ? (isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)") : "transparent";
    }
    async playLocalTTS(text, voiceName, options, playButton, isDark, menuItem) {
      return new Promise((resolve, reject) => {
        if (!window.speechSynthesis) {
          reject(new Error(this._("notifications.browser_tts_not_supported")));
          return;
        }
        speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const voices = speechSynthesis.getVoices();
        const voice = voices.find(v => v.name === voiceName);
        if (voice) {
          utterance.voice = voice;
        }
        utterance.rate = parseFloat(options.speedValue);
        utterance.pitch = parseFloat(options.pitchValue);
        utterance.volume = parseFloat(options.volumeValue);
        utterance.onend = () => {
          this.isTTSSpeaking = false;
          if (playButton) this.updateButtonState(playButton, isDark);
          if (menuItem) this.onSpeechEndCallback(menuItem);
          resolve();
        };
        utterance.onerror = (event) => {
          console.error('TTS Error:', event);
          this.isTTSSpeaking = false;
          if (playButton) this.updateButtonState(playButton, isDark);
          if (menuItem) this.onSpeechEndCallback(menuItem);
          reject(new Error(this._("notifications.tts_playback_error")));
        };
        speechSynthesis.speak(utterance);
      });
    };
    createWavBlob(pcmData, sampleRate) {
      const numChannels = 1;
      const bitsPerSample = 16;
      const blockAlign = (numChannels * bitsPerSample) / 8;
      const byteRate = sampleRate * blockAlign;
      const dataSize = pcmData.byteLength;
      const chunkSize = 36 + dataSize;
      const buffer = new ArrayBuffer(44 + dataSize);
      const view = new DataView(buffer);
      view.setUint32(0, 0x52494646, false); // 'RIFF'
      view.setUint32(4, chunkSize, true);
      view.setUint32(8, 0x57415645, false); // 'WAVE'
      view.setUint32(12, 0x666d7420, false); // 'fmt '
      view.setUint32(16, 16, true); // 16 for PCM
      view.setUint16(20, 1, true); // PCM
      view.setUint16(22, numChannels, true);
      view.setUint32(24, sampleRate, true);
      view.setUint32(28, byteRate, true);
      view.setUint16(32, blockAlign, true);
      view.setUint16(34, bitsPerSample, true);
      view.setUint32(36, 0x64617461, false); // 'data'
      view.setUint32(40, dataSize, true);
      const pcm = new Uint8Array(pcmData);
      const wav = new Uint8Array(buffer);
      wav.set(pcm, 44);
      return new Blob([wav], { type: 'audio/wav' });
    }
    async playAudio(audioData, volumeValue, playButton, isDark, menuItem) {
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const audioBuffer = await audioContext.decodeAudioData(audioData);
        const source = audioContext.createBufferSource();
        source.buffer = audioBuffer;
        const gainNode = audioContext.createGain();
        gainNode.gain.value = parseFloat(volumeValue);
        source.connect(gainNode);
        gainNode.connect(audioContext.destination);
        source.onended = () => {
          this.isTTSSpeaking = false;
          if (playButton) this.updateButtonState(playButton, isDark);
          if (menuItem) this.onSpeechEndCallback(menuItem);
          audioContext.close();
        };
        source.start(0);
        return source;
      } catch (error) {
        console.error('Audio playback error:', error);
        throw error;
      }
    }
    async fetchGoogleTranslateTTS(text, lang) {
      try {
        const chunks = text.match(/.{1,200}(?:\s|$)/g) || [];
        const audioChunks = [];
        for (const chunk of chunks) {
          const chunkBuffer = await new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
              method: 'GET',
              url: `https://translate.google.com/translate_tts?ie=UTF-8&tl=${lang}&client=tw-ob&q=${encodeURIComponent(chunk)}`,
              responseType: 'arraybuffer',
              headers: { 'Referer': 'https://translate.google.com/', 'User-Agent': 'Mozilla/5.0' },
              onload: (response) => (response.status === 200) ? resolve(response.response) : reject(new Error(`Google Translate TTS error: ${response.status}`)),
              onerror: reject
            });
          });
          audioChunks.push(chunkBuffer);
          await new Promise(resolve => setTimeout(resolve, 50));
        }
        const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
        const combinedBuffer = new ArrayBuffer(totalLength);
        const combinedView = new Uint8Array(combinedBuffer);
        let offset = 0;
        for (const chunk of audioChunks) {
          combinedView.set(new Uint8Array(chunk), offset);
          offset += chunk.byteLength;
        }
        return combinedBuffer;
      } catch (error) {
        console.error('Google Translate TTS fetch error:', error);
        throw error;
      }
    }
    async fetchGoogleTTS(text, voiceName, lang, options) {
      try {
        const chunks = text.match(/.{1,200}(?:\s|$)/g) || [];
        const audioChunks = [];
        const googleKey = this.settings.apiKey?.gemini?.[0] || this.settings.apiKey?.google_tts?.[0];
        if (!googleKey) throw new Error("Google TTS API key not configured");
        for (const chunk of chunks) {
          const audioContent = await new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
              method: 'POST',
              url: `https://texttospeech.googleapis.com/v1beta1/text:synthesize?key=${googleKey}`,
              headers: { 'Content-Type': 'application/json' },
              data: JSON.stringify({
                audioConfig: { audioEncoding: 'MP3', pitch: parseFloat(options.pitchValue) - 1.0, speakingRate: parseFloat(options.speedValue) },
                input: { text: chunk },
                voice: { languageCode: lang, name: voiceName }
              }),
              responseType: 'json',
              onload: (response) => (response.status === 200) ? resolve(response.response?.audioContent) : reject(new Error(`Google TTS API error: ${response.status}`)),
              onerror: reject
            });
          });
          if (audioContent) {
            const binaryString = atob(audioContent);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            audioChunks.push(bytes.buffer);
          }
        }
        if (audioChunks.length === 0) throw new Error("No audio data received from Google TTS.");
        const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
        const combinedBuffer = new ArrayBuffer(totalLength);
        const combinedView = new Uint8Array(combinedBuffer);
        let offset = 0;
        for (const chunk of audioChunks) {
          combinedView.set(new Uint8Array(chunk), offset);
          offset += chunk.byteLength;
        }
        return combinedBuffer;
      } catch (error) {
        console.error('Google TTS fetch error:', error);
        throw error;
      }
    }
    async fetchGeminiTTS(text, voiceName) {
      try {
        const API_KEYS = this.settings.apiKey.gemini;
        if (!API_KEYS || !API_KEYS[0]) throw new Error(this._("notifications.no_api_key_configured") + " for Gemini.");
        const API_KEY = API_KEYS[Math.floor(Math.random() * API_KEYS.length)];
        const model = this.settings.ttsOptions.defaultGeminiModel;
        const requestBody = {
          contents: [{ parts: [{ "text": text }] }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName: voiceName }
              }
            }
          },
          model: model
        };
        const response = await new Promise((resolve, reject) => {
          GM_xmlhttpRequest({
            method: "POST",
            url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`,
            headers: { "Content-Type": "application/json" },
            data: JSON.stringify(requestBody),
            responseType: 'json',
            onload: (res) => {
              if (res.status >= 200 && res.status < 300) {
                resolve(res.response);
              } else {
                reject(new Error(`Request failed with status ${res.status}: ${res.statusText || res.responseText}`));
              }
            },
            onerror: (error) => reject(error),
            ontimeout: () => reject(new Error('Request timed out.'))
          });
        });
        const part = response?.candidates?.[0]?.content?.parts?.[0];
        const audioBase64 = part?.inlineData?.data;
        if (!audioBase64) throw new Error(part?.text || "Invalid response structure from Gemini TTS.");
        const binaryString = atob(audioBase64);
        const pcmData = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) pcmData[i] = binaryString.charCodeAt(i);
        const mimeType = part.inlineData.mimeType || 'audio/L16;codec=pcm;rate=24000';
        const sampleRate = parseInt(mimeType.match(/rate=(\d+)/)?.[1] || '24000', 10);
        const wavBlob = this.createWavBlob(pcmData.buffer, sampleRate);
        return await wavBlob.arrayBuffer();
      } catch (error) {
        console.error('Gemini TTS fetch error:', error);
        throw error;
      }
    }
    async fetchOpenAITTS(text, voiceName, options) {
      try {
        const API_KEYS = this.settings.apiKey.openai;
        const API_KEY = API_KEYS[Math.floor(Math.random() * API_KEYS.length)];
        const model = this.settings.ttsOptions.defaultModel;
        return await new Promise((resolve, reject) => {
          GM_xmlhttpRequest({
            method: "POST",
            url: "https://api.openai.com/v1/audio/speech",
            headers: { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json" },
            data: JSON.stringify({ model: model, input: text, voice: voiceName, speed: parseFloat(options.speedValue), response_format: 'wav' }),
            responseType: "arraybuffer",
            onload: (response) => (response.status === 200) ? resolve(response.response) : reject(new Error(`Request failed with status ${response.status}`)),
            onerror: (error) => reject(error),
          });
        });
      } catch (error) {
        console.error('OpenAI TTS fetch error:', error);
        throw error;
      }
    }
    createTTSButton(theme, isDark, text, lang) {
      if (!this.settings.ttsOptions?.enabled) return null;
      const buttonContainer = document.createElement('div');
      Object.assign(buttonContainer.style, {
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '2px'
      });
      const settingsButton = document.createElement('button');
      Object.assign(settingsButton.style, {
        background: "none",
        border: "none",
        padding: "8px",
        cursor: "pointer",
        color: theme.text,
        opacity: "0",
        visibility: "hidden",
        borderRadius: "50%",
        transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transform: "scale(0.8)",
        marginRight: "-8px"
      });
      settingsButton.innerHTML = `
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M12 15a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"/>
  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
</svg>
`;
      settingsButton.title = this._("notifications.tts_settings");
      const playButton = document.createElement("button");
      Object.assign(playButton.style, {
        background: "none",
        border: "none",
        padding: "8px",
        cursor: "pointer",
        color: theme.text,
        opacity: "0.7",
        borderRadius: "50%",
        transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      });
      const settingsPanel = document.createElement('div');
      Object.assign(settingsPanel.style, {
        position: 'absolute',
        top: '100%',
        right: '0',
        background: theme.background,
        padding: '12px',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
        display: 'none',
        gap: '10px',
        flexDirection: 'column',
        zIndex: '2147483648',
        marginTop: '8px',
        border: `1px solid ${theme.border}`,
        minWidth: '250px',
        fontSize: '13px'
      });
      const sourceLabel = document.createElement('div');
      sourceLabel.textContent = this._("settings.tts_source");
      sourceLabel.style.color = theme.text;
      sourceLabel.style.marginBottom = '4px';
      const sourceSelect = document.createElement('select');
      Object.assign(sourceSelect.style, {
        width: '100%',
        padding: '6px',
        borderRadius: '4px',
        border: `1px solid ${theme.border}`,
        background: isDark ? '#444' : '#fff',
        color: theme.text,
        marginTop: '4px'
      });
      this.selectSource = this.settings.ttsOptions?.defaultProvider || 'google';
      if (this.selectSource === 'openai') {
        this.selectVoice = this.settings.ttsOptions?.defaultVoice?.[this.selectSource]?.voice || 'sage';
        this.selectVoice = { name: this.selectVoice }
      } else if (this.selectSource === 'google') {
        this.selectVoice = this.settings.ttsOptions?.defaultVoice?.[this.selectSource]?.[lang] || null;
      } else {
        this.selectVoice = null;
      }
      this.voiceStorage[this.selectSource] = { voice: this.selectVoice };
      const sources = [
        { value: 'google', text: 'Google Cloud TTS' },
        { value: 'google_translate', text: 'Google Translate TTS' },
        { value: 'gemini', text: 'Gemini AI TTS' },
        { value: 'openai', text: 'OpenAI TTS' },
        { value: 'local', text: this._("notifications.device_tts") },
      ];
      sources.forEach(source => {
        const option = document.createElement('option');
        option.value = source.value;
        option.text = source.text;
        option.selected = this.selectSource === source.value;
        sourceSelect.appendChild(option);
      });
      const voiceLabel = document.createElement('div');
      voiceLabel.textContent = this._("settings.voice");
      voiceLabel.style.color = theme.text;
      voiceLabel.style.marginBottom = '4px';
      voiceLabel.style.marginTop = '8px';
      const voiceSelect = document.createElement('select');
      Object.assign(voiceSelect.style, {
        width: '100%',
        padding: '6px',
        borderRadius: '4px',
        border: `1px solid ${theme.border}`,
        background: isDark ? '#444' : '#fff',
        color: theme.text,
        marginTop: '4px'
      });
      const updateVoices = async (source, getVoice = false) => {
        voiceSelect.innerHTML = '';
        switch (source) {
          case 'local':
            if (speechSynthesis.getVoices().length === 0) {
              await new Promise(resolve => {
                speechSynthesis.onvoiceschanged = resolve;
              });
            }
            const localVoices = getLocalVoices(lang);
            localVoices.forEach(voice => {
              const option = document.createElement('option');
              option.value = JSON.stringify({ name: voice.name, provider: 'local' });
              option.text = voice.display;
              if (this.voiceStorage[this.selectSource]?.voice) {
                option.selected = this.voiceStorage[this.selectSource].voice.name === voice.name;
                voiceSelect.appendChild(option);
              } else {
                voiceSelect.appendChild(option);
              }
            });
            break;
          case 'gemini':
            CONFIG.TTS.GEMINI.VOICES.forEach(voice => {
              const option = document.createElement('option');
              option.value = JSON.stringify({ name: voice, provider: 'gemini' });
              option.text = voice;
              if (this.voiceStorage[this.selectSource]?.voice) {
                option.selected = this.voiceStorage[this.selectSource].voice.name === voice;
              }
              voiceSelect.appendChild(option);
            });
            break;
          case 'openai':
            CONFIG.TTS.OPENAI.VOICES.forEach(voice => {
              const option = document.createElement('option');
              option.value = JSON.stringify({ name: voice, provider: 'openai' });
              option.text = voice;
              if (this.voiceStorage[this.selectSource]?.voice) {
                option.selected = this.voiceStorage[this.selectSource].voice.name === voice;
                voiceSelect.appendChild(option);
              } else {
                voiceSelect.appendChild(option);
              }
            });
            break;
          case 'google':
            const getAllVoices = () => {
              CONFIG.TTS.GOOGLE.VOICES?.[lang].forEach(voice => {
                const option = document.createElement('option');
                option.value = JSON.stringify({ name: voice.name, provider: 'google' });
                option.text = voice.display;
                if (this.voiceStorage[this.selectSource]?.voice) {
                  option.selected = this.voiceStorage[this.selectSource].voice.name === voice.name;
                  voiceSelect.appendChild(option);
                } else {
                  voiceSelect.appendChild(option);
                }
              });
            }
            if (this.selectVoice) {
              if (getVoice) {
                getAllVoices();
              } else {
                const option = document.createElement('option');
                option.value = JSON.stringify({ name: this.selectVoice.name, provider: 'google' });
                option.text = this.selectVoice.display;
                voiceSelect.appendChild(option);
              }
            } else {
              getAllVoices();
            }
            break;
          case 'google_translate':
            if (CONFIG.LANGUAGEDISPLAY[lang]) {
              const voice = CONFIG.LANGUAGEDISPLAY[lang];
              const option = document.createElement('option');
              option.value = JSON.stringify({ name: voice.name, provider: 'google_translate' });
              option.text = voice.display;
              voiceSelect.appendChild(option);
            }
            break;
        }
        if (!voiceSelect.options.length) {
          const option = document.createElement('option');
          option.value = '';
          option.text = this._("notifications.tts_lang_no_voice") + ` ${lang}`;
          option.disabled = true;
          voiceSelect.appendChild(option);
        }
      };
      const createControl = (label, min, max, value, step) => {
        const container = document.createElement('div');
        container.style.width = '100%';
        container.innerHTML = `
<div style="color:${theme.text};margin-bottom:4px">${label}</div>
<div style="display:flex;align-items:center;gap:8px">
  <input type="range" min="${min}" max="${max}" value="${value}" step="${step}"
    style="flex:1;height:4px;-webkit-appearance:none;background:${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
      border-radius:2px;outline:none"/>
  <span style="color:${theme.text};min-width:36px;text-align:right">${value}</span>
</div>
`;
        const input = container.querySelector('input');
        const span = container.querySelector('span');
        input.oninput = () => span.textContent = input.value;
        return { container, input };
      };
      const speedControl = createControl(this._("settings.speed"), 0.1, 2, this.settings.ttsOptions.defaultSpeed, 0.1);
      const volumeControl = createControl(this._("settings.volume"), 0, 1, this.settings.ttsOptions.defaultVolume, 0.1);
      const pitchControl = createControl(this._("settings.pitch"), 0, 2, this.settings.ttsOptions.defaultPitch, 0.1);
      const getLocalVoices = (lang) => {
        const voices = window.speechSynthesis.getVoices();
        return voices.filter(voice => {
          return voice.lang.toLowerCase().includes(lang.toLowerCase());
        }).map(voice => ({
          name: voice.name,
          display: `${voice.name} (${voice.lang})`
        }));
      };
      let hideSettingsTimeout;
      const showSettingsButton = () => {
        clearTimeout(hideSettingsTimeout);
        settingsButton.style.opacity = "1";
        settingsButton.style.visibility = "visible";
        settingsButton.style.transform = "scale(1)";
      };
      const hideSettingsButton = () => {
        if (settingsPanel.style.display === 'flex') return;
        hideSettingsTimeout = setTimeout(() => {
          settingsButton.style.opacity = "0";
          settingsButton.style.visibility = "hidden";
          settingsButton.style.transform = "scale(0.8)";
        }, 150);
      };
      buttonContainer.addEventListener('mouseenter', showSettingsButton);
      buttonContainer.addEventListener('mouseleave', hideSettingsButton);
      let touchTimeout;
      buttonContainer.addEventListener('touchstart', () => {
        touchTimeout = setTimeout(showSettingsButton, 300);
      });
      buttonContainer.addEventListener('touchend', () => {
        clearTimeout(touchTimeout);
        hideSettingsButton();
      });
      buttonContainer.addEventListener('touchcancel', () => {
        clearTimeout(touchTimeout);
        hideSettingsButton();
      });
      let isPanelVisible = false;
      const showSettingsPanel = async () => {
        await updateVoices(this.selectSource, true);
        settingsPanel.style.display = 'flex';
        isPanelVisible = true;
        showSettingsButton();
      };
      const hideSettingsPanel = () => {
        settingsPanel.style.display = 'none';
        isPanelVisible = false;
        if (!buttonContainer.matches(':hover')) {
          hideSettingsButton();
        }
      };
      settingsButton.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (isPanelVisible) {
          hideSettingsPanel();
        } else {
          await showSettingsPanel();
        }
      });
      settingsButton.addEventListener('touchend', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isPanelVisible) {
          hideSettingsPanel();
        } else {
          await showSettingsPanel();
        }
      });
      document.addEventListener('click', (e) => {
        if (isPanelVisible && !settingsPanel.contains(e.target) && !settingsButton.contains(e.target)) {
          hideSettingsPanel();
        }
      });
      let speedValue, volumeValue, pitchValue;
      playButton.onclick = async () => {
        speedValue = speedControl.input.value;
        volumeValue = volumeControl.input.value;
        pitchValue = pitchControl.input.value;
        this.selectVoice = this.voiceStorage[this.selectSource]?.voice || JSON.parse(voiceSelect.value);
        this.playTTS(text, this.selectVoice.name, lang, { speedValue, volumeValue, pitchValue }, playButton, isDark);
        setTimeout(this.updateButtonState(playButton, isDark), 50);
      };
      sourceSelect.addEventListener('change', () => {
        this.selectSource = sourceSelect.value;
        updateVoices(this.selectSource, true);
        this.selectVoice = JSON.parse(voiceSelect.value);
        this.voiceStorage[this.selectSource] = { voice: this.selectVoice };
      });
      voiceSelect.addEventListener('change', async () => {
        speedValue = speedControl.input.value;
        volumeValue = volumeControl.input.value;
        pitchValue = pitchControl.input.value;
        this.selectVoice = JSON.parse(voiceSelect.value);
        this.voiceStorage[this.selectSource] = { voice: this.selectVoice };
        this.playTTS(text, this.selectVoice.name, lang, { speedValue, volumeValue, pitchValue }, playButton, isDark);
        setTimeout(this.updateButtonState(playButton, isDark), 50);
      });
      updateVoices(this.selectSource);
      this.updateButtonState(playButton, isDark);
      buttonContainer.appendChild(settingsButton);
      buttonContainer.appendChild(playButton);
      buttonContainer.appendChild(settingsPanel);
      settingsPanel.appendChild(sourceLabel);
      settingsPanel.appendChild(sourceSelect);
      settingsPanel.appendChild(voiceLabel);
      settingsPanel.appendChild(voiceSelect);
      settingsPanel.appendChild(speedControl.container);
      settingsPanel.appendChild(volumeControl.container);
      settingsPanel.appendChild(pitchControl.container);
      return buttonContainer;
    };
    createCopyButton(theme, isDark, text, baseFontSize) {
      const button = document.createElement("button");
      function updateCopyButtonIcon(isCopied) {
        button.innerHTML = '';
        if (isCopied) {
          const svgElement = createElementFromHTML(`
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4CAF50" stroke-width="2">
  <path d="M20 6L9 17l-5-5"/>
</svg>`);
          const textSpan = document.createElement('span');
          textSpan.style.cssText = `margin-left: 6px; color: #4CAF50;`;
          textSpan.textContent = 'Copied!';
          button.appendChild(svgElement);
          button.appendChild(textSpan);
        } else {
          const svgElement = createElementFromHTML(`
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
  <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
</svg>`);
          button.appendChild(svgElement);
        }
      }
      Object.assign(button.style, {
        display: "flex",
        alignItems: "center",
        padding: "8px 12px",
        border: "none",
        borderRadius: "8px",
        backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
        color: theme.text,
        cursor: "pointer",
        transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
        fontSize: `calc(${baseFontSize} - 1px)`
      });
      updateCopyButtonIcon(false);
      button.onmouseover = () => {
        button.style.backgroundColor = isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)";
        button.style.transform = "translateY(-1px)";
      };
      button.onmouseout = () => {
        button.style.backgroundColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
        button.style.transform = "translateY(0)";
      };
      button.onclick = async () => {
        try {
          await navigator.clipboard.writeText(text);
          updateCopyButtonIcon(true);
          button.style.backgroundColor = isDark ? "rgba(76,175,80,0.2)" : "rgba(76,175,80,0.1)";
          setTimeout(() => {
            updateCopyButtonIcon(false);
            button.style.backgroundColor = isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)";
          }, 2000);
        } catch (err) {
          console.error('Failed to copy:', err);
        }
      };
      this.addRippleEffect(button);
      return button;
    };
    addRippleEffect(button) {
      button.style.position = 'relative';
      button.style.overflow = 'hidden';
      button.addEventListener('click', (e) => {
        const ripple = document.createElement('div');
        const rect = button.getBoundingClientRect();
        const size = Math.max(button.offsetWidth, button.offsetHeight);
        ripple.style.cssText = `
position: absolute;
background: rgba(255,255,255,0.3);
border-radius: 50%;
pointer-events: none;
width: ${size}px;
height: ${size}px;
top: ${e.clientY - rect.top - size / 2}px;
left: ${e.clientX - rect.left - size / 2}px;
animation: ripple 0.6s ease-out;
transform: scale(0);
`;
        button.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);
      });
    }
    formatTranslation(text, theme, isDark, baseFontSize) {
      return text
        .split("<br>")
        .map((line, index) => {
          if (line.startsWith(`<b style="color: ${theme.text};">KEYWORD</b>:`)) {
            return `<div style="
margin: 12px 0 8px 0;
color: ${theme.text};
font-weight: 600;
font-size: calc(${baseFontSize} + 1px);
padding: 8px 12px;
background: ${isDark ? 'rgba(99,102,241,0.1)' : 'rgba(59,130,246,0.1)'};
border-left: 3px solid ${isDark ? '#6366F1' : '#3B82F6'};
border-radius: 0 8px 8px 0;
">${line}</div>`;
          }
          return `<p style="
  margin-bottom: ${index === 0 ? '8px' : '12px'};
  white-space: pre-wrap;
  word-wrap: break-word;
  text-align: justify;
  color: ${theme.text};
  line-height: 1.6;
  text-indent: ${line.length > 50 ? '1em' : '0'};
">${line}</p>`;
        })
        .join("");
    }
    makeDraggable(element, handle) {
      let pos1 = 0,
        pos2 = 0,
        pos3 = 0,
        pos4 = 0;
      handle.onmousedown = dragMouseDown;
      function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
      }
      function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        element.style.top = element.offsetTop - pos2 + "px";
        element.style.left = element.offsetLeft - pos1 + "px";
      }
      function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
      }
    }
    setupSelectionHandlers() {
      if (this._selectionMousedownHandler) {
        document.removeEventListener('mousedown', this._selectionMousedownHandler);
        document.removeEventListener('mousemove', this._selectionMousemoveHandler);
        document.removeEventListener('mouseup', this._selectionMouseupHandler);
        document.removeEventListener('touchend', this._selectionTouchendHandler);
      }
      if (!this.translationButtonEnabled) return;
      this._selectionMousedownHandler = (e) => {
        if (!e.target.classList.contains('translator-button')) {
          this.isSelecting = true;
          this.removeTranslateButton();
        }
      };
      this._selectionMousemoveHandler = (e) => {
        if (this.isSelecting) {
          const selection = window.getSelection();
          const selectedText = selection.toString().trim();
          if (selectedText) {
            this.removeTranslateButton();
            this.debouncedCreateButton(selection, e.clientX, e.clientY);
          }
        }
      };
      this._selectionMouseupHandler = (e) => {
        if (!e.target.classList.contains('translator-button')) {
          const selection = window.getSelection();
          const selectedText = selection.toString().trim();
          if (selectedText) {
            this.removeTranslateButton();
            this.createTranslateButton(selection, e.clientX, e.clientY);
          }
        }
        this.isSelecting = false;
      };
      this._selectionTouchendHandler = (e) => {
        if (!e.target.classList.contains('translator-button')) {
          const selection = window.getSelection();
          const selectedText = selection.toString().trim();
          if (selectedText && e.changedTouches?.[0]) {
            const touch = e.changedTouches[0];
            this.createTranslateButton(selection, touch.clientX, touch.clientY);
          }
        }
      };
      document.addEventListener('mousedown', this._selectionMousedownHandler);
      document.addEventListener('mousemove', this._selectionMousemoveHandler);
      document.addEventListener('mouseup', this._selectionMouseupHandler);
      document.addEventListener('touchend', this._selectionTouchendHandler);
    }
    createTranslateButton(selection, x, y) {
      this.removeTranslateButton();
      const button = document.createElement('button');
      button.className = 'translator-button';
      button.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
  <path d="M12.87 15.07l-2.54-2.51.03-.03c1.74-1.94 2.98-4.17 3.71-6.53H17V4h-7V2H8v2H1v1.99h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/>
</svg>`;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const buttonWidth = 60;
      const buttonHeight = 30;
      const padding = 10;
      let left = Math.min(x + padding, viewportWidth - buttonWidth - padding);
      let top = Math.min(y + 30, viewportHeight - buttonHeight - 30);
      left = Math.max(padding, left);
      top = Math.max(30, top);
      const themeMode = this.settings.theme;
      const theme = CONFIG.THEME[themeMode];
      Object.assign(button.style, {
        ...CONFIG.STYLES.button,
        backgroundColor: theme.button.translate.background,
        color: theme.button.translate.text,
        position: 'fixed',
        left: `${left}px`,
        top: `${top}px`,
        zIndex: '2147483647',
        userSelect: 'none'
      });
      this.shadowRoot.appendChild(button);
      this.currentTranslateButton = button;
      this.setupClickHandlers(selection);
    }
    handleTranslateButtonClick = async (selection, translateType) => {
      try {
        const selectedText = selection.toString().trim();
        if (!selectedText) {
          this.showNotification(this._("notifications.no_text_selected"));
          return;
        }
        const targetElement = selection.anchorNode?.parentElement;
        if (!targetElement) {
          this.showNotification(this._("notifications.no_target_element"));
          return;
        }
        this.removeTranslateButton();
        this.showTranslatingStatus();
        if (!this.translator) {
          throw new Error(this._("notifications.translator_instance_not_found"));
        }
        switch (translateType) {
          case "quick":
            await this.translator.translate(selectedText, targetElement);
            break;
          case "popup":
            await this.translator.translate(
              selectedText,
              targetElement,
              false,
              true
            );
            break;
          case "advanced":
            await this.translator.translate(selectedText, targetElement, true);
            break;
          default:
            console.log("Unknown translation type:", translateType);
        }
      } catch (error) {
        console.error("Translation error:", error);
      } finally {
        if (this.isDouble) {
          const newSelection = window.getSelection();
          if (newSelection.toString().trim()) {
            this.resetState();
            this.setupSelectionHandlers();
          }
        } else {
          this.resetState();
          return;
        }
      }
    };
    showTranslatingStatus() {
      if (!this.shadowRoot.querySelector("#translator-animation-style")) {
        const style = document.createElement("style");
        style.id = "translator-animation-style";
        style.textContent = `
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.center-translate-status {
  position: fixed;
  top: ${window.innerHeight / 2}px;
  left: ${window.innerWidth / 2}px;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.8);
  color: white;
  padding: 15px 25px;
  border-radius: 8px;
  z-index: 2147483647;
  display: flex;
  align-items: center;
  gap: 12px;
  font-family: "GoMono Nerd Font", "Noto Sans", Arial;
  font-size: 14px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.2);
}
.spinner {
  display: inline-block;
  width: 20px;
  height: 20px;
  border: 3px solid rgba(255,255,255,0.3);
  border-radius: 50%;
  border-top-color: #ddd;
  animation: spin 1s ease-in-out infinite;
}
`;
        this.shadowRoot.appendChild(style);
      }
      this.removeTranslatingStatus();
      const status = document.createElement("div");
      status.className = "center-translate-status";
      status.innerHTML = `
<div class="spinner" style="color: white"></div>
<span style="color: white">${this._("notifications.translating")}</span>
`;
      this.shadowRoot.appendChild(status);
      this.translatingStatus = status;
    }
    setupClickHandlers(selection) {
      this.pressTimer = null;
      this.isLongPress = false;
      this.isDown = false;
      this.isDouble = false;
      this.lastTime = 0;
      this.count = 0;
      this.timer = 0;
      const handleStart = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.ignoreNextSelectionChange = true;
        this.isDown = true;
        this.isLongPress = false;
        const currentTime = Date.now();
        if (currentTime - this.lastTime < 400) {
          this.count++;
          clearTimeout(this.pressTimer);
          clearTimeout(this.timer);
        } else {
          this.count = 1;
        }
        this.lastTime = currentTime;
        this.pressTimer = setTimeout(() => {
          if (!this.isDown) return;
          this.isLongPress = true;
          this.count = 0;
          const holdType =
            this.settings.clickOptions.hold
              .translateType;
          this.handleTranslateButtonClick(selection, holdType);
        }, 500);
      };
      const handleEnd = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!this.isDown) return;
        clearTimeout(this.pressTimer);
        if (this.isLongPress) return;
        if (this.count === 1) {
          clearTimeout(this.timer);
          this.timer = setTimeout(() => {
            if (this.count !== 1) return;
            const singleClickType =
              this.settings.clickOptions.singleClick
                .translateType;
            this.handleTranslateButtonClick(selection, singleClickType);
          }, 400);
        } else if (this.count >= 2) {
          this.isDouble = true;
          const doubleClickType =
            this.settings.clickOptions.doubleClick
              .translateType;
          this.handleTranslateButtonClick(selection, doubleClickType);
        }
        this.isDown = false;
      };
      this.currentTranslateButton.addEventListener("mousedown", handleStart);
      this.currentTranslateButton.addEventListener("mouseup", handleEnd);
      this.currentTranslateButton.addEventListener("mouseleave", () => {
        if (this.translateType) {
          this.resetState();
        }
      });
      this.currentTranslateButton.addEventListener("touchstart", handleStart);
      this.currentTranslateButton.addEventListener("touchend", handleEnd);
      this.currentTranslateButton.addEventListener("touchcancel", () => {
        if (this.translateType) {
          this.resetState();
        }
      });
    }
    setupDocumentTapHandler() {
      const touchOptions = this.settings.touchOptions;
      if (!touchOptions?.enabled) return;
      let touchCount = 0;
      let touchTimer = null;
      let isProcessingTouch = false;
      this._touchStartHandler = async (e) => {
        if (!touchOptions?.enabled) return;
        const target = e.target;
        if (
          target.closest(".translator-content") ||
          target.closest(".draggable") ||
          target.closest(".translator-tools-container")
        ) {
          return;
        }
        if (touchTimer) {
          clearTimeout(touchTimer);
        }
        touchCount = e.touches.length;
        touchTimer = setTimeout(async () => {
          switch (touchCount) {
            case 2:
              const twoFingersType = touchOptions.twoFingers?.translateType;
              if (twoFingersType) {
                const selection = window.getSelection();
                const selectedText = selection?.toString().trim();
                if (selectedText) {
                  e.preventDefault();
                  await this.handleTranslateButtonClick(
                    selection,
                    twoFingersType
                  );
                }
              }
              break;
            case 3:
              const threeFingersType = touchOptions.threeFingers?.translateType;
              if (threeFingersType) {
                const selection = window.getSelection();
                const selectedText = selection?.toString().trim();
                if (selectedText) {
                  e.preventDefault();
                  await this.handleTranslateButtonClick(
                    selection,
                    threeFingersType
                  );
                }
              }
              break;
            case 4:
              e.preventDefault();
              const settingsUI =
                this.translator.userSettings.createSettingsUI();
              this.shadowRoot.appendChild(settingsUI);
              break;
            case 5:
              e.preventDefault();
              if (isProcessingTouch) return;
              isProcessingTouch = true;
              this.toggleTranslatorTools();
              setTimeout(() => {
                isProcessingTouch = false;
              }, 350);
              break;
          }
          touchCount = 0;
          touchTimer = null;
        }, touchOptions.sensitivity || 100);
      };
      this._touchEndHandler = () => {
        if (touchTimer) {
          clearTimeout(touchTimer);
          touchTimer = null;
        }
        touchCount = 0;
      };
      document.addEventListener("touchstart", this._touchStartHandler, { passive: false });
      document.addEventListener("touchend", this._touchEndHandler);
      document.addEventListener("touchcancel", this._touchEndHandler);
    }
    toggleTranslatorTools() {
      if (this.isTogglingTools) return;
      this.isTogglingTools = true;
      try {
        const currentState =
          safeLocalStorageGet("translatorToolsEnabled") === "true";
        const newState = !currentState;
        safeLocalStorageSet("translatorToolsEnabled", newState.toString());
        const settings = this.settings;
        settings.showTranslatorTools.enabled = newState;
        this.translator.userSettings.saveSettings();
        this.removeToolsContainer();
        this.resetState();
        if (this.settings.translatorTools?.enabled && newState) {
          this.setupTranslatorTools();
        }
        this.showNotification(
          (this.settings.translatorTools?.enabled && newState) ? this._("notifications.translation_tool_on") : this._("notifications.translation_tool_off")
        );
      } finally {
        setTimeout(() => {
          this.isTogglingTools = false;
        }, 350);
      }
    }
    removeToolsContainer() {
      const container = this.$('.translator-tools-container');
      if (container) {
        const inputs = container.querySelectorAll('input');
        inputs.forEach(input => {
          input.removeEventListener('change', this.handleOCRInput);
          input.removeEventListener('change', this.handleMediaInput);
        });
        container.remove();
      }
    }
    async triggerGooglePageTranslate() {
      if (this.googleTranslateActive) {
        this.showNotification(this._("notifications.google_translate_already_active"), "info");
        return;
      }
      if (this.translator.page.isTranslated) {
        await this.translator.page.translatePage();
      }
      this.showNotification(this._("notifications.google_translate_enabled"), "success");
      this.googleTranslateActive = true;
      this.googleTranslateAttempts = 0;
      const targetLang = this.settings.displayOptions.targetLanguage;
      const layoutType = this.settings.pageTranslation.googleTranslateLayout;
      let gtDiv = document.querySelector('#google_translate_element');
      if (!gtDiv) {
        gtDiv = document.createElement('div');
        gtDiv.id = 'google_translate_element';
        gtDiv.style.display = 'none';
        document.body.appendChild(gtDiv);
      }
      unsafeWindow.googleTranslateElementInit = () => {
        new unsafeWindow.google.translate.TranslateElement({
          pageLanguage: 'auto',
          includedLanguages: targetLang,
          layout: unsafeWindow.google.translate.TranslateElement.InlineLayout[layoutType],
          autoDisplay: false
        }, 'google_translate_element');
        const interval = setInterval(() => {
          const translateFrame = document.querySelector('.goog-te-combo');
          if (translateFrame && translateFrame.value !== targetLang) {
            translateFrame.value = targetLang;
            translateFrame.dispatchEvent(new Event('change'));
          }
          const topBar = document.querySelector('.goog-te-banner-frame');
          if (topBar) {
            topBar.style.display = 'none !important';
            topBar.style.visibility = 'hidden !important';
            topBar.style.height = '0px !important';
            topBar.style.border = 'none !important';
            topBar.style.boxShadow = 'none !important';
            topBar.style.opacity = '0 !important';
            clearInterval(interval);
            console.log("Google Translate top bar hidden.");
          } else {
            this.googleTranslateAttempts++;
            if (this.googleTranslateAttempts > 100) {
              clearInterval(interval);
              console.warn("Could not hide Google Translate top bar after multiple attempts.");
            }
          }
        }, 50);
      };
      const scriptId = 'google-translate-api-script';
      if (!document.querySelector(`#${scriptId}`)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.type = 'text/javascript';
        script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
        document.body.appendChild(script);
      }
    }
    removeGoogleTranslate() {
      if (this.googleTranslateActive) {
        this.googleTranslateActive = false;
        location.reload();
      }
    }
    async handlePageTranslation() {
      const settings = this.settings;
      if (!settings.pageTranslation?.enabled && !settings.shortcuts?.enabled) {
        this.showNotification(this._("notifications.page_translation_disabled"), "warning");
        return;
      }
      try {
        this.showTranslatingStatus();
        const result = await this.page.translatePage();
        if (result.success) {
          const toolsContainer = this.$(
            ".translator-tools-container"
          );
          if (toolsContainer) {
            const menuItem = toolsContainer.querySelector(
              '[data-type="pageTranslate"]'
            );
            if (menuItem) {
              const itemText = menuItem.querySelector(".item-text");
              if (itemText) {
                itemText.textContent = this.page.isTranslated
                  ? this._("notifications.original_label") : this._("notifications.page_translate_menu_label");
              }
            }
          }
          const floatingButton = this.$(
            ".page-translate-button"
          );
          if (floatingButton) {
            floatingButton.textContent = this.page.isTranslated
              ? `📄 ${this._("notifications.original_label")}` : `📄 ${this._("notifications.page_translate_menu_label")}`;
          }
          this.showNotification(result.message, "success");
        } else {
          this.showNotification(result.message, "warning");
        }
      } catch (error) {
        console.error("Page translation error:", error);
        this.showNotification(error.message, "error");
      } finally {
        this.removeTranslatingStatus();
      }
    }
    setupQuickTranslateButton() {
      const settings = this.settings;
      if (!settings.pageTranslation?.enabled && !settings.shortcuts?.enabled) {
        this.showNotification(this._("notifications.page_translation_disabled"), "warning");
        return;
      }
      const style = document.createElement("style");
      style.textContent = `
.page-translate-button {
  position: fixed;
  bottom: 20px;
  left: 20px;
  z-index: 2147483647;
  padding: 8px 16px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  transition: all 0.3s ease;
}
.page-translate-button:hover {
  background-color: #45a030;
  transform: translateY(-2px);
}
`;
      this.shadowRoot.appendChild(style);
      const button = document.createElement("button");
      button.className = "page-translate-button";
      button.textContent = this.page.isTranslated
        ? `📄 ${this._("notifications.original_label")}` : `📄 ${this._("notifications.page_translate_menu_label")}`;
      button.onclick = async () => {
        try {
          this.showTranslatingStatus();
          const result = await this.page.translatePage();
          if (result.success) {
            button.textContent = this.page.isTranslated
              ? `📄 ${this._("notifications.original_label")}` : `📄 ${this._("notifications.page_translate_menu_label")}`;
            const toolsContainer = this.$(
              ".translator-tools-container"
            );
            if (toolsContainer) {
              const menuItem = toolsContainer.querySelector(
                '[data-type="pageTranslate"]'
              );
              if (menuItem && menuItem.querySelector(".item-text")) {
                menuItem.querySelector(".item-text").textContent = this.page
                  .isTranslated
                  ? this._("notifications.original_label") : this._("notifications.page_translate_menu_label");
              }
            }
            this.showNotification(result.message, "success");
          } else {
            this.showNotification(result.message, "warning");
          }
        } catch (error) {
          console.error("Page translation error:", error);
          this.showNotification(error.message, "error");
        } finally {
          this.removeTranslatingStatus();
        }
      };
      this.shadowRoot.appendChild(button);
      setTimeout(() => {
        if (button && button.parentNode) {
          button.parentNode.removeChild(button);
        }
        if (style && style.parentNode) {
          style.parentNode.removeChild(style);
        }
      }, 10000);
    }
    setupTranslatorTools() {
      let isEnabled = false;
      if (safeLocalStorageGet("translatorToolsEnabled") === null) safeLocalStorageGet("translatorToolsEnabled") === "true";
      if (safeLocalStorageGet("translatorToolsEnabled") === "true") isEnabled = true;
      if (!this.settings.translatorTools?.enabled || !isEnabled) return;
      if (this.$(".translator-tools-container")) return;
      // bypassCSP();
      this.createToolsContainer();
    }
    createToolsContainer() {
      const settings = this.settings;
      const container = document.createElement("div");
      container.className = "translator-tools-container";
      container.setAttribute("data-permanent", "true");
      container.setAttribute("data-translator-tool", "true");
      const closeButton = document.createElement("span");
      closeButton.textContent = "×";
      Object.assign(closeButton.style, {
        cursor: "pointer",
        fontSize: "16px",
        color: "#ffffff",
        backgroundColor: "rgba(85, 85, 85, 0.28)",
        padding: "0 3px",
        opacity: "0.8",
        transition: "all 0.2s ease",
        fontWeight: "bold",
        display: "flex",
        position: "absolute",
        top: "-8px",
        right: "-8px",
        alignItems: "center",
        justifyContent: "center",
        width: "20px",
        height: "20px",
        borderRadius: "50%"
      });
      closeButton.onmouseover = () => {
        Object.assign(closeButton.style, {
          opacity: "1",
          backgroundColor: "#ff4444"
        });
      };
      closeButton.onmouseout = () => {
        Object.assign(closeButton.style, {
          opacity: "0.8",
          backgroundColor: "transparent"
        });
      };
      closeButton.onclick = () => {
        this.removeToolsContainer();
      };
      this.handleOCRInput = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          this.showTranslatingStatus();
          const result = await this.ocr.processImage(file);
          this.removeTranslatingStatus();
          if (!result) {
            throw new Error(this._("notifications.un_pr_screen"));
          }
          this.formatTrans(result);
        } catch (error) {
          this.showNotification(error.message, "error");
        } finally {
          this.removeTranslatingStatus();
        }
      };
      this.handleMediaInput = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          this.showTranslatingStatus();
          await this.media.processMediaFile(file);
          this.removeTranslatingStatus();
        } catch (error) {
          this.showNotification(error.message);
        } finally {
          this.removeTranslatingStatus();
        }
      };
      const ocrInput = document.createElement("input");
      ocrInput.type = "file";
      ocrInput.accept = "image/*";
      ocrInput.style.display = "none";
      ocrInput.id = "translator-ocr-input";
      ocrInput.addEventListener("change", this.handleOCRInput);
      const mediaInput = document.createElement("input");
      mediaInput.type = "file";
      mediaInput.accept = "audio/*, video/*";
      mediaInput.style.display = "none";
      mediaInput.id = "translator-media-input";
      mediaInput.addEventListener("change", this.handleMediaInput);
      const mainButton = document.createElement("button");
      mainButton.className = "translator-tools-button";
      const mainIcon = document.createElement("span");
      mainIcon.className = "tools-icon";
      mainIcon.textContent = "⚙️";
      mainButton.appendChild(mainIcon);
      const dropdown = document.createElement("div");
      dropdown.className = "translator-tools-dropdown";
      const menuItems = [];
      if (settings.pageTranslation?.enabled) {
        menuItems.push({
          icon: `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAACXBIWXMAAAsTAAALEwEAmpwYAAACPElEQVR4nN2S30uTURyHvekfiIIgUMypr24q8x2k9LqJbOuN3NTJTEUrl02tFUUIdmVkchS8qa6ypB/mkiW1qWEpQTjpD8k/wssnvkPltbLjZXTgge2c5/NcjBUV/TeneASzOEVQKLnJbMkNMrs827sX58jBqkHcxhCPq4bAwc7++xA7zreCO4hbGzYTKPMaId8AZ/aoT/DJTHJMkM/ON3Flow1bl1GNVzAO3PXRbvXzQWjqp835Jq5stOFQLyrcczAsx45zMtDDiV/vxZWNNtzWhYrFMKLd+Nq6uPM3xBFXNtpwdweqJ4YRj+Pq7aT1AF0EL3XS3JckIsT7KBVXNtpwIoJKtmIkolxMRHnlZCDK2Yk8wUebIEx+417BjRwhfOsCKhXGSJ0nlrLJOrltY73ZwH67DsL8BmPiykYbHg2h7ocxRoOUj4Zpd3K3hdObq9hbKyDklxkruKEjhB80o8YDGA/91IwHuOpkoonSHxmOb7/n+vYSye0lysWVjTY8baFmAhhTfmLTFlknU+ewZvx497/7iYkrG234aQPqSePv/+PDjriy0YovfKiX5uHh515ccyZrcz4yBUzWZKMNp+tQCybGQi3WfA2V72ppXfTSvViLR0h7sdNehtN1dCzW0yCubLThnBu17MHIuRnJVdOS9TCZ8zD70U1EyFVjZz0M5zy8Xq3m1K6rD3+pRH2uOPyn2KjAXq9keO+7uLLRhjfL6N8qY2XLReZP5F18zbv4vn9XxopstOF//vwEcbLHwTzAksEAAAAASUVORK5CYII=" alt="${this._("notifications.page_translate_menu_label")}">`,
          text: this.page.isTranslated ? this._("notifications.original_label") : this._("notifications.page_translate_menu_label"),
          "data-type": "pageTranslate",
          handler: async () => {
            try {
              dropdown.style.display = "none";
              this.showTranslatingStatus();
              const result = await this.page.translatePage();
              this.removeTranslatingStatus();
              if (result.success) {
                const menuItem = dropdown.querySelector(
                  '[data-type="pageTranslate"]'
                );
                if (menuItem) {
                  const itemText = menuItem.querySelector(".item-text");
                  if (itemText) {
                    itemText.textContent = this.page.isTranslated
                      ? this._("notifications.original_label") : this._("notifications.page_translate_menu_label");
                  }
                }
                this.showNotification(result.message, "success");
              } else {
                this.showNotification(result.message, "warning");
              }
            } catch (error) {
              console.error("Page translation error:", error);
              this.showNotification(error.message, "error");
            } finally {
              this.removeTranslatingStatus();
            }
          }
        });
      }
      if (settings.pageTranslation?.enableGoogleTranslate) {
        menuItems.push({
          icon: `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAACXBIWXMAAAsTAAALEwEAmpwYAAAD3UlEQVR4nK2Ub0wbdRjHO//E+MYYjS9MTIxv8IWJLyTq3gH9XdcS1jJtWKL9u8xJ2NJNNnZ3vVoKuD+tQClkyOTuBmVu6rIx3e5aaLuNoPTK7CSaDc0GCLrNuVg2HIzZXu8xd+CLVVo085t8X1x+z/P5fX/Pk5xKlUcJtbpMQOiggGE/CggtCBiWSWDYTUGjGYojtDup1T6br3dlYFlZcQLDLggIwXdGY+bazp1wgyDgam0tTG/bBpdMJimh0YhxhNKCWu2Pr137+KrQuFpdLSe7ZDKJf/h8sNjWpnje54NUfT3c8XqV74WWFvippgbkywWERsDjeagwFCG4Xle31NzaCjMOh/SNTpddBihOVlSk5eTfb9wop54XSktfLwR9RUBI/HUZmmpogIRGIwOnBIS2xzGsZBShohEMQwmEAgkMuytg2J2CUFln92mDY1Vv3Fvw++F3t/vvdI3HqqoeXnEPJSXPyWEKQqMf616N0Dr4+bx7/nobeW9Uo4G4Wl2velAN0tqOxHFTRkr1wcXo1sXhLVh/srj40QcGx9iKsWtjTQCpw3Dm0HoYpLXbc2vWk6F1lVTorIHih1bxOYOLq1KaIkz53bnJdsimgiCPRB5NLlhPcXYDxUN1x4UVXXNgDPDgFXhr7znR4OSbl8C0Tpyf6QTxZo8CDjPaF/OBm8O3C3pLezKjp/iDSlOUKZ+9dbkV5BkvJdZi+cD5/I5/VAGbvcN/GijOswSmy7+ajOMSzPbB8BEj9HUbG3PBG0i+SE9x7+ba4ORq9U4+S306rYArXSFJ7+TMSpO8rNihCpi7ykgdYe+ElcYXzd27Xvg3i9c7eUqGfRi6BU39N+T04gay/2nlcIBe99TR7jfHA0PMbW5iAHZ89oFoY4nztp4dTxaEkpzO4OLT5JEpJe0mv5AxUDx/X5GFxgObeykIT0UVb/3EI9oZ4gcbTZTmAh3tjscsLP6ecU9P1NY8oqR1f/4LGJxcVv9++KX7ik2HHU/YGXKSOOnLRqZjMDAVAzfXlrEyONhZ4qKVxnssNO61MfhRO0vO2lhS2hvplPZ8EZ/Dg5ezla4Q6J18w4pPs3STRTaG+K3u+D4xNBmByPQZOHUlBB/Fg9DABTJ4vze9P9qV7fv2GAxOxZTzwBAL5gO+8UrXl10qFazJO7e3mV3P21kyaWMJqfPrXomfGFQAuT4xfhqoUy2ilcGzFnp3vafQ/1i1rBKP5xErjVfbWXJGHsXmXirrPNmSaQp1ZPAT+9PypTLQxhCnrXTdy6sC/yFQrbHS+GvyouTlWmm8y8rgjVaaMG9inc/8d+D/pL8Aw3mxX2X1GHoAAAAASUVORK5CYII=" alt="${this._("notifications.google_translate_page_menu_label")}">`, // Icon cho Google Translate
          text: this._("notifications.google_translate_page_menu_label"),
          "data-type": "googlePageTranslate",
          handler: () => {
            dropdown.style.display = "none";
            this.triggerGooglePageTranslate();
          }
        });
      }
      if (settings.ocrOptions?.enabled) {
        menuItems.push(
          {
            icon: `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAfUlEQVR4nGNgYGBgmHLwxn9kzIAHYFU7hVoGMJAAqGsA1UCm3v+DWXr//2fp/T+Oxv9fb/+fJVP3/29keUwDdP//hilEpnHJk2VAlt7//5l6/6+S7YJs/f8Ombr/v4SG/mfGZsB+qA3HkPnIYYDXC2SDKQOekKYMeGaiBAAAKXcJNrF/Bp0AAAAASUVORK5CYII=" alt="${this._("notifications.ocr_region_menu_label")}">`,
            text: this._("notifications.ocr_region_menu_label"),
            handler: async () => {
              try {
                dropdown.style.display = "none";
                await new Promise((resolve) => setTimeout(resolve, 100));
                const screenshot = await this.ocr.captureScreen();
                if (!screenshot) {
                  throw new Error("Không thể tạo ảnh chụp màn hình");
                }
                this.showTranslatingStatus();
                const result = await this.ocr.processImage(screenshot);
                this.removeTranslatingStatus();
                if (!result) {
                  throw new Error(this._("notifications.un_pr_screen"));
                }
                this.formatTrans(result);
              } catch (error) {
                console.error("Screen translation error:", error);
                this.showNotification(error.message, "error");
              } finally {
                this.removeTranslatingStatus();
              }
            }
          },
          {
            icon: `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAACXBIWXMAAAsTAAALEwEAmpwYAAACQklEQVR4nO2T3UtTcRjHhSAmhUHRjTeNkSdoDjf0bO5Mmst5qFZo2LroRdeL0YQugg2NgsPxts2CIrZQxGAbrSydK6W9SS9CUHThfS9XQf/EJ06bbmtaehHd+IXvxfPleT78fg+/X13dlv6b9H6G9UNM7xsiuSH7eaIfIvxH6EEv242DfDBdZngzNg6yvP8aDeuCbT7GbQP02QZo3Yyt/cg2H8/WBbvPMrPRld14zd5bb7iovKXxr7MnT/F8o+CJLPMTWZjIslQze6YH07lerlT4U1Xdg++Sl91rgQtzPC6koZBmQavP91aArx5j0e/Bu66Pc8HvIbIW+Mskuq/THP7+iB0lVhkc6K69etBNU1Cmd1imRXGiC8p8DrqLe9SkONkZkLkZkBm53k79mizVVQsePYRp1IlP7cKugdVO3qkuMoqbRuUIDWonLxQXstqJR3Uxd7u7eOIqVkjiW8jB0zEHp7U6LHE/5GAm1IFQOp0u5CAx1oEhJJEJS7wck2hbmb8jYQ9LRXhYqgBHrSxHbfRFRUai1uLviYh0RUTuRq14J53oIiIJLX/QhiEikhuXymsp9dsjVuaiIq9Ww5iZXMJMIGbhYdyMEm/Bk2xlV6IF/ZTIHg0cNxfBv/rbMMQtZOKWanjMgj1m4cdqkDIWH/WsETVl5MRsM1OVA8l26lPNZbCmtAlDykhm5kAZnvSyLdXM/GpTXuBevolkromFnMBiXuCjVq84J5DOC7yvzEr9hbzAUkU2mxU4+vtD2FLdP9FPOyyiEx9ZF+gAAAAASUVORK5CYII=" alt="${this._("notifications.web_image_ocr_menu_label")}">`,
            text: this._("notifications.web_image_ocr_menu_label"),
            handler: () => {
              dropdown.style.display = "none";
              this.startWebImageOCR();
            }
          },
          {
            icon: `<img src="https://github.com/king1x32/King-Translator-AI/raw/main/icon/comic.png" alt="${this._("notifications.manga_web_menu_label")}">`,
            text: this._("notifications.manga_web_menu_label"),
            handler: () => {
              dropdown.style.display = "none";
              this.startMangaTranslation();
            }
          },
          {
            icon: `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAACXBIWXMAAAsTAAALEwEAmpwYAAACKUlEQVR4nO2Sz0uTcRzHn6hTJ+tQHRTMyOmW5HCPxAbPk0zRLZyUPSxCkWfgLNzYKTZDarhVj1B7oovtuXSI7TAaj6VukIp5CD177RAE/R2vGGms/XhaHqM3vC6fz+f94nv4CsL/1KZjnkB7BO1v6ZgnJgicEJqlN8zH7jA99jlu28MordBzn4HeObL2OexNxS4V0xViyaWy4lLRWiLE2oBKUpyhv6lYmsaUptDlGTqbHjXoyNMkZSuxP4jpD6KPBhuL07tMPNmlpO3QXt25ESTpv2shViYxlUl0ZZJ7d8Y5X7svbfC6XIJymdGaTlJRLMRqADMUQA8FWFQDFEMBlh/LnDraf//A6W9FxNqOOk5yZsJCHB3DjPjQo2NsR3xoER+zUR/PmhYOO1EfyZjfQhwfxox70RNenie8BONeVuJejIURrlTfPRjCFh+mnPBS+I1hSvERpurEaQkzJaGnZRbSEkZKJrckcSsl8bDm7lVqiEuNHpeW2agbZtyYugdfxsO7jJtSxs3a4Ww946bwCw9fdZm2SufFNfoyHhLVjjpxVuSLIbKcHUSzwhA5eHOVNkPkpjFIzhDZzw7yqOIwxAbivJNPuX6UP+JkpyIu2Dmb68efd/Lybd/Pv513NhCbDq6vOni66kCz4r2Dg/U+zlQ663YuVHpHjlVHA3Gr2bIR27QR3bxMVzXbNtxb3RSF46YgcHKvk9n9i2jV7HWx+LmLc8cWC/9sfgCb97UQIppPcwAAAABJRU5ErkJggg==" alt="${this._("notifications.image_file_menu_label")}">`,
            text: this._("notifications.image_file_menu_label"),
            handler: () => ocrInput.click()
          }
        );
      }
      if (settings.mediaOptions?.enabled) {
        menuItems.push({
          icon: `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAACXBIWXMAAAsTAAALEwEAmpwYAAACLUlEQVR4nNWMz0sTcBjGd4gORXTqWEYx3ISZ25iy1ea23MzpNEpbBGITW2yoGJsNkblDsFUopZdSTMMtrDVnaGtlabsEdezkpZCCpOg/6PKJb7iG7ocyL/XAc3jf5/k8Esl/r7JuZEe6qZNfZ1k1xOeM5X4+HnZjFdlWC6boqNTNsXIXS7KrTLWO8HNsBTLufcivCjevZS78Wy0YwRYcNvYwbbnGmt3Pl+l5mHuZdSwJrYN8a+xndasFI9iCwxf6+PR+AUqxYAsON3XwtauH1VIs2ILDzQ7mJSWqKOs4X/pwUdbZvP3w5RYUTjsu4Y4WqnbEemzbD3tspN2NtLkbuOG24dsR67Pkhr56tD4Lc14Lz8TttbDmtRLzWol4bZQVY/8qYNocBk2cGzITHzRhDpgJZTrBNvYGjNQUYzcpbMiGN+s4GDaQDulxhPXMhPRYb5s4LjrBWvaE9azc0nEgH5ujUV02vKPDMaql/a6WVyM2PMOdfB928mPUwJuN/MrYSRrysTma0GTDiWr67ms4PaGhafIM72aT8DgJk/V8GK/h4r0aLOMaevOxOYoqeR5VMfBIiT+q5ElESaf4z5q4lDjLeqKF9dlTtEdVpCJqukTnT1fFQETJYsHhmUr2zytQCydOUB1XsLygZp/IYlUcSihoiFfyNF6JfU7Biuhk+oKV7FTJCswv5Cymyjkq7pSc/iUZtRs/o2Q3SkuRp6VMpaXEhN9KeSB+uxr9J/UbsfXQjgkgRpYAAAAASUVORK5CYII=" alt="${this._("notifications.media_file_menu_label")}">`,
          text: this._("notifications.media_file_menu_label"),
          handler: () => mediaInput.click()
        });
      }
      menuItems.push({
        icon: `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAACXBIWXMAAAsTAAALEwEAmpwYAAABxklEQVR4nNWUv0sbYRyHIwaEgn9AhzgYq6EeCXgpB0nT5ISUUHAIKEp+oNCAGilpaZAOUQdJa5eokw4KcUuCopcEJQaXZHHo/9GpHVpKx6ckWknIte+dm1/48HLH93neDzecxfLgx7bCri3J8VCS0n9SH01zYpmh37B4bIkz4c4iATXDL/d7aoblzgSnoh3XawIfdviRO+R3IMWlfwOrUKwsiMXP4oxG3vJ96xPfYu/4GVykIBSrUbG4Nb5ZbGoEuZVAjJoQCM0ZE5tmwtPmxYaYSNi82BCTmDIvNsSsvDIvNsSkg+bF6SAvhUtrqjHxhh/r+iSpdZXy2iTa7bn6JsSALvDxhVjckmZ9lLJ+lrHQd8f6mM/60Hb15DmPWJzzktr2sHz3/Jx4Bx/d9pLpgfYUsXhfodLZdF/p/nHtKVR7oLzMVV7GfuhmWC8HHgbz8s3lR27i+QnOjib42j5llm4dveWKLq4LTrb+GRfeoqu7cdHZ3bjg1GlcltjRJI7L45R0I/FZG2dVe8p8B9Nu2pqKRFiT2BR9Tt05H2Gg7kCrjxHtfF9zEL50cFGWeXQv8V958wmZpp1qYwStaafSsLP55fGN9A/mHCTEh8xvxQAAAABJRU5ErkJggg==" alt="${this._("notifications.generic_file_menu_label")}">`,
        text: this._("notifications.generic_file_menu_label"),
        handler: () => {
          dropdown.style.display = "none";
          const supportedFormats = RELIABLE_FORMATS.text.formats.map(f => `.${f.ext}`).join(',');
          const input = document.createElement("input");
          input.type = "file";
          input.accept = supportedFormats;
          input.style.display = "none";
          input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            try {
              this.showTranslatingStatus();
              const result = await this.translator.translateFile(file);
              console.log(file.type);
              const blob = file.type.endsWith('pdf') ? result : new Blob([result], { type: file.type });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `king1x32_translated_${file.type.endsWith('pdf') ? file.name.replace(".pdf", ".html") : file.name}`;
              this.shadowRoot.appendChild(a);
              a.click();
              URL.revokeObjectURL(url);
              a.remove();
              this.removeTranslatingStatus();
              this.showNotification(this._("notifications.file_translated_success"), "success");
            } catch (error) {
              console.error(this._("notifications.file_translation_error"), error);
              this.showNotification(error.message, "error");
            } finally {
              this.removeTranslatingStatus();
            }
          };
          input.click();
        }
      }, {
        icon: `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAACXBIWXMAAAsTAAALEwEAmpwYAAAB8klEQVR4nNWRz2uScRzHPXSpXeq2Wz8gGxsKGpopmwh7LG09K0gYHQpm2xAdFel8IlbdErpoHWoeGil0WFSLhpJD/Rs67VJEQaf+gy6v+Mzk0X2fZ2ye2hve8OXzfr/ePPA4HAdexzOMnEwx6crR9D/kW9fuJb6cSBGVbKeF2XXUleLU2DybY3O8Sjzld7ENXS++5o9rgc3RefKK52gIazscSbOq3eG7nuNH+SO8aZiu1uHaA35dzrK108IIazs8c5uvzQ0YxMLaDus3+HkrzdYgFtZ2+EqCD44BtSs7c7U/nJriyPVLHOv1zWmO7oXtU1I3w+Q08Vmd+qzOSq+TOjW5JxIctmMVpeNmmIljLF4koHRiaJkY7zMx1u/2jPeyirKaGWajGEuT6vA9jaFclJe5KM2sRtqKVbQcMcPlCMajsDrclWTSsWIVPZkww8I4RiFMoDDOhcIE632WWyczrFhFpaAZFs9jlEKdL34WYKEUpCiW93Y3REA6Vqyiss8MV3wYZX9neNXH8ItzxMXy3u76CUjHilVU8bBR8XK/4iFf9VKvejvD7TCHqh4ei+UtN8mkI91/zCf7YTdDay7Oit+6ef7OZf/zJJNOty+sYy+qjZKvjdgPSyYdx37VchJqOWm0TrNm5baTz80zBPc9/N/qL/loyWQnG2fwAAAAAElFTkSuQmCC" alt="documents-folder">`,
        text: this._("notifications.generic_file_gemini_menu_label"),
        handler: () => {
          dropdown.style.display = "none";
          this.handleGeminiFileOrUrlTranslation();
        }
      },
        {
          icon: `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAACXBIWXMAAAsTAAALEwEAmpwYAAADR0lEQVR4nM2S30/bZRTGO83EOX8kLtlcRKeOFa1tkTXwLVOEDgztaNkmli2jWGK+dDgobK5bvEC/6LIEY6ZZ2cbKhM0xllFp+bZCR1taEGVXJuqlLtmNt/o3fMwZssREuoQs0ZM8yTnPeZ4nb973NRj+y9rWywvF3XwpkP6BBZcc5kppJ6UvqxilX1OIyc8zFpU+awBF5tL3eMKqMrOyt6hMV7bypPSiEa14CoY6gxRV+slUtbNL8XNR8aNXtpOofp9dx25RIpBeONkp7UTsfl6v9JMV76rBjnfZXuPj/MocTFF8/AcuhpZIHF/izN/QQ0sMHf6WZ1d04qk7xEsFT+06yGXXISzaIqaPvyfbt4DluSO8WtxFl+D5ICZtEau2SKZvgVcaWzCL5753/LaXwDtteAcWmDudYIulgyGLyohZZb/A0sGoWeW8lmbzwHdkW3w0i6dAJOt8Hl5s3cdsOE1POM8BRysfOXzLpmiUhzWNh6Tf3Uano5Xg4DwHv0jTJZ4De//lGwa8PNXhYVZ1Mxhws3NkjsnPr7KxpZmc7CMZaiI5/hzO8cfwHNXCeZvJi0a0aiO2Dg/nJCPoXP4xd6u7gfoeF90r8400eqCBrV17GJF5PM3E9QwIrqWZEO7IHkZFI9p7j+0k2OOk7l5wyMH2k2+hf1hHfdBJUTJFIuLmsf7a5f+r36Q3eRMSghRB4WR3xssG0YrnRD11kiFZ/7gOrQZzfy29/bUkstOczqaoOKcwfraKctnnk9TkpnlT+gsKtkE7w/lplLkZTmkOdG03RyVj1Sf87A0+Heuk6VYSPWZj60QZszfK2JcqoUgQLWO/cPEKNi0lSYwG8AxU84nhfhW2czKs4Pp5irZfphia9/J4bgcn8kZmBLkdhNI+Nsrupzi+cBWNZ6sIFQz9uoJNlyrQMbBO5tsxmm7HyfwW4+ivU1QLpL/LxXGLRrTiuWTn6VWDr5vZMvYayaiJR8bL8YyVEx1X+ODOFZp+/4Zjgjtf0SSc7K7txB2xsV48V61sLnjqSSsNk1YSMSunLm/j0biFvTHL8heTkl64qJ0Nopm0osesOA1rqZSJqR9trBfMmIgbHlQtGHHljSQF88Y1nu5/X38B2jUbWROlf8IAAAAASUVORK5CYII=" alt="settings--v1">`,
          text: this._("notifications.settings"),
          handler: () => {
            dropdown.style.display = "none";
            const settingsUI = this.translator.userSettings.createSettingsUI();
            this.shadowRoot.appendChild(settingsUI);
          }
        });
      menuItems.forEach((item) => {
        const menuItem = document.createElement("div");
        menuItem.className = "translator-tools-item";
        if (item["data-type"]) {
          menuItem.setAttribute("data-type", item["data-type"]);
        }
        const itemIcon = document.createElement("span");
        itemIcon.className = "item-icon";
        const iconElement = createElementFromHTML(item.icon);
        if (iconElement) {
          itemIcon.appendChild(iconElement);
        }
        const itemText = document.createElement("span");
        itemText.className = "item-text";
        itemText.textContent = item.text;
        menuItem.appendChild(itemIcon);
        menuItem.appendChild(itemText);
        menuItem.handler = item.handler;
        menuItem.addEventListener("click", item.handler);
        dropdown.appendChild(menuItem);
      });
      this.handleButtonClick = (e) => {
        e.stopPropagation();
        dropdown.style.display =
          dropdown.style.display === "none" ? "block" : "none";
      };
      mainButton.addEventListener("click", this.handleButtonClick);
      this.handleClickOutside = () => {
        dropdown.style.display = "none";
      };
      document.addEventListener("click", this.handleClickOutside);
      container.appendChild(closeButton);
      container.appendChild(mainButton);
      container.appendChild(dropdown);
      container.appendChild(ocrInput);
      container.appendChild(mediaInput);
      this.shadowRoot.appendChild(container);
      if (!this.shadowRoot.contains(container)) {
        this.shadowRoot.appendChild(container);
      }
      container.style.zIndex = "2147483647";
    }
    showProcessingStatus(message) {
      this.removeProcessingStatus();
      const status = document.createElement("div");
      status.className = "processing-status";
      status.innerHTML = `
<div class="processing-spinner" style="color: white"></div>
<div class="processing-message" style="color: white">${message}</div>
<div class="processing-progress" style="color: white">0%</div>
`;
      Object.assign(status.style, {
        position: "fixed",
        top: `${window.innerHeight / 2}px`,
        left: `${window.innerWidth / 2}px`,
        transform: "translate(-50%, -50%)",
        backgroundColor: "rgba(0, 0, 0, 0.8)",
        color: "white",
        padding: "20px",
        borderRadius: "8px",
        zIndex: "2147483647",
        textAlign: "center",
        minWidth: "200px"
      });
      this.shadowRoot.appendChild(status);
      this.processingStatus = status;
    }
    updateProcessingStatus(message, progress) {
      if (this.processingStatus) {
        const messageEl = this.processingStatus.querySelector(
          ".processing-message"
        );
        const progressEl = this.processingStatus.querySelector(
          ".processing-progress"
        );
        if (messageEl) messageEl.textContent = message;
        if (progressEl) progressEl.textContent = `${progress}%`;
      }
    }
    removeProcessingStatus() {
      if (this.processingStatus) {
        this.processingStatus.remove();
        this.processingStatus = null;
      }
      const status = this.$('.processing-status');
      if (status) status.remove();
    }
    readFileContent(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error((this._("notifications.failed_read_file"))));
        reader.readAsText(file);
      });
    }
    showLoadingStatus(message = this._("notifications.processing_pdf")) {
      const loading = document.createElement("div");
      loading.id = "pdf-loading-status";
      loading.style.cssText = `
position: fixed;
top: ${window.innerHeight / 2}px;
left: ${window.innerWidth / 2}px;
transform: translate(-50%, -50%);
background-color: rgba(0, 0, 0, 0.8);
color: white;
padding: 20px;
border-radius: 8px;
z-index: 2147483647;
`;
      loading.innerHTML = `
<div style="text-align: center;">
    <div class="spinner" style="color: white"></div>
    <div style="color: white">${message}</div>
</div>
`;
      this.shadowRoot.appendChild(loading);
    }
    removeLoadingStatus() {
      const loading = this.shadowRoot.querySelector("#pdf-loading-status");
      if (loading) loading.remove();
    }
    updateProgress(message, percent) {
      const loading = this.shadowRoot.querySelector("#pdf-loading-status");
      if (loading) {
        loading.innerHTML = `
<div style="text-align: center;">
    <div class="spinner" style="color: white"></div>
    <div style="color: white">${message}</div>
    <div style="color: white">${percent}%</div>
</div>
`;
      }
    }
    startWebImageOCR() {
      const style = document.createElement("style");
      style.textContent = `
.translator-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0,0,0,0.3);
  z-index: 2147483647;
  pointer-events: none;
}
.translator-overlay.translating-done {
  background-color: transparent;
}
.translator-guide {
  position: fixed;
  top: 20px;
  left: ${window.innerWidth / 2}px;
  transform: translateX(-50%);
  background-color: rgba(0,0,0,0.8);
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  z-index: 2147483647;
  pointer-events: none;
}
.translator-cancel {
  position: fixed;
  top: 20px;
  right: 20px;
  background-color: #ff4444;
  color: white;
  border: none;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483647;
  pointer-events: auto;
}
`;
      this.shadowRoot.appendChild(style);
      const globalStyle = document.createElement('style');
      globalStyle.textContent = `
img:hover, canvas:hover {
  outline: 3px solid #4a90e2;
  outline-offset: -3px;
  cursor: pointer;
  position: relative;
  z-index: 2147483647;
  pointer-events: auto;
}
`;
      document.head.appendChild(globalStyle);
      const overlay = document.createElement("div");
      overlay.className = "translator-overlay";
      const guide = document.createElement("div");
      guide.className = "translator-guide";
      guide.textContent = this._("notifications.ocr_click_guide");
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "translator-cancel";
      cancelBtn.textContent = "✕";
      this.shadowRoot.appendChild(overlay);
      this.shadowRoot.appendChild(guide);
      this.shadowRoot.appendChild(cancelBtn);
      const handleClick = async (e) => {
        if (e.target.tagName === "IMG" || e.target.tagName === "CANVAS") {
          e.preventDefault();
          e.stopPropagation();
          try {
            this.showTranslatingStatus();
            const targetElement = e.target;
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d", { willReadFrequently: true });
            if (targetElement.tagName === "IMG") {
              await this.loadImage(targetElement, canvas, ctx);
            } else if (targetElement.tagName === "CANVAS") {
              await this.processCanvas(targetElement, canvas, ctx);
            }
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const hasContent = imageData.data.some(pixel => pixel !== 0);
            if (!hasContent) {
              throw new Error(this._("notifications.cannot_capture_element"));
            }
            const blob = await new Promise((resolve, reject) => {
              canvas.toBlob(blob => {
                if (!blob || blob.size < 100) {
                  reject(new Error(this._("notifications.cannot_generate_valid")));
                  return;
                }
                resolve(blob);
              }, 'image/png', 1.0);
            });
            const file = new File([blob], "web-image.png", { type: "image/png" });
            const result = await this.ocr.processImage(file);
            if (!result) {
              throw new Error(this._("notifications.un_pr_screen"));
            }
            overlay.classList.add("translating-done");
            this.formatTrans(result);
          } catch (error) {
            console.error("OCR error:", error);
            this.showNotification(error.message, "error");
          } finally {
            this.removeTranslatingStatus();
          }
        }
      };
      document.addEventListener("click", handleClick, true);
      cancelBtn.addEventListener("click", () => {
        document.removeEventListener("click", handleClick, true);
        overlay.remove();
        guide.remove();
        cancelBtn.remove();
        style.remove();
        globalStyle.remove();
      });
      this.webImageListeners = {
        click: handleClick,
        overlay,
        guide,
        cancelBtn,
        style,
        globalStyle
      };
    }
    formatTrans(result) {
      if (this.settings.displayOptions.translationMode !== "translation_only") {
        const translations = result.split("\n");
        let fullTranslation = "";
        let pinyin = "";
        let text = "";
        for (const trans of translations) {
          const parts = trans.split("<|>");
          text += (parts[0] || "") + "\n";
          pinyin += (parts[1] || "") + "\n";
          fullTranslation += (parts[2] || trans.replace("<|>", "")) + "\n";
        }
        this.displayPopup(
          fullTranslation,
          text,
          "King1x32 <3",
          pinyin
        );
      } else {
        this.displayPopup(result, '', "King1x32 <3");
      }
    }
    createMangaOverlay(region, targetElement) {
      const overlay = document.createElement("div");
      overlay.className = "manga-translation-overlay";
      const adjustSize = (position) => {
        const ratio = position.height / position.width;
        if (ratio > 2) {
          position.height = position.width * 2;
        }
        // if (ratio > 3 || ratio < 1 / 3) {
        //   const avgSize = Math.sqrt(position.width * position.height);
        //   position.width = avgSize;
        //   position.height = avgSize
        // }
        const EDGE_PADDING = 5;
        if (position.edge_detection) {
          switch (position.boundary_position) {
            case 'left': position.x -= EDGE_PADDING; position.width += EDGE_PADDING; break;
            case 'right': position.width += EDGE_PADDING; break;
            case 'top': position.y -= EDGE_PADDING; position.height += EDGE_PADDING; break;
            case 'bottom': position.height += EDGE_PADDING; break;
            case 'corner':
              position.x -= EDGE_PADDING; position.y -= EDGE_PADDING;
              position.width += EDGE_PADDING * 2; position.height += EDGE_PADDING * 2;
              break;
          }
        }
        return position;
      };
      region.position = adjustSize(region.position);
      const handlesDirections = ['top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right'];
      handlesDirections.forEach(direction => {
        const handle = document.createElement('div');
        handle.className = `resize-handle ${direction}`;
        handle.dataset.direction = direction;
        overlay.appendChild(handle);
        setTimeout(() => {
          if (!overlay.contains(handle)) {
            overlay.appendChild(handle);
          }
        }, 100);
      });
      const { naturalWidth, naturalHeight } = targetElement;
      let relativePosition = {
        x: region.position.x / 100,
        y: region.position.y / 100,
        width: region.position.width / 100,
        height: region.position.height / 100,
        isCustom: false
      };
      let customOffset = { x: 0, y: 0 };
      const calculateFontSize = (width, height, region) => {
        const settingsWeb = this.settings.displayOptions.webImageTranslation.fontSize;
        const minConfigFontSize = DEFAULT_SETTINGS.displayOptions.webImageTranslation.minFontSize;
        const maxConfigFontSize = DEFAULT_SETTINGS.displayOptions.webImageTranslation.maxFontSize;
        const convertToPx = (value, defaultPx) => {
          if (typeof value === 'number') return value;
          if (typeof value !== 'string') return defaultPx;
          const num = parseFloat(value);
          if (value.endsWith('px')) return num;
          if (value.endsWith('rem')) {
            return num * (parseFloat(getComputedStyle(document.documentElement).fontSize) || 16);
          }
          return num || defaultPx;
        };
        const minAllowedPx = convertToPx(minConfigFontSize, 8);
        const maxAllowedPx = convertToPx(maxConfigFontSize, 24);
        const textContent = region.translation || region.text || '';
        if (!textContent.trim()) {
          return { fontSize: minAllowedPx, lineHeight: 1.3 };
        }
        const paddingX = 13;
        const paddingY = 9;
        const availableWidth = width - paddingX;
        const availableHeight = height - paddingY;
        if (availableWidth <= 1 || availableHeight <= 1) {
          return { fontSize: minAllowedPx, lineHeight: 1.3 };
        }
        const tempDiv = document.createElement('div');
        Object.assign(tempDiv.style, {
          position: 'absolute',
          left: '-9999px',
          top: '-9999px',
          visibility: 'hidden',
          width: `${availableWidth}px`,
          fontFamily: "'Patrick Hand', 'Comic Neue', 'GoMono Nerd Font', 'Noto Sans', Arial",
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          padding: '0'
        });
        tempDiv.innerText = textContent;
        this.shadowRoot.appendChild(tempDiv);
        let optimalSize;
        let optimalLineHeight = 1.3;
        const isFit = (fontSize, lineHeight) => {
          tempDiv.style.fontSize = `${fontSize}px`;
          tempDiv.style.lineHeight = lineHeight;
          return tempDiv.scrollHeight <= availableHeight;
        };
        if (settingsWeb === 'auto') {
          let low = minAllowedPx;
          let high = Math.min(maxAllowedPx, availableHeight / (textContent.split('\n').length || 1));
          let bestFit = low;
          while (low <= high) {
            let mid = (low + high) / 2;
            if (isFit(mid, optimalLineHeight)) {
              bestFit = mid;
              low = mid + 0.1;
            } else {
              high = mid - 0.1;
            }
          }
          optimalSize = bestFit;
        } else {
          const userSpecifiedPx = convertToPx(settingsWeb, 14);
          if (isFit(userSpecifiedPx, optimalLineHeight)) {
            optimalSize = userSpecifiedPx;
          } else {
            let low = minAllowedPx;
            let high = userSpecifiedPx;
            let bestFit = low;
            while (low <= high) {
              let mid = (low + high) / 2;
              if (isFit(mid)) {
                bestFit = mid;
                low = mid + 0.1;
              } else {
                high = mid - 0.1;
              }
            }
            optimalSize = bestFit;
          }
        }
        const ratio = availableHeight / availableWidth;
        if (ratio > 1.5) {
          optimalLineHeight = 1.1;
          if (!isFit(optimalSize, optimalLineHeight)) {
            optimalSize *= 0.95;
          }
        } else if (ratio < 0.7) {
          optimalLineHeight = 1.5;
        }
        while (!isFit(optimalSize, optimalLineHeight) && optimalSize > minAllowedPx) {
          optimalSize -= 0.5;
        }
        tempDiv.remove();
        return {
          fontSize: Math.max(minAllowedPx, Math.min(maxAllowedPx, optimalSize)),
          lineHeight: optimalLineHeight
        };
      };
      const validatePosition = (pos, imageRect) => {
        const totalDisplayedHeight = (naturalHeight / naturalWidth) * imageRect.width;
        pos.x = Math.max(imageRect.left, Math.min(pos.x, imageRect.right - pos.width));
        pos.y = Math.max(imageRect.top, Math.min(pos.y, imageRect.top + totalDisplayedHeight - pos.height));
        return pos;
      };
      const calculateAbsolutePosition = () => {
        const imageRect = targetElement.getBoundingClientRect();
        const totalDisplayedWidth = imageRect.width;
        const totalDisplayedHeight = (naturalHeight / naturalWidth) * totalDisplayedWidth;
        let pos;
        if (relativePosition.isCustom) {
          const maxX = totalDisplayedWidth - (relativePosition.width * totalDisplayedWidth);
          const maxY = totalDisplayedHeight - (relativePosition.height * totalDisplayedHeight);
          pos = {
            x: imageRect.left + Math.min(maxX, Math.max(0, customOffset.x)),
            y: imageRect.top + Math.min(maxY, Math.max(0, customOffset.y)),
            width: relativePosition.width * totalDisplayedWidth,
            height: relativePosition.height * totalDisplayedHeight,
          };
        } else {
          pos = {
            x: imageRect.left + (totalDisplayedWidth * relativePosition.x),
            y: imageRect.top + (totalDisplayedHeight * relativePosition.y),
            width: totalDisplayedWidth * relativePosition.width,
            height: totalDisplayedHeight * relativePosition.height
          };
        }
        return validatePosition(pos, imageRect);
      };
      const adjustBubbleSize = () => {
        const pos = calculateAbsolutePosition();
        const ratio = pos.height / pos.width;
        const imageRect = targetElement.getBoundingClientRect();
        if (ratio > 2 || ratio < 1 / 3) {
          const avgSize = Math.sqrt(pos.width * pos.height);
          relativePosition.width = avgSize / imageRect.width;
          relativePosition.height = avgSize / imageRect.height;
          updateOverlayStyle();
        }
      };
      const updateOverlayStyle = () => {
        const pos = calculateAbsolutePosition();
        const { fontSize, lineHeight } = calculateFontSize(pos.width, pos.height, region);
        Object.assign(overlay.style, {
          left: `${pos.x}px`,
          top: `${pos.y}px`,
          width: `${pos.width}px`,
          height: `${pos.height}px`,
          fontSize: `${fontSize}px`,
          lineHeight: lineHeight,
          fontFamily: "'Patrick Hand', 'Comic Neue', 'GoMono Nerd Font', 'Noto Sans', Arial",
          fontWeight: region.position.text_style === 'bold' ? 'bold' : 'normal',
          fontStyle: region.position.text_style === 'italic' ? 'italic' : 'normal',
          writingMode: region.position.text_orientation === 'vertical' ? 'vertical-rl' : 'horizontal-tb',
        });
      };
      let isDragging = false, isResizing = false, isPinching = false;
      let initialMouseX, initialMouseY, initialRect;
      let initialPinchDistance = 0, initialPinchWidth = 0, initialPinchHeight = 0;
      let lastTapTime = 0, tapCount = 0;
      let tapTimer = null;
      const mouseDownHandler = (e) => {
        const handle = e.target;
        if (handle.classList.contains('resize-handle')) {
          e.preventDefault();
          e.stopPropagation();
          isResizing = true;
          initialRect = overlay.getBoundingClientRect();
          initialMouseX = e.clientX;
          initialMouseY = e.clientY;
          document.addEventListener('mousemove', mouseMoveHandler);
          document.addEventListener('mouseup', mouseUpHandler);
          mouseMoveHandler.direction = handle.dataset.direction;
        } else {
          isDragging = true;
          initialMouseX = e.clientX;
          initialMouseY = e.clientY;
          initialRect = {
            left: overlay.offsetLeft,
            top: overlay.offsetTop
          };
          overlay.style.cursor = "grabbing";
          document.addEventListener('mousemove', mouseMoveHandler);
          document.addEventListener('mouseup', mouseUpHandler);
        }
      };
      const mouseMoveHandler = (e) => {
        if (isResizing) {
          const deltaX = e.clientX - initialMouseX;
          const deltaY = e.clientY - initialMouseY;
          let { width, height, left, top } = initialRect;
          const direction = mouseMoveHandler.direction;
          if (direction.includes('right')) width += deltaX;
          if (direction.includes('left')) { width -= deltaX; left += deltaX; }
          if (direction.includes('bottom')) height += deltaY;
          if (direction.includes('top')) { height -= deltaY; top += deltaY; }
          const minSize = 20;
          if (width < minSize) { if (direction.includes('left')) left += width - minSize; width = minSize; }
          if (height < minSize) { if (direction.includes('top')) top += height - minSize; height = minSize; }
          const imageRect = targetElement.getBoundingClientRect();
          const validated = validatePosition({ left, top, width, height }, imageRect);
          overlay.style.width = `${validated.width}px`;
          overlay.style.height = `${validated.height}px`;
          overlay.style.left = `${validated.left}px`;
          overlay.style.top = `${validated.top}px`;
          const { fontSize, lineHeight } = calculateFontSize(validated.width, validated.height, region);
          overlay.style.fontSize = `${fontSize}px`;
          overlay.style.lineHeight = lineHeight;
        } else if (isDragging) {
          const dx = e.clientX - initialMouseX;
          const dy = e.clientY - initialMouseY;
          const newLeft = initialRect.left + dx;
          const newTop = initialRect.top + dy;
          overlay.style.left = `${newLeft}px`;
          overlay.style.top = `${newTop}px`;
        }
      };
      const mouseUpHandler = () => {
        if (isResizing || isDragging) {
          const imageRect = targetElement.getBoundingClientRect();
          const totalDisplayedWidth = imageRect.width;
          const totalDisplayedHeight = (naturalHeight / naturalWidth) * totalDisplayedWidth;
          relativePosition.width = overlay.offsetWidth / totalDisplayedWidth;
          relativePosition.height = overlay.offsetHeight / totalDisplayedHeight;
          customOffset.x = overlay.offsetLeft - imageRect.left;
          customOffset.y = overlay.offsetTop - imageRect.top;
          relativePosition.isCustom = true;
          adjustBubbleSize();
        }
        isDragging = false;
        isResizing = false;
        overlay.style.cursor = "grab";
        document.removeEventListener('mousemove', mouseMoveHandler);
        document.removeEventListener('mouseup', mouseUpHandler);
      };
      overlay.addEventListener("mousedown", mouseDownHandler);
      const resetOverlayPosition = () => {
        relativePosition = {
          x: region.position.x / 100, y: region.position.y / 100,
          width: region.position.width / 100, height: region.position.height / 100,
          isCustom: false
        };
        customOffset = { x: 0, y: 0 };
        updateOverlayStyle();
      };
      const handleTap = (e) => {
        const currentTime = Date.now();
        const tapDelay = currentTime - lastTapTime;
        lastTapTime = currentTime;
        if (tapDelay < 300) {
          tapCount++;
          if (tapCount === 2) {
            e.preventDefault();
            e.stopPropagation();
            resetOverlayPosition();
            tapCount = 0;
            if (tapTimer) clearTimeout(tapTimer);
          }
        } else {
          tapCount = 1;
          if (tapTimer) clearTimeout(tapTimer);
          tapTimer = setTimeout(() => {
            tapCount = 0;
          }, 300);
        }
      };
      const touchStartHandler = (e) => {
        if (e.touches.length === 1 && !isPinching) {
          handleTap(e);
          isDragging = true;
          const touch = e.touches[0];
          initialMouseX = touch.clientX;
          initialMouseY = touch.clientY;
          initialRect = overlay.getBoundingClientRect();
        } else if (e.touches.length === 2) {
          isDragging = false;
          isPinching = true;
          const [t1, t2] = e.touches;
          initialPinchDistance = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
          const imageRect = targetElement.getBoundingClientRect();
          initialPinchWidth = overlay.offsetWidth / imageRect.width;
          initialPinchHeight = overlay.offsetHeight / imageRect.height;
        }
      };
      const touchMoveHandler = (e) => {
        e.preventDefault();
        if (isPinching && e.touches.length === 2) {
          const [t1, t2] = e.touches;
          const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
          const scale = currentDist / initialPinchDistance;
          const imageRect = targetElement.getBoundingClientRect();
          const minSize = 30 / imageRect.width;
          relativePosition.width = Math.max(minSize, initialPinchWidth * scale);
          relativePosition.height = Math.max(minSize, initialPinchHeight * scale);
          relativePosition.isCustom = true;
          updateOverlayStyle();
        } else if (isDragging && e.touches.length === 1) {
          const touch = e.touches[0];
          const dx = touch.clientX - initialMouseX;
          const dy = touch.clientY - initialMouseY;
          overlay.style.left = `${initialRect.left + dx + window.scrollX}px`;
          overlay.style.top = `${initialRect.top + dy + window.scrollY}px`;
        }
      };
      const touchEndHandler = (e) => {
        if (e.touches.length < 2) isPinching = false;
        if (e.touches.length < 1) isDragging = false;
        if (!isPinching && !isDragging) {
          const imageRect = targetElement.getBoundingClientRect();
          customOffset.x = (overlay.offsetLeft - window.scrollX) - imageRect.left;
          customOffset.y = (overlay.offsetTop - window.scrollY) - imageRect.top;
          relativePosition.width = overlay.offsetWidth / imageRect.width;
          relativePosition.height = overlay.offsetHeight / imageRect.height;
          relativePosition.isCustom = true;
        }
      };
      overlay.addEventListener("touchstart", touchStartHandler, { passive: false });
      overlay.addEventListener("touchmove", touchMoveHandler, { passive: false });
      overlay.addEventListener("touchend", touchEndHandler);
      overlay.addEventListener("touchcancel", touchEndHandler);
      overlay.addEventListener("dblclick", (e) => {
        e.preventDefault(); e.stopPropagation();
        resetOverlayPosition();
      });
      overlay.addEventListener("wheel", (e) => {
        if (e.ctrlKey) {
          e.preventDefault();
          const currentOpacity = parseFloat(overlay.style.opacity) || 0.8;
          const newOpacity = Math.max(0.1, Math.min(1, currentOpacity + (e.deltaY > 0 ? -0.05 : 0.05)));
          overlay.style.opacity = newOpacity;
        }
      });
      overlay.innerText = region.translation;
      updateOverlayStyle();
      const handleScrollAndResize = () => requestAnimationFrame(updateOverlayStyle);
      window.addEventListener("scroll", handleScrollAndResize, { passive: true });
      window.addEventListener("resize", handleScrollAndResize, { passive: true });
      const cleanup = () => {
        window.removeEventListener("scroll", handleScrollAndResize);
        window.removeEventListener("resize", handleScrollAndResize);
        overlay.removeEventListener("mousedown", mouseDownHandler);
        document.removeEventListener("mousemove", mouseMoveHandler);
        document.removeEventListener("mouseup", mouseUpHandler);
        overlay.removeEventListener("touchstart", touchStartHandler);
        overlay.removeEventListener("touchmove", touchMoveHandler);
        overlay.removeEventListener("touchend", touchEndHandler);
        overlay.removeEventListener("touchcancel", touchEndHandler);
      };
      overlay.cleanup = cleanup;
      return overlay;
    }
    startMangaTranslation() {
      const themeMode = this.settings.theme;
      const isDark = themeMode === "dark";
      const style = document.createElement("style");
      style.textContent = `
@import url('https://fonts.googleapis.com/css2?family=Patrick+Hand&family=Comic+Neue:wght@400;700&display=swap');
.translator-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0,0,0,0.3);
  z-index: 2147483647;
  pointer-events: none;
}
.translating-done {
  background-color: transparent;
}
.translator-guide {
  position: fixed;
  top: 20px;
  left: ${window.innerWidth / 2}px;
  transform: translateX(-50%);
  background-color: rgba(0,0,0,0.8);
  color: white;
  padding: 10px 20px;
  border-radius: 8px;
  font-size: 14px;
  z-index: 2147483647;
  pointer-events: none;
}
.translator-cancel {
  position: fixed;
  top: 20px;
  right: 20px;
  background-color: #ff4444;
  color: white;
  border: none;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2147483647;
  pointer-events: auto;
}
.manga-translation-overlay {
  position: absolute;
  background-color: ${isDark ? 'rgba(0,0,0,0.8)' : 'rgba(255,255,255,0.8)'};
  color: ${isDark ? '#fff' : '#000'};
  border-radius: 8%;
  padding: 4px 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-family: 'Patrick Hand', 'Comic Neue', 'GoMono Nerd Font', 'Noto Sans', Arial;
  z-index: 2147483647;
  cursor: grab;
  user-select: none;
  transition: none;
  box-shadow: 0 2px 5px rgba(0,0,0,0.2);
  pointer-events: all;
}
.manga-translation-overlay:hover {
  box-shadow: 0 4px 8px rgba(0,0,0,0.3);
}
.manga-translation-overlay:active {
  cursor: grabbing;
}
.manga-translation-overlay .resize-handle {
  position: absolute;
  background: transparent;
  z-index: 2147483647;
  transition: background-color 0.2s;
}
/* Handles ở các cạnh */
.manga-translation-overlay .resize-handle.top {
  top: -5px;
  left: 16px; /* Thêm khoảng đệm để không chạm vào góc */
  right: 16px;
  height: 10px;
  cursor: ns-resize;
}
.manga-translation-overlay .resize-handle.bottom {
  bottom: -5px;
  left: 16px;
  right: 16px;
  height: 10px;
  cursor: ns-resize;
}
.manga-translation-overlay .resize-handle.left {
  left: -5px;
  top: 16px;
  bottom: 16px;
  width: 10px;
  cursor: ew-resize;
}
.manga-translation-overlay .resize-handle.right {
  right: -5px;
  top: 16px;
  bottom: 16px;
  width: 10px;
  cursor: ew-resize;
}
/* Handles ở các góc */
.manga-translation-overlay .resize-handle.top-left {
  top: 0;
  left: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  transform: translate(2px, 2px);
  border-radius: 50%; /* Bo tròn chính handle */
}
.manga-translation-overlay .resize-handle.top-right {
  top: 0;
  right: 0;
  width: 16px;
  height: 16px;
  cursor: nesw-resize;
  transform: translate(-2px, 2px);
  border-radius: 50%;
}
.manga-translation-overlay .resize-handle.bottom-left {
  bottom: 0;
  left: 0;
  width: 16px;
  height: 16px;
  cursor: nesw-resize;
  transform: translate(2px, -2px);
  border-radius: 50%;
}
.manga-translation-overlay .resize-handle.bottom-right {
  bottom: 0;
  right: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  transform: translate(-2px, -2px);
  border-radius: 50%;
}
.manga-translation-overlay .resize-handle:hover {
  background-color: rgba(74, 144, 226, 0.3);
}
`;
      this.shadowRoot.appendChild(style);
      const globalStyle = document.createElement('style');
      globalStyle.textContent = `
img:hover, canvas:hover {
  outline: 3px solid #4a90e2;
  outline-offset: -3px;
  cursor: pointer;
  position: relative;
  z-index: 2147483647;
  pointer-events: auto;
}
`;
      document.head.appendChild(globalStyle);
      const overlay = document.createElement("div");
      overlay.className = "translator-overlay";
      const guide = document.createElement("div");
      guide.className = "translator-guide";
      guide.textContent = this._("notifications.manga_click_guide");
      const cancelBtn = document.createElement("button");
      cancelBtn.className = "translator-cancel";
      cancelBtn.textContent = "✕";
      const overlayContainer = document.createElement("div");
      overlayContainer.style.cssText = `
position: fixed;
top: 0;
left: 0;
width: 100%;
height: 100%;
z-index: 2147483647;
pointer-events: none;
`;
      this.shadowRoot.appendChild(overlay);
      this.shadowRoot.appendChild(guide);
      this.shadowRoot.appendChild(cancelBtn);
      this.shadowRoot.appendChild(overlayContainer);
      let existingOverlays = [];
      let isProcessingMangaClick = false;
      const isGlobalEnabled = this.settings.ocrOptions?.mangaTranslateAll;
      const isPrioritizedMode = safeLocalStorageGet("kingtranslator_manga_all_for_site") === 'true' || true;
      const singleImageTranslateAction = async (e) => {
        if (isProcessingMangaClick) return;
        try {
          isProcessingMangaClick = true;
          overlay.classList.add("translating-done");
          const result = await this.detectAndTranslateMangaImage(e.target);
          if (result?.regions) {
            const sortedRegions = this.sortRegions(result.regions);
            sortedRegions.forEach(region => {
              const mangaOverlay = this.createMangaOverlay(region, e.target);
              overlayContainer.appendChild(mangaOverlay);
              existingOverlays.push(mangaOverlay);
            });
          }
        } catch (error) { this.showNotification(error.message, "error"); }
        finally { isProcessingMangaClick = false; }
      };
      const multiImageTranslateSetupAction = (e) => {
        document.removeEventListener("click", mainClickListener, true);
        overlay.classList.add("translating-done");
        const actionButton = guide.querySelector('button');
        this.enterMangaSelectionMode(guide, actionButton, cancelBtn, existingOverlays, overlayContainer);
        if (e && (e.target.tagName === "IMG" || e.target.tagName === "CANVAS")) {
          const imageClickHandler = guide.imageClickHandler;
          if (imageClickHandler) imageClickHandler(e);
        }
      };
      let mainClickListener;
      if (isGlobalEnabled && isPrioritizedMode) {
        guide.textContent = this._("notifications.manga_guide_translate_all_prioritized");
        mainClickListener = (e) => {
          if (e.target.tagName === "IMG" || e.target.tagName === "CANVAS") {
            e.preventDefault(); e.stopPropagation();
            multiImageTranslateSetupAction(e);
          }
        };
        const singleButton = document.createElement("button");
        singleButton.textContent = this._("notifications.manga_button_translate_single");
        Object.assign(singleButton.style, {
          marginLeft: '15px',
          padding: '5px 10px',
          cursor: 'pointer',
          pointerEvents: "auto",
          border: '1px solid #fff',
          borderRadius: '5px',
          backgroundColor: 'rgba(74, 144, 226, 0.8)',
          color: 'white'
        });
        singleButton.onclick = () => {
          guide.textContent = this._("notifications.manga_click_guide");
          singleButton.style.display = 'none';
          document.removeEventListener("click", mainClickListener, true);
          document.addEventListener("click", singleImageTranslateAction, { once: true, capture: true });
        };
        guide.appendChild(singleButton);
      } else {
        guide.textContent = this._("notifications.manga_click_guide");
        mainClickListener = (e) => {
          if (e.target.tagName === "IMG" || e.target.tagName === "CANVAS") {
            e.preventDefault(); e.stopPropagation();
            singleImageTranslateAction(e);
          }
        };
        if (isGlobalEnabled) {
          const allButton = document.createElement("button");
          allButton.textContent = this._("notifications.manga_translate_all_button");
          Object.assign(allButton.style, {
            marginLeft: '15px',
            padding: '5px 10px',
            cursor: 'pointer',
            pointerEvents: "auto",
            border: '1px solid #fff',
            borderRadius: '5px',
            backgroundColor: 'rgba(74, 144, 226, 0.8)',
            color: 'white'
          });
          allButton.onclick = multiImageTranslateSetupAction;
          guide.appendChild(allButton);
        }
      }
      document.addEventListener("click", mainClickListener, true);
      const fullCleanup = () => {
        document.removeEventListener("click", mainClickListener, true);
        this.cleanupManga(null, existingOverlays, overlay, guide, cancelBtn, style, globalStyle, overlayContainer);
      };
      cancelBtn.addEventListener("click", fullCleanup);
      this.mangaListeners = {
        click: mainClickListener,
        overlay, guide, cancelBtn, style, globalStyle, overlayContainer, existingOverlays
      };
    }
    enterMangaSelectionMode(guideElement, buttonElement, cancelBtn, existingOverlays, overlayContainer) {
      let firstImageSelected = null;
      guideElement.textContent = this._("notifications.manga_select_first_image");
      if (buttonElement) buttonElement.style.display = 'none';
      document.body.style.cursor = 'crosshair';
      const imageHoverHandler = e => {
        if (e.target.tagName === 'IMG' || e.target.tagName === 'CANVAS') {
          e.target.style.outline = '3px dashed #4CAF50';
        }
      };
      const imageLeaveHandler = e => {
        if (e.target.tagName === 'IMG' || e.target.tagName === 'CANVAS') {
          e.target.style.outline = '';
        }
      };
      document.addEventListener('mouseover', imageHoverHandler);
      document.addEventListener('mouseout', imageLeaveHandler);
      const cleanupSelectionListeners = () => {
        document.removeEventListener('click', imageClickHandler, true);
        document.removeEventListener('mouseover', imageHoverHandler);
        document.removeEventListener('mouseout', imageLeaveHandler);
        if (firstImageSelected) firstImageSelected.style.outline = '';
        document.body.style.cursor = 'default';
      };
      const imageClickHandler = async (e) => {
        if (e.target.tagName !== 'IMG' && e.target.tagName !== 'CANVAS') return;
        e.preventDefault();
        e.stopPropagation();
        if (!firstImageSelected) {
          firstImageSelected = e.target;
          firstImageSelected.style.outline = '5px solid #4CAF50';
          guideElement.textContent = this._("notifications.manga_select_last_image");
        } else {
          const secondImageSelected = e.target;
          secondImageSelected.style.outline = '5px solid #2196F3';
          cleanupSelectionListeners();
          this.translateImageRange(firstImageSelected, secondImageSelected, overlayContainer, existingOverlays, guideElement);
        }
      };
      document.addEventListener('click', imageClickHandler, true);
      cancelBtn.onclick = () => {
        cleanupSelectionListeners();
        this.cleanupManga(
          this.mangaListeners.click,
          existingOverlays,
          this.mangaListeners.overlay,
          this.mangaListeners.guide,
          this.mangaListeners.cancelBtn,
          this.mangaListeners.style,
          this.mangaListeners.globalStyle,
          this.mangaListeners.overlayContainer
        );
      };
    }
    async translateImageWithRetries(imgElement, maxRetries = 5, initialDelay = 1000) {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await this.detectAndTranslateMangaImage(imgElement, true);
          return result;
        } catch (error) {
          console.warn(`Attempt ${attempt}/${maxRetries} failed for image`, imgElement.src, error);
          if (attempt === maxRetries) {
            console.error(`Failed to translate image after ${maxRetries} attempts.`, imgElement.src);
            return null;
          }
          const delay = initialDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      return null;
    }
    async translateImageRange(startImage, endImage, overlayContainer, existingOverlays, guideElement) {
      const _ = this._;
      let commonParent = startImage.parentElement;
      for (let i = 0; i < 10 && commonParent; i++) {
        if (commonParent.contains(endImage)) break;
        commonParent = commonParent.parentElement;
      }
      if (!commonParent || !commonParent.contains(endImage)) {
        this.showNotification(_("notifications.manga_common_parent_not_found"), "error");
        if (guideElement) guideElement.parentElement.remove();
        return;
      }
      const allImagesInContainer = Array.from(commonParent.querySelectorAll('img, canvas'));
      const filteredImages = allImagesInContainer.filter(img => {
        const rect = img.getBoundingClientRect();
        return rect.width > 100 && rect.height > 100 && img.offsetParent !== null;
      });
      if (filteredImages.length === 0) {
        this.showNotification(_("logs.manga_no_images_found"), "warning");
        if (guideElement) guideElement.remove();
        return;
      }
      const BATCH_SIZE = 3;
      const translationState = new Set();
      let translatedCount = 0;
      const totalImages = filteredImages.length;
      if (guideElement) {
        guideElement.textContent = _("logs.manga_translating_progress", { current: 0, total: totalImages });
      }
      const translateAndOverlay = async (img) => {
        const result = await this.translateImageWithRetries(img);
        if (result?.regions) {
          const sortedRegions = this.sortRegions(result.regions);
          sortedRegions.forEach(region => {
            const overlay = this.createMangaOverlay(region, img);
            overlayContainer.appendChild(overlay);
            existingOverlays.push(overlay);
          });
        }
        translatedCount++;
        if (guideElement) {
          guideElement.textContent = _("logs.manga_translating_progress", { current: translatedCount, total: totalImages });
        }
        if (translatedCount === totalImages) {
          setTimeout(() => {
            if (guideElement) guideElement.remove();
            this.showNotification(_("logs.manga_translate_all_completed"), "success");
          }, 1000);
        }
      };
      const queueTranslation = (img) => {
        if (!translationState.has(img)) {
          translationState.add(img);
          translateAndOverlay(img).catch(err => {
            console.error("Lỗi khi dịch ảnh trong batch:", img.src, err);
            translationState.delete(img);
          });
        }
      };
      const intersectionObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const startImg = entry.target;
            const startIndex = filteredImages.indexOf(startImg);
            if (startIndex > -1) {
              for (let i = startIndex; i < startIndex + BATCH_SIZE && i < totalImages; i++) {
                queueTranslation(filteredImages[i]);
              }
            }
          }
        }
      }, {
        rootMargin: '120% 0%',
        threshold: 0.01
      });
      filteredImages.forEach(img => intersectionObserver.observe(img));
      if (this.mangaListeners) {
        this.mangaListeners.observer = intersectionObserver;
      }
    }
    async detectAndTranslateMangaImage(targetElement, silent = false) {
      if (!silent) {
        this.showTranslatingStatus();
      }
      try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (targetElement.tagName === "IMG") {
          await this.loadImage(targetElement, canvas, ctx);
        } else if (targetElement.tagName === "CANVAS") {
          await this.processCanvas(targetElement, canvas, ctx);
        }
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        if (!imageData.data.some(pixel => pixel !== 0)) {
          throw new Error(this._("notifications.cannot_capture_element"));
        }
        const blob = await new Promise((resolve, reject) => {
          canvas.toBlob((b) => b ? resolve(b) : reject(new Error("Could not create blob")), "image/png");
        });
        const file = new File([blob], "manga-page.png", { type: "image/png" });
        const result = await this.detectTextPositions(file, silent);
        return result;
      } catch (error) {
        if (!silent) {
          this.removeTranslatingStatus();
        }
        throw error;
      } finally {
        if (!silent) {
          this.removeTranslatingStatus();
        }
      }
    }
    async loadImage(targetElement, canvas, ctx) {
      const src = targetElement.src;
      console.log(`[Manga Debug] Starting to load image from src:`, src);
      if (src.startsWith('blob:')) {
        try {
          if (!targetElement.complete) {
            await new Promise((resolve, reject) => {
              targetElement.onload = resolve;
              targetElement.onerror = reject;
            });
          }
          canvas.width = targetElement.naturalWidth;
          canvas.height = targetElement.naturalHeight;
          ctx.drawImage(targetElement, 0, 0);
          ctx.getImageData(0, 0, 1, 1);
          console.log("[Manga Debug] Method 1 (Direct Draw) Succeeded.");
          return;
        } catch (e) {
          console.warn("[Manga Debug] Method 1 (Direct Draw) Failed:", e.message, "Trying next method.");
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      if (src.startsWith('data:')) {
        console.log("[Manga Debug] Using Method 2 (Redraw via Data URL).");
        try {
          const tempCanvas = document.createElement('canvas');
          const tempCtx = tempCanvas.getContext('2d');
          tempCanvas.width = targetElement.naturalWidth;
          tempCanvas.height = targetElement.naturalHeight;
          tempCtx.drawImage(targetElement, 0, 0);
          const dataUrl = tempCanvas.toDataURL('image/png');
          if (dataUrl.length < 100) { // data:image/png;base64,
            throw new Error("Failed to create a valid Data URL.");
          }
          await this.drawImageFromBlob(dataUrl, canvas, ctx);
          console.log("[Manga Debug] Method 2 (Redraw via Data URL) Succeeded.");
          return;
        } catch (e) {
          console.warn("[Manga Debug] Method 2 (Redraw via Data URL) Failed:", e.message, "Trying next method.");
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
      }
      console.log("[Manga Debug] Using Method 3 (GM_xmlhttpRequest Fallback).");
      try {
        const blob = await this.fetchImageViaGM2(src);
        console.log(`[Manga Debug] Successfully reconstructed blob via GM_xmlhttpRequest. Size: ${blob.size}`);
        await this.drawImageFromBlob(blob, canvas, ctx);
        console.log("[Manga Debug] Method 3 (GM_xmlhttpRequest Fallback) Succeeded.");
        return;
      } catch (error) {
        console.error("[Manga Debug] All methods failed to load image.", error);
        throw new Error(`Could not load image from src: ${src}. Reason: ${error.message}`);
      }
    }
    async drawImageFromBlob(blobOrDataUrl, canvas, ctx) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(img.src);
          resolve();
        };
        img.onerror = (err) => {
          console.error("Error in drawImageFromBlob:", err);
          reject(new Error("Could not draw image from blob/data URL."));
        };
        if (typeof blobOrDataUrl === 'string') {
          img.src = blobOrDataUrl;
        } else {
          img.src = URL.createObjectURL(blobOrDataUrl);
        }
      });
    }
    async fetchImageViaGM2(src) {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'GET',
          url: src,
          headers: {
            "User-Agent": navigator.userAgent,
            "Accept-Language": "en-US,vi;q=0.5",
            "Connection": "keep-alive",
            "Referer": window.location.href,
            "X-Requested-With": "XMLHttpRequest",
            "Sec-Fetch-Mode": "no-cors",
            "Sec-Fetch-Site": "cross-site",
            "Priority": "u=5, i",
            "Pragma": "no-cache",
            "Cache-Control": "no-cache"
          },
          overrideMimeType: 'text/plain; charset=x-user-defined',
          responseType: 'text',
          anonymous: true,
          onload: function(response) {
            if (response.status >= 200 && response.status < 300) {
              const responseText = response.responseText;
              const buffer = new Uint8Array(responseText.length);
              for (let i = 0; i < responseText.length; i++) {
                buffer[i] = responseText.charCodeAt(i) & 0xff;
              }
              let mimeType = 'image/png';
              const contentTypeHeader = response.responseHeaders.match(/content-type:\s*(.*)/i);
              if (contentTypeHeader && contentTypeHeader[1]) {
                mimeType = contentTypeHeader[1].trim();
              }
              const blob = new Blob([buffer], { type: mimeType });
              if (blob.size < 100) return reject(new Error("Reconstructed blob is too small."));
              resolve(blob);
            } else {
              reject(new Error(`Request failed with status ${response.status}.`));
            }
          },
          onerror: (err) => reject(new Error(`Network error: ${err.statusText}`)),
        });
      });
    }
    async processCanvas(targetElement, canvas, ctx) {
      try {
        canvas.width = targetElement.width;
        canvas.height = targetElement.height;
        const sourceCtx = targetElement.getContext("2d", { willReadFrequently: true });
        try {
          const imageData = sourceCtx.getImageData(0, 0, targetElement.width, targetElement.height);
          ctx.putImageData(imageData, 0, 0);
        } catch (error) {
          if (error.name === "SecurityError") {
            throw new Error(this._("notifications.canvas_security_error"));
          }
          throw error;
        }
      } catch (error) {
        throw new Error(`Error processing canvas: ${error.message}`);
      }
    }
    sortRegions(regions) {
      const groupNearbyRegions = (regions) => {
        const DISTANCE_THRESHOLD = 20;
        const groups = [];
        const used = new Set();
        regions.forEach((region, i) => {
          if (used.has(i)) return;
          const group = [region];
          used.add(i);
          regions.forEach((otherRegion, j) => {
            if (i === j || used.has(j)) return;
            const distance = Math.sqrt(
              Math.pow(region.position.x - otherRegion.position.x, 2) +
              Math.pow(region.position.y - otherRegion.position.y, 2)
            );
            if (distance <= DISTANCE_THRESHOLD) {
              group.push(otherRegion);
              used.add(j);
            }
          });
          groups.push(group);
        });
        return groups;
      };
      const groupedRegions = groupNearbyRegions(regions);
      return groupedRegions
        .sort((a, b) => {
          const aAvgY = a.reduce((sum, r) => sum + r.position.y, 0) / a.length;
          const bAvgY = b.reduce((sum, r) => sum + r.position.y, 0) / b.length;
          const verticalThreshold = 20;
          if (Math.abs(aAvgY - bAvgY) < verticalThreshold) {
            console.log("phai sang trai");
            const aAvgX = a.reduce((sum, r) => sum + r.position.x, 0) / a.length;
            const bAvgX = b.reduce((sum, r) => sum + r.position.x, 0) / b.length;
            return bAvgX - aAvgX; // Phải sang trái
          }
          console.log("trai sang phai");
          return aAvgY - bAvgY; // Trên xuống dưới
        })
        .flat();
    }
    cleanupManga(handleClick, existingOverlays, ...elements) {
      if (this.mangaListeners?.observer) {
        this.mangaListeners.observer.disconnect();
      }
      document.removeEventListener("click", handleClick, true);
      existingOverlays.forEach(overlay => {
        if (overlay.cleanup) {
          overlay.cleanup();
        }
        overlay.remove();
      });
      elements.forEach(element => element.remove());
    }
    async detectTextPositions(file, silent = false) {
      try {
        const settings = this.settings;
        const targetLanguage = settings.displayOptions.targetLanguage;
        const docTitle = document.title ? `from content titled "${document.title}"` : '';
        const prompt = `Analyze this comic/manga/manhua/manhwa image ${docTitle} with special attention to edge regions and partial text bubbles:
1. Text Detection (Enhanced Edge Detection):
  - Identify ALL text regions, especially focusing on:
    * Partial/cut-off speech bubbles at image edges
    * Text that touches or intersects image boundaries
    * Small or partially visible text elements
    * Overlapping or merged text regions
    * Semi-transparent or low-contrast text areas
  - Scan image edges with higher sensitivity
  - Consider incomplete speech bubbles as valid regions
  - Check corners and borders thoroughly
  - Detect text fragments and reconstruct possible complete phrases
2. Position Analysis (Edge-Aware):
  - x: percentage from left (0-100, allow partial <0 or >100 for edge cases)
  - y: percentage from top (0-100, allow partial <0 or >100 for edge cases)
  - width: percentage of image width (adjust for partial bubbles)
  - height: percentage of image height (adjust for partial bubbles)
  - edge_detection: true/false (indicates if text touches image boundary)
  - completion_status: complete/partial (indicates if bubble/text is cut off)
  - boundary_position: none/left/right/top/bottom/corner (where text touches edge)
3. Text Extraction Rules:
  - Extract text even if bubble is partially visible
  - Reconstruct cut-off characters if possible
  - Consider context for incomplete words
  - Maintain reading order even for partial text
  - Handle text that crosses multiple bubbles
  - Account for perspective and rotation
4. Translation Requirements:
  You are a professional comic/novel translator, specializing in creating accurate and natural translations. You need to translate the text ${docTitle} into the language with code '${targetLanguage}'. Ensure your translation:
    - Maintains original meaning and context
    - Fits the target language style
    - Considers cultural context and story background
  Important Translation Rules:
    - Target language: '${targetLanguage}'
    - Keep sentence meanings unchanged
    - Use appropriate slang or common phrases when needed
    - Ensure correct spelling and grammar
    - Add necessary language particles for '${targetLanguage}' when needed
    - Use contextually appropriate pronouns
    - For adult content style reference: [ truyensex.moe, truyensexvn.org, truyensex.vip, truyensextv69.com ]
  Special handling for Vietnamese translations:
    - Keep Sino-Vietnamese forms for proper names/locations (e.g. "Diệp Trần, Long kiếm, Thiên kiếp")
    - Avoid direct translations (e.g. NOT "Lá Trần, Rồng kiếm, Trời kiếp")
  Other considerations:
    - Adapt names/terms for target language conventions
    - Respect text length and bubble space constraints
    - Maintain comic style and tone
    - Adapt sound effects appropriately
    - Keep cultural references understandable
    - Consider the context and theme ${docTitle}
5. Position Analysis (CRITICAL):
  - x: exact percentage from left (0-100)
  - y: exact percentage from top (0-100)
  - width: exact percentage of image width (0-100)
  - height: exact percentage of image height (0-100)
  - text_length: character count for spacing
  - text_lines: number of lines in region
  - text_type: dialogue/narration/sfx/note
  - container_type: bubble/caption/free/background
  - container_shape: round/square/jagged/custom
  - font_size: small/medium/large
  - layout_direction: horizontal/vertical/custom
  - text_style: "regular"
\nReturn JSON object with this structure:
{
  "regions": [{
    "text": "original text",
    "translation": "translated text",
    "position": {
      "x": 20.5,
      "y": 30.2,
      "width": 15.3,
      "height": 10.1,
      "text_length": 25,
      "text_lines": 2,
      "edge_detection": true,
      "completion_status": "partial",
      "boundary_position": "right",
      "text_type": "dialogue",
      "container_type": "bubble",
      "container_shape": "round",
      "font_size": "medium",
      "layout_direction": "horizontal",
      "text_style": "regular"
    }
  }]
}
\nCRITICAL: The final output MUST be a single, valid JSON object. Ensure all strings within the JSON are properly escaped. Do not add any text, comments, or markdown formatting (DO NOT like \`\`\`json) before or after the JSON.
`;
        const response = await this.ocr.processImage(file, prompt, silent);
        console.log("response: ", response);
        if (response) {
          const jsonMatch = response.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            let jsonString = jsonMatch[0];
            const sanitizedJsonString = jsonString.replace(/\\(?!["\\/bfnrt]|u[0-9a-fA-F]{4})/g, '\\\\');
            const parsedJson = JSON.parse(sanitizedJsonString);
            if (parsedJson && parsedJson.regions) {
              const processOverlappingRegions = (regions) => {
                const result = [];
                const processedIndices = new Set();
                const sortedRegions = [...regions].sort((a, b) => {
                  if (a.position.y !== b.position.y) {
                    return a.position.y - b.position.y;
                  }
                  return a.position.x - b.position.x;
                });
                const isOverlapping = (r1, r2) => {
                  return !(
                    r1.position.x + r1.position.width < r2.position.x ||
                    r2.position.x + r2.position.width < r1.position.x ||
                    r1.position.y + r1.position.height < r2.position.y ||
                    r2.position.y + r2.position.height < r1.position.y
                  );
                };
                for (let i = 0; i < sortedRegions.length; i++) {
                  if (processedIndices.has(i)) {
                    continue;
                  }
                  const currentGroup = [];
                  const queue = [i];
                  processedIndices.add(i);
                  while (queue.length > 0) {
                    const currentIndex = queue.shift();
                    const currentRegion = sortedRegions[currentIndex];
                    currentGroup.push(currentRegion);
                    for (let j = 0; j < sortedRegions.length; j++) {
                      if (!processedIndices.has(j) && isOverlapping(currentRegion, sortedRegions[j])) {
                        processedIndices.add(j);
                        queue.push(j);
                      }
                    }
                  }
                  currentGroup.sort((a, b) => {
                    if (a.position.y !== b.position.y) {
                      return a.position.y - b.position.y;
                    }
                    return a.position.x - b.position.x;
                  });
                  const mergedRegion = {
                    text: currentGroup.map(r => r.text).join(' '),
                    translation: currentGroup.map(r => r.translation).join(' '),
                    position: {
                      x: Math.min(...currentGroup.map(r => r.position.x)),
                      y: Math.min(...currentGroup.map(r => r.position.y)),
                      width: Math.max(...currentGroup.map(r => r.position.x + r.position.width)) - Math.min(...currentGroup.map(r => r.position.x)),
                      height: Math.max(...currentGroup.map(r => r.position.y + r.position.height)) - Math.min(...currentGroup.map(r => r.position.y)),
                      text_type: currentGroup[0].position.text_type,
                      container_type: currentGroup[0].position.container_type,
                      container_shape: currentGroup[0].position.container_shape,
                      font_size: currentGroup[0].position.font_size,
                      layout_direction: currentGroup[0].position.layout_direction,
                      text_style: currentGroup[0].position.text_style
                    }
                  };
                  result.push(mergedRegion);
                }
                return result;
              };
              parsedJson.regions = processOverlappingRegions(parsedJson.regions);
              return parsedJson;
            }
          }
          throw new Error("Invalid response format");
        }
        throw new Error("No response from API");
      } catch (error) {
        console.error("Text detection error:", error);
        throw error;
      }
    }
    getBrowserContextMenuSize() {
      const browser = navigator.userAgent;
      const sizes = {
        firefox: {
          width: 275,
          height: 340,
          itemHeight: 34
        },
        chrome: {
          width: 250,
          height: 320,
          itemHeight: 32
        },
        safari: {
          width: 240,
          height: 300,
          itemHeight: 30
        },
        edge: {
          width: 260,
          height: 330,
          itemHeight: 33
        }
      };
      let size;
      if (browser.includes("Firefox")) {
        size = sizes.firefox;
      } else if (browser.includes("Safari") && !browser.includes("Chrome")) {
        size = sizes.safari;
      } else if (browser.includes("Edge")) {
        size = sizes.edge;
      } else {
        size = sizes.chrome;
      }
      const dpi = window.devicePixelRatio || 1;
      return {
        width: Math.round(size.width * dpi),
        height: Math.round(size.height * dpi),
        itemHeight: Math.round(size.itemHeight * dpi)
      };
    }
    setupContextMenu() {
      if (!this.settings.contextMenu?.enabled) return;
      document.addEventListener("contextmenu", (e) => {
        const selection = window.getSelection();
        const selectedText = selection.toString().trim();
        if (selectedText) {
          const oldMenus = this.$$(".translator-context-menu");
          oldMenus.forEach((menu) => menu.remove());
          const contextMenu = document.createElement("div");
          contextMenu.className = "translator-context-menu";
          const menuItems = [
            { text: this._("settings.quick_translate_shortcut"), action: "quick" },
            { text: this._("settings.popup_translate_shortcut"), action: "popup" },
            { text: this._("settings.advanced_translate_shortcut"), action: "advanced" },
            {
              text: this._("notifications.play_tts"),
              action: "tts",
              getLabel: () => this.isTTSSpeaking ? this._("notifications.stop_tts") : this._("notifications.play_tts")
            }
          ];
          const range = selection.getRangeAt(0).cloneRange();
          menuItems.forEach((item) => {
            const menuItem = document.createElement("div");
            menuItem.className = "translator-context-menu-item";
            menuItem.textContent = item.getLabel ? item.getLabel() : item.text;
            menuItem.onclick = (e) => {
              e.preventDefault();
              e.stopPropagation();
              const newSelection = window.getSelection();
              newSelection.removeAllRanges();
              newSelection.addRange(range);
              if (item.action === "tts") {
                if (this.isTTSSpeaking) {
                  this.stopTTS();
                  this.isTTSSpeaking = false;
                } else {
                  const displayOptions = this.settings.displayOptions;
                  const sourceLang = displayOptions.sourceLanguage === 'auto' ? this.page.languageCode : displayOptions.sourceLanguage;
                  const speedValue = this.settings.ttsOptions.defaultSpeed;
                  const volumeValue = this.settings.ttsOptions.defaultVolume;
                  const pitchValue = this.settings.ttsOptions.defaultPitch;
                  this.selectSource = this.settings.ttsOptions?.defaultProvider || 'google';
                  if (this.selectSource === 'openai') {
                    this.selectVoice = this.settings.ttsOptions?.defaultVoice?.[this.selectSource]?.voice || 'sage';
                    this.selectVoice = { name: this.selectVoice }
                  } else if (this.selectSource === 'google') {
                    this.selectVoice = this.settings.ttsOptions?.defaultVoice?.[this.selectSource]?.[sourceLang] || null;
                  } else {
                    this.selectVoice = null;
                  }
                  this.voiceStorage[this.selectSource] = { voice: this.selectVoice };
                  this.playTTS(selectedText, this.selectVoice.name, sourceLang, { speedValue, pitchValue, volumeValue }, null, false, menuItem);
                }
                this.onSpeechEndCallback(menuItem);
              } else {
                this.handleTranslateButtonClick(newSelection, item.action);
                contextMenu.remove();
              }
            };
            contextMenu.appendChild(menuItem);
          });
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          const menuWidth = 150;
          const menuHeight = (menuItems.length * 40);
          const browserMenu = this.getBrowserContextMenuSize();
          const browserMenuWidth = browserMenu.width;
          const browserMenuHeight = browserMenu.height;
          const spaceWidth = browserMenuWidth + menuWidth;
          const remainingWidth = viewportWidth - e.clientX;
          const rightEdge = viewportWidth - menuWidth;
          const bottomEdge = viewportHeight - menuHeight;
          const browserMenuWidthEdge = viewportWidth - browserMenuWidth;
          const browserMenuHeightEdge = viewportHeight - browserMenuHeight;
          let left, top;
          if (e.clientX < menuWidth && e.clientY < menuHeight) {
            left = e.clientX + browserMenuWidth + 10;
            top = e.clientY;
          } else if (
            e.clientX > browserMenuWidthEdge &&
            e.clientY < browserMenuHeight
          ) {
            left = e.clientX - spaceWidth + remainingWidth;
            top = e.clientY;
          } else if (
            e.clientX > browserMenuWidthEdge &&
            e.clientY > viewportHeight - browserMenuHeight
          ) {
            left = e.clientX - spaceWidth + remainingWidth;
            top = e.clientY - menuHeight;
          } else if (
            e.clientX < menuWidth &&
            e.clientY > viewportHeight - browserMenuHeight
          ) {
            left = e.clientX + browserMenuWidth + 10;
            top = e.clientY - menuHeight;
          } else if (e.clientY < menuHeight) {
            left = e.clientX - menuWidth;
            top = e.clientY;
          } else if (e.clientX > browserMenuWidthEdge) {
            left = e.clientX - spaceWidth + remainingWidth;
            top = e.clientY;
          } else if (e.clientY > browserMenuHeightEdge - menuHeight / 2) {
            left = e.clientX - menuWidth;
            top = e.clientY - menuHeight;
          } else {
            left = e.clientX;
            top = e.clientY - menuHeight;
          }
          left = Math.max(5, Math.min(left, rightEdge - 5));
          top = Math.max(5, Math.min(top, bottomEdge - 5));
          contextMenu.style.left = `${left}px`;
          contextMenu.style.top = `${top}px`;
          this.shadowRoot.appendChild(contextMenu);
          const closeMenu = (e) => {
            if (!contextMenu.contains(e.target)) {
              speechSynthesis.cancel();
              contextMenu.remove();
              document.removeEventListener("click", closeMenu);
            }
          };
          document.addEventListener("click", closeMenu);
          const handleScroll = debounce(() => {
            speechSynthesis.cancel();
            contextMenu.remove();
            window.removeEventListener("scroll", handleScroll);
          }, 150);
          window.addEventListener("scroll", handleScroll, { passive: true });
        }
      });
    }
    onSpeechEndCallback(menuItem) {
      if (menuItem) {
        menuItem.textContent = this.isTTSSpeaking ? this._("notifications.stop_tts") : this._("notifications.play_tts")
      }
    };
    removeWebImageListeners() {
      if (this.webImageListeners) {
        document.removeEventListener(
          "mouseover",
          this.webImageListeners.hover,
          true
        );
        document.removeEventListener(
          "mouseout",
          this.webImageListeners.leave,
          true
        );
        document.removeEventListener(
          "click",
          this.webImageListeners.click,
          true
        );
        this.webImageListeners.overlay?.remove();
        this.webImageListeners.guide?.remove();
        this.webImageListeners.cancelBtn?.remove();
        this.webImageListeners.style?.remove();
        document
          .querySelectorAll(".translator-image-highlight")
          .forEach((el) => {
            el.classList.remove("translator-image-highlight");
          });
        this.webImageListeners = null;
      }
    }
    handleSettingsShortcut(e) {
      if (!this.settings.shortcuts?.settingsEnabled)
        return;
      if ((e.altKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        const settingsUI = this.translator.userSettings.createSettingsUI();
        this.shadowRoot.appendChild(settingsUI);
      }
    }
    async handleTranslationShortcuts(e) {
      if (!this.settings.shortcuts?.enabled) return;
      const shortcuts = this.settings.shortcuts;
      if (e.altKey || e.metaKey) {
        let translateType = null;
        if (e.key === shortcuts.ocrRegion.key) {
          e.preventDefault();
          try {
            const screenshot = await this.ocr.captureScreen();
            if (!screenshot) return;
            this.showTranslatingStatus();
            const result = await this.ocr.processImage(screenshot);
            this.removeTranslatingStatus();
            if (result) this.formatTrans(result);
          } catch (error) {
            this.showNotification(error.message, "error");
            this.removeTranslatingStatus();
          }
          return;
        } else if (e.key === shortcuts.ocrWebImage.key) {
          e.preventDefault();
          this.startWebImageOCR();
          return;
        } else if (e.key === shortcuts.ocrMangaWeb.key) {
          e.preventDefault();
          this.startMangaTranslation();
          return;
        } else if (e.key === shortcuts.pageTranslate.key) {
          e.preventDefault();
          await this.handlePageTranslation();
          return;
        } else if (e.key === shortcuts.inputTranslate.key) {
          e.preventDefault();
          const activeElement = document.activeElement;
          if (this.translator.input.isValidEditor(activeElement)) {
            const text = this.translator.input.getEditorContent(activeElement);
            if (text) {
              await this.translator.input.translateEditor(activeElement, true);
            }
          }
          return;
        }
        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();
        if (!selectedText) return;
        const targetElement = selection.anchorNode?.parentElement;
        if (!targetElement) return;
        if (e.key === shortcuts.quickTranslate.key) {
          e.preventDefault();
          translateType = "quick";
        } else if (e.key === shortcuts.popupTranslate.key) {
          e.preventDefault();
          translateType = "popup";
        } else if (e.key === shortcuts.advancedTranslate.key) {
          e.preventDefault();
          translateType = "advanced";
        }
        if (translateType) {
          await this.handleTranslateButtonClick(selection, translateType);
        }
      }
    }
    async handleGeminiFileOrUrlTranslation() {
      const translator = this.translator;
      const _ = this._;
      if (this.settings.apiProvider !== 'gemini') {
        this.showNotification(_("notifications.only_gemini"), "warning");
        return;
      }
      const acceptedTypes = [
        'image/*',        // Tất cả các loại ảnh
        'audio/*',        // Tất cả các loại audio
        'video/*',        // Tất cả các loại video
        '.pdf',           // Tài liệu PDF
        '.txt', '.json', '.html', '.xml', '.csv', '.md', // Tài liệu văn bản
        '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', // Tài liệu văn phòng
      ].join(',');
      await createFileOrUrlInput(acceptedTypes, async (input) => {
        try {
          translator.ui.showTranslatingStatus();
          const promptText = translator.createPrompt("", "file_content");
          console.log('prompt: ', promptText);
          const processedContent = await translator.fileProcess.processFile(input, promptText);
          const result = await translator.api.request(processedContent.content, 'ocr', processedContent.key);
          translator.ui.removeTranslatingStatus();
          translator.ui.formatTrans(result);
        } catch (error) {
          console.error("Lỗi dịch file/URL bằng Gemini:", error);
          translator.ui.showNotification(_("notifications.generic_translation_error") + error.message, "error");
        } finally {
          translator.ui.removeTranslatingStatus();
        }
      });
    }
    updateSettingsListener(enabled) {
      if (enabled) {
        document.addEventListener("keydown", this.settingsShortcutListener);
      } else {
        document.removeEventListener("keydown", this.settingsShortcutListener);
      }
    }
    updateSettingsTranslationListeners(enabled) {
      if (enabled) {
        document.addEventListener("keydown", this.translationShortcutListener);
      } else {
        document.removeEventListener(
          "keydown",
          this.translationShortcutListener
        );
      }
    }
    updateSelectionListeners(enabled) {
      if (enabled) this.setupSelectionHandlers();
    }
    updateTapListeners(enabled) {
      if (enabled) this.setupDocumentTapHandler();
    }
    setupEventListeners() {
      this.updateSettingsListener(false);
      this.updateSettingsTranslationListeners(false);
      this.updateSelectionListeners(false);
      this.updateTapListeners(false);
      if (this.translator.input) {
        this.translator.input.cleanup();
      }
      const shortcuts = this.settings.shortcuts;
      const clickOptions = this.settings.clickOptions;
      const touchOptions = this.settings.touchOptions;
      if (this.settings.contextMenu?.enabled) {
        this.setupContextMenu();
      }
      if (shortcuts?.settingsEnabled) {
        this.updateSettingsListener(true);
      }
      if (shortcuts?.enabled) {
        this.updateSettingsTranslationListeners(true);
      }
      if (clickOptions?.enabled) {
        this.updateSelectionListeners(true);
        this.translationButtonEnabled = true;
      }
      if (touchOptions?.enabled) {
        this.updateTapListeners(true);
        this.translationTapEnabled = true;
      }
      this.translator.input = new InputTranslator(this.translator);
      let isEnabled = false;
      if (safeLocalStorageGet("translatorToolsEnabled") === null) safeLocalStorageGet("translatorToolsEnabled") === "true";
      if (safeLocalStorageGet("translatorToolsEnabled") === "true") isEnabled = true;
      if (this.settings.translatorTools?.enabled && isEnabled) {
        this.setupTranslatorTools();
      }
      if (!this._hasSettingsChangedListener) {
        this.container.addEventListener("settingsChanged", (e) => {
          this.removeToolsContainer();
          const newSettings = e.detail;
          this.settings = newSettings;
          this.updateSettingsListener(newSettings.shortcuts?.settingsEnabled);
          this.updateSettingsTranslationListeners(newSettings.shortcuts?.enabled);
          if (newSettings.clickOptions?.enabled !== undefined) {
            this.translationButtonEnabled = newSettings.clickOptions.enabled;
            this.updateSelectionListeners(newSettings.clickOptions.enabled);
            if (!newSettings.clickOptions.enabled) {
              this.removeTranslateButton();
            }
          }
          if (newSettings.touchOptions?.enabled !== undefined) {
            this.translationTapEnabled = newSettings.touchOptions.enabled;
            this.updateTapListeners(newSettings.touchOptions.enabled);
            if (!newSettings.touchOptions.enabled) {
              this.removeTranslateButton();
            }
          }
          if (this.translator?.cache) this.translator.cache.clear();
          if (this.translator?.imageCache) this.translator.imageCache.clear();
          if (this.translator?.mediaCache) this.translator.mediaCache.clear();
          if (this.translator?.ttsCache) this.translator.ttsCache.clear();
          const apiConfig = {
            providers: CONFIG.API.providers,
            currentProvider: newSettings.apiProvider,
            apiKey: newSettings.apiKey,
            maxRetries: CONFIG.API.maxRetries,
            retryDelay: CONFIG.API.retryDelay
          };
          this.translator.api = new APIManager(
            apiConfig,
            () => this.settings
          );
          let isEnabled = false;
          if (safeLocalStorageGet("translatorToolsEnabled") === null) safeLocalStorageGet("translatorToolsEnabled") === "true";
          if (safeLocalStorageGet("translatorToolsEnabled") === "true") isEnabled = true;
          if (this.settings.translatorTools?.enabled && isEnabled) {
            this.setupTranslatorTools();
          }
          if (!newSettings.inputTranslation.savePosition) {
            safeLocalStorageRemove('translatorButtonPosition');
          }
        });
        this._hasSettingsChangedListener = true;
      }
    }
    showNotification(message, type = "info") {
      const notification = document.createElement("div");
      notification.className = "translator-notification";
      const colors = {
        info: "#4a90e2",
        success: "#28a745",
        warning: "#ffc107",
        error: "#dc3545"
      };
      const backgroundColor = colors[type] || colors.info;
      const textColor = type === "warning" ? "#000" : "#fff";
      Object.assign(notification.style, {
        position: "fixed",
        top: "20px",
        left: `${window.innerWidth / 2}px`,
        transform: "translateX(-50%)",
        backgroundColor,
        color: textColor,
        padding: "10px 20px",
        borderRadius: "8px",
        zIndex: "2147483647",
        animation: "fadeInOut 2s ease",
        fontFamily: "'GoMono Nerd Font', 'Noto Sans', Arial",
        fontSize: "14px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.2)"
      });
      notification.innerText = message;
      this.shadowRoot.appendChild(notification);
      setTimeout(() => notification.remove(), 5000);
    }
    resetState() {
      if (this.pressTimer) clearTimeout(this.pressTimer);
      if (this.timer) clearTimeout(this.timer);
      this.isLongPress = false;
      this.lastTime = 0;
      this.count = 0;
      this.isDown = false;
      this.ignoreNextSelectionChange = false;
      this.removeTranslateButton();
      this.removeTranslatingStatus();
    }
    removeTranslateButton() {
      if (this.currentTranslateButton) {
        const button = this.$('.translator-button');
        if (button) button.remove();
        this.currentTranslateButton = null;
      }
    }
    removeTranslatingStatus() {
      if (this.translatingStatus) {
        this.translatingStatus.remove();
        this.translatingStatus = null;
      }
      const status = this.$('.center-translate-status');
      if (status) status.remove();
    }
    cleanup() {
      document.removeEventListener("click", this.handleClickOutside);
      document.removeEventListener("keydown", this.settingsShortcutListener);
      document.removeEventListener("keydown", this.translationShortcutListener);
      document.removeEventListener('mousedown', this.setupSelectionHandlers);
      document.removeEventListener('mousemove', this.setupSelectionHandlers);
      document.removeEventListener('mouseup', this.setupSelectionHandlers);
      document.removeEventListener('touchend', this.setupSelectionHandlers);
      if (this._touchStartHandler) {
        document.removeEventListener("touchstart", this._touchStartHandler, { passive: false });
        document.removeEventListener("touchend", this._touchEndHandler);
        document.removeEventListener("touchcancel", this._touchEndHandler);
        this._touchStartHandler = null;
        this._touchEndHandler = null;
      }
      this.removeTranslateButton();
      this.removeTranslatingStatus();
      this.removeToolsContainer();
      this.removeWebImageListeners();
      if (this.mangaListeners) {
        this.cleanup(
          this.mangaListeners.click,
          this.mangaListeners.existingOverlays,
          this.mangaListeners.overlay,
          this.mangaListeners.guide,
          this.mangaListeners.cancelBtn,
          this.mangaListeners.style,
          this.mangaListeners.globalStyle,
          this.mangaListeners.overlayContainer
        );
        this.mangaListeners = null;
      }
      const openPopups = this.$$(".translator-popup");
      openPopups.forEach(popup => {
        if (popup.cleanup) popup.cleanup();
        popup.remove();
      });
      if (this.container && this.container.parentNode) {
        this.container.remove();
      }
      this.shadowRoot = null;
      this.container = null;
    }
  }
