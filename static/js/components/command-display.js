import { DOMUtils } from '../utils/dom-utils.js';
import { eventManager, APP_EVENTS } from '../utils/event-manager.js';

// Component for displaying and managing command JSON and variables
export class CommandDisplay {
  constructor() {
    this.isRawJsonExpanded = false;
    this.isFilledJsonExpanded = false;
    this.commandManager = null;
    this.activeVariablePaths = [];
    
    this.rawJsonDisplay = null;
    this.filledJsonDisplay = null;
    this.variableInputsContainer = null;
    this.selectedCommandName = null;
    this.rawJsonToggle = null;
    this.filledJsonToggle = null;
    
    this.initialize();
  }

  /**
   * Initialize command display
   */
  initialize() {
    this.rawJsonDisplay = DOMUtils.getElementById('rawJsonDisplay');
    this.filledJsonDisplay = DOMUtils.getElementById('filledJsonDisplay');
    this.variableInputsContainer = DOMUtils.getElementById('variableInputsContainer');
    this.selectedCommandName = DOMUtils.getElementById('selectedCommandName');
    this.rawJsonToggle = DOMUtils.getElementById('rawJsonToggle');
    this.filledJsonToggle = DOMUtils.getElementById('filledJsonToggle');
    
    this.initializeJsonToggles();
    
    // Listen for command selection events
    eventManager.on(APP_EVENTS.COMMAND_SELECTED, (commandInfo) => {
      this.handleCommandSelection(commandInfo);
    });
    
    eventManager.on(APP_EVENTS.COMMAND_VARIABLES_CHANGED, () => {
      this.updateFilledJsonDisplay();
    });
  }

  /**
   * Set command manager reference
   */
  setCommandManager(commandManager) {
    this.commandManager = commandManager;
  }

  /**
   * Initialize JSON toggle buttons
   */
  initializeJsonToggles() {
    if (this.rawJsonToggle) {
      DOMUtils.addEventListener(this.rawJsonToggle, 'click', () => {
        this.isRawJsonExpanded = !this.isRawJsonExpanded;
        this.rawJsonToggle.textContent = this.isRawJsonExpanded ? '➖' : '➕';
        this.updateRawJsonDisplay();
      });
    }

    if (this.filledJsonToggle) {
      DOMUtils.addEventListener(this.filledJsonToggle, 'click', () => {
        this.isFilledJsonExpanded = !this.isFilledJsonExpanded;
        this.filledJsonToggle.textContent = this.isFilledJsonExpanded ? '➖' : '➕';
        this.updateFilledJsonDisplay();
      });
    }
  }

  /**
   * Handle command selection
   */
  handleCommandSelection(commandInfo) {
    if (!this.commandManager) return;
    
    // Handle null commandInfo (when clearing selection)
    if (!commandInfo) {
      this.clearDisplays();
      return;
    }
    
    // Update the selected command name display
    if (this.selectedCommandName && commandInfo.commandName) {
      DOMUtils.setContent(this.selectedCommandName, commandInfo.commandName);
    }
    
    // Update displays
    this.updateRawJsonDisplay();
    this.updateFilledJsonDisplay();
    this.generateVariableInputsUI();
  }

  /**
   * Update raw JSON display
   */
  updateRawJsonDisplay() {
    if (!this.rawJsonDisplay || !this.commandManager) return;
    
    const command = this.commandManager.getCurrentTemplateCommand();
    if (command) {
      const jsonString = JSON.stringify(command, null, this.isRawJsonExpanded ? 2 : 0);
      DOMUtils.setContent(this.rawJsonDisplay, this.generateHighlightedHtml(jsonString, { type: "raw" }), true);
    } else {
      DOMUtils.setContent(this.rawJsonDisplay, '');
    }
  }

  /**
   * Update filled JSON display
   */
  updateFilledJsonDisplay() {
    if (!this.filledJsonDisplay || !this.commandManager) return;
    
    const command = this.commandManager.getCurrentFilledCommand();
    if (command) {
      const jsonString = JSON.stringify(command, null, this.isFilledJsonExpanded ? 2 : 0);
      DOMUtils.setContent(this.filledJsonDisplay, this.generateHighlightedHtml(jsonString, { type: "filled" }), true);
    } else {
      DOMUtils.setContent(this.filledJsonDisplay, '');
    }
  }

  /**
   * Generate highlighted HTML for JSON with variable placeholders
   */
  generateHighlightedHtml(jsonString, highlightInstructions) {
    if (!jsonString) return "";

    let highlightClass = "";
    if (highlightInstructions.type === "raw") {
      highlightClass = "highlight-yellow";
    } else if (highlightInstructions.type === "filled") {
      highlightClass = "highlight-green";
    }

    if (!highlightClass || !jsonString.includes("%")) {
      return DOMUtils.escapeHtml(jsonString);
    }

    const parts = jsonString.split("%");
    let processedLine = "";
    for (let i = 0; i < parts.length; i++) {
      processedLine += DOMUtils.escapeHtml(parts[i]);
      if (i < parts.length - 1) {
        processedLine += `<span class="${highlightClass}">%</span>`;
      }
    }
    return processedLine;
  }

