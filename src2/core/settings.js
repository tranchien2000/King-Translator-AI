  class UserSettings {
    constructor(translator) {
      this.translator = translator;
      this.settings = this.loadSettings();
      this.isSettingsUIOpen = false;
      this.currentLanguage = CONFIG.LANG_DATA[this.settings.uiLanguage];
      if (!this.currentLanguage) {
        const browserLang = navigator.language || navigator.userLanguage;
        const langData = browserLang.startsWith('vi') ? 'vi' : 'en';
        this.currentLanguage = CONFIG.LANG_DATA[langData];
        this.settings.uiLanguage = langData;
        GM_setValue("translatorSettings", JSON.stringify(this.settings));
      }
    }
    _ = (key, replacements = {}) => {
      let text = key.split('.').reduce((obj, k) => obj && obj[k], this.currentLanguage);
      if (text === undefined) {
        console.warn(`Missing translation for key: ${key} in language ${this.settings.uiLanguage}`);
        text = key;
      }
      for (const placeholder in replacements) {
        text = text.replace(`{${placeholder}}`, replacements[placeholder]);
      }
      return text;
    }
    createProviderRadios(settings) {
      const providers = [
        ['gemini', 'Gemini'],
        ['perplexity', 'Perplexity'],
        ['claude', 'Claude'],
        ['openai', 'OpenAI'],
        ['mistral', 'Mistral'],
        ['deepseek', 'Deepseek'],
        ['ollama', 'Ollama']
      ];
      return `
  ${this.chunk(providers, 2).map(group => `
    <div class="radio-group">
      ${group.map(([value, label]) => `
        <label>
          <input type="radio" name="apiProvider" value="${value}"
            ${settings.apiProvider === value ? "checked" : ""}>
          <span class="settings-label">${label}</span>
        </label>
      `).join('')}
    </div>
  `).join('')}
`;
    }
    createApiKeySection(provider, settings) {
      const keys = settings.apiKey[provider];
      return `
  <div id="${provider}Keys" style="margin-bottom: 10px;">
    <h4 class="settings-label" style="margin-bottom: 5px;">${this.capitalize(provider)} API Keys</h4>
    <div class="api-keys-container">
      ${keys.map((key, index) => `
        <div class="api-key-entry" style="display: flex; gap: 10px; margin-bottom: 5px;">
          <input type="text" class="${provider}-key" value="${key}"
            style="flex: 1; width: 100%; border-radius: 6px; margin-left: 5px;">
          <button class="remove-key" data-provider="${provider}" data-index="${index}"
            style="background-color: #ff4444;">×</button>
        </div>
      `).join('')}
    </div>
    <button id="add-${provider}-key" class="settings-label"
      style="background-color: #28a745; border-radius: 5px; margin-top: 5px;">+ Add ${this.capitalize(provider)} Key</button>
  </div>
`;
    }
    createModelSection(provider, settings) {
      if (provider === 'ollama') {
        const options = settings.ollamaOptions;
        return `
  <div class="ollama-models" style="display: ${settings.apiProvider === 'ollama' ? "" : "none"}">
    <div class="settings-grid">
      <span class="settings-label">Ollama API Endpoint:</span>
      <input type="text" id="ollama-endpoint" class="settings-input"
        value="${options?.endpoint || 'http://localhost:11434'}" placeholder="e.g., http://localhost:11434">
    </div>
    <div class="settings-grid">
      <span class="settings-label">Model Name:</span>
      <input type="text" id="ollama-custom-model" class="settings-input"
        value="${options?.model || 'llama3'}" placeholder="Enter model name (e.g., llama3)">
    </div>
     <div class="settings-grid">
      <span class="settings-label">${this._("settings.temperature")}</span>
      <input type="number" id="ollama-temperature" class="settings-input"
        value="${options?.temperature ?? 0.6}" min="0" max="2" step="0.1">
    </div>
    <div class="settings-grid">
      <span class="settings-label">${this._("settings.top_p")}</span>
      <input type="number" id="ollama-top-p" class="settings-input"
        value="${options?.topP ?? 0.8}" min="0" max="1" step="0.1">
    </div>
    <div class="settings-grid">
      <span class="settings-label">${this._("settings.top_k")}</span>
      <input type="number" id="ollama-top-k" class="settings-input"
        value="${options?.topK ?? 30}" min="1" max="100" step="1">
    </div>
  </div>
`;
      }
      const options = settings[`${provider}Options`];
      const modelTypes = this.getModelTypesCss(provider);
      const config = CONFIG.API.providers[provider].models;
      return `
  <div class="${provider}-models" style="display: ${settings.apiProvider === provider ? "" : "none"}">
    <div class="settings-grid">
      <span class="settings-label">${this._("settings.model_type")}</span>
      <select id="${provider}ModelType" class="settings-input">
        ${modelTypes.map(([value, label]) => `
          <option value="${value}" ${options?.modelType === value ? "selected" : ""}>${label}</option>
        `).join('')}
      </select>
    </div>
    ${modelTypes.map(([type]) => type !== 'custom' ? `
      <div id="${provider}-${type}-container" class="settings-grid"
        style="display: ${options?.modelType === type ? "" : "none"}">
        <span class="settings-label">Model ${this.capitalize(type)}:</span>
        <select id="${provider}-${type}-model" class="settings-input">
          ${(config[type] || []).map(model => `
            <option value="${model}" ${options?.[`${type}Model`] === model ? "selected" : ""}>
              ${model}
            </option>
          `).join('')}
        </select>
      </div>
    ` : `
      <div id="${provider}-custom-container" class="settings-grid"
        style="display: ${options?.modelType === 'custom' ? "" : "none"}">
        <span class="settings-label">Model tùy chỉnh:</span>
        <input type="text" id="${provider}-custom-model" class="settings-input"
          value="${options?.customModel || ''}" placeholder="Nhập tên model">
      </div>
    `).join('')}
  </div>
`;
    }
    getModelTypesCss(provider) {
      const types = {
        gemini: [['fast', 'Fast'], ['pro', 'Pro'], ['think', 'Thinking']],
        mistral: [['free', 'Free'], ['research', 'Research'], ['premier', 'Premier']],
        deepseek: [['fast', 'Fast']],
        default: [['fast', 'Fast'], ['balance', 'Balance'], ['pro', 'Pro']]
      };
      const baseTypes = types[provider] || types.default;
      return [...baseTypes, ['custom', 'Custom']];
    }
    getModelTypes(provider) {
      const types = {
        gemini: ['fast', 'pro', 'think'],
        mistral: ['free', 'research', 'premier'],
        deepseek: ['fast'],
        default: ['fast', 'balance', 'pro']
      };
      const baseTypes = types[provider] || types.default;
      return [...baseTypes, 'custom'];
    }
    capitalize(str) {
      if (str === "openai") return "OpenAI";
      return str.charAt(0).toUpperCase() + str.slice(1);
    }
    chunk(arr, size) {
      return Array.from({ length: Math.ceil(arr.length / size) }, (_v, i) =>
        arr.slice(i * size, i * size + size)
      );
    }
    renderSettingsUI(settings) {
      return `
${this.createProviderRadios(settings)}
<div style="margin-bottom: 15px;">
  <h3>API MODEL</h3>
  ${['gemini', 'perplexity', 'claude', 'openai', 'mistral', 'deepseek', 'ollama']
          .map(p => this.createModelSection(p, settings)).join('')}
</div>
<div style="margin-bottom: 15px;">
  <h3>API KEYS</h3>
  ${['gemini', 'perplexity', 'claude', 'openai', 'mistral', 'deepseek']
          .map(p => this.createApiKeySection(p, settings)).join('')}
</div>
`;
    }
    createSettingsUI() {
      if (this.isSettingsUIOpen) {
        return;
      }
      this.isSettingsUIOpen = true;
      const container = document.createElement("div");
      const themeMode = this.settings.theme || CONFIG.THEME.mode;
      const isDark = themeMode === "dark";
      const backupVoice = (provider, name, lang = '') => {
        const voice = this.settings.ttsOptions?.defaultVoice?.[provider];
        if (provider === 'openai' || provider === 'gemini') {
          if (voice?.voice) {
            return voice.voice === name;
          }
          return name === (provider === 'gemini' ? 'Leda' : 'sage');
        }
        if (voice?.[lang]?.name) {
          return voice[lang].name === name;
        }
        return name.endsWith('Wavenet-A');
      }
      const createToggleSwitchHTML = (id, isChecked) => `
        <label class="toggle-switch">
          <input type="checkbox" id="${id}" ${isChecked ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      `;
      const styleElement = document.createElement("style");
      styleElement.textContent = `
        :host {
          --bg-primary: ${isDark ? "#2a2a3e" : "#f5f7fa"};
          --bg-secondary: ${isDark ? "#1e1e2f" : "#ffffff"};
          --bg-tertiary: ${isDark ? "#3c3c54" : "#e9ecef"};
          --text-primary: ${isDark ? "#e0e0e0" : "#212529"};
          --text-secondary: ${isDark ? "#b0b0b0" : "#6c757d"};
          --border-color: ${isDark ? "#4a4a6a" : "#dee2e6"};
          --accent-primary: ${isDark ? "#7f5af0" : "#0d6efd"};
          --accent-secondary: ${isDark ? "#2cb67d" : "#198754"};
          --danger-color: ${isDark ? "#f92672" : "#dc3545"};
          --shadow-color: ${isDark ? "rgba(0,0,0,0.4)" : "rgba(0,0,0,0.1)"};
          --font-family: "GoMono Nerd Font", "Noto Sans", Arial, sans-serif;
        }
        * {
          box-sizing: border-box;
          font-family: var(--font-family);
          margin: 0;
          padding: 0;
          scrollbar-width: thin;
          scrollbar-color: var(--bg-tertiary) transparent;
        }
        *::-webkit-scrollbar { width: 8px; }
        *::-webkit-scrollbar-track { background: transparent; }
        *::-webkit-scrollbar-thumb { background-color: var(--bg-tertiary); border-radius: 4px; border: 2px solid var(--bg-primary); }
        *::-webkit-scrollbar-thumb:hover { background-color: var(--text-secondary); }
        .settings-container {
        }
        .settings-header {
            padding: 1rem 1.5rem;
            border-bottom: 1px solid var(--border-color);
            flex-shrink: 0; /* Header không co lại */
        }
        .settings-wrapper {
          display: flex;
          gap: 1.5rem;
          padding: 1.5rem;
          flex: 1;
          min-height: 0;
          overflow: hidden;
        }
        /* --- Sidebar --- */
        .settings-sidebar {
          flex: 0 0 220px;
          padding-right: 1.5rem;
          border-right: 1px solid var(--border-color);
          overflow-y: auto;
          padding-bottom: 1rem;
        }
        .sidebar-title {
          font-size: 1.2rem;
          font-weight: 600;
          color: var(--text-primary);
          padding: 0 0.75rem 1rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .sidebar-nav {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .sidebar-link {
          display: block;
          padding: 0.75rem;
          margin-bottom: 0.25rem;
          border-radius: 8px;
          text-decoration: none;
          color: var(--text-secondary);
          font-weight: 500;
          cursor: pointer;
          transition: background-color 0.2s ease, color 0.2s ease;
        }
        .sidebar-link:hover {
          background-color: var(--bg-tertiary);
          color: var(--text-primary);
        }
        .sidebar-link.active {
          background-color: var(--accent-primary);
          color: white;
          font-weight: 600;
        }
        /* --- Content Area --- */
        .settings-content {
          flex: 1;
          min-width: 0;
          overflow-y: auto;
          padding-right: 1rem;
          padding-bottom: 1rem;
        }
        .settings-section {
          display: none;
        }
        .settings-section.active {
          display: block;
        }
        .section-card {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
          box-shadow: 0 4px 12px var(--shadow-color);
        }
        h2 {
          font-size: 1.5rem;
          color: var(--text-primary);
          margin-bottom: 1.5rem;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 1rem;
        }
        h3 {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--text-primary);
          margin: 1.5rem 0 1rem;
        }
        h3:first-child {
          margin-top: 0;
        }
        /* --- Form Elements --- */
        .settings-grid {
          display: grid;
          grid-template-columns: minmax(180px, 1fr) 2fr;
          align-items: center;
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .settings-label, .settings-grid > span {
          color: var(--text-primary);
          font-weight: 500;
          justify-self: start;
        }
        .settings-input, input[type="text"], input[type="number"], select, textarea {
          width: 100%;
          padding: 0.6rem 0.8rem;
          border-radius: 8px;
          border: 1px solid var(--border-color);
          background-color: var(--bg-primary);
          color: var(--text-primary);
          font-size: 0.9rem;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
        }
        .settings-input:focus, input[type="text"]:focus, input[type="number"]:focus, select:focus, textarea:focus {
          outline: none;
          border-color: var(--accent-primary);
          box-shadow: 0 0 0 3px ${isDark ? "rgba(127, 90, 240, 0.3)" : "rgba(13, 110, 253, 0.3)"};
        }
        textarea.prompt-textarea {
          min-height: 120px;
          resize: vertical;
          font-family: monospace;
        }
        /* --- Toggle Switch --- */
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 44px;
          height: 24px;
          justify-self: start;
        }
        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: var(--bg-tertiary);
          transition: .3s;
          border-radius: 24px;
        }
        .slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: white;
          transition: .3s;
          border-radius: 50%;
        }
        input:checked + .slider {
          background-color: var(--accent-primary);
        }
        input:checked + .slider:before {
          transform: translateX(20px);
        }
        /* Radio buttons */
        .radio-group {
          display: flex;
          gap: 1rem;
          align-items: center;
        }
        input[type="radio"] {
          accent-color: var(--accent-primary);
          width: 1.1em;
          height: 1.1em;
        }
        /* API Keys */
        .api-keys-container {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .api-key-entry {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .api-key-entry input {
          flex-grow: 1;
        }
        .remove-key, .add-key-btn {
          padding: 0.5rem;
          font-size: 1rem;
          line-height: 1;
          border-radius: 6px;
          cursor: pointer;
          transition: background-color 0.2s ease;
        }
        .remove-key {
          background-color: var(--danger-color);
          color: white;
          border: none;
        }
        .remove-key:hover { background-color: ${isDark ? "#ff498f" : "#a82836"}; }
        .add-key-btn {
          background-color: var(--accent-secondary);
          color: white;
          border: none;
          padding: 0.6rem 1rem;
        }
        .add-key-btn:hover { background-color: ${isDark ? "#36d393" : "#13653f"}; }
        /* Buttons */
        .btn {
          padding: 0.75rem 1.5rem;
          font-size: 0.9rem;
          font-weight: 600;
          border-radius: 8px;
          border: none;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .btn-primary { background-color: var(--accent-primary); color: white; }
        .btn-primary:hover { background-color: ${isDark ? "#916cff" : "#0b5ed7"}; }
        .btn-secondary { background-color: var(--bg-tertiary); color: var(--text-primary); }
        .btn-secondary:hover { background-color: ${isDark ? "#4a4a6a" : "#d3d9df"}; }
        /* --- Footer --- */
        .settings-footer {
          flex-shrink: 0;
          background-color: var(--bg-secondary);
          padding: 1rem 1.5rem;
          border-top: 1px solid var(--border-color);
          display: flex;
          justify-content: flex-end;
          gap: 0.75rem;
          box-shadow: 0 -4px 12px var(--shadow-color);
        }
        /* Responsive */
        @media (max-width: 992px) {
          .settings-wrapper {
            flex-direction: column;
            padding: 1rem;
          }
          .settings-sidebar {
            flex: 0 0 auto;
            border-right: none;
            border-bottom: 1px solid var(--border-color);
            padding-right: 0;
            padding-bottom: 1rem;
            overflow-y: visible;
          }
          .sidebar-nav {
            display: flex;
            flex-wrap: nowrap;
            overflow-x: auto;
            gap: 0.5rem;
            padding-bottom: 8px;
            margin-bottom: -8px;
            /* Ẩn thanh cuộn để giao diện gọn gàng hơn trên di động */
            -ms-overflow-style: none;  /* IE and Edge */
            scrollbar-width: none;  /* Firefox */
          }
          .sidebar-nav::-webkit-scrollbar {
            display: none; /* Chrome, Safari, and Opera */
          }
          .sidebar-link {
              /* Đảm bảo các mục menu không bị co lại khi không đủ không gian */
              flex-shrink: 0;
          }
          .settings-content {
            padding-right: 0;
          }
          .settings-grid {
            grid-template-columns: 1fr;
            gap: 0.5rem;
          }
          .settings-label, .settings-grid > span {
            margin-bottom: 0;
          }
        }
      `;
      container.innerHTML = `
        <div class="settings-container">
          <div class="settings-wrapper">
            <aside class="settings-sidebar">
              <h2 class="sidebar-title">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 0 2l-.15.08a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1 0-2l.15-.08a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                ${this._("settings.title")}
              </h2>
              <nav class="sidebar-nav"></nav>
            </aside>
            <main class="settings-content"></main>
          </div>
          <div class="settings-footer">
            <button id="importSettings" class="btn btn-secondary">${this._("settings.import_settings")}</button>
            <input type="file" id="importInput" accept=".json" style="display: none;">
            <button id="exportSettings" class="btn btn-secondary">${this._("settings.export_settings")}</button>
            <button id="cancelSettings" class="btn btn-secondary">${this._("settings.cancel")}</button>
            <button id="saveSettings" class="btn btn-primary">${this._("settings.save")}</button>
          </div>
        </div>
      `;
      const contentArea = container.querySelector('.settings-content');
      const navArea = container.querySelector('.sidebar-nav');
      const sections = {
        interface: { title: this._("settings.interface_section"), icon: "🎨" },
        api: { title: this._("settings.api_provider_section"), icon: "🔑" },
        input: { title: this._("settings.input_translation_section"), icon: "⌨️" },
        tools: { title: this._("settings.tools_section"), icon: "⚙️" },
        page: { title: this._("settings.page_translation_section"), icon: "📄" },
        prompts: { title: this._("settings.prompt_settings_section"), icon: "✍️" },
        ocr: { title: this._("settings.ocr_section"), icon: "📷" },
        media: { title: this._("settings.media_section"), icon: "🎵" },
        video: { title: this._("settings.video_streaming_section"), icon: "📺" },
        display: { title: this._("settings.display_section"), icon: "🖼️" },
        tts: { title: this._("settings.tts_section"), icon: "🔊" },
        context: { title: this._("settings.context_menu_section"), icon: "🖱️" },
        shortcuts: { title: this._("settings.shortcuts_section"), icon: "⚡" },
        button: { title: this._("settings.button_options_section"), icon: "🔘" },
        touch: { title: this._("settings.touch_options_section"), icon: "🖐️" },
        rate: { title: this._("settings.rate_limit_section"), icon: "⏱️" },
        cache: { title: this._("settings.cache_section"), icon: "💾" }
      };
      for (const [key, { title, icon }] of Object.entries(sections)) {
        const navLink = document.createElement('a');
        navLink.className = 'sidebar-link';
        navLink.dataset.target = `section-${key}`;
        navLink.innerHTML = `${icon} ${title}`;
        navArea.appendChild(navLink);
        const sectionDiv = document.createElement('div');
        sectionDiv.id = `section-${key}`;
        sectionDiv.className = 'settings-section';
        sectionDiv.innerHTML = `<div class="section-card"><h2>${icon} ${title}</h2><div class="section-content-wrapper"></div></div>`;
        contentArea.appendChild(sectionDiv);
      }
      container.querySelector('#section-interface .section-content-wrapper').innerHTML = `
        <div class="settings-grid">
          <span class="settings-label">${this._("settings.theme_mode")}</span>
          <div class="radio-group">
            <label><input type="radio" name="theme" value="light" ${!isDark ? "checked" : ""}> ${this._("settings.light")}</label>
            <label><input type="radio" name="theme" value="dark" ${isDark ? "checked" : ""}> ${this._("settings.dark")}</label>
          </div>
        </div>
        <div class="settings-grid">
          <span class="settings-label">${this._("settings.ui_language")}</span>
          <div class="radio-group">
            <label><input type="radio" name="uiLanguage" value="en" ${this.settings.uiLanguage === "en" ? "checked" : ""}> English</label>
            <label><input type="radio" name="uiLanguage" value="vi" ${this.settings.uiLanguage === "vi" ? "checked" : ""}> Tiếng Việt</label>
          </div>
        </div>
      `;
      container.querySelector('#section-api .section-content-wrapper').innerHTML = `
        <h3>API PROVIDER</h3>
        ${this.createProviderRadios(this.settings)}
        <h3>API MODEL</h3>
        <div class="api-model-settings">
          ${['gemini', 'perplexity', 'claude', 'openai', 'mistral', 'deepseek', 'ollama'].map(p => this.createModelSection(p, this.settings)).join('')}
        </div>
        <h3>API KEYS</h3>
        <div class="api-keys-settings">
          ${['gemini', 'perplexity', 'claude', 'openai', 'mistral', 'deepseek'].map(p => this.createApiKeySection(p, this.settings)).join('')}
        </div>
      `;
      container.querySelector('#section-input .section-content-wrapper').innerHTML = `
        <div class="settings-grid">
          <label class="settings-label" for="inputTranslationEnabled">${this._("settings.enable_feature")}</label>
          ${createToggleSwitchHTML('inputTranslationEnabled', this.settings.inputTranslation?.enabled)}
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="inputTranslationSavePosition">${this._("settings.save_position")}</label>
          ${createToggleSwitchHTML('inputTranslationSavePosition', this.settings.inputTranslation?.savePosition)}
        </div>
      `;
      container.querySelector('#section-tools .section-content-wrapper').innerHTML = `
        <div class="settings-grid">
          <label class="settings-label" for="ToolsEnabled">${this._("settings.enable_tools")}</label>
          ${createToggleSwitchHTML('ToolsEnabled', this.settings.translatorTools?.enabled)}
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="showTranslatorTools">${this._("settings.enable_tools_current_web")}</label>
          ${createToggleSwitchHTML('showTranslatorTools', safeLocalStorageGet("translatorToolsEnabled") === "true")}
        </div>
      `;
      container.querySelector('#section-page .section-content-wrapper').innerHTML = `
        <div class="settings-grid">
          <label class="settings-label" for="pageTranslationEnabled">${this._("settings.enable_page_translation")}</label>
          ${createToggleSwitchHTML('pageTranslationEnabled', this.settings.pageTranslation?.enabled)}
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="showInitialButton">${this._("settings.show_initial_button")}</label>
          ${createToggleSwitchHTML('showInitialButton', this.settings.pageTranslation?.showInitialButton)}
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="autoTranslatePage">${this._("settings.auto_translate_page")}</label>
          ${createToggleSwitchHTML('autoTranslatePage', this.settings.pageTranslation?.autoTranslate)}
        </div>
        <h3>Google Translate</h3>
        <div class="settings-grid">
          <label class="settings-label" for="enableGoogleTranslate">${this._("settings.enable_google_translate_page")}</label>
          ${createToggleSwitchHTML('enableGoogleTranslate', this.settings.pageTranslation?.enableGoogleTranslate)}
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="googleTranslateLayout">${this._("settings.google_translate_layout")}</label>
          <select id="googleTranslateLayout" class="settings-input">
            <option value="SIMPLE" ${this.settings.pageTranslation?.googleTranslateLayout === "SIMPLE" ? "selected" : ""}>${this._("settings.google_translate_minimal")}</option>
            <option value="INLINE" ${this.settings.pageTranslation?.googleTranslateLayout === "INLINE" ? "selected" : ""}>${this._("settings.google_translate_inline")}</option>
            <option value="OVERLAY" ${this.settings.pageTranslation?.googleTranslateLayout === "OVERLAY" ? "selected" : ""}>${this._("settings.google_translate_selected")}</option>
          </select>
        </div>
        <h3>Selectors loại trừ</h3>
        <div class="settings-grid">
            <label class="settings-label" for="useCustomSelectors">${this._("settings.custom_selectors")}</label>
            ${createToggleSwitchHTML('useCustomSelectors', this.settings.pageTranslation?.useCustomSelectors)}
        </div>
        <div id="selectorsSettings" style="display: ${this.settings.pageTranslation?.useCustomSelectors ? "block" : "none"}">
          <div class="settings-grid" style="align-items: start;">
            <label class="settings-label" for="customSelectors">${this._("settings.exclude_selectors")}</label>
            <div>
              <textarea id="customSelectors" class="prompt-textarea">${this.settings.pageTranslation?.customSelectors?.join("\n") || ""}</textarea>
              <div style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px;">${this._("settings.one_selector_per_line")}</div>
            </div>
          </div>
          <div class="settings-grid">
            <label class="settings-label" for="combineWithDefault">${this._("settings.combine_with_default")}</label>
            <div>
              ${createToggleSwitchHTML('combineWithDefault', this.settings.pageTranslation?.combineWithDefault)}
              <span style="font-size: 0.8rem; color: var(--text-secondary);">${this._("settings.combine_with_default_info")}</span>
            </div>
          </div>
        </div>
        <h3>Thông số AI</h3>
        <div class="settings-grid">
          <label class="settings-label" for="pageTranslationTemperature">${this._("settings.temperature")}</label>
          <input type="number" id="pageTranslationTemperature" class="settings-input" value="${this.settings.pageTranslation.generation.temperature}" min="0" max="1" step="0.1">
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="pageTranslationTopP">${this._("settings.top_p")}</label>
          <input type="number" id="pageTranslationTopP" class="settings-input" value="${this.settings.pageTranslation.generation.topP}" min="0" max="1" step="0.1">
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="pageTranslationTopK">${this._("settings.top_k")}</label>
          <input type="number" id="pageTranslationTopK" class="settings-input" value="${this.settings.pageTranslation.generation.topK}" min="1" max="100" step="1">
        </div>
      `;
      container.querySelector('#section-prompts .section-content-wrapper').innerHTML = `
        <div class="settings-grid">
          <label class="settings-label" for="useCustomPrompt">${this._("settings.use_custom_prompt")}</label>
          ${createToggleSwitchHTML('useCustomPrompt', this.settings.promptSettings?.useCustom)}
        </div>
        <div id="promptSettings" style="display: ${this.settings.promptSettings?.useCustom ? "block" : "none"}">
          <!-- Normal prompts -->
          <div class="settings-grid" style="align-items: start;">
            <span class="settings-label">${this._("settings.prompt_normal")}</span>
            <textarea id="normalPrompt" class="prompt-textarea" placeholder="${this._("settings.prompt_normal")}">${this.settings.promptSettings?.customPrompts?.normal || ""}</textarea>
          </div>
          <div class="settings-grid" style="align-items: start;">
            <span class="settings-label">${this._("settings.prompt_normal_chinese")}</span>
            <textarea id="normalPrompt_chinese" class="prompt-textarea" placeholder="${this._("settings.prompt_normal_chinese")}">${this.settings.promptSettings?.customPrompts?.normal_chinese || ""}</textarea>
          </div>
          <!-- Advanced prompts -->
          <div class="settings-grid" style="align-items: start;">
            <span class="settings-label">${this._("settings.prompt_advanced")}</span>
            <textarea id="advancedPrompt" class="prompt-textarea" placeholder="${this._("settings.prompt_advanced")}">${this.settings.promptSettings?.customPrompts?.advanced || ""}</textarea>
          </div>
          <div class="settings-grid" style="align-items: start;">
            <span class="settings-label">${this._("settings.prompt_advanced_chinese")}</span>
            <textarea id="advancedPrompt_chinese" class="prompt-textarea" placeholder="${this._("settings.prompt_advanced_chinese")}">${this.settings.promptSettings?.customPrompts?.advanced_chinese || ""}</textarea>
          </div>
          <!-- OCR prompts -->
          <div class="settings-grid" style="align-items: start;">
            <span class="settings-label">${this._("settings.prompt_ocr")}</span>
            <textarea id="ocrPrompt" class="prompt-textarea" placeholder="${this._("settings.prompt_ocr")}">${this.settings.promptSettings?.customPrompts?.ocr || ""}</textarea>
          </div>
          <div class="settings-grid" style="align-items: start;">
            <span class="settings-label">${this._("settings.prompt_ocr_chinese")}</span>
            <textarea id="ocrPrompt_chinese" class="prompt-textarea" placeholder="${this._("settings.prompt_ocr_chinese")}">${this.settings.promptSettings?.customPrompts?.ocr_chinese || ""}</textarea>
          </div>
          <!-- Media prompts -->
          <div class="settings-grid" style="align-items: start;">
            <span class="settings-label">${this._("settings.prompt_media")}</span>
            <textarea id="mediaPrompt" class="prompt-textarea" placeholder="${this._("settings.prompt_media")}">${this.settings.promptSettings?.customPrompts?.media || ""}</textarea>
          </div>
          <div class="settings-grid" style="align-items: start;">
            <span class="settings-label">${this._("settings.prompt_media_chinese")}</span>
            <textarea id="mediaPrompt_chinese" class="prompt-textarea" placeholder="${this._("settings.prompt_media_chinese")}">${this.settings.promptSettings?.customPrompts?.media_chinese || ""}</textarea>
          </div>
          <!-- Page prompts -->
          <div class="settings-grid" style="align-items: start;">
            <span class="settings-label">${this._("settings.prompt_page")}</span>
            <textarea id="pagePrompt" class="prompt-textarea" placeholder="${this._("settings.prompt_page")}">${this.settings.promptSettings?.customPrompts?.page || ""}</textarea>
          </div>
          <div class="settings-grid" style="align-items: start;">
            <span class="settings-label">${this._("settings.prompt_page_chinese")}</span>
            <textarea id="pagePrompt_chinese" class="prompt-textarea" placeholder="${this._("settings.prompt_page_chinese")}">${this.settings.promptSettings?.customPrompts?.page_chinese || ""}</textarea>
          </div>
          <!-- File Content prompts -->
          <div class="settings-grid" style="align-items: start;">
            <span class="settings-label">${this._("settings.prompt_file_content")}</span>
            <textarea id="fileContentPrompt" class="prompt-textarea" placeholder="${this._("settings.prompt_file_content")}">${this.settings.promptSettings?.customPrompts?.file_content || ""}</textarea>
          </div>
          <div class="settings-grid" style="align-items: start;">
            <span class="settings-label">${this._("settings.prompt_file_content_chinese")}</span>
            <textarea id="fileContentPrompt_chinese" class="prompt-textarea" placeholder="${this._("settings.prompt_file_content_chinese")}">${this.settings.promptSettings?.customPrompts?.file_content_chinese || ""}</textarea>
          </div>
          <div style="margin-top: 1rem; font-size: 0.8rem; color: var(--text-secondary);">
            <b>${this._("settings.prompt_vars_info")}</b>
            <ul style="margin-left: 1.5rem; margin-top: 0.5rem; list-style-type: disc;">
              <li><code>{text}</code> - ${this._("settings.prompt_var_text")}</li>
              <li><code>{docTitle}</code> - ${this._("settings.prompt_var_doc_title")}</li>
              <li><code>{targetLang}</code> - ${this._("settings.prompt_var_target_lang")}</li>
              <li><code>{sourceLang}</code> - ${this._("settings.prompt_var_source_lang")}</li>
            </ul>
            <b style="display: block; margin-top: 1rem;">${this._("settings.prompt_notes")}</b>
            <ul style="margin-left: 1.5rem; margin-top: 0.5rem; list-style-type: disc;">
              <li>${this._("settings.prompt_notes_required")}</li>
              <li>${this._("settings.prompt_note_en")}</li>
              <li>${this._("settings.prompt_note_zh")}</li>
            </ul>
          </div>
        </div>
      `;
      container.querySelector('#section-ocr .section-content-wrapper').innerHTML = `
        <div class="settings-grid">
          <label class="settings-label" for="ocrEnabled">${this._("settings.enable_ocr")}</label>
          ${createToggleSwitchHTML('ocrEnabled', this.settings.ocrOptions?.enabled)}
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="mangaTranslateAll">${this._("settings.enable_manga_translate_all")}</label>
          ${createToggleSwitchHTML('mangaTranslateAll', this.settings.ocrOptions?.mangaTranslateAll)}
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="mangaTranslateAllSiteOnly">${this._("settings.enable_manga_translate_all_site_only")}</label>
          ${createToggleSwitchHTML('mangaTranslateAllSiteOnly', (safeLocalStorageGet("kingtranslator_manga_all_for_site") === "true" || true))}
        </div>
        <h3>Thông số AI</h3>
        <div class="settings-grid">
          <label class="settings-label" for="ocrTemperature">${this._("settings.temperature")}</label>
          <input type="number" id="ocrTemperature" class="settings-input" value="${this.settings.ocrOptions.temperature}" min="0" max="1" step="0.1">
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="ocrTopP">${this._("settings.top_p")}</label>
          <input type="number" id="ocrTopP" class="settings-input" value="${this.settings.ocrOptions.topP}" min="0" max="1" step="0.1">
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="ocrTopK">${this._("settings.top_k")}</label>
          <input type="number" id="ocrTopK" class="settings-input" value="${this.settings.ocrOptions.topK}" min="1" max="100" step="1">
        </div>
      `;
      container.querySelector('#section-media .section-content-wrapper').innerHTML = `
        <div class="settings-grid">
          <label class="settings-label" for="mediaEnabled">${this._("settings.enable_media")}</label>
          ${createToggleSwitchHTML('mediaEnabled', this.settings.mediaOptions.enabled)}
        </div>
        <h3>Thông số AI</h3>
        <div class="settings-grid">
          <label class="settings-label" for="mediaTemperature">${this._("settings.temperature")}</label>
          <input type="number" id="mediaTemperature" class="settings-input" value="${this.settings.mediaOptions.temperature}" min="0" max="1" step="0.1">
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="mediaTopP">${this._("settings.top_p")}</label>
          <input type="number" id="mediaTopP" class="settings-input" value="${this.settings.mediaOptions.topP}" min="0" max="1" step="0.1">
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="mediaTopK">${this._("settings.top_k")}</label>
          <input type="number" id="mediaTopK" class="settings-input" value="${this.settings.mediaOptions.topK}" min="1" max="100" step="1">
        </div>
      `;
      container.querySelector('#section-video .section-content-wrapper').innerHTML = `
        <div class="settings-grid">
          <label class="settings-label" for="videoStreamingEnabled">${this._("settings.enable_feature")}</label>
          ${createToggleSwitchHTML('videoStreamingEnabled', this.settings.videoStreamingOptions?.enabled)}
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="videoStreamingFontSize">${this._("settings.font_size")}</label>
          <input type="text" id="videoStreamingFontSize" class="settings-input" placeholder="clamp(1rem, 1.5cqw, 2.5rem)" value="${this.settings.videoStreamingOptions?.fontSize}">
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="videoStreamingBgColor">${this._("settings.background_color")}</label>
          <input type="text" id="videoStreamingBgColor" class="settings-input" placeholder="rgba(0,0,0,0.7)" value="${this.settings.videoStreamingOptions?.backgroundColor}">
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="videoStreamingTextColor">${this._("settings.text_color")}</label>
          <input type="text" id="videoStreamingTextColor" class="settings-input" placeholder="white" value="${this.settings.videoStreamingOptions?.textColor}">
        </div>
      `;
      container.querySelector('#section-display .section-content-wrapper').innerHTML = `
        <div class="settings-grid">
          <label class="settings-label" for="displayMode">${this._("settings.display_mode")}</label>
          <select id="displayMode" class="settings-input">
            <option value="translation_only" ${this.settings.displayOptions.translationMode === "translation_only" ? "selected" : ""}>${this._("settings.translation_only")}</option>
            <option value="parallel" ${this.settings.displayOptions.translationMode === "parallel" ? "selected" : ""}>${this._("settings.parallel")}</option>
            <option value="language_learning" ${this.settings.displayOptions.translationMode === "language_learning" ? "selected" : ""}>${this._("settings.language_learning")}</option>
          </select>
        </div>
        <div id="languageLearningOptions" style="display: ${this.settings.displayOptions.translationMode === "language_learning" ? "block" : "none"}">
          <div class="settings-grid">
            <label class="settings-label" for="showSource">${this._("settings.show_source")}</label>
            ${createToggleSwitchHTML('showSource', this.settings.displayOptions.languageLearning.showSource)}
          </div>
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="sourceLanguage">${this._("settings.source_language")}</label>
          <select id="sourceLanguage" class="settings-input">
            <option value="auto" ${this.settings.displayOptions.sourceLanguage === "auto" ? "selected" : ""}>${this._("auto_detect")}</option>
            ${Object.entries(CONFIG.LANGUAGES).map(([lang, name]) => `<option value="${lang}" ${this.settings.displayOptions.sourceLanguage === lang ? 'selected' : ''}>${name}</option>`).join('')}
          </select>
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="targetLanguage">${this._("settings.target_language")}</label>
          <select id="targetLanguage" class="settings-input">
            ${Object.entries(CONFIG.LANGUAGES).map(([lang, name]) => `<option value="${lang}" ${this.settings.displayOptions.targetLanguage === lang ? 'selected' : ''}>${name}</option>`).join('')}
          </select>
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="webImageFontSize">${this._("settings.web_image_font_size")}</label>
          <input type="text" id="webImageFontSize" class="settings-input" placeholder="auto" value="${this.settings.displayOptions?.webImageTranslation?.fontSize}">
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="fontSize">${this._("settings.popup_font_size")}</label>
          <input type="text" id="fontSize" class="settings-input" placeholder="1rem" value="${this.settings.displayOptions?.fontSize}">
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="minPopupWidth">${this._("settings.min_popup_width")}</label>
          <input type="text" id="minPopupWidth" class="settings-input" placeholder="330px" value="${this.settings.displayOptions?.minPopupWidth}">
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="maxPopupWidth">${this._("settings.max_popup_width")}</label>
          <input type="text" id="maxPopupWidth" class="settings-input" placeholder="50vw" value="${this.settings.displayOptions?.maxPopupWidth}">
        </div>
      `;
      container.querySelector('#section-tts .section-content-wrapper').innerHTML = `
        <div class="settings-grid">
          <label class="settings-label" for="ttsEnabled">${this._("settings.enable_tts")}</label>
          ${createToggleSwitchHTML('ttsEnabled', this.settings.ttsOptions?.enabled)}
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="tts-provider">${this._("settings.tts_source")}</label>
          <select id="tts-provider" class="settings-input">
            <option value="google" ${this.settings.ttsOptions?.defaultProvider === "google" ? "selected" : ""}>Google Cloud TTS</option>
            <option value="google_translate" ${this.settings.ttsOptions?.defaultProvider === "google_translate" ? "selected" : ""}>Google Translate TTS</option>
            <option value="gemini" ${this.settings.ttsOptions?.defaultProvider === "gemini" ? "selected" : ""}>Gemini AI TTS</option>
            <option value="openai" ${this.settings.ttsOptions?.defaultProvider === "openai" ? "selected" : ""}>OpenAI TTS</option>
            <option value="local" ${this.settings.ttsOptions?.defaultProvider === "local" ? "selected" : ""}>TTS Thiết bị</option>
          </select>
        </div>
        <div id="tts-gemini-container" style="display: ${this.settings.ttsOptions?.defaultProvider === 'gemini' ? "block" : "none"}">
          <div class="settings-grid">
            <label class="settings-label" for="tts-gemini-model">${this._("settings.model_label")} TTS:</label>
            <select id="tts-gemini-model" class="settings-input">${CONFIG.TTS.GEMINI.MODEL.map(model => `<option value="${model}" ${this.settings.ttsOptions?.defaultGeminiModel === model ? "selected" : ""}>${model}</option>`).join('')}</select>
          </div>
          <div class="settings-grid">
            <label class="settings-label" for="tts-gemini-select">${this._("settings.voice")}:</label>
            <select id="tts-gemini-select" class="settings-input">${CONFIG.TTS.GEMINI.VOICES.map(voice => `<option value="${voice}" ${backupVoice('gemini', voice) ? 'selected' : ''}>${voice}</option>`).join('')}</select>
          </div>
        </div>
        <div id="tts-openai-container" style="display: ${this.settings.ttsOptions?.defaultProvider === 'openai' ? "block" : "none"}">
          <div class="settings-grid">
            <label class="settings-label" for="tts-openai-model">${this._("settings.model_label")} TTS:</label>
            <select id="tts-openai-model" class="settings-input">${CONFIG.TTS.OPENAI.MODEL.map(model => `<option value="${model}" ${this.settings.ttsOptions?.defaultModel === model ? "selected" : ""}>${model}</option>`).join('')}</select>
          </div>
          <div class="settings-grid">
            <label class="settings-label" for="tts-openai-select">${this._("settings.voice")}:</label>
            <select id="tts-openai-select" class="settings-input">${CONFIG.TTS.OPENAI.VOICES.map(voice => `<option value="${voice}" ${backupVoice('openai', voice) ? 'selected' : ''}>${voice}</option>`).join('')}</select>
          </div>
        </div>
        <div id="tts-google-container" style="display: ${this.settings.ttsOptions?.defaultProvider === 'google' ? "block" : "none"}">
          <h3>${this._("settings.default_voice")}</h3>
          ${Object.entries(CONFIG.TTS.GOOGLE.VOICES).map(([lang, voiceList]) => `
            <div class="settings-grid">
              <label class="settings-label">${CONFIG.LANGUAGEDISPLAY[lang].display}:</label>
              <select class="settings-input" id="tts-google-select" data-lang="${lang}">
                ${voiceList.map(voice => `<option value="${voice.name}" ${backupVoice('google', voice.name, lang) ? 'selected' : ''}>${voice.display}</option>`).join('')}
              </select>
            </div>
          `).join('')}
        </div>
        <div class="settings-grid">
          <label class="settings-label">${this._("settings.speed")}</label>
          <div style="display:flex;align-items:center;gap:8px"><input type="range" id="ttsDefaultSpeed" style="flex:1" value="${this.settings.ttsOptions?.defaultSpeed || 1.0}" min="0.1" max="2" step="0.1"><span style="min-width:36px;text-align:right">${this.settings.ttsOptions?.defaultSpeed || 1.0}</span></div>
        </div>
        <div class="settings-grid">
          <label class="settings-label">${this._("settings.pitch")}</label>
          <div style="display:flex;align-items:center;gap:8px"><input type="range" id="ttsDefaultPitch" style="flex:1" value="${this.settings.ttsOptions?.defaultPitch || 1.0}" min="0" max="2" step="0.1"><span style="min-width:36px;text-align:right">${this.settings.ttsOptions?.defaultPitch || 1.0}</span></div>
        </div>
        <div class="settings-grid">
          <label class="settings-label">${this._("settings.volume")}</label>
          <div style="display:flex;align-items:center;gap:8px"><input type="range" id="ttsDefaultVolume" style="flex:1" value="${this.settings.ttsOptions?.defaultVolume || 1.0}" min="0" max="1" step="0.1"><span style="min-width:36px;text-align:right">${this.settings.ttsOptions?.defaultVolume || 1.0}</span></div>
        </div>
      `;
      container.querySelector('#section-context .section-content-wrapper').innerHTML = `
        <div class="settings-grid">
          <label class="settings-label" for="contextMenuEnabled">${this._("settings.enable_context_menu")}</label>
          ${createToggleSwitchHTML('contextMenuEnabled', this.settings.contextMenu?.enabled)}
        </div>
      `;
      container.querySelector('#section-shortcuts .section-content-wrapper').innerHTML = `
        <div class="settings-grid">
          <label class="settings-label" for="settingsShortcutEnabled">${this._("settings.enable_settings_shortcut")}</label>
          ${createToggleSwitchHTML('settingsShortcutEnabled', this.settings.shortcuts?.settingsEnabled)}
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="shortcutsEnabled">${this._("settings.enable_translation_shortcuts")}</label>
          ${createToggleSwitchHTML('shortcutsEnabled', this.settings.shortcuts?.enabled)}
        </div>
        <div class="settings-grid">
          <label class="settings-label">${this._("settings.ocr_region_shortcut")}</label>
          <div class="shortcut-container"><span class="shortcut-prefix">Cmd/Alt +</span><input type="text" id="ocrRegionKey" class="shortcut-input settings-input" value="${this.settings.shortcuts.ocrRegion.key}"></div>
        </div>
        <div class="settings-grid">
          <label class="settings-label">${this._("settings.ocr_web_image_shortcut")}</label>
          <div class="shortcut-container"><span class="shortcut-prefix">Cmd/Alt +</span><input type="text" id="ocrWebImageKey" class="shortcut-input settings-input" value="${this.settings.shortcuts.ocrWebImage.key}"></div>
        </div>
        <div class="settings-grid">
          <label class="settings-label">${this._("settings.manga_web_shortcut")}</label>
          <div class="shortcut-container"><span class="shortcut-prefix">Cmd/Alt +</span><input type="text" id="ocrMangaWebKey" class="shortcut-input settings-input" value="${this.settings.shortcuts.ocrMangaWeb.key}"></div>
        </div>
        <div class="settings-grid">
          <label class="settings-label">${this._("settings.page_translate_shortcut")}</label>
          <div class="shortcut-container"><span class="shortcut-prefix">Cmd/Alt +</span><input type="text" id="pageTranslateKey" class="shortcut-input settings-input" value="${this.settings.shortcuts.pageTranslate.key}"></div>
        </div>
        <div class="settings-grid">
          <label class="settings-label">${this._("settings.input_translate_shortcut")}</label>
          <div class="shortcut-container"><span class="shortcut-prefix">Cmd/Alt +</span><input type="text" id="inputTranslationKey" class="shortcut-input settings-input" value="${this.settings.shortcuts.inputTranslate.key}"></div>
        </div>
        <div class="settings-grid">
          <label class="settings-label">${this._("settings.quick_translate_shortcut")}</label>
          <div class="shortcut-container"><span class="shortcut-prefix">Cmd/Alt +</span><input type="text" id="quickKey" class="shortcut-input settings-input" value="${this.settings.shortcuts.quickTranslate.key}"></div>
        </div>
        <div class="settings-grid">
          <label class="settings-label">${this._("settings.popup_translate_shortcut")}</label>
          <div class="shortcut-container"><span class="shortcut-prefix">Cmd/Alt +</span><input type="text" id="popupKey" class="shortcut-input settings-input" value="${this.settings.shortcuts.popupTranslate.key}"></div>
        </div>
        <div class="settings-grid">
          <label class="settings-label">${this._("settings.advanced_translate_shortcut")}</label>
          <div class="shortcut-container"><span class="shortcut-prefix">Cmd/Alt +</span><input type="text" id="advancedKey" class="shortcut-input settings-input" value="${this.settings.shortcuts.advancedTranslate.key}"></div>
        </div>
      `;
      container.querySelector('#section-button .section-content-wrapper').innerHTML = `
        <div class="settings-grid">
          <label class="settings-label" for="translationButtonEnabled">${this._("settings.enable_translation_button")}</label>
          ${createToggleSwitchHTML('translationButtonEnabled', this.settings.clickOptions?.enabled)}
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="singleClickSelect">${this._("settings.single_click")}</label>
          <select id="singleClickSelect" class="settings-input">
            <option value="quick" ${this.settings.clickOptions.singleClick.translateType === "quick" ? "selected" : ""}>${this._("settings.quick_translate_shortcut")}</option>
            <option value="popup" ${this.settings.clickOptions.singleClick.translateType === "popup" ? "selected" : ""}>${this._("settings.popup_translate_shortcut")}</option>
            <option value="advanced" ${this.settings.clickOptions.singleClick.translateType === "advanced" ? "selected" : ""}>${this._("settings.advanced_translate_shortcut")}</option>
          </select>
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="doubleClickSelect">${this._("settings.double_click")}</label>
          <select id="doubleClickSelect" class="settings-input">
            <option value="quick" ${this.settings.clickOptions.doubleClick.translateType === "quick" ? "selected" : ""}>${this._("settings.quick_translate_shortcut")}</option>
            <option value="popup" ${this.settings.clickOptions.doubleClick.translateType === "popup" ? "selected" : ""}>${this._("settings.popup_translate_shortcut")}</option>
            <option value="advanced" ${this.settings.clickOptions.doubleClick.translateType === "advanced" ? "selected" : ""}>${this._("settings.advanced_translate_shortcut")}</option>
          </select>
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="holdSelect">${this._("settings.hold_button")}</label>
          <select id="holdSelect" class="settings-input">
            <option value="quick" ${this.settings.clickOptions.hold.translateType === "quick" ? "selected" : ""}>${this._("settings.quick_translate_shortcut")}</option>
            <option value="popup" ${this.settings.clickOptions.hold.translateType === "popup" ? "selected" : ""}>${this._("settings.popup_translate_shortcut")}</option>
            <option value="advanced" ${this.settings.clickOptions.hold.translateType === "advanced" ? "selected" : ""}>${this._("settings.advanced_translate_shortcut")}</option>
          </select>
        </div>
      `;
      container.querySelector('#section-touch .section-content-wrapper').innerHTML = `
        <div class="settings-grid">
          <label class="settings-label" for="touchEnabled">${this._("settings.enable_touch")}</label>
          ${createToggleSwitchHTML('touchEnabled', this.settings.touchOptions?.enabled)}
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="twoFingersSelect">${this._("settings.two_fingers")}</label>
          <select id="twoFingersSelect" class="settings-input">
            <option value="quick" ${this.settings.touchOptions?.twoFingers?.translateType === "quick" ? "selected" : ""}>${this._("settings.quick_translate_shortcut")}</option>
            <option value="popup" ${this.settings.touchOptions?.twoFingers?.translateType === "popup" ? "selected" : ""}>${this._("settings.popup_translate_shortcut")}</option>
            <option value="advanced" ${this.settings.touchOptions?.twoFingers?.translateType === "advanced" ? "selected" : ""}>${this._("settings.advanced_translate_shortcut")}</option>
          </select>
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="threeFingersSelect">${this._("settings.three_fingers")}</label>
          <select id="threeFingersSelect" class="settings-input">
            <option value="quick" ${this.settings.touchOptions?.threeFingers?.translateType === "quick" ? "selected" : ""}>${this._("settings.quick_translate_shortcut")}</option>
            <option value="popup" ${this.settings.touchOptions?.threeFingers?.translateType === "popup" ? "selected" : ""}>${this._("settings.popup_translate_shortcut")}</option>
            <option value="advanced" ${this.settings.touchOptions?.threeFingers?.translateType === "advanced" ? "selected" : ""}>${this._("settings.advanced_translate_shortcut")}</option>
          </select>
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="touchSensitivity">${this._("settings.sensitivity")}</label>
          <input type="number" id="touchSensitivity" class="settings-input" value="${this.settings.touchOptions?.sensitivity || 100}" min="50" max="350" step="50">
        </div>
      `;
      container.querySelector('#section-rate .section-content-wrapper').innerHTML = `
        <div class="settings-grid">
          <label class="settings-label" for="maxRequests">${this._("settings.max_requests")}</label>
          <input type="number" id="maxRequests" class="settings-input" value="${this.settings.rateLimit?.maxRequests || CONFIG.RATE_LIMIT.maxRequests}" min="1" max="50" step="1">
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="perMilliseconds">${this._("settings.per_milliseconds")}</label>
          <input type="number" id="perMilliseconds" class="settings-input" value="${this.settings.rateLimit?.perMilliseconds || CONFIG.RATE_LIMIT.perMilliseconds}" min="1000" step="1000">
        </div>
      `;
      container.querySelector('#section-cache .section-content-wrapper').innerHTML = `
        <h3>${this._("settings.text_cache")}</h3>
        <div class="settings-grid">
          <label class="settings-label" for="textCacheEnabled">${this._("settings.enable_text_cache")}</label>
          ${createToggleSwitchHTML('textCacheEnabled', this.settings.cacheOptions?.text?.enabled)}
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="textCacheMaxSize">${this._("settings.text_cache_max_size")}</label>
          <input type="number" id="textCacheMaxSize" class="settings-input" value="${this.settings.cacheOptions?.text?.maxSize || CONFIG.CACHE.text.maxSize}" min="10" max="1000">
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="textCacheExpiration">${this._("settings.text_cache_expiration")}</label>
          <input type="number" id="textCacheExpiration" class="settings-input" value="${this.settings.cacheOptions?.text?.expirationTime || CONFIG.CACHE.text.expirationTime}" min="60000" step="60000">
        </div>
        <h3>${this._("settings.image_cache")}</h3>
        <div class="settings-grid">
          <label class="settings-label" for="imageCacheEnabled">${this._("settings.enable_image_cache")}</label>
          ${createToggleSwitchHTML('imageCacheEnabled', this.settings.cacheOptions?.image?.enabled)}
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="imageCacheMaxSize">${this._("settings.image_cache_max_size")}</label>
          <input type="number" id="imageCacheMaxSize" class="settings-input" value="${this.settings.cacheOptions?.image?.maxSize || CONFIG.CACHE.image.maxSize}" min="10" max="100">
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="imageCacheExpiration">${this._("settings.image_cache_expiration")}</label>
          <input type="number" id="imageCacheExpiration" class="settings-input" value="${this.settings.cacheOptions?.image?.expirationTime || CONFIG.CACHE.image.expirationTime}" min="60000" step="60000">
        </div>
        <h3>${this._("settings.media_cache")}</h3>
        <div class="settings-grid">
          <label class="settings-label" for="mediaCacheEnabled">${this._("settings.enable_media_cache")}</label>
          ${createToggleSwitchHTML('mediaCacheEnabled', this.settings.cacheOptions.media?.enabled)}
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="mediaCacheMaxSize">${this._("settings.media_cache_max_size")}</label>
          <input type="number" id="mediaCacheMaxSize" class="settings-input" value="${this.settings.cacheOptions.media?.maxSize || CONFIG.CACHE.media.maxSize}" min="5" max="100">
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="mediaCacheExpiration">${this._("settings.media_cache_expiration")}</label>
          <input type="number" id="mediaCacheExpiration" class="settings-input" value="${this.settings.cacheOptions.media?.expirationTime || CONFIG.CACHE.media.expirationTime}" min="60000" step="60000">
        </div>
        <h3>${this._("settings.tts_cache")}</h3>
        <div class="settings-grid">
          <label class="settings-label" for="ttsCacheEnabled">${this._("settings.enable_tts_cache")}</label>
          ${createToggleSwitchHTML('ttsCacheEnabled', this.settings.cacheOptions.tts?.enabled)}
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="ttsCacheMaxSize">${this._("settings.tts_cache_max_size")}</label>
          <input type="number" id="ttsCacheMaxSize" class="settings-input" value="${this.settings.cacheOptions.tts?.maxSize || CONFIG.CACHE.tts.maxSize}" min="5" max="100">
        </div>
        <div class="settings-grid">
          <label class="settings-label" for="ttsCacheExpiration">${this._("settings.tts_cache_expiration")}</label>
          <input type="number" id="ttsCacheExpiration" class="settings-input" value="${this.settings.cacheOptions.tts?.expirationTime || CONFIG.CACHE.tts.expirationTime}" min="60000" step="60000">
        </div>
      `;
      this.translator.ui.shadowRoot.appendChild(styleElement);
      this.translator.ui.shadowRoot.appendChild(container);
      const mainContainer = container.querySelector(".settings-container");
      Object.assign(mainContainer.style, {
        position: 'fixed',
        backgroundColor: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px var(--shadow-color)',
        width: 'clamp(320px, 95vw, 1200px)',
        height: 'clamp(400px, 90vh, 800px)',
        overflow: 'hidden',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        display: 'flex',
        flexDirection: 'column'
      });
      const sidebarLinks = container.querySelectorAll('.sidebar-link');
      const contentSections = container.querySelectorAll('.settings-section');
      sidebarLinks.forEach(link => {
        link.addEventListener('click', () => {
          const targetId = link.dataset.target;
          sidebarLinks.forEach(l => l.classList.remove('active'));
          link.classList.add('active');
          contentSections.forEach(section => {
            section.classList.remove('active');
            if (section.id === targetId) {
              section.classList.add('active');
            }
          });
        });
      });
      if (sidebarLinks.length > 0) {
        sidebarLinks[0].click();
      }
      const providers = ['gemini', 'perplexity', 'claude', 'openai', 'mistral', 'deepseek', 'ollama'];
      container.querySelectorAll('input[name="apiProvider"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          const provider = e.target.value;
          providers.forEach(p => {
            const modelsContainer = container.querySelector(`.${p}-models`);
            const keysContainer = container.querySelector(`#${p}Keys`);
            if (modelsContainer) modelsContainer.style.display = p === provider ? '' : 'none';
            if (keysContainer) keysContainer.style.display = p === provider ? '' : 'none';
          });
        });
      });
      providers.forEach(provider => {
        const modelType = container.querySelector(`#${provider}ModelType`);
        const modelTypes = this.getModelTypes(provider);
        if (modelType) {
          modelType.addEventListener('change', (e) => {
            const type = e.target.value;
            modelTypes.forEach(t => {
              const modelContainer = container.querySelector(`#${provider}-${t}-container`);
              if (modelContainer) {
                modelContainer.style.display = type === t ? '' : 'none';
              }
            });
          });
        }
      });
      ['gemini', 'perplexity', 'claude', 'openai', 'mistral', 'deepseek'].forEach(provider => {
        const addButton = container.querySelector(`#add-${provider}-key`);
        if (!addButton) return;
        const keyContainer = container.querySelector(`#${provider}Keys .api-keys-container`);
        addButton.addEventListener('click', () => {
          const newEntry = document.createElement('div');
          newEntry.className = 'api-key-entry';
          const currentKeysCount = keyContainer.children.length;
          newEntry.innerHTML = `
            <input type="text" class="${provider}-key" value="">
            <button class="remove-key" data-provider="${provider}" data-index="${currentKeysCount}">×</button>
          `;
          keyContainer.appendChild(newEntry);
        });
      });
      container.addEventListener("click", (e) => {
        if (e.target.classList.contains("remove-key")) {
          e.target.parentElement.remove();
        }
      });
      container.querySelector('#tts-provider').addEventListener('change', (e) => {
        const provider = e.target.value;
        ['google', 'openai', 'gemini'].forEach(p => {
          const ttsContainer = container?.querySelector(`#tts-${p}-container`);
          if (ttsContainer) ttsContainer.style.display = p === provider ? '' : 'none';
        });
      });
      const useCustomSelectors = container.querySelector("#useCustomSelectors");
      const selectorsSettings = container.querySelector("#selectorsSettings");
      useCustomSelectors.addEventListener("change", (e) => {
        selectorsSettings.style.display = e.target.checked ? "block" : "none";
      });
      const useCustomPrompt = container.querySelector("#useCustomPrompt");
      const promptSettings = container.querySelector("#promptSettings");
      if (useCustomPrompt && promptSettings) {
        useCustomPrompt.addEventListener("change", (e) => {
          promptSettings.style.display = e.target.checked ? "block" : "none";
        });
      }
      const displayModeSelect = container.querySelector("#displayMode");
      if (displayModeSelect) {
        displayModeSelect.addEventListener("change", (e) => {
          const languageLearningOptions = container.querySelector("#languageLearningOptions");
          languageLearningOptions.style.display = e.target.value === "language_learning" ? "block" : "none";
        });
      }
      ['Speed', 'Pitch', 'Volume'].forEach(suffix => {
        const input = container.querySelector(`#ttsDefault${suffix}`);
        input.addEventListener('input', () => {
          input.nextElementSibling.textContent = parseFloat(input.value).toFixed(1);
        });
      });
      const handleEscape = (e) => {
        if (e.key === "Escape") {
          document.removeEventListener("keydown", handleEscape);
          if (container && container.parentNode) {
            container.parentNode.removeChild(container);
          }
        }
      };
      document.addEventListener("keydown", handleEscape);
      const exportBtn = container.querySelector("#exportSettings");
      const importBtn = container.querySelector("#importSettings");
      const importInput = container.querySelector("#importInput");
      exportBtn.addEventListener("click", () => this.exportSettings());
      importBtn.addEventListener("click", () => importInput.click());
      importInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          await this.importSettings(file);
          this.showNotification(this._("notifications.import_success"));
          setTimeout(() => location.reload(), 1500);
        } catch (error) {
          this.showNotification(error.message, "error");
        }
      });
      const cancelButton = container.querySelector("#cancelSettings");
      cancelButton.addEventListener("click", () => {
        this.translator.ui.shadowRoot.querySelector(".settings-container").remove();
        this.isSettingsUIOpen = false;
      });
      const saveButton = container.querySelector("#saveSettings");
      saveButton.addEventListener("click", () => {
        this.saveSettings(container);
        this.translator.ui.shadowRoot.querySelector(".settings-container").remove();
        this.isSettingsUIOpen = false;
        location.reload();
      });
      return container;
    }
    getScriptVersion() {
      try {
        const scripts = GM_info.script;
        return scripts.version || "unknown";
      } catch (error) {
        console.warn("Không thể lấy version từ metadata:", error);
        return "unknown";
      }
    }
    async exportSettings() {
      try {
        const settings = this.settings;
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const ver = this.getScriptVersion();
        const filename = `king1x32-translator-settings-v${ver}-${timestamp}.json`;
        const compressedData = LZString.compressToBase64(JSON.stringify(settings));
        const exportData = {
          version: ver,
          timestamp: Date.now(),
          compressed: true,
          data: compressedData
        };
        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
          type: "application/json"
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error("Export error:", error);
        throw new Error(this._("notifications.export_error"));
      }
    }
    async importSettings(file) {
      try {
        const content = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error((this._("notifications.failed_read_file"))));
          reader.readAsText(file);
        });
        let importedData;
        try {
          importedData = JSON.parse(content);
        } catch (error) {
          throw new Error(this._("notifications.invalid_settings_file"));
        }
        if (!this.validateImportFormat(importedData)) {
          throw new Error(this._("notifications.invalid_settings_format"));
        }
        let settingsData;
        if (importedData.compressed) {
          try {
            settingsData = JSON.parse(LZString.decompressFromBase64(importedData.data));
          } catch (error) {
            throw new Error(this._("notifications.decompression_error"));
          }
        } else {
          settingsData = importedData.data || importedData;
        }
        if (!this.validateImportedSettings(settingsData)) {
          throw new Error(this._("notifications.invalid_settings"));
        }
        const mergedSettings = this.mergeWithDefaults(settingsData);
        GM_setValue("translatorSettings", JSON.stringify(mergedSettings));
        return true;
      } catch (error) {
        console.error("Import error:", error);
        throw new Error((this._("notifications.import_error")) + ` ${error.message}`);
      }
    }
    validateImportFormat(data) {
      if (!data) return false;
      if (data.compressed) {
        return typeof data.version === "string" &&
          typeof data.timestamp === "number" &&
          typeof data.data === "string";
      }
      return this.validateImportedSettings(data);
    }
    validateImportedSettings(settings) {
      const requiredFields = [
        "theme",
        "apiProvider",
        "apiKey",
        "ocrOptions",
        "mediaOptions",
        "displayOptions",
        "shortcuts",
        "cacheOptions",
        "rateLimit"
      ];
      return requiredFields.every(field => settings.hasOwnProperty(field));
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
      document.body.appendChild(notification);
      setTimeout(() => notification.remove(), 5000);
    }
    loadSettings() {
      const savedSettings = GM_getValue("translatorSettings");
      return savedSettings
        ? this.mergeWithDefaults(JSON.parse(savedSettings))
        : DEFAULT_SETTINGS;
    }
    mergeWithDefaults(savedSettings) {
      return {
        ...DEFAULT_SETTINGS,
        ...savedSettings,
        geminiOptions: {
          ...DEFAULT_SETTINGS.geminiOptions,
          ...(savedSettings?.geminiOptions || {})
        },
        perplexityOptions: {
          ...DEFAULT_SETTINGS.perplexityOptions,
          ...(savedSettings?.perplexityOptions || {})
        },
        claudeOptions: {
          ...DEFAULT_SETTINGS.claudeOptions,
          ...(savedSettings?.claudeOptions || {})
        },
        openaiOptions: {
          ...DEFAULT_SETTINGS.openaiOptions,
          ...(savedSettings?.openaiOptions || {})
        },
        mistralOptions: {
          ...DEFAULT_SETTINGS.mistralOptions,
          ...(savedSettings?.mistralOptions || {})
        },
        deepseekOptions: {
          ...DEFAULT_SETTINGS.deepseekOptions,
          ...(savedSettings?.deepseekOptions || {})
        },
        ollamaOptions: {
          ...DEFAULT_SETTINGS.ollamaOptions,
          ...(savedSettings?.ollamaOptions || {})
        },
        apiKey: {
          gemini: [
            ...(savedSettings?.apiKey?.gemini ||
              DEFAULT_SETTINGS.apiKey.gemini)
          ],
          perplexity: [
            ...(savedSettings?.apiKey?.perplexity ||
              DEFAULT_SETTINGS.apiKey.perplexity)
          ],
          claude: [
            ...(savedSettings?.apiKey?.claude ||
              DEFAULT_SETTINGS.apiKey.claude)
          ],
          openai: [
            ...(savedSettings?.apiKey?.openai ||
              DEFAULT_SETTINGS.apiKey.openai)
          ],
          mistral: [
            ...(savedSettings?.apiKey?.mistral ||
              DEFAULT_SETTINGS.apiKey.mistral)
          ],
          deepseek: [
            ...(savedSettings?.apiKey?.deepseek ||
              DEFAULT_SETTINGS.apiKey.deepseek)
          ]
        },
        currentKeyIndex: {
          ...DEFAULT_SETTINGS.currentKeyIndex,
          ...(savedSettings?.currentKeyIndex || {})
        },
        contextMenu: {
          ...DEFAULT_SETTINGS.contextMenu,
          ...(savedSettings?.contextMenu || {})
        },
        promptSettings: {
          ...DEFAULT_SETTINGS.promptSettings,
          ...(savedSettings?.promptSettings || {})
        },
        inputTranslation: {
          ...DEFAULT_SETTINGS.inputTranslation,
          ...(savedSettings?.inputTranslation || {})
        },
        translatorTools: {
          ...DEFAULT_SETTINGS.translatorTools,
          ...(savedSettings?.translatorTools || {})
        },
        pageTranslation: {
          ...DEFAULT_SETTINGS.pageTranslation,
          ...(savedSettings?.pageTranslation || {})
        },
        ocrOptions: {
          ...DEFAULT_SETTINGS.ocrOptions,
          ...(savedSettings?.ocrOptions || {})
        },
        mediaOptions: {
          ...DEFAULT_SETTINGS.mediaOptions,
          ...(savedSettings?.mediaOptions || {})
        },
        videoStreamingOptions: {
          ...DEFAULT_SETTINGS.videoStreamingOptions,
          ...(savedSettings?.videoStreamingOptions || {})
        },
        displayOptions: {
          ...DEFAULT_SETTINGS.displayOptions,
          ...(savedSettings?.displayOptions || {})
        },
        ttsOptions: {
          ...DEFAULT_SETTINGS.ttsOptions,
          ...(savedSettings?.ttsOptions || {})
        },
        shortcuts: {
          ...DEFAULT_SETTINGS.shortcuts,
          ...(savedSettings?.shortcuts || {})
        },
        clickOptions: {
          ...DEFAULT_SETTINGS.clickOptions,
          ...(savedSettings?.clickOptions || {})
        },
        touchOptions: {
          ...DEFAULT_SETTINGS.touchOptions,
          ...(savedSettings?.touchOptions || {})
        },
        cacheOptions: {
          text: {
            ...DEFAULT_SETTINGS.cacheOptions.text,
            ...(savedSettings?.cacheOptions?.text || {})
          },
          image: {
            ...DEFAULT_SETTINGS.cacheOptions.image,
            ...(savedSettings?.cacheOptions?.image || {})
          },
          media: {
            ...DEFAULT_SETTINGS.cacheOptions.media,
            ...(savedSettings?.cacheOptions?.media || {})
          },
          tts: {
            ...DEFAULT_SETTINGS.cacheOptions.tts,
            ...(savedSettings?.cacheOptions?.tts || {})
          }
        },
        rateLimit: {
          ...DEFAULT_SETTINGS.rateLimit,
          ...(savedSettings?.rateLimit || {})
        }
      };
    }
    saveSettings(settingsUI) {
      const geminiKeys = Array.from(settingsUI.querySelectorAll(".gemini-key"))
        .map((input) => input.value.trim())
        .filter((key) => key !== "");
      const perplexityKeys = Array.from(settingsUI.querySelectorAll(".perplexity-key"))
        .map((input) => input.value.trim())
        .filter((key) => key !== "");
      const claudeKeys = Array.from(settingsUI.querySelectorAll(".claude-key"))
        .map((input) => input.value.trim())
        .filter((key) => key !== "");
      const openaiKeys = Array.from(settingsUI.querySelectorAll(".openai-key"))
        .map((input) => input.value.trim())
        .filter((key) => key !== "");
      const mistralKeys = Array.from(settingsUI.querySelectorAll(".mistral-key"))
        .map((input) => input.value.trim())
        .filter((key) => key !== "");
      const deepseekKeys = Array.from(settingsUI.querySelectorAll(".deepseek-key"))
        .map((input) => input.value.trim())
        .filter((key) => key !== "");
      const useCustomSelectors = settingsUI.querySelector(
        "#useCustomSelectors"
      ).checked;
      const customSelectors = settingsUI
        .querySelector("#customSelectors")
        .value.split("\n")
        .map((s) => s.trim())
        .filter((s) => s && s.length > 0);
      const combineWithDefault = settingsUI.querySelector(
        "#combineWithDefault"
      ).checked;
      const maxWidthVw = settingsUI.querySelector("#maxPopupWidth").value;
      const maxWidthPx = (window.innerWidth * parseInt(maxWidthVw)) / 100;
      const minWidthPx = parseInt(
        settingsUI.querySelector("#minPopupWidth").value
      );
      const finalMinWidth =
        minWidthPx > maxWidthPx
          ? maxWidthVw
          : settingsUI.querySelector("#minPopupWidth").value;
      const newSettings = {
        theme: settingsUI.querySelector('input[name="theme"]:checked').value,
        uiLanguage: settingsUI.querySelector('input[name="uiLanguage"]:checked').value,
        apiProvider: settingsUI.querySelector('input[name="apiProvider"]:checked').value,
        apiKey: {
          gemini:
            geminiKeys.length > 0
              ? geminiKeys
              : [DEFAULT_SETTINGS.apiKey.gemini[0]],
          perplexity:
            perplexityKeys.length > 0
              ? perplexityKeys
              : [DEFAULT_SETTINGS.apiKey.perplexity[0]],
          claude:
            claudeKeys.length > 0
              ? claudeKeys
              : [DEFAULT_SETTINGS.apiKey.claude[0]],
          openai:
            openaiKeys.length > 0
              ? openaiKeys
              : [DEFAULT_SETTINGS.apiKey.openai[0]],
          mistral:
            mistralKeys.length > 0
              ? mistralKeys
              : [DEFAULT_SETTINGS.apiKey.mistral[0]],
          deepseek:
            deepseekKeys.length > 0
              ? deepseekKeys
              : [DEFAULT_SETTINGS.apiKey.deepseek[0]]
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
          modelType: settingsUI.querySelector('#geminiModelType')?.value,
          fastModel: settingsUI.querySelector('#gemini-fast-model')?.value,
          proModel: settingsUI.querySelector('#gemini-pro-model')?.value,
          thinkModel: settingsUI.querySelector('#gemini-think-model')?.value,
          customModel: settingsUI.querySelector('#gemini-custom-model')?.value
        },
        perplexityOptions: {
          modelType: settingsUI.querySelector('#perplexityModelType')?.value,
          fastModel: settingsUI.querySelector('#perplexity-fast-model')?.value,
          balanceModel: settingsUI.querySelector('#perplexity-balance-model')?.value,
          proModel: settingsUI.querySelector('#perplexity-pro-model')?.value,
          customModel: settingsUI.querySelector('#perplexity-custom-model')?.value
        },
        claudeOptions: {
          modelType: settingsUI.querySelector('#claudeModelType')?.value,
          fastModel: settingsUI.querySelector('#claude-fast-model')?.value,
          balanceModel: settingsUI.querySelector('#claude-balance-model')?.value,
          proModel: settingsUI.querySelector('#claude-pro-model')?.value,
          customModel: settingsUI.querySelector('#claude-custom-model')?.value
        },
        openaiOptions: {
          modelType: settingsUI.querySelector('#openaiModelType')?.value,
          fastModel: settingsUI.querySelector('#openai-fast-model')?.value,
          balanceModel: settingsUI.querySelector('#openai-balance-model')?.value,
          proModel: settingsUI.querySelector('#openai-pro-model')?.value,
          customModel: settingsUI.querySelector('#openai-custom-model')?.value
        },
        mistralOptions: {
          modelType: settingsUI.querySelector('#mistralModelType')?.value,
          freeModel: settingsUI.querySelector('#mistral-free-model')?.value,
          researchModel: settingsUI.querySelector('#mistral-research-model')?.value,
          premierModel: settingsUI.querySelector('#mistral-premier-model')?.value,
          customModel: settingsUI.querySelector('#mistral-custom-model')?.value,
        },
        deepseekOptions: {
          modelType: settingsUI.querySelector('#deepseekModelType')?.value,
          fastModel: settingsUI.querySelector('#deepseek-fast-model')?.value,
          customModel: settingsUI.querySelector('#deepseek-custom-model')?.value
        },
        ollamaOptions: {
          endpoint: settingsUI.querySelector('#ollama-endpoint')?.value.trim(),
          model: settingsUI.querySelector('#ollama-custom-model')?.value.trim(),
          temperature: parseFloat(settingsUI.querySelector('#ollama-temperature')?.value),
          topP: parseFloat(settingsUI.querySelector('#ollama-top-p')?.value),
          topK: parseInt(settingsUI.querySelector('#ollama-top-k')?.value, 10),
        },
        contextMenu: {
          enabled: settingsUI.querySelector("#contextMenuEnabled").checked
        },
        inputTranslation: {
          enabled: settingsUI.querySelector("#inputTranslationEnabled").checked,
          savePosition: settingsUI.querySelector("#inputTranslationSavePosition").checked
        },
        translatorTools: {
          enabled: settingsUI.querySelector("#ToolsEnabled").checked
        },
        promptSettings: {
          enabled: true,
          useCustom: settingsUI.querySelector("#useCustomPrompt").checked,
          customPrompts: {
            normal: settingsUI.querySelector("#normalPrompt").value.trim(),
            normal_chinese: settingsUI
              .querySelector("#normalPrompt_chinese")
              .value.trim(),
            advanced: settingsUI.querySelector("#advancedPrompt").value.trim(),
            advanced_chinese: settingsUI
              .querySelector("#advancedPrompt_chinese")
              .value.trim(),
            ocr: settingsUI.querySelector("#ocrPrompt").value.trim(),
            ocr_chinese: settingsUI
              .querySelector("#ocrPrompt_chinese")
              .value.trim(),
            media: settingsUI.querySelector("#mediaPrompt").value.trim(),
            media_chinese: settingsUI
              .querySelector("#mediaPrompt_chinese")
              .value.trim(),
            page: settingsUI.querySelector("#pagePrompt").value.trim(),
            page_chinese: settingsUI
              .querySelector("#pagePrompt_chinese")
              .value.trim(),
            file_content: settingsUI.querySelector("#fileContentPrompt").value.trim(),
            file_content_chinese: settingsUI
              .querySelector("#fileContentPrompt_chinese")
              .value.trim()
          }
        },
        pageTranslation: {
          enabled: settingsUI.querySelector("#pageTranslationEnabled").checked,
          autoTranslate: settingsUI.querySelector("#autoTranslatePage").checked,
          showInitialButton:
            settingsUI.querySelector("#showInitialButton").checked,
          buttonTimeout: DEFAULT_SETTINGS.pageTranslation.buttonTimeout,
          enableGoogleTranslate: settingsUI.querySelector("#enableGoogleTranslate").checked,
          googleTranslateLayout: settingsUI.querySelector("#googleTranslateLayout").value,
          useCustomSelectors,
          customSelectors,
          combineWithDefault,
          defaultSelectors: DEFAULT_SETTINGS.pageTranslation.defaultSelectors,
          excludeSelectors: useCustomSelectors
            ? combineWithDefault
              ? [
                ...new Set([
                  ...DEFAULT_SETTINGS.pageTranslation.defaultSelectors,
                  ...customSelectors
                ])
              ]
              : customSelectors
            : DEFAULT_SETTINGS.pageTranslation.defaultSelectors,
          generation: {
            temperature: parseFloat(settingsUI.querySelector("#pageTranslationTemperature").value),
            topP: parseFloat(settingsUI.querySelector("#pageTranslationTopP").value),
            topK: parseInt(settingsUI.querySelector("#pageTranslationTopK").value)
          }
        },
        ocrOptions: {
          enabled: settingsUI.querySelector("#ocrEnabled").checked,
          mangaTranslateAll: settingsUI.querySelector("#mangaTranslateAll").checked,
          preferredProvider: settingsUI.querySelector(
            'input[name="apiProvider"]:checked'
          ).value,
          maxFileSize: CONFIG.OCR.maxFileSize,
          temperature: parseFloat(
            settingsUI.querySelector("#ocrTemperature").value
          ),
          topP: parseFloat(settingsUI.querySelector("#ocrTopP").value),
          topK: parseInt(settingsUI.querySelector("#ocrTopK").value)
        },
        mediaOptions: {
          enabled: settingsUI.querySelector("#mediaEnabled").checked,
          temperature: parseFloat(
            settingsUI.querySelector("#mediaTemperature").value
          ),
          topP: parseFloat(settingsUI.querySelector("#mediaTopP").value),
          topK: parseInt(settingsUI.querySelector("#mediaTopK").value)
        },
        videoStreamingOptions: {
          enabled: settingsUI.querySelector("#videoStreamingEnabled").checked,
          fontSize: settingsUI.querySelector("#videoStreamingFontSize").value,
          backgroundColor: settingsUI.querySelector("#videoStreamingBgColor").value,
          textColor: settingsUI.querySelector("#videoStreamingTextColor").value
        },
        displayOptions: {
          fontSize: settingsUI.querySelector("#fontSize").value,
          minPopupWidth: finalMinWidth,
          maxPopupWidth: maxWidthVw,
          webImageTranslation: {
            fontSize: settingsUI.querySelector("#webImageFontSize").value
          },
          translationMode: settingsUI.querySelector("#displayMode").value,
          targetLanguage: settingsUI.querySelector("#targetLanguage").value,
          sourceLanguage: settingsUI.querySelector("#sourceLanguage").value,
          languageLearning: {
            enabled:
              settingsUI.querySelector("#displayMode").value ===
              "language_learning",
            showSource: settingsUI.querySelector("#showSource").checked
          }
        },
        ttsOptions: {
          enabled: settingsUI.querySelector("#ttsEnabled").checked,
          defaultGeminiModel: settingsUI.querySelector("#tts-gemini-model").value,
          defaultProvider: settingsUI.querySelector("#tts-provider").value,
          defaultModel: settingsUI.querySelector("#tts-openai-model").value,
          defaultSpeed: parseFloat(settingsUI.querySelector("#ttsDefaultSpeed").value),
          defaultPitch: parseFloat(settingsUI.querySelector("#ttsDefaultPitch").value),
          defaultVolume: parseFloat(settingsUI.querySelector("#ttsDefaultVolume").value)
        },
        shortcuts: {
          settingsEnabled: settingsUI.querySelector("#settingsShortcutEnabled")
            .checked,
          enabled: settingsUI.querySelector("#shortcutsEnabled").checked,
          ocrRegion: {
            key: settingsUI.querySelector("#ocrRegionKey").value,
            altKey: true
          },
          ocrWebImage: {
            key: settingsUI.querySelector("#ocrWebImageKey").value,
            altKey: true
          },
          ocrMangaWeb: {
            key: settingsUI.querySelector("#ocrMangaWebKey").value,
            altKey: true
          },
          pageTranslate: {
            key: settingsUI.querySelector("#pageTranslateKey").value,
            altKey: true
          },
          inputTranslate: {
            key: settingsUI.querySelector("#inputTranslationKey").value,
            altKey: true
          },
          quickTranslate: {
            key: settingsUI.querySelector("#quickKey").value,
            altKey: true
          },
          popupTranslate: {
            key: settingsUI.querySelector("#popupKey").value,
            altKey: true
          },
          advancedTranslate: {
            key: settingsUI.querySelector("#advancedKey").value,
            altKey: true
          }
        },
        clickOptions: {
          enabled: settingsUI.querySelector("#translationButtonEnabled")
            .checked,
          singleClick: {
            translateType: settingsUI.querySelector("#singleClickSelect").value
          },
          doubleClick: {
            translateType: settingsUI.querySelector("#doubleClickSelect").value
          },
          hold: {
            translateType: settingsUI.querySelector("#holdSelect").value
          }
        },
        touchOptions: {
          enabled: settingsUI.querySelector("#touchEnabled").checked,
          sensitivity: parseInt(
            settingsUI.querySelector("#touchSensitivity").value
          ),
          twoFingers: {
            translateType: settingsUI.querySelector("#twoFingersSelect").value
          },
          threeFingers: {
            translateType: settingsUI.querySelector("#threeFingersSelect")
              .value
          }
        },
        cacheOptions: {
          text: {
            enabled: settingsUI.querySelector("#textCacheEnabled").checked,
            maxSize: parseInt(
              settingsUI.querySelector("#textCacheMaxSize").value
            ),
            expirationTime: parseInt(
              settingsUI.querySelector("#textCacheExpiration").value
            )
          },
          image: {
            enabled: settingsUI.querySelector("#imageCacheEnabled").checked,
            maxSize: parseInt(
              settingsUI.querySelector("#imageCacheMaxSize").value
            ),
            expirationTime: parseInt(
              settingsUI.querySelector("#imageCacheExpiration").value
            )
          },
          media: {
            enabled: settingsUI.querySelector("#mediaCacheEnabled").checked,
            maxSize: parseInt(
              settingsUI.querySelector("#mediaCacheMaxSize").value
            ),
            expirationTime:
              parseInt(
                settingsUI.querySelector("#mediaCacheExpiration").value
              )
          },
          tts: {
            enabled: settingsUI.querySelector("#ttsCacheEnabled").checked,
            maxSize: parseInt(settingsUI.querySelector("#ttsCacheMaxSize").value),
            expirationTime: parseInt(settingsUI.querySelector("#ttsCacheExpiration").value)
          }
        },
        rateLimit: {
          maxRequests: parseInt(settingsUI.querySelector("#maxRequests").value),
          perMilliseconds: parseInt(
            settingsUI.querySelector("#perMilliseconds").value
          )
        }
      };
      const providerTTS = settingsUI.querySelector("#tts-provider").value;
      const getOldSettings = this.settings.ttsOptions?.defaultVoice;
      if (providerTTS === 'gemini') {
        const selectedGeminiVoice = settingsUI.querySelector(`#tts-gemini-select`).value;
        newSettings.ttsOptions.defaultVoice = {
          ...getOldSettings,
          gemini: {}
        };
        newSettings.ttsOptions.defaultVoice.gemini.voice = selectedGeminiVoice;
      } else if (providerTTS === 'openai') {
        const selectedOpenAIVoice = settingsUI.querySelector(`#tts-openai-select`).value;
        newSettings.ttsOptions.defaultVoice = {
          ...getOldSettings,
          openai: {}
        };
        newSettings.ttsOptions.defaultVoice.openai.voice = selectedOpenAIVoice;
      } else if (providerTTS === 'google') {
        newSettings.ttsOptions.defaultVoice = {
          ...getOldSettings,
          google: {},
        };
        Object.keys(CONFIG.TTS.GOOGLE.VOICES).forEach(lang => {
          const selectedVoice = settingsUI.querySelector(`#tts-google-select[data-lang="${lang}"]`).value;
          newSettings.ttsOptions.defaultVoice.google[lang] = {
            name: selectedVoice,
            display: CONFIG.TTS.GOOGLE.VOICES[lang].find(voice => voice.name === selectedVoice).display
          };
        });
      }
      const isToolsEnabled = settingsUI.querySelector("#showTranslatorTools").checked;
      safeLocalStorageSet("translatorToolsEnabled", isToolsEnabled.toString());
      const isEnabledForSite = settingsUI.querySelector("#mangaTranslateAllSiteOnly").checked;
      safeLocalStorageSet("kingtranslator_manga_all_for_site", isEnabledForSite.toString());
      this.translator.ui.removeToolsContainer();
      this.translator.ui.resetState();
      if (this.settings.translatorTools?.enabled && isToolsEnabled) {
        this.translator.ui.setupTranslatorTools();
      }
      this.currentLanguage = CONFIG.LANG_DATA[newSettings.uiLanguage];
      const mergedSettings = this.mergeWithDefaults(newSettings);
      GM_setValue("translatorSettings", JSON.stringify(mergedSettings));
      this.settings = mergedSettings;
      const event = new CustomEvent("settingsChanged", {
        detail: mergedSettings
      });
      document.dispatchEvent(event);
      return mergedSettings;
    }
    getSetting(path) {
      return path.split(".").reduce((obj, key) => obj?.[key], this.settings);
    }
  }
