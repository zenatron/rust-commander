// Command Options management module
export class CommandOptionsManager {
  constructor(commandManager, uiManager, saveManager) {
    this.commandManager = commandManager;
    this.uiManager = uiManager;
    this.saveManager = saveManager;
    this.previousPalette = null; // Track palette before edit/delete operations
  }

  async showCommandOptionsModal() {
    const currentCommand = this.commandManager.getCurrentFilledCommand();
    const currentCommandInfo = this.uiManager.getCurrentCommandInfo();
    
    if (!currentCommand) {
      this.uiManager.showResponse("Error: No command selected or filled to work with.", true, "warn");
      return;
    }

    if (!currentCommandInfo) {
      this.uiManager.showResponse("Error: Command selection tracking lost. Please reselect a command.", true, "warn");
      return;
    }

    // Store the current palette before any operations
    this.previousPalette = this.uiManager.getCurrentPaletteName();

    this.uiManager.showResponse("Choose command option...", false, "info");

    const existingModal = document.getElementById('dynamic-command-options-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'dynamic-command-options-modal';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,0,0,0.5); z-index: 1000; display: flex; 
      align-items: center; justify-content: center;
    `;

    const dialog = document.createElement('div');
    dialog.classList.add('command-options-modal-dialog');
    dialog.style.cssText = `
      background: white; padding: 20px; border-radius: 8px; 
      max-width: 400px; width: 90%; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;

    dialog.innerHTML = `
      <h3 style="margin-top: 0; margin-bottom: 20px; text-align: center;">Command Options</h3>
      <div style="display: flex; flex-direction: column; gap: 15px;">
        <button id="optionSaveCommand" style="padding: 15px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; text-align: left; font-size: 1em;">
          <strong>💾 Save Command</strong><br>
          <small style="opacity: 0.9;">Save this command to a palette</small>
        </button>
        <button id="optionEditCommand" style="padding: 15px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; text-align: left; font-size: 1em;">
          <strong>✏️ Edit Command</strong><br>
          <small style="opacity: 0.9;">Modify this command</small>
        </button>
        <button id="optionDeleteCommand" style="padding: 15px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; text-align: left; font-size: 1em;">
          <strong>🗑️ Delete Command</strong><br>
          <small style="opacity: 0.9;">Remove this command</small>
        </button>
        <button id="optionCancel" style="padding: 10px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%; margin-top: 10px;">
          Cancel
        </button>
      </div>
    `;

    modal.appendChild(dialog);
    document.body.appendChild(modal);

    const saveCommandBtn = dialog.querySelector('#optionSaveCommand');
    const editCommandBtn = dialog.querySelector('#optionEditCommand');
    const deleteCommandBtn = dialog.querySelector('#optionDeleteCommand');
    const cancelBtn = dialog.querySelector('#optionCancel');

    saveCommandBtn.onclick = async () => {
      // Transform the current modal to save modal instead of closing/opening
      this.transformToSaveModal(modal, dialog, escapeKeyListener);
    };

    editCommandBtn.onclick = () => {
      // Transform to edit command modal
      this.transformToEditModal(modal, dialog, escapeKeyListener);
    };

    deleteCommandBtn.onclick = () => {
      // Handle delete command with confirmation
      this.handleDeleteCommand(modal, escapeKeyListener);
    };

    cancelBtn.onclick = () => this.closeDynamicModal(modal, escapeKeyListener);
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.closeDynamicModal(modal, escapeKeyListener);
      }
    });
    
    const escapeKeyListener = (e) => {
      if (e.key === 'Escape') {
        this.closeDynamicModal(modal, escapeKeyListener); 
      }
    };
    document.addEventListener('keydown', escapeKeyListener);
  }

  async transformToSaveModal(modalElement, dialogElement, existingEscapeListener) {
    // Update response message
    this.uiManager.showResponse("Enter command name and choose save option...", false, "info");

    // Get the current command to save
    const currentCommand = this.commandManager.getCurrentFilledCommand();
    
    // Get available palettes
    let palettes = [];
    try {
      const response = await fetch('/api/palettes');
      if (response.ok) {
        palettes = await response.json();
      }
    } catch (error) {
      console.error('Error fetching palettes for save modal:', error);
    }

    // Transform the dialog content to save modal
    dialogElement.innerHTML = `
      <h3 style="margin-top: 0; margin-bottom: 20px; text-align: center;">Save Command</h3>
      <div style="display: flex; flex-direction: column; gap: 15px;">
        <div>
          <label for="saveCommandName" style="display: block; margin-bottom: 5px; font-weight: bold;">Command Name:</label>
          <input type="text" id="saveCommandName" placeholder="Enter command name" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
        </div>
        <div>
          <label style="display: block; margin-bottom: 10px; font-weight: bold;">Save Options:</label>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            <button id="saveToExistingPalette" style="padding: 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; text-align: left;">
              <strong>💾 Save to Existing Palette</strong><br>
              <small style="opacity: 0.9;">Add to an existing palette</small>
            </button>
            <button id="saveToNewPalette" style="padding: 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; text-align: left;">
              <strong>📁 Save to New Palette</strong><br>
              <small style="opacity: 0.9;">Create a new palette for this command</small>
            </button>
          </div>
        </div>
        <div id="paletteSelectionArea" style="display: none;">
          <label for="paletteSelect" style="display: block; margin-bottom: 5px; font-weight: bold;">Select Palette:</label>
          <select id="paletteSelect" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
            <option value="">Choose a palette...</option>
            ${palettes.map(palette => `<option value="${palette}">${palette}</option>`).join('')}
          </select>
        </div>
        <div id="newPaletteArea" style="display: none;">
          <label for="newPaletteName" style="display: block; margin-bottom: 5px; font-weight: bold;">New Palette Name:</label>
          <input type="text" id="newPaletteName" placeholder="Enter new palette name" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box;">
        </div>
        <div style="display: flex; gap: 10px; margin-top: 10px;">
          <button id="confirmSaveCommand" style="flex: 1; padding: 10px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Save
          </button>
          <button id="cancelSaveCommand" style="flex: 1; padding: 10px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Cancel
          </button>
          <button id="backToOptions" style="padding: 10px; background: #ffc107; color: #333; border: none; border-radius: 4px; cursor: pointer;">
            ← Back
          </button>
        </div>
      </div>
    `;

    // Set up event listeners for the new save modal content
    const saveToExistingBtn = dialogElement.querySelector('#saveToExistingPalette');
    const saveToNewBtn = dialogElement.querySelector('#saveToNewPalette');
    const paletteSelectionArea = dialogElement.querySelector('#paletteSelectionArea');
    const newPaletteArea = dialogElement.querySelector('#newPaletteArea');
    const confirmSaveBtn = dialogElement.querySelector('#confirmSaveCommand');
    const cancelSaveBtn = dialogElement.querySelector('#cancelSaveCommand');
    const backToOptionsBtn = dialogElement.querySelector('#backToOptions');

    saveToExistingBtn.onclick = () => {
      paletteSelectionArea.style.display = 'block';
      newPaletteArea.style.display = 'none';
    };

    saveToNewBtn.onclick = () => {
      paletteSelectionArea.style.display = 'none';
      newPaletteArea.style.display = 'block';
    };

    confirmSaveBtn.onclick = async () => {
      await this.handleSaveCommand(modalElement, existingEscapeListener);
    };

    cancelSaveBtn.onclick = () => {
      this.closeDynamicModal(modalElement, existingEscapeListener);
    };

    backToOptionsBtn.onclick = () => {
      // Transform back to command options modal
      this.showCommandOptionsModalContent(dialogElement);
    };
  }

  showCommandOptionsModalContent(dialogElement) {
    // Reset response message
    this.uiManager.showResponse("Choose command option...", false, "info");

    // Restore the original command options content
    dialogElement.innerHTML = `
      <h3 style="margin-top: 0; margin-bottom: 20px; text-align: center;">Command Options</h3>
      <div style="display: flex; flex-direction: column; gap: 15px;">
        <button id="optionSaveCommand" style="padding: 15px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; text-align: left; font-size: 1em;">
          <strong>💾 Save Command</strong><br>
          <small style="opacity: 0.9;">Save this command to a palette</small>
        </button>
        <button id="optionEditCommand" style="padding: 15px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; text-align: left; font-size: 1em;">
          <strong>✏️ Edit Command</strong><br>
          <small style="opacity: 0.9;">Modify this command</small>
        </button>
        <button id="optionDeleteCommand" style="padding: 15px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; text-align: left; font-size: 1em;">
          <strong>🗑️ Delete Command</strong><br>
          <small style="opacity: 0.9;">Remove this command</small>
        </button>
        <button id="optionCancel" style="padding: 10px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%; margin-top: 10px;">
          Cancel
        </button>
      </div>
    `;

    // Re-attach event listeners for the restored content
    this.attachCommandOptionsListeners(dialogElement);
  }

  attachCommandOptionsListeners(dialogElement) {
    const modal = dialogElement.parentElement;
    const saveCommandBtn = dialogElement.querySelector('#optionSaveCommand');
    const editCommandBtn = dialogElement.querySelector('#optionEditCommand');
    const deleteCommandBtn = dialogElement.querySelector('#optionDeleteCommand');
    const cancelBtn = dialogElement.querySelector('#optionCancel');

    const escapeKeyListener = (e) => {
      if (e.key === 'Escape') {
        this.closeDynamicModal(modal, escapeKeyListener); 
      }
    };
    document.addEventListener('keydown', escapeKeyListener);

    saveCommandBtn.onclick = async () => {
      this.transformToSaveModal(modal, dialogElement, escapeKeyListener);
    };

    editCommandBtn.onclick = () => {
      this.transformToEditModal(modal, dialogElement, escapeKeyListener);
    };

    deleteCommandBtn.onclick = () => {
      this.handleDeleteCommand(modal, escapeKeyListener);
    };

    cancelBtn.onclick = () => this.closeDynamicModal(modal, escapeKeyListener);
  }

  async transformToEditModal(modalElement, dialogElement, existingEscapeListener) {
    // Update response message
    this.uiManager.showResponse("Edit command JSON...", false, "info");

    // Get the current command to edit
    const currentCommand = this.commandManager.getCurrentFilledCommand();
    
    // Get the command information from the UI manager (reliable tracking)
    const currentCommandInfo = this.uiManager.getCurrentCommandInfo();
    
    if (!currentCommandInfo) {
      this.uiManager.showResponse("Error: No command selected for editing. Please select a command first.", true, "error");
      return;
    }

    // Ensure we have a valid palette name
    if (!currentCommandInfo.paletteName) {
      const currentPalette = this.uiManager.getCurrentPaletteName();
      if (currentPalette) {
        currentCommandInfo.paletteName = currentPalette;
      } else {
        this.uiManager.showResponse("Error: Cannot determine current palette for editing.", true, "error");
        return;
      }
    }

    // Transform the dialog content to edit modal
    dialogElement.innerHTML = `
      <h3 style="margin-top: 0; margin-bottom: 20px; text-align: center;">Edit Command</h3>
      <div style="display: flex; flex-direction: column; gap: 15px;">
        <div>
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Command: ${this.escapeHtml(currentCommandInfo.commandName)}</label>
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Palette: ${this.escapeHtml(currentCommandInfo.paletteName)}</label>
          <label style="display: block; margin-bottom: 5px; font-weight: bold;">Category: ${this.escapeHtml(currentCommandInfo.categoryName)}</label>
        </div>
        <div>
          <label for="commandEditor" style="display: block; margin-bottom: 5px; font-weight: bold;">Edit Command JSON:</label>
          <textarea id="commandEditor" style="width: 100%; height: 300px; padding: 10px; border: 1px solid #ccc; border-radius: 4px; font-family: monospace; font-size: 0.9em; resize: vertical; box-sizing: border-box;">${this.escapeHtml(JSON.stringify(currentCommand, null, 2))}</textarea>
          <small style="color: #666; display: block; margin-top: 5px;">
            💡 <strong>Tip:</strong> Leave empty to delete this command, or edit the JSON structure as needed.
          </small>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 10px;">
          <button id="saveEditedCommand" style="flex: 1; padding: 10px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Save Changes
          </button>
          <button id="cancelEditCommand" style="flex: 1; padding: 10px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Cancel
          </button>
          <button id="backToOptionsFromEdit" style="padding: 10px; background: #ffc107; color: #333; border: none; border-radius: 4px; cursor: pointer;">
            ← Back
          </button>
        </div>
      </div>
    `;

    // Set up event listeners for the edit modal content
    const saveEditedBtn = dialogElement.querySelector('#saveEditedCommand');
    const cancelEditBtn = dialogElement.querySelector('#cancelEditCommand');
    const backToOptionsBtn = dialogElement.querySelector('#backToOptionsFromEdit');
    const commandEditor = dialogElement.querySelector('#commandEditor');

    // Focus the textarea
    setTimeout(() => commandEditor.focus(), 100);

    saveEditedBtn.onclick = async () => {
      await this.handleEditCommand(modalElement, existingEscapeListener, currentCommandInfo);
    };

    cancelEditBtn.onclick = () => {
      this.closeDynamicModal(modalElement, existingEscapeListener);
    };

    backToOptionsBtn.onclick = () => {
      // Transform back to command options modal
      this.showCommandOptionsModalContent(dialogElement);
    };
  }

  async handleDeleteCommand(modalElement, escapeListener) {
    const currentCommandInfo = this.uiManager.getCurrentCommandInfo();
    
    if (!currentCommandInfo) {
      this.uiManager.showResponse("Error: No command selected for deletion. Please select a command first.", true, "error");
      return;
    }

    // Ensure we have a valid palette name
    if (!currentCommandInfo.paletteName) {
      const currentPalette = this.uiManager.getCurrentPaletteName();
      if (currentPalette) {
        currentCommandInfo.paletteName = currentPalette;
      } else {
        this.uiManager.showResponse("Error: Cannot determine current palette for deletion.", true, "error");
        return;
      }
    }

    const confirmMessage = `Are you sure you want to delete the command "${currentCommandInfo.commandName}" from category "${currentCommandInfo.categoryName}" in palette "${currentCommandInfo.paletteName}"?\n\nThis action cannot be undone.`;
    
    if (!confirm(confirmMessage)) {
      this.uiManager.showResponse("Delete cancelled.", false, "info");
      return;
    }

    try {
      // Delete the command by updating the palette
      const result = await this.deleteCommandFromPalette(currentCommandInfo);
      
      if (result.success) {
        this.closeDynamicModal(modalElement, escapeListener);
        // Fully clear the UI selection
        if (this.uiManager) {
          this.uiManager.clearCommandSelection();
        }
      }
    } catch (error) {
      console.error('Error deleting command:', error);
      this.uiManager.showResponse(`Delete error: ${error.message}`, true, "error");
    }
  }

  async handleEditCommand(modalElement, escapeListener, commandInfo) {
    const commandEditor = modalElement.querySelector('#commandEditor');
    const editedContent = commandEditor?.value.trim();

    // Check if content is empty (deletion case)
    if (!editedContent) {
      const confirmDelete = confirm(`The command content is empty. This will delete the command "${commandInfo.commandName}".\n\nAre you sure you want to delete this command?`);
      if (!confirmDelete) {
        this.uiManager.showResponse("Edit cancelled.", false, "info");
        return;
      }
      
      // Handle deletion
      const result = await this.deleteCommandFromPalette(commandInfo);
      if (result.success) {
        this.closeDynamicModal(modalElement, escapeListener);
        // Fully clear the UI selection
        if (this.uiManager) {
          this.uiManager.clearCommandSelection();
        }
      }
      return;
    }

    // Validate JSON
    let parsedCommand;
    try {
      parsedCommand = JSON.parse(editedContent);
    } catch (e) {
      this.uiManager.showResponse("Invalid JSON format. Please check your syntax.", true, "error");
      return;
    }

    try {
      // Update the command in the palette
      const result = await this.updateCommandInPalette(commandInfo, parsedCommand);
      
      if (result.success) {
        this.closeDynamicModal(modalElement, escapeListener);
        // Update the current command with the edited version
        this.commandManager.setCurrentCommand(JSON.stringify(parsedCommand));
        if (this.uiManager) {
          this.uiManager.updateRawJsonDisplay(parsedCommand);
          this.uiManager.updateFilledJsonDisplay(parsedCommand);
          // Show success message
          this.uiManager.showResponse(`Command "${commandInfo.commandName}" updated successfully.`, true, "success");
        }
      }
    } catch (error) {
      console.error('Error updating command:', error);
      this.uiManager.showResponse(`Update error: ${error.message}`, true, "error");
    }
  }

  async deleteCommandFromPalette(commandInfo) {
    try {
      if (!commandInfo.paletteName) {
        throw new Error('No palette name provided in command info');
      }
      
      // Fetch the current palette
      const response = await fetch(`/api/palettes/${encodeURIComponent(commandInfo.paletteName)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch palette "${commandInfo.paletteName}": ${response.status}`);
      }
      
      const paletteData = await response.json();
      
      // Remove the command from the palette structure
      if (paletteData.commands[commandInfo.categoryName]) {
        delete paletteData.commands[commandInfo.categoryName][commandInfo.commandName];
        
        // If the category is now empty, optionally remove it (be careful with this)
        if (Object.keys(paletteData.commands[commandInfo.categoryName]).length === 0) {
          delete paletteData.commands[commandInfo.categoryName];
        }
      }

      // Update the palette
      const updateResponse = await fetch(`/api/palettes/${encodeURIComponent(commandInfo.paletteName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: commandInfo.paletteName,
          commands: paletteData.commands
        }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.text();
        throw new Error(`Failed to update palette: ${updateResponse.status}, ${errorData}`);
      }

      this.uiManager.showResponse(`Command "${commandInfo.commandName}" deleted successfully from palette "${commandInfo.paletteName}".`, true, "success");

      // Refresh the UI - use previousPalette if it still exists, otherwise use current palette
      if (window.commanderApp && typeof window.commanderApp.loadPalette === 'function') {
        const targetPalette = await this.getValidPaletteToReturn(commandInfo.paletteName);
        if (targetPalette) {
          // Skip auto-activation so we can manually restore the correct tab
          await window.commanderApp.loadPalette(targetPalette, true);
          
          // Restore the tab but don't select any command since it was deleted
          setTimeout(() => {
            this.restoreTabOnly(commandInfo.categoryName);
            // The command selection is now cleared elsewhere, so just clear highlighting
            this.uiManager.clearActiveCommand();
          }, 100);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error deleting command:', error);
      this.uiManager.showResponse(`Delete error: ${error.message}`, true, "error");
      return { success: false, error: error.message };
    }
  }

  async updateCommandInPalette(commandInfo, newCommandData) {
    try {
      if (!commandInfo.paletteName) {
        throw new Error('No palette name provided in command info');
      }
      
      // Fetch the current palette
      const response = await fetch(`/api/palettes/${encodeURIComponent(commandInfo.paletteName)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch palette "${commandInfo.paletteName}": ${response.status}`);
      }
      
      const paletteData = await response.json();
      
      // Update the command in the palette structure
      if (!paletteData.commands[commandInfo.categoryName]) {
        paletteData.commands[commandInfo.categoryName] = {};
      }
      paletteData.commands[commandInfo.categoryName][commandInfo.commandName] = newCommandData;

      // Update the palette
      const updateResponse = await fetch(`/api/palettes/${encodeURIComponent(commandInfo.paletteName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: commandInfo.paletteName,
          commands: paletteData.commands
        }),
      });

      if (!updateResponse.ok) {
        const errorData = await updateResponse.text();
        throw new Error(`Failed to update palette: ${updateResponse.status}, ${errorData}`);
      }

      // Don't show a toast here because handleEditCommand will show one.
      // this.uiManager.showResponse(`Command "${commandInfo.commandName}" updated successfully in palette "${commandInfo.paletteName}".`, true, "success");

      // Refresh the UI - use previousPalette if it still exists, otherwise use current palette
      if (window.commanderApp && typeof window.commanderApp.loadPalette === 'function') {
        const targetPalette = await this.getValidPaletteToReturn(commandInfo.paletteName);
        if (targetPalette) {
          // Skip auto-activation so we can restore the correct tab
          await window.commanderApp.loadPalette(targetPalette, true);
          
          // Try to restore the updated command selection
          const updatedCommandInfo = {
            ...commandInfo,
            commandData: newCommandData,
            paletteName: targetPalette
          };
          
          // Small delay to ensure UI is fully updated
          setTimeout(() => {
            if (!this.uiManager.restoreCommandSelection(updatedCommandInfo)) {
              // If restoration failed, clear selection to prevent sync issues
              this.uiManager.clearActiveCommand();
            }
          }, 100);
        }
      }

      return { success: true };
    } catch (error) {
      console.error('Error updating command:', error);
      this.uiManager.showResponse(`Update error: ${error.message}`, true, "error");
      return { success: false, error: error.message };
    }
  }

  async getValidPaletteToReturn(currentPaletteName) {
    // Check if previous palette still exists
    if (this.previousPalette) {
      try {
        const response = await fetch('/api/palettes');
        if (response.ok) {
          const availablePalettes = await response.json();
          if (availablePalettes.includes(this.previousPalette)) {
            return this.previousPalette;
          }
        }
      } catch (error) {
        console.error('Error checking available palettes:', error);
      }
    }
    
    // If previous palette doesn't exist, use current palette if it still exists
    try {
      const response = await fetch(`/api/palettes/${encodeURIComponent(currentPaletteName)}`);
      if (response.ok) {
        return currentPaletteName;
      }
    } catch (error) {
      console.error('Error checking current palette:', error);
    }
    
    // If neither exists, load the first available palette
    try {
      const response = await fetch('/api/palettes');
      if (response.ok) {
        const availablePalettes = await response.json();
        if (availablePalettes.length > 0) {
          return availablePalettes[0];
        }
      }
    } catch (error) {
      console.error('Error fetching available palettes:', error);
    }
    
    return null;
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async handleSaveCommand(modalElement, escapeListener) {
    const commandNameInput = modalElement.querySelector('#saveCommandName');
    const paletteSelect = modalElement.querySelector('#paletteSelect');
    const newPaletteNameInput = modalElement.querySelector('#newPaletteName');
    const paletteSelectionArea = modalElement.querySelector('#paletteSelectionArea');
    const newPaletteArea = modalElement.querySelector('#newPaletteArea');

    const commandName = commandNameInput?.value.trim();
    if (!commandName) {
      this.uiManager.showResponse("Command name is required.", true, "warn");
      return;
    }

    let targetPalette = '';
    if (paletteSelectionArea.style.display === 'block') {
      targetPalette = paletteSelect?.value;
      if (!targetPalette) {
        this.uiManager.showResponse("Please select a palette.", true, "warn");
        return;
      }
    } else if (newPaletteArea.style.display === 'block') {
      targetPalette = newPaletteNameInput?.value.trim();
      if (!targetPalette) {
        this.uiManager.showResponse("New palette name is required.", true, "warn");
        return;
      }
    } else {
      this.uiManager.showResponse("Please choose a save option.", true, "warn");
      return;
    }

    // Use the SaveManager's existing save functionality
    const currentCommand = this.commandManager.getCurrentFilledCommand();
    const result = await this.saveManager.saveCommandToPalette(commandName, targetPalette, currentCommand);
    
    if (result.success) {
      this.closeDynamicModal(modalElement, escapeListener);
      
      // After successful save, navigate to the "Saved Commands" tab in the target palette
      // Small delay to ensure the palette has been loaded by the SaveManager
      setTimeout(() => {
        this.restoreToSavedCommandsTab();
      }, 200);
    }
    // Error handling is done in the saveManager
  }

  // Restore just the tab without selecting any specific command
  restoreTabOnly(categoryName) {
    // Find tab by text content
    const allTabs = document.querySelectorAll('.tab');
    let tabButton = null;
    for (const tab of allTabs) {
      if (tab.textContent.trim() === categoryName) {
        tabButton = tab;
        break;
      }
    }
    
    if (tabButton) {
      this.uiManager.activateTab(tabButton, categoryName);
    } else {
      // If the category doesn't exist anymore (was deleted), activate the first available tab
      const firstTab = document.querySelector('.tab');
      if (firstTab) {
        this.uiManager.activateTab(firstTab, firstTab.textContent.trim());
      }
    }
  }

  // Restore to "Saved Commands" tab specifically, with fallback to first tab
  restoreToSavedCommandsTab() {
    this.restoreTabOnly("Saved Commands");
  }

  closeDynamicModal(modalElement, escapeListenerToRemove) {
    if (modalElement && modalElement.parentNode) {
      modalElement.parentNode.removeChild(modalElement);
    }
    if (escapeListenerToRemove) {
      document.removeEventListener('keydown', escapeListenerToRemove);
    }
  }
} 