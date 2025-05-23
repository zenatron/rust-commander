// Save command functionality module
export class SaveManager {
  constructor(commandManager, uiManager) {
    this.commandManager = commandManager;
    this.uiManager = uiManager;
    this.responseDiv = document.getElementById('response');
  }

  // Show save modal - Updated to include command name input within the modal
  showSaveModal() {
    const currentCommand = this.commandManager.getCurrentFilledCommand();
    if (!currentCommand) {
      if (this.responseDiv) this.responseDiv.textContent = "Error: No command selected or filled to save.";
      else this.uiManager.showAlert("Error: No command selected or filled to save.", "error");
      return;
    }
    
    // Validation for variable inputs should be done by the caller (App.js) before calling showSaveModal

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
    dialog.classList.add('save-modal-dialog'); // Add class for potential global styling
    dialog.style.cssText = `
      background: white; padding: 20px; border-radius: 8px; 
      max-width: 500px; width: 90%; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;

    // Add command name input field directly into the modal HTML
    dialog.innerHTML = `
      <h3 style="margin-top: 0;">Save Command</h3>
      <input type="text" id="modalSaveCommandName" placeholder="Enter command name..." style="width: 95%; padding: 10px; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 4px; font-size: 1em;">
      <p style="margin-top: 0; margin-bottom: 15px;">Choose how you want to save this command:</p>
      <div style="display: flex; flex-direction: column; gap: 10px;">
        <button id="dynamicSaveToNewFile" style="padding: 12px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; text-align: left;">
          <strong>Create New File</strong><br>
          <small style="opacity: 0.9;">Download a new JSON file with this command</small>
        </button>
        <button id="dynamicSaveToExistingFile" style="padding: 12px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; text-align: left;">
          <strong>Add to Existing File</strong><br>
          <small style="opacity: 0.9;">Select a JSON file to add this command to</small>
        </button>
        <button id="dynamicCancelSave" style="padding: 10px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; width: 100%; margin-top: 10px;">
          Cancel
        </button>
      </div>
      <input type="file" id="dynamicFileSelector" accept=".json" style="display: none;">
    `;

    modal.appendChild(dialog);
    document.body.appendChild(modal);

    const commandNameInputInModal = dialog.querySelector('#modalSaveCommandName');
    const fileSelector = dialog.querySelector('#dynamicFileSelector');
    const saveToNewFileBtn = dialog.querySelector('#dynamicSaveToNewFile');
    const saveToExistingFileBtn = dialog.querySelector('#dynamicSaveToExistingFile');
    const cancelSaveBtn = dialog.querySelector('#dynamicCancelSave');

    // Focus the command name input when modal opens
    commandNameInputInModal.focus();

    saveToNewFileBtn.onclick = () => {
      const commandName = commandNameInputInModal.value.trim();
      if (!this.validateCommandName(commandName)) return;
      this.createNewFile(commandName, currentCommand, modal);
    };
    
    saveToExistingFileBtn.onclick = () => {
      const commandName = commandNameInputInModal.value.trim();
      if (!this.validateCommandName(commandName)) return;
      // Command name is validated, now trigger file selection.
      // It will be passed to handleAddToExistingFile through the event chain if needed, or retrieved again.
      fileSelector.click(); 
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

    fileSelector.onchange = async (event) => {
      // Retrieve command name again, in case it was typed after clicking 'add to existing' but before selecting file.
      const commandName = commandNameInputInModal.value.trim();
      if (!this.validateCommandName(commandName)) {
        // If name becomes invalid before file selection, clear file input and refocus.
        event.target.value = null; // Clear the file input
        commandNameInputInModal.focus();
        return;
      }
      await this.handleAddToExistingFile(event, commandName, currentCommand, modal, dialog, escapeKeyListener);
    };
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

  createNewFile(commandName, currentCommand, modalToClose) {
    const commandsToSave = {
      "Saved Commands": {
        [commandName]: currentCommand
      }
    };
    this.downloadFile(
      JSON.stringify(commandsToSave, null, 2),
      `${commandName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}_commands.json`,
      'application/json'
    );
    if (this.responseDiv) this.responseDiv.textContent = `Command '${this.escapeHtml(commandName)}' downloaded as new file!`;
    else this.uiManager.showAlert(`Command '${this.escapeHtml(commandName)}' downloaded as new file!`, 'success');
    
    // No external saveCommandNameInput to clear now
    this.closeDynamicModal(modalToClose, null); // Escape listener already passed to closeDynamicModal from its original scope
  }

  async handleAddToExistingFile(event, commandName, currentCommand, modal, dialog, escapeKeyListenerRef) {
    const file = event.target.files[0];
    if (!file) return;

    // Command name is already validated and passed as an argument.

    try {
      if (this.responseDiv) this.responseDiv.textContent = `Reading ${this.escapeHtml(file.name)}...`;
      const fileContent = await file.text();
      let existingData;
      try {
        existingData = JSON.parse(fileContent);
      } catch (e) {
        if (this.responseDiv) this.responseDiv.textContent = "Error: Selected file is not valid JSON.";
        else this.uiManager.showAlert("Error: Selected file is not valid JSON.", "error");
        event.target.value = null; // Clear file input to allow re-selection
        return;
      }

      if (!existingData || typeof existingData !== 'object') {
        existingData = { "Saved Commands": {} };
      }
      if (!existingData["Saved Commands"] || typeof existingData["Saved Commands"] !== 'object') {
        existingData["Saved Commands"] = {};
      }
      
      if (existingData["Saved Commands"].hasOwnProperty(commandName)) {
          const overwrite = confirm(`Command "${this.escapeHtml(commandName)}" already exists in "${this.escapeHtml(file.name)}". Overwrite?`);
          if (!overwrite) {
              if (this.responseDiv) this.responseDiv.textContent = "Save cancelled. Command name already exists.";
              event.target.value = null; // Clear file input
              return;
          }
      }

      existingData["Saved Commands"][commandName] = currentCommand;

      dialog.innerHTML = `
        <h3 style="margin-top: 0;">Update File: "${this.escapeHtml(file.name)}"</h3>
        <p style="color: #28a745;">SUCCESS: Command "${this.escapeHtml(commandName)}" will be added/updated.</p>
        <p><strong>Commands in file (under "Saved Commands"):</strong></p>
        <ul style="margin: 10px 0; padding-left: 20px; max-height: 150px; overflow-y: auto; background: #f8f9fa; padding: 10px; border-radius: 4px;">
          ${Object.keys(existingData["Saved Commands"] || {}).map(cmd => 
            cmd === commandName ? 
              `<li style="color: #28a745; font-weight: bold;">${this.escapeHtml(cmd)} (NEW/UPDATED)</li>` :
              `<li>${this.escapeHtml(cmd)}</li>`
          ).join('')}
        </ul>
        <p style="font-size: 0.9em; color: #666; margin: 15px 0;">
          <strong>Note:</strong> This will download an updated version. Replace the original file.
        </p>
        <div style="display: flex; gap: 10px; margin-top: 20px;">
          <button id="dynamicConfirmUpdate" style="flex: 1; padding: 10px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Download Updated File
          </button>
          <button id="dynamicCancelUpdate" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">
            Cancel
          </button>
        </div>
      `;

      const confirmUpdateBtn = dialog.querySelector('#dynamicConfirmUpdate');
      const cancelUpdateBtn = dialog.querySelector('#dynamicCancelUpdate');

      confirmUpdateBtn.onclick = () => {
        this.downloadFile(
          JSON.stringify(existingData, null, 2),
          file.name,
          'application/json'
        );
        if (this.responseDiv) this.responseDiv.textContent = `SUCCESS: Updated "${this.escapeHtml(file.name)}" downloaded!`;
        else this.uiManager.showAlert(`SUCCESS: Updated "${this.escapeHtml(file.name)}" downloaded!`, 'success');
        this.closeDynamicModal(modal, escapeKeyListenerRef);
      };
      cancelUpdateBtn.onclick = () => {
        if (this.responseDiv) this.responseDiv.textContent = "Update cancelled.";
        this.closeDynamicModal(modal, escapeKeyListenerRef);
      };
    } catch (error) {
      console.error('Error processing file for "Add to Existing":', error);
      if (this.responseDiv) this.responseDiv.textContent = `Error processing file: ${error.message}`;
      else this.uiManager.showAlert(`Error processing file: ${error.message}`, 'error');
      this.closeDynamicModal(modal, escapeKeyListenerRef); // Close modal on error
    }
  }

  // promptForCommandName() is now largely obsolete as name is taken from modal input.
  // Kept for reference or if a direct prompt is ever needed again.
  promptForCommandName(currentVal = '') {
    let commandName = prompt('Enter a name for this command:', currentVal);
    if (commandName === null) return null; // User cancelled prompt
    commandName = commandName.trim();
    if (!commandName) {
      if (this.responseDiv) this.responseDiv.textContent = 'Command name cannot be empty';
      else this.uiManager.showAlert('Command name cannot be empty', 'error');
      return null; // Indicate failure due to empty name
    }
    return commandName;
  }

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  canSave() {
    const currentCommand = this.commandManager.getCurrentFilledCommand();
    const templateCommand = this.commandManager.getCurrentTemplateCommand();
    return currentCommand && templateCommand && 
           JSON.stringify(currentCommand) !== JSON.stringify(templateCommand);
  }
} 