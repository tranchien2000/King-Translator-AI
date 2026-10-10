  class FileUploader {
    constructor(settings) {
      this.settings = settings.settings;
      this._ = settings._;
    }
    async getUploadUrl(file) {
      const apiKeys = this.settings.apiKey[this.settings.apiProvider];
      const errors = [];
      let startIndex = Math.floor(Math.random() * apiKeys.length);
      for (let i = 0; i < apiKeys.length; i++) {
        const currentIndex = (startIndex + i) % apiKeys.length;
        const key = apiKeys[currentIndex];
        try {
          return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
              method: 'POST',
              url: `${CONFIG.API.providers.gemini.uploadUrl}?key=${key}`,
              headers: {
                'X-Goog-Upload-Protocol': 'resumable',
                'X-Goog-Upload-Command': 'start',
                'X-Goog-Upload-Header-Content-Length': file.size,
                'X-Goog-Upload-Header-Content-Type': file.type,
                'Content-Type': 'application/json'
              },
              data: JSON.stringify({
                file: {
                  display_name: file.name
                }
              }),
              onload: (response) => {
                const uploadUrl = response.responseHeaders.match(/x-goog-upload-url: (.*)/i)?.[1];
                if (!uploadUrl) reject(new Error(this._("notifications.upl_url")));
                resolve({
                  url: uploadUrl,
                  key: key,
                });
              },
              onerror: (error) => reject(error)
            });
          });
        } catch (error) {
          errors.push(`Key ${key.slice(0, 8)}... : ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }
      }
      if (errors.length > 0) {
        throw new Error(this._("notifications.all_keys_failed") + `${errors.join('\n')}`);
      }
    }
    async uploadFile(uploadUrl, file) {
      return new Promise((resolve, reject) => {
        GM_xmlhttpRequest({
          method: 'POST',
          url: uploadUrl.url,
          headers: {
            'Content-Length': file.size,
            'X-Goog-Upload-Offset': '0',
            'X-Goog-Upload-Command': 'upload, finalize'
          },
          data: file,
          onload: (response) => {
            const result = JSON.parse(response.responseText);
            if (!result.file?.uri) reject(new Error(this._("notifications.upl_uri")));
            resolve({
              uri: result.file.uri,
              key: uploadUrl.key,
            });
          },
          onerror: (error) => reject(error)
        });
      });
    }
    async uploadLargeFile(file) {
      try {
        const uploadUrl = await this.getUploadUrl(file);
        return await this.uploadFile(uploadUrl, file);
      } catch (error) {
        console.error('Upload failed:', error);
        throw new Error(this._("notifications.upl_fail"));
      }
    }
  }
