import { DOMUtils } from './dom-utils.js';

// Reusable modal manager for consistent modal handling
export class ModalManager {
  constructor() {
    this.activeModals = new Map();
  }

  /**
   * Create and show a modal
   */
  createModal(id, config = {}) {
    const {
      title = '',
      content = '',
      className = '',
      showCloseButton = true,
      closeOnOutsideClick = true,
      closeOnEscape = true,
      zIndex = 1000
    } = config;

    // Remove existing modal with same ID
    this.destroyModal(id);

    // Create modal structure with proper full-screen backdrop
    const modal = DOMUtils.createElement('div', {
      id: id,
      class: `modal ${className}`,
      style: `
        position: fixed !important; 
        top: 0 !important; 
        left: 0 !important; 
        width: 100vw !important; 
        height: 100vh !important; 
        background: rgba(0,0,0,0.5) !important; 
        z-index: ${zIndex} !important; 
        display: flex !important; 
        align-items: center !important; 
        justify-content: center !important;
        overflow: auto !important;
        padding: 20px !important;
        box-sizing: border-box !important;
      `
    });

    // For settings modal, use different centering approach
    const isSettingsModal = className.includes('settings-modal');
    
    const dialog = DOMUtils.createElement('div', {
      class: `modal-content ${className}`,
      style: isSettingsModal ? `
        background: white !important; 
        border-radius: 12px !important; 
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3) !important;
        position: relative !important;
        overflow: hidden !important;
        max-width: 400px !important;
        min-height: 500px !important;
        padding: 0 !important;
        margin: 0 !important;
        width: auto !important;
        max-height: 90vh !important;
      ` : `
        background: white !important; 
        padding: 20px !important; 
        border-radius: 8px !important; 
        max-width: 90% !important; 
        max-height: 90vh !important; 
        box-shadow: 0 4px 6px rgba(0,0,0,0.1) !important;
        position: relative !important;
        overflow: auto !important;
        margin: 0 !important;
        width: auto !important;
      `
    });

    // Add close button if requested
    if (showCloseButton) {
      const closeButton = DOMUtils.createElement('span', {
        class: 'close-button',
        style: isSettingsModal ? `
          position: absolute !important;
          top: 12px !important;
          right: 15px !important;
          font-size: 20px !important;
          color: #666 !important;
          z-index: 10 !important;
          background: none !important;
          border: none !important;
          cursor: pointer !important;
          transition: color 0.2s ease !important;
          width: auto !important;
          height: auto !important;
          padding: 0 !important;
          line-height: 1 !important;
        ` : `
          position: absolute !important;
          top: 15px !important;
          right: 20px !important;
          font-size: 28px !important;
          font-weight: bold !important;
          cursor: pointer !important;
          color: #aaa !important;
          background: none !important;
          border: none !important;
          width: auto !important;
          height: auto !important;
          padding: 0 !important;
          line-height: 1 !important;
        `
      }, '&times;');

      DOMUtils.addEventListener(closeButton, 'click', () => this.destroyModal(id));
      dialog.appendChild(closeButton);
    }

    // Add title if provided (skip for settings modal as it has custom header)
    if (title && !isSettingsModal) {
      const titleElement = DOMUtils.createElement('h3', {
        style: 'margin-top: 0; margin-bottom: 20px; text-align: center;'
      }, title);
      dialog.appendChild(titleElement);
    }

    // Add content
    const contentElement = DOMUtils.createElement('div', {
      class: isSettingsModal ? 'settings-modal-content' : 'modal-body',
      style: isSettingsModal ? '' : 'padding: 0;'
    }, content);
    dialog.appendChild(contentElement);

    modal.appendChild(dialog);
    document.body.appendChild(modal);

    // Set up event handlers
    const eventHandlers = [];

    // Close on outside click
    if (closeOnOutsideClick) {
      const outsideClickHandler = (e) => {
        if (e.target === modal) {
          this.destroyModal(id);
        }
      };
      eventHandlers.push(['click', outsideClickHandler]);
      DOMUtils.addEventListener(modal, 'click', outsideClickHandler);
    }

    // Close on escape key
    if (closeOnEscape) {
      const escapeHandler = (e) => {
        if (e.key === 'Escape') {
          this.destroyModal(id);
        }
      };
      eventHandlers.push(['keydown', escapeHandler]);
      DOMUtils.addEventListener(document, 'keydown', escapeHandler);
    }

    // Store modal info for cleanup
    this.activeModals.set(id, {
      element: modal,
      dialog: dialog,
      contentElement: contentElement,
      eventHandlers: eventHandlers
    });

    return {
      modal,
      dialog,
      contentElement,
      setContent: (newContent) => this.setModalContent(id, newContent),
      destroy: () => this.destroyModal(id)
    };
  }

