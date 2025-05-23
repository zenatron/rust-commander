// Save command functionality module
export class SaveManager {
  constructor(commandManager, uiManager) {
    this.commandManager = commandManager;
    this.uiManager = uiManager;
    this.setupModalHandlers();
  }

  // Setup modal event handlers
  setupModalHandlers() {
    // Modal backdrop click closes modal
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        this.closeModal();
      }
    });

    // Escape key closes modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
      }
    });
  }

  // Show save modal
  showSaveModal() {
    const modal = document.getElementById('save-modal');
    modal.style.display = 'block';

    // Set up action buttons
    document.getElementById('create-new-file').onclick = () => this.createNewFile();
    document.getElementById('add-to-existing').onclick = () => this.addToExistingFile();
    document.getElementById('cancel-save').onclick = () => this.closeModal();
  }

  // Close modal
  closeModal() {
    const modal = document.getElementById('save-modal');
    modal.style.display = 'none';
  }

  // Create new command file
  createNewFile() {
    const commandName = this.promptForCommandName();
    if (!commandName) return;

    const currentCommand = this.commandManager.getCurrentFilledCommand();
    if (!currentCommand) {
      this.uiManager.showAlert('No command to save', 'error');
      return;
    }

    const commandData = {
      [commandName]: currentCommand
    };

    this.downloadFile(
      JSON.stringify(commandData, null, 2),
      `${commandName}.json`,
      'application/json'
    );

    this.uiManager.showAlert('SUCCESS: New command file created and downloaded!', 'success');
    this.closeModal();
  }

  // Add to existing file
  addToExistingFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const existingData = JSON.parse(await file.text());
        const commandName = this.promptForCommandName();
        if (!commandName) return;

        const currentCommand = this.commandManager.getCurrentFilledCommand();
        if (!currentCommand) {
          this.uiManager.showAlert('No command to save', 'error');
          return;
        }

        // Show confirmation dialog
        const existingCommands = Object.keys(existingData);
        const confirmationMessage = `
Existing commands in file: ${existingCommands.join(', ')}

New command to add: ${commandName}

Continue?`;

        if (!confirm(confirmationMessage)) return;

        // Add new command
        existingData[commandName] = currentCommand;

        // Download updated file
        this.downloadFile(
          JSON.stringify(existingData, null, 2),
          file.name,
          'application/json'
        );

        this.uiManager.showAlert(
          `SUCCESS: Command "${commandName}" added to ${file.name}. Please replace the original file with the downloaded version.`,
          'success'
        );
        this.closeModal();

      } catch (error) {
        console.error('Error processing file:', error);
        this.uiManager.showAlert('Error reading or parsing the selected file', 'error');
      }
    };

    input.click();
  }

  // Prompt user for command name
  promptForCommandName() {
    let commandName = prompt('Enter a name for this command:');
    if (!commandName) return null;

    commandName = commandName.trim();
    if (!commandName) {
      this.uiManager.showAlert('Command name cannot be empty', 'error');
      return null;
    }

    return commandName;
  }

  // Download file utility
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

  // Check if save is available (has filled command)
  canSave() {
    const currentCommand = this.commandManager.getCurrentFilledCommand();
    const templateCommand = this.commandManager.getCurrentTemplateCommand();
    
    return currentCommand && templateCommand && 
           JSON.stringify(currentCommand) !== JSON.stringify(templateCommand);
  }
} 