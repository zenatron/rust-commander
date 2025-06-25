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

    // Create modal structure
    const modal = DOMUtils.createElement('div', {
      id: id,
      class: `modal ${className}`,
      style: `
        position: fixed; 
        top: 0; 
        left: 0; 
        width: 100%; 
        height: 100%; 
        background: rgba(0,0,0,0.5); 
        z-index: ${zIndex}; 
        display: flex; 
        align-items: center; 
        justify-content: center;
      `
    });

    const dialog = DOMUtils.createElement('div', {
      class: 'modal-content',
      style: `
        background: white; 
        padding: 20px; 
        border-radius: 8px; 
        max-width: 90%; 
        max-height: 90%; 
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        position: relative;
        overflow: auto;
      `
    });

    // Add close button if requested
    if (showCloseButton) {
      const closeButton = DOMUtils.createElement('span', {
        class: 'close-button',
        style: `
          position: absolute;
          top: 15px;
          right: 20px;
          font-size: 28px;
          font-weight: bold;
          cursor: pointer;
          color: #aaa;
          background: none;
          border: none;
          width: auto;
          height: auto;
          padding: 0;
          line-height: 1;
        `
      }, '&times;');

      DOMUtils.addEventListener(closeButton, 'click', () => this.destroyModal(id));
      dialog.appendChild(closeButton);
    }

    // Add title if provided
    if (title) {
      const titleElement = DOMUtils.createElement('h3', {
        style: 'margin-top: 0; margin-bottom: 20px; text-align: center;'
      }, title);
      dialog.appendChild(titleElement);
    }

    // Add content
    const contentElement = DOMUtils.createElement('div', {
      class: 'modal-body'
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