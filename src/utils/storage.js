// Auto-generated from King-Translator-AI.user.js
// Storage utilities

  function safeLocalStorageGet(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn(`King Translator: Could not access localStorage.getItem for key "${key}". Reason:`, e.message);
      return null;
    }
  }
  function safeLocalStorageSet(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`King Translator: Could not access localStorage.setItem for key "${key}". Reason:`, e.message);
    }
  }
  function safeLocalStorageRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      console.warn(`King Translator: Could not access localStorage.removeItem for key "${key}". Reason:`, e.message);
    }
  }
  function createElementFromHTML(htmlString) {


export { safeLocalStorageGet, safeLocalStorageSet, safeLocalStorageRemove };
