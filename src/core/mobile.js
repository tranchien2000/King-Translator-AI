  class MobileOptimizer {
    constructor(ui) {
      this.ui = ui;
      this.isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      if (this.isMobile) {
        this.optimizeForMobile();
      }
    }
    optimizeForMobile() {
      this.reduceDOMOperations();
      this.optimizeTouchHandling();
      this.adjustUIForMobile();
    }
    reduceDOMOperations() {
      const observer = new MutationObserver((mutations) => {
        requestAnimationFrame(() => {
          mutations.forEach((mutation) => {
            if (mutation.type === "childList") {
              this.optimizeAddedNodes(mutation.addedNodes);
            }
          });
        });
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
    optimizeTouchHandling() {
      let touchStartY = 0;
      let touchStartX = 0;
      document.addEventListener(
        "touchstart",
        (e) => {
          touchStartY = e.touches[0].clientY;
          touchStartX = e.touches[0].clientX;
        },
        { passive: true }
      );
      document.addEventListener(
        "touchmove",
        (e) => {
          const touchY = e.touches[0].clientY;
          const touchX = e.touches[0].clientX;
          if (
            Math.abs(touchY - touchStartY) > 10 ||
            Math.abs(touchX - touchStartX) > 10
          ) {
            this.ui.removeTranslateButton();
          }
        },
        { passive: true }
      );
    }
    adjustUIForMobile() {
      const style = document.createElement("style");
      style.textContent = `
.translator-tools-container {
  bottom: 25px;
  right: 5px;
}
.translator-tools-button {
  padding: 8px 15px;
  font-size: 14px;
}
.translator-tools-dropdown {
  min-width: 208px;
  max-height: 90vh;
  overflow-y: auto;
}
.translator-tools-item {
  padding: 10px;
}
.draggable {
  max-width: 95vw;
  max-height: 80vh;
}
`;
      this.ui.shadowRoot.appendChild(style);
    }
    optimizeAddedNodes(nodes) {
      nodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const images = node.getElementsByTagName("img");
          Array.from(images).forEach((img) => {
            if (!img.loading) img.loading = "lazy";
          });
        }
      });
    }
  }
  // const bypassCSP = () => {
  //   const style = document.createElement("style");
  //   style.textContent = `
  //   .translator-tools-container {
  //     position: fixed;
  //     bottom: 40px;
  //     right: 25px;
  //     z-index: 2147483647;
  //     font-family: "GoMono Nerd Font", "Noto Sans", Arial;
  //     display: block;
  //     visibility: visible;
  //     opacity: 1;
  //   }
  // `;
  //   this.shadowRoot.appendChild(style);
  // };
