// Command Options management module
export class CommandOptionsManager {
  constructor(commandManager, uiManager, saveManager) {
    this.commandManager = commandManager;
    this.uiManager = uiManager;
    this.saveManager = saveManager;
    this.responseDiv = document.getElementById('response');
  }

  async showCommandOptionsModal() {
    const currentCommand = this.commandManager.getCurrentFilledCommand();
    if (!currentCommand) {
      if (this.responseDiv) this.responseDiv.textContent = "Error: No command selected or filled to work with.";
      else this.uiManager.showAlert("Error: No command selected or filled to work with.", "error");
      return;
    }

    if (this.responseDiv) this.responseDiv.textContent = "Choose command option...";

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
          <small style="opacity: 0.9;">Modify this command (Coming Soon)</small>
        </button>
        <button id="optionDeleteCommand" style="padding: 15px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; text-align: left; font-size: 1em;">
          <strong>🗑️ Delete Command</strong><br>
          <small style="opacity: 0.9;">Remove this command (Coming Soon)</small>
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
      // Placeholder for future edit functionality
      if (this.responseDiv) this.responseDiv.textContent = "Edit command functionality coming soon!";
      else this.uiManager.showAlert("Edit command functionality coming soon!", "info");
      this.closeDynamicModal(modal, escapeKeyListener);
    };

    deleteCommandBtn.onclick = () => {
      // Placeholder for future delete functionality
      if (this.responseDiv) this.responseDiv.textContent = "Delete command functionality coming soon!";
      else this.uiManager.showAlert("Delete command functionality coming soon!", "info");
      this.closeDynamicModal(modal, escapeKeyListener);
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
    if (this.responseDiv) this.responseDiv.textContent = "Enter command name and choose save option...";

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
    if (this.responseDiv) this.responseDiv.textContent = "Choose command option...";

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
          <small style="opacity: 0.9;">Modify this command (Coming Soon)</small>
        </button>
        <button id="optionDeleteCommand" style="padding: 15px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; text-align: left; font-size: 1em;">
          <strong>🗑️ Delete Command</strong><br>
          <small style="opacity: 0.9;">Remove this command (Coming Soon)</small>
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
      if (this.responseDiv) this.responseDiv.textContent = "Edit command functionality coming soon!";
      else this.uiManager.showAlert("Edit command functionality coming soon!", "info");
      this.closeDynamicModal(modal, escapeKeyListener);
    };

    deleteCommandBtn.onclick = () => {
      if (this.responseDiv) this.responseDiv.textContent = "Delete command functionality coming soon!";
      else this.uiManager.showAlert("Delete command functionality coming soon!", "info");
      this.closeDynamicModal(modal, escapeKeyListener);
    };

    cancelBtn.onclick = () => this.closeDynamicModal(modal, escapeKeyListener);
  }

  async handleSaveCommand(modalElement, escapeListener) {
    const commandNameInput = modalElement.querySelector('#saveCommandName');
    const paletteSelect = modalElement.querySelector('#paletteSelect');
    const newPaletteNameInput = modalElement.querySelector('#newPaletteName');
    const paletteSelectionArea = modalElement.querySelector('#paletteSelectionArea');
    const newPaletteArea = modalElement.querySelector('#newPaletteArea');

    const commandName = commandNameInput?.value.trim();
    if (!commandName) {
      if (this.responseDiv) this.responseDiv.textContent = "Command name is required.";
      return;
    }

    let targetPalette = '';
    if (paletteSelectionArea.style.display === 'block') {
      targetPalette = paletteSelect?.value;
      if (!targetPalette) {
        if (this.responseDiv) this.responseDiv.textContent = "Please select a palette.";
        return;
      }
    } else if (newPaletteArea.style.display === 'block') {
      targetPalette = newPaletteNameInput?.value.trim();
      if (!targetPalette) {
        if (this.responseDiv) this.responseDiv.textContent = "New palette name is required.";
        return;
      }
    } else {
      if (this.responseDiv) this.responseDiv.textContent = "Please choose a save option.";
      return;
    }

    // Use the SaveManager's existing save functionality
    const currentCommand = this.commandManager.getCurrentFilledCommand();
    const result = await this.saveManager.saveCommandToPalette(commandName, targetPalette, currentCommand);
    
    if (result.success) {
      this.closeDynamicModal(modalElement, escapeListener);
    }
    // Error handling is done in the saveManager
  }

  closeDynamicModal(modalElement, escapeListenerToRemove) {
    if (modalElement && modalElement.parentNode) {
      modalElement.parentNode.removeChild(modalElement);
    }
    if (this.responseDiv && (
        this.responseDiv.textContent === "Choose command option..." ||
        this.responseDiv.textContent === "Enter command name and choose save option..."
    )) {
        this.responseDiv.textContent = ""; 
    }
    if (escapeListenerToRemove) {
      document.removeEventListener('keydown', escapeListenerToRemove);
    }
  }
} 