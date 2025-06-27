// Connection management module
export class ConnectionManager {
  constructor(onMessage, onStatusChange) {
    this.persistentSocket = null;
    this.onMessage = onMessage;
    this.onStatusChange = onStatusChange;
  }

  // Connect to TCP socket via backend
  async connectTCP(socketPath) {
    try {
      const response = await fetch("/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socket_path: socketPath }),
      });
      
      const text = await response.text();
      if (response.ok) {
        // Send system message about successful TCP connection
        this.onMessage(`TCP Connected to ${socketPath}`, "system_info");
        
        // Re-establish WebSocket connection after successful TCP connection
        this.establishWebSocket();
        return { success: true, message: text };
      } else {
        // Send system message about failed TCP connection
        this.onMessage(`TCP Connection failed: ${text}`, "system_error");
        return { success: false, message: text };
      }
    } catch (error) {
      console.error("Error connecting to TCP socket:", error);
      // Send system message about connection error
      this.onMessage(`TCP Connection error: ${error.message}`, "system_error");
      return { success: false, message: error.message };
    }
  }

  // Disconnect from TCP socket
  async disconnectTCP() {
    try {
      const response = await fetch("/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      
      const text = await response.text();
      if (response.ok) {
        if (this.persistentSocket && this.persistentSocket.readyState === WebSocket.OPEN) {
          this.persistentSocket.close(1000, "User initiated disconnect");
        }
        // Send system message about successful disconnection
        this.onMessage("TCP Disconnected by user", "system_info");
        return { success: true, message: text };
      } else {
        // Send system message about failed disconnection
        this.onMessage(`TCP Disconnect failed: ${text}`, "system_error");
        return { success: false, message: text };
      }
    } catch (error) {
      console.error("Error disconnecting TCP socket:", error);
      // Send system message about disconnection error
      this.onMessage(`TCP Disconnect error: ${error.message}`, "system_error");
      return { success: false, message: error.message };
    }
  }

  // Establish WebSocket connection
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

    this.persistentSocket.onopen = () => {
      console.log("WebSocket connected");
      this.onStatusChange(true);
      this.onMessage("WebSocket connected and ready to receive messages", "system_info");
    };

    this.persistentSocket.onmessage = (event) => {
      console.log("WS Message:", event.data);
      let messageContent = event.data;
      let messageType = "received"; // Default for actual messages

      if (event.data === "TCP_CONNECTION_CLOSED" || 
          event.data === "TCP_CONNECTION_CLOSED_OR_STREAM_ENDED") {
        messageContent = "--- TCP Connection Closed by Server ---";
        messageType = "system_warn";
        if (this.persistentSocket && this.persistentSocket.readyState === WebSocket.OPEN) {
          this.persistentSocket.close(1000, "TCP connection closed by peer");
        }
      } else if (event.data.startsWith("TCP_READ_ERROR:")) {
        messageContent = `--- TCP Read Error: ${event.data.substring("TCP_READ_ERROR:".length)} ---`;
        messageType = "system_error";
        if (this.persistentSocket && this.persistentSocket.readyState === WebSocket.OPEN) {
          this.persistentSocket.close(1000, "TCP read error");
        }
      } else {
        try {
          const jsonData = JSON.parse(event.data);
          messageContent = JSON.stringify(jsonData);
        } catch (e) {
          messageContent = `not JSON?: ${event.data}`;
        }
      }
      
      this.onMessage(messageContent, messageType);
    };

    this.persistentSocket.onclose = (event) => {
      let reason = "";
      if (event.code === 1000) {
        reason = "Normal closure";
      } else if (event.code === 1001) {
        reason = "Endpoint going away";
      } else if (event.code === 1006) {
        reason = "Connection closed abnormally";
      } else {
        reason = `Unknown reason (code: ${event.code}, reason: ${event.reason || "N/A"})`;
      }
      
      console.log("WebSocket connection closed:", reason);
      this.persistentSocket = null;
      this.onStatusChange(false);
      
      const isNormalClosure = event.code === 1000 || event.code === 1001;
      const messageType = isNormalClosure ? "system_info" : "system_warn";
      this.onMessage(`WebSocket disconnected: ${reason}`, messageType);
      
      return reason;
    };

    this.persistentSocket.onerror = (error) => {
      console.error("WebSocket Error:", error);
      this.onStatusChange(false);
      this.onMessage("WebSocket connection error", "system_error");
    };
  }

  // Send JSON command
  async sendCommand(command, delimiter) {
    try {
      const response = await fetch("/send-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          json_command: command,
          delimiter: delimiter
        }),
      });
      
      const text = await response.text();
      if (!response.ok) {
        // Send system message about command sending error
        this.onMessage(`Command send error: ${text}`, "system_error");
      }
      return {
        success: response.ok,
        message: text
      };
    } catch (error) {
      console.error("Error sending command:", error);
      // Send system message about command sending error
      this.onMessage(`Command send error: ${error.message}`, "system_error");
      return {
        success: false,
        message: error.message
      };
    }
  }

  // Check if WebSocket is connected
  isWebSocketConnected() {
    return this.persistentSocket && this.persistentSocket.readyState === WebSocket.OPEN;
  }
} 