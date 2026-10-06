// Auto-generated from King-Translator-AI.user.js
// Main entry point

import Translator from "./translator.js";

// Initialization check - prevent double initialization
if (window.kingTranslatorInitialized) {
  console.log("King Translator: Already initialized, skipping this execution.");
} else {
  window.kingTranslatorInitialized = true;

  function initializeTranslator() {
    if (window.translatorInstance) {
      window.translatorInstance.cleanup();
    }
    window.translatorInstance = new Translator();
    setupGlobalObserver();
  }
  let globalObserver = null;
  function setupGlobalObserver() {
    if (globalObserver) {
      globalObserver.disconnect();
    }
    const rootContainer = window.translatorInstance?.getRootContainer();
    if (!rootContainer) {
      console.warn("Could not setup observer: root container not found.");
      return;
    }
    globalObserver = new MutationObserver(debounce(() => {
      if (window.translatorInstance && !document.body.contains(rootContainer)) {
        console.warn("King Translator root element was removed, re-initializing Translator.");
        globalObserver.disconnect();
        initializeTranslator();
      }
    }, 200));
    globalObserver.observe(document.body, { childList: true });
  }
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }
  function createFileInput(accept, onFileSelected) {
    return new Promise((resolve) => {
      const translator = window.translator;
      const _ = translator.userSettings._;
      const themeMode = translator.userSettings.settings.theme;
      const theme = CONFIG.THEME[themeMode];
      const div = document.createElement('div');
      div.style.cssText = `
position: fixed;
top: 0;
left: 0;
width: 100vw;
height: 100vh;
background: rgba(0,0,0,0.5);
z-index: 2147483647;
display: flex;
justify-content: center;
align-items: center;
font-family: "GoMono Nerd Font", "Noto Sans", Arial;
`;
      const container = document.createElement('div');
      container.style.cssText = `
background: ${theme.background};
padding: 20px;
border-radius: 12px;
box-shadow: 0 4px 20px rgba(0,0,0,0.2);
display: flex;
flex-direction: column;
gap: 15px;
min-width: 300px;
border: 1px solid ${theme.border};
`;
      const title = document.createElement('div');
      title.style.cssText = `
color: ${theme.title};
font-size: 16px;
font-weight: bold;
text-align: center;
margin-bottom: 5px;
`;
      title.textContent = _("notifications.file_input_title");
      const inputContainer = document.createElement('div');
      inputContainer.style.cssText = `
display: flex;
flex-direction: column;
gap: 10px;
align-items: center;
`;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.style.cssText = `
padding: 8px;
border-radius: 8px;
border: 1px solid ${theme.border};
background: ${themeMode === 'dark' ? '#444' : '#fff'};
color: ${theme.text};
width: 100%;
cursor: pointer;
font-family: inherit;
font-size: 14px;
`;
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = `
display: flex;
gap: 10px;
justify-content: center;
margin-top: 10px;
`;
      const cancelButton = document.createElement('button');
      cancelButton.style.cssText = `
padding: 8px 16px;
border-radius: 8px;
border: none;
background: ${theme.button.close.background};
color: ${theme.button.close.text};
cursor: pointer;
font-size: 14px;
transition: all 0.2s ease;
font-family: inherit;
`;
      cancelButton.textContent = _("settings.cancel");
      cancelButton.onmouseover = () => {
        cancelButton.style.transform = 'translateY(-2px)';
        cancelButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
      };
      cancelButton.onmouseout = () => {
        cancelButton.style.transform = 'none';
        cancelButton.style.boxShadow = 'none';
      };
      const translateButton = document.createElement('button');
      translateButton.style.cssText = `
padding: 8px 16px;
border-radius: 8px;
border: none;
background: ${theme.button.translate.background};
color: ${theme.button.translate.text};
cursor: pointer;
font-size: 14px;
transition: all 0.2s ease;
opacity: 0.5;
font-family: inherit;
`;
      translateButton.textContent = _("notifications.translate");
      translateButton.disabled = true;
      translateButton.onmouseover = () => {
        if (!translateButton.disabled) {
          translateButton.style.transform = 'translateY(-2px)';
          translateButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        }
      };
      translateButton.onmouseout = () => {
        translateButton.style.transform = 'none';
        translateButton.style.boxShadow = 'none';
      };
      const cleanup = () => {
        div.remove();
        resolve();
      };
      input.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (file) {
          translateButton.disabled = false;
          translateButton.style.opacity = '1';
        } else {
          translateButton.disabled = true;
          translateButton.style.opacity = '0.5';
        }
      });
      cancelButton.addEventListener('click', cleanup);
      translateButton.addEventListener('click', async () => {
        const file = input.files?.[0];
        if (file) {
          try {
            translateButton.disabled = true;
            translateButton.style.opacity = '0.5';
            translateButton.textContent = _("notifications.processing");
            await onFileSelected(file);
          } catch (error) {
            console.error('Error processing file:', error);
          }
          cleanup();
        }
      });
      buttonContainer.appendChild(cancelButton);
      buttonContainer.appendChild(translateButton);
      inputContainer.appendChild(input);
      container.appendChild(title);
      container.appendChild(inputContainer);
      container.appendChild(buttonContainer);
      div.appendChild(container);
      translator.uiRoot.getRoot().appendChild(div);
      div.addEventListener('click', (e) => {
        if (e.target === div) cleanup();
      });
    });
  }
  function createFileOrUrlInput(acceptedTypes, onInputSelected) {
    return new Promise((resolve) => {
      const translator = window.translator;
      const _ = translator.userSettings._;
      const themeMode = translator.userSettings.settings.theme;
      const theme = CONFIG.THEME[themeMode];
      const isDark = themeMode === "dark";
      const div = document.createElement('div');
      div.style.cssText = `
position: fixed;
top: 0;
left: 0;
width: 100vw;
height: 100vh;
background: rgba(0,0,0,0.5);
z-index: 2147483647;
display: flex;
justify-content: center;
align-items: center;
font-family: "GoMono Nerd Font", "Noto Sans", Arial;
`;
      const container = document.createElement('div');
      container.style.cssText = `
background: ${theme.background};
padding: 20px;
border-radius: 12px;
box-shadow: 0 4px 20px rgba(0,0,0,0.2);
display: flex;
flex-direction: column;
gap: 15px;
min-width: 350px;
max-width: 90vw;
border: 1px solid ${theme.border};
color: ${theme.text};
`;
      const title = document.createElement('div');
      title.style.cssText = `
color: ${theme.title};
font-size: 16px;
font-weight: bold;
text-align: center;
margin-bottom: 5px;
`;
      title.textContent = _("notifications.file_input_title");
      const modeToggle = document.createElement('div');
      modeToggle.style.cssText = `
display: flex;
justify-content: center;
margin-bottom: 15px;
gap: 10px;
`;
      const fileModeBtn = document.createElement('button');
      fileModeBtn.textContent = "File Local";
      fileModeBtn.style.cssText = `
padding: 8px 15px;
border-radius: 8px;
border: 1px solid ${theme.border};
background: ${isDark ? '#444' : '#eee'};
color: ${theme.text};
cursor: pointer;
font-size: 14px;
font-family: inherit;
transition: all 0.2s ease;
`;
      const urlModeBtn = document.createElement('button');
      urlModeBtn.textContent = "URL";
      urlModeBtn.style.cssText = fileModeBtn.style.cssText;
      modeToggle.appendChild(fileModeBtn);
      modeToggle.appendChild(urlModeBtn);
      const fileInputContainer = document.createElement('div');
      fileInputContainer.style.cssText = `
display: flex;
flex-direction: column;
gap: 10px;
align-items: center;
`;
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = acceptedTypes;
      fileInput.style.cssText = `
padding: 8px;
border-radius: 8px;
border: 1px solid ${theme.border};
background: ${isDark ? '#444' : '#fff'};
color: ${theme.text};
width: 100%;
cursor: pointer;
font-family: inherit;
font-size: 14px;
`;
      const urlInputContainer = document.createElement('div');
      urlInputContainer.style.cssText = `
display: none; /* Hidden by default */
flex-direction: column;
gap: 10px;
align-items: center;
`;
      const urlLabel = document.createElement('div');
      urlLabel.textContent = _("notifications.file_input_url_title");
      urlLabel.style.cssText = `color: ${theme.text}; font-size: 14px;`;
      const urlInput = document.createElement('input');
      urlInput.type = 'text';
      urlInput.placeholder = _("notifications.file_input_url_placeholder");
      urlInput.style.cssText = `
padding: 8px;
border-radius: 8px;
border: 1px solid ${theme.border};
background: ${isDark ? '#444' : '#fff'};
color: ${theme.text};
width: 100%;
font-family: inherit;
font-size: 14px;
`;
      urlInputContainer.appendChild(urlLabel);
      urlInputContainer.appendChild(urlInput);
      const buttonContainer = document.createElement('div');
      buttonContainer.style.cssText = `
display: flex;
gap: 10px;
justify-content: center;
margin-top: 10px;
`;
      const cancelButton = document.createElement('button');
      cancelButton.style.cssText = `
padding: 8px 16px;
border-radius: 8px;
border: none;
background: ${theme.button.close.background};
color: ${theme.button.close.text};
cursor: pointer;
font-size: 14px;
transition: all 0.2s ease;
font-family: inherit;
`;
      cancelButton.textContent = _("settings.cancel");
      cancelButton.onmouseover = () => {
        cancelButton.style.transform = 'translateY(-2px)';
        cancelButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
      };
      cancelButton.onmouseout = () => {
        cancelButton.style.transform = 'none';
        cancelButton.style.boxShadow = 'none';
      };
      const translateButton = document.createElement('button');
      translateButton.style.cssText = `
padding: 8px 16px;
border-radius: 8px;
border: none;
background: ${theme.button.translate.background};
color: ${theme.button.translate.text};
cursor: pointer;
font-size: 14px;
transition: all 0.2s ease;
opacity: 0.5;
font-family: inherit;
`;
      translateButton.textContent = _("notifications.translate");
      translateButton.disabled = true;
      translateButton.onmouseover = () => {
        if (!translateButton.disabled) {
          translateButton.style.transform = 'translateY(-2px)';
          translateButton.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        }
      };
      translateButton.onmouseout = () => {
        translateButton.style.transform = 'none';
        translateButton.style.boxShadow = 'none';
      };
      const updateTranslateButtonState = () => {
        const hasFile = fileInput.files?.[0];
        const hasUrl = urlInput.value.trim().startsWith('http://') || urlInput.value.trim().startsWith('https://');
        translateButton.disabled = !(hasFile || hasUrl);
        translateButton.style.opacity = (hasFile || hasUrl) ? '1' : '0.5';
      };
      let currentMode = 'file'; // 'file' or 'url'
      const switchMode = (mode) => {
        currentMode = mode;
        if (mode === 'file') {
          fileInputContainer.style.display = 'flex';
          urlInputContainer.style.display = 'none';
          fileModeBtn.style.backgroundColor = isDark ? '#666' : '#ccc';
          urlModeBtn.style.backgroundColor = isDark ? '#444' : '#eee';
        } else {
          fileInputContainer.style.display = 'none';
          urlInputContainer.style.display = 'flex';
          urlModeBtn.style.backgroundColor = isDark ? '#666' : '#ccc';
          fileModeBtn.style.backgroundColor = isDark ? '#444' : '#eee';
        }
        updateTranslateButtonState();
      };
      fileModeBtn.addEventListener('click', () => switchMode('file'));
      urlModeBtn.addEventListener('click', () => switchMode('url'));
      fileInput.addEventListener('change', updateTranslateButtonState);
      urlInput.addEventListener('input', updateTranslateButtonState);
      const cleanup = () => {
        div.remove();
        resolve();
      };
      cancelButton.addEventListener('click', cleanup);
      translateButton.addEventListener('click', async () => {
        if (currentMode === 'file') {
          const file = fileInput.files?.[0];
          if (file) {
            try {
              translateButton.disabled = true;
              translateButton.style.opacity = '0.5';
              translateButton.textContent = _("notifications.processing");
              await onInputSelected(file);
            } catch (error) {
              console.error('Error processing file:', error);
            }
            cleanup();
          }
        } else {
          const url = urlInput.value.trim();
          if (url.startsWith('http://') || url.startsWith('https://')) {
            try {
              translateButton.disabled = true;
              translateButton.style.opacity = '0.5';
              translateButton.textContent = _("notifications.processing_url");
              await onInputSelected(url);
            } catch (error) {
              console.error('Error processing URL:', error);
            }
            cleanup();
          } else {
            translator.ui.showNotification(_("notifications.invalid_url_format"), "error");
            translateButton.disabled = false;
            translateButton.style.opacity = '1';
          }
        }
      });
      buttonContainer.appendChild(cancelButton);
      buttonContainer.appendChild(translateButton);
      fileInputContainer.appendChild(fileInput);
      container.appendChild(title);
      container.appendChild(modeToggle);
      container.appendChild(fileInputContainer);
      container.appendChild(urlInputContainer);
      container.appendChild(buttonContainer);
      div.appendChild(container);
      translator.uiRoot.getRoot().appendChild(div);
      div.addEventListener('click', (e) => {
        if (e.target === div) cleanup();
      });
      switchMode('file');
    });
  }
  GM_registerMenuCommand("📄 Webpage Translation", async () => {
    const translator = window.translator;
    if (translator) {
      try {
        translator.ui.showTranslatingStatus();
        const result = await translator.page.translatePage();
        translator.ui.removeTranslatingStatus();
        if (result.success) {
          translator.ui.showNotification(result.message, "success");
        } else {
          translator.ui.showNotification(result.message, "warning");
        }
      } catch (error) {
        console.error("Page translation error:", error);
        translator.ui.showNotification(error.message, "error");
      } finally {
        translator.ui.removeTranslatingStatus();
      }
    }
  });
  GM_registerMenuCommand("🌐 Google Translate (Webpage)", () => {
    const translator = window.translator;
    if (translator) {
      if (!translator.userSettings.settings.pageTranslation.enableGoogleTranslate) {
        translator.ui.showNotification(translator.userSettings._("notifications.page_translation_disabled"), "warning");
        return;
      }
      translator.ui.triggerGooglePageTranslate();
    }
  });
  GM_registerMenuCommand("📸 OCR Region Translate", async () => {
    const translator = window.translator;
    if (translator) {
      try {
        const screenshot = await translator.ocr.captureScreen();
        if (!screenshot) {
          throw new Error(translator.userSettings._("notifications.un_cr_screen"));
        }
        translator.ui.showTranslatingStatus();
        const result = await translator.ocr.processImage(screenshot);
        translator.ui.removeTranslatingStatus();
        if (!result) {
          throw new Error(translator.userSettings._("notifications.un_pr_screen"));
        }
        translator.ui.formatTrans(result);
      } catch (error) {
        console.error("Screen translation error:", error);
        translator.ui.showNotification(error.message, "error");
      } finally {
        translator.ui.removeTranslatingStatus();
      }
    }
  });
  GM_registerMenuCommand("🖼️ Web Image Translate", () => {
    const translator = window.translator;
    if (translator) {
      translator.ui.startWebImageOCR();
    }
  });
  GM_registerMenuCommand("📚 Manga Web Translate", () => {
    const translator = window.translator;
    if (translator) {
      translator.ui.startMangaTranslation();
    }
  });
  GM_registerMenuCommand("📷 Image File Translate", async () => {
    const translator = window.translator;
    if (!translator) return;
    await createFileInput("image/*", async (file) => {
      try {
        translator.ui.showTranslatingStatus();
        const result = await translator.ocr.processImage(file);
        translator.ui.removeTranslatingStatus();
        translator.ui.formatTrans(result);
      } catch (error) {
        translator.ui.showNotification(error.message);
      } finally {
        translator.ui.removeTranslatingStatus();
      }
    });
  });
  GM_registerMenuCommand("🎵 Media File Translate", async () => {
    const translator = window.translator;
    if (!translator) return;
    await createFileInput("audio/*, video/*", async (file) => {
      try {
        translator.ui.showTranslatingStatus();
        await translator.media.processMediaFile(file);
        translator.ui.removeTranslatingStatus();
      } catch (error) {
        translator.ui.showNotification(error.message);
      } finally {
        translator.ui.removeTranslatingStatus();
      }
    });
  });
  GM_registerMenuCommand("📄 File Translate (pdf, srt, vtt, md, json, txt, html)", async () => {
    const translator = window.translator;
    if (!translator) return;
    const supportedFormats = RELIABLE_FORMATS.text.formats
      .map(f => `.${f.ext}`)
      .join(',');
    await createFileInput(supportedFormats, async (file) => {
      try {
        translator.ui.showTranslatingStatus();
        const result = await translator.translateFile(file);
        console.log(file.type);
        const blob = file.type === 'pdf' ? result : new Blob([result], { type: file.type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `king1x32_translated_${file.type.endsWith('pdf') ? file.name.replace(".pdf", ".html") : file.name}`;
        translator.uiRoot.getRoot().appendChild(a);
        a.click();
        URL.revokeObjectURL(url);
        a.remove();
        translator.ui.removeTranslatingStatus();
        translator.ui.showNotification(translator.userSettings._("notifications.file_translated_success"), "success");
      } catch (error) {
        console.error(translator.userSettings._("notifications.file_translation_error"), error);
        translator.ui.showNotification(error.message, "error");
      } finally {
        translator.ui.removeTranslatingStatus();
      }
    });
  });
  GM_registerMenuCommand("🌐 Translate VIP", async () => {
    const translator = window.translator;
    if (translator) {
      translator.ui.handleGeminiFileOrUrlTranslation();
    }
  });
  GM_registerMenuCommand("⚙️ King Translator AI Settings", () => {
    const translator = window.translator;
    if (translator) {
      const settingsUI = translator.userSettings.createSettingsUI();
      translator.uiRoot.getRoot().appendChild(settingsUI);
    }
  });
  initializeTranslator();
}
