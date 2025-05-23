// Main application module
import { CommandManager } from './commands.js';
import { ConnectionManager } from './connection.js';
import { UIManager } from './ui.js';
import { SaveManager } from './save.js';

class App {
  constructor() {
    this.uiManager = new UIManager();
    this.commandManager = new CommandManager();
    this.uiManager.setCommandManager(this.commandManager);
    this.connectionManager = new ConnectionManager(
      (message, type) => this.uiManager.addMessage(message, type),
      (isConnected) => this.uiManager.updateConnectionStatus(isConnected)
    );
    this.saveManager = new SaveManager(this.commandManager, this.uiManager);
  }

  async initialize() {
    console.log('Initializing Commander app...');
    
    // Initialize UI
    this.uiManager.initialize();
    
    // Load initial commands
    await this.loadInitialCommands();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Don't establish WebSocket connection automatically
    // It will be established after successful TCP connection
    
    console.log('Commander app initialized');
  }

  async loadInitialCommands() {
    const result = await this.commandManager.loadCommands("/commands.json");
    
    if (result.success) {
      this.uiManager.populateCommandPalette(result.data);
      this.uiManager.showResponse('Commands loaded successfully.', true, "system_info");
    } else {
      this.uiManager.showResponse(`Error loading commands: ${result.error}`, true, "system_error");
    }
  }

  setupEventListeners() {
    // TCP Connection (using original header element IDs)
    document.getElementById("connectButton_header").addEventListener("click", async () => {
      const socketPath = document.getElementById("socket_path_header").value.trim();
      if (!socketPath) {
        this.uiManager.showResponse('Please enter a socket path', true, "system_warn");
        return;
      }

      // Get the result from the connection manager
      const result = await this.connectionManager.connectTCP(socketPath);
      // Apply appropriate styling based on success/failure
      const messageType = result.success ? "system_info" : "system_error";
      this.uiManager.showResponse(result.message, false, messageType);
    });

    document.getElementById("disconnectButton_header").addEventListener("click", async () => {
      // Get the result from the disconnection manager
      const result = await this.connectionManager.disconnectTCP();
      // Apply appropriate styling based on success/failure
      const messageType = result.success ? "system_info" : "system_error";
      this.uiManager.showResponse(result.message, false, messageType);
    });

    // Load Commands File (original upload button)
    document.getElementById("uploadCommandFileButton").addEventListener("click", () => {
      document.getElementById("commandFileUpload").click();
    });

    document.getElementById("commandFileUpload").addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const result = await this.commandManager.loadCommands(file);

      if (result.success) {
        this.uiManager.populateCommandPalette(result.data);
        this.uiManager.showResponse(`Commands loaded from ${file.name}`, true, "system_info");
      } else {
        this.uiManager.showResponse(`Error loading ${file.name}: ${result.error}`, true, "system_error");
      }
    });

    // Send Command (original send button)
    document.getElementById("sendButton").addEventListener("click", async () => {
      if (!this.validateAndSendCommand()) return;

      const command = this.commandManager.getCurrentFilledCommand();
      const result = await this.connectionManager.sendCommand(command);
      
      if (result.success) {
        this.uiManager.addMessage(JSON.stringify(command), "sent");
      } else {
        // Apply error styling to the response div
        this.uiManager.showResponse(`Send error: ${result.message}`, false, "system_error");
      }
    });

    // Save Command (main button next to Send)
    document.getElementById("saveCommandButton_main").addEventListener("click", () => {
      if (!this.validateVariableInputs()) return;
      this.saveManager.showSaveModal();
    });

    // Raw Text Command (original elements)
    const sendRawTextButtonElement = document.getElementById("sendRawTextButton");
    if (sendRawTextButtonElement) {
      sendRawTextButtonElement.addEventListener("click", async () => {
        const textCommand = document.getElementById("rawTextInput").value.trim();
        if (!textCommand) {
          this.uiManager.showResponse('Please enter a text command', true, "system_warn");
          return;
        }

        const result = await this.connectionManager.sendTextCommand(textCommand);
        
        if (result.success) {
          this.uiManager.addMessage(textCommand, "sent_text");
          // Ensure rawTextInput exists before trying to clear it
          const rawTextInputElement = document.getElementById("rawTextInput");
          if (rawTextInputElement) rawTextInputElement.value = ""; 
        } else {
          this.uiManager.showResponse(`Send error: ${result.message}`, false, "system_error");
        }
      });
    } else {
      console.warn('[main.js] sendRawTextButton element not found, skipping listener attachment.');
    }

    // Enter key for text command
    const rawTextInputElement = document.getElementById("rawTextInput");
    if (rawTextInputElement) {
      rawTextInputElement.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          // Ensure sendRawTextButtonElement exists before trying to click it
          if (sendRawTextButtonElement) sendRawTextButtonElement.click(); 
        }
      });
    } else {
      console.warn('[main.js] rawTextInput element not found, skipping keydown listener attachment.');
    }

    // Sort Messages (original button)
    const sortButton = document.getElementById("sortMessagesButton");
    if (sortButton) {
      sortButton.addEventListener("click", () => {
        if (this.uiManager && typeof this.uiManager.toggleMessageSort === 'function') {
          this.uiManager.toggleMessageSort();
        } else {
          console.error('[main.js] this.uiManager or toggleMessageSort is not available.', this.uiManager);
        }
      });
    } else {
      console.warn('[main.js] sortMessagesButton element not found, skipping listener attachment.');
    }
  }

  updateVariableInputs() {
    const container = document.getElementById("variableInputsContainer");
    this.commandManager.generateVariableInputsUI(container, () => {
      this.uiManager.updateFilledJsonDisplay(this.commandManager.getCurrentFilledCommand());
    });
  }

  validateVariableInputs() {
    const container = document.getElementById("variableInputsContainer");
    const allFilled = this.commandManager.areAllVariablesFilled(container);
    
    if (!allFilled) {
      this.uiManager.showResponse('Please fill in all required variables', true, "system_warn");
      return false;
    }
    return true;
  }

  validateAndSendCommand() {
    if (!this.connectionManager.isWebSocketConnected()) {
      this.uiManager.showResponse('WebSocket not connected', true, "system_error");
      return false;
    }

    return this.validateVariableInputs();
  }

  // Handle command selection from tabs
  handleCommandSelection(commandJson) {
    this.commandManager.setCurrentCommand(commandJson);
    this.updateVariableInputs();
    this.uiManager.updateRawJsonDisplay(this.commandManager.getCurrentTemplateCommand());
    this.uiManager.updateFilledJsonDisplay(this.commandManager.getCurrentFilledCommand());
  }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.initialize();
  
  // Make app globally available for command selection callbacks
  window.commanderApp = app;

  // Fetch and display project version
  fetchAndDisplayVersion();
});

// Function to fetch and display project version
async function fetchAndDisplayVersion() {
  try {
    const response = await fetch('/api/version');
    if (!response.ok) {
      console.error('Failed to fetch version:', response.status, response.statusText);
      const versionElem = document.getElementById('projectVersion');
      if (versionElem) {
        versionElem.textContent = 'Version: N/A';
      }
      return;
    }
    const version = await response.text();
    const versionElem = document.getElementById('projectVersion');
    if (versionElem) {
      versionElem.textContent = `Version: ${version}`;
    } else {
      console.warn('projectVersion element not found in the DOM.');
    }
  } catch (error) {
    console.error('Error fetching or displaying version:', error);
    const versionElem = document.getElementById('projectVersion');
    if (versionElem) {
      versionElem.textContent = 'Version: Error';
    }
  }
} 