  class APIKeyManager {
    constructor(settings, _) {
      this.settings = settings;
      this._ = _;
      this.failedKeys = new Map();
      this.activeKeys = new Map();
      this.keyStats = new Map();
      this.rateLimitedKeys = new Map();
      this.keyRotationInterval = 10000; // 10s
      this.maxConcurrentRequests = 5;
      this.retryDelays = [1000, 2000, 4000];
      this.successRateThreshold = 0.7;
      this.lastSuccessfulIndex = null;
      this.setupKeyRotation();
    }
    markKeyAsRateLimited(key) {
      const now = Date.now();
      this.rateLimitedKeys.set(key, {
        timestamp: now,
        retryAfter: now + this.settings.rateLimit.perMilliseconds
      });
    }
    getAvailableKeys(provider) {
      const allKeys = this.settings.apiKey[provider];
      if (!allKeys || allKeys.length === 0) {
        throw new Error(this._("notifications.no_api_key_configured"));
      }
      const now = Date.now();
      const availableKeys = allKeys.filter(key => {
        if (!key) return false;
        const failedInfo = this.failedKeys.get(key);
        const activeInfo = this.activeKeys.get(key);
        const rateLimitInfo = this.rateLimitedKeys.get(key);
        const stats = this.keyStats.get(key);
        const isFailed = failedInfo && (now - failedInfo.timestamp < 60000);
        const isBusy = activeInfo && (activeInfo.requests >= this.maxConcurrentRequests);
        const isRateLimited = rateLimitInfo && (now < rateLimitInfo.retryAfter);
        const hasLowSuccessRate = stats &&
          stats.total > 10 &&
          (stats.success / stats.total) < this.successRateThreshold;
        return !isFailed && !isBusy && !isRateLimited && !hasLowSuccessRate;
      });
      if (this.lastSuccessfulIndex !== null && availableKeys.length > 1) {
        const lastKey = allKeys[this.lastSuccessfulIndex];
        if (availableKeys.includes(lastKey)) {
          const currentIndex = availableKeys.indexOf(lastKey);
          if (currentIndex !== -1) {
            availableKeys.splice(currentIndex, 1);
            availableKeys.push(lastKey);
          }
        }
      }
      return availableKeys;
    }
    async executeWithMultipleKeys(promiseGenerator, provider, maxConcurrent = 3) {
      const availableKeys = this.getAvailableKeys(provider);
      if (!availableKeys || availableKeys.length === 0) {
        throw new Error(this._("notifications.no_api_key_available"));
      }
      const errors = [];
      const promises = [];
      let currentKeyIndex = 0;
      const processRequest = async () => {
        if (currentKeyIndex >= availableKeys.length) return null;
        const key = availableKeys[++currentKeyIndex];
        try {
          const result = await this.useKey(key, () => promiseGenerator(key));
          if (result) {
            this.updateKeyStats(key, true);
            return { status: "fulfilled", value: result };
          }
        } catch (error) {
          this.updateKeyStats(key, false);
          if (error.status === 401) {
            this.markKeyAsFailed(key);
            errors.push(`API key ${key.slice(0, 8)}... invalid`);
          } else if (error.status === 429) {
            this.markKeyAsRateLimited(key);
            errors.push(`API key ${key.slice(0, 8)}... is rate-limitd`);
          } else {
            errors.push(`API key ${key.slice(0, 8)}... : ${error.message}`);
          }
          if (currentKeyIndex < availableKeys.length) {
            return processRequest();
          }
          return { status: "rejected", reason: error };
        }
      };
      const maxParallel = Math.min(maxConcurrent, availableKeys.length);
      for (let i = 0; i < maxParallel; i++) {
        promises.push(processRequest());
      }
      const results = await Promise.all(promises);
      const successResults = results
        .filter(r => r && r.status === "fulfilled")
        .map(r => r.value);
      if (successResults.length > 0) {
        return successResults;
      }
      const errorGroups = {
        invalid: errors.filter(e => e.includes("invalid")),
        rateLimit: errors.filter(e => e.includes("rate-limitd")),
        other: errors.filter(e => !e.includes("invalid") && !e.includes("rate-limitd"))
      };
      let errorMessage = this._("notifications.all_keys_failed");
      if (errorGroups.invalid.length > 0) {
        errorMessage += "\nInvalid API key:\n" + errorGroups.invalid.join("\n");
      }
      if (errorGroups.rateLimit.length > 0) {
        errorMessage += "\nAPI key rate limited:\n" + errorGroups.rateLimit.join("\n");
      }
      if (errorGroups.other.length > 0) {
        errorMessage += "\nOther errors:\n" + errorGroups.other.join("\n");
      }
      throw new Error(errorMessage);
    }
    async useKey(key, action) {
      let activeInfo = this.activeKeys.get(key) || { requests: 0, timestamp: Date.now() };
      const rateLimitInfo = this.rateLimitedKeys.get(key);
      if (rateLimitInfo && Date.now() < rateLimitInfo.retryAfter) {
        throw new Error(`API key ${key.slice(0, 8)}... is rate-limited. Retrying in ${Math.ceil((rateLimitInfo.retryAfter - Date.now()) / 1000)}s`);
      }
      if (activeInfo.requests >= this.maxConcurrentRequests) {
        throw new Error(`API key ${key.slice(0, 8)}... ` + this._("notifications.too_many_requests"));
      }
      activeInfo.requests++;
      this.activeKeys.set(key, activeInfo);
      try {
        return await action();
      } catch (error) {
        if (error.status === 429) {
          const retryAfter = Date.now() + (parseInt(error.headers?.['retry-after']) * 1000 || 60000);
          this.rateLimitedKeys.set(key, { retryAfter });
          throw new Error(`Rate limitd: ${error.message}`);
        }
        throw error;
      } finally {
        activeInfo = this.activeKeys.get(key);
        if (activeInfo) {
          activeInfo.requests--;
          if (activeInfo.requests <= 0) {
            this.activeKeys.delete(key);
          } else {
            this.activeKeys.set(key, activeInfo);
          }
        }
      }
    }
    markKeyAsFailed(key) {
      if (!key) return;
      const failInfo = this.failedKeys.get(key) || { failures: 0 };
      failInfo.failures++;
      failInfo.timestamp = Date.now();
      this.failedKeys.set(key, failInfo);
      if (this.activeKeys.has(key)) {
        this.activeKeys.delete(key);
      }
      this.updateKeyStats(key, false);
      console.log(`Marked key as failed: ${key.slice(0, 8)}... (${failInfo.failures} failures)`);
    }
    updateKeyStats(key, success) {
      const stats = this.keyStats.get(key) || {
        success: 0,
        fails: 0,
        total: 0,
        lastUsed: 0,
        avgResponseTime: 0
      };
      stats.total++;
      if (success) {
        stats.success++;
      } else {
        stats.fails++;
      }
      stats.lastUsed = Date.now();
      this.keyStats.set(key, stats);
    }
    setupKeyRotation() {
      setInterval(() => {
        const now = Date.now();
        for (const [key, info] of this.rateLimitedKeys.entries()) {
          if (now >= info.retryAfter) {
            this.rateLimitedKeys.delete(key);
          }
        }
        for (const [key, info] of this.failedKeys.entries()) {
          if (now - info.timestamp >= 60000) {
            this.failedKeys.delete(key);
          }
        }
        for (const [key, info] of this.activeKeys.entries()) {
          if (now - info.timestamp >= 30000) {
            info.requests = 0;
            this.activeKeys.set(key, info);
          }
        }
        for (const [key, stats] of this.keyStats.entries()) {
          if (now - stats.lastUsed > 3600000) {
            stats.success = Math.floor(stats.success * 0.9);
            stats.total = Math.floor(stats.total * 0.9);
            this.keyStats.set(key, stats);
          }
        }
      }, this.keyRotationInterval);
    }
  }
