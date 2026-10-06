// Auto-generated from King-Translator-AI.user.js
// APIManager class

import APIKeyManager from "./key-manager.js";

  class APIManager {
    constructor(config, getSettings, _) {
      this.config = config;
      this.getSettings = getSettings;
      this._ = _;
      this.keyManager = new APIKeyManager(getSettings(), _);
      this.currentProvider = getSettings().apiProvider;
    }
    async request(prompt, useCase = 'normal', apiKey = null) {
      const provider = this.config.providers[this.currentProvider];
      if (!provider) {
        throw new Error(`Provider ${this.currentProvider} not found`);
      }
      try {
        if (this.currentProvider === "ollama") {
          return await this.makeApiRequest(null, prompt, useCase);
        }
        const settings = this.getSettings();
        let keysToTry = [];
        if (apiKey) {
          keysToTry = [apiKey];
        } else {
          keysToTry = this.keyManager.getAvailableKeys(settings.apiProvider);
        }
        if (!keysToTry || keysToTry.length === 0) {
          throw new Error(this._("notifications.no_api_key_available"));
        }
        const errors = [];
        for (let i = 0; i < keysToTry.length; i++) {
          const currentKey = keysToTry[i];
          try {
            const result = await this.keyManager.useKey(currentKey, () => this.makeApiRequest(currentKey, prompt, useCase));
            if (result) {
              this.keyManager.updateKeyStats(currentKey, true);
              return result;
            }
          } catch (error) {
            this.keyManager.updateKeyStats(currentKey, false);
            const keyPrefix = currentKey.slice(0, 8);
            if (error.status === 401 || error.status === 403) {
              this.keyManager.markKeyAsFailed(currentKey);
              errors.push(`API Key ${keyPrefix}... invalid`);
            }
            else if (error.status === 429) {
              this.keyManager.markKeyAsRateLimited(currentKey);
              errors.push(`API Key ${keyPrefix}... is rate-limited`);
            }
            else {
              errors.push(`API Key ${keyPrefix}... : ${error.message}`);
            }
            if (apiKey || i === keysToTry.length - 1 || error.status === 401 || error.status === 403) {
              throw new Error(this._("notifications.all_keys_failed") + ` ${errors.join('\n')}`);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        }
        throw new Error(this._("notifications.unknown_api_error"));
      } catch (error) {
        console.error("Request failed:", error);
        throw error;
      }
    }
    async makeApiRequest(key, content, useCase = 'normal') {
      const apiConfig = this.getAPIConfig(key, content, useCase);
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: "POST",
          url: apiConfig.url,
          headers: apiConfig.headers,
          data: JSON.stringify(apiConfig.body),
          responseType: "json",
          onload: (response) => {
            if (response.status >= 200 && response.status < 300) {
              try {
                const result = apiConfig.responseParser(response.response);
                resolve(result);
              } catch (error) {
                reject({
                  status: response.status,
                  message: this._("notifications.api_response_parse_error")
                });
              }
            } else {
              reject({
                status: response.status,
                message: response.response?.error?.message || this._("notifications.unknown_api_error")
              });
            }
          },
          onerror: () => {
            reject({
              status: 0,
              message: this._("notifications.network_error")
            });
          }
        });
      });
    }
    getAPIConfig(key, content, useCase = 'normal') {
      const settings = this.getSettings();
      const provider = settings.apiProvider;
      const config = this.config.providers[provider];
      const generation = this.getGenerationConfig(useCase);
      switch (provider) {
        case 'gemini':
          const geminiModel = this.getGeminiModel();
          return {
            url: `${config.baseUrl}/${geminiModel}:generateContent?key=${key}`,
            headers: config.headers,
            body: config.createRequestBody(content, generation),
            responseParser: config.responseParser
          };
        case 'perplexity':
        case 'claude':
        case 'openai':
        case 'mistral':
        case 'deepseek':
          const model = this.getModel();
          let body = config.createRequestBody(
            content,
            model,
            generation.temperature,
            generation.topP
          );
          if (provider === 'perplexity' || provider === 'claude' || provider === 'mistral') {
            if (generation.topK !== undefined) {
              body.top_k = generation.topK;
            }
          }
          return {
            url: config.baseUrl,
            headers: config.headers(key),
            body: body,
            responseParser: config.responseParser
          };
        case 'ollama':
          const ollamaModel = this.getModel();
          const ollamaEndpoint = settings.ollamaOptions.endpoint;
          const { temperature, topP, topK } = settings.ollamaOptions;
          return {
            url: `${ollamaEndpoint}/api/generate`,
            headers: config.headers,
            body: config.createRequestBody(
              content,
              ollamaModel,
              temperature,
              topP,
              topK
            ),
            responseParser: config.responseParser
          };
        default:
          throw new Error(this._("notifications.unsupported_provider") + ` ${provider}`);
      }
    }
    getGenerationConfig(useCase) {
      const settings = this.getSettings();
      switch (useCase) {
        case 'ocr':
          return {
            temperature: settings.ocrOptions.temperature,
            topP: settings.ocrOptions.topP,
            topK: settings.ocrOptions.topK
          };
        case 'media':
          return {
            temperature: settings.mediaOptions.temperature,
            topP: settings.mediaOptions.topP,
            topK: settings.mediaOptions.topK
          };
        case 'page':
          return {
            temperature: settings.pageTranslation.generation.temperature,
            topP: settings.pageTranslation.generation.topP,
            topK: settings.pageTranslation.generation.topK
          };
        default:
          return {
            temperature: settings.pageTranslation.generation.temperature,
            topP: settings.pageTranslation.generation.topP,
            topK: settings.pageTranslation.generation.topK
          };
      }
    }
    getModel() {
      const settings = this.getSettings();
      const provider = settings.apiProvider;
      if (provider === 'gemini') {
        return this.getGeminiModel();
      } else if (provider === 'mistral') {
        return this.getMistralModel();
      } else if (provider === 'deepseek') {
        return this.getDeepseekModel();
      } else if (provider === 'ollama') {
        return settings.ollamaOptions.model || 'llama3';
      }
      const Options = settings[`${provider}Options`];
      const config = this.config.providers[provider];
      switch (Options.modelType) {
        case "fast":
          return Options.fastModel;
        case "balance":
          return Options.balanceModel;
        case "pro":
          return Options.proModel;
        case "custom":
          return Options.customModel || config.models.fast[0];
        default:
          return config.models.fast[0];
      }
    }
    getGeminiModel() {
      const settings = this.getSettings();
      const geminiOptions = settings.geminiOptions;
      switch (geminiOptions.modelType) {
        case 'fast':
          return geminiOptions.fastModel;
        case 'pro':
          return geminiOptions.proModel;
        case 'think':
          return geminiOptions.thinkModel;
        case 'custom':
          return geminiOptions.customModel || "gemini-2.0-flash-lite";
        default:
          return "gemini-2.0-flash-lite";
      }
    }
    getMistralModel() {
      const settings = this.getSettings();
      const mistralOptions = settings.mistralOptions;
      switch (mistralOptions.modelType) {
        case 'free':
          return mistralOptions.freeModel;
        case 'research':
          return mistralOptions.researchModel;
        case 'premier':
          return mistralOptions.premierModel;
        case 'custom':
          return mistralOptions.customModel || "mistral-small-latest";
        default:
          return "mistral-small-latest";
      }
    }
    getDeepseekModel() {
      const settings = this.getSettings();
      const deepseekOptions = settings.deepseekOptions;
      switch (deepseekOptions.modelType) {
        case 'fast':
          return deepseekOptions.fastModel;
        case 'custom':
          return deepseekOptions.customModel || "deepseek-chat";
        default:
          return "deepseek-chat";
      }
    }
  }


export default APIManager;
