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
      this.uiManager.showResponse('Commands loaded successfully.');
    } else {
      this.uiManager.showResponse(`Error loading commands: ${result.error}`);
    }
  }

  setupEventListeners() {
    // TCP Connection (using original header element IDs)
    document.getElementById("connectButton_header").addEventListener("click", async () => {
      const socketPath = document.getElementById("socket_path_header").value.trim();
      if (!socketPath) {
        this.uiManager.showResponse('Please enter a socket path');
        return;
      }

      const result = await this.connectionManager.connectTCP(socketPath);
      this.uiManager.showResponse(result.message);
    });

    document.getElementById("disconnectButton_header").addEventListener("click", async () => {
      const result = await this.connectionManager.disconnectTCP();
      this.uiManager.showResponse(result.message);
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
        this.uiManager.showResponse(`Commands loaded from ${file.name}`);
      } else {
        this.uiManager.showResponse(`Error loading ${file.name}: ${result.error}`);
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
        this.uiManager.showResponse(`Send error: ${result.message}`);
      }
    });

    // Save Command (original save button)
    document.getElementById("saveCommandButton").addEventListener("click", () => {
      if (!this.validateVariableInputs()) return;
      this.saveManager.showSaveModal();
    });

    // Raw Text Command (original elements)
    document.getElementById("sendRawTextButton").addEventListener("click", async () => {
      const textCommand = document.getElementById("rawTextInput").value.trim();
      if (!textCommand) {
        this.uiManager.showResponse('Please enter a text command');
        return;
      }

      const result = await this.connectionManager.sendTextCommand(textCommand);
      
      if (result.success) {
        this.uiManager.addMessage(textCommand, "sent_text");
        document.getElementById("rawTextInput").value = "";
      } else {
        this.uiManager.showResponse(`Send error: ${result.message}`);
      }
    });

    // Enter key for text command
    document.getElementById("rawTextInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        document.getElementById("sendRawTextButton").click();
      }
    });

    // Sort Messages (original button)
    document.getElementById("sortMessagesButton").addEventListener("click", () => {
      this.uiManager.toggleMessageSort();
    });
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
      this.uiManager.showResponse('Please fill in all required variables');
      return false;
    }
    return true;
  }

  validateAndSendCommand() {
    if (!this.connectionManager.isWebSocketConnected()) {
      this.uiManager.showResponse('WebSocket not connected');
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
}); 