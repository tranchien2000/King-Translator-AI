  class Translator {
    constructor() {
      if (window.translatorInstance) {
        window.translatorInstance.cleanup();
        window.translatorInstance = null;
      }
      window.translator = this;
      this.userSettings = new UserSettings(this);
      this._ = this.userSettings._;
      const apiConfig = {
        ...CONFIG.API,
        currentProvider: this.userSettings.getSetting("apiProvider"),
        apiKey: this.userSettings.getSetting("apiKey")
      };
      this.cache = new PersistentCache('textCache', this.userSettings.settings.cacheOptions.text.maxSize, this.userSettings.settings.cacheOptions.text.expirationTime);
      this.imageCache = new PersistentCache('imageCache', this.userSettings.settings.cacheOptions.image.maxSize, this.userSettings.settings.cacheOptions.image.expirationTime);
      this.mediaCache = new PersistentCache('mediaCache', this.userSettings.settings.cacheOptions.media.maxSize, this.userSettings.settings.cacheOptions.media.expirationTime);
      this.ttsCache = new PersistentCache('ttsCache', this.userSettings.settings.cacheOptions.tts.maxSize, this.userSettings.settings.cacheOptions.tts.expirationTime);
      this.uiRoot = new UIRoot(this);
      this.fileProcess = new FileProcessor(this);
      this.videoStreaming = new VideoStreamingTranslator(this);
      this.api = new APIManager(apiConfig, () => this.userSettings.settings, this.userSettings._);
      this.page = new PageTranslator(this);
      this.input = new InputTranslator(this);
      this.ocr = new OCRManager(this);
      this.media = new MediaManager(this);
      this.fileManager = new FileManager(this);
      this.ui = new UIManager(this);
    }
    async translate(
      text,
      targetElement,
      isAdvanced = false,
      popup = false,
      targetLang = ""
    ) {
      try {
        if (!text) return null;
        const settings = this.userSettings.settings.displayOptions;
        const targetLanguage = targetLang || settings.targetLanguage;
        const promptType = isAdvanced ? "advanced" : "normal";
        const prompt = this.createPrompt(text, promptType, targetLanguage);
        console.log('prompt: ', prompt);
        let translatedText;
        const cacheEnabled =
          this.userSettings.settings.cacheOptions.text.enabled;
        if (cacheEnabled) {
          translatedText = await this.cache.get(text, isAdvanced, targetLanguage);
        }
        if (!translatedText) {
          translatedText = await this.api.request(prompt, 'page');
          if (cacheEnabled && translatedText) {
            await this.cache.set(text, translatedText, isAdvanced, targetLanguage);
          }
        }
        if (
          translatedText &&
          targetElement &&
          !targetElement.isPDFTranslation
        ) {
          if (isAdvanced || popup) {
            if (settings.translationMode !== "translation_only") {
              const translations = translatedText.split("\n");
              let fullTranslation = "";
              let pinyin = "";
              for (const trans of translations) {
                const parts = trans.split("<|>");
                pinyin += (parts[1] || "") + "\n";
                fullTranslation += (parts[2] || trans.replace("<|>", "")) + "\n";
              }
              this.ui.displayPopup(
                fullTranslation,
                text,
                "King1x32 <3",
                pinyin
              );
            } else {
              this.ui.displayPopup(translatedText, '', "King1x32 <3");
            }
          } else {
            this.ui.showTranslationBelow(translatedText, targetElement, text);
          }
        }
        return translatedText;
      } catch (error) {
        console.error("Error translation:", error);
        this.ui.showNotification(error.message, "error");
      }
    }
    async translateFile(file) {
      try {
        if (!this.fileManager.isValidFormat(file)) {
          throw new Error(this._("notifications.unsupport_file") + ' txt, srt, vtt, pdf, html, md, json');
        }
        if (!this.fileManager.isValidSize(file)) {
          throw new Error(this._("notifications.file_too_large"));
        }
        return await this.fileManager.processFile(file);
      } catch (error) {
        throw new Error(this._("notifications.file_translation_error") + ` ${error.message}`);
      }
    }
    //     async detectContext(text) {
    //       const prompt = `Analyze the context and writing style of this text and return JSON format with these properties:
    // - style: formal/informal/technical/casual
    // - tone: professional/friendly/neutral/academic
    // - domain: general/technical/business/academic/other
    // Text: "${text}"`;
    //       try {
    //         const analysis = await this.translator.api.request(prompt, "page");
    //         const result = JSON.parse(analysis);
    //         return {
    //           style: result.style,
    //           tone: result.tone,
    //           domain: result.domain
    //         };
    //       } catch (error) {
    //         console.error("Context detection failed:", error);
    //         return {
    //           style: "neutral",
    //           tone: "neutral",
    //           domain: "general"
    //         };
    //       }
    //     }
    // async autoCorrect(translation) {
    //   const targetLanguage =
    //     this.userSettings.settings.displayOptions.targetLanguage;
    //   const prompt = `Vui lòng kiểm tra và sửa chữa bất kỳ lỗi ngữ pháp hoặc vấn đề về ngữ cảnh trong bản dịch sang ngôn ngữ có mã ngôn ngữ là '${targetLanguage}' này: "${translation}". Không thêm hay bớt ý của bản gốc cũng như không thêm tiêu đề, không giải thích về các thay đổi đã thực hiện.`;
    //   try {
    //     const corrected = await this.api.request(prompt, 'page');
    //     return corrected;
    //   } catch (error) {
    //     console.error("Auto-correction failed:", error);
    //     return translation;
    //   }
    // }
    createPrompt(text, type = "normal", targetLang = "") {
      const docTitle = `"${document.title}"`;
      const settings = this.userSettings.settings;
      const targetLanguage =
        targetLang || settings.displayOptions.targetLanguage;
      const sourceLanguage = settings.displayOptions.sourceLanguage === 'auto' ? this.page.languageCode : settings.displayOptions.sourceLanguage;
      const isPinyinMode =
        settings.displayOptions.translationMode !== "translation_only";
      if (
        settings.promptSettings?.enabled &&
        settings.promptSettings?.useCustom
      ) {
        const prompts = settings.promptSettings.customPrompts;
        const promptKey = isPinyinMode ? `${type}_chinese` : type;
        let promptTemplate = prompts[promptKey];
        if (promptTemplate) {
          return promptTemplate
            .replace(/{text}/g, text)
            .replace(/{docTitle}/g, docTitle)
            .replace(/{targetLang}/g, targetLanguage)
            .replace(
              /{sourceLang}/g,
              sourceLanguage || this.page.languageCode
            );
        }
      }
      // if (settings.apiProvider === 'ollama') return `Translate to '${targetLanguage}':\n  "${text}"`;
      return this.createDefaultPrompt(text, type, isPinyinMode, targetLanguage);
    }
    createDefaultPrompt(
      text,
      type = "normal",
      isPinyinMode = false,
      targetLang = ""
    ) {
      const docTitle = `và tiêu đề "${document.title}"` || '';
      const settings = this.userSettings.settings;
      const targetLanguage = targetLang || settings.displayOptions.targetLanguage;
      const share_per = `  - Ngôn ngữ đích: '${targetLanguage}'.
  - Dựa vào ngữ cảnh, bối cảnh ${docTitle} để xác định phong cách dịch.
  - Đảm bảo nghĩa của các câu không bị thay đổi khi dịch.
  - Sử dụng các từ lóng hoặc cụm từ thông dụng khi cần thiết để bản dịch gần gũi với người đọc.
  - Kiểm tra chính tả và ngữ pháp trong bản dịch.
  - Thêm các trợ từ ngôn ngữ có mã ngôn ngữ là '${targetLanguage}' khi cần để câu văn hoàn chỉnh hơn.
  - Sử dụng đại từ nhân xưng ngôn ngữ có mã ngôn ngữ là '${targetLanguage}' tự nhiên và hợp ngữ cảnh.
  - Tham khảo các trang web sau để lấy văn phong phù hợp cho các đoạn truyện liên quan đến sex: [ truyensex.moe, truyensexvn.org, truyensex.vip, truyensextv69.com ].
`;
      const share_normal = `Bạn là người dịch thuật chuyên nghiệp, chuyên tạo bản dịch chính xác và tự nhiên. Hãy dịch văn bản cần xử lý ${docTitle} sang ngôn ngữ có mã ngôn ngữ là '${targetLanguage}' với các yêu cầu sau:
  - Ngôn ngữ đích: '${targetLanguage}'.
  - Dựa vào ngữ cảnh, bối cảnh ${docTitle} để xác định phong cách dịch.
  - Dịch phải tuân thủ chặt chẽ bối cảnh và sắc thái ban đầu của văn bản.
  - Đảm bảo sự lưu loát và tự nhiên như người bản xứ.
  - Không thêm bất kỳ giải thích hay diễn giải nào ngoài bản dịch.
  - Bảo toàn các thuật ngữ và danh từ riêng với tỷ lệ 1:1.
Nếu bạn nhận thấy văn bản là truyện thì hãy dịch truyện theo yêu cầu sau:
  Bạn là một người dịch truyện chuyên nghiệp, chuyên tạo bản dịch chính xác và tự nhiên. Bạn cần dịch một đoạn truyện ${docTitle} sang ngôn ngữ có mã ngôn ngữ là '${targetLanguage}'. Hãy đảm bảo rằng bản dịch của bạn giữ nguyên ý nghĩa của câu gốc và phù hợp với văn phong của ngôn ngữ đích. Khi dịch, hãy chú ý đến ngữ cảnh văn hóa và bối cảnh của câu chuyện để người đọc có thể hiểu chính xác nội dung. Các quy tắc quan trọng bạn cần tuân thủ bao gồm:
${share_per}
`;
      const note_normal = `Lưu ý:
  - Bản dịch phải hoàn toàn là ngôn ngữ có mã ngôn ngữ là '${targetLanguage}', nhưng ví dụ khi dịch sang tiếng Việt nếu gặp những danh từ riêng chỉ địa điểm hoặc tên riêng, có phạm trù trong ngôn ngữ là từ ghép của 2 ngôn ngữ gọi là từ Hán Việt, hãy dịch sang nghĩa từ Hán Việt như Diệp Trần, Lục Thiếu Du, Long kiếm, Thiên kiếp, núi Long Sĩ Đầu, ngõ Nê Bình, Thiên Kiếm môn,... thì sẽ hay hơn là dịch hẳn sang nghĩa tiếng Việt là Lá Trần, Rồng kiếm, Trời kiếp, núi Rồng Ngẩng Đầu,...
  - Hãy in ra bản dịch mà không có dấu ngoặc kép, giữ nguyên định dạng phông chữ ban đầu và không giải thích gì thêm.
`;
      const share_text = `Văn bản cần dịch:
\`\`\`
  ${text}
\`\`\`
`;
      const share_ocr = `Bạn là một người dịch truyện chuyên nghiệp, chuyên tạo bản dịch chính xác và tự nhiên. Bạn cần dịch một đoạn truyện ${docTitle} sang ngôn ngữ có mã ngôn ngữ là '${targetLanguage}'. Hãy đảm bảo rằng bản dịch của bạn giữ nguyên ý nghĩa của câu gốc và phù hợp với văn phong của ngôn ngữ đích. Khi dịch, hãy chú ý đến ngữ cảnh văn hóa và bối cảnh của câu chuyện để người đọc có thể hiểu chính xác nội dung. Các quy tắc quan trọng bạn cần tuân thủ bao gồm:
${share_per}
`;
      const share_media = `Bạn là một người dịch phụ đề phim chuyên nghiệp, chuyên tạo file SRT. Bạn cần dịch một đoạn hội thoại phim ${docTitle} sang ngôn ngữ có mã ngôn ngữ là '${targetLanguage}'. Hãy đảm bảo rằng bản dịch của bạn chính xác và tự nhiên, giữ nguyên ý nghĩa của câu gốc. Khi dịch, hãy chú ý đến ngữ cảnh văn hóa và bối cảnh của bộ phim để người xem có thể hiểu chính xác nội dung. Các quy tắc quan trọng bạn cần tuân thủ bao gồm:
${share_per}
`;
      const share_pinyin = `
Hãy trả về theo format sau, mỗi phần cách nhau bằng dấu <|> và không giải thích thêm:
  Văn bản gốc <|> phiên âm IPA <|> bản dịch sang ngôn ngữ có mã ngôn ngữ là '${targetLanguage}'
  Ví dụ: Hello <|> heˈloʊ <|> Xin chào
`;
      const note_pinyin = `Lưu ý:
  - Nếu có từ là tiếng Trung, hãy trả về giá trị phiên âm của từ đó chính là pinyin + số tone (1-4) của từ đó. Ví dụ: 你好 <|> Nǐ3 hǎo3 <|> Xin chào
  - Bản dịch phải hoàn toàn là ngôn ngữ có mã ngôn ngữ là '${targetLanguage}', nhưng ví dụ khi dịch sang tiếng Việt nếu gặp những danh từ riêng chỉ địa điểm hoặc tên riêng, có phạm trù trong ngôn ngữ là từ ghép của 2 ngôn ngữ gọi là từ Hán Việt, hãy dịch sang nghĩa từ Hán Việt như Diệp Trần, Lục Thiếu Du, Long kiếm, Thiên kiếp, núi Long Sĩ Đầu, ngõ Nê Bình, Thiên Kiếm môn,... thì sẽ hay hơn là dịch hẳn sang nghĩa tiếng Việt là Lá Trần, Rồng kiếm, Trời kiếp, núi Rồng Ngẩng Đầu,...
  - Chỉ trả về bản dịch theo format trên, mỗi 1 cụm theo format sẽ ở 1 dòng, giữ nguyên định dạng phông chữ ban đầu và không giải thích thêm.
`;
      const basePrompts = {
        normal: `${share_normal}
${note_normal}
${share_text}`,
        advanced: `Dịch và phân tích từ khóa: ${text}`,
        ocr: `${share_ocr}
Lưu ý:
  - Bản dịch phải hoàn toàn là ngôn ngữ có mã ngôn ngữ là '${targetLanguage}', nhưng ví dụ khi dịch sang tiếng Việt nếu gặp những danh từ riêng chỉ địa điểm hoặc tên riêng, có phạm trù trong ngôn ngữ là từ ghép của 2 ngôn ngữ gọi là từ Hán Việt, hãy dịch sang nghĩa từ Hán Việt như Diệp Trần, Lục Thiếu Du, Long kiếm, Thiên kiếp, núi Long Sĩ Đầu, ngõ Nê Bình, Thiên Kiếm môn,... thì sẽ hay hơn là dịch hẳn sang nghĩa tiếng Việt là Lá Trần, Rồng kiếm, Trời kiếp, núi Rồng Ngẩng Đầu,..
  - Đọc hiểu thật kĩ và xử lý toàn bộ văn bản trong hình ảnh.
  - Chỉ trả về bản dịch, không giải thích.`,
        media: `${share_media}
Lưu ý:
  - Bản dịch phải hoàn toàn là ngôn ngữ có mã ngôn ngữ là '${targetLanguage}', nhưng ví dụ khi dịch sang tiếng Việt nếu gặp những danh từ riêng chỉ địa điểm hoặc tên riêng, có phạm trù trong ngôn ngữ là từ ghép của 2 ngôn ngữ gọi là từ Hán Việt, hãy dịch sang nghĩa từ Hán Việt như Diệp Trần, Lục Thiếu Du, Long kiếm, Thiên kiếp, núi Long Sĩ Đầu, ngõ Nê Bình, Thiên Kiếm môn,... thì sẽ hay hơn là dịch hẳn sang nghĩa tiếng Việt là Lá Trần, Rồng kiếm, Trời kiếp, núi Rồng Ngẩng Đầu,..
  - Định dạng bản dịch của bạn theo định dạng SRT và đảm bảo rằng mỗi đoạn hội thoại có ít nhất 4 dòng bao gồm dòng được đánh số thứ tự, dòng có thời gian bắt đầu và kết thúc rõ ràng, dòng nội dung bản dịch và dòng trống để tách các phần số thứ tự hội thoại ở trên.
  - Chỉ trả về bản dịch, không giải thích.`,
        page: `Bạn là một người dịch thuật chuyên nghiệp, chuyên xử lý các đoạn văn bản HTML. Bạn sẽ nhận được một chuỗi JSON chứa một mảng các đối tượng, mỗi đối tượng có "id" (chỉ số) và "text" (nội dung cần dịch).\n
Nhiệm vụ của bạn là dịch trường "text" của MỖI đối tượng sang ngôn ngữ có mã là '${targetLanguage}'.\n
Các quy tắc BẮT BUỘC:
1.  **Định dạng đầu ra:** Phản hồi của bạn PHẢI là một chuỗi JSON hợp lệ DUY NHẤT, chứa một mảng các đối tượng.
2.  **Cấu trúc đối tượng:** Mỗi đối tượng trong mảng trả về PHẢI chứa hai trường: "id" (số nguyên, giữ nguyên từ đầu vào) và "translation" (chuỗi, là văn bản đã dịch).
3.  **Toàn vẹn dữ liệu:** KHÔNG được bỏ sót, gộp hoặc thay đổi thứ tự bất kỳ "id" nào từ đầu vào. Số lượng đối tượng trong mảng đầu ra PHẢI bằng số lượng đối tượng trong mảng đầu vào.
4.  **Không có nội dung thừa:** Phản hồi của bạn KHÔNG được chứa bất kỳ văn bản, giải thích, ghi chú, hay định dạng markdown nào (như \`\`\`json) bên ngoài chuỗi JSON.\n
Yêu cầu về chất lượng dịch thuật:
-   Ngôn ngữ đích: '${targetLanguage}'.
-   Sử dụng văn phong tự nhiên, phù hợp với ngữ cảnh của trang web có tiêu đề ${docTitle}.
-   Đối với tiếng Việt, giữ nguyên các danh từ riêng, tên Hán Việt (ví dụ: Diệp Trần, Thiên Kiếm môn) thay vì dịch thuần Việt (Lá Trần, Cổng Gươm Trời).
\nVí dụ đầu vào:
\`\`\`json
[
  {"id": 0, "text": "Hello world"},
  {"id": 1, "text": "This is a test."}
]
\`\`\`
\nVí dụ đầu ra mong muốn (dịch sang 'vi'):
\`\`\`json
[
  {"id": 0, "translation": "Xin chào thế giới"},
  {"id": 1, "translation": "Đây là một bài kiểm tra."}
]
\`\`\`
\nBây giờ, hãy xử lý chuỗi JSON sau:
${text}`,
        page_fallback: `Vui lòng dịch đoạn văn bản sau sang ngôn ngữ có mã là '${targetLanguage}'. Chỉ trả về duy nhất bản dịch, không thêm bất kỳ giải thích hay định dạng nào khác.
${share_text}`,
        file_content: `Bạn là một trợ lý dịch thuật chuyên nghiệp. Hãy dịch nội dung của tệp này sang ngôn ngữ có mã là '${targetLanguage}'. Cung cấp bản dịch toàn diện và chính xác của toàn bộ tài liệu/nội dung phương tiện, bảo toàn mọi thông tin và cấu trúc quan trọng.
Lưu ý:
- Chỉ trả về bản dịch hoàn chỉnh mà không có bất kỳ giải thích, tiêu đề hay văn bản bổ sung nào.
- Đảm bảo bản dịch có văn phong phù hợp với loại nội dung của tệp (ví dụ: formal cho tài liệu, conversational cho audio/video).`,
      };
      const pinyinPrompts = {
        normal: `${share_normal}
${share_pinyin}
${note_pinyin}
${share_text}`,
        advanced: `Dịch và phân tích từ khóa: ${text}`,
        ocr: `${share_ocr}
${share_pinyin}
${note_pinyin}
Đọc hiểu thật kĩ và xử lý toàn bộ văn bản trong hình ảnh.`,
        media: `${share_media}
Lưu ý:
  - Bản dịch phải hoàn toàn là ngôn ngữ có mã ngôn ngữ là '${targetLanguage}', nhưng ví dụ khi dịch sang tiếng Việt nếu gặp những danh từ riêng chỉ địa điểm hoặc tên riêng, có phạm trù trong ngôn ngữ là từ ghép của 2 ngôn ngữ gọi là từ Hán Việt, hãy dịch sang nghĩa từ Hán Việt như Diệp Trần, Lục Thiếu Du, Long kiếm, Thiên kiếp, núi Long Sĩ Đầu, ngõ Nê Bình, Thiên Kiếm môn,... thì sẽ hay hơn là dịch hẳn sang nghĩa tiếng Việt là Lá Trần, Rồng kiếm, Trời kiếp, núi Rồng Ngẩng Đầu,..
  - Định dạng bản dịch của bạn theo định dạng SRT và đảm bảo rằng mỗi đoạn hội thoại có ít nhất 4 dòng bao gồm dòng được đánh số thứ tự, dòng có thời gian bắt đầu và kết thúc rõ ràng, dòng nội dung bản dịch và dòng trống để tách các phần số thứ tự hội thoại ở trên.
  - Chỉ trả về bản dịch, không giải thích.`,
        page: `Bạn là một người dịch thuật ngôn ngữ chuyên sâu. Bạn sẽ nhận được một chuỗi JSON chứa một mảng các đối tượng, mỗi đối tượng có "id" và "text".\n
Nhiệm vụ của bạn là xử lý MỖI đối tượng và trả về: văn bản gốc, phiên âm IPA (hoặc Pinyin cho tiếng Trung), và bản dịch sang ngôn ngữ có mã là '${targetLanguage}'.\n
Các quy tắc BẮT BUỘC:
1.  **Định dạng đầu ra:** Phản hồi của bạn PHẢI là một chuỗi JSON hợp lệ DUY NHẤT, chứa một mảng các đối tượng.
2.  **Cấu trúc đối tượng:** Mỗi đối tượng trong mảng trả về PHẢI chứa bốn trường: "id" (giữ nguyên), "original" (văn bản gốc), "ipa" (phiên âm), và "translation" (bản dịch).
3.  **Toàn vẹn dữ liệu:** KHÔNG được bỏ sót, gộp hoặc thay đổi thứ tự bất kỳ "id" nào. Số lượng đối tượng trả về PHẢI bằng số lượng đối tượng đầu vào.
4.  **Không có nội dung thừa:** Phản hồi của bạn KHÔNG được chứa bất kỳ văn bản, giải thích, hay định dạng markdown nào (như \`\`\`json) bên ngoài chuỗi JSON.
5.  **Quy tắc phiên âm:**
    -   Đối với tiếng Trung: "ipa" phải là Pinyin kèm dấu thanh (ví dụ: "Nǐ hǎo").
    -   Đối với các ngôn ngữ khác: "ipa" phải là phiên âm IPA (ví dụ: "həˈloʊ").
\nVí dụ đầu vào:
\`\`\`json
[
  {"id": 0, "text": "Hello world"},
  {"id": 1, "text": "你好"}
]
\`\`\`
\nVí dụ đầu ra mong muốn (dịch sang 'vi'):
\`\`\`json
[
  {"id": 0, "original": "Hello world", "ipa": "həˈloʊ wɜːrld", "translation": "Xin chào thế giới"},
  {"id": 1, "original": "你好", "ipa": "Nǐ hǎo", "translation": "Xin chào"}
]
\`\`\`
\nBây giờ, hãy xử lý chuỗi JSON sau:
${text}`,
        page_fallback: `Vui lòng cung cấp văn bản gốc, phiên âm, và bản dịch sang ngôn ngữ '${targetLanguage}' cho văn bản sau.
- Đối với tiếng Trung, phiên âm là Pinyin có dấu.
- Đối với các ngôn ngữ khác, phiên âm là IPA.
- Trả lời theo định dạng nghiêm ngặt: Văn bản gốc <|> Phiên âm <|> Bản dịch
- KHÔNG thêm bất kỳ giải thích nào.
${share_text}`,
        file_content: `Bạn là một trợ lý dịch thuật chuyên nghiệp. Hãy dịch nội dung của tệp này sang ngôn ngữ có mã là '${targetLanguage}'. Cung cấp bản dịch toàn diện và chính xác của toàn bộ tài liệu/nội dung phương tiện, bảo toàn mọi thông tin và cấu trúc quan trọng.
Hãy trả về theo format sau, mỗi phần cách nhau bằng dấu <|> và không giải thích thêm:
Văn bản gốc <|> phiên âm IPA <|> bản dịch sang ngôn ngữ có mã ngôn ngữ là '${targetLanguage}'
Lưu ý:
- Nếu có từ là tiếng Trung, hãy trả về giá trị phiên âm của từ đó chính là pinyin + số tone (1-4) của từ đó.
- Chỉ trả về bản dịch hoàn chỉnh theo format trên mà không có bất kỳ giải thích, tiêu đề hay văn bản bổ sung nào.
- Đảm bảo bản dịch có văn phong phù hợp với loại nội dung của tệp (ví dụ: formal cho tài liệu, conversational cho audio/video).`,
      };
      return isPinyinMode ? (pinyinPrompts[type] || basePrompts[type]) : basePrompts[type];
    }
    showSettingsUI() {
      const settingsUI = this.userSettings.createSettingsUI();
      this.uiRoot.getRoot().appendChild(settingsUI);
    }
    getRootContainer() {
      return this.uiRoot ? this.uiRoot.container : null;
    }
    cleanup() {
      console.log("Cleaning up Translator instance...");
      if (this.uiRoot) this.uiRoot.cleanup();
      if (this.ui) this.ui.cleanup();
      if (this.input) this.input.cleanup();
      if (this.videoStreaming) this.videoStreaming.cleanup();
      window.translatorInstance = null;
    }
  }
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
