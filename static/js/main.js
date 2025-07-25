// Main application module
import { CommandManager } from './commands.js';
import { ConnectionManager } from './connection.js';
import { UIManager } from './ui.js';
import { SaveManager } from './save.js';
import { CommandOptionsManager } from './command-options.js';
import { MessagesManager } from './messages.js';

class App {
  constructor() {
    this.messagesManager = MessagesManager.getInstance();
    this.uiManager = new UIManager(this.messagesManager);
    this.commandManager = new CommandManager();
    this.uiManager.setCommandManager(this.commandManager);
    this.connectionManager = new ConnectionManager(
      (message, type) => this.messagesManager.addMessage(message, type),
      (isConnected) => this.uiManager.updateConnectionStatus(isConnected)
    );
    this.saveManager = new SaveManager(this.commandManager, this.uiManager);
    this.commandOptionsManager = new CommandOptionsManager(this.commandManager, this.uiManager, this.saveManager);
  }

  async initialize() {
    console.log('Initializing Commander app...');
    
    // Initialize UI
    this.uiManager.initialize();
    
    // Load initial commands (now palettes)
    await this.fetchPalettes(); // Initially fetch all palettes
    
    // Setup event listeners
    this.setupEventListeners();
    
    
    console.log('Commander app initialized');
  }

  async fetchPalettes() {
    try {
      const response = await fetch('/api/palettes');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const palettes = await response.json();
      this.uiManager.populatePaletteSelector(palettes);
      if (palettes.length > 0) {
        // Automatically load the first palette if available
        await this.loadPalette(palettes[0]); 
      } else {
        this.uiManager.showResponse("No palettes found. Create or upload a palette.", true, "info");
        this.uiManager.clearCommandPalette(); // Clear commands if no palette is loaded
      }
    } catch (error) {
      console.error('Error fetching palettes:', error);
      this.uiManager.showResponse(`Error fetching palettes: ${error.message}`, true, "error");
      this.uiManager.clearCommandPalette();
    }
  }

  async loadPalette(paletteName, skipAutoActivation = false) {
    if (!paletteName) {
        this.uiManager.showResponse("No palette specified to load.", true, "warn");
        this.uiManager.clearCommandPalette();
        return;
    }
    try {
      const response = await fetch(`/api/palettes/${paletteName}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const paletteData = await response.json();
      const loadResult = this.commandManager.loadCommandsFromJson(paletteData);
      
      // Pass only the commands map to populateCommandPalette
      if (loadResult.success && loadResult.data) {
        this.uiManager.populateCommandPalette(loadResult.data, skipAutoActivation);
      } else {
        // Handle cases where commandsData might not be in the expected format or empty
        console.error("Loaded palette data is not in the expected format or failed to load:", paletteData);
        this.uiManager.clearCommandPalette(); // Clear UI if data is bad
        this.uiManager.showResponse(loadResult.error || "Error: Loaded palette data is not in the expected format.", true, "error");
      }
      
      this.uiManager.updateLoadedPaletteName(paletteName);
      this.uiManager.setSelectedPalette(paletteName);
      this.uiManager.showResponse(`Palette '${paletteName}' loaded successfully.`, true, "success");
    } catch (error) {
      console.error(`Error loading palette ${paletteName}:`, error);
      this.uiManager.showResponse(`Error loading palette '${paletteName}': ${error.message}`, true, "error");
      this.uiManager.clearCommandPalette();
      this.uiManager.updateLoadedPaletteName(""); // Clear loaded palette name on error
    }
  }

  async saveCurrentPalette() {
    const paletteName = this.uiManager.getCurrentPaletteName();
    if (!paletteName) {
      this.uiManager.showResponse("No palette selected to save.", "error");
      return;
    }

    const commands = this.commandManager.getCommandsData();
    if (!commands) {
      this.uiManager.showResponse("No command data to save.", "error");
      return;
    }

    try {
      const response = await fetch(`/api/palettes/${paletteName}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: paletteName, commands: commands }),
      });

      if (response.ok) {
        this.uiManager.showResponse(`Palette '${paletteName}' saved successfully.`, "success");
      } else {
        const errorText = await response.text();
        this.uiManager.showResponse(`Error saving palette: ${errorText}`, "error");
      }
    } catch (error) {
      console.error('Error saving palette:', error);
      this.uiManager.showResponse(`Error saving palette: ${error.message}`, "error");
    }
  }
  
  async createNewPalette() {
    const paletteName = prompt("Enter name for the new palette:");
    if (!paletteName || paletteName.trim() === "") {
        this.uiManager.showResponse("Palette name cannot be empty.", true, "warn");
        return;
    }

    const emptyPaletteData = {};

    try {
        const response = await fetch('/api/palettes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: paletteName, commands: emptyPaletteData }),
        });
        if (!response.ok) {
            const errorData = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorData}`);
        }
        this.uiManager.showResponse(`Palette '${paletteName}' created successfully.`, true, "success");
        
        // Clear existing command selection state before loading new empty palette
        this.commandManager.clearAllCommands();
        this.uiManager.clearCommandSelection();
        
        await this.fetchPalettes();
        this.uiManager.setSelectedPalette(paletteName);
        await this.loadPalette(paletteName);
    } catch (error) {
        console.error(`Error creating palette ${paletteName}:`, error);
        this.uiManager.showResponse(`Error creating palette '${paletteName}': ${error.message}`, true, "error");
    }
  }


  async deletePalette() {
    const paletteName = this.uiManager.getCurrentPaletteName();
    if (!paletteName) {
      this.uiManager.showResponse("No palette specified to delete.", true, "warn");
      return;
    }
    if (!confirm(`Are you sure you want to delete the palette '${paletteName}'? This action cannot be undone.`)) {
        return;
    }
    try {
      const response = await fetch(`/api/palettes/${paletteName}`, { method: 'DELETE' });
      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorData}`);
      }
      this.uiManager.showResponse(`Palette '${paletteName}' deleted successfully.`, true, "success");
      await this.fetchPalettes(); // Refresh the list

      // The original logic here was flawed. After deleting the selected palette,
      // we must always clear the state and load a new palette if one exists.
      this.commandManager.clearAllCommands();
      this.uiManager.clearCommandPalette();
      this.uiManager.updateLoadedPaletteName(""); 
      const palettes = this.uiManager.getPaletteList();
      if (palettes.length > 0) {
          await this.loadPalette(palettes[0]);
      }
    } catch (error) {
      console.error(`Error deleting palette ${paletteName}:`, error);
      this.uiManager.showResponse(`Error deleting palette '${paletteName}': ${error.message}`, true, "error");
    }
  }

  async savePaletteChanges(paletteName, newPaletteContentString) {
    if (!paletteName) {
      this.uiManager.showResponse("No palette name provided for saving changes.", true, "warn");
      return;
    }

    let commandsObject;
    try {
      commandsObject = JSON.parse(newPaletteContentString);
    } catch (e) {
      this.uiManager.showResponse("Invalid JSON format in editor. Cannot save changes.", true, "error");
      return;
    }

    const payload = {
      name: paletteName,
      commands: commandsObject
    };

    try {
      // Before saving, store the current command's info
      const previousCommandInfo = this.uiManager.getCurrentCommandInfo();

      const response = await fetch(`/api/palettes/${encodeURIComponent(paletteName)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload), // Send the full PalettePayload structure
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorData}`);
      }
      this.uiManager.showResponse(`Palette '${paletteName}' updated successfully.`, true, "success");
      await this.fetchPalettes(); // Refresh palette list
      this.uiManager.setSelectedPalette(paletteName); // Reselect the updated palette
      await this.loadPalette(paletteName, true); // Reload the updated palette

      // After reloading, check if the previously selected command still exists
      if (previousCommandInfo) {
        const commandStillExists = this.commandManager.doesCommandExist(
          previousCommandInfo.categoryName,
          previousCommandInfo.commandName
        );

        if (!commandStillExists) {
          this.uiManager.clearCommandSelection();
        } else {
          // If it exists, re-select it (or just the tab)
          this.uiManager.restoreTabAndCommand(previousCommandInfo.categoryName, previousCommandInfo.commandName);
        }
      }
    } catch (error) {
      console.error('Error saving palette changes:', error);
      this.uiManager.showResponse(`Error updating palette '${paletteName}': ${error.message}`, true, "error");
    }
  }

  // Settings Modal Methods
  showSettingsModal() {
    const modal = document.getElementById("settingsModal");
    if (!modal) {
      console.error("Settings modal not found.");
      return;
    }

    // Update version dynamically from the main version display
    const projectVersionElem = document.getElementById('projectVersion');
    const settingsVersionElem = document.getElementById('settingsVersionText');
    if (projectVersionElem && settingsVersionElem) {
      // Extract just the version part (remove "Version: " prefix)
      const versionText = projectVersionElem.textContent.replace('Version: ', '');
      settingsVersionElem.textContent = versionText;
    }

    modal.style.display = "block";
    
    // Add click outside to close functionality (remove any existing listeners first)
    const clickOutsideHandler = (e) => {
      if (e.target === modal) {
        this.hideSettingsModal();
        modal.removeEventListener('click', clickOutsideHandler);
      }
    };
    modal.addEventListener('click', clickOutsideHandler);

    // Add escape key to close functionality
    const escapeKeyListener = (e) => {
      if (e.key === 'Escape') {
        this.hideSettingsModal();
        document.removeEventListener('keydown', escapeKeyListener);
      }
    };
    document.addEventListener('keydown', escapeKeyListener);
    
    // Store the listener for cleanup
    modal._clickHandler = clickOutsideHandler;
    modal._escapeHandler = escapeKeyListener;
  }

  hideSettingsModal() {
    const modal = document.getElementById("settingsModal");
    if (modal) {
      modal.style.display = "none";
      
      // Clean up event listeners
      if (modal._clickHandler) {
        modal.removeEventListener('click', modal._clickHandler);
        modal._clickHandler = null;
      }
      if (modal._escapeHandler) {
        document.removeEventListener('keydown', modal._escapeHandler);
        modal._escapeHandler = null;
      }
    }
  }

  setupEventListeners() {
    // TCP Connection (using original header element IDs)
    document.getElementById("connectButton_header").addEventListener("click", async () => {
      const socketPath = document.getElementById("socket_path_header").value.trim();
      if (!socketPath) {
        this.uiManager.showResponse('Please enter a socket path', true, "warn");
        return;
      }

      // Get the result from the connection manager
      const result = await this.connectionManager.connectTCP(socketPath);
      // Apply appropriate styling based on success/failure
      const messageType = result.success ? "success" : "error";
      this.uiManager.showResponse(result.message, false, messageType);
    });

    document.getElementById("disconnectButton_header").addEventListener("click", async () => {
      // Get the result from the disconnection manager
      const result = await this.connectionManager.disconnectTCP();
      // Apply appropriate styling based on success/failure
      const messageType = result.success ? "info" : "error";
      this.uiManager.showResponse(result.message, false, messageType);
    });

    document.getElementById("uploadCommandFileButton").addEventListener("click", () => {
      document.getElementById("paletteFileUpload").click();
    });
    
    // Listener for the new palette file upload input
    const paletteFileUploadInput = document.getElementById("paletteFileUpload");
    if (paletteFileUploadInput) {
        paletteFileUploadInput.addEventListener("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const paletteName = prompt("Enter name for the new palette (e.g., from filename):", file.name.replace(/\.[^/.]+$/, ""));
            if (!paletteName || paletteName.trim() === "") {
                this.uiManager.showResponse("Palette name cannot be empty for import.", true, "warn");
                return;
            }

            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const commandsData = JSON.parse(event.target.result);
                    const response = await fetch('/api/palettes', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: paletteName, commands: commandsData }),
                    });
                    if (!response.ok) {
                        const errorData = await response.text();
                        throw new Error(`HTTP error! status: ${response.status}, message: ${errorData}`);
                    }
                    this.uiManager.showResponse(`Palette '${paletteName}' created from file '${file.name}' and loaded.`, true, "success");
                    
                    // Clear existing command selection state before loading imported palette
                    this.commandManager.clearAllCommands();
                    this.uiManager.clearCommandSelection();
                    
                    await this.fetchPalettes();
                    this.uiManager.setSelectedPalette(paletteName);
                    await this.loadPalette(paletteName);
                } catch (jsonError) {
                    this.uiManager.showResponse(`Error parsing JSON from ${file.name}: ${jsonError.message}`, true, "error");
                }
            };
            reader.onerror = () => {
                this.uiManager.showResponse(`Error reading file ${file.name}.`, true, "error");
            };
            reader.readAsText(file);
        });
    } else {
        console.warn("[main.js] paletteFileUpload input not found.");
    }


    // Palette Selector Event Listener
    const paletteSelector = document.getElementById("paletteSelector");
    if (paletteSelector) {
        paletteSelector.addEventListener("change", async (e) => {
            const selectedPalette = e.target.value;
            if (selectedPalette) {
                await this.loadPalette(selectedPalette);
            } else {
                // Handle case where "Select Palette" or empty option is chosen
                this.commandManager.clearAllCommands();
                this.uiManager.clearCommandPalette();
                this.uiManager.updateLoadedPaletteName("");
            }
        });
    } else {
        console.warn("[main.js] paletteSelector element not found.");
    }

    // Create New Palette Button
    const createPaletteButton = document.getElementById("createPaletteButton");
    if (createPaletteButton) {
        createPaletteButton.addEventListener("click", async () => {
            await this.createNewPalette();
        });
    } else {
        console.warn("[main.js] createPaletteButton element not found.");
    }

    // Delete Palette Button
    const deletePaletteButton = document.getElementById("deletePaletteButton");
    if (deletePaletteButton) {
        deletePaletteButton.addEventListener("click", async () => {
            await this.deletePalette();
        });
    } else {
        console.warn("[main.js] deletePaletteButton element not found.");
    }

    // Edit Palette Button
    const editPaletteButton = document.getElementById("editPaletteButton");
    if (editPaletteButton) {
      editPaletteButton.addEventListener("click", () => this.uiManager.showEditPaletteModal(this.commandManager.getCommandsData(), this.uiManager.getCurrentPaletteName()));
    } else {
      console.warn("[main.js] editPaletteButton element not found.");
    }

    // Modal Buttons for Edit Palette
    const savePaletteChangesButton = document.getElementById("savePaletteChangesButton");
    if (savePaletteChangesButton) {
      savePaletteChangesButton.addEventListener("click", async () => {
        const currentPaletteName = this.uiManager.getCurrentPaletteName();
        const newPaletteContent = this.uiManager.getPaletteEditorContent();
        
        if (newPaletteContent === null) {
            // A null return from getPaletteEditorContent means an error (like invalid JSON)
            // has already been shown to the user from the UIManager, so we just stop.
            return;
        }

        let commands;
        try {
            // The content from the editor is a string, parse it to an object.
            commands = JSON.parse(newPaletteContent);
        } catch (e) {
            // This is a fallback, but getPaletteEditorContent should have caught this.
            this.uiManager.showResponse("Invalid JSON format in editor.", true, "error");
            return;
        }

        // Check if the resulting command object is empty.
        if (Object.keys(commands).length === 0) {
            this.uiManager.showResponse("Palette content cannot be empty.", true, "warn");
            return;
        }

        // If all checks pass, save the changes.
        await this.savePaletteChanges(currentPaletteName, newPaletteContent);
        this.uiManager.hideEditPaletteModal();
      });
    } else {
        console.warn("[main.js] savePaletteChangesButton element not found.");
    }

    const cancelEditPaletteButton = document.getElementById("cancelEditPaletteButton");
    if (cancelEditPaletteButton) {
      cancelEditPaletteButton.addEventListener("click", () => {
        this.uiManager.attemptHideEditPaletteModal();
      });
    } else {
        console.warn("[main.js] cancelEditPaletteButton element not found.");
    }

    const closeEditModalButton = document.getElementById("closeEditModal");
    if (closeEditModalButton) {
        closeEditModalButton.addEventListener("click", () => {
            this.uiManager.attemptHideEditPaletteModal();
        });
    } else {
        console.warn("[main.js] closeEditModalButton element not found.");
    }

    // Add Category Button in Edit Palette Modal
    const addCategoryButton = document.getElementById("addCategoryButton");
    if (addCategoryButton) {
        addCategoryButton.addEventListener("click", () => {
            this.uiManager.addNewCategory();
        });
    } else {
        console.warn("[main.js] addCategoryButton element not found.");
    }

    // Settings Modal Event Listeners
    const settingsButton = document.getElementById("settingsButton");
    if (settingsButton) {
        settingsButton.addEventListener("click", () => {
            this.showSettingsModal();
        });
    } else {
        console.warn("[main.js] settingsButton element not found.");
    }

    const closeSettingsModalButton = document.getElementById("closeSettingsModal");
    if (closeSettingsModalButton) {
        closeSettingsModalButton.addEventListener("click", () => {
            this.hideSettingsModal();
        });
    } else {
        console.warn("[main.js] closeSettingsModal element not found.");
    }

    // Send Command (original send button)
    document.getElementById("sendButton").addEventListener("click", async () => {
      await this.handleSendCommand();
    });

    // Command Options (main button next to Send)
    document.getElementById("commandOptionsButton_main").addEventListener("click", () => {
      // Allow command options regardless of variable input state
      // Users should be able to save, edit, or delete commands even with incomplete variables
      this.commandOptionsManager.showCommandOptionsModal();
    });

    // Sort Messages button is now handled by MessagesManager during initialization

    // Global keyboard shortcut: Shift+Enter to send command
    document.addEventListener('keydown', async (e) => {
      if (e.shiftKey && e.key === 'Enter') {
        e.preventDefault(); // Prevent default behavior (like adding new line in textareas)
        await this.handleSendCommand();
      }
    });

    if (this.commandManager) {
        this.commandManager.clearCurrentCommand();
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
      this.uiManager.showResponse('Please fill in all required variables', true, "warn");
      return false;
    }
    return true;
  }

  validateAndSendCommand() {
    if (!this.connectionManager.isWebSocketConnected()) {
      this.uiManager.showResponse('WebSocket not connected', true, "error");
      return false;
    }

    return this.validateVariableInputs();
  }

  // Handle sending command (used by both send button and keyboard shortcut)
  async handleSendCommand() {
    if (!this.validateAndSendCommand()) return;

    const command = this.commandManager.getCurrentFilledCommand();
    const delimiterInput = document.getElementById("commandDelimiterInput");
    const delimiter = delimiterInput ? delimiterInput.value : null; // Get delimiter, or null if input not found

    const result = await this.connectionManager.sendCommand(command, delimiter);

    if (result.success) {
      this.uiManager.addMessage(JSON.stringify(command) + (delimiter ? ` (delim: '${delimiter}')` : ''), "sent");
    } else {
      // Apply error styling to the response div
      this.uiManager.showResponse(`Send error: ${result.message}`, false, "error");
    }
  }

  // Handle command selection from tabs
  handleCommandSelection(commandJson) {
    this.commandManager.setCurrentCommand(commandJson);
    this.updateVariableInputs();
    this.uiManager.updateRawJsonDisplay(this.commandManager.getCurrentTemplateCommand());
    this.uiManager.updateFilledJsonDisplay(this.commandManager.getCurrentFilledCommand());
    
    // Update the selected command name display
    this.updateSelectedCommandNameDisplay();
  }
  
  // Update the selected command name in the UI
  updateSelectedCommandNameDisplay() {
    const selectedCommandNameElement = document.getElementById("selectedCommandName");
    if (!selectedCommandNameElement) return;
    
    const commandInfo = this.uiManager.getCurrentCommandInfo();
    if (commandInfo && commandInfo.commandName) {
      selectedCommandNameElement.textContent = commandInfo.commandName;
    } else {
      selectedCommandNameElement.textContent = "No command selected";
    }
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