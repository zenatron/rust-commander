import { apiClient, APIError } from './utils/api-client.js';
import { eventManager, APP_EVENTS } from './utils/event-manager.js';

// Connection management module
export class ConnectionManager {
  constructor() {
    this.persistentSocket = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.maxReconnectAttempts = 3;
    this.reconnectDelay = 1000;
    
    this.initialize();
  }

  /**
   * Initialize connection manager
   */
  initialize() {
    // Listen for connection status changes to update UI
    eventManager.on(APP_EVENTS.CONNECTION_STATUS_CHANGED, (isConnected) => {
      this.isConnected = isConnected;
    });
  }

  /**
   * Connect to TCP socket via backend
   */
  async connectTCP(socketPath) {
    try {
      const response = await apiClient.connectTCP(socketPath);
      
      // Send system message about successful TCP connection
      eventManager.emit(APP_EVENTS.TCP_CONNECTED, socketPath);
      eventManager.emit(APP_EVENTS.MESSAGE_ADDED, `TCP Connected to ${socketPath}`, "system_info");
      
      // Re-establish WebSocket connection after successful TCP connection
      this.establishWebSocket();
      
      return { success: true, message: response };
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      
      // Send system message about failed TCP connection
      eventManager.emit(APP_EVENTS.MESSAGE_ADDED, `TCP Connection failed: ${errorMessage}`, "system_error");
      
      return { success: false, message: errorMessage };
    }
  }

  /**
   * Disconnect from TCP socket
   */
  async disconnectTCP() {
    try {
      const response = await apiClient.disconnectTCP();
      
      if (this.persistentSocket && this.persistentSocket.readyState === WebSocket.OPEN) {
        this.persistentSocket.close(1000, "User initiated disconnect");
      }
      
      // Send system message about successful disconnection
      eventManager.emit(APP_EVENTS.TCP_DISCONNECTED);
      eventManager.emit(APP_EVENTS.MESSAGE_ADDED, "TCP Disconnected by user", "system_info");
      
      return { success: true, message: response };
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      
      // Send system message about failed disconnection
      eventManager.emit(APP_EVENTS.MESSAGE_ADDED, `TCP Disconnect failed: ${errorMessage}`, "system_error");
      
      return { success: false, message: errorMessage };
    }
  }

