  class PageTranslator {
    constructor(translator) {
      this.translator = translator;
      this.settings = this.translator.userSettings.settings;
      this._ = this.translator.userSettings._;
      this.MIN_TEXT_LENGTH = 100;
      this.originalTexts = new Map();
      this.isTranslated = false;
      this.languageCode = this.detectLanguage().languageCode;
      this.pageCache = new Map();
      this.pdfLoaded = true;
      this.pageObserver = null;
      this.sentinelContainer = null;
      this.allTextNodes = [];
    }
    parseFaultyJSON(jsonString) {
      let cleanString = jsonString.trim();
      const markdownMatch = cleanString.match(/```json\s*([\s\S]*?)\s*```/);
      if (markdownMatch && markdownMatch[1]) {
        cleanString = markdownMatch[1].trim();
      }
      try {
        const parsed = JSON.parse(cleanString);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        console.warn("Could not parse the whole JSON string, attempting to parse line by line.", e.message);
      }
      const objects = [];
      const lines = cleanString.split('\n');
      let currentObjectStr = '';
      lines.forEach(line => {
        currentObjectStr += line;
        try {
          if (line.trim().endsWith('},') || line.trim().endsWith('}')) {
            const objectToParse = currentObjectStr.trim().endsWith(',')
              ? currentObjectStr.trim().slice(0, -1)
              : currentObjectStr.trim();
            const parsed = JSON.parse(objectToParse);
            if (typeof parsed.id === 'number' && (parsed.translation || parsed.vi)) {
              objects.push(parsed);
            }
            currentObjectStr = '';
          }
        } catch (e) {
        }
      });
      return objects;
    }
    async translatePage() {
      try {
        if (this.isTranslated) {
          if (this.pageObserver) this.pageObserver.disconnect();
          if (this.sentinelContainer) this.sentinelContainer.remove();
          if (this.domObserver) this.domObserver.disconnect();
          this.pageObserver = this.sentinelContainer = this.domObserver = null;
          await Promise.all(
            Array.from(this.originalTexts.entries()).map(async ([node, originalText]) => {
              if (node && (node.parentNode || document.contains(node))) {
                node.textContent = originalText;
              }
            })
          );
          this.originalTexts.clear();
          this.allTextNodes = [];
          this.isTranslated = false;
          return {
            success: true,
            message: this._("notifications.page_reverted_to_original")
          };
        }
        if (this.pageObserver) this.pageObserver.disconnect();
        this.allTextNodes = this.collectTextNodes();
        if (this.allTextNodes.length === 0) {
          return {
            success: false,
            message: this._("notifications.no_content_to_translate")
          };
        }
        this.translator.ui.showNotification(this._("notifications.page_translate_loading"), "info");
        const pageHeight = document.documentElement.scrollHeight;
        const NUM_SECTIONS = Math.max(10, Math.min(50, Math.floor(pageHeight / 800)));
        const sectionHeight = pageHeight / NUM_SECTIONS;
        if (this.sentinelContainer) this.sentinelContainer.remove();
        this.sentinelContainer = document.createElement('div');
        this.sentinelContainer.style.cssText = 'position: absolute; top: 0; left: 0; width: 1px; height: 100%; pointer-events: none; z-index: -1;';
        document.body.appendChild(this.sentinelContainer);
        const sentinels = [];
        for (let i = 0; i < NUM_SECTIONS; i++) {
          const sentinel = document.createElement('div');
          sentinel.style.cssText = `position: absolute; top: ${i * sectionHeight}px; height: 1px; width: 1px;`;
          sentinel.dataset.sectionIndex = i;
          this.sentinelContainer.appendChild(sentinel);
          sentinels.push(sentinel);
        }
        let translatedSections = new Set();
        const translateRemainingNodes = async () => {
          if (this.pageObserver) {
            this.pageObserver.disconnect();
            this.pageObserver = null;
          }
          const remainingNodes = this.allTextNodes.filter(node => !this.originalTexts.has(node));
          if (remainingNodes.length > 0) {
            console.log(`[Final Sweep] Found ${remainingNodes.length} remaining text nodes to translate.`);
            const chunks = this.createChunks(remainingNodes, 2000);
            await Promise.all(chunks.map(chunk => this.translateChunkWithRetries(chunk)))
              .catch(err => console.error("Error during final sweep translation:", err));
          }
          this.translator.ui.showNotification(this._("notifications.page_translated_success"), "success");
          if (!this.domObserver) {
            this.setupDOMObserver();
          }
        };
        this.pageObserver = new IntersectionObserver(
          (entries) => {
            let needsFinalSweep = false;
            for (const entry of entries) {
              if (entry.isIntersecting) {
                const sentinel = entry.target;
                const sectionIndex = parseInt(sentinel.dataset.sectionIndex, 10);
                if (translatedSections.has(sectionIndex)) continue;
                this.pageObserver.unobserve(sentinel);
                translatedSections.add(sectionIndex);
                const startY = sectionIndex * sectionHeight;
                const isLastSection = sectionIndex === NUM_SECTIONS - 1;
                const endY = isLastSection ? Infinity : startY + sectionHeight;
                const nodesForThisSection = this.allTextNodes.filter(node => {
                  if (!node.parentElement || this.originalTexts.has(node)) return false;
                  const rect = node.parentElement.getBoundingClientRect();
                  const nodeY = rect.top + window.scrollY;
                  return nodeY >= startY && nodeY < endY;
                });
                if (nodesForThisSection.length > 0) {
                  const chunks = this.createChunks(nodesForThisSection, 2000);
                  Promise.all(chunks.map(chunk => this.translateChunkWithRetries(chunk)))
                    .catch(err => console.error("Error translating chunk in observer:", err));
                }
              }
              if (translatedSections.size >= NUM_SECTIONS) {
                needsFinalSweep = true;
              }
            }
            if (needsFinalSweep) {
              translateRemainingNodes();
            }
          }, {
          rootMargin: "120% 0px",
          threshold: 0.01,
        });
        sentinels.forEach(s => this.pageObserver.observe(s));
        this.isTranslated = true;
        return { success: true, message: this._("notifications.translating") };
      } catch (error) {
        console.error("Page translation error:", error);
        this.isTranslated = false;
        return { success: false, message: error.message };
      }
    }
    getExcludeSelectors() {
      const settings = this.settings.pageTranslation;
      if (!settings.useCustomSelectors) {
        return settings.defaultSelectors;
      }
      return settings.combineWithDefault
        ? [
          ...new Set([
            ...settings.defaultSelectors,
            ...settings.customSelectors
          ])
        ]
        : settings.customSelectors;
    }
    async makeTranslationRequest(text) {
      const settings = this.settings;
      const apiKeys = settings.apiKey[settings.apiProvider];
      const key = apiKeys[Math.floor(Math.random() * apiKeys.length)];;
      const prompt =
        "Detect language of this text and return only ISO code (e.g. 'en', 'vi'): \n" +
        text;
      return await this.translator.api.makeApiRequest(key, prompt, 'page');
    }
    async detectLanguageBackup(text) {
      try {
        const response = await this.makeTranslationRequest(text);
        return response.trim().toLowerCase();
      } catch (error) {
        console.error("Backup language detection failed:", error);
        return 'auto';
      }
    }
    async detectLanguage() {
      let text = "";
      try {
        if (document.body.innerText) {
          text = document.body.innerText;
        }
        if (!text) {
          const paragraphs = document.querySelectorAll("p");
          paragraphs.forEach((p) => {
            text += p.textContent + " ";
          });
        }
        if (!text) {
          const headings = document.querySelectorAll("h1, h2, h3");
          headings.forEach((h) => {
            text += h.textContent + " ";
          });
        }
        if (!text) {
          text = document.title;
        }
        text = text.slice(0, 1000).trim();
        if (!text.trim()) {
          throw new Error(this._("notifications.no_content_for_lang_detect"));
        }
        const data = await new Promise((resolve, reject) => {
          GM_xmlhttpRequest({
            method: "GET",
            url: `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(text)}`,
            headers: {
              "Accept": "application/json"
            },
            onload: function(response) {
              try {
                const data = JSON.parse(response.responseText);
                resolve(data);
              } catch (error) {
                reject(new Error("Failed to parse response: " + error.message));
              }
            },
            onerror: function(error) {
              reject(new Error("Request failed: " + error.error));
            }
          });
        });
        const detectedCode = data[2] || data[8][0] || data[8][3];
        const confidence = data[6] || data[8][2] || 0;
        if (!detectedCode || confidence < 0.5) {
          return await this.detectLanguageBackup(text);
        }
        this.languageCode = detectedCode;
        console.log(`${this._("notifications.lang_detect")}: ${this.languageCode} (${this._("notifications.reliability")}: ${Math.round(confidence * 100)}%)`);
        const targetLanguage = this.settings.displayOptions.targetLanguage;
        if (this.languageCode === targetLanguage) {
          return {
            isTargetLanguage: true,
            languageCode: this.languageCode,
            confidence: confidence,
            message: `${this._("notifications.page_already_target_lang")}: ${targetLanguage} (${this._("notifications.reliability")}: ${Math.round(confidence * 100)}%)`
          };
        }
        return {
          isTargetLanguage: false,
          languageCode: this.languageCode,
          confidence: confidence,
          message: `${this._("notifications.lang_detect")}: ${this.languageCode} (${this._("notifications.reliability")}: ${Math.round(confidence * 100)}%)`
        };
      } catch (error) {
        console.error("Language detection error:", error);
        return await this.detectLanguageBackup(text);
      }
    }
    async checkAndTranslate() {
      try {
        const settings = this.settings;
        if (!settings.pageTranslation.autoTranslate) {
          return {
            success: false,
            message: this._("notifications.auto_translate_disabled")
          };
        }
        const languageCheck = await this.detectLanguage();
        if (languageCheck.isVietnamese) {
          return {
            success: false,
            message: languageCheck.message
          };
        }
        const result = await this.translatePage();
        if (result.success) {
          const toolsContainer = this.translator.ui.$(
            ".translator-tools-container"
          );
          if (toolsContainer) {
            const menuItem = toolsContainer.querySelector(
              '[data-type="pageTranslate"]'
            );
            if (menuItem) {
              const itemText = menuItem.querySelector(".item-text");
              if (itemText) {
                itemText.textContent = this.isTranslated
                  ? this._("notifications.original_label") : this._("notifications.page_translate_menu_label");
              }
            }
          }
          const floatingButton = this.translator.ui.$(
            ".page-translate-button"
          );
          if (floatingButton) {
            floatingButton.textContent = this.isTranslated
              ? `📄 ${this._("notifications.original_label")}` : `📄 ${this._("notifications.page_translate_menu_label")}`;
          }
          // this.translator.ui.showNotification(result.message, "success");
        } else {
          this.translator.ui.showNotification(result.message, "warning");
        }
        return result;
      } catch (error) {
        console.error("Translation check error:", error);
        return {
          success: false,
          message: error.message
        };
      }
    }
    async updateNode(node, translation) {
      if (!node || !node.parentNode || !document.contains(node)) {
        return false;
      }
      try {
        node.textContent = translation;
        return true;
      } catch (error) {
        console.error("Node update failed:", error);
        return false;
      }
    }
    createChunks(nodes, maxChunkSize = 2000) {
      const chunks = [];
      let currentChunk = [];
      let currentLength = 0;
      const isSentenceEnd = text => /[.!?。！？]$/.test(text.trim());
      const isPunctuationBreak = text => /[,;，；、]$/.test(text.trim());
      const isParagraphBreak = node => {
        const parentTag = node.parentElement?.tagName?.toLowerCase();
        return ['p', 'div', 'h1', 'h2', 'h3', 'li'].includes(parentTag);
      };
      for (const node of nodes) {
        const text = node.textContent.trim();
        if ((currentLength + text.length > maxChunkSize) && currentChunk.length > 0) {
          let splitIndex = currentChunk.length - 1;
          while (splitIndex > 0) {
            if (isParagraphBreak(currentChunk[splitIndex])) break;
            splitIndex--;
          }
          if (splitIndex === 0) {
            splitIndex = currentChunk.length - 1;
            while (splitIndex > 0) {
              if (isSentenceEnd(currentChunk[splitIndex].textContent)) break;
              splitIndex--;
            }
          }
          if (splitIndex === 0) {
            splitIndex = currentChunk.length - 1;
            while (splitIndex > 0) {
              if (isPunctuationBreak(currentChunk[splitIndex].textContent)) break;
              splitIndex--;
            }
          }
          const newChunk = currentChunk.splice(++splitIndex);
          chunks.push(currentChunk);
          currentChunk = newChunk;
          currentLength = currentChunk.reduce((len, n) => len + n.textContent.trim().length, 0);
        }
        currentChunk.push(node);
        currentLength += text.length;
        const isLastNode = nodes.indexOf(node) === nodes.length - 1;
        const isEndOfParagraph = isParagraphBreak(node);
        if ((isLastNode || isEndOfParagraph) && currentChunk.length > 0) {
          chunks.push(currentChunk);
          currentChunk = [];
          currentLength = 0;
        }
      }
      if (currentChunk.length > 0) {
        chunks.push(currentChunk);
      }
      const finalChunks = [];
      let previousChunk = null;
      for (const chunk of chunks) {
        const chunkLength = chunk.reduce((len, node) => len + node.textContent.trim().length, 0);
        if (chunkLength < maxChunkSize * 0.3 && previousChunk) {
          const combinedLength = previousChunk.reduce((len, node) => len + node.textContent.trim().length, 0) + chunkLength;
          if (combinedLength <= maxChunkSize) {
            previousChunk.push(...chunk);
            continue;
          }
        }
        finalChunks.push(chunk);
        previousChunk = chunk;
      }
      return finalChunks;
    }
    async translateChunkWithRetries(chunk, maxRetries = 5, initialDelay = 1500) {
      const nodesToTranslate = chunk.filter(node => node.textContent.trim().length > 0);
      if (nodesToTranslate.length === 0) {
        return { success: true, nodes: chunk };
      }
      const settings = this.translator.userSettings.settings;
      const isPinyinMode = settings.displayOptions.translationMode !== "translation_only";
      const textsToTranslate = nodesToTranslate.map((node, index) => {
        if (!this.originalTexts.has(node)) {
          this.originalTexts.set(node, node.textContent);
        }
        return {
          id: index,
          text: this.originalTexts.get(node).trim()
        };
      });
      const jsonPayload = JSON.stringify(textsToTranslate, null, 2);
      if (isPinyinMode) {
        const batchPrompt = this.translator.createPrompt(jsonPayload, "page", "", true);
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const rawResponse = await this.translator.api.request(batchPrompt, 'page');
            const translatedData = this.parseFaultyJSON(rawResponse);
            if (Array.isArray(translatedData)) {
              const translationsMap = new Map(translatedData.map(item => [item.id, item]));
              const missingItems = [];
              nodesToTranslate.forEach((node, index) => {
                if (translationsMap.has(index)) {
                  const result = translationsMap.get(index);
                  const formattedText = `${result.original || textsToTranslate[index].text} <|> ${result.ipa} <|> ${result.translation}`;
                  const output = this.translator.page.formatTranslation(result.original, formattedText, settings.displayOptions.translationMode, settings.displayOptions);
                  if (node.parentNode && document.contains(node)) {
                    this.updateNode(node, output);
                  }
                } else {
                  missingItems.push({ node, index });
                }
              });
              if (missingItems.length > 0) {
                console.warn(`[Pinyin Mode] Batch translation missed ${missingItems.length} items. Initiating fallback...`);
                const fallbackPromises = missingItems.map(async (item) => {
                  try {
                    const originalText = this.originalTexts.get(item.node).trim();
                    const fallbackPrompt = this.translator.createPrompt(originalText, "page_fallback", "", true);
                    const individualResult = await this.translator.api.request(fallbackPrompt, 'page');
                    if (individualResult && item.node.parentNode && document.contains(item.node)) {
                      const output = this.translator.page.formatTranslation(originalText, individualResult, settings.displayOptions.translationMode, settings.displayOptions);
                      await this.updateNode(item.node, output);
                    }
                  } catch (fallbackError) {
                    console.error(`[Pinyin Mode] Fallback failed for item id ${item.index}:`, fallbackError);
                  }
                });
                await Promise.allSettled(fallbackPromises);
              }
              return { success: true, nodes: chunk };
            }
            throw new Error("[Pinyin Mode] API response was not a valid JSON array.");
          } catch (error) {
            console.warn(`[Pinyin Mode] Attempt ${attempt}/${maxRetries} failed:`, error.message);
            if (attempt === maxRetries) {
              return { success: false, nodes: chunk, error };
            }
            await new Promise(resolve => setTimeout(resolve, initialDelay * Math.pow(2, attempt - 1)));
          }
        }
      } else {
        const batchPrompt = this.translator.createPrompt(jsonPayload, "page");
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const rawResponse = await this.translator.api.request(batchPrompt, 'page');
            const translatedData = this.parseFaultyJSON(rawResponse);
            if (Array.isArray(translatedData)) {
              const translationsMap = new Map(translatedData.map(item => [item.id, item.translation]));
              const missingItems = [];
              nodesToTranslate.forEach((node, index) => {
                if (translationsMap.has(index)) {
                  const translated = translationsMap.get(index);
                  const output = this.translator.page.formatTranslation(this.originalTexts.get(node), translated, settings.displayOptions.translationMode, settings.displayOptions);
                  if (node.parentNode && document.contains(node)) {
                    this.updateNode(node, output);
                  }
                } else {
                  missingItems.push({ node, index });
                }
              });
              if (missingItems.length > 0) {
                console.warn(`[Normal Mode] Batch translation missed ${missingItems.length} items. Initiating fallback...`);
                const fallbackPromises = missingItems.map(async (item) => {
                  try {
                    const originalText = this.originalTexts.get(item.node).trim();
                    const fallbackPrompt = this.translator.createPrompt(originalText, "page_fallback");
                    const individualResult = await this.translator.api.request(fallbackPrompt, 'page');
                    if (individualResult && item.node.parentNode && document.contains(item.node)) {
                      const output = this.translator.page.formatTranslation(originalText, individualResult, settings.displayOptions.translationMode, settings.displayOptions);
                      await this.updateNode(item.node, output);
                    }
                  } catch (fallbackError) {
                    console.error(`[Normal Mode] Fallback failed for item id ${item.index}:`, fallbackError);
                  }
                });
                await Promise.allSettled(fallbackPromises);
              }
              return { success: true, nodes: chunk };
            }
            throw new Error("[Normal Mode] API response was not a valid JSON array.");
          } catch (error) {
            console.warn(`[Normal Mode] Attempt ${attempt}/${maxRetries} failed:`, error.message);
            if (attempt === maxRetries) {
              return { success: false, nodes: chunk, error };
            }
            await new Promise(resolve => setTimeout(resolve, initialDelay * Math.pow(2, attempt - 1)));
          }
        }
      }
    }
    async translateHTML(htmlContent) {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(htmlContent, "text/html");
        const scripts = doc.getElementsByTagName("script");
        const styles = doc.getElementsByTagName("style");
        [...scripts, ...styles].forEach(element => element.remove());
        const translatableNodes = this.getTranslatableHTMLNodes(doc.body);
        const chunks = this.createChunks(translatableNodes, 2000);
        this.translator.ui.showTranslatingStatus();
        await Promise.all(
          chunks.map(async (chunk, index) => {
            try {
              const textsToTranslate = await Promise.all(
                chunk.map(node => node.textContent.trim())
              );
              const validTexts = textsToTranslate.filter(text => text.length > 0);
              if (validTexts.length === 0) return;
              const textToTranslate = validTexts.join(" <> ");
              const prompt = this.translator.createPrompt(textToTranslate, "page");
              console.log('prompt: ', prompt);
              const translatedText = await this.translator.api.request(prompt, 'page');
              if (!translatedText) return;
              const translations = translatedText.split(" <> ");
              await Promise.all(
                chunk.map(async (node, index) => {
                  if (index >= translations.length) return;
                  const text = node.textContent.trim();
                  if (text.length > 0 && node.parentNode) {
                    try {
                      if (node.isAttribute) {
                        node.ownerElement.setAttribute(
                          node.attributeName,
                          translations[index]
                        );
                      } else {
                        node.textContent = translations[index];
                      }
                    } catch (error) {
                      console.error("DOM update error:", error);
                    }
                  }
                })
              );
              this.translator.ui.updateProcessingStatus(
                this._("notifications.translating_part") + `${index + 1}/${chunks.length}`,
                Math.round(((index + 1) / chunks.length) * 100)
              );
            } catch (error) {
              console.error("Chunk translation error:", error);
            }
          })
        );
        return doc.documentElement.outerHTML;
      } catch (error) {
        console.error("HTML translation error:", error);
        throw error;
      } finally {
        this.translator.ui.removeTranslatingStatus();
      }
    }
    getTranslatableHTMLNodes(element) {
      const translatableNodes = [];
      const excludeSelectors = this.getExcludeSelectors();
      const walker = document.createTreeWalker(
        element,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            if (excludeSelectors.some((selector) => parent.matches?.(selector))) {
              return NodeFilter.FILTER_REJECT;
            }
            return node.textContent.trim()
              ? NodeFilter.FILTER_ACCEPT
              : NodeFilter.FILTER_REJECT;
          }
        }
      );
      let node;
      while ((node = walker.nextNode())) {
        translatableNodes.push(node);
      }
      const elements = element.getElementsByTagName("*");
      const translatableAttributes = ["title", "alt", "placeholder"];
      for (const el of elements) {
        for (const attr of translatableAttributes) {
          if (el.hasAttribute(attr)) {
            const value = el.getAttribute(attr);
            if (value && value.trim()) {
              const node = document.createTextNode(value);
              node.isAttribute = true;
              node.attributeName = attr;
              node.ownerElement = el;
              translatableNodes.push(node);
            }
          }
        }
      }
      return translatableNodes;
    }
    async loadPDFJS() {
      if (!this.pdfLoaded) {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        this.pdfLoaded = true;
      }
    }
    async translatePDF(file) {
      try {
        await this.loadPDFJS();
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let translatedContent = [];
        const totalPages = pdf.numPages;
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        const { translationMode: mode } = this.settings.displayOptions;
        const showSource = mode === "language_learning" &&
          this.settings.displayOptions.languageLearning.showSource;
        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          const viewport = page.getViewport({ scale: 2.0 });
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          await page.render({
            canvasContext: ctx,
            viewport: viewport
          }).promise;
          const imageBlob = await new Promise((resolve) =>
            canvas.toBlob(resolve, "image/png")
          );
          const imageFile = new File([imageBlob], "page.png", {
            type: "image/png"
          });
          try {
            const ocrResult = await this.translator.ocr.processImage(imageFile);
            if (!ocrResult) {
              throw new Error(`Failed to process page ${pageNum}`);
            }
            let processedTranslations;
            const settings = this.settings;
            if (settings.displayOptions.translationMode === "translation_only") {
              processedTranslations = [this.formatTranslationPDF(ocrResult, mode, showSource)];
            } else {
              processedTranslations = ocrResult.toString().split('\n').map(trans =>
                this.formatTranslationPDF(trans, mode, showSource)
              );
            }
            translatedContent.push({
              pageNum,
              original: ocrResult,
              translations: processedTranslations,
              displayMode: mode,
              showSource
            });
          } catch (error) {
            console.error(`Error processing page ${pageNum}:`, error);
            translatedContent.push({
              pageNum,
              original: `[Error on page ${pageNum}: ${error.message}]`,
              translations: [{
                original: "",
                translation: `[Translation Error: ${error.message}]`
              }],
              displayMode: mode,
              showSource
            });
          }
          this.translator.ui.updateProgress(this._("notifications.processing_pdf"), Math.round((pageNum / totalPages) * 100));
          ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
        canvas.remove();
        return this.generateEnhancedTranslatedPDF(translatedContent);
      } catch (error) {
        console.error("PDF translation error:", error);
        throw error;
      }
    }
    formatTranslationPDF(text, mode, showSource) {
      if (!text) return '';
      switch (mode) {
        case "translation_only":
          return text.split("<|>")[0] || text;
        case "parallel":
          return `${this._("notifications.original")}: ${text.split("<|>")[0] || ''}  ${this._("notifications.translation")}: ${text.split("<|>")[2] || text}`;
        case "language_learning":
          let parts = [];
          if (showSource) {
            parts.push(`${this._("notifications.original")}: ${text.split("<|>")[0] || ''}`);
          }
          const pinyin = text.split("<|>")[1];
          if (pinyin) {
            parts.push(`${this._("notifications.ipa")}: ${pinyin}`);
          }
          const translation = text.split("<|>")[2] || text;
          parts.push(`${this._("notifications.translation")}: ${translation}`);
          return parts.join("  ");
        default:
          return text;
      }
    }
    generateEnhancedTranslatedPDF(translatedContent) {
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: "GoMono Nerd Font", "Noto Sans", Arial;
      line-height: 1.6;
      max-width: 900px;
      margin: 0 auto;
      padding: 20px;
    }
    .page {
      margin-bottom: 40px;
      padding: 20px;
      border: 1px solid #ddd;
      border-radius: 8px;
      page-break-after: always;
    }
    .page-number {
      font-size: 18px;
      font-weight: bold;
      margin-bottom: 20px;
      color: #666;
    }
    .content {
      margin-bottom: 20px;
    }
    .section {
      margin-bottom: 15px;
      padding: 15px;
      background-color: #fff;
      border: 1px solid #eee;
      border-radius: 8px;
      white-space: pre-wrap;
    }
    .section-title {
      font-weight: bold;
      color: #333;
      margin-bottom: 10px;
    }
    .section-content {
      white-space: pre-wrap;
      line-height: 1.5;
    }
    h3 {
      color: #333;
      margin: 10px 0;
    }
    @media print {
      .page {
        page-break-after: always;
      }
    }
  </style>
