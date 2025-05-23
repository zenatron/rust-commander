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
  }

  // Command palette functionality - create tabs and command lists
  populateCommandPalette(commandsData) {
    const tabContainer = document.getElementById("tabContainer");
    const tabContentContainer = document.getElementById("tabContentContainer");
    
    // Clear existing content
    tabContainer.innerHTML = "";
    tabContentContainer.innerHTML = "";

    // Helper function to recursively collect all commands from nested objects
    const collectCommands = (obj, prefix = "") => {
      const commands = [];
      
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          const value = obj[key];
          const fullKey = prefix ? `${prefix}.${key}` : key;
          
          if (typeof value === "object" && value !== null && !Array.isArray(value)) {
            // If it's an object, check if it looks like a command or if it contains commands
            const hasCommandProperties = Object.keys(value).some(k => 
              typeof value[k] !== "object" || Array.isArray(value[k])
            );
            
            if (hasCommandProperties) {
              // This is a command object
              commands.push({ name: fullKey, command: value });
            } else {
              // This contains nested commands, recurse
              commands.push(...collectCommands(value, fullKey));
            }
          } else {
            // This is a direct command value
            commands.push({ name: fullKey, command: value });
          }
        }
      }
      
      return commands;
    };

    // Create tabs for each top-level key
    for (const tabKey in commandsData) {
      if (commandsData.hasOwnProperty(tabKey)) {
        const tabCommands = collectCommands(commandsData[tabKey]);
        
        // Create tab button
        const tab = document.createElement("div");
        tab.className = "tab";
        tab.textContent = tabKey;
        tab.addEventListener("click", () => this.activateTab(tab, tabKey));
        tabContainer.appendChild(tab);

        // Create tab content
        const tabContent = document.createElement("div");
        tabContent.className = "tab-content";
        tabContent.id = `tab-${tabKey}`;
        
        const commandList = document.createElement("ul");
        commandList.className = "command-list";
        
        // Add all commands for this tab
        tabCommands.forEach(({ name, command }) => {
          const listItem = document.createElement("li");
          listItem.textContent = name;
          listItem.addEventListener("click", () => {
            window.commanderApp.handleCommandSelection(JSON.stringify(command));
          });
          commandList.appendChild(listItem);
        });
        
        tabContent.appendChild(commandList);
        tabContentContainer.appendChild(tabContent);
      }
    }
    
    // Activate first tab
    const firstTab = tabContainer.querySelector(".tab");
    if (firstTab) {
      this.activateTab(firstTab, firstTab.textContent);
    }
  }

  // Activate a tab
  activateTab(activeTab, tabKey) {
    // Remove active class from all tabs and contents
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

    // Add active class to selected tab and content
    activeTab.classList.add('active');
    const content = document.getElementById(`tab-${tabKey}`);
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

  // Show response in the response div
  showResponse(message) {
    const responseDiv = document.getElementById("response");
    responseDiv.textContent = message;
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