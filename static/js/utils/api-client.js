// Centralized API client for backend communication
export class APIClient {
  constructor() {
    this.baseURL = '';
    this.defaultHeaders = {
      'Content-Type': 'application/json'
    };
  }

  /**
   * Generic HTTP request method
   */
  async request(endpoint, options = {}) {
    const config = {
      headers: { ...this.defaultHeaders, ...options.headers },
      ...options
    };

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, config);
      return await this.handleResponse(response);
    } catch (error) {
      console.error(`API request failed for ${endpoint}:`, error);
      throw new APIError(`Network error: ${error.message}`, 'NETWORK_ERROR');
    }
  }

  /**
   * Handle API response with consistent error handling
   */
  async handleResponse(response) {
    const isJson = response.headers.get('content-type')?.includes('application/json');
    
    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      
      try {
        if (isJson) {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } else {
          errorMessage = await response.text() || errorMessage;
        }
      } catch (e) {
        // If we can't parse the error, use the status text
        errorMessage = response.statusText || errorMessage;
      }
      
      throw new APIError(errorMessage, response.status);
    }

    try {
      if (isJson) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      throw new APIError('Failed to parse response', 'PARSE_ERROR');
    }
  }

  /**
   * GET request
   */
  async get(endpoint, params = {}) {
    const queryString = new URLSearchParams(params).toString();
    const url = queryString ? `${endpoint}?${queryString}` : endpoint;
    
    return this.request(url, { method: 'GET' });
  }

  /**
   * POST request
   */
  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  /**
   * PUT request
   */
  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  }

  /**
   * DELETE request
   */
  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }

  /**
   * Upload file
   */
  async uploadFile(endpoint, formData) {
    return this.request(endpoint, {
      method: 'POST',
      body: formData,
      headers: {} // Let browser set Content-Type for FormData
    });
  }

  // === Specific API Methods ===

  /**
   * Connection Management
   */
  async connectTCP(socketPath) {
    return this.post('/connect', { socket_path: socketPath });
  }

  async disconnectTCP() {
    return this.post('/disconnect', {});
  }

  /**
   * Command Management
   */
  async sendCommand(command, delimiter = null) {
    return this.post('/send-command', {
      json_command: command,
      delimiter: delimiter
    });
  }

  async sendTextCommand(textCommand, delimiter = null) {
    return this.post('/send-text-command', {
      text_command: textCommand,
      delimiter: delimiter
    });
  }

  /**
   * Palette Management
   */
  async getPalettes() {
    return this.get('/api/palettes');
  }

  async getPalette(name) {
    return this.get(`/api/palettes/${encodeURIComponent(name)}`);
  }

  async createPalette(paletteData) {
    return this.post('/api/palettes', paletteData);
  }

  async updatePalette(name, paletteData) {
    return this.put(`/api/palettes/${encodeURIComponent(name)}`, paletteData);
  }

  async deletePalette(name) {
    return this.delete(`/api/palettes/${encodeURIComponent(name)}`);
  }

  async addCommandToPalette(paletteName, commandData) {
    return this.post(`/api/palettes/${encodeURIComponent(paletteName)}/commands`, commandData);
  }

  async exportPalette(name) {
    return this.get(`/api/palettes/${encodeURIComponent(name)}/export`);
  }

  async importPalette(formData) {
    return this.uploadFile('/api/palettes/import', formData);
  }

  /**
   * System Information
   */
  async getVersion() {
    return this.get('/api/version');
  }

  async getHealthCheck() {
    return this.get('/api/health');
  }
}

/**
 * Custom error class for API errors
 */
export class APIError extends Error {
  constructor(message, status = 'UNKNOWN') {
    super(message);
    this.name = 'APIError';
    this.status = status;
  }

  isNetworkError() {
    return this.status === 'NETWORK_ERROR';
  }

  isServerError() {
    return typeof this.status === 'number' && this.status >= 500;
  }

  isClientError() {
    return typeof this.status === 'number' && this.status >= 400 && this.status < 500;
  }

  isNotFound() {
    return this.status === 404;
  }

  isConflict() {
    return this.status === 409;
  }
}

// Create singleton instance
export const apiClient = new APIClient(); 