</head>
<body>
  ${translatedContent.map(page => `
    <div class="page">
      <div class="page-number">${page.pageNum}</div>
      <div class="content">
        ${page.displayMode === "translation_only" ? `
          <div class="section">
            <div class="section-title">${this._("notifications.original_label")}:</div>
            <div class="section-content">${this.formatTranslationContent(page.translations.join('\n'))}</div>
          </div>
        ` : page.displayMode === "parallel" ? `
          <div class="section">
            <div class="section-content">${this.formatTranslationContent(page.translations.join('\n'))}</div>
          </div>
        ` : `
          ${page.showSource ? `
            <div class="section">
              <div class="section-title">${this._("notifications.original_label")}:</div>
              <div class="section-content">${this.formatTranslationContent(page.original)}</div>
            </div>
          ` : ''}
          ${page.translations.some(t => t.includes(`${this._("notifications.ipa")}:`)) ? `
            <div class="section">
              <div class="section-title">${this._("notifications.ipa")}:</div>
              <div class="section-content">${this.formatTranslationContent(
        page.translations
          .map(t => t.split(`${this._("notifications.ipa")}:`)[1]?.split(`${this._("notifications.translation_label")}:`)[0])
          .filter(Boolean)
          .join('\n')
      )}</div>
            </div>
          ` : ''}
          <div class="section">
            <div class="section-title">${this._("notifications.translation_label")}:</div>
            <div class="section-content">${this.formatTranslationContent(
        page.translations
          .map(t => t.split(`${this._("notifications.translation_label")}:`)[1])
          .filter(Boolean)
          .join('\n')
      )}</div>
          </div>
        `}
      </div>
    </div>
  `).join('')}
</body>
</html>
`;
      return new Blob([htmlContent], { type: "text/html" });
    }
    formatTranslationContent(content) {
      if (!content) return '';
      return content
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\n/g, '<br>');
    }
    collectTextNodes() {
      const excludeSelectors = this.getExcludeSelectors();
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            if (!node.textContent.trim()) {
              return NodeFilter.FILTER_REJECT;
            }
            if (!node.parentNode) {
              return NodeFilter.FILTER_REJECT;
            }
            let parent = node.parentElement;
            while (parent) {
              for (const selector of excludeSelectors) {
                try {
                  if (parent.matches && parent.matches(selector)) {
                    return NodeFilter.FILTER_REJECT;
                  }
                } catch (e) {
                  console.warn(`Invalid selector: ${selector}`, e);
                }
              }
              if (
                parent.getAttribute("translate") === "no" ||
                parent.getAttribute("class")?.includes("notranslate") ||
                parent.getAttribute("class")?.includes("no-translate")
              ) {
                return NodeFilter.FILTER_REJECT;
              }
              parent = parent.parentElement;
            }
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );
      const nodes = [];
      let node;
      while ((node = walker.nextNode())) {
        nodes.push(node);
      }
      return nodes;
    }
    setupDOMObserver() {
      if (this.domObserver) {
        this.domObserver.disconnect();
        this.domObserver = null;
      }
      this.domObserver = new MutationObserver((mutations) => {
        const newTextNodes = [];
        for (const mutation of mutations) {
          if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
            const nodes = this.getTextNodesFromNodeList(mutation.addedNodes);
            if (nodes.length > 0) {
              newTextNodes.push(...nodes);
            }
          }
        }
        if (newTextNodes.length > 0) {
          const chunks = this.createChunks(newTextNodes);
          Promise.all(
            chunks.map((chunk) =>
              this.translateChunkParallel(chunk).catch((error) => {
                console.error("Translation error for chunk:", error);
              })
            )
          );
        }
      });
      this.domObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
    }
    getTextNodesFromNodeList(nodeList) {
      const excludeSelectors = this.getExcludeSelectors();
      const textNodes = [];
      const shouldExclude = (node) => {
        if (!node) return true;
        let current = node;
        while (current) {
          if (
            current.getAttribute &&
            (current.getAttribute("translate") === "no" ||
              current.getAttribute("data-notranslate") ||
              current.classList?.contains("notranslate") ||
              current.classList?.contains("no-translate"))
          ) {
            return true;
          }
          for (const selector of excludeSelectors) {
            try {
              if (current.matches && current.matches(selector)) {
                return true;
              }
            } catch (e) {
              console.warn(`Invalid selector: ${selector}`, e);
            }
          }
          current = current.parentElement;
        }
        return false;
      };
      nodeList.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          if (node.textContent.trim() && !shouldExclude(node.parentElement)) {
            textNodes.push(node);
          }
        } else if (
          node.nodeType === Node.ELEMENT_NODE &&
          !shouldExclude(node)
        ) {
          const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT, {
            acceptNode: (textNode) => {
              if (
                textNode.textContent.trim() &&
                !shouldExclude(textNode.parentElement)
              ) {
                return NodeFilter.FILTER_ACCEPT;
              }
              return NodeFilter.FILTER_REJECT;
            }
          });
          let textNode;
          while ((textNode = walker.nextNode())) {
            textNodes.push(textNode);
          }
        }
      });
      return textNodes;
    }
    async translateChunkParallel(chunk) {
      try {
        const textsToTranslate = chunk
          .map((node) => node.textContent.trim())
          .filter((text) => text.length > 0)
          .join(" <-> ");
        if (!textsToTranslate) return;
        const prompt = this.translator.createPrompt(textsToTranslate, "page");
        console.log('prompt: ', prompt);
        const translatedText = await this.translator.api.request(prompt, 'page');
        if (translatedText) {
          const translations = translatedText.split("<->");
          await Promise.all(chunk.map(async (node, index) => {
            const text = node.textContent.trim();
            if (text.length > 0 && node.parentNode && document.contains(node)) {
              try {
                this.originalTexts.set(node, node.textContent);
                if (index < translations.length) {
                  const translated = translations[index];
                  const mode = this.settings.displayOptions.translationMode;
                  let output = this.formatTranslation(text, translated, mode, this.settings.displayOptions);
                  node.textContent = output;
                }
              } catch (error) {
                console.error("DOM update error:", error);
              }
            }
          }));
        }
      } catch (error) {
        console.error("Chunk translation error:", error);
        throw error;
      }
    }
    formatTranslation(originalText, translatedText, mode, settings) {
      const showSource = settings.languageLearning.showSource;
      switch (mode) {
        case "translation_only":
          return translatedText;
        case "parallel":
          return `${this._("notifications.original")}: ${originalText}  ${this._("notifications.translation")}: ${translatedText.split("<|>")[2] || translatedText}   `;
        case "language_learning":
          let parts = [];
          if (showSource) {
            parts.push(`${this._("notifications.original")}: ${originalText}`);
          }
          const pinyin = translatedText.split("<|>")[1];
          if (pinyin) {
            parts.push(`${this._("notifications.ipa")}: ${pinyin}`);
          }
          const translation =
            translatedText.split("<|>")[2] || translatedText;
          parts.push(`${this._("notifications.translation")}: ${translation}   `);
          return parts.join("  ");
        default:
          return translatedText;
      }
    }
  }