  /**
   * Generate variable input UI
   */
  generateVariableInputsUI() {
    if (!this.variableInputsContainer || !this.commandManager) return;
    
    this.variableInputsContainer.innerHTML = "";
    this.activeVariablePaths = [];
    let hasPlaceholders = false;

    const currentCommand = this.commandManager.getCurrentTemplateCommand();
    if (!currentCommand) {
      DOMUtils.setContent(this.variableInputsContainer, 
        '<p class="no-variables-message">Select a command to see details.</p>', true);
      return;
    }

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
            
            const inputGroup = this.createVariableInputGroup(newPathParts, value);
            this.variableInputsContainer.appendChild(inputGroup);
          }
        }
      }
    };

    findPlaceholdersAndCreateInputs(currentCommand);
    
    if (!hasPlaceholders) {
      DOMUtils.setContent(this.variableInputsContainer, 
        '<p class="no-variables-message">No variables to fill for this command.</p>', true);
    }
  }

  /**
   * Create a variable input group
   */
  createVariableInputGroup(pathParts, originalValue) {
    const inputGroup = DOMUtils.createElement('div', {
      class: 'variable-input-group'
    });

    const labelText = pathParts.length > 1 && pathParts[0] === "vars"
      ? pathParts.slice(1).join(".")
      : pathParts.join(".");

    const label = DOMUtils.createElement('label', {
      title: `Path: ${pathParts.join(".")}\nOriginal: ${originalValue}`
    }, `${labelText} (${originalValue}):`);

    const input = DOMUtils.createElement('input', {
      type: 'text',
      'data-path': JSON.stringify(pathParts)
    });

    // Set current value if it exists and doesn't contain placeholders
    let currentVal = this.commandManager.getCurrentFilledCommand();
    pathParts.forEach((part) => {
      currentVal = currentVal ? currentVal[part] : undefined;
    });
    if (typeof currentVal === "string" && !currentVal.includes("%")) {
      input.value = currentVal;
    }

    DOMUtils.addEventListener(input, 'input', (e) => {
      const path = JSON.parse(e.target.dataset.path);
      this.commandManager.updateCommandValue(path, e.target.value);
      this.updateFilledJsonDisplay();
      eventManager.emit(APP_EVENTS.COMMAND_VARIABLES_CHANGED);
    });

    inputGroup.appendChild(label);
    inputGroup.appendChild(input);
    
    return inputGroup;
  }

  /**
   * Check if all variables are filled
   */
  areAllVariablesFilled() {
    if (!this.variableInputsContainer) return true;
    
    const variableInputs = this.variableInputsContainer.querySelectorAll("input[type='text']");
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

  /**
   * Clear all displays
   */
  clearDisplays() {
    if (this.rawJsonDisplay) {
      DOMUtils.setContent(this.rawJsonDisplay, '');
    }
    
    if (this.filledJsonDisplay) {
      DOMUtils.setContent(this.filledJsonDisplay, '');
    }
    
    if (this.variableInputsContainer) {
      DOMUtils.setContent(this.variableInputsContainer, 
        '<p class="no-variables-message">Select a command to see details.</p>', true);
    }
    
    if (this.selectedCommandName) {
      DOMUtils.setContent(this.selectedCommandName, 'No command selected');
    }
  }

  /**
   * Get variable values
   */
  getVariableValues() {
    if (!this.variableInputsContainer) return {};
    
    const values = {};
    const inputs = this.variableInputsContainer.querySelectorAll("input[type='text']");
    
    inputs.forEach(input => {
      const path = JSON.parse(input.dataset.path);
      const pathKey = path.join('.');
      values[pathKey] = input.value;
    });
    
    return values;
  }

  /**
   * Set variable values
   */
  setVariableValues(values) {
    if (!this.variableInputsContainer) return;
    
    const inputs = this.variableInputsContainer.querySelectorAll("input[type='text']");
    
    inputs.forEach(input => {
      const path = JSON.parse(input.dataset.path);
      const pathKey = path.join('.');
      
      if (values.hasOwnProperty(pathKey)) {
        input.value = values[pathKey];
        // Trigger change event
        input.dispatchEvent(new Event('input'));
      }
    });
  }

  /**
   * Cleanup
   */
  destroy() {
    eventManager.removeAllListeners(APP_EVENTS.COMMAND_SELECTED);
    eventManager.removeAllListeners(APP_EVENTS.COMMAND_VARIABLES_CHANGED);
  }
} 