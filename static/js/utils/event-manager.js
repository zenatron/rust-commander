// Event manager for component communication and centralized event handling
export class EventManager {
  constructor() {
    this.listeners = new Map();
    this.elementListeners = new WeakMap();
  }

  /**
   * Subscribe to an event
   */
  on(eventName, callback) {
    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }
    
    this.listeners.get(eventName).add(callback);

    // Return unsubscribe function
    return () => this.off(eventName, callback);
  }

  /**
   * Subscribe to an event that will only fire once
   */
  once(eventName, callback) {
    const wrapper = (...args) => {
      this.off(eventName, wrapper);
      callback(...args);
    };
    
    return this.on(eventName, wrapper);
  }

  /**
   * Unsubscribe from an event
   */
  off(eventName, callback) {
    const eventListeners = this.listeners.get(eventName);
    if (eventListeners) {
      eventListeners.delete(callback);
      
      // Clean up empty event sets
      if (eventListeners.size === 0) {
        this.listeners.delete(eventName);
      }
    }
  }

  /**
   * Emit an event to all subscribers
   */
  emit(eventName, ...args) {
    const eventListeners = this.listeners.get(eventName);
    if (eventListeners) {
      eventListeners.forEach(callback => {
        try {
          callback(...args);
        } catch (error) {
          console.error(`Error in event handler for '${eventName}':`, error);
        }
      });
    }
  }

  /**
   * Get number of listeners for an event
   */
  listenerCount(eventName) {
    const eventListeners = this.listeners.get(eventName);
    return eventListeners ? eventListeners.size : 0;
  }

  /**
   * Remove all listeners for an event or all events
   */
  removeAllListeners(eventName = null) {
    if (eventName) {
      this.listeners.delete(eventName);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Add DOM event listener with automatic cleanup tracking
   */
  addDOMListener(element, eventType, handler, options = {}) {
    if (!element) {
      console.warn('Cannot add event listener to null element');
      return null;
    }

    // Track element listeners for cleanup
    if (!this.elementListeners.has(element)) {
      this.elementListeners.set(element, []);
    }

    const listenerInfo = { eventType, handler, options };
    this.elementListeners.get(element).push(listenerInfo);

    // Add the actual listener
    element.addEventListener(eventType, handler, options);

    // Return cleanup function
    return () => this.removeDOMListener(element, eventType, handler, options);
  }

  /**
   * Remove specific DOM event listener
   */
  removeDOMListener(element, eventType, handler, options = {}) {
    if (!element) return;

    element.removeEventListener(eventType, handler, options);

    // Clean up tracking
    const listeners = this.elementListeners.get(element);
    if (listeners) {
      const index = listeners.findIndex(l => 
        l.eventType === eventType && 
        l.handler === handler
      );
      if (index !== -1) {
        listeners.splice(index, 1);
      }

      // Clean up empty arrays
      if (listeners.length === 0) {
        this.elementListeners.delete(element);
      }
    }
  }

  /**
   * Remove all DOM event listeners for an element
   */
  removeAllDOMListeners(element) {
    if (!element) return;

    const listeners = this.elementListeners.get(element);
    if (listeners) {
      listeners.forEach(({ eventType, handler, options }) => {
        element.removeEventListener(eventType, handler, options);
      });
      this.elementListeners.delete(element);
    }
  }

  /**
   * Delegate event handling for dynamic content
   */
  delegate(parentElement, eventType, selector, handler) {
    if (!parentElement) {
      console.warn('Cannot delegate events on null parent element');
      return null;
    }

    const delegateHandler = (event) => {
      const target = event.target.closest(selector);
      if (target && parentElement.contains(target)) {
        handler.call(target, event);
      }
    };

    return this.addDOMListener(parentElement, eventType, delegateHandler);
  }

  /**
   * Debounce function for frequent events
   */
  debounce(func, delay = 300) {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => func(...args), delay);
    };
  }

  /**
   * Throttle function for performance
   */
  throttle(func, limit = 100) {
    let inThrottle;
    return (...args) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * Clean up all event listeners
   */
  destroy() {
    this.removeAllListeners();
    
    // Clean up DOM listeners (note: WeakMap will be garbage collected)
    this.elementListeners = new WeakMap();
  }
}

// Predefined event types for the application
export const APP_EVENTS = {
  // Connection events
  CONNECTION_STATUS_CHANGED: 'connection:status-changed',
  TCP_CONNECTED: 'connection:tcp-connected',
  TCP_DISCONNECTED: 'connection:tcp-disconnected',
  WEBSOCKET_CONNECTED: 'connection:websocket-connected',
  WEBSOCKET_DISCONNECTED: 'connection:websocket-disconnected',

  // Command events
  COMMAND_SELECTED: 'command:selected',
  COMMAND_SENT: 'command:sent',
  COMMAND_RECEIVED: 'command:received',
  COMMAND_VARIABLES_CHANGED: 'command:variables-changed',

  // Palette events
  PALETTE_LOADED: 'palette:loaded',
  PALETTE_CREATED: 'palette:created',
  PALETTE_UPDATED: 'palette:updated',
  PALETTE_DELETED: 'palette:deleted',
  PALETTE_LIST_CHANGED: 'palette:list-changed',

  // UI events
  TAB_CHANGED: 'ui:tab-changed',
  MESSAGE_ADDED: 'ui:message-added',
  MODAL_OPENED: 'ui:modal-opened',
  MODAL_CLOSED: 'ui:modal-closed',

  // Error events
  ERROR_OCCURRED: 'error:occurred',
  API_ERROR: 'error:api-error',
  VALIDATION_ERROR: 'error:validation-error'
};

// Create singleton instance
export const eventManager = new EventManager(); 