  /**
   * Establish WebSocket connection
   */
  establishWebSocket() {
    if (this.persistentSocket && 
        (this.persistentSocket.readyState === WebSocket.OPEN || 
         this.persistentSocket.readyState === WebSocket.CONNECTING)) {
      console.log("WebSocket already open or connecting.");
      return;
    }

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.host}/ws`;

    this.persistentSocket = new WebSocket(wsUrl);
    this.connectionAttempts++;

    this.persistentSocket.onopen = () => {
      console.log("WebSocket connected");
      this.connectionAttempts = 0; // Reset on successful connection
      
      eventManager.emit(APP_EVENTS.WEBSOCKET_CONNECTED);
      eventManager.emit(APP_EVENTS.CONNECTION_STATUS_CHANGED, true);
      eventManager.emit(APP_EVENTS.MESSAGE_ADDED, "WebSocket connected and ready to receive messages", "system_info");
    };

    this.persistentSocket.onmessage = (event) => {
      console.log("WS Message:", event.data);
      this.handleWebSocketMessage(event.data);
    };

    this.persistentSocket.onclose = (event) => {
      const reason = this.getCloseReason(event);
      console.log("WebSocket connection closed:", reason);
      
      this.persistentSocket = null;
      
      eventManager.emit(APP_EVENTS.WEBSOCKET_DISCONNECTED, reason);
      eventManager.emit(APP_EVENTS.CONNECTION_STATUS_CHANGED, false);
      
      const isNormalClosure = event.code === 1000 || event.code === 1001;
      const messageType = isNormalClosure ? "system_info" : "system_warn";
      eventManager.emit(APP_EVENTS.MESSAGE_ADDED, `WebSocket disconnected: ${reason}`, messageType);
      
      // Auto-reconnect logic for abnormal closures
      if (!isNormalClosure && this.connectionAttempts < this.maxReconnectAttempts) {
        console.log(`Attempting to reconnect WebSocket (attempt ${this.connectionAttempts + 1}/${this.maxReconnectAttempts})`);
        setTimeout(() => {
          this.establishWebSocket();
        }, this.reconnectDelay * this.connectionAttempts);
      }
    };

    this.persistentSocket.onerror = (error) => {
      console.error("WebSocket Error:", error);
      eventManager.emit(APP_EVENTS.CONNECTION_STATUS_CHANGED, false);
      eventManager.emit(APP_EVENTS.MESSAGE_ADDED, "WebSocket connection error", "system_error");
    };
  }

  /**
   * Handle incoming WebSocket messages
   */
  handleWebSocketMessage(data) {
    let messageContent = data;
    let messageType = "received"; // Default for actual messages

    if (data === "TCP_CONNECTION_CLOSED" || 
        data === "TCP_CONNECTION_CLOSED_OR_STREAM_ENDED") {
      messageContent = "--- TCP Connection Closed by Server ---";
      messageType = "system_warn";
      
      if (this.persistentSocket && this.persistentSocket.readyState === WebSocket.OPEN) {
        this.persistentSocket.close(1000, "TCP connection closed by peer");
      }
    } else if (data.startsWith("TCP_READ_ERROR:")) {
      messageContent = `--- TCP Read Error: ${data.substring("TCP_READ_ERROR:".length)} ---`;
      messageType = "system_error";
      
      if (this.persistentSocket && this.persistentSocket.readyState === WebSocket.OPEN) {
        this.persistentSocket.close(1000, "TCP read error");
      }
    } else {
      // Try to parse as JSON for formatting
      try {
        const jsonData = JSON.parse(data);
        messageContent = JSON.stringify(jsonData);
        eventManager.emit(APP_EVENTS.COMMAND_RECEIVED, jsonData);
      } catch (e) {
        messageContent = `not JSON?: ${data}`;
      }
    }
    
    eventManager.emit(APP_EVENTS.MESSAGE_ADDED, messageContent, messageType);
  }

  /**
   * Send JSON command
   */
  async sendCommand(command, delimiter) {
    try {
      const response = await apiClient.sendCommand(command, delimiter);
      
      // Emit command sent event
      eventManager.emit(APP_EVENTS.COMMAND_SENT, { command, delimiter });
      
      return { success: true, message: response };
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      
      // Send system message about command sending error
      eventManager.emit(APP_EVENTS.MESSAGE_ADDED, `Command send error: ${errorMessage}`, "system_error");
      
      return { success: false, message: errorMessage };
    }
  }

  /**
   * Send raw text command
   */
  async sendTextCommand(textCommand, delimiter) {
    try {
      const response = await apiClient.sendTextCommand(textCommand, delimiter);
      
      return { success: true, message: response };
    } catch (error) {
      const errorMessage = this.getErrorMessage(error);
      
      // Send system message about text command sending error
      eventManager.emit(APP_EVENTS.MESSAGE_ADDED, `Text command send error: ${errorMessage}`, "system_error");
      
      return { success: false, message: errorMessage };
    }
  }

  /**
   * Check if WebSocket is connected
   */
  isWebSocketConnected() {
    return this.persistentSocket && this.persistentSocket.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection status
   */
  getConnectionStatus() {
    return {
      isConnected: this.isConnected,
      isWebSocketConnected: this.isWebSocketConnected(),
      connectionAttempts: this.connectionAttempts
    };
  }

  /**
   * Get WebSocket close reason
   */
  getCloseReason(event) {
    switch (event.code) {
      case 1000:
        return "Normal closure";
      case 1001:
        return "Endpoint going away";
      case 1006:
        return "Connection closed abnormally";
      default:
        return `Unknown reason (code: ${event.code}, reason: ${event.reason || "N/A"})`;
    }
  }

  /**
   * Get user-friendly error message
   */
  getErrorMessage(error) {
    if (error instanceof APIError) {
      if (error.isNetworkError()) {
        return "Network connection failed. Please check your connection.";
      } else if (error.isServerError()) {
        return "Server error occurred. Please try again.";
      } else {
        return error.message;
      }
    }
    
    return error.message || "Unknown error occurred";
  }

  /**
   * Force disconnect all connections
   */
  forceDisconnect() {
    if (this.persistentSocket) {
      this.persistentSocket.close(1000, "Force disconnect");
      this.persistentSocket = null;
    }
    
    this.isConnected = false;
    eventManager.emit(APP_EVENTS.CONNECTION_STATUS_CHANGED, false);
  }

  /**
   * Cleanup and destroy connection manager
   */
  destroy() {
    this.forceDisconnect();
    eventManager.removeAllListeners(APP_EVENTS.CONNECTION_STATUS_CHANGED);
  }
} 