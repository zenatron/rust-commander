// UI management module
export class UIManager {
  constructor(messagesManager) {
    this.messagesManager = messagesManager;
    this.isRawJsonExpanded = false;
    this.isFilledJsonExpanded = false;
    this.commandManager = null;
    this.activeCommandElement = null; // Track the currently active command element
    this.currentCommandInfo = null; // Store detailed info about selected command

    this.initializeResizeHandle();
    this.loadedPaletteName = "";
    this.palettes = [];
    this.editPaletteUnsavedChanges = false;
    this.editPaletteEscapeListener = null;
    this.editPaletteClickOutsideHandler = null;
  }

  // Set command manager reference
  setCommandManager(commandManager) {
    this.commandManager = commandManager;
    this.initializeJsonToggles();
  }

  // Initialize UI
  initialize() {
    this.updateConnectionStatus(false);
    if (!this.messagesManager) {
      console.error("Messages manager not found. Please ensure messages.js is properly loaded.");
    }
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
      tabContainer.innerHTML = '<p class="no-palette-message">This palette is empty. Create categories and commands using the Edit Palette option ✏️</p>';
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
      if (typeof nestedCommands !== 'object' || nestedCommands === null) {
        console.warn(`Skipping tab ${key} due to invalid nestedCommands (not an object or null)`);
        return; // Skip if not an object or null
      }
      // Note: Now allowing empty categories to be displayed

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

      const commandNames = Object.keys(nestedCommands);
      
      if (commandNames.length === 0) {
        // Display message for empty categories
        const emptyMessage = document.createElement("li");
        emptyMessage.className = "no-commands-message";
        emptyMessage.textContent = "Empty category ☹️";
        emptyMessage.style.fontStyle = "italic";
        emptyMessage.style.color = "#6c757d";
        emptyMessage.style.textAlign = "center";
        emptyMessage.style.padding = "20px";
        emptyMessage.style.cursor = "default";
        commandListUL.appendChild(emptyMessage);
      } else {
        // Populate with actual commands
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
                this.showResponse("Error: Could not load selected command details.", true, "error");
              }
            });
            commandListUL.appendChild(listItem);
          }
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
  showResponse(message, addSystemMessage = true, messageType = "info") {
    if (this.messagesManager) {
      this.messagesManager.showMessage(message, addSystemMessage, messageType);
    } else {
      // Fallback to console log if messages manager isn't available
      console.log(`[Messages Fallback] ${messageType}: ${message}`);
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

  // Message display functionality - delegate to MessagesManager
  addMessage(messageContent, messageType = "received") {
    if (this.messagesManager) {
      this.messagesManager.addMessage(messageContent, messageType);
    }
  }

  // Utility function to escape HTML
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Clear messages - delegate to MessagesManager
  clearMessages() {
    if (this.messagesManager) {
      this.messagesManager.clearMessages();
    }
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

  // Clear the entire command selection view
  clearCommandSelection() {
    this.clearActiveCommand();
    
    const rawJsonDisplayElement = document.getElementById("rawJsonDisplay");
    const filledJsonDisplayElement = document.getElementById("filledJsonDisplay");
    const variableInputsContainer = document.getElementById("variableInputsContainer");
    const selectedCommandNameElement = document.getElementById("selectedCommandName");

    if (rawJsonDisplayElement) rawJsonDisplayElement.innerHTML = "";
    if (filledJsonDisplayElement) filledJsonDisplayElement.innerHTML = "";
    if (variableInputsContainer) variableInputsContainer.innerHTML = '<p class="no-variables-message">Select a command to see details.</p>';
    if (selectedCommandNameElement) selectedCommandNameElement.textContent = "No command selected";

    if (this.commandManager) {
        this.commandManager.clearCurrentCommand();
    }
  }

  // Clear the command palette display (tabs and content)
  clearCommandPalette() {
    const tabContainer = document.getElementById("tabContainer");
    const tabContentContainer = document.getElementById("tabContentContainer");
    const rawJsonDisplayElement = document.getElementById("rawJsonDisplay");
    const filledJsonDisplayElement = document.getElementById("filledJsonDisplay");
    const variableInputsContainer = document.getElementById("variableInputsContainer");
    const selectedCommandNameElement = document.getElementById("selectedCommandName");

    if (tabContainer) {
      tabContainer.innerHTML = '<p class="no-palette-message">No palette loaded or palette is empty 📁</p>';
    }
    if (tabContentContainer) tabContentContainer.innerHTML = "";
    if (rawJsonDisplayElement) rawJsonDisplayElement.innerHTML = "";
    if (filledJsonDisplayElement) filledJsonDisplayElement.innerHTML = "";
    if (variableInputsContainer) variableInputsContainer.innerHTML = '<p class="no-variables-message">Select a command to see details.</p>';
    if (selectedCommandNameElement) selectedCommandNameElement.textContent = "No command selected";
    
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
  showEditPaletteModal(paletteData) {
    const modal = document.getElementById("editPaletteModal");
    if (!modal) {
      console.error("Edit palette modal not found.");
      return;
    }

    // Parse the palette data if it's a string
    let commandsData;
    try {
      commandsData = typeof paletteData === 'string' ? JSON.parse(paletteData) : paletteData;
    } catch (e) {
      console.error("Invalid palette data:", e);
      this.showResponse("Error: Invalid palette data format.", true, "error");
      return;
    }

    // Store the palette data for later use
    this.editingPaletteData = commandsData;

    // Reset unsaved flag
    this.editPaletteUnsavedChanges = false;

    // Create the tabbed interface
    this.createPaletteEditorTabs(commandsData);

    modal.style.display = "block";

    // Add click outside handler to close modal
    const clickOutsideHandler = (e) => {
      if (e.target === modal) {
        this.attemptHideEditPaletteModal();
      }
    };
    modal.addEventListener('click', clickOutsideHandler);
    this.editPaletteClickOutsideHandler = clickOutsideHandler;

    // Add escape key listener to close modal
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        this.attemptHideEditPaletteModal();
      }
    };
    document.addEventListener('keydown', escapeHandler);
    this.editPaletteEscapeListener = escapeHandler;
  }

  createPaletteEditorTabs(commandsData) {
    const tabsContainer = document.getElementById("paletteEditorTabs");
    const contentContainer = document.getElementById("paletteEditorContent");

    if (!tabsContainer || !contentContainer) {
      console.error("Palette editor containers not found.");
      return;
    }

    // Clear existing content
    tabsContainer.innerHTML = "";
    contentContainer.innerHTML = "";

    // Create tabs for each category
    const categories = Object.keys(commandsData);
    let firstTab = true;

    categories.forEach((categoryName, index) => {
      // Create tab button
      const tab = document.createElement("div");
      tab.className = `palette-editor-tab ${firstTab ? 'active' : ''}`;
      tab.dataset.category = categoryName;
      
      const tabLabel = document.createElement("span");
      tabLabel.textContent = categoryName;
      tab.appendChild(tabLabel);

      // Add delete button for category (except for first category)
      if (categories.length > 1) {
        const deleteBtn = document.createElement("button");
        deleteBtn.className = "delete-category-btn";
        deleteBtn.textContent = "×";
        deleteBtn.title = `Delete "${categoryName}" category`;
        deleteBtn.onclick = (e) => {
          e.stopPropagation();
          this.deleteCategory(categoryName);
        };
        tab.appendChild(deleteBtn);
      }

      tab.onclick = () => this.activatePaletteEditorTab(categoryName);
      tabsContainer.appendChild(tab);

      // Create tab content
      const tabContent = document.createElement("div");
      tabContent.className = `palette-editor-tab-content ${firstTab ? 'active' : ''}`;
      tabContent.dataset.category = categoryName;

      // Category controls
      const controls = document.createElement("div");
      controls.className = "palette-editor-category-controls";
      controls.innerHTML = `
        <label>Category Name:</label>
        <input type="text" id="categoryName_${index}" value="${this.escapeHtml(categoryName)}" placeholder="Category name">
        <button type="button" class="btn-secondary" onclick="window.commanderApp.uiManager.renameCategoryFromInput('${categoryName}', 'categoryName_${index}')">Rename</button>
      `;
      // Mark unsaved changes when category name edited
      controls.querySelector(`#categoryName_${index}`).addEventListener('input', () => {
        this.editPaletteUnsavedChanges = true;
      });
      tabContent.appendChild(controls);

      // JSON editor for this category
      const textarea = document.createElement("textarea");
      textarea.className = "palette-editor-textarea";
      textarea.dataset.category = categoryName;
      textarea.placeholder = "Enter JSON commands for this category...";
      textarea.value = JSON.stringify(commandsData[categoryName] || {}, null, 2);
      textarea.addEventListener('input', () => {
        this.editPaletteUnsavedChanges = true;
      });
      tabContent.appendChild(textarea);

      contentContainer.appendChild(tabContent);
      firstTab = false;
    });
  }

  activatePaletteEditorTab(categoryName) {
    // Remove active class from all tabs and contents
    document.querySelectorAll('.palette-editor-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.palette-editor-tab-content').forEach(content => content.classList.remove('active'));

    // Add active class to selected tab and content
    const activeTab = document.querySelector(`[data-category="${categoryName}"]`);
    const activeContent = document.querySelector(`.palette-editor-tab-content[data-category="${categoryName}"]`);
    
    if (activeTab) activeTab.classList.add('active');
    if (activeContent) activeContent.classList.add('active');
  }

  deleteCategory(categoryName) {
    if (!confirm(`Are you sure you want to delete the "${categoryName}" category and all its commands?`)) {
      return;
    }

    // Remove from editing data
    if (this.editingPaletteData && this.editingPaletteData[categoryName]) {
      delete this.editingPaletteData[categoryName];
    }

    // Recreate the interface
    this.createPaletteEditorTabs(this.editingPaletteData);

    this.showResponse(`Category "${categoryName}" deleted.`, false, "info");
    this.editPaletteUnsavedChanges = true;
  }

  renameCategoryFromInput(oldCategoryName, inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const newCategoryName = input.value.trim();
    if (!newCategoryName) {
      this.showResponse("Category name cannot be empty.", false, "warn");
      return;
    }

    if (newCategoryName === oldCategoryName) {
      return; // No change
    }

    if (this.editingPaletteData && this.editingPaletteData[newCategoryName]) {
      this.showResponse("A category with this name already exists.", false, "warn");
      return;
    }

    this.renameCategory(oldCategoryName, newCategoryName);
  }

  renameCategory(oldName, newName) {
    if (!this.editingPaletteData) return;

    // Move the data to the new key
    this.editingPaletteData[newName] = this.editingPaletteData[oldName];
    delete this.editingPaletteData[oldName];

    // Recreate the interface
    this.createPaletteEditorTabs(this.editingPaletteData);
    
    // Activate the renamed tab
    this.activatePaletteEditorTab(newName);

    this.showResponse(`Category renamed from "${oldName}" to "${newName}".`, false, "info");
    this.editPaletteUnsavedChanges = true;
  }

  addNewCategory() {
    const categoryName = prompt("Enter name for the new category:");
    if (!categoryName || !categoryName.trim()) {
      return;
    }

    const trimmedName = categoryName.trim();
    if (this.editingPaletteData && this.editingPaletteData[trimmedName]) {
      this.showResponse("A category with this name already exists.", false, "warn");
      return;
    }

    // Add new empty category
    if (!this.editingPaletteData) this.editingPaletteData = {};
    this.editingPaletteData[trimmedName] = {};

    // Recreate the interface
    this.createPaletteEditorTabs(this.editingPaletteData);
    
    // Activate the new tab
    this.activatePaletteEditorTab(trimmedName);

    this.showResponse(`Category "${trimmedName}" added.`, false, "info");
    this.editPaletteUnsavedChanges = true;
  }

  hideEditPaletteModal() {
    const modal = document.getElementById("editPaletteModal");
    if (modal) {
      modal.style.display = "none";
    }
    // Clean up stored data
    this.editingPaletteData = null;
    this.editPaletteUnsavedChanges = false;
    if (this.editPaletteEscapeListener) {
      document.removeEventListener('keydown', this.editPaletteEscapeListener);
      this.editPaletteEscapeListener = null;
    }
    if (this.editPaletteClickOutsideHandler) {
      modal.removeEventListener('click', this.editPaletteClickOutsideHandler);
      this.editPaletteClickOutsideHandler = null;
    }
  }

  attemptHideEditPaletteModal() {
    if (this.editPaletteUnsavedChanges) {
      const confirmClose = confirm('Discard unsaved changes?');
      if (!confirmClose) {
        return;
      }
    }
    this.hideEditPaletteModal();
  }

  getPaletteEditorContent() {
    if (!this.editingPaletteData) {
      return null;
    }

    // Collect data from all textareas
    const result = {};
    const textareas = document.querySelectorAll('.palette-editor-textarea');
    
    for (const textarea of textareas) {
      const categoryName = textarea.dataset.category;
      try {
        const categoryData = JSON.parse(textarea.value.trim() || '{}');
        result[categoryName] = categoryData;
      } catch (e) {
        this.showResponse(`Invalid JSON in category "${categoryName}". Please check the syntax.`, false, "error");
        return null;
      }
    }

    return JSON.stringify(result);
  }

  restoreTabAndCommand(categoryName, commandName) {
    // Find and activate the tab by category name
    const allTabs = document.querySelectorAll('.tab');
    let tabButton = null;
    for (const tab of allTabs) {
      if (tab.textContent.trim() === categoryName) {
        tabButton = tab;
        break;
      }
    }
    
    if (tabButton) {
      this.activateTab(tabButton, categoryName);
      
      // Find and click the command element after tab is activated
      setTimeout(() => {
        const tabContentId = `tab-${categoryName.replace(/\s+/g, "-")}`;
        const tabContent = document.getElementById(tabContentId);
        
        if (tabContent) {
          const commandList = tabContent.querySelector('.command-list');
          if (commandList) {
            const commandItems = commandList.querySelectorAll('li');
            for (const item of commandItems) {
              if (item.textContent.trim() === commandName) {
                item.click();
                break;
              }
            }
          }
        }
      }, 50);
    } else {
      // If the category doesn't exist anymore (was deleted), activate the first available tab
      const firstTab = document.querySelector('.tab');
      if (firstTab) {
        this.activateTab(firstTab, firstTab.textContent.trim());
      }
    }
  }
}