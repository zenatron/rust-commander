export class SaveManager {
  constructor(commandManager, uiManager) {
    this.commandManager = commandManager;
    this.uiManager = uiManager;
    this.responseDiv = document.getElementById('response');
  }



  async showSaveModal() {
    const currentCommand = this.commandManager.getCurrentFilledCommand();
    if (!currentCommand) {
      if (this.responseDiv) this.responseDiv.textContent = "Error: No command selected or filled to save.";
      else this.uiManager.showAlert("Error: No command selected or filled to save.", "error");
      return;
    }

    // Fetch available palettes
    let availablePalettes = [];
    try {
      const response = await fetch('/api/palettes');
      if (response.ok) {
        availablePalettes = await response.json();
      }
    } catch (error) {
      console.error('Error fetching palettes:', error);
    }

    if (this.responseDiv) this.responseDiv.textContent = "Enter command name and choose save option...";

    const existingModal = document.getElementById('dynamic-save-modal');
    if (existingModal) {
      existingModal.remove();
    }

    const modal = document.createElement('div');
    modal.id = 'dynamic-save-modal';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,0,0,0.5); z-index: 1000; display: flex; 
      align-items: center; justify-content: center;
    `;

    const dialog = document.createElement('div');
    dialog.classList.add('save-modal-dialog');
    dialog.style.cssText = `
      background: white; padding: 20px; border-radius: 8px; 
      max-width: 500px; width: 90%; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;

    // Build palette options HTML
    let paletteOptionsHtml = '';
    if (availablePalettes.length > 0) {
      paletteOptionsHtml = `
        <div style="margin-bottom: 10px;">
          <label for="paletteSelect" style="display: block; margin-bottom: 5px;">Select Palette:</label>
          <select id="paletteSelect" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
            <option value="">-- Select a palette --</option>
            ${availablePalettes.map(palette => `<option value="${this.escapeHtml(palette)}">${this.escapeHtml(palette)}</option>`).join('')}
          </select>
        </div>
      `;
    }

    dialog.innerHTML = `
      <h3 style="margin-top: 0;">Save Command to Palette</h3>
      <input type="text" id="modalSaveCommandName" placeholder="Enter command name..." style="width: 95%; padding: 10px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 4px; font-size: 1em;">
      <p style="margin-top: 0; margin-bottom: 15px; font-weight: bold;">Choose how you want to save this command:</p>
      ${paletteOptionsHtml}
      <div style="display: flex; flex-direction: column; gap: 10px;">
        ${availablePalettes.length > 0 ? `
          <button id="dynamicSaveToExistingPalette" style="padding: 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; text-align: left;">
            <strong>Add to Selected Palette</strong><br>
            <small style="opacity: 0.9;">Add this command to the selected palette</small>
          </button>
        ` : ''}
        <p style="margin-top: 0px; margin-bottom: 0px; text-align: center; font-weight: bold;">OR</p>
        <button id="dynamicSaveToNewPalette" style="padding: 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; text-align: left;">
          <strong>Create New Palette</strong><br>
          <small style="opacity: 0.9;">Create a new palette with this command</small>
        </button>
        <button id="dynamicCancelSave" style="padding: 10px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%;">
          Cancel
        </button>
      </div>
    `;

    modal.appendChild(dialog);
    document.body.appendChild(modal);

    const commandNameInput = dialog.querySelector('#modalSaveCommandName');
    const paletteSelect = dialog.querySelector('#paletteSelect');
    const saveToExistingPaletteBtn = dialog.querySelector('#dynamicSaveToExistingPalette');
    const saveToNewPaletteBtn = dialog.querySelector('#dynamicSaveToNewPalette');
    const cancelSaveBtn = dialog.querySelector('#dynamicCancelSave');

    // Focus the command name input when modal opens
    commandNameInput.focus();

    if (saveToExistingPaletteBtn) {
      saveToExistingPaletteBtn.onclick = async () => {
        const commandName = commandNameInput.value.trim();
        const selectedPalette = paletteSelect ? paletteSelect.value : '';
        
        if (!this.validateCommandName(commandName)) return;
        if (!selectedPalette) {
          if (this.responseDiv) this.responseDiv.textContent = "Please select a palette.";
          else this.uiManager.showAlert("Please select a palette.", "error");
          return;
        }
        
        await this.addToExistingPalette(selectedPalette, commandName, currentCommand, modal);
      };
    }
    
    saveToNewPaletteBtn.onclick = async () => {
      const commandName = commandNameInput.value.trim();
      if (!this.validateCommandName(commandName)) return;
      await this.createNewPalette(commandName, currentCommand, modal);
    };

    cancelSaveBtn.onclick = () => this.closeDynamicModal(modal, escapeKeyListener);
    
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

  validateCommandName(commandName) {
    if (!commandName) {
      if (this.responseDiv) this.responseDiv.textContent = "Error: Command name cannot be empty.";
      else this.uiManager.showAlert("Error: Command name cannot be empty.", "error");
      const modalInput = document.getElementById('modalSaveCommandName');
      if (modalInput) modalInput.focus();
      return false;
    }
    return true;
  }

  async saveCommandToPalette(commandName, paletteName, commandData) {
    try {
      const response = await fetch(`/api/palettes/${paletteName}/commands`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command_name: commandName,
          command_data: commandData
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        if (response.status === 409) {
          if (this.responseDiv) this.responseDiv.textContent = errorData.message || 'Command already exists in palette.';
          return { success: false, error: errorData.message || 'Command already exists' };
        } else {
          if (this.responseDiv) this.responseDiv.textContent = `Save error: ${errorData.error || 'Unknown error'}`;
          return { success: false, error: errorData.error || 'Unknown error' };
        }
      }

      const result = await response.json();
      if (this.responseDiv) this.responseDiv.textContent = `Command '${commandName}' saved to palette '${paletteName}' successfully.`;
      
      // Trigger a refresh of the UI if needed (you may want to emit an event here)
      if (window.commanderApp && typeof window.commanderApp.fetchPalettes === 'function') {
        await window.commanderApp.fetchPalettes();
        if (window.commanderApp.uiManager && typeof window.commanderApp.uiManager.setSelectedPalette === 'function') {
          window.commanderApp.uiManager.setSelectedPalette(paletteName);
        }
        await window.commanderApp.loadPalette(paletteName);
      }
      
      return { success: true, result };
    } catch (error) {
      console.error('Error saving command:', error);
      if (this.responseDiv) this.responseDiv.textContent = `Save error: ${error.message}`;
      return { success: false, error: error.message };
    }
  }

  closeDynamicModal(modalElement, escapeListenerToRemove) {
    if (modalElement && modalElement.parentNode) {
      modalElement.parentNode.removeChild(modalElement);
    }
    if (this.responseDiv && this.responseDiv.textContent === "Enter command name and choose save option...") {
        this.responseDiv.textContent = ""; 
    }
    if (escapeListenerToRemove) {
      document.removeEventListener('keydown', escapeListenerToRemove);
    }
  }
  
  escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  }

  async addToExistingPalette(paletteName, commandName, currentCommand, modalToClose) {
    try {
      // Add timeout and retry logic
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      console.log(`Attempting to save command "${commandName}" to palette "${paletteName}"`);
      
      const response = await fetch(`/api/palettes/${encodeURIComponent(paletteName)}/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command_name: commandName,
          command_data: currentCommand
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);

      if (response.status === 409) {
        // Command already exists - ask for confirmation
        const overwrite = confirm(`Command "${this.escapeHtml(commandName)}" already exists in palette "${this.escapeHtml(paletteName)}". Overwrite?`);
        if (!overwrite) {
          if (this.responseDiv) this.responseDiv.textContent = "Save cancelled. Command name already exists.";
          return;
        }
        
        // User confirmed overwrite - we need to update the palette directly
        await this.overwriteCommandInPalette(paletteName, commandName, currentCommand, modalToClose);
        return;
      }

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorData}`);
      }

      const result = await response.json();
      console.log('Save successful:', result);
      
      if (this.responseDiv) this.responseDiv.textContent = `Command '${this.escapeHtml(commandName)}' added to palette '${this.escapeHtml(paletteName)}' successfully!`;
      else this.uiManager.showAlert(`Command '${this.escapeHtml(commandName)}' added to palette '${this.escapeHtml(paletteName)}' successfully!`, 'success');
      
      this.closeDynamicModal(modalToClose, null);
      
      // Refresh the palette list if this is the current palette
      if (window.commanderApp && typeof window.commanderApp.fetchPalettes === 'function') {
        await window.commanderApp.fetchPalettes();
      }
    } catch (error) {
      console.error('Error adding command to palette:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Unknown error occurred';
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out. Please try again.';
      } else if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
        errorMessage = 'Network connection error. Please check your connection and try again.';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Could not connect to server. Please ensure the server is running.';
      } else {
        errorMessage = error.message;
      }
      
      if (this.responseDiv) this.responseDiv.textContent = `Error adding command: ${errorMessage}`;
      else this.uiManager.showAlert(`Error adding command: ${errorMessage}`, 'error');
      
      const retry = confirm(`Failed to save command: ${errorMessage}\n\nWould you like to try again?`);
      if (retry) {
        setTimeout(() => {
          this.addToExistingPalette(paletteName, commandName, currentCommand, modalToClose);
        }, 1000);
      }
    }
  }

  async overwriteCommandInPalette(paletteName, commandName, currentCommand, modalToClose) {
    try {
      // Add timeout for fetch requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      console.log(`Attempting to overwrite command "${commandName}" in palette "${paletteName}"`);
      
      // First, fetch the current palette
      const getResponse = await fetch(`/api/palettes/${encodeURIComponent(paletteName)}`, {
        signal: controller.signal
      });
      if (!getResponse.ok) {
        throw new Error('Failed to fetch palette for update');
      }
      
      const palette = await getResponse.json();
      
      // Ensure "Saved Commands" category exists
      if (!palette.commands["Saved Commands"]) {
        palette.commands["Saved Commands"] = {};
      }
      
      // Update the command
      palette.commands["Saved Commands"][commandName] = currentCommand;
      
      // Save the updated palette
      const updateResponse = await fetch(`/api/palettes/${encodeURIComponent(paletteName)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: paletteName,
          commands: palette.commands
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!updateResponse.ok) {
        const errorData = await updateResponse.text();
        throw new Error(`HTTP error! status: ${updateResponse.status}, message: ${errorData}`);
      }

      console.log('Overwrite successful');
      
      if (this.responseDiv) this.responseDiv.textContent = `Command '${this.escapeHtml(commandName)}' updated in palette '${this.escapeHtml(paletteName)}' successfully!`;
      else this.uiManager.showAlert(`Command '${this.escapeHtml(commandName)}' updated in palette '${this.escapeHtml(paletteName)}' successfully!`, 'success');
      
      this.closeDynamicModal(modalToClose, null);
      
      // Refresh the palette list
      if (window.commanderApp && typeof window.commanderApp.fetchPalettes === 'function') {
        await window.commanderApp.fetchPalettes();
      }
    } catch (error) {
      console.error('Error updating command in palette:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Unknown error occurred';
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out. Please try again.';
      } else if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
        errorMessage = 'Network connection error. Please check your connection and try again.';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Could not connect to server. Please ensure the server is running.';
      } else {
        errorMessage = error.message;
      }
      
      if (this.responseDiv) this.responseDiv.textContent = `Error updating command: ${errorMessage}`;
      else this.uiManager.showAlert(`Error updating command: ${errorMessage}`, 'error');
      
      const retry = confirm(`Failed to update command: ${errorMessage}\n\nWould you like to try again?`);
      if (retry) {
        setTimeout(() => {
          this.overwriteCommandInPalette(paletteName, commandName, currentCommand, modalToClose);
        }, 1000);
      }
    }
  }

  async createNewPalette(commandName, currentCommand, modalToClose) {
    const paletteName = prompt("Enter name for the new palette:");
    if (!paletteName || paletteName.trim() === "") {
      if (this.responseDiv) this.responseDiv.textContent = "Palette name cannot be empty.";
      else this.uiManager.showAlert("Palette name cannot be empty.", "error");
      return;
    }

    try {
      const newPaletteData = {
        "Saved Commands": {
          [commandName]: currentCommand
        }
      };

      // Add timeout for fetch request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      console.log(`Attempting to create new palette "${paletteName}" with command "${commandName}"`);

      const response = await fetch('/api/palettes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: paletteName.trim(), commands: newPaletteData }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorData}`);
      }

      console.log('New palette created successfully');

      if (this.responseDiv) this.responseDiv.textContent = `New palette '${this.escapeHtml(paletteName)}' created with command '${this.escapeHtml(commandName)}'!`;
      else this.uiManager.showAlert(`New palette '${this.escapeHtml(paletteName)}' created with command '${this.escapeHtml(commandName)}'!`, 'success');
      
      this.closeDynamicModal(modalToClose, null);
      
      // Refresh the palette list and load the new palette
      if (window.commanderApp && typeof window.commanderApp.fetchPalettes === 'function') {
        await window.commanderApp.fetchPalettes();
        if (typeof window.commanderApp.loadPalette === 'function') {
          await window.commanderApp.loadPalette(paletteName.trim());
        }
      }
    } catch (error) {
      console.error('Error creating new palette:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Unknown error occurred';
      if (error.name === 'AbortError') {
        errorMessage = 'Request timed out. Please try again.';
      } else if (error.message.includes('NetworkError') || error.message.includes('fetch')) {
        errorMessage = 'Network connection error. Please check your connection and try again.';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Could not connect to server. Please ensure the server is running.';
      } else {
        errorMessage = error.message;
      }
      
      if (this.responseDiv) this.responseDiv.textContent = `Error creating palette: ${errorMessage}`;
      else this.uiManager.showAlert(`Error creating palette: ${errorMessage}`, 'error');
      
      const retry = confirm(`Failed to create palette: ${errorMessage}\n\nWould you like to try again?`);
      if (retry) {
        setTimeout(() => {
          this.createNewPalette(commandName, currentCommand, modalToClose);
        }, 1000);
      }
    }
  }

  canSave() {
    const currentCommand = this.commandManager.getCurrentFilledCommand();
    const templateCommand = this.commandManager.getCurrentTemplateCommand();
    return currentCommand && templateCommand && 
           JSON.stringify(currentCommand) !== JSON.stringify(templateCommand);
  }
} 