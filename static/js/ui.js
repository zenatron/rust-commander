// UI management module
export class UIManager {
  constructor() {
    this.messageHistory = [];
    this.messageId = 0;
    this.isSortedNewestFirst = false;
    this.isRawJsonExpanded = false;
    this.isFilledJsonExpanded = false;
    this.commandManager = null;
    this.activeCommandElement = null; // Track the currently active command element
    this.currentCommandInfo = null; // Store detailed info about selected command

    this.initializeResizeHandle();
    this.loadedPaletteName = "";
    this.palettes = [];
  }

  // Set command manager reference
  setCommandManager(commandManager) {
    this.commandManager = commandManager;
    this.initializeJsonToggles();
  }

  // Initialize UI
  initialize() {
    this.updateConnectionStatus(false);
    
    // Set initial style for response div
    const responseDiv = document.getElementById("response");
    responseDiv.classList.add("response-info");
  }

  // Command palette functionality - create tabs and command lists
  populateCommandPalette(commandsData, skipAutoActivation = false) {
    const tabContainer = document.getElementById("tabContainer");
    const tabContentContainer = document.getElementById("tabContentContainer");

    // Clear existing content
    tabContainer.innerHTML = "";
    tabContentContainer.innerHTML = "";
    // Clear related UI elements
    const rawJsonDisplayElement = document.getElementById("rawJsonDisplay");
    const filledJsonDisplayElement = document.getElementById("filledJsonDisplay");
    const variableInputsContainer = document.getElementById("variableInputsContainer");
    if (rawJsonDisplayElement) rawJsonDisplayElement.innerHTML = "";
    if (filledJsonDisplayElement) filledJsonDisplayElement.innerHTML = "";
    if (variableInputsContainer) variableInputsContainer.innerHTML = '<p class="no-variables-message">Select a command to see details.</p>';


    if (Object.keys(commandsData).length === 0) {
      tabContainer.textContent = "No commands loaded or error in loading.";
      tabContentContainer.innerHTML = ""; // Also clear content container
      // Clear other related UI elements as before
      const rawJsonDisplayElement = document.getElementById("rawJsonDisplay");
      const filledJsonDisplayElement = document.getElementById("filledJsonDisplay");
      const variableInputsContainer = document.getElementById("variableInputsContainer");
      if (rawJsonDisplayElement) rawJsonDisplayElement.innerHTML = "";
      if (filledJsonDisplayElement) filledJsonDisplayElement.innerHTML = "";
      if (variableInputsContainer) variableInputsContainer.innerHTML = '<p class="no-variables-message">Select a command to see details.</p>';
      return;
    }

    let firstTabInitialized = false;

    const topLevelKeys = Object.keys(commandsData);
    topLevelKeys.forEach((key, index) => {
      const nestedCommands = commandsData[key];
      if (typeof nestedCommands !== 'object' || nestedCommands === null || Object.keys(nestedCommands).length === 0) {
        console.warn(`Skipping tab ${key} due to invalid or empty nestedCommands`);
        return; // Skip if not an object or is empty
      }

      const tabButton = document.createElement("div");
      tabButton.classList.add("tab");
      tabButton.textContent = key;
      tabContainer.appendChild(tabButton);

      const tabContent = document.createElement("div");
      tabContent.classList.add("tab-content");
      tabContent.id = `tab-${key.replace(/\s+/g, "-")}`; // Ensure IDs are valid
      tabContentContainer.appendChild(tabContent);

      const commandListUL = document.createElement("ul");
      commandListUL.classList.add("command-list");

      for (const commandName in nestedCommands) {
        if (nestedCommands.hasOwnProperty(commandName)) {
          const commandData = nestedCommands[commandName];
          const listItem = document.createElement("li");
          listItem.textContent = commandName;
          // Store the actual command object or its JSON string. Storing object directly is fine if not too large.
          // For consistency with previous patterns and explicit data handling:
          try {
            listItem.dataset.commandJsonString = JSON.stringify(commandData);
            
            // Store detailed command info for reliable tracking
            const commandInfo = {
              paletteName: this.getCurrentPaletteName(),
              categoryName: key,
              commandName: commandName,
              commandData: commandData
            };
            listItem.dataset.commandInfo = JSON.stringify(commandInfo);
          } catch (e) {
            console.error("Error stringifying command data for palette:", commandName, commandData, e);
            // Skip adding this command if it can't be stringified
            continue;
          }


          listItem.addEventListener("click", (e) => {
            const cmdJsonString = e.target.dataset.commandJsonString;
            const commandInfoString = e.target.dataset.commandInfo;
            
            if (cmdJsonString && commandInfoString) {
               // Update active command highlighting and store command info
              this.setActiveCommand(e.target, JSON.parse(commandInfoString));
               // The app instance (window.commanderApp) will handle this
              window.commanderApp.handleCommandSelection(cmdJsonString);
            } else {
              console.error("Command data not found on list item", e.target);
              this.showResponse("Error: Could not load selected command details.", true, "system_error");
            }
          });
          commandListUL.appendChild(listItem);
        }
      }
      tabContent.appendChild(commandListUL);

      if (!firstTabInitialized && index === 0 && !skipAutoActivation) {
        // Use the activateTab method to ensure consistency
        this.activateTab(tabButton, key);
        firstTabInitialized = true;
      }

      tabButton.addEventListener("click", () => {
        this.activateTab(tabButton, key);
      });
    });
  }

  // Activate a tab
  activateTab(activeTab, tabKey) {
    // Remove active class from all tabs and contents
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Add active class to selected tab and content
    activeTab.classList.add('active');
    // Ensure the tabKey used for ID lookup is processed the same way as when the ID was created
    const contentId = `tab-${tabKey.replace(/\s+/g, "-")}`;
    const content = document.getElementById(contentId);
    if (content) {
      content.classList.add('active');
    }
  }

  // Update connection status
  updateConnectionStatus(isConnected) {
    const statusElement = document.getElementById("connectionStatus");
    const connectBtn = document.getElementById("connectButton_header");
    const disconnectBtn = document.getElementById("disconnectButton_header");
    
    if (isConnected) {
      statusElement.textContent = "Connected";
      statusElement.className = "status-connected";
      connectBtn.style.display = "none";
      disconnectBtn.style.display = "inline-block";
    } else {
      statusElement.textContent = "Disconnected";
      statusElement.className = "status-disconnected";
      connectBtn.style.display = "inline-block";
      disconnectBtn.style.display = "none";
    }
  }

  // Show response in the response div and add to message panel
  showResponse(message, addSystemMessage = true, messageType = "system_info") {
    const responseDiv = document.getElementById("response");
    responseDiv.textContent = message;
    
    // Apply appropriate styling to the response div based on message type
    responseDiv.className = "";
    if (messageType === "system_info") {
      responseDiv.classList.add("response-info");
    } else if (messageType === "system_warn") {
      responseDiv.classList.add("response-warn");
    } else if (messageType === "system_error") {
      responseDiv.classList.add("response-error");
    } else {
      responseDiv.classList.add("response-info"); // Default
    }
    
    // Also add the message to the message panel with system styling if requested
    if (addSystemMessage) {
      this.addMessage(message, messageType);
    }
  }

  // Update raw JSON display
  updateRawJsonDisplay(command) {
    const element = document.getElementById("rawJsonDisplay");
    if (command) {
      let jsonString;
      if (typeof command === 'string') {
        try {
          // If it's already a string, try to parse it first to ensure it's valid JSON
          const parsed = JSON.parse(command);
          jsonString = JSON.stringify(parsed, null, this.isRawJsonExpanded ? 2 : 0);
        } catch (e) {
          // If parsing fails, just use the string as is
          jsonString = command;
        }
      } else {
        // If it's an object, stringify it
        jsonString = JSON.stringify(command, null, this.isRawJsonExpanded ? 2 : 0);
      }
      element.innerHTML = this.generateHighlightedHtml(jsonString, { type: "raw" });
    } else {
      element.innerHTML = "";
    }
  }

  // Update filled JSON display
  updateFilledJsonDisplay(command) {
    const element = document.getElementById("filledJsonDisplay");
    if (command) {
      let jsonString;
      if (typeof command === 'string') {
        try {
          // If it's already a string, try to parse it first to ensure it's valid JSON
          const parsed = JSON.parse(command);
          jsonString = JSON.stringify(parsed, null, this.isFilledJsonExpanded ? 2 : 0);
        } catch (e) {
          // If parsing fails, just use the string as is
          jsonString = command;
        }
      } else {
        // If it's an object, stringify it
        jsonString = JSON.stringify(command, null, this.isFilledJsonExpanded ? 2 : 0);
      }
      element.innerHTML = this.generateHighlightedHtml(jsonString, { type: "filled" });
    } else {
      element.innerHTML = "";
    }
  }

  // Generate highlighted HTML for JSON
  generateHighlightedHtml(jsonString, highlightInstructions) {
    if (!jsonString) return "";

    let highlightClass = "";
    if (highlightInstructions.type === "raw") {
      highlightClass = "highlight-yellow";
    } else if (highlightInstructions.type === "filled") {
      highlightClass = "highlight-green";
    }

    if (!highlightClass || !jsonString.includes("%")) {
      return this.escapeHtml(jsonString);
    }

    const parts = jsonString.split("%");
    let processedLine = "";
    for (let i = 0; i < parts.length; i++) {
      processedLine += this.escapeHtml(parts[i]);
      if (i < parts.length - 1) {
        processedLine += `<span class="${highlightClass}">%</span>`;
      }
    }
    return processedLine;
  }

  // Message display functionality
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
    let messagesToShow = [...this.messageHistory];
    
    if (this.isSortedNewestFirst) {
      messagesToShow.reverse();
    }

    messagesElement.innerHTML = "";
    messagesToShow.forEach((msg) => {
      const timestamp = msg.timestamp.toLocaleTimeString();
      let messageText = msg.content;
      let displayType = msg.type.toUpperCase();
      
      // Handle message type display
      if (msg.type === "sent_text") {
        displayType = "SENT";
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
      messageDiv.className = `message-line message-${msg.type}`;
      messageDiv.textContent = `[${timestamp}] ${displayType}: ${messageText}`;
      messagesElement.appendChild(messageDiv);
    });
    
    // Auto-scroll to bottom (unless sorted newest first)
    if (!this.isSortedNewestFirst) {
      messagesElement.scrollTop = messagesElement.scrollHeight;
    }
  }

  // Toggle message sort
  toggleMessageSort() {
    this.isSortedNewestFirst = !this.isSortedNewestFirst;
    const button = document.getElementById("sortMessagesButton");
    button.textContent = this.isSortedNewestFirst ? "Sort Oldest First" : "Sort Newest First";
    this.updateMessagesDisplay();
  }

  // Utility function to escape HTML
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Clear messages
  clearMessages() {
    this.messageHistory = [];
    this.updateMessagesDisplay();
  }

  initializeResizeHandle() {
    const resizeHandle = document.getElementById('resizeHandle');
    const commandPaletteContainer = document.getElementById('tabContentContainer');
    // No need for formAndResponseArea directly in this simplified version

    if (!resizeHandle || !commandPaletteContainer) {
      console.warn('Resize handle or command palette container not found for resizing.');
      return;
    }

    let isResizing = false;
    let startX;
    let startWidth;

    resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent text selection and other default actions
      isResizing = true;
      startX = e.clientX;
      startWidth = commandPaletteContainer.offsetWidth;
      
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    });

    const handleMouseMove = (e) => {
      if (!isResizing) return;
      e.preventDefault();

      const deltaX = e.clientX - startX;
      let newWidth = startWidth + deltaX;

      // Define min and max widths (e.g., in pixels)
      const minWidth = 200; // Minimum width for the command palette
      const parentWidth = commandPaletteContainer.parentElement.offsetWidth;
      const resizeHandleWidth = resizeHandle.offsetWidth;
      // Max width should leave some space for the resize handle and a bit for the other panel
      const maxWidth = parentWidth - resizeHandleWidth - 50; 

      if (newWidth < minWidth) {
        newWidth = minWidth;
      } else if (newWidth > maxWidth) {
        newWidth = maxWidth;
      }
      
      commandPaletteContainer.style.width = `${newWidth}px`;
    };

    const handleMouseUp = (e) => {
      if (!isResizing) return;
      e.preventDefault();

      isResizing = false;
      document.body.style.cursor = 'default';
      document.body.style.userSelect = '';

      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
    };
  }

  initializeJsonToggles() {
    const rawToggle = document.getElementById('rawJsonToggle');
    const filledToggle = document.getElementById('filledJsonToggle');

    rawToggle.addEventListener('click', () => {
      this.isRawJsonExpanded = !this.isRawJsonExpanded;
      rawToggle.textContent = this.isRawJsonExpanded ? '➖' : '➕';
      
      // Get the current raw JSON content and reformat it
      const element = document.getElementById("rawJsonDisplay");
      if (element.textContent.trim() && this.commandManager) {
        const command = this.commandManager.getCurrentTemplateCommand();
        if (command) {
          this.updateRawJsonDisplay(command);
        }
      }
    });

    filledToggle.addEventListener('click', () => {
      this.isFilledJsonExpanded = !this.isFilledJsonExpanded;
      filledToggle.textContent = this.isFilledJsonExpanded ? '➖' : '➕';
      
      // Get the current filled JSON content and reformat it
      const element = document.getElementById("filledJsonDisplay");
      if (element.textContent.trim() && this.commandManager) {
        const command = this.commandManager.getCurrentFilledCommand();
        if (command) {
          this.updateFilledJsonDisplay(command);
        }
      }
    });
  }

  // Set active command highlighting
  setActiveCommand(commandElement, commandInfo = null) {
    // Remove active class from previously active command
    if (this.activeCommandElement) {
      this.activeCommandElement.classList.remove('active');
    }
    
    // Set new active command
    this.activeCommandElement = commandElement;
    this.currentCommandInfo = commandInfo;
    
    if (commandElement) {
      commandElement.classList.add('active');
    }
  }

  // Clear active command highlighting
  clearActiveCommand() {
    if (this.activeCommandElement) {
      this.activeCommandElement.classList.remove('active');
      this.activeCommandElement = null;
    }
    this.currentCommandInfo = null;
  }

  // Clear the command palette display (tabs and content)
  clearCommandPalette() {
    const tabContainer = document.getElementById("tabContainer");
    const tabContentContainer = document.getElementById("tabContentContainer");
    const rawJsonDisplayElement = document.getElementById("rawJsonDisplay");
    const filledJsonDisplayElement = document.getElementById("filledJsonDisplay");
    const variableInputsContainer = document.getElementById("variableInputsContainer");

    if (tabContainer) tabContainer.innerHTML = "<p>No palette loaded or palette is empty.</p>";
    if (tabContentContainer) tabContentContainer.innerHTML = "";
    if (rawJsonDisplayElement) rawJsonDisplayElement.innerHTML = "";
    if (filledJsonDisplayElement) filledJsonDisplayElement.innerHTML = "";
    if (variableInputsContainer) variableInputsContainer.innerHTML = '<p class="no-variables-message">Select a command to see details.</p>';
    
    // Clear active command highlighting
    this.clearActiveCommand();
    
    // Also clear current command selection in commandManager if it exists
    if (this.commandManager) {
        this.commandManager.clearCurrentCommand();
    }
    this.updateLoadedPaletteName(""); // Clear the displayed palette name
  }

  // Populate the palette selector dropdown
  populatePaletteSelector(palettes) {
    this.palettes = palettes; // Store for later use by getPaletteList
    const selector = document.getElementById("paletteSelector");
    if (!selector) {
        console.error("paletteSelector element not found");
        return;
    }
    selector.innerHTML = '<option value="">Select a Palette</option>'; // Default option
    palettes.forEach(paletteName => {
      const option = document.createElement("option");
      option.value = paletteName;
      option.textContent = paletteName;
      selector.appendChild(option);
    });
  }
  
  // Get the list of palettes currently in the selector
  getPaletteList() {
    return this.palettes;
  }

  // Set the selected value of the palette selector
  setSelectedPalette(paletteName) {
    const selector = document.getElementById("paletteSelector");
    if (selector) {
        selector.value = paletteName;
    }
  }

  // Update the displayed name of the loaded palette
  updateLoadedPaletteName(paletteName) {
    this.loadedPaletteName = paletteName;

    // Enable/disable save/delete/edit buttons based on whether a palette is loaded
    const saveButton = document.getElementById("savePaletteButton");
    const deleteButton = document.getElementById("deletePaletteButton");
    const editButton = document.getElementById("editPaletteButton"); // Get the new edit button

    if (saveButton) saveButton.disabled = !paletteName;
    if (deleteButton) deleteButton.disabled = !paletteName;
    if (editButton) editButton.disabled = !paletteName; // Enable/disable edit button
  }

  // Get the name of the currently selected/loaded palette
  getCurrentPaletteName() {
    const selector = document.getElementById("paletteSelector");
    if (selector && selector.value) {
        return selector.value;
    }
    return this.loadedPaletteName; // Fallback or primary source
  }

  // Get current command info for edit/delete operations
  getCurrentCommandInfo() {
    return this.currentCommandInfo;
  }

  // Restore command selection by command info after palette reload
  restoreCommandSelection(commandInfo) {
    if (!commandInfo) return false;
    
    // Find the command element that matches the command info
    const tabContentId = `tab-${commandInfo.categoryName.replace(/\s+/g, "-")}`;
    const tabContent = document.getElementById(tabContentId);
    
    if (!tabContent) return false;
    
    const commandList = tabContent.querySelector('.command-list');
    if (!commandList) return false;
    
    // Find the command item with matching data
    const commandItems = commandList.querySelectorAll('li');
    for (const item of commandItems) {
      const storedInfo = item.dataset.commandInfo;
      if (storedInfo) {
        try {
          const parsedInfo = JSON.parse(storedInfo);
          if (parsedInfo.commandName === commandInfo.commandName && 
              parsedInfo.categoryName === commandInfo.categoryName) {
            // Activate the tab first - find tab by text content
            const allTabs = document.querySelectorAll('.tab');
            let tabButton = null;
            for (const tab of allTabs) {
              if (tab.textContent.trim() === commandInfo.categoryName) {
                tabButton = tab;
                break;
              }
            }
            if (tabButton) {
              this.activateTab(tabButton, commandInfo.categoryName);
            }
            
            // Set active command and trigger selection
            this.setActiveCommand(item, parsedInfo);
            item.click();
            return true;
          }
        } catch (e) {
          console.error('Error parsing command info:', e);
        }
      }
    }
    
    return false;
  }

  // Modal handling for palette editor
  showEditPaletteModal(paletteContent) {
    const modal = document.getElementById("editPaletteModal");
    const textarea = document.getElementById("paletteEditorTextarea");
    if (modal && textarea) {
      textarea.value = paletteContent;
      modal.style.display = "block";
    } else {
      console.error("Edit palette modal or textarea not found.");
    }
  }

  hideEditPaletteModal() {
    const modal = document.getElementById("editPaletteModal");
    if (modal) {
      modal.style.display = "none";
    }
  }

  getPaletteEditorContent() {
    const textarea = document.getElementById("paletteEditorTextarea");
    return textarea ? textarea.value : null;
  }
}