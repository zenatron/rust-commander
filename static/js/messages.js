// MessagesManager - Singleton for handling both message pane and toast notifications
export class MessagesManager {
  constructor() {
    if (MessagesManager.instance) {
      return MessagesManager.instance;
    }
    
    // Message pane properties
    this.messageHistory = [];
    this.messageId = 0;
    this.isSortedNewestFirst = false;
    
    // Toast properties
    this.toastContainer = null;
    
    // Initialize components
    this.initializeToastContainer();
    this.initializeMessageSorting();
    
    MessagesManager.instance = this;
  }
  
  static getInstance() {
    if (!MessagesManager.instance) {
      MessagesManager.instance = new MessagesManager();
    }
    return MessagesManager.instance;
  }
  
  // Toast Container Initialization
  initializeToastContainer() {
    this.toastContainer = document.createElement('div');
    this.toastContainer.id = 'toast-container';
    document.body.appendChild(this.toastContainer);
  }
  
  // Message Sorting Initialization
  initializeMessageSorting() {
    const sortButton = document.getElementById("sortMessagesButton");
    if (sortButton) {
      sortButton.addEventListener("click", () => {
        this.toggleMessageSort();
      });
    }
  }
  
  // =======================
  // TOAST FUNCTIONALITY
  // =======================
  
  showToast(message, type = 'info', duration = 4000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icon = this.getToastIcon(type);
    toast.innerHTML = `
      <div class="toast-content">
        ${icon} <p>${message}</p>
      </div>
      <small class="toast-dismiss-note">click to dismiss</small>
    `;

    this.toastContainer.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.classList.add('show');
    }, 100);

    // Animate out and remove
    const timeoutId = setTimeout(() => {
      toast.classList.remove('show');
      toast.addEventListener('transitionend', () => {
        if (toast.parentElement) {
          toast.parentElement.removeChild(toast);
        }
      });
    }, duration);

    // Allow user to close toast by clicking on it
    toast.addEventListener('click', () => {
        clearTimeout(timeoutId);
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => {
            if (toast.parentElement) {
                toast.parentElement.removeChild(toast);
            }
        });
    });
  }

  getToastIcon(type) {
    switch (type) {
      case 'success':
        return '<i class="fas fa-check-circle"></i>';
      case 'error':
        return '<i class="fas fa-times-circle"></i>';
      case 'warn':
        return '<i class="fas fa-exclamation-triangle"></i>';
      case 'info':
      default:
        return '<i class="fas fa-info-circle"></i>';
    }
  }
  
  // =======================
  // MESSAGE PANE FUNCTIONALITY
  // =======================
  
  addMessage(messageContent, messageType = "received") {
    // Handle backward compatibility for old message types
    if (messageType === "system") {
      messageType = "system_info";
    }
    
    this.messageHistory.push({ 
      id: this.messageId++, 
      content: messageContent, 
      type: messageType,
      timestamp: new Date()
    });
    this.updateMessagesDisplay();
  }

  updateMessagesDisplay() {
    const messagesElement = document.getElementById("messagesDisplay");
    if (!messagesElement) {
      console.warn("Messages display element not found");
      return;
    }
    
    let messagesToShow = [...this.messageHistory];
    
    if (this.isSortedNewestFirst) {
      messagesToShow.reverse();
    }

    messagesElement.innerHTML = "";
    messagesToShow.forEach((msg) => {
      const timestamp = msg.timestamp.toLocaleTimeString('en-US', { hour12: false, timeStyle: 'medium' });
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
          break;
        case 'system_info':
        case 'info':
        case 'success':
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

      // Handle JSON formatting for received messages
      if (msg.type === "received") {
        try {
          const parsed = JSON.parse(msg.content);
          messageText = JSON.stringify(parsed);
        } catch (e) {
          // Keep as is if not valid JSON
        }
      }

      // Create a div for each message with appropriate styling
      const messageDiv = document.createElement("div");
      messageDiv.className = `message-line message-${cssClassType}`;
      messageDiv.textContent = `[${timestamp}] ${displayType}: ${messageText}`;
      messagesElement.appendChild(messageDiv);
    });
    
    // Auto-scroll to bottom (unless sorted newest first)
    if (!this.isSortedNewestFirst) {
      messagesElement.scrollTop = messagesElement.scrollHeight;
    }
  }

  toggleMessageSort() {
    this.isSortedNewestFirst = !this.isSortedNewestFirst;
    const button = document.getElementById("sortMessagesButton");
    if (button) {
      button.innerHTML = this.isSortedNewestFirst ? '<i class="fa-solid fa-sort-up"></i>' : '<i class="fa-solid fa-sort-down"></i>';
    }
    this.updateMessagesDisplay();
  }

  clearMessages() {
    this.messageHistory = [];
    this.updateMessagesDisplay();
  }
  
  // =======================
  // UNIFIED MESSAGING API
  // =======================
  
  /**
   * Unified method for showing messages - handles both toast and message pane
   * @param {string} message - The message content
   * @param {boolean} addToMessagePane - Whether to add to message pane (default: true)
   * @param {string} messageType - Type of message (info, warn, error, success, etc.)
   * @param {number} toastDuration - How long to show toast (default: 4000ms)
   */
  showMessage(message, addToMessagePane = true, messageType = "info", toastDuration = 4000) {
    // Always show toast
    let toastType = 'info';
    switch (messageType) {
      case 'system_info':
      case 'info':
        toastType = 'info';
        break;
      case 'system_warn':
      case 'warn':
        toastType = 'warn';
        break;
      case 'system_error':
      case 'error':
        toastType = 'error';
        break;
      case 'success':
        toastType = 'success';
        break;
    }
    
    this.showToast(message, toastType, toastDuration);
    
    // Optionally add to message pane
    if (addToMessagePane) {
      this.addMessage(message, messageType);
    }
  }
  
  /**
   * Convenience methods for common message types
   */
  showInfo(message, addToPane = true) {
    this.showMessage(message, addToPane, 'info');
  }
  
  showSuccess(message, addToPane = true) {
    this.showMessage(message, addToPane, 'success');
  }
  
  showWarning(message, addToPane = true) {
    this.showMessage(message, addToPane, 'warn');
  }
  
  showError(message, addToPane = true) {
    this.showMessage(message, addToPane, 'error');
  }
  
  /**
   * Method for system messages (network, connection, etc.)
   */
  addSystemMessage(message, systemType = 'info') {
    const messageType = `system_${systemType}`;
    this.addMessage(message, messageType);
  }
  
  /**
   * Method for sent messages (commands sent to device)
   */
  addSentMessage(message) {
    this.addMessage(message, 'sent');
  }
  
  /**
   * Method for received messages (responses from device)
   */
  addReceivedMessage(message) {
    this.addMessage(message, 'received');
  }
} 