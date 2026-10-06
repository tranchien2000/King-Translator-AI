  function createElementFromHTML(htmlString) {
    const cleanString = htmlString.trim();
    try {
      const template = document.createElement('template');
      template.innerHTML = cleanString;
      if (template.content.firstChild) {
        return template.content.firstChild;
      }
    } catch (e) {
    }
    try {
      const wrappedString = `<svg xmlns="http://www.w3.org/2000/svg"><foreignObject width="100%" height="100%"><div xmlns="http://www.w3.org/1999/xhtml">${cleanString}</div></foreignObject></svg>`;
      const doc = new DOMParser().parseFromString(wrappedString, 'image/svg+xml');
      const foreignObject = doc.querySelector('foreignObject');
      if (foreignObject && foreignObject.firstChild && foreignObject.firstChild.firstChild) {
        return foreignObject.firstChild.firstChild;
      }
    } catch (e) {
      console.error("King Translator: DOMParser with SVG trick also failed.", e);
    }
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = cleanString;
      return tempDiv.firstChild;
    } catch (e) {
      console.error("King Translator: All methods to create element from HTML failed.", e);
    }
    return null;
  }
