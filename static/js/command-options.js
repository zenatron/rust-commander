// Command Options management module
import { DOMUtils } from './utils/dom-utils.js';
import { modalManager } from './utils/modal-manager.js';
import { apiClient } from './utils/api-client.js';

export class CommandOptionsManager {
  constructor(commandManager, uiManager) {
    this.commandManager = commandManager;
    this.uiManager = uiManager;
    this.previousPalette = null; // Track palette before edit/delete operations
    this.eventCleanupFunctions = [];
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

    // Use the new modal system instead of manual DOM creation
    const content = `
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

    const { modal, dialog } = modalManager.createModal('command-options-modal', {
      title: 'Command Options',
      content: content
    });

    // Set up event listeners with cleanup tracking
    this.setupModalEventListeners(dialog);
  }

  setupModalEventListeners(dialog) {
    // Clean up any existing listeners
    this.cleanupEventListeners();

    const saveCommandBtn = DOMUtils.querySelector('#optionSaveCommand');
    const editCommandBtn = DOMUtils.querySelector('#optionEditCommand');
    const deleteCommandBtn = DOMUtils.querySelector('#optionDeleteCommand');
    const cancelBtn = DOMUtils.querySelector('#optionCancel');

    if (saveCommandBtn) {
      const cleanup1 = DOMUtils.addEventListener(saveCommandBtn, 'click', async () => {
        await this.transformToSaveModal(dialog);
      });
      this.eventCleanupFunctions.push(cleanup1);
    }

    if (editCommandBtn) {
      const cleanup2 = DOMUtils.addEventListener(editCommandBtn, 'click', () => {
        this.transformToEditModal(dialog);
      });
      this.eventCleanupFunctions.push(cleanup2);
    }

    if (deleteCommandBtn) {
      const cleanup3 = DOMUtils.addEventListener(deleteCommandBtn, 'click', () => {
        this.handleDeleteCommand();
      });
      this.eventCleanupFunctions.push(cleanup3);
    }

    if (cancelBtn) {
      const cleanup4 = DOMUtils.addEventListener(cancelBtn, 'click', () => {
        modalManager.destroyModal('command-options-modal');
        this.cleanupEventListeners();
      });
      this.eventCleanupFunctions.push(cleanup4);
    }
  }

  cleanupEventListeners() {
    this.eventCleanupFunctions.forEach(cleanup => cleanup && cleanup());
    this.eventCleanupFunctions = [];
  }

  /**
   * Destroy and cleanup the manager
   */
  destroy() {
    this.cleanupEventListeners();
    modalManager.destroyModal('command-options-modal');
  }

  async transformToSaveModal(dialog) {
    // Update response message
    this.uiManager.showResponse("Enter command name and choose save option...", false, "info");

    // Get the current command to save
    const currentCommand = this.commandManager.getCurrentFilledCommand();
    
    // Get available palettes using modern API client
    let palettes = [];
    try {
      palettes = await apiClient.getPalettes();
    } catch (error) {
      console.error('Error fetching palettes for save modal:', error);
    }

    // Transform the dialog content to save modal
    dialog.innerHTML = `
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
    const saveToExistingBtn = dialog.querySelector('#saveToExistingPalette');
    const saveToNewBtn = dialog.querySelector('#saveToNewPalette');
    const paletteSelectionArea = dialog.querySelector('#paletteSelectionArea');
    const newPaletteArea = dialog.querySelector('#newPaletteArea');
    const confirmSaveBtn = dialog.querySelector('#confirmSaveCommand');
    const cancelSaveBtn = dialog.querySelector('#cancelSaveCommand');
    const backToOptionsBtn = dialog.querySelector('#backToOptions');

    saveToExistingBtn.onclick = () => {
      paletteSelectionArea.style.display = 'block';
      newPaletteArea.style.display = 'none';
    };

    saveToNewBtn.onclick = () => {
      paletteSelectionArea.style.display = 'none';
      newPaletteArea.style.display = 'block';
    };

    confirmSaveBtn.onclick = async () => {
      await this.handleSaveCommand(dialog);
    };

    cancelSaveBtn.onclick = () => {
      modalManager.destroyModal('command-options-modal');
    };

    backToOptionsBtn.onclick = () => {
      // Transform back to command options modal
      this.showCommandOptionsModalContent(dialog);
    };
  }

  showCommandOptionsModalContent(dialog) {
    // Don't show message again - this is just restoring content during navigation
    // The original message was already shown when the modal first opened

    // Restore the original command options content
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

    // Re-attach event listeners for the restored content
    this.attachCommandOptionsListeners(dialog);
  }

  attachCommandOptionsListeners(dialog) {
    const modal = dialog.parentElement;
    const saveCommandBtn = dialog.querySelector('#optionSaveCommand');
    const editCommandBtn = dialog.querySelector('#optionEditCommand');
    const deleteCommandBtn = dialog.querySelector('#optionDeleteCommand');
    const cancelBtn = dialog.querySelector('#optionCancel');

    // Use managed event listener with cleanup
    const escapeKeyListener = (e) => {
      if (e.key === 'Escape') {
        modalManager.destroyModal('command-options-modal');
        this.cleanupEventListeners();
      }
    };
    const escapeCleanup = DOMUtils.addEventListener(document, 'keydown', escapeKeyListener);
    this.eventCleanupFunctions.push(escapeCleanup);

    saveCommandBtn.onclick = async () => {
      this.transformToSaveModal(dialog);
    };

    editCommandBtn.onclick = () => {
      this.transformToEditModal(dialog);
    };

    deleteCommandBtn.onclick = () => {
      this.handleDeleteCommand();
    };

    cancelBtn.onclick = () => {
      modalManager.destroyModal('command-options-modal');
      this.cleanupEventListeners();
    };
  }

  async transformToEditModal(dialog) {
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
    dialog.innerHTML = `
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
    const saveEditedBtn = dialog.querySelector('#saveEditedCommand');
    const cancelEditBtn = dialog.querySelector('#cancelEditCommand');
    const backToOptionsBtn = dialog.querySelector('#backToOptionsFromEdit');
    const commandEditor = dialog.querySelector('#commandEditor');

    // Focus the textarea
    setTimeout(() => commandEditor.focus(), 100);

    saveEditedBtn.onclick = async () => {
      await this.handleEditCommand(dialog, currentCommandInfo);
    };

    cancelEditBtn.onclick = () => {
      modalManager.destroyModal('command-options-modal');
    };

    backToOptionsBtn.onclick = () => {
      // Transform back to command options modal
      this.showCommandOptionsModalContent(dialog);
    };
  }

  async handleDeleteCommand() {
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
    
    const confirmed = await modalManager.showConfirmDialog(confirmMessage, {
      title: 'Delete Command',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });
    
    if (!confirmed) {
      this.uiManager.showResponse("Delete cancelled.", false, "info");
      return;
    }

    try {
      // Delete the command by updating the palette
      const result = await this.deleteCommandFromPalette(currentCommandInfo);
      
      if (result.success) {
        modalManager.destroyModal('command-options-modal');
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

  async handleEditCommand(dialog, currentCommandInfo) {
    const commandEditor = dialog.querySelector('#commandEditor');
    const editedContent = commandEditor?.value.trim();

    // Check if content is empty (deletion case)
    if (!editedContent) {
      const confirmDelete = await modalManager.showConfirmDialog(
        `The command content is empty. This will delete the command "${currentCommandInfo.commandName}".\n\nAre you sure you want to delete this command?`,
        {
          title: 'Delete Command',
          confirmText: 'Delete',
          cancelText: 'Cancel'
        }
      );
      
      if (!confirmDelete) {
        this.uiManager.showResponse("Edit cancelled.", false, "info");
        return;
      }
      
      // Handle deletion
      const result = await this.deleteCommandFromPalette(currentCommandInfo);
      if (result.success) {
        modalManager.destroyModal('command-options-modal');
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
      const result = await this.updateCommandInPalette(currentCommandInfo, parsedCommand);
      
      if (result.success) {
        modalManager.destroyModal('command-options-modal');
        // Update the current command with the edited version
        this.commandManager.setCurrentCommand(JSON.stringify(parsedCommand));
        if (this.uiManager) {
          this.uiManager.updateRawJsonDisplay(parsedCommand);
          this.uiManager.updateFilledJsonDisplay(parsedCommand);
          // Show success message
          this.uiManager.showResponse(`Command "${currentCommandInfo.commandName}" updated successfully.`, true, "success");
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
      
      // Fetch the current palette using modern API client
      const paletteData = await apiClient.getPalette(commandInfo.paletteName);
      
      // Remove the command from the palette structure
      if (paletteData.commands[commandInfo.categoryName]) {
        delete paletteData.commands[commandInfo.categoryName][commandInfo.commandName];
        
        // If the category is now empty, optionally remove it (be careful with this)
        if (Object.keys(paletteData.commands[commandInfo.categoryName]).length === 0) {
          delete paletteData.commands[commandInfo.categoryName];
        }
      }

      // Update the palette using modern API client
      await apiClient.updatePalette(commandInfo.paletteName, {
        name: commandInfo.paletteName,
        commands: paletteData.commands
      });

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
      
      // Fetch the current palette using modern API client
      const paletteData = await apiClient.getPalette(commandInfo.paletteName);
      
      // Update the command in the palette structure
      if (!paletteData.commands[commandInfo.categoryName]) {
        paletteData.commands[commandInfo.categoryName] = {};
      }
      paletteData.commands[commandInfo.categoryName][commandInfo.commandName] = newCommandData;

      // Update the palette using modern API client
      await apiClient.updatePalette(commandInfo.paletteName, {
        name: commandInfo.paletteName,
        commands: paletteData.commands
      });

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
        const availablePalettes = await apiClient.getPalettes();
        if (availablePalettes.includes(this.previousPalette)) {
          return this.previousPalette;
        }
      } catch (error) {
        console.error('Error checking available palettes:', error);
      }
    }
    
    // If previous palette doesn't exist, use current palette if it still exists
    try {
      await apiClient.getPalette(currentPaletteName);
      return currentPaletteName;
    } catch (error) {
      console.error('Error checking current palette:', error);
    }
    
    // If neither exists, load the first available palette
    try {
      const availablePalettes = await apiClient.getPalettes();
      if (availablePalettes.length > 0) {
        return availablePalettes[0];
      }
    } catch (error) {
      console.error('Error fetching available palettes:', error);
    }
    
    return null;
  }

  escapeHtml(text) {
    return DOMUtils.escapeHtml(text);
  }

  async handleSaveCommand(dialog) {
    const commandNameInput = dialog.querySelector('#saveCommandName');
    const paletteSelect = dialog.querySelector('#paletteSelect');
    const newPaletteNameInput = dialog.querySelector('#newPaletteName');
    const paletteSelectionArea = dialog.querySelector('#paletteSelectionArea');
    const newPaletteArea = dialog.querySelector('#newPaletteArea');

    const commandName = commandNameInput?.value.trim();
    if (!commandName) {
      this.uiManager.showResponse("Command name is required.", true, "warn");
      return;
    }

    const currentCommand = this.commandManager.getCurrentFilledCommand();
    if (!currentCommand) {
      this.uiManager.showResponse("No command to save.", true, "error");
      return;
    }

    let targetPalette = '';
    let isNewPalette = false;

    if (paletteSelectionArea.style.display === 'block') {
      // Saving to existing palette
      targetPalette = paletteSelect?.value;
      if (!targetPalette) {
        this.uiManager.showResponse("Please select a palette.", true, "warn");
        return;
      }
    } else if (newPaletteArea.style.display === 'block') {
      // Creating new palette
      targetPalette = newPaletteNameInput?.value.trim();
      if (!targetPalette) {
        this.uiManager.showResponse("New palette name is required.", true, "warn");
        return;
      }
      isNewPalette = true;
    } else {
      this.uiManager.showResponse("Please choose a save option.", true, "warn");
      return;
    }

    try {
      if (isNewPalette) {
        // Create new palette with the command
        const newPaletteData = {
          "Saved Commands": {
            [commandName]: currentCommand
          }
        };

        await apiClient.createPalette({
          name: targetPalette,
          commands: newPaletteData
        });

        this.uiManager.showResponse(`New palette '${targetPalette}' created with command '${commandName}'!`, true, "success");
      } else {
        // Add to existing palette
        try {
          // Try to add the command directly
          await apiClient.addCommandToPalette(targetPalette, {
            command_name: commandName,
            command_data: currentCommand
          });

          this.uiManager.showResponse(`Command '${commandName}' added to palette '${targetPalette}' successfully!`, true, "success");
        } catch (error) {
          if (error.isConflict && error.isConflict()) {
            // Command already exists - ask for confirmation
            const overwrite = await modalManager.showConfirmDialog(
              `Command "${commandName}" already exists in palette "${targetPalette}". Overwrite?`,
              {
                title: 'Command Exists',
                confirmText: 'Overwrite',
                cancelText: 'Cancel'
              }
            );

            if (!overwrite) {
              this.uiManager.showResponse("Save cancelled. Command name already exists.", false, "info");
              return;
            }

            // User confirmed overwrite - update the palette directly
            await this.overwriteCommandInPalette(targetPalette, commandName, currentCommand);
            this.uiManager.showResponse(`Command '${commandName}' updated in palette '${targetPalette}' successfully!`, true, "success");
          } else {
            throw error; // Re-throw other errors
          }
        }
      }

      modalManager.destroyModal('command-options-modal');
      this.cleanupEventListeners();

      // Refresh the palette list and load the target palette
      if (window.commanderApp && typeof window.commanderApp.fetchPalettes === 'function') {
        await window.commanderApp.fetchPalettes();
        if (typeof window.commanderApp.loadPalette === 'function') {
          await window.commanderApp.loadPalette(targetPalette, true);
          
          // After successful save, navigate to the "Saved Commands" tab
          setTimeout(() => {
            this.restoreTabOnly("Saved Commands");
          }, 100);
        }
      }

    } catch (error) {
      console.error('Error saving command:', error);
      let errorMessage = 'Unknown error occurred';
      
      if (error.isNetworkError && error.isNetworkError()) {
        errorMessage = 'Network connection error. Please check your connection and try again.';
      } else if (error.isServerError && error.isServerError()) {
        errorMessage = 'Server error. Please try again later.';
      } else {
        errorMessage = error.message || errorMessage;
      }
      
      this.uiManager.showResponse(`Error saving command: ${errorMessage}`, true, "error");
    }
  }

  async overwriteCommandInPalette(paletteName, commandName, currentCommand) {
    try {
      // Fetch the current palette
      const paletteData = await apiClient.getPalette(paletteName);
      
      // Ensure "Saved Commands" category exists
      if (!paletteData.commands["Saved Commands"]) {
        paletteData.commands["Saved Commands"] = {};
      }
      
      // Update the command
      paletteData.commands["Saved Commands"][commandName] = currentCommand;
      
      // Save the updated palette
      await apiClient.updatePalette(paletteName, {
        name: paletteName,
        commands: paletteData.commands
      });

    } catch (error) {
      console.error('Error overwriting command in palette:', error);
      throw error; // Re-throw to be handled by caller
    }
  }

  // Restore just the tab without selecting any specific command
  restoreTabOnly(categoryName) {
    // Find tab by text content using DOMUtils
    const allTabs = DOMUtils.querySelectorAll('.tab');
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
      const firstTab = DOMUtils.querySelector('.tab');
      if (firstTab) {
        this.uiManager.activateTab(firstTab, firstTab.textContent.trim());
      }
    }
  }

  // Restore to "Saved Commands" tab specifically, with fallback to first tab
  restoreToSavedCommandsTab() {
    this.restoreTabOnly("Saved Commands");
  }
} 