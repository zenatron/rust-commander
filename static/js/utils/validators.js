// Validation utilities for consistent input validation
export class Validators {
  /**
   * Validate if a string is not empty
   */
  static isNotEmpty(value, fieldName = 'Field') {
    const trimmedValue = String(value || '').trim();
    return {
      isValid: trimmedValue.length > 0,
      message: trimmedValue.length > 0 ? null : `${fieldName} cannot be empty`
    };
  }

  /**
   * Validate JSON string
   */
  static isValidJSON(jsonString, fieldName = 'JSON') {
    try {
      JSON.parse(jsonString);
      return {
        isValid: true,
        message: null,
        parsed: JSON.parse(jsonString)
      };
    } catch (error) {
      return {
        isValid: false,
        message: `Invalid ${fieldName} format: ${error.message}`,
        parsed: null
      };
    }
  }

  /**
   * Validate command name format
   */
  static isValidCommandName(name) {
    const trimmedName = String(name || '').trim();
    
    if (trimmedName.length === 0) {
      return {
        isValid: false,
        message: 'Command name cannot be empty'
      };
    }

    if (trimmedName.length > 100) {
      return {
        isValid: false,
        message: 'Command name cannot exceed 100 characters'
      };
    }

    // Allow alphanumeric, spaces, hyphens, underscores
    const validPattern = /^[a-zA-Z0-9\s\-_]+$/;
    if (!validPattern.test(trimmedName)) {
      return {
        isValid: false,
        message: 'Command name can only contain letters, numbers, spaces, hyphens, and underscores'
      };
    }

    return {
      isValid: true,
      message: null
    };
  }

  /**
   * Validate palette name format
   */
  static isValidPaletteName(name) {
    const trimmedName = String(name || '').trim();
    
    if (trimmedName.length === 0) {
      return {
        isValid: false,
        message: 'Palette name cannot be empty'
      };
    }

    if (trimmedName.length > 50) {
      return {
        isValid: false,
        message: 'Palette name cannot exceed 50 characters'
      };
    }

    // Allow alphanumeric, spaces, hyphens, underscores
    const validPattern = /^[a-zA-Z0-9\s\-_]+$/;
    if (!validPattern.test(trimmedName)) {
      return {
        isValid: false,
        message: 'Palette name can only contain letters, numbers, spaces, hyphens, and underscores'
      };
    }

    return {
      isValid: true,
      message: null
    };
  }

  /**
   * Validate category name format
   */
  static isValidCategoryName(name) {
    const trimmedName = String(name || '').trim();
    
    if (trimmedName.length === 0) {
      return {
        isValid: false,
        message: 'Category name cannot be empty'
      };
    }

    if (trimmedName.length > 50) {
      return {
        isValid: false,
        message: 'Category name cannot exceed 50 characters'
      };
    }

    return {
      isValid: true,
      message: null
    };
  }

  /**
   * Validate socket path format
   */
  static isValidSocketPath(path) {
    const trimmedPath = String(path || '').trim();
    
    if (trimmedPath.length === 0) {
      return {
        isValid: false,
        message: 'Socket path cannot be empty'
      };
    }

    // Basic format: hostname:port or IP:port
    const socketPattern = /^([a-zA-Z0-9.-]+|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):(\d{1,5})$/;
    if (!socketPattern.test(trimmedPath)) {
      return {
        isValid: false,
        message: 'Socket path must be in format "hostname:port" or "IP:port"'
      };
    }

    // Validate port range
    const port = parseInt(trimmedPath.split(':')[1]);
    if (port < 1 || port > 65535) {
      return {
        isValid: false,
        message: 'Port must be between 1 and 65535'
      };
    }

    return {
      isValid: true,
      message: null
    };
  }

  /**
   * Validate command object structure
   */
  static isValidCommandObject(commandObj) {
    if (!commandObj || typeof commandObj !== 'object') {
      return {
        isValid: false,
        message: 'Command must be a valid object'
      };
    }

    if (Array.isArray(commandObj)) {
      return {
        isValid: false,
        message: 'Command cannot be an array'
      };
    }

    if (Object.keys(commandObj).length === 0) {
      return {
        isValid: false,
        message: 'Command object cannot be empty'
      };
    }

    return {
      isValid: true,
      message: null
    };
  }

  /**
   * Validate palette object structure
   */
  static isValidPaletteObject(paletteObj) {
    if (!paletteObj || typeof paletteObj !== 'object') {
      return {
        isValid: false,
        message: 'Palette must be a valid object'
      };
    }

    if (Array.isArray(paletteObj)) {
      return {
        isValid: false,
        message: 'Palette cannot be an array'
      };
    }

    // Check if it has the expected structure
    for (const [categoryName, commands] of Object.entries(paletteObj)) {
      if (typeof commands !== 'object' || Array.isArray(commands)) {
        return {
          isValid: false,
          message: `Category "${categoryName}" must contain an object of commands`
        };
      }

      for (const [commandName, commandData] of Object.entries(commands)) {
        if (typeof commandData !== 'object' || Array.isArray(commandData)) {
          return {
            isValid: false,
            message: `Command "${commandName}" in category "${categoryName}" must be an object`
          };
        }
      }
    }

    return {
      isValid: true,
      message: null
    };
  }

  /**
   * Validate multiple fields at once
   */
  static validateFields(fields) {
    const results = {};
    let isAllValid = true;

    for (const [fieldName, { value, validators }] of Object.entries(fields)) {
      const fieldResults = [];
      
      for (const validator of validators) {
        const result = validator(value, fieldName);
        fieldResults.push(result);
        
        if (!result.isValid) {
          isAllValid = false;
          break; // Stop on first validation failure
        }
      }
      
      results[fieldName] = {
        isValid: fieldResults.every(r => r.isValid),
        messages: fieldResults.filter(r => !r.isValid).map(r => r.message),
        value: value
      };
    }

    return {
      isAllValid,
      results
    };
  }

  /**
   * Create a composite validator from multiple validators
   */
  static createCompositeValidator(...validators) {
    return (value, fieldName) => {
      for (const validator of validators) {
        const result = validator(value, fieldName);
        if (!result.isValid) {
          return result;
        }
      }
      
      return {
        isValid: true,
        message: null
      };
    };
  }

  /**
   * Create a length validator
   */
  static createLengthValidator(min = 0, max = Infinity) {
    return (value, fieldName = 'Field') => {
      const length = String(value || '').length;
      
      if (length < min) {
        return {
          isValid: false,
          message: `${fieldName} must be at least ${min} characters long`
        };
      }
      
      if (length > max) {
        return {
          isValid: false,
          message: `${fieldName} cannot exceed ${max} characters`
        };
      }
      
      return {
        isValid: true,
        message: null
      };
    };
  }

  /**
   * Create a pattern validator
   */
  static createPatternValidator(pattern, errorMessage) {
    return (value, fieldName = 'Field') => {
      const stringValue = String(value || '');
      
      if (!pattern.test(stringValue)) {
        return {
          isValid: false,
          message: errorMessage || `${fieldName} format is invalid`
        };
      }
      
      return {
        isValid: true,
        message: null
      };
    };
  }
}

// Common validator compositions
export const CommonValidators = {
  requiredText: Validators.createCompositeValidator(
    Validators.isNotEmpty,
    Validators.createLengthValidator(1, 1000)
  ),
  
  commandName: Validators.createCompositeValidator(
    Validators.isNotEmpty,
    Validators.isValidCommandName
  ),
  
  paletteName: Validators.createCompositeValidator(
    Validators.isNotEmpty,
    Validators.isValidPaletteName
  ),
  
  categoryName: Validators.createCompositeValidator(
    Validators.isNotEmpty,
    Validators.isValidCategoryName
  ),
  
  socketPath: Validators.createCompositeValidator(
    Validators.isNotEmpty,
    Validators.isValidSocketPath
  ),
  
  jsonString: (value, fieldName) => Validators.isValidJSON(value, fieldName)
}; 