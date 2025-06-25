import { eventManager, APP_EVENTS } from './utils/event-manager.js';
import { Validators } from './utils/validators.js';

// Command management module
export class CommandManager {
  constructor() {
    this.commandsData = {};
    this.currentCommandTemplate = null;
    this.currentFilledCommand = null;
    this.activeVariablePaths = [];
    this.currentCommandInfo = null;
    
    this.initialize();
  }

  /**
   * Initialize command manager
   */
  initialize() {
    // Listen for variable changes to update filled command
    eventManager.on(APP_EVENTS.COMMAND_VARIABLES_CHANGED, () => {
      this.notifyCommandChanged();
    });
  }

  /**
   * Load commands from URL or file
   */
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
      
      const validationResult = this.validateCommandsData(data);
      if (!validationResult.isValid) {
        throw new Error(validationResult.message);
      }
      
      this.commandsData = data;
      this.clearCurrentCommand();
      
      eventManager.emit(APP_EVENTS.PALETTE_LOADED, { data, source });
      
      return { success: true, data };
    } catch (error) {
      console.error("Error loading commands:", error);
      this.commandsData = {}; // Clear commands data on error
      this.clearCurrentCommand();
      
      eventManager.emit(APP_EVENTS.ERROR_OCCURRED, {
        type: 'command_load_error',
        message: error.message,
        source
      });
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Load commands directly from a JSON object (used for palettes)
   */
  loadCommandsFromJson(jsonData) {
    try {
      // Validate if jsonData is an object (basic validation)
      if (typeof jsonData !== 'object' || jsonData === null) {
        throw new Error("Invalid JSON data provided. Must be an object.");
      }
      
      let commandsToLoad;
      if (jsonData.hasOwnProperty('commands') && typeof jsonData.name === 'string') {
        commandsToLoad = jsonData.commands; // Store only the commands map
      } else {
        commandsToLoad = jsonData; 
      }
      
      const validationResult = this.validateCommandsData(commandsToLoad);
      if (!validationResult.isValid) {
        throw new Error(validationResult.message);
      }
      
      this.commandsData = commandsToLoad;
      this.clearCurrentCommand();
      
      eventManager.emit(APP_EVENTS.PALETTE_LOADED, { data: commandsToLoad, source: 'json' });
      
      return { success: true, data: this.commandsData };
    } catch (error) {
      console.error("Error loading commands from JSON:", error);
      this.commandsData = {};
      this.clearCurrentCommand();
      
      eventManager.emit(APP_EVENTS.ERROR_OCCURRED, {
        type: 'json_load_error',
        message: error.message,
        data: jsonData
      });
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Validate commands data structure
   */
  validateCommandsData(data) {
    if (!data || typeof data !== 'object') {
      return {
        isValid: false,
        message: 'Commands data must be a valid object'
      };
    }

    // Allow empty data
    if (Object.keys(data).length === 0) {
      return { isValid: true, message: null };
    }

    // Validate palette structure
    return Validators.isValidPaletteObject(data);
  }

  /**
   * Get all commands
   */
  getAllCommands() {
    return this.commandsData;
  }

  /**
   * Clear all commands
   */
  clearAllCommands() {
    this.commandsData = {};
    this.clearCurrentCommand();
    
    eventManager.emit(APP_EVENTS.PALETTE_LOADED, { data: {}, source: 'clear' });
  }

  /**
   * Clear current command selection
   */
  clearCurrentCommand() {
    this.currentCommandTemplate = null;
    this.currentFilledCommand = null;
    this.activeVariablePaths = [];
    this.currentCommandInfo = null;
    
    eventManager.emit(APP_EVENTS.COMMAND_SELECTED, null);
  }

  /**
   * Check if a specific command exists in the current command data
   */
  doesCommandExist(categoryName, commandName) {
    if (!this.commandsData || !this.commandsData[categoryName]) {
      return false;
    }
    return this.commandsData[categoryName].hasOwnProperty(commandName);
  }

  /**
   * Get command by category and name
   */
  getCommand(categoryName, commandName) {
    if (!this.doesCommandExist(categoryName, commandName)) {
      return null;
    }
    return this.commandsData[categoryName][commandName];
  }

  /**
   * Set current command
   */
  setCurrentCommand(commandJson, commandInfo = null) {
    try {
      const commandData = typeof commandJson === 'string' ? JSON.parse(commandJson) : commandJson;
      
      // Validate command data
      const validationResult = Validators.isValidCommandObject(commandData);
      if (!validationResult.isValid) {
        throw new Error(validationResult.message);
      }
      
      this.currentCommandTemplate = JSON.parse(JSON.stringify(commandData)); // Deep clone
      this.currentFilledCommand = JSON.parse(JSON.stringify(commandData)); // Deep clone
      this.currentCommandInfo = commandInfo;
      this.activeVariablePaths = [];
      
      // Find variable paths
      this.findVariablePaths(this.currentCommandTemplate);
      
      eventManager.emit(APP_EVENTS.COMMAND_SELECTED, {
        templateCommand: this.currentCommandTemplate,
        filledCommand: this.currentFilledCommand,
        commandInfo: commandInfo,
        variablePaths: this.activeVariablePaths
      });
      
      return { success: true };
    } catch (error) {
      console.error("Error setting current command:", error);
      
      eventManager.emit(APP_EVENTS.ERROR_OCCURRED, {
        type: 'command_set_error',
        message: error.message,
        commandJson
      });
      
      return { success: false, error: error.message };
    }
  }

  /**
   * Find variable paths in command template
   */
  findVariablePaths(obj, currentPath = []) {
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        const newPath = [...currentPath, key];

        if (typeof value === "object" && value !== null) {
          this.findVariablePaths(value, newPath);
        } else if (typeof value === "string" && value.includes("%")) {
          this.activeVariablePaths.push([...newPath]);
        }
      }
    }
  }

  /**
   * Update filled command value
   */
  updateCommandValue(path, value) {
    if (!this.currentFilledCommand) {
      console.warn("No current command to update");
      return false;
    }
    
    try {
      let targetObject = this.currentFilledCommand;
      for (let i = 0; i < path.length - 1; i++) {
        if (!targetObject[path[i]]) targetObject[path[i]] = {};
        targetObject = targetObject[path[i]];
      }
      targetObject[path[path.length - 1]] = value;
      
      eventManager.emit(APP_EVENTS.COMMAND_VARIABLES_CHANGED, {
        path,
        value,
        filledCommand: this.currentFilledCommand
      });
      
      return true;
    } catch (error) {
      console.error("Error updating command value:", error);
      
      eventManager.emit(APP_EVENTS.ERROR_OCCURRED, {
        type: 'command_update_error',
        message: error.message,
        path,
        value
      });
      
      return false;
    }
  }

  /**
   * Check if all variables are filled
   */
  areAllVariablesFilled() {
    if (!this.currentFilledCommand || this.activeVariablePaths.length === 0) {
      return true;
    }
    
    for (const path of this.activeVariablePaths) {
      let currentValue = this.currentFilledCommand;
      for (const part of path) {
        currentValue = currentValue ? currentValue[part] : undefined;
      }
      
      if (!currentValue || (typeof currentValue === 'string' && currentValue.includes('%'))) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get variable values
   */
  getVariableValues() {
    const values = {};
    
    if (!this.currentFilledCommand) return values;
    
    for (const path of this.activeVariablePaths) {
      let currentValue = this.currentFilledCommand;
      for (const part of path) {
        currentValue = currentValue ? currentValue[part] : undefined;
      }
      
      const pathKey = path.join('.');
      values[pathKey] = currentValue || '';
    }
    
    return values;
  }

  /**
   * Set variable values
   */
  setVariableValues(values) {
    if (!this.currentFilledCommand) return false;
    
    let hasChanges = false;
    
    for (const [pathKey, value] of Object.entries(values)) {
      const path = pathKey.split('.');
      if (this.updateCommandValue(path, value)) {
        hasChanges = true;
      }
    }
    
    return hasChanges;
  }

  /**
   * Get current filled command
   */
  getCurrentFilledCommand() {
    return this.currentFilledCommand;
  }

  /**
   * Get current template command
   */
  getCurrentTemplateCommand() {
    return this.currentCommandTemplate;
  }

  /**
   * Get current command info
   */
  getCurrentCommandInfo() {
    return this.currentCommandInfo;
  }

  /**
   * Get active variable paths
   */
  getActiveVariablePaths() {
    return [...this.activeVariablePaths];
  }

  /**
   * Get commands data
   */
  getCommandsData() {
    return this.commandsData;
  }

  /**
   * Get categories
   */
  getCategories() {
    return Object.keys(this.commandsData);
  }

  /**
   * Get commands in category
   */
  getCommandsInCategory(categoryName) {
    return this.commandsData[categoryName] || {};
  }

  /**
   * Add command to category
   */
  addCommandToCategory(categoryName, commandName, commandData) {
    // Validate inputs
    const categoryValidation = Validators.isValidCategoryName(categoryName);
    if (!categoryValidation.isValid) {
      return { success: false, error: categoryValidation.message };
    }
    
    const commandValidation = Validators.isValidCommandName(commandName);
    if (!commandValidation.isValid) {
      return { success: false, error: commandValidation.message };
    }
    
    const dataValidation = Validators.isValidCommandObject(commandData);
    if (!dataValidation.isValid) {
      return { success: false, error: dataValidation.message };
    }
    
    // Create category if it doesn't exist
    if (!this.commandsData[categoryName]) {
      this.commandsData[categoryName] = {};
    }
    
    // Add command
    this.commandsData[categoryName][commandName] = commandData;
    
    eventManager.emit(APP_EVENTS.PALETTE_UPDATED, {
      type: 'command_added',
      categoryName,
      commandName,
      commandData
    });
    
    return { success: true };
  }

  /**
   * Remove command from category
   */
  removeCommandFromCategory(categoryName, commandName) {
    if (!this.doesCommandExist(categoryName, commandName)) {
      return { success: false, error: 'Command does not exist' };
    }
    
    delete this.commandsData[categoryName][commandName];
    
    // Remove category if empty
    if (Object.keys(this.commandsData[categoryName]).length === 0) {
      delete this.commandsData[categoryName];
    }
    
    eventManager.emit(APP_EVENTS.PALETTE_UPDATED, {
      type: 'command_removed',
      categoryName,
      commandName
    });
    
    return { success: true };
  }

  /**
   * Notify that command has changed
   */
  notifyCommandChanged() {
    if (this.currentFilledCommand) {
      eventManager.emit(APP_EVENTS.COMMAND_VARIABLES_CHANGED, {
        filledCommand: this.currentFilledCommand,
        variableValues: this.getVariableValues(),
        allFilled: this.areAllVariablesFilled()
      });
    }
  }

  /**
   * Export commands as JSON
   */
  exportCommands(format = 'json') {
    if (format === 'json') {
      return JSON.stringify(this.commandsData, null, 2);
    }
    
    // Could add other formats like CSV, etc.
    return this.commandsData;
  }

  /**
   * Get command statistics
   */
  getStatistics() {
    const categories = this.getCategories();
    let totalCommands = 0;
    let totalVariables = 0;
    
    const categoryStats = categories.map(categoryName => {
      const commands = this.getCommandsInCategory(categoryName);
      const commandCount = Object.keys(commands).length;
      totalCommands += commandCount;
      
      // Count variables in this category
      let categoryVariables = 0;
      Object.values(commands).forEach(command => {
        const paths = [];
        this.findVariablePaths(command, []);
        categoryVariables += this.activeVariablePaths.length;
      });
      totalVariables += categoryVariables;
      
      return {
        name: categoryName,
        commandCount,
        variableCount: categoryVariables
      };
    });
    
    return {
      totalCategories: categories.length,
      totalCommands,
      totalVariables,
      categoryStats
    };
  }

  /**
   * Cleanup and destroy
   */
  destroy() {
    this.clearAllCommands();
    eventManager.removeAllListeners(APP_EVENTS.COMMAND_VARIABLES_CHANGED);
  }
} 