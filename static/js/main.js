// Main application module - orchestrates all components
import { CommandManager } from './commands.js';
import { ConnectionManager } from './connection.js';
import { ToastManager } from './toast.js';
import { CommandOptionsManager } from './command-options.js';

// New modular components
import { MessageManager } from './components/message-manager.js';
import { CommandDisplay } from './components/command-display.js';
import { PaletteEditor } from './components/palette-editor.js';

// Utilities
import { apiClient, APIError } from './utils/api-client.js';
import { DOMUtils } from './utils/dom-utils.js';
import { modalManager } from './utils/modal-manager.js';
import { eventManager, APP_EVENTS } from './utils/event-manager.js';
import { CommonValidators } from './utils/validators.js';

class App {
  constructor() {
    // Initialize core managers
    this.toastManager = new ToastManager();
    this.messageManager = new MessageManager(this.toastManager);
    this.commandManager = new CommandManager();
    this.connectionManager = new ConnectionManager();
    this.commandDisplay = new CommandDisplay();
    this.paletteEditor = new PaletteEditor(this.messageManager);
    
    // Initialize command options manager (legacy compatibility)
    this.commandOptionsManager = new CommandOptionsManager(
      this.commandManager,
      null, // UIManager - will be set later for backward compatibility
      null  // SaveManager - will be set later for backward compatibility
    );
    
    // Application state
    this.currentPaletteName = '';
    this.availablePalettes = [];
    
    // Track event cleanup functions
    this.eventCleanupFunctions = [];
    this.isInitialized = false;
    
    this.initialize();
  }

  /**
   * Initialize the application
   */
  async initialize() {
    // Prevent multiple initializations
    if (this.isInitialized) {
      console.warn('App already initialized, skipping...');
      return;
    }
    
    console.log('Initializing Commander app...');
    
    // Set up component dependencies
    this.commandDisplay.setCommandManager(this.commandManager);
    
    // Set up event listeners
    this.setupEventListeners();
    
    // Initialize UI state
    this.updateConnectionStatus(false);
    
    // Load initial data
    await this.fetchPalettes();
    
    this.isInitialized = true;
    console.log('Commander app initialized');
  }

  /**
   * Set up all event listeners
   */
  setupEventListeners() {
    // Clean up any existing event listeners first
    this.cleanupEventListeners();
    
    // App-level event listeners
    const cleanup1 = eventManager.on(APP_EVENTS.CONNECTION_STATUS_CHANGED, (isConnected) => {
      this.updateConnectionStatus(isConnected);
    });
    this.eventCleanupFunctions.push(cleanup1);

    const cleanup2 = eventManager.on(APP_EVENTS.PALETTE_UPDATED, async (data) => {
      await this.handlePaletteUpdated(data);
    });
    this.eventCleanupFunctions.push(cleanup2);

    const cleanup3 = eventManager.on(APP_EVENTS.COMMAND_SENT, (data) => {
      const delimiterText = data.delimiter ? ` (delim: '${data.delimiter}')` : '';
      this.messageManager.addMessage(JSON.stringify(data.command) + delimiterText, "sent");
    });
    this.eventCleanupFunctions.push(cleanup3);

    // DOM event listeners
    this.setupDOMEventListeners();
  }

  /**
   * Clean up event listeners
   */
  cleanupEventListeners() {
    // Clean up app-level event listeners
    this.eventCleanupFunctions.forEach(cleanup => cleanup());
    this.eventCleanupFunctions = [];
    
    // Note: DOM event listeners are handled by DOMUtils which returns cleanup functions
    // Individual setup methods will handle their own cleanup
  }

  /**
   * Set up DOM event listeners
   */
  setupDOMEventListeners() {
    // Connection controls
    const connectBtn = DOMUtils.getElementById("connectButton_header");
    const disconnectBtn = DOMUtils.getElementById("disconnectButton_header");
    const socketPathInput = DOMUtils.getElementById("socket_path_header");

    if (connectBtn) {
      DOMUtils.addEventListener(connectBtn, "click", async () => {
        await this.handleConnect();
      });
    }

    if (disconnectBtn) {
      DOMUtils.addEventListener(disconnectBtn, "click", async () => {
        await this.handleDisconnect();
      });
    }

    // Palette management
    this.setupPaletteEventListeners();

    // Command sending
    this.setupCommandEventListeners();

    // Settings modal
    this.setupSettingsEventListeners();
  }

  /**
   * Set up palette-related event listeners
   */
  setupPaletteEventListeners() {
    const paletteSelector = DOMUtils.getElementById("paletteSelector");
    const createPaletteBtn = DOMUtils.getElementById("createPaletteButton");
    const uploadPaletteBtn = DOMUtils.getElementById("uploadCommandFileButton");
    const editPaletteBtn = DOMUtils.getElementById("editPaletteButton");
    const deletePaletteBtn = DOMUtils.getElementById("deletePaletteButton");
    const paletteFileInput = DOMUtils.getElementById("paletteFileUpload");

    if (paletteSelector) {
      DOMUtils.addEventListener(paletteSelector, "change", async (e) => {
        const selectedPalette = e.target.value;
        if (selectedPalette) {
          await this.loadPalette(selectedPalette);
        } else {
          this.clearPalette();
        }
      });
    }

    if (createPaletteBtn) {
      DOMUtils.addEventListener(createPaletteBtn, "click", async () => {
        await this.createNewPalette();
      });
    }

    if (uploadPaletteBtn) {
      DOMUtils.addEventListener(uploadPaletteBtn, "click", () => {
        if (paletteFileInput) paletteFileInput.click();
      });
    }

    if (editPaletteBtn) {
      DOMUtils.addEventListener(editPaletteBtn, "click", () => {
        this.editCurrentPalette();
      });
    }

    if (deletePaletteBtn) {
      DOMUtils.addEventListener(deletePaletteBtn, "click", async () => {
        await this.deleteCurrentPalette();
      });
    }

    if (paletteFileInput) {
      DOMUtils.addEventListener(paletteFileInput, "change", async (e) => {
        await this.handlePaletteFileUpload(e);
      });
    }
  }

  /**
   * Set up command-related event listeners
   */
  setupCommandEventListeners() {
    const sendBtn = DOMUtils.getElementById("sendButton");
    const commandOptionsBtn = DOMUtils.getElementById("commandOptionsButton_main");

    if (sendBtn) {
      DOMUtils.addEventListener(sendBtn, "click", async () => {
        await this.handleSendCommand();
      });
    }

    if (commandOptionsBtn) {
      DOMUtils.addEventListener(commandOptionsBtn, "click", () => {
        this.showCommandOptions();
      });
    }

    // Set up tab delegation for command palette
    const tabContainer = DOMUtils.getElementById("tabContainer");
    if (tabContainer) {
      eventManager.delegate(tabContainer, 'click', '.tab', (event) => {
        const tabElement = event.target;
        const categoryName = tabElement.textContent.trim();
        this.activateTab(tabElement, categoryName);
      });
    }

    // Set up command selection delegation
    const tabContentContainer = DOMUtils.getElementById("tabContentContainer");
    if (tabContentContainer) {
      eventManager.delegate(tabContentContainer, 'click', '.command-list li:not(.no-commands-message)', (event) => {
        const listItem = event.target;
        this.handleCommandSelection(listItem);
      });
    }
  }

  /**
   * Set up settings modal event listeners
   */
  setupSettingsEventListeners() {
    const settingsBtn = DOMUtils.getElementById("settingsButton");
    
    if (settingsBtn) {
      DOMUtils.addEventListener(settingsBtn, "click", () => {
        this.showSettingsModal();
      });
    }
  }

  /**
   * Handle TCP connection
   */
  async handleConnect() {
    const socketPathInput = DOMUtils.getElementById("socket_path_header");
    if (!socketPathInput) return;

    const socketPath = socketPathInput.value.trim();
    
    // Validate socket path
    const validation = CommonValidators.socketPath(socketPath);
    if (!validation.isValid) {
      this.messageManager.showResponse(validation.message, true, "warn");
      return;
    }

    const result = await this.connectionManager.connectTCP(socketPath);
    const messageType = result.success ? "success" : "error";
    this.messageManager.showResponse(result.message, false, messageType);
  }

  /**
   * Handle TCP disconnection
   */
  async handleDisconnect() {
    const result = await this.connectionManager.disconnectTCP();
    const messageType = result.success ? "info" : "error";
    this.messageManager.showResponse(result.message, false, messageType);
  }

  /**
   * Handle command sending
   */
  async handleSendCommand() {
    if (!this.connectionManager.isWebSocketConnected()) {
      this.messageManager.showResponse('WebSocket not connected', true, "error");
      return;
    }

    if (!this.commandDisplay.areAllVariablesFilled()) {
      this.messageManager.showResponse('Please fill in all required variables', true, "warn");
      return;
    }

    const command = this.commandManager.getCurrentFilledCommand();
    if (!command) {
      this.messageManager.showResponse('No command selected', true, "warn");
      return;
    }

    const delimiterInput = DOMUtils.getElementById("commandDelimiterInput");
    const delimiter = delimiterInput ? delimiterInput.value : null;

    const result = await this.connectionManager.sendCommand(command, delimiter);
    
    if (!result.success) {
      this.messageManager.showResponse(`Send error: ${result.message}`, false, "error");
    }
  }

  /**
   * Show command options modal
   */
  showCommandOptions() {
    if (this.commandOptionsManager) {
      // Set up backward compatibility for CommandOptionsManager
      this.commandOptionsManager.uiManager = {
        showResponse: (message, isToast, type) => this.messageManager.showResponse(message, isToast, type),
        getCurrentCommandInfo: () => this.commandManager.getCurrentCommandInfo(),
        getCurrentPaletteName: () => this.currentPaletteName,
        clearCommandSelection: () => {
          this.commandDisplay.clearDisplays();
          this.commandManager.clearCurrentCommand();
        },
        clearActiveCommand: () => {
          // Remove active class from all command elements
          DOMUtils.querySelectorAll('.command-list li').forEach(item => 
            DOMUtils.toggleClass(item, 'active', false));
        },
        updateRawJsonDisplay: (command) => this.commandDisplay.updateRawJsonDisplay(),
        updateFilledJsonDisplay: (command) => this.commandDisplay.updateFilledJsonDisplay()
      };
      
      this.commandOptionsManager.showCommandOptionsModal();
    } else {
      this.messageManager.showResponse('Command options not available', true, 'error');
    }
  }

  /**
   * Fetch available palettes
   */
  async fetchPalettes() {
    try {
      this.availablePalettes = await apiClient.getPalettes();
      this.populatePaletteSelector();
      
      if (this.availablePalettes.length > 0) {
        await this.loadPalette(this.availablePalettes[0]);
      } else {
        this.messageManager.showResponse("No palettes found. Create or upload a palette.", true, "info");
        this.clearPalette();
      }

      eventManager.emit(APP_EVENTS.PALETTE_LIST_CHANGED, this.availablePalettes);
    } catch (error) {
      console.error('Error fetching palettes:', error);
      this.messageManager.showResponse(`Error fetching palettes: ${this.getErrorMessage(error)}`, true, "error");
      this.clearPalette();
    }
  }

  /**
   * Load a specific palette
   */
  async loadPalette(paletteName, skipAutoActivation = false) {
    if (!paletteName) {
      this.messageManager.showResponse("No palette specified to load.", true, "warn");
      this.clearPalette();
      return;
    }

    try {
      const paletteData = await apiClient.getPalette(paletteName);
      const loadResult = this.commandManager.loadCommandsFromJson(paletteData);
      
      if (loadResult.success && loadResult.data) {
        this.populateCommandPalette(loadResult.data, skipAutoActivation);
        this.currentPaletteName = paletteName;
        this.setSelectedPalette(paletteName);
        this.updatePaletteButtons(true);
        this.messageManager.showResponse(`Palette '${paletteName}' loaded successfully.`, true, "success");
      } else {
        console.error("Loaded palette data is not in the expected format:", paletteData);
        this.clearPalette();
        this.messageManager.showResponse(loadResult.error || "Error: Loaded palette data is not in the expected format.", true, "error");
      }
    } catch (error) {
      console.error(`Error loading palette ${paletteName}:`, error);
      this.messageManager.showResponse(`Error loading palette '${paletteName}': ${this.getErrorMessage(error)}`, true, "error");
      this.clearPalette();
    }
  }

  /**
   * Create a new palette
   */
  async createNewPalette() {
    const paletteName = await modalManager.showInputDialog(
      "Enter name for the new palette:",
      {
        title: 'Create New Palette',
        placeholder: 'Palette name'
      }
    );

    if (!paletteName) return;

    // Validate palette name
    const validation = CommonValidators.paletteName(paletteName);
    if (!validation.isValid) {
      this.messageManager.showResponse(validation.message, true, "warn");
      return;
    }

    try {
      await apiClient.createPalette({ name: paletteName, commands: {} });
      this.messageManager.showResponse(`Palette '${paletteName}' created successfully.`, true, "success");
      
      this.commandManager.clearAllCommands();
      this.commandDisplay.clearDisplays();
      
      await this.fetchPalettes();
      this.setSelectedPalette(paletteName);
      await this.loadPalette(paletteName);
    } catch (error) {
      console.error(`Error creating palette ${paletteName}:`, error);
      this.messageManager.showResponse(`Error creating palette '${paletteName}': ${this.getErrorMessage(error)}`, true, "error");
    }
  }

  /**
   * Edit current palette
   */
  editCurrentPalette() {
    if (!this.currentPaletteName) {
      this.messageManager.showResponse("No palette selected to edit.", true, "warn");
      return;
    }

    const commandsData = this.commandManager.getCommandsData();
    this.paletteEditor.showEditor(commandsData, this.currentPaletteName);
  }

  /**
   * Delete current palette
   */
  async deleteCurrentPalette() {
    if (!this.currentPaletteName) {
      this.messageManager.showResponse("No palette specified to delete.", true, "warn");
      return;
    }

    const confirmed = await modalManager.showConfirmDialog(
      `Are you sure you want to delete the palette '${this.currentPaletteName}'? This action cannot be undone.`,
      {
        title: 'Delete Palette',
        confirmText: 'Delete',
        cancelText: 'Cancel'
      }
    );

    if (!confirmed) return;

    try {
      await apiClient.deletePalette(this.currentPaletteName);
      this.messageManager.showResponse(`Palette '${this.currentPaletteName}' deleted successfully.`, true, "success");
      
      // Clear state and reload
      this.commandManager.clearAllCommands();
      this.clearPalette();
      await this.fetchPalettes();
    } catch (error) {
      console.error(`Error deleting palette ${this.currentPaletteName}:`, error);
      this.messageManager.showResponse(`Error deleting palette '${this.currentPaletteName}': ${this.getErrorMessage(error)}`, true, "error");
    }
  }

  /**
   * Handle palette file upload
   */
  async handlePaletteFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const paletteName = await modalManager.showInputDialog(
      "Enter name for the imported palette:",
      {
        title: 'Import Palette',
        placeholder: 'Palette name',
        defaultValue: file.name.replace(/\.[^/.]+$/, "")
      }
    );

    if (!paletteName) return;

    // Validate palette name
    const validation = CommonValidators.paletteName(paletteName);
    if (!validation.isValid) {
      this.messageManager.showResponse(validation.message, true, "warn");
      return;
    }

    try {
      const fileContent = await this.readFileAsText(file);
      const commandsData = JSON.parse(fileContent);
      
      await apiClient.createPalette({ name: paletteName, commands: commandsData });
      this.messageManager.showResponse(`Palette '${paletteName}' imported successfully.`, true, "success");
      
      this.commandManager.clearAllCommands();
      this.commandDisplay.clearDisplays();
      
      await this.fetchPalettes();
      this.setSelectedPalette(paletteName);
      await this.loadPalette(paletteName);
    } catch (error) {
      console.error('Error importing palette:', error);
      this.messageManager.showResponse(`Error importing palette: ${this.getErrorMessage(error)}`, true, "error");
    } finally {
      // Reset file input
      event.target.value = '';
    }
  }

  /**
   * Handle palette updated event
   */
  async handlePaletteUpdated(data) {
    try {
      // Save the updated palette
      await apiClient.updatePalette(data.name, {
        name: data.name,
        commands: data.commands
      });

      this.messageManager.showResponse(`Palette '${data.name}' updated successfully.`, true, "success");
      
      // Refresh and reload
      await this.fetchPalettes();
      this.setSelectedPalette(data.name);
      await this.loadPalette(data.name, true);
    } catch (error) {
      console.error('Error saving palette changes:', error);
      this.messageManager.showResponse(`Error updating palette '${data.name}': ${this.getErrorMessage(error)}`, true, "error");
    }
  }

  /**
   * Handle command selection
   */
  handleCommandSelection(listItem) {
    const cmdJsonString = listItem.dataset.commandJsonString;
    const commandInfoString = listItem.dataset.commandInfo;
    
    if (!cmdJsonString || !commandInfoString) {
      console.error("Command data not found on list item", listItem);
      this.messageManager.showResponse("Error: Could not load selected command details.", true, "error");
      return;
    }

    try {
      const commandInfo = JSON.parse(commandInfoString);
      
      // Update UI state
      this.setActiveCommand(listItem);
      
      // Set command in manager
      const result = this.commandManager.setCurrentCommand(cmdJsonString, commandInfo);
      if (!result.success) {
        this.messageManager.showResponse(`Error loading command: ${result.error}`, true, "error");
      }
    } catch (error) {
      console.error("Error parsing command info:", error);
      this.messageManager.showResponse("Error: Invalid command data.", true, "error");
    }
  }

  /**
   * Populate command palette
   */
  populateCommandPalette(commandsData, skipAutoActivation = false) {
    const tabContainer = DOMUtils.getElementById("tabContainer");
    const tabContentContainer = DOMUtils.getElementById("tabContentContainer");

    if (!tabContainer || !tabContentContainer) return;

    // Clear existing content
    tabContainer.innerHTML = "";
    tabContentContainer.innerHTML = "";
    this.commandDisplay.clearDisplays();

    if (Object.keys(commandsData).length === 0) {
      tabContainer.innerHTML = '<p class="no-palette-message">This palette is empty. Create categories and commands using the Edit Palette option ✏️</p>';
      return;
    }

    let firstTabInitialized = false;
    const categories = Object.keys(commandsData);

    categories.forEach((categoryName, index) => {
      const commands = commandsData[categoryName];
      if (typeof commands !== 'object' || commands === null) {
        console.warn(`Skipping tab ${categoryName} due to invalid commands (not an object or null)`);
        return;
      }

      // Create tab
      const tabButton = this.createTabButton(categoryName);
      tabContainer.appendChild(tabButton);

      // Create tab content
      const tabContent = this.createTabContent(categoryName, commands);
      tabContentContainer.appendChild(tabContent);

      if (!firstTabInitialized && index === 0 && !skipAutoActivation) {
        this.activateTab(tabButton, categoryName);
        firstTabInitialized = true;
      }
    });
  }

  /**
   * Create a tab button
   */
  createTabButton(categoryName) {
    return DOMUtils.createElement("div", {
      class: "tab"
    }, categoryName);
  }

  /**
   * Create tab content
   */
  createTabContent(categoryName, commands) {
    const tabContent = DOMUtils.createElement("div", {
      class: "tab-content",
      id: `tab-${categoryName.replace(/\s+/g, "-")}`
    });

    const commandList = DOMUtils.createElement("ul", {
      class: "command-list"
    });

    const commandNames = Object.keys(commands);
    
    if (commandNames.length === 0) {
      const emptyMessage = DOMUtils.createElement("li", {
        class: "no-commands-message"
      }, "Empty category ☹️");
      commandList.appendChild(emptyMessage);
    } else {
      commandNames.forEach(commandName => {
        const commandData = commands[commandName];
        const listItem = this.createCommandListItem(categoryName, commandName, commandData);
        commandList.appendChild(listItem);
      });
    }

    tabContent.appendChild(commandList);
    return tabContent;
  }

  /**
   * Create command list item
   */
  createCommandListItem(categoryName, commandName, commandData) {
    const listItem = DOMUtils.createElement("li", {}, commandName);

    try {
      const commandInfo = {
        paletteName: this.currentPaletteName,
        categoryName: categoryName,
        commandName: commandName,
        commandData: commandData
      };

      listItem.dataset.commandJsonString = JSON.stringify(commandData);
      listItem.dataset.commandInfo = JSON.stringify(commandInfo);
    } catch (e) {
      console.error("Error stringifying command data:", commandName, commandData, e);
      return null;
    }

    return listItem;
  }

  /**
   * Activate a tab
   */
  activateTab(activeTab, tabKey) {
    // Remove active class from all tabs and contents
    DOMUtils.querySelectorAll('.tab').forEach(tab => 
      DOMUtils.toggleClass(tab, 'active', false));
    DOMUtils.querySelectorAll('.tab-content').forEach(content => 
      DOMUtils.toggleClass(content, 'active', false));

    // Add active class to selected tab and content
    DOMUtils.toggleClass(activeTab, 'active', true);
    
    const contentId = `tab-${tabKey.replace(/\s+/g, "-")}`;
    const content = DOMUtils.getElementById(contentId);
    if (content) {
      DOMUtils.toggleClass(content, 'active', true);
    }

    eventManager.emit(APP_EVENTS.TAB_CHANGED, { tabKey, activeTab });
  }

  /**
   * Set active command highlighting
   */
  setActiveCommand(commandElement) {
    // Remove active class from all command elements
    DOMUtils.querySelectorAll('.command-list li').forEach(item => 
      DOMUtils.toggleClass(item, 'active', false));
    
    // Add active class to selected command
    if (commandElement) {
      DOMUtils.toggleClass(commandElement, 'active', true);
    }
  }

  /**
   * Show settings modal
   */
  async showSettingsModal() {
    try {
      const version = await apiClient.getVersion();
      
      const content = `
        <div class="settings-modal-content">
          <div class="settings-icon">
            <img src="favicon.svg" alt="Commander Logo" />
          </div>
          <h1 class="settings-title">Commander</h1>
          <p class="settings-version">Version: <span>${DOMUtils.escapeHtml(version)}</span></p>
          
          <div class="settings-section">
            <h3>Author</h3>
            <a href="https://github.com/zenatron" target="_blank" rel="noopener noreferrer">
              <p class="settings-author">Phil Vishnevsky</p>
            </a>
          </div>
          
          <div class="settings-section">
            <h3>Help & Support</h3>
            <div class="settings-help-buttons">
              <a href="https://github.com/zenatron/rust-commander" target="_blank" rel="noopener noreferrer">
                <button type="button" class="settings-link-button">📖 Documentation</button>
              </a>
              <a href="https://github.com/zenatron/rust-commander/issues" target="_blank" rel="noopener noreferrer">
                <button type="button" class="settings-link-button">🐛 Report Issues</button>
              </a>
            </div>
          </div>
          
          <div class="settings-section">
            <h3>Application Info</h3>
            <div class="settings-info">
              <p><strong>Purpose:</strong> JSON Command Sender for device control</p>
              <p><strong>Platform:</strong> Cross-platform web application</p>
              <p><strong>License:</strong> Open Source</p>
            </div>
          </div>
        </div>
      `;

      modalManager.createModal('settings-modal', {
        title: '',
        content: content,
        className: 'settings-modal'
      });
    } catch (error) {
      console.error('Error fetching version:', error);
      this.messageManager.showResponse('Error loading application information', true, 'error');
    }
  }

  /**
   * Update connection status UI
   */
  updateConnectionStatus(isConnected) {
    const statusElement = DOMUtils.getElementById("connectionStatus");
    const connectBtn = DOMUtils.getElementById("connectButton_header");
    const disconnectBtn = DOMUtils.getElementById("disconnectButton_header");
    
    if (statusElement) {
      DOMUtils.setContent(statusElement, isConnected ? "Connected" : "Disconnected");
      statusElement.className = isConnected ? "status-connected" : "status-disconnected";
    }
    
    if (connectBtn) DOMUtils.toggleVisibility(connectBtn, !isConnected);
    if (disconnectBtn) DOMUtils.toggleVisibility(disconnectBtn, isConnected);
  }

  /**
   * Populate palette selector
   */
  populatePaletteSelector() {
    const selector = DOMUtils.getElementById("paletteSelector");
    if (!selector) return;

    selector.innerHTML = '<option value="">Select a Palette</option>';
    this.availablePalettes.forEach(paletteName => {
      const option = DOMUtils.createElement("option", {
        value: paletteName
      }, paletteName);
      selector.appendChild(option);
    });
  }

  /**
   * Set selected palette in selector
   */
  setSelectedPalette(paletteName) {
    const selector = DOMUtils.getElementById("paletteSelector");
    if (selector) {
      selector.value = paletteName;
    }
  }

  /**
   * Update palette action buttons
   */
  updatePaletteButtons(hasPalette) {
    const editBtn = DOMUtils.getElementById("editPaletteButton");
    const deleteBtn = DOMUtils.getElementById("deletePaletteButton");
    
    if (editBtn) editBtn.disabled = !hasPalette;
    if (deleteBtn) deleteBtn.disabled = !hasPalette;
  }

  /**
   * Clear palette state
   */
  clearPalette() {
    this.commandManager.clearAllCommands();
    this.commandDisplay.clearDisplays();
    this.currentPaletteName = '';
    this.updatePaletteButtons(false);
    
    const tabContainer = DOMUtils.getElementById("tabContainer");
    if (tabContainer) {
      tabContainer.innerHTML = '<p class="no-palette-message">No palette loaded or palette is empty 📁</p>';
    }
    
    const tabContentContainer = DOMUtils.getElementById("tabContentContainer");
    if (tabContentContainer) tabContentContainer.innerHTML = "";
  }

  /**
   * Read file as text
   */
  readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  /**
   * Get user-friendly error message
   */
  getErrorMessage(error) {
    if (error instanceof APIError) {
      return error.message;
    }
    return error.message || 'Unknown error occurred';
  }

  /**
   * Cleanup and destroy application
   */
  destroy() {
    // Clean up all components
    this.messageManager?.destroy();
    this.commandManager?.destroy();
    this.connectionManager?.destroy();
    this.commandDisplay?.destroy();
    this.commandOptionsManager?.destroy();
    
    // Clean up utilities
    modalManager.destroyAll();
    eventManager.destroy();
    
    // Clean up app-level event listeners
    this.cleanupEventListeners();
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  // Prevent multiple app instances
  if (window.commanderApp) {
    console.warn('Commander app already exists, skipping initialization');
    return;
  }
  
  const app = new App();
  await app.initialize();
  
  // Make app globally available for backwards compatibility
  window.commanderApp = app;
});

// Global initialization function for version display (backwards compatibility)
async function fetchAndDisplayVersion() {
  try {
    const version = await apiClient.getVersion();
    const versionElem = DOMUtils.getElementById('projectVersion');
    if (versionElem) {
      DOMUtils.setContent(versionElem, `Version: ${version}`);
    }
  } catch (error) {
    console.error('Error fetching version:', error);
    const versionElem = DOMUtils.getElementById('projectVersion');
    if (versionElem) {
      DOMUtils.setContent(versionElem, 'Version: Error');
    }
  }
}

// Call version fetch on load
document.addEventListener('DOMContentLoaded', fetchAndDisplayVersion); 