// UI management module
export class UIManager {
  constructor() {
    this.messageHistory = [];
    this.messageId = 0;
    this.isSortedNewestFirst = false;
    this.isRawJsonExpanded = false;
    this.isFilledJsonExpanded = false;
    this.commandManager = null;
    
    // Initialize toggle buttons
    // We'll initialize toggles after setting commandManager
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
  populateCommandPalette(commandsData) {
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
      // tabButton.dataset.tabKey = key; // Not strictly needed if using textContent for activateTab
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
          } catch (e) {
            console.error("Error stringifying command data for palette:", commandName, commandData, e);
            // Skip adding this command if it can't be stringified
            continue;
          }


          listItem.addEventListener("click", (e) => {
            const cmdJsonString = e.target.dataset.commandJsonString;
            if (cmdJsonString) {
               // The app instance (window.commanderApp) will handle this
              window.commanderApp.handleCommandSelection(cmdJsonString);
            } else {
              console.error("Command JSON string not found on list item", e.target);
              this.showResponse("Error: Could not load selected command details.", true, "system_error");
            }
          });
          commandListUL.appendChild(listItem);
        }
      }
      tabContent.appendChild(commandListUL);

      if (!firstTabInitialized && index === 0) {
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

  initializeJsonToggles() {
    const rawToggle = document.getElementById('rawJsonToggle');
    const filledToggle = document.getElementById('filledJsonToggle');

    rawToggle.addEventListener('click', () => {
      this.isRawJsonExpanded = !this.isRawJsonExpanded;
      rawToggle.textContent = this.isRawJsonExpanded ? 'Expanded' : 'Compact';
      rawToggle.classList.toggle('expanded', this.isRawJsonExpanded);
      
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
      filledToggle.textContent = this.isFilledJsonExpanded ? 'Expanded' : 'Compact';
      filledToggle.classList.toggle('expanded', this.isFilledJsonExpanded);
      
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
}

// Global utility function for copy button (if needed)
window.copyToClipboard = function(text) {
  navigator.clipboard.writeText(text).then(() => {
    console.log("Copied to clipboard:", text);
  }).catch(err => {
    console.error("Failed to copy to clipboard:", err);
  });
}; 