// Main exports for the Commander application
// This file provides convenient access to all components and utilities

// Core managers
export { CommandManager } from './commands.js';
export { ConnectionManager } from './connection.js';
export { ToastManager } from './toast.js';

// Components
export { MessageManager } from './components/message-manager.js';
export { CommandDisplay } from './components/command-display.js';
export { PaletteEditor } from './components/palette-editor.js';

// Utilities
export { DOMUtils } from './utils/dom-utils.js';
export { APIClient, APIError, apiClient } from './utils/api-client.js';
export { ModalManager, modalManager } from './utils/modal-manager.js';
export { EventManager, eventManager, APP_EVENTS } from './utils/event-manager.js';
export { Validators, CommonValidators } from './utils/validators.js';

// Legacy exports (for backwards compatibility)
export { CommandOptionsManager } from './command-options.js';

/**
 * Application information
 */
export const APP_INFO = {
  name: 'Commander',
  version: '0.12.2', // From Cargo.toml
  description: 'JSON Command Sender for device control',
  author: 'Phil Vishnevsky',
  repository: 'https://github.com/zenatron/rust-commander'
}; 