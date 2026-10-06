// Auto-generated from King-Translator-AI.user.js
// VideoStreamingTranslator class

  class VideoStreamingTranslator {
    constructor(translator) {
      this.translator = translator;
      this.settings = this.translator.userSettings.settings;
      this._ = this.translator.userSettings._;
      this.defaultLang = this.settings.displayOptions.targetLanguage;
      this.isEnabled = false;
      this.isPlaying = false;
      this.hasCaptions = false;
      this.initialized = false;
      this.isFetchingTranscript = false;
      this.isTranslatingChunk = false;
      this.isSeeking = false;
      this.lastCurrentTime = -1;
      this.fullTranscriptTranslated = false;
      this.isNotify = false;
      this.activeVideoId = null;
      this.currentVideo = null;
      this.videoTrackingInterval = null;
      this.translatedTranscript = null;
      this.subtitleContainer = null;
      this.lastCaption = '';
      this.lastTranslatedIndex = -1;
      this.translatingIndexes = new Set();
      this.subtitleCache = new Map();
      this.keyIndex = null;
      this.rateLimitedKeys = new Map();
      this.retryDelay = 100;
      this.captionObserver = null;
      this.platformInfo = this.detectPlatform();
      if (this.settings.videoStreamingOptions?.enabled && this.platformInfo) {
        setTimeout(() => this.start(), 2000);
      }
    }
    detectPlatform() {
      this.platformConfigs = {
        youtube: {
          videoSelector: [
            'video',
            'video.html5-main-video',
            '.html5-video-container video',
            '#movie_player video',
          ],
          controlsContainer: [
            '.ytp-subtitles-button',
            '.ytp-settings-button',
            'ytm-closed-captioning-button'
          ],
          videoContainer: [
            '#movie_player',
            '#player',
            '.html5-video-container',
          ],
          // captionSelector: ['.captions-text'],
          // captionButton: {
          //   desktop: '.ytp-subtitles-button',
          //   mobile: '.ytmClosedCaptioningButtonButton'
          // }
        },
        udemy: {
          videoSelector: [
            'video',
            '[class*="video-player--video-player"] video'
          ],
          controlsContainer: [
            '[data-purpose="transcript-toggle"]',
            '[id="popper-trigger--131"]'
          ],
          videoContainer: [
            '[class*="video-player--mock-vjs-tech"]',
            '[id*="video-container"]'
          ],
          // captionSelector: ['data-purpose="captions-cue-text"'],
          // captionButton: {
          //   desktop: 'button[data-purpose="transcript-toggle"]'
          // }
        }
      };
      const hostname = window.location.hostname;
      for (const [platform, config] of Object.entries(this.platformConfigs)) {
        if (hostname.includes(platform)) {
          return { platform, config };
        }
      }
      return null;
    }
    setupVideoListeners() {
      if (!this.currentVideo || this.initialized) return;
      this.activeVideoId = Math.random().toString(36).substring(7);
      this.currentVideo.dataset.translatorVideoId = this.activeVideoId;
      const videoEvents = ['play', 'playing', 'seeking', 'seeked', 'pause', 'ended'];
      videoEvents.forEach(eventName => {
        const handler = async () => {
          if (this.currentVideo?.dataset.translatorVideoId !== this.activeVideoId) return;
          switch (eventName) {
            case 'play':
            case 'playing':
              this.isPlaying = true;
              break;
            case 'seeking':
              this.isSeeking = true;
              break;
            case 'seeked':
              this.isSeeking = false;
              this.isTranslatingChunk = false;
              this.processVideoFrame();
              break;
            case 'pause':
              this.isPlaying = false;
              break;
            case 'ended':
              this.isPlaying = false;
              this.cleanupVideo();
              break;
          }
        };
        this.currentVideo.addEventListener(eventName, handler);
        this.currentVideo[`${eventName}Handler`] = handler;
      });
      if (this.currentVideo) {
        let previousWidth = 0;
        let translatedCaption = null;
        let originalText = null;
        let translatedText = null;
        const updateStyles = debounce((width) => {
          if (width === previousWidth) return;
          previousWidth = width;
          if (!translatedCaption) translatedCaption = document.querySelector('.translated-caption');
          if (!originalText) originalText = document.querySelector('.original-text') || null;
          if (!translatedText) translatedText = document.querySelector('.translated-text');
          if (translatedText) {
            let tranWidth, origSize, transSize;
            if (width <= 480) {
              tranWidth = '98%';
              origSize = '0.65em';
              transSize = '0.7em';
            } else if (width <= 962) {
              tranWidth = '95%';
              origSize = '0.75em';
              transSize = '0.8em';
            } else if (width <= 1366) {
              tranWidth = '90%';
              origSize = '0.85em';
              transSize = '0.9em';
            } else {
              tranWidth = '90%';
              origSize = '0.95em';
              transSize = '1em';
            }
            if (translatedCaption) translatedCaption.style.maxWidth = tranWidth;
            if (originalText) originalText.style.fontSize = origSize;
            translatedText.style.fontSize = transSize;
          }
        }, 100);
        const adjustContainer = debounce(() => {
          if (!this.subtitleContainer || !this.currentVideo) return;
          const videoRect = this.currentVideo.getBoundingClientRect();
          const containerRect = this.subtitleContainer.getBoundingClientRect();
          if (containerRect.bottom > videoRect.bottom) {
            this.subtitleContainer.style.bottom = '5%';
          }
          if (containerRect.width > videoRect.width * 0.9) {
            this.subtitleContainer.style.maxWidth = '90%';
          }
        }, 100);
        const resizeObserver = new ResizeObserver(entries => {
          const width = entries[0].contentRect.width;
          updateStyles(width);
          adjustContainer();
        });
        resizeObserver.observe(this.currentVideo);
      }
      this.initialized = true;
    }
    parseTimestampToSeconds(timestampStr) {
      if (!timestampStr) return 0;
      const parts = timestampStr.split(':').map(Number);
      let seconds = 0;
      if (parts.length === 3) { // HH:MM:SS
        seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
      } else if (parts.length === 2) { // MM:SS
        seconds = parts[0] * 60 + parts[1];
      } else if (parts.length === 1) { // SS
        seconds = parts[0];
      }
      return seconds;
    }
    async getTranscriptFromDOM() {
      console.log('[King_DEBUG] Attempting to get transcript from DOM.');
      let cookieButtonElement;
      cookieButtonElement = document.querySelector("button[aria-label*=cookies]");
      if (cookieButtonElement) {
        cookieButtonElement.click();
      }
      await new Promise(resolve => {
        const findAndClickTranscriptButton = () => {
          const transcriptButton = document.querySelector("ytd-video-description-transcript-section-renderer button") || document.querySelector('button[title="Transcript"]');
          if (transcriptButton) {
            transcriptButton.click();
            resolve();
          } else {
            setTimeout(findAndClickTranscriptButton, 500);
          }
        };
        findAndClickTranscriptButton();
      });
      let segmentsContainer;
      segmentsContainer = await new Promise(resolve => {
        const waitForTranscriptContainer = () => {
          const container = document.querySelector("#segments-container") || document.querySelector('#transcript-scrollbox');
          if (container) {
            resolve(container);
          } else {
            setTimeout(waitForTranscriptContainer, 500);
          }
        };
        waitForTranscriptContainer();
      });
      const selectors = ['ytd-transcript-segment-renderer', '.caption-line'];
      for (const selector of selectors) {
        const segments = segmentsContainer.querySelectorAll(selector);
        if (segments && segments.length > 0) {
          console.log(segments);
          const transcriptData = [];
          for (let i = 0; i < segments.length; i++) {
            const segment = segments[i];
            const timeEl = segment.querySelector('.segment-timestamp') || segment.querySelector('.caption-line-time');
            const textEl = segment.querySelector('.segment-text') || segment.querySelector('.caption-line-text');
            if (timeEl && textEl) {
              const text = this.cleanTranscriptText(textEl.textContent || '');
              if (text) {
                const start = this.parseTimestampToSeconds(timeEl.textContent.trim());
                let duration = 5.0;
                if (i + 1 < segments.length) {
                  const nextTimeEl = segments[i + 1].querySelector('.segment-timestamp') || segments[i + 1].querySelector('.caption-line-time');
                  if (nextTimeEl) {
                    const nextStart = this.parseTimestampToSeconds(nextTimeEl.textContent.trim());
                    duration = nextStart - start;
                  }
                }
                transcriptData.push({ text, start, duration });
              }
            }
          }
          console.log(`[King_DEBUG] DOM method successful. Extracted ${transcriptData.length} timed captions.`);
          return transcriptData.length > 0 ? transcriptData : null;
        }
      }
    }
    async waitForElement(selector, timeout = 15000, interval = 500) {
      const startTime = Date.now();
      return new Promise((resolve) => {
        const check = () => {
          const element = document.querySelector(selector);
          if (element) {
            resolve(element);
          } else if (Date.now() - startTime > timeout) {
            resolve(null);
          } else {
            setTimeout(check, interval);
          }
        };
        check();
      });
    }
    async setupUdemyObserver() {
      console.log('[King_DEBUG] Setting up observer for Udemy with multi-layered translation.');
      const transcriptButton = await this.waitForElement('button[data-purpose="transcript-toggle"]');
      if (!transcriptButton) return console.error('Udemy transcript button not found.');
      if (transcriptButton.getAttribute('aria-expanded') !== 'true') {
        transcriptButton.click();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      const transcriptPanel = await this.waitForElement('[data-purpose="transcript-panel"]');
      if (!transcriptPanel) return console.error('Could not find Udemy transcript panel to observe.');
      const translateCueInBackground = async (cueElement) => {
        const text = cueElement?.querySelector('[data-purpose="cue-text"]')?.textContent?.trim();
        if (text && !this.subtitleCache.has(text)) {
          try {
            this.subtitleCache.set(text, 'translating...');
            const translated = await this.translator.api.request(this.createLiveCaptionPrompt(text), 'media');
            this.subtitleCache.set(text, translated || text);
          } catch (error) {
            console.error("Background cue translation failed:", error);
            this.subtitleCache.set(text, text);
          }
        }
      };
      const handleNewActiveCue = async (activeCue) => {
        const originalText = activeCue?.querySelector('[data-purpose="cue-text"]')?.textContent?.trim();
        if (originalText && originalText !== this.lastCaption) {
          this.lastCaption = originalText;
          const cached = this.subtitleCache.get(originalText);
          if (cached && cached !== 'translating...') {
            this.updateSubtitles({ original: originalText, translation: cached });
          } else {
            this.updateSubtitles({ original: originalText, translation: '...' });
            const translated = await this.translator.api.request(this.createLiveCaptionPrompt(originalText), 'media');
            if (this.lastCaption === originalText) {
              this.updateSubtitles({ original: originalText, translation: translated || originalText });
            }
            if (translated) this.subtitleCache.set(originalText, translated);
          }
          const upcomingCues = [];
          let currentCueContainer = activeCue.parentElement;
          for (let i = 0; i < 10 && currentCueContainer; i++) {
            currentCueContainer = currentCueContainer.nextElementSibling;
            if (currentCueContainer) {
              const nextCueElement = currentCueContainer.querySelector('[data-purpose="transcript-cue"]');
              if (nextCueElement) {
                upcomingCues.push(nextCueElement);
              }
            }
          }
          console.log(`[King_DEBUG] Found ${upcomingCues.length} upcoming cues to pre-translate.`);
          if (upcomingCues.length > 0) {
            const translationPromises = upcomingCues.map(cue => translateCueInBackground(cue));
            Promise.allSettled(translationPromises);
          }
        }
      };
      const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
          if (mutation.target?.getAttribute('data-purpose') === 'transcript-cue-active') {
            handleNewActiveCue(mutation.target);
            return;
          }
        }
      });
      observer.observe(transcriptPanel, { attributes: true, subtree: true, attributeFilter: ['data-purpose'] });
      this.captionObserver = observer;
      const initiallyActiveCue = transcriptPanel.querySelector('[data-purpose="transcript-cue-active"]');
      if (initiallyActiveCue) {
        handleNewActiveCue(initiallyActiveCue);
      }
      if (!this.fullTranscriptTranslated) {
        this.translateFullUdemyTranscript(transcriptPanel);
      }
    }
    async getVideoTranscript() {
      if (this.platformInfo.platform === 'udemy') {
        console.log('[King_DEBUG] Skipping timestamp-based transcript fetch for Udemy.');
        return null;
      }
      if (this.videoTranscript) return this.videoTranscript;
      if (this.isFetchingTranscript) return null;
      this.isFetchingTranscript = true;
      console.log("[KING_DEBUG] getVideoTranscript: Starting to fetch transcript...");
      try {
        let transcriptData = null;
        transcriptData = await this.getTranscriptFromDOM();
        if (transcriptData && transcriptData.length > 0) {
          this.videoTranscript = transcriptData;
          this.translatedTranscript = new Array(this.videoTranscript.length).fill(null);
          console.log("[KING_DEBUG] getVideoTranscript: Success! Parsed", this.videoTranscript.length, "captions.");
          this.translateFullTranscriptInBackground();
          return this.videoTranscript;
        }
        const finalErrorMessage = this._("notifications.get_transcript_error_generic") + "\n\n" +
          this._("notifications.get_transcript_error_suggestion1") + "\n" +
          this._("notifications.get_transcript_error_suggestion2");
        console.error("[King_DEBUG] All methods failed to get transcript.");
        if (!this.isNotify) this.translator.ui.showNotification(finalErrorMessage, "error");
        this.isNotify = true;
        throw new Error(finalErrorMessage);
      } catch (error) {
        console.error('[KING_DEBUG] Error in getVideoTranscript:', error);
        if (!this.isNotify) this.translator.ui.showNotification(error.message, "error");
        this.isNotify = true;
        return null;
      } finally {
        this.isFetchingTranscript = false;
      }
    }
    cleanTranscriptText(text) {
      return text
        .replace(/\n/g, " ")
        .replace(/♪|'|"|\.{2,}|\<[\s\S]*?\>|\{[\s\S]*?\}|\[[\s\S]*?\]/g, "")
        .replace(/\s+/g, " ")
        .trim();
    }
    formatMilliseconds(ms) {
      const totalSeconds = Math.floor(ms / 1000);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      const paddedSeconds = String(seconds).padStart(2, "0");
      const paddedMinutes = String(minutes).padStart(2, "0");
      if (hours > 0) {
        const paddedHours = String(hours).padStart(2, "0");
        return `${paddedHours}:${paddedMinutes}:${paddedSeconds}`;
      } else {
        return `${paddedMinutes}:${paddedSeconds}`;
      }
    }
    async translateFullTranscriptInBackground() {
      if (!this.videoTranscript || this.fullTranscriptTranslated) return;
      console.log("[KING_DEBUG] Starting full transcript translation for YouTube...");
      try {
        const untranslatedCaptions = this.videoTranscript
          .map((caption, index) => ({ ...caption, originalIndex: index }))
          .filter(caption => !this.translatedTranscript[caption.originalIndex]);
        if (untranslatedCaptions.length === 0) {
          console.log("[King_DEBUG] All YouTube transcript cues are already translated.");
          this.fullTranscriptTranslated = true;
          return;
        }
        const CHUNK_SIZE = 100;
        const chunks = [];
        for (let i = 0; i < untranslatedCaptions.length; i += CHUNK_SIZE) {
          chunks.push(untranslatedCaptions.slice(i, i + CHUNK_SIZE));
        }
        console.log(`[KING_DEBUG] Splitting YouTube transcript into ${chunks.length} chunks of size ~${CHUNK_SIZE}.`);
        const docTitle = document.title ? `and the title "${document.title}"` : '';
        const targetLang = this.settings.displayOptions.targetLanguage;
        const chunkPromises = chunks.map(async (chunk) => {
          const chunkWithIDs = chunk.map(caption => ({ id: caption.originalIndex, text: caption.text }));
          const chunkJSON = JSON.stringify(chunkWithIDs, null, 2);
          const fullPrompt = `You are an expert subtitle translator. Your task is to translate the 'text' field for each object in the following JSON array to '${targetLang}'.
- Target language: '${targetLang}'.
- Use the context of ${docTitle} to determine the translation style.
- The translation must strictly adhere to the context and tone of the original text.
- Ensure fluency and naturalness as a native speaker would.
- Do not add any explanations or interpretations beyond the translation.
- Preserve terminology and proper nouns on a 1:1 basis.
- You MUST return a valid JSON array.
- For EACH object you translate, you MUST include the original 'id' from the input.
- Each object in the output array must contain exactly two fields: "id" (the original integer ID) and "translation" (the translated text).
- Do NOT add, merge, or skip any objects. The output array should ideally have the same number of objects as the input.
- Do NOT add any extra text, comments, or markdown formatting (DO NOT like \`\`\`json). The output must be raw, valid JSON.
- CRITICAL: Properly escape all special characters within the "translation" strings, especially double quotes (").
\nInput JSON:
\`\`\`
${chunkJSON}
\`\`\`
\nExpected Output JSON format:
[
  { "id": 0, "translation": "Translated text for object with id 0..." },
  { "id": 1, "translation": "Translated text for object with id 1..." },
  ...
]
`;
          try {
            const rawResponse = await this.translator.api.request(fullPrompt, 'media');
            console.log('rawResponse:\n', rawResponse);
            if (!rawResponse) return;
            const translatedData = this.parseFaultyJSON(rawResponse);
            if (Array.isArray(translatedData)) {
              translatedData.forEach(item => {
                const originalIndex = item.id;
                const translation = item.translation || item.vi;
                if (typeof originalIndex === 'number' && this.videoTranscript[originalIndex] && translation) {
                  this.translatedTranscript[originalIndex] = {
                    original: this.videoTranscript[originalIndex].text,
                    translation: translation
                  };
                }
              });
            }
          } catch (chunkError) {
            console.error(`[King_DEBUG] Failed to translate a YouTube chunk:`, chunkError);
          }
        });
        await Promise.allSettled(chunkPromises);
        this.fullTranscriptTranslated = true;
        console.log("[KING_DEBUG] All YouTube transcript chunks have been processed.");
      } catch (error) {
        console.error("[KING_DEBUG] Error during full YouTube transcript translation:", error);
      }
    }
    async translateFullUdemyTranscript(transcriptPanel) {
      if (this.fullTranscriptTranslated) return;
      console.log("[King_DEBUG] Starting full transcript translation for Udemy...");
      try {
        const cues = transcriptPanel.querySelectorAll('[data-purpose="transcript-cue"]');
        if (!cues || cues.length === 0) return;
        const transcriptWithIDs = Array.from(cues).map((cue, index) => {
          const text = cue.querySelector('[data-purpose="cue-text"]')?.textContent?.trim();
          return (text && !this.subtitleCache.has(text)) ? { id: index, text: text } : null;
        }).filter(Boolean);
        if (transcriptWithIDs.length === 0) {
          console.log("[King_DEBUG] All transcript cues are already cached.");
          this.fullTranscriptTranslated = true;
          return;
        }
        const CHUNK_SIZE = 100;
        const chunks = [];
        for (let i = 0; i < transcriptWithIDs.length; i += CHUNK_SIZE) {
          chunks.push(transcriptWithIDs.slice(i, i + CHUNK_SIZE));
        }
        console.log(`[King_DEBUG] Splitting full transcript into ${chunks.length} chunks of size ~${CHUNK_SIZE}.`);
        const docTitle = document.title ? `từ video có tiêu đề "${document.title}"` : '';
        const targetLang = this.settings.displayOptions.targetLanguage;
        const chunkPromises = chunks.map(async (chunk) => {
          const chunkJSON = JSON.stringify(chunk, null, 2);
          const fullPrompt = `You are an expert subtitle translator. Your task is to translate the 'text' field for each object in the following JSON array to '${targetLang}'.
- Target language: '${targetLang}'.
- Use the context of ${docTitle} to determine the translation style.
- The translation must strictly adhere to the context and tone of the original text.
- Ensure fluency and naturalness as a native speaker would.
- Do not add any explanations or interpretations beyond the translation.
- Preserve terminology and proper nouns on a 1:1 basis.
- You MUST return a valid JSON array.
- For EACH object you translate, you MUST include the original 'id' from the input.
- Each object in the output array must contain exactly two fields: "id" (the original integer ID) and "translation" (the translated text).
- Do NOT add, merge, or skip any objects. The output array should ideally have the same number of objects as the input.
- Do NOT add any extra text, comments, or markdown formatting (DO NOT like \`\`\`json). The output must be raw, valid JSON.
- CRITICAL: Properly escape all special characters within the "translation" strings, especially double quotes (").
\nInput JSON:
\`\`\`
${chunkJSON}
\`\`\`
\nExpected Output JSON format:
[
  { "id": 0, "translation": "Translated text for object with id 0..." },
  { "id": 1, "translation": "Translated text for object with id 1..." },
  ...
]
`;
          try {
            const rawResponse = await this.translator.api.request(fullPrompt, 'media');
            if (!rawResponse) return;
            const translatedData = this.parseFaultyJSON(rawResponse);
            if (Array.isArray(translatedData)) {
              const originalTextsMap = new Map(chunk.map(item => [item.id, item.text]));
              translatedData.forEach(item => {
                const originalText = originalTextsMap.get(item.id);
                const translation = item.translation || item.vi;
                if (originalText && translation) {
                  this.subtitleCache.set(originalText, translation);
                }
              });
            }
          } catch (chunkError) {
            console.error(`[King_DEBUG] Failed to translate a chunk:`, chunkError);
          }
        });
        await Promise.allSettled(chunkPromises);
        this.fullTranscriptTranslated = true;
        console.log("[King_DEBUG] All transcript chunks have been processed.");
      } catch (error) {
        console.error("[KING_DEBUG] Error during full Udemy transcript translation:", error);
      }
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
    getCurrentCaption(transcript, currentTime) {
      if (!transcript || !Array.isArray(transcript)) return null;
      const caption = transcript.find(item => {
        const start = item.start;
        const end = start + (item.duration || 0);
        return currentTime >= start && currentTime < end;
      });
      return caption || null;
    }
    async processVideoFrame() {
      if (this.platformInfo.platform === 'udemy' || !this.isEnabled || !this.currentVideo || this.isSeeking) return;
      try {
        if (!this.videoTranscript && !this.isFetchingTranscript) {
          await this.getVideoTranscript();
        }
        if (!this.videoTranscript) return;
        const currentTime = this.currentVideo.currentTime;
        const currentIndex = this.videoTranscript.findIndex(caption => {
          const start = caption.start;
          const end = start + (caption.duration || 5);
          return currentTime >= start && currentTime < end;
        });
        if (currentIndex === -1) {
          if (this.subtitleContainer) this.subtitleContainer.innerText = '';
          this.lastCaption = '';
          return;
        }
        const currentDisplayMode = this.settings.displayOptions?.translationMode;
        let separator = '\n';
        if (currentDisplayMode === 'parallel' || (currentDisplayMode === 'language_learning' && this.settings.displayOptions.languageLearning?.showSource)) {
          separator = ' ';
        }
        const currentOriginal = this.videoTranscript[currentIndex];
        const currentTranslated = this.translatedTranscript[currentIndex];
        const nextOriginal = this.videoTranscript[currentIndex + 1];
        const nextTranslated = this.translatedTranscript[currentIndex + 1];
        let combinedOriginalText = currentOriginal.text;
        let combinedTranslatedText = currentTranslated ? currentTranslated.translation : '...';
        if (nextOriginal) {
          combinedOriginalText += `${separator}${nextOriginal.text}`;
          if (nextTranslated) {
            combinedTranslatedText += `${separator}${nextTranslated.translation}`;
          } else {
            combinedTranslatedText += `${separator}...`;
          }
        }
        const displayData = {
          original: combinedOriginalText,
          translation: combinedTranslatedText,
        };
        if (displayData.translation !== this.lastCaption) {
          this.lastCaption = displayData.translation;
          this.updateSubtitles(displayData);
        }
        if (!this.isTranslatingChunk && this.checkNeedsTranslation(currentIndex)) {
          this.translateUpcomingCaptions(currentIndex);
        }
      } catch (error) {
        console.error('[KING_DEBUG] Error in processVideoFrame:', error);
      }
    }
    checkNeedsTranslation(currentIndex) {
      const LOOK_AHEAD = 10;
      const endIndex = Math.min(currentIndex + LOOK_AHEAD, this.videoTranscript.length);
      for (let i = currentIndex + 1; i < endIndex; i++) {
        if (!this.translatedTranscript[i] && !this.translatingIndexes.has(i)) {
          return true;
        }
      }
      return false;
    }
    async translateUpcomingCaptions(currentIndex) {
      if (this.isTranslatingChunk || !this.videoTranscript || this.fullTranscriptTranslated) return;
      this.isTranslatingChunk = true;
      try {
        const CHUNK_SIZE = 10;
        const untranslatedCaptions = [];
        for (let i = currentIndex; i < this.videoTranscript.length && untranslatedCaptions.length < CHUNK_SIZE; i++) {
          if (!this.translatedTranscript[i] && !this.translatingIndexes.has(i)) {
            untranslatedCaptions.push({ text: this.videoTranscript[i].text, index: i });
            this.translatingIndexes.add(i);
          }
        }
        if (untranslatedCaptions.length === 0) {
          this.isTranslatingChunk = false;
          return;
        }
        console.log(`[King_DEBUG] Pre-translating ${untranslatedCaptions.length} upcoming captions in parallel.`);
        const translationPromises = untranslatedCaptions.map(captionInfo =>
          this.translator.api.request(this.createLiveCaptionPrompt(captionInfo.text), 'media')
            .then(translatedText => ({
              ...captionInfo,
              translation: translatedText || captionInfo.text,
              success: !!translatedText
            }))
            .catch(error => {
              console.error(`Error translating upcoming caption: "${captionInfo.text}"`, error);
              return { ...captionInfo, translation: captionInfo.text, success: false };
            })
        );
        const results = await Promise.allSettled(translationPromises);
        results.forEach(result => {
          if (result.status === 'fulfilled') {
            const { index, text, translation } = result.value;
            this.translatedTranscript[index] = {
              original: text,
              translation: translation
            };
            this.translatingIndexes.delete(index);
          }
        });
      } catch (error) {
        console.error(this._("notifications.upcoming_captions_error"), error);
      } finally {
        this.isTranslatingChunk = false;
      }
    }
    createLiveCaptionPrompt(text, isFast = false) {
      const docTitle = `và tiêu đề "${document.title}"` || '';
      const targetLang = this.settings.displayOptions.targetLanguage;
      return `  Bạn là một người dịch phụ đề video chuyên nghiệp, chuyên tạo bản dịch chính xác và tự nhiên. Bạn cần dịch phụ đề video ở dưới đây sang "${targetLang}".
  Lưu ý:
    - Ngôn ngữ đích: '${targetLang}'.
    - Dựa vào ngữ cảnh, bối cảnh ${isFast ? '' : docTitle} để xác định phong cách dịch.
    - Bảo toàn các thuật ngữ và danh từ riêng với tỷ lệ 1:1.
    - KHÔNG thêm bất kỳ văn bản, bình luận, hay định dạng markdown nào khác (KHÔNG dùng định dạng kiểu \`\`\`).
    - Chỉ trả về bản dịch là văn bản thô hợp lệ và không giải thích gì thêm.
  Văn bản cần dịch:
\`\`\`
${text}
\`\`\`
`;
    }
    setupVideoWatcher() {
      if (this.videoWatcherObserver) return;
      const handleVideoChange = debounce(async () => {
        const activeVideo = Array.from(document.querySelectorAll('video')).find(v => v.src && v.offsetHeight > 0);
        if (activeVideo && activeVideo.src !== this.currentVideo?.src) {
          console.log('[King_DEBUG] New video source detected. Re-initializing translator...');
          this.cleanup();
          await new Promise(resolve => setTimeout(resolve, 1500));
          this.start();
        }
      }, 1000);
      const observer = new MutationObserver(handleVideoChange);
      observer.observe(document.body, { childList: true, attributes: true, subtree: true, attributeFilter: ['src'] });
      this.videoWatcherObserver = observer;
    }
    startVideoTracking() {
      if (this.videoTrackingInterval) {
        clearInterval(this.videoTrackingInterval);
      }
      this.videoTrackingInterval = setInterval(() => {
        this.processVideoFrame();
      }, 250);
      console.log("[KING_DEBUG] Video tracking started with 250ms interval.");
    }
    async start() {
      if (this.isEnabled) {
        console.log("[KING_DEBUG] Feature is already enabled.");
        return;
      }
      this.isEnabled = true;
      console.log("[KING_DEBUG] start() called. Waiting for active video...");
      const findActiveVideo = () => {
        const videoSelectors = this.platformInfo.config.videoSelector;
        for (const selector of videoSelectors) {
          const videos = document.querySelectorAll(selector);
          for (const video of videos) {
            if (video.src && video.readyState > 2 && !video.paused && video.videoHeight > 0) {
              return video;
            }
          }
        }
        for (const selector of videoSelectors) {
          const videos = document.querySelectorAll(selector);
          for (const video of videos) {
            if (video.currentTime > 0.1) {
              return video;
            }
          }
        }
        return null;
      };
      let activeVideo = null;
      const maxAttempts = 3 * 300; // 3 minutes
      for (let i = 0; i < maxAttempts; i++) {
        if (!this.isEnabled) {
          console.log("[KING_DEBUG] Start process cancelled by user.");
          return;
        }
        activeVideo = findActiveVideo();
        if (activeVideo) {
          console.log("[KING_DEBUG] Active video found after", (i * 200) + "ms", activeVideo);
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      if (!activeVideo) {
        console.error("[KING_DEBUG] Could not find an active video after 3 minutes. Aborting.");
        this.translator.ui.showNotification(this._("notifications.not_find_video"), "error");
        this.isEnabled = false;
        return;
      }
      this.currentVideo = activeVideo;
      this.setupVideoListeners();
      this.createVideoControls();
      this.createSubtitleContainer();
      if (this.platformInfo.platform === 'udemy') {
        this.setupUdemyObserver();
      } else {
        this.startVideoTracking();
      }
      this.setupVideoWatcher();
    }
    stop() {
      this.isEnabled = false;
      this.isPlaying = false;
      this.cleanupVideo();
      if (this.videoTrackingInterval) clearInterval(this.videoTrackingInterval);
      if (this.captionObserver) this.captionObserver.disconnect();
      if (this.controlsContainer) this.controlsContainer.remove();
      if (this.subtitleContainer) this.subtitleContainer.remove();
      this.videoWatcherObserver = null;
      this.captionObserver = null;
      this.controlsContainer = null;
      this.subtitleContainer = null;
      this.currentVideo = null;
      this.lastOriginalText = '';
      this.subtitleCache.clear();
      this.isNotify = false;
      this.rateLimitedKeys.clear();
      this.keyIndex = null;
      this.videoTranscript = null;
      this.translatedTranscript = null;
      console.log(this._("notifications.stop_cap"));
    }
    cleanup() {
      this.fullTranscriptTranslated = false;
      if (this.videoWatcherObserver) this.videoWatcherObserver.disconnect();
      this.subtitleCache.clear();
      this.stop();
    }
    cleanupVideo() {
      if (this.currentVideo) {
        delete this.currentVideo.dataset.translatorVideoId;
        const videoEvents = ['play', 'playing', 'seeking', 'seeked', 'pause', 'ended'];
        videoEvents.forEach(event => {
          const handler = this.currentVideo[`${event}Handler`];
          if (handler) {
            this.currentVideo.removeEventListener(event, handler);
            delete this.currentVideo[`${event}Handler`];
          }
        });
      }
      this.initialized = false;
      this.hasCaptions = false;
      this.lastCaption = '';
    }
    createVideoControls() {
      if (this.controlsContainer) return;
      console.log("[KING_DEBUG] Creating video controls.");
      const toggleButton = document.createElement('button');
      let controlsTarget = null;
      let anchorButton = null;
      const selectors = this.platformInfo.config.controlsContainer;
      for (const selector of selectors) {
        anchorButton = document.querySelector(selector);
        if (anchorButton) {
          controlsTarget = anchorButton.parentElement;
          toggleButton.className = anchorButton.className;
          console.log(`[KING_DEBUG] Found controls container with selector: ${selector}`);
          break;
        }
      }
      if (!controlsTarget) {
        console.error("[KING_DEBUG] Failed to find any suitable container for controls.");
        return;
      }
      toggleButton.classList.add('video-translation-controls');
      toggleButton.title = this.isEnabled ? this._("notifications.live_caption_off") : this._("notifications.live_caption_on");
      toggleButton.setAttribute('role', 'button');
      toggleButton.setAttribute('tabindex', '6200');
      toggleButton.innerHTML = `<img src="https://raw.githubusercontent.com/king1x32/King-Translator-AI/refs/heads/main/icon/kings.jpg" style="width: 65%; height: 65%; padding: 20%;">`;
      toggleButton.onclick = (e) => {
        e.stopPropagation();
        if (this.isEnabled) {
          this.stop();
          this.translator.ui.showNotification(this._("notifications.live_caption_off2"), "info");
          this.controlsContainer.title = this._("notifications.live_caption_on");
        } else {
          this.start();
          this.translator.ui.showNotification(this._("notifications.live_caption_on2"), "success");
          this.controlsContainer.title = this._("notifications.live_caption_off");
        }
      };
      if (anchorButton) controlsTarget.insertBefore(toggleButton, anchorButton.nextSibling);
      else controlsTarget.prepend(toggleButton);
      console.log("[KING_DEBUG] Video translation button successfully inserted before the anchor button.");
      this.controlsContainer = toggleButton;
    }
    findVideoContainer() {
      const selectors = this.platformInfo.config.videoContainer;
      for (const selector of selectors) {
        const container = this.currentVideo.closest(selector);
        if (container) {
          console.log(`[KING_DEBUG] Found video container with selector: ${selector}`);
          return container;
        }
      }
      console.warn("[KING_DEBUG] Could not find specific video container, falling back to video's parent element.");
      return this.currentVideo.parentElement;
    }
    createSubtitleContainer() {
      if (this.subtitleContainer) return;
      this.subtitleContainer = document.createElement('div');
      this.subtitleContainer.className = 'live-caption-container translated-caption';
      const videoContainer = this.findVideoContainer() || this.currentVideo;
      console.log('videoContainer', videoContainer);
      if (videoContainer) {
        console.log(this._("notifications.found_video"), videoContainer);
        if (getComputedStyle(videoContainer).position === 'static') {
          videoContainer.style.position = 'relative';
        }
        const settings = this.settings.videoStreamingOptions;
        Object.assign(this.subtitleContainer.style, {
          zIndex: "2147483647",
          display: "block",
          visibility: "visible",
          opacity: "1",
          position: "absolute",
          left: "50%",
          bottom: "2%",
          transform: "translateX(-50%)",
          zIndex: "2147483647",
          fontSize: settings.fontSize,
          color: settings.textColor,
          backgroundColor: settings.backgroundColor,
          padding: "5px 10px",
          borderRadius: "4px",
          fontFamily: "'GoMono Nerd Font', 'Noto Sans', Arial",
          textAlign: "center",
          maxWidth: "90%",
          width: "auto",
          pointerEvents: "none",
          textShadow: "0px 1px 2px rgba(0, 0, 0, 0.8)",
          whiteSpace: "pre-wrap",
          lineHeight: '1.2'
        });
        videoContainer.appendChild(this.subtitleContainer);
      } else {
        console.error(this._("notifications.video_container_not_found"));
      }
    }
    updateSubtitles(captionData) {
      if (!this.subtitleContainer) this.createSubtitleContainer();
      if (!this.subtitleContainer) return;
      const mode = this.settings.displayOptions.translationMode;
      const { original, translation } = captionData;
      this.subtitleContainer.innerText = '';
      const width = this.currentVideo.offsetWidth;
      let tranWidth, origSize, transSize;
      if (width <= 480) {
        tranWidth = '98%';
        origSize = '0.65em';
        transSize = '0.7em';
      } else if (width <= 962) {
        tranWidth = '95%';
        origSize = '0.75em';
        transSize = '0.8em';
      } else if (width <= 1366) {
        tranWidth = '90%';
        origSize = '0.85em';
        transSize = '0.9em';
      } else {
        tranWidth = '90%';
        origSize = '0.95em';
        transSize = '1em';
      }
      this.subtitleContainer.style.maxWidth = tranWidth;
      const createTextElement = (text, className, styles = {}) => {
        const element = document.createElement('span');
        element.className = className;
        element.innerText = text;
        Object.assign(element.style, styles, { display: 'block' });
        return element;
      }
      if (mode === 'parallel' || (mode === 'language_learning' && this.settings.displayOptions.languageLearning?.showSource)) {
        this.subtitleContainer.appendChild(
          createTextElement(original, 'original-text', { fontSize: origSize, color: '#eeeeee', opacity: '0.9', marginBottom: '6px' })
        );
      }
      this.subtitleContainer.appendChild(createTextElement(translation, 'translated-text', { fontSize: transSize, marginBottom: '2px' }));
    }
  }


export default VideoStreamingTranslator;
