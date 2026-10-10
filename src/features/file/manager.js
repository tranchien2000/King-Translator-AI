  class FileManager {
    constructor(translator) {
      this.translator = translator;
      this._ = translator.userSettings._;
      this.supportedFormats = RELIABLE_FORMATS;
    }
    isValidFormat(file) {
      const extension = file.name.split('.').pop().toLowerCase();
      const mimeType = file.type;
      return RELIABLE_FORMATS.text.formats.some(format =>
        format.ext === extension || format.mime === mimeType
      );
    }
    isValidSize(file) {
      return file.size <= RELIABLE_FORMATS.text.maxSize;
    }
    async processFile(file) {
      try {
        const content = await this.readFileContent(file);
        const extension = file.name.split('.').pop().toLowerCase();
        switch (extension) {
          case 'txt':
          case 'md':
            return await this.translator.translate(content);
          case 'json':
            return await this.processJSON(content);
          case 'html':
            return await this.translator.page.translateHTML(content);
          case 'pdf':
            return await this.translator.page.translatePDF(file);
          case 'srt':
          case 'vtt':
            return await this.processSubtitle(content);
          default:
            throw new Error(this._("notifications.uns_format"));
        }
      } catch (error) {
        throw new Error(this._("notifications.file_processing_error") + `: ${error.message}`);
      }
    }
    async processJSON(content) {
      try {
        const json = JSON.parse(content);
        const translated = await this.translateObject(json);
        return JSON.stringify(translated, null, 2);
      } catch (error) {
        throw new Error(this._("notifications.json_processing_error"));
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
            if (typeof parsed.id === 'number' && (parsed.translation || parsed.text)) {
              objects.push(parsed);
            }
            currentObjectStr = '';
          }
        } catch (e) {
        }
      });
      if (objects.length > 0) {
        console.warn("Fallback JSON parsing succeeded with", objects.length, "objects.");
        return objects;
      }
      throw new Error(this._("notifications.response_parse_error"));
    }
    async processSubtitle(content) {
      try {
        const settings = this.translator.userSettings.settings;
        const displayMode = settings.displayOptions.translationMode;
        const showSource = displayMode === 'language_learning' && settings.displayOptions.languageLearning.showSource;
        const srtBlocks = content.split(/\r?\n\r?\n/).map((part, originalIndex) => {
          if (part.trim() === '') return null;
          const lines = part.split(/\r?\n/);
          if (lines.length < 2) return null;
          const index = lines[0];
          const timing = lines[1];
          const originalText = lines.slice(2).join('\n');
          if (!/^\d+$/.test(index.trim()) || !timing.includes('-->')) {
            return null;
          }
          return { originalIndex, index, timing, originalText };
        }).filter(Boolean);
        if (srtBlocks.length === 0) return content;
        const CHUNK_SIZE = 100;
        const chunks = [];
        for (let i = 0; i < srtBlocks.length; i += CHUNK_SIZE) {
          chunks.push(srtBlocks.slice(i, i + CHUNK_SIZE));
        }
        const allTranslatedTexts = new Map();
        const docTitle = document.title ? `từ video có tiêu đề "${document.title}"` : '';
        const targetLang = settings.displayOptions.targetLanguage;
        await Promise.all(chunks.map(async (chunk) => {
          const linesToTranslate = chunk.filter(block => block.originalText.trim() !== '');
          if (linesToTranslate.length === 0) return;
          const jsonPayload = linesToTranslate.map(block => ({
            id: block.originalIndex,
            text: block.originalText,
          }));
          const prompt = `You are an expert subtitle translator. Your task is to translate the 'text' field for each object in the following JSON array to '${targetLang}'.
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
${JSON.stringify(jsonPayload, null, 2)}
\`\`\`
\nExpected Output JSON format:
[
  { "id": 0, "translation": "Translated text for object with id 0..." },
  { "id": 1, "translation": "Translated text for object with id 1..." },
  ...
]
`;
          const rawResponse = await this.translator.api.request(prompt, 'page');
          if (!rawResponse) return;
          const translatedData = this.parseFaultyJSON(rawResponse);
          if (Array.isArray(translatedData)) {
            translatedData.forEach(item => {
              const translation = item.translation || item.text;
              if (typeof item.id !== 'undefined' && translation) {
                allTranslatedTexts.set(item.id, translation);
              }
            });
          }
        }));
        const finalSrtParts = srtBlocks.map(block => {
          const translatedText = allTranslatedTexts.get(block.originalIndex);
          if (!translatedText || block.originalText.trim() === '') {
            return `${block.index}\n${block.timing}\n${block.originalText}`;
          }
          let finalSubtitleText;
          if (displayMode === 'parallel' || (displayMode === 'language_learning' && showSource)) {
            finalSubtitleText = `${block.originalText}\n${translatedText}`;
          } else {
            finalSubtitleText = translatedText;
          }
          return `${block.index}\n${block.timing}\n${finalSubtitleText}`;
        });
        return finalSrtParts.join('\n\n');
      } catch (error) {
        console.error("Subtitle processing error:", error);
        throw new Error(this._("notifications.subtitle_processing_error") + `: ${error.message}`);
      }
    }
    async translateObject(obj) {
      const translated = {};
      for (const key in obj) {
        if (typeof obj[key] === 'string') {
          translated[key] = await this.translator.translate(obj[key]);
        } else if (typeof obj[key] === 'object' && obj[key] !== null) {
          translated[key] = await this.translateObject(obj[key]);
        } else {
          translated[key] = obj[key];
        }
      }
      return translated;
    }
    readFileContent(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error((this._("notifications.failed_read_file"))));
        reader.readAsText(file);
      });
    }
  }
