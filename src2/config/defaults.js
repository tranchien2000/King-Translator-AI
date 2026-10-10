  const DEFAULT_SETTINGS = {
    uiLanguage: "en", // cài đặt ngôn ngữ giao diện mặc định: 'en', 'vi'
    theme: CONFIG.THEME.mode,
    apiProvider: CONFIG.API.currentProvider,
    apiKey: {
      gemini: [""],
      perplexity: [""],
      claude: [""],
      openai: [""],
      mistral: [""],
      deepseek: [""]
    },
    currentKeyIndex: {
      gemini: 0,
      perplexity: 0,
      claude: 0,
      openai: 0,
      mistral: 0,
      deepseek: 0
    },
    geminiOptions: {
      modelType: "fast", // 'fast', 'pro', 'think', 'custom'
      fastModel: "gemini-2.0-flash-lite",
      proModel: "gemini-2.0-pro-exp-02-05",
      thinkModel: "gemini-2.0-flash-thinking-exp-01-21",
      customModel: ""
    },
    perplexityOptions: {
      modelType: "fast", // 'fast', 'balance', 'pro', 'custom'
      fastModel: "sonar",
      balanceModel: "sonar-deep-research",
      proModel: "sonar-pro",
      customModel: ""
    },
    claudeOptions: {
      modelType: "balance", // 'fast', 'balance', 'pro', 'custom'
      fastModel: "claude-3-5-haiku-latest",
      balanceModel: "claude-3-7-sonnet-latest",
      proModel: "claude-3-opus-latest",
      customModel: ""
    },
    openaiOptions: {
      modelType: "fast", // 'fast', 'balance', 'pro', 'custom'
      fastModel: "gpt-4.1-nano",
      balanceModel: "gpt-4.1",
      proModel: "o1-pro",
      customModel: ""
    },
    mistralOptions: {
      modelType: "free", // 'free', 'research', 'premier', 'custom'
      freeModel: "mistral-small-latest",
      researchModel: "open-mistral-nemo",
      premierModel: "codestral-latest",
      customModel: "",
    },
    deepseekOptions: {
      modelType: "fast", // 'fast', 'custom'
      fastModel: "deepseek-chat",
      customModel: ""
    },
    ollamaOptions: {
      endpoint: "http://localhost:11434",
      model: "llama3",
    },
    localproxyOptions: {
      endpoint: "http://localhost:3000",
      provider: "9router",
      model: "9router-free",
      temperature: 0.7
    },
    contextMenu: {
      enabled: true
    },
    promptSettings: {
      enabled: true,
      customPrompts: {
        normal: "",
        advanced: "",
        chinese: "",
        ocr: "",
        media: "",
        page: "",
        file_content: "",
        normal_chinese: "",
        advanced_chinese: "",
        chinese_chinese: "",
        ocr_chinese: "",
        media_chinese: "",
        page_chinese: "",
        file_content_chinese: ""
      },
      useCustom: false
    },
    inputTranslation: {
      enabled: false,
      savePosition: true,
      excludeSelectors: []
    },
    translatorTools: {
      enabled: true
    },
    pageTranslation: {
      enabled: true,
      autoTranslate: false,
      showInitialButton: false, // Hiện nút dịch ban đầu
      buttonTimeout: 10000, // Thời gian hiển thị nút (10 giây)
      enableGoogleTranslate: false, // Mặc định tắt
      googleTranslateLayout: 'INLINE', // "SIMPLE", "INLINE", "OVERLAY"
      useCustomSelectors: false,
      customSelectors: [],
      defaultSelectors: CONFIG.pageTranslation.defaultSelectors,
      generation: {
        temperature: 0.6,
        topP: 0.8,
        topK: 30
      }
    },
    ocrOptions: {
      enabled: true,
      mangaTranslateAll: true,
      preferredProvider: CONFIG.API.currentProvider,
      maxFileSize: CONFIG.OCR.maxFileSize,
      temperature: CONFIG.OCR.generation.temperature,
      topP: CONFIG.OCR.generation.topP,
      topK: CONFIG.OCR.generation.topK
    },
    mediaOptions: {
      enabled: true,
      temperature: CONFIG.MEDIA.generation.temperature,
      topP: CONFIG.MEDIA.generation.topP,
      topK: CONFIG.MEDIA.generation.topK,
      audio: {
        processingInterval: 2000, // 2 seconds
        bufferSize: 16384,
        format: {
          sampleRate: 44100,
          numChannels: 1,
          bitsPerSample: 16
        }
      }
    },
    videoStreamingOptions: {
      enabled: false,
      fontSize: 'clamp(1rem, 1.5cqw, 2.5rem)',
      backgroundColor: 'rgba(0,0,0,0.7)',
      textColor: 'white'
    },
    displayOptions: {
      fontSize: "1rem",
      minPopupWidth: "300px",
      maxPopupWidth: "90vw",
      webImageTranslation: {
        fontSize: "auto",
        minFontSize: "8px",
        maxFontSize: "24px"
      },
      translationMode: "translation_only", // 'translation_only', 'parallel' hoặc 'language_learning'
      sourceLanguage: "auto", // 'auto' hoặc 'zh','en','vi',...
      targetLanguage: "vi", // 'vi', 'en', 'zh', 'ko', 'ja',...
      languageLearning: {
        showSource: true
      }
    },
    ttsOptions: {
      enabled: true,
      defaultProvider: 'google', // 'google', 'google_translate', 'local'
      defaultGeminiModel: 'gemini-2.5-flash-preview-tts',
      defaultModel: 'tts-1', // 'tts-1', 'tts-1-hd', 'gpt-4o-mini-tts'
      defaultSpeed: 1.0,
      defaultPitch: 1.0,
      defaultVolume: 1.0,
      defaultVoice: {
        gemini: { voice: 'Leda' },
        openai: { voice: 'sage' },
        google: {
          vi: { name: 'vi-VN-Standard-A', display: 'Google Nữ (Bắc) - Standard' },
          en: { name: 'en-US-Standard-A', display: 'US Female 1 - Standard' },
          zh: { name: 'cmn-CN-Standard-A', display: 'CN Female 1 - Standard' },
          ja: { name: 'ja-JP-Standard-A', display: 'JP Female 1 - Standard' },
          ko: { name: 'ko-KR-Standard-A', display: 'KR Female 1 - Standard' },
        }
      }
    },
    shortcuts: {
      settingsEnabled: true,
      enabled: true,
      pageTranslate: { key: "f", altKey: true },
      inputTranslate: { key: "t", altKey: true },
      ocrRegion: { key: "z", altKey: true },        // Dịch vùng chọn
      ocrWebImage: { key: "x", altKey: true },      // Dịch ảnh trên web
      ocrMangaWeb: { key: "c", altKey: true },      // Dịch manga trên web
      quickTranslate: { key: "q", altKey: true },
      popupTranslate: { key: "e", altKey: true },
      advancedTranslate: { key: "a", altKey: true }
    },
    clickOptions: {
      enabled: true,
      singleClick: { translateType: "popup" },
      doubleClick: { translateType: "quick" },
      hold: { translateType: "advanced" }
    },
    touchOptions: {
      enabled: true,
      sensitivity: 100,
      twoFingers: { translateType: "popup" },
      threeFingers: { translateType: "advanced" },
      fourFingers: { translateType: "quick" }
    },
    cacheOptions: {
      text: {
        enabled: true,
        maxSize: CONFIG.CACHE.text.maxSize,
        expirationTime: CONFIG.CACHE.text.expirationTime
      },
      image: {
        enabled: true,
        maxSize: CONFIG.CACHE.image.maxSize,
        expirationTime: CONFIG.CACHE.image.expirationTime
      },
      media: {
        enabled: true,
        maxSize: CONFIG.CACHE.media.maxSize,
        expirationTime: CONFIG.CACHE.media.expirationTime
      },
      tts: {
        enabled: true,
        maxSize: CONFIG.CACHE.tts.maxSize,
        expirationTime: CONFIG.CACHE.tts.expirationTime
      }
    },
    rateLimit: {
      maxRequests: CONFIG.RATE_LIMIT.maxRequests,
      perMilliseconds: CONFIG.RATE_LIMIT.perMilliseconds
    }
  };
