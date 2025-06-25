import { DOMUtils } from '../utils/dom-utils.js';
import { eventManager, APP_EVENTS } from '../utils/event-manager.js';

// Dedicated message manager for handling all messaging functionality
export class MessageManager {
  constructor(toastManager) {
    this.toastManager = toastManager;
    this.messageHistory = [];
    this.messageId = 0;
    this.isSortedNewestFirst = false;
    
    this.messagesDisplayElement = null;
    this.sortButton = null;
    
    // Duplicate message detection
    this.lastMessageKey = null;
    this.lastMessageTime = 0;
    
    this.initialize();
  }

  /**
   * Initialize message manager
   */
  initialize() {
    this.messagesDisplayElement = DOMUtils.getElementById('messagesDisplay');
    this.sortButton = DOMUtils.getElementById('sortMessagesButton');
    
    if (this.sortButton) {
      DOMUtils.addEventListener(this.sortButton, 'click', () => this.toggleMessageSort());
    }

    // Note: Removed self-listening to prevent infinite recursion
    // MessageManager should be called directly, not listen for its own events
  }

  /**
   * Add a message to the history and display
   */
  addMessage(messageContent, messageType = "received") {
    // Handle backward compatibility for old message types
    if (messageType === "system") {
      messageType = "system_info";
    }
    
    const message = {
      id: this.messageId++,
      content: messageContent,
      type: messageType,
      timestamp: new Date()
    };
    
    this.messageHistory.push(message);
    this.updateMessagesDisplay();
    
    // Emit event for other components
    eventManager.emit(APP_EVENTS.MESSAGE_ADDED, message);
    
    return message;
  }

  /**
   * Show response message with toast notification
   */
  showResponse(message, addSystemMessage = true, messageType = "info") {
    // Check for duplicate calls within a short time window
    const now = Date.now();
    const messageKey = `${message}_${messageType}_${addSystemMessage}`;
    
    if (this.lastMessageKey === messageKey && (now - this.lastMessageTime) < 100) {
      console.warn('Duplicate message detected, skipping:', message);
      return;
    }
    
    this.lastMessageKey = messageKey;
    this.lastMessageTime = now;
    
    const toastType = this.getToastType(messageType);

    if (this.toastManager) {
      this.toastManager.show(message, toastType);
    } else {
      console.log(`[Toast Fallback] ${messageType}: ${message}`);
    }
    
    // Also add the message to the message panel with system styling if requested
    if (addSystemMessage) {
      this.addMessage(message, messageType);
    }
  }

  /**
   * Map message types to toast types
   */
  getToastType(messageType) {
    switch (messageType) {
      case 'system_info':
      case 'info':
        return 'info';
      case 'system_warn':
      case 'warn':
        return 'warn';
      case 'system_error':
      case 'error':
        return 'error';
      case 'success':
        return 'success';
      default:
        return 'info';
    }
  }

  /**
   * Update the messages display
   */
  updateMessagesDisplay() {
    if (!this.messagesDisplayElement) return;

    let messagesToShow = [...this.messageHistory];
    
    if (this.isSortedNewestFirst) {
      messagesToShow.reverse();
    }

    // Clear existing content
    this.messagesDisplayElement.innerHTML = "";
    
    messagesToShow.forEach((msg) => {
      const messageElement = this.createMessageElement(msg);
      this.messagesDisplayElement.appendChild(messageElement);
    });
    
    // Auto-scroll to bottom (unless sorted newest first)
    if (!this.isSortedNewestFirst) {
      this.messagesDisplayElement.scrollTop = this.messagesDisplayElement.scrollHeight;
    }
  }

  /**
   * Create a message element
   */
  createMessageElement(msg) {
    const timestamp = msg.timestamp.toLocaleTimeString('en-US', { 
      hour12: false, 
      timeStyle: 'medium' 
    });
    
    let messageText = msg.content;
    let displayType = 'INFO';
    let cssClassType = 'system_info';

    // Map internal types to display strings and CSS classes
    switch (msg.type) {
      case 'sent':
      case 'sent_text':
        displayType = 'SENT';
        cssClassType = 'sent';
        break;
      case 'received':
        displayType = 'RECV';
        cssClassType = 'received';
        
        // Handle JSON formatting for received messages
        try {
          const parsed = JSON.parse(msg.content);
          messageText = JSON.stringify(parsed);
        } catch (e) {
          // Keep as is if not valid JSON
        }
        break;
      case 'system_info':
      case 'info':
      case 'success': // Group success with info
        displayType = 'INFO';
        cssClassType = 'system_info';
        break;
      case 'system_warn':
      case 'warn':
        displayType = 'WARN';
        cssClassType = 'system_warn';
        break;
      case 'system_error':
      case 'error':
        displayType = 'ERRO';
        cssClassType = 'system_error';
        break;
    }

    return DOMUtils.createElement('div', {
      class: `message-line message-${cssClassType}`
    }, `[${timestamp}] ${displayType}: ${messageText}`);
  }

  /**
   * Toggle message sort order
   */
  toggleMessageSort() {
    this.isSortedNewestFirst = !this.isSortedNewestFirst;
    
    if (this.sortButton) {
      const iconClass = this.isSortedNewestFirst ? 'fa-sort-up' : 'fa-sort-down';
      this.sortButton.innerHTML = `<i class="fa-solid ${iconClass}"></i>`;
    }
    
    this.updateMessagesDisplay();
  }

  /**
   * Clear all messages
   */
  clearMessages() {
    this.messageHistory = [];
    this.updateMessagesDisplay();
  }

  /**
   * Get message history
   */
  getMessageHistory() {
    return [...this.messageHistory];
  }

  /**
   * Filter messages by type
   */
  getMessagesByType(type) {
    return this.messageHistory.filter(msg => msg.type === type);
  }

  /**
   * Get messages within time range
   */
  getMessagesInRange(startTime, endTime) {
    return this.messageHistory.filter(msg => 
      msg.timestamp >= startTime && msg.timestamp <= endTime
    );
  }

  /**
   * Export messages as text
   */
  exportMessages(format = 'text') {
    if (format === 'json') {
      return JSON.stringify(this.messageHistory, null, 2);
    }
    
    return this.messageHistory.map(msg => {
      const timestamp = msg.timestamp.toISOString();
      return `[${timestamp}] ${msg.type.toUpperCase()}: ${msg.content}`;
    }).join('\n');
  }

  /**
   * Cleanup
   */
  destroy() {
    eventManager.removeAllListeners(APP_EVENTS.MESSAGE_ADDED);
  }
} 