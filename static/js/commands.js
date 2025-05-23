// Command management module
export class CommandManager {
  constructor() {
    this.commandsData = {};
    this.currentCommandTemplate = null;
    this.currentFilledCommand = null;
    this.activeVariablePaths = [];
  }

  // Load commands from URL or file
  async loadCommands(source) {
    try {
      let data;
      if (typeof source === 'string') { // URL for initial load
        const response = await fetch(source);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        data = await response.json();
      } else { // File object for user uploads
        data = JSON.parse(await source.text()); // Parse file content as JSON
      }
      this.commandsData = data;
      return { success: true, data };
    } catch (error) {
      console.error("Error loading commands:", error);
      this.commandsData = {}; // Clear commands data on error
      return { success: false, error: error.message };
    }
  }

  // New method: Load commands directly from a JSON object (used for palettes)
  loadCommandsFromJson(jsonData) {
    try {
      // Validate if jsonData is an object (basic validation)
      if (typeof jsonData !== 'object' || jsonData === null) {
        throw new Error("Invalid JSON data provided. Must be an object.");
      }
      // If jsonData is the full palette object like { name: "paletteName", commands: { actual_commands } }
      // we need to store only the actual_commands part.
      // If jsonData is already just the commands map (e.g. from an old file format), this will need adjustment
      // Assuming jsonData from palette loading is always the full Palette object from the backend.
      if (jsonData.hasOwnProperty('commands') && typeof jsonData.name === 'string') {
        this.commandsData = jsonData.commands; // Store only the commands map
      } else {
        // If it doesn't look like a full Palette object, assume it's already just the commands map.
        // This provides some backward compatibility if a raw commands file (not a palette) was loaded.
        this.commandsData = jsonData; 
      }
      
      this.clearCurrentCommand(); 
      return { success: true, data: this.commandsData };
    } catch (error) {
      console.error("Error loading commands from JSON:", error);
      this.commandsData = {}; // Clear commands data on error
      this.clearCurrentCommand();
      return { success: false, error: error.message };
    }
  }
  
  // New method: Get all commands (the entire commandsData object)
  getAllCommands() {
    return this.commandsData;
  }

  // New method: Clear all loaded commands and current selection
  clearAllCommands() {
    this.commandsData = {};
    this.clearCurrentCommand();
  }
  
  // New method: Clear only the current command selection
  clearCurrentCommand() {
    this.currentCommandTemplate = null;
    this.currentFilledCommand = null;
    this.activeVariablePaths = [];
  }

  // Set current command
  setCurrentCommand(commandJson) {
    this.currentCommandTemplate = JSON.parse(commandJson);
    this.currentFilledCommand = JSON.parse(commandJson);
  }

  // Update filled command value
  updateCommandValue(path, value) {
    let targetObject = this.currentFilledCommand;
    for (let i = 0; i < path.length - 1; i++) {
      if (!targetObject[path[i]]) targetObject[path[i]] = {};
      targetObject = targetObject[path[i]];
    }
    targetObject[path[path.length - 1]] = value;
  }

  // Generate variable input UI
  generateVariableInputsUI(container, onVariableChange) {
    container.innerHTML = "";
    this.activeVariablePaths = [];
    let hasPlaceholders = false;

    const findPlaceholdersAndCreateInputs = (obj, currentPathParts = []) => {
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          const value = obj[key];
          const newPathParts = [...currentPathParts, key];

          if (typeof value === "object" && value !== null) {
            findPlaceholdersAndCreateInputs(value, newPathParts);
          } else if (typeof value === "string" && value.includes("%")) {
            hasPlaceholders = true;
            this.activeVariablePaths.push([...newPathParts]);
            
            const inputGroup = document.createElement("div");
            inputGroup.classList.add("variable-input-group");

            const label = document.createElement("label");
            const labelText = newPathParts.length > 1 && newPathParts[0] === "vars"
              ? newPathParts.slice(1).join(".")
              : newPathParts.join(".");
            label.textContent = `${labelText} (${value}):`;
            label.title = `Path: ${newPathParts.join(".")}\\nOriginal: ${value}`;

            const input = document.createElement("input");
            input.type = "text";
            input.dataset.path = JSON.stringify(newPathParts);

            // Set current value if it exists and doesn't contain placeholders
            let currentVal = this.currentFilledCommand;
            newPathParts.forEach((part) => {
              currentVal = currentVal ? currentVal[part] : undefined;
            });
            if (typeof currentVal === "string" && !currentVal.includes("%")) {
              input.value = currentVal;
            }

            input.addEventListener("input", (e) => {
              const path = JSON.parse(e.target.dataset.path);
              this.updateCommandValue(path, e.target.value);
              onVariableChange();
            });

            inputGroup.appendChild(label);
            inputGroup.appendChild(input);
            container.appendChild(inputGroup);
          }
        }
      }
    };

    if (this.currentCommandTemplate) {
      findPlaceholdersAndCreateInputs(this.currentCommandTemplate);
    }
    
    if (!hasPlaceholders) {
      container.innerHTML = '<p class="no-variables-message">No variables to fill for this command.</p>';
    }
  }

  // Check if all variables are filled
  areAllVariablesFilled(container) {
    const variableInputs = container.querySelectorAll("input[type='text']");
    let allFilled = true;
    
    variableInputs.forEach(input => {
      if (input.value.trim() === "") {
        allFilled = false;
        input.style.borderColor = "red";
      } else {
        input.style.borderColor = "#ccc";
      }
    });
    
    return allFilled;
  }

  // Get commands data
  getCommandsData() {
    return this.commandsData;
  }

  // Get current filled command
  getCurrentFilledCommand() {
    return this.currentFilledCommand;
  }

  // Get current template command
  getCurrentTemplateCommand() {
    return this.currentCommandTemplate;
  }
} 