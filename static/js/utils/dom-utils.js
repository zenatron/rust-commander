// DOM utility functions
export class DOMUtils {
  /**
   * Safely get element by ID with error handling
   */
  static getElementById(id) {
    const element = document.getElementById(id);
    if (!element) {
      console.warn(`Element with ID '${id}' not found`);
    }
    return element;
  }

  /**
   * Safely query selector with error handling
   */
  static querySelector(selector) {
    const element = document.querySelector(selector);
    if (!element) {
      console.warn(`Element with selector '${selector}' not found`);
    }
    return element;
  }

  /**
   * Query all elements with selector
   */
  static querySelectorAll(selector) {
    return document.querySelectorAll(selector);
  }

  /**
   * Create element with attributes and content
   */
  static createElement(tag, attributes = {}, content = '') {
    const element = document.createElement(tag);
    
    Object.entries(attributes).forEach(([key, value]) => {
      if (key === 'class') {
        element.className = value;
      } else if (key === 'style') {
        element.style.cssText = value;
      } else if (key.startsWith('data-')) {
        element.setAttribute(key, value);
      } else {
        element[key] = value;
      }
    });

    if (content) {
      if (typeof content === 'string') {
        element.innerHTML = content;
      } else {
        element.appendChild(content);
      }
    }

    return element;
  }

  /**
   * Remove element safely
   */
  static removeElement(element) {
    if (element && element.parentNode) {
      element.parentNode.removeChild(element);
    }
  }

  /**
   * Add event listener with cleanup tracking
   */
  static addEventListener(element, event, handler, options = {}) {
    if (!element) return null;
    
    element.addEventListener(event, handler, options);
    
    // Return cleanup function
    return () => element.removeEventListener(event, handler, options);
  }

  /**
   * Set element content safely
   */
  static setContent(element, content, isHTML = false) {
    if (!element) return;
    
    if (isHTML) {
      element.innerHTML = content;
    } else {
      element.textContent = content;
    }
  }

  /**
   * Toggle element visibility
   */
  static toggleVisibility(element, show) {
    if (!element) return;
    
    element.style.display = show ? 'block' : 'none';
  }

  /**
   * Add/remove CSS classes
   */
  static toggleClass(element, className, add) {
    if (!element) return;
    
    if (add) {
      element.classList.add(className);
    } else {
      element.classList.remove(className);
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  static escapeHtml(text) {
    if (typeof text !== 'string') return '';
    
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Focus element with error handling
   */
  static focusElement(element, delay = 0) {
    if (!element) return;
    
    if (delay > 0) {
      setTimeout(() => element.focus(), delay);
    } else {
      element.focus();
    }
  }

  /**
   * Scroll element into view
   */
  static scrollIntoView(element, options = { behavior: 'smooth' }) {
    if (!element) return;
    
    element.scrollIntoView(options);
  }

  /**
   * Get element dimensions
   */
  static getDimensions(element) {
    if (!element) return { width: 0, height: 0 };
    
    const rect = element.getBoundingClientRect();
    return {
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left
    };
  }
} 