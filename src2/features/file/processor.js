  class FileProcessor {
    constructor(translator) {
      this.translator = translator;
      this.uploader = new FileUploader(this.translator.userSettings);
      this.settings = this.translator.userSettings.settings;
      this._ = this.translator.userSettings._;
    }
    checkFileSizeLimit(file, fileType) {
      let type = 'document';
      if (fileType.startsWith('image/')) type = 'image';
      else if (fileType.startsWith('video/')) type = 'video';
      else if (fileType.startsWith('audio/')) type = 'audio';
      const maxSize = CONFIG.API.providers.gemini.limits.maxUploadSize[type];
      if (file.size > maxSize) {
        throw new Error(this._("notifications.file_too_large") + ` ${type}: ${maxSize / (1024 * 1024)}MB`);
      }
    }
    async fileToBase64(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = () => reject(new Error((this._("notifications.failed_read_file"))));
        reader.readAsDataURL(file);
      });
    }
    async fetchUrlAsFile(url, mimeType, filename = 'king1x32_file_from_url') {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'GET',
          url: url,
          responseType: 'arraybuffer',
          anonymous: true,
          onload: (response) => {
            if (response.status >= 200 && response.status < 300) {
              const blob = new Blob([response.response], { type: mimeType });
              resolve(new File([blob], filename, { type: mimeType, lastModified: Date.now() }));
            } else {
              reject(new Error(`${this._("notifications.request_failed")} ${response.status} ${response.statusText}`));
            }
          },
          onerror: (error) => {
            reject(new Error(`${this._("notifications.network_error")}: ${error.message || 'Unknown network error'}`));
          }
        });
      });
    }
    async processFile(fileOrUrl, prompt) {
      const apiProvider = this.settings.apiProvider;
      const apiConfig = CONFIG.API.providers[apiProvider];
      let actualFile = null;
      let filename = 'king1x32_file';
      if (typeof fileOrUrl === 'string') {
        const url = fileOrUrl;
        let mimeType = 'application/octet-stream';
        try {
          const headResponse = await new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
              method: 'HEAD',
              url: url,
              onload: resp => resolve(resp),
              onerror: err => reject(err),
              anonymous: true,
              nocache: true
            });
          });
          const contentTypeHeader = headResponse.responseHeaders.match(/content-type: (.*?)(?:\r\n|$)/i);
          if (contentTypeHeader) {
            mimeType = contentTypeHeader[1].split(';')[0].trim();
          }
          const urlParts = url.split('/');
          filename = urlParts[urlParts.length - 1].split('?')[0].split('#')[0] || 'file_from_url';
        } catch (e) {
          console.warn(`Không thể lấy MIME type cho URL ${url}, đang suy luận từ phần mở rộng. Lỗi:`, e);
          const urlParts = url.split('.');
          if (urlParts.length > 1) {
            const ext = urlParts.pop().toLowerCase();
            const mimeMap = {
              'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png', 'gif': 'image/gif', 'webp': 'image/webp',
              'mp4': 'video/mp4', 'webm': 'video/webm', 'mov': 'video/quicktime',
              'mp3': 'audio/mp3', 'wav': 'audio/wav', 'ogg': 'audio/ogg', 'm4a': 'audio/mp4',
              'pdf': 'application/pdf', 'txt': 'text/plain', 'html': 'text/html', 'json': 'application/json',
              'xml': 'application/xml', 'csv': 'text/csv', 'md': 'text/markdown',
              'doc': 'application/msword', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              'xls': 'application/vnd.ms-excel', 'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'ppt': 'application/vnd.ms-powerpoint', 'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            };
            mimeType = mimeMap[ext] || 'application/octet-stream';
          }
        }
        this.translator.ui.showProcessingStatus(this._("notifications.processing_url"));
        try {
          actualFile = await this.fetchUrlAsFile(url, mimeType, filename);
        } catch (fetchError) {
          throw new Error(`${this._("notifications.failed_read_file")}: ${fetchError.message}`);
        } finally {
          setTimeout(() => this.translator.ui.removeProcessingStatus(), 1000);
        }
      } else {
        actualFile = fileOrUrl;
        filename = fileOrUrl.name;
      }
      if (!actualFile) {
        throw new Error("Không có nội dung file để xử lý sau khi đọc.");
      }
      const fileType = actualFile.type;
      if (apiProvider === 'gemini') {
        this.checkFileSizeLimit(actualFile, fileType);
        if (actualFile.size <= apiConfig.limits.maxDirectSize) {
          const base64 = await this.fileToBase64(actualFile);
          return {
            content: [
              { text: prompt },
              { inline_data: { mime_type: fileType, data: base64 } }
            ],
          };
        } else {
          const fileUriInfo = await this.uploader.uploadLargeFile(actualFile);
          return {
            content: [
              { text: prompt },
              { file_data: { mime_type: fileType, file_uri: fileUriInfo.uri } }
            ],
            key: fileUriInfo.key
          };
        }
      } else {
        const base64 = await this.fileToBase64(actualFile);
        return {
          content: apiConfig.createBinaryParts(prompt, fileType, base64),
        };
      }
    }
  }
  const RELIABLE_FORMATS = {
    text: {
      maxSize: 10 * 1024 * 1024,
      formats: [
        { ext: 'txt', mime: 'text/plain' },
        { ext: 'srt', mime: 'application/x-subrip' },
        { ext: 'vtt', mime: 'text/vtt' }, // Phụ đề web
        { ext: 'pdf', mime: 'application/pdf' },
        { ext: 'html', mime: 'text/html' },
        { ext: 'md', mime: 'text/markdown' },
        { ext: 'json', mime: 'application/json' }
      ]
    }
  };