  /**
   * Update modal content
   */
  setModalContent(id, content) {
    const modalInfo = this.activeModals.get(id);
    if (!modalInfo) return;

    DOMUtils.setContent(modalInfo.contentElement, content, true);
  }

  /**
   * Destroy modal and clean up
   */
  destroyModal(id) {
    const modalInfo = this.activeModals.get(id);
    if (!modalInfo) return;

    // Clean up event listeners
    modalInfo.eventHandlers.forEach(([event, handler]) => {
      document.removeEventListener(event, handler);
    });

    // Remove modal element
    DOMUtils.removeElement(modalInfo.element);

    // Remove from active modals
    this.activeModals.delete(id);
  }

  /**
   * Check if modal exists
   */
  hasModal(id) {
    return this.activeModals.has(id);
  }

  /**
   * Get modal elements
   */
  getModal(id) {
    return this.activeModals.get(id);
  }

  /**
   * Create confirmation dialog
   */
  showConfirmDialog(message, options = {}) {
    const {
      title = 'Confirm',
      confirmText = 'Confirm',
      cancelText = 'Cancel',
      onConfirm = () => {},
      onCancel = () => {}
    } = options;

    return new Promise((resolve) => {
      const id = 'confirm-dialog';
      const content = `
        <p style="margin-bottom: 20px;">${DOMUtils.escapeHtml(message)}</p>
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button id="confirmBtn" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
            ${DOMUtils.escapeHtml(confirmText)}
          </button>
          <button id="cancelBtn" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
            ${DOMUtils.escapeHtml(cancelText)}
          </button>
        </div>
      `;

      const { dialog } = this.createModal(id, { title, content });

      const confirmBtn = dialog.querySelector('#confirmBtn');
      const cancelBtn = dialog.querySelector('#cancelBtn');

      DOMUtils.addEventListener(confirmBtn, 'click', () => {
        this.destroyModal(id);
        onConfirm();
        resolve(true);
      });

      DOMUtils.addEventListener(cancelBtn, 'click', () => {
        this.destroyModal(id);
        onCancel();
        resolve(false);
      });
    });
  }

  /**
   * Create input dialog
   */
  showInputDialog(message, options = {}) {
    const {
      title = 'Input',
      placeholder = '',
      defaultValue = '',
      confirmText = 'OK',
      cancelText = 'Cancel',
      onConfirm = () => {},
      onCancel = () => {}
    } = options;

    return new Promise((resolve) => {
      const id = 'input-dialog';
      const content = `
        <p style="margin-bottom: 15px;">${DOMUtils.escapeHtml(message)}</p>
        <input type="text" id="inputField" value="${DOMUtils.escapeHtml(defaultValue)}" 
               placeholder="${DOMUtils.escapeHtml(placeholder)}"
               style="width: 100%; padding: 10px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
        <div style="display: flex; gap: 10px; justify-content: flex-end;">
          <button id="confirmBtn" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">
            ${DOMUtils.escapeHtml(confirmText)}
          </button>
          <button id="cancelBtn" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
            ${DOMUtils.escapeHtml(cancelText)}
          </button>
        </div>
      `;

      const { dialog } = this.createModal(id, { title, content });

      const inputField = dialog.querySelector('#inputField');
      const confirmBtn = dialog.querySelector('#confirmBtn');
      const cancelBtn = dialog.querySelector('#cancelBtn');

      // Focus input field
      DOMUtils.focusElement(inputField, 100);

      const handleConfirm = () => {
        const value = inputField.value.trim();
        this.destroyModal(id);
        onConfirm(value);
        resolve(value);
      };

      const handleCancel = () => {
        this.destroyModal(id);
        onCancel();
        resolve(null);
      };

      DOMUtils.addEventListener(confirmBtn, 'click', handleConfirm);
      DOMUtils.addEventListener(cancelBtn, 'click', handleCancel);
      DOMUtils.addEventListener(inputField, 'keydown', (e) => {
        if (e.key === 'Enter') {
          handleConfirm();
        }
      });
    });
  }

  /**
   * Clean up all modals
   */
  destroyAll() {
    const modalIds = Array.from(this.activeModals.keys());
    modalIds.forEach(id => this.destroyModal(id));
  }
}

// Create singleton instance
export const modalManager = new ModalManager(); 