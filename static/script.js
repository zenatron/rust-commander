document.addEventListener("DOMContentLoaded", async () => {
  const rawJsonDisplayElement = document.getElementById("rawJsonDisplay");
  const filledJsonDisplayElement = document.getElementById("filledJsonDisplay");
  const variableInputsContainer = document.getElementById(
    "variableInputsContainer"
  );
  const responseDiv = document.getElementById("response");
  const tabContainer = document.getElementById("tabContainer");
  const tabContentContainer = document.getElementById("tabContentContainer");
  const messagesDisplayElement = document.getElementById("messagesDisplay");

  // New header controls
  const socketPathInputHeader = document.getElementById("socket_path_header");
  const connectButtonHeader = document.getElementById("connectButton_header");
  const disconnectButtonHeader = document.getElementById(
    "disconnectButton_header"
  );
  const sendButtonHeader = document.getElementById("sendButton");
  const connectionStatusElement = document.getElementById("connectionStatus"); // New element

  // File Upload Elements
  const commandFileUploadInput = document.getElementById("commandFileUpload");
  const uploadCommandFileButton = document.getElementById("uploadCommandFileButton");

  // Elements for raw text command
  const rawTextInputElement = document.getElementById("rawTextInput");
  const sendRawTextButtonElement = document.getElementById("sendRawTextButton");

  let commandsData = {};
  let firstTabInitialized = false;
  let currentCommandTemplate = null;
  let currentFilledCommand = null;
  let persistentSocket = null;
  let activeVariablePaths = [];

  // Function to update connection status display
  function updateConnectionStatus(isConnected) {
    if (isConnected) {
      connectionStatusElement.textContent = "Connected";
      connectionStatusElement.classList.remove("status-disconnected");
      connectionStatusElement.classList.add("status-connected");
    } else {
      connectionStatusElement.textContent = "Disconnected";
      connectionStatusElement.classList.remove("status-connected");
      connectionStatusElement.classList.add("status-disconnected");
    }
  }
  updateConnectionStatus(false); // Initial state

  // Function to load and process commands
  async function loadCommands(source) {
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
      commandsData = data;
      initializeTabsAndCommands(); // Re-initialize UI with new commands
      responseDiv.textContent = "Commands loaded successfully.";
    } catch (error) {
      console.error("Error loading commands:", error);
      responseDiv.textContent = "Error loading commands: " + error.message;
      commandsData = {}; // Clear commands data on error
      initializeTabsAndCommands(); // Clear UI or show error state
    }
  }

  // Initial load from commands.json
  loadCommands("commands.json");

  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/\'/g, "&#039;");
  }

  function generateHighlightedHtml(jsonString, highlightInstructions) {
    if (!jsonString) return "";

    let line = jsonString;
    let highlightClass = "";

    if (highlightInstructions.type === "raw") {
      highlightClass = "highlight-yellow";
    } else if (highlightInstructions.type === "filled") {
      highlightClass = "highlight-green";
    }

    if (!highlightClass || !line.includes("%")) {
      return escapeHtml(line);
    }

    const parts = line.split("%");
    let processedLine = "";
    for (let i = 0; i < parts.length; i++) {
      processedLine += escapeHtml(parts[i]);
      if (i < parts.length - 1) {
        processedLine += `<span class="${highlightClass}">%</span>`;
      }
    }
    return processedLine;
  }

  const updateFilledJsonTextarea = () => {
    if (currentFilledCommand) {
      const filledJsonString = JSON.stringify(currentFilledCommand);
      filledJsonDisplayElement.innerHTML = generateHighlightedHtml(
        filledJsonString,
        { type: "filled" }
      );
    } else {
      filledJsonDisplayElement.innerHTML = "";
    }
  };

  const generateVariableInputsUI = (templateObject) => {
    variableInputsContainer.innerHTML = "";
    activeVariablePaths = [];
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
            activeVariablePaths.push([...newPathParts]);
            const inputGroup = document.createElement("div");
            inputGroup.classList.add("variable-input-group");

            const label = document.createElement("label");
            const labelText =
              newPathParts.length > 1 && newPathParts[0] === "vars"
                ? newPathParts.slice(1).join(".")
                : newPathParts.join(".");
            label.textContent = `${labelText} (${value}):`;
            label.title = `Path: ${newPathParts.join(
              "."
            )}\\nOriginal: ${value}`;

            const input = document.createElement("input");
            input.type = "text";
            input.dataset.path = JSON.stringify(newPathParts);

            let currentVal = currentFilledCommand;
            newPathParts.forEach((part) => {
              currentVal = currentVal ? currentVal[part] : undefined;
            });
            if (typeof currentVal === "string" && !currentVal.includes("%")) {
              input.value = currentVal;
            }

            input.addEventListener("input", (e) => {
              const path = JSON.parse(e.target.dataset.path);
              let targetObject = currentFilledCommand;
              for (let i = 0; i < path.length - 1; i++) {
                if (!targetObject[path[i]]) targetObject[path[i]] = {};
                targetObject = targetObject[path[i]];
              }
              targetObject[path[path.length - 1]] = e.target.value;
              updateFilledJsonTextarea();
            });

            inputGroup.appendChild(label);
            inputGroup.appendChild(input);
            variableInputsContainer.appendChild(inputGroup);
          }
        }
      }
    };

    if (templateObject) {
      findPlaceholdersAndCreateInputs(templateObject);
    }
    if (!hasPlaceholders) {
      variableInputsContainer.innerHTML =
        '<p class="no-variables-message">No variables to fill for this command.</p>';
    }
  };

  // Function to clear and rebuild tabs and command lists
  function initializeTabsAndCommands() {
    tabContainer.innerHTML = "";
    tabContentContainer.innerHTML = "";
    firstTabInitialized = false;
    rawJsonDisplayElement.textContent = "";
    filledJsonDisplayElement.textContent = "";
    variableInputsContainer.innerHTML = '<p class="no-variables-message">Select a command to see details.</p>';
    currentCommandTemplate = null;
    currentFilledCommand = null;

    if (Object.keys(commandsData).length === 0) {
      tabContainer.textContent = "No commands loaded or error in loading.";
      return;
    }

    const topLevelKeys = Object.keys(commandsData);
    topLevelKeys.forEach((key, index) => {
      const nestedCommands = commandsData[key];
      if (Object.keys(nestedCommands).length === 0) return;

      const tabButton = document.createElement("div");
      tabButton.classList.add("tab");
      tabButton.textContent = key;
      tabButton.dataset.tabKey = key;
      tabContainer.appendChild(tabButton);

      const tabContent = document.createElement("div");
      tabContent.classList.add("tab-content");
      tabContent.id = `tab-${key.replace(/\s+/g, "-")}`;
      tabContentContainer.appendChild(tabContent);

      const commandListUL = document.createElement("ul");
      commandListUL.classList.add("command-list");

      for (const commandName in nestedCommands) {
        const listItem = document.createElement("li");
        listItem.textContent = commandName;
        listItem.dataset.commandJsonString = JSON.stringify(
          nestedCommands[commandName]
        );

        listItem.addEventListener("click", (e) => {
          const cmdJsonString = e.target.dataset.commandJsonString;
          currentCommandTemplate = JSON.parse(cmdJsonString);
          currentFilledCommand = JSON.parse(cmdJsonString);

          generateVariableInputsUI(currentCommandTemplate);

          const rawJsonForDisplay = JSON.stringify(currentCommandTemplate);
          rawJsonDisplayElement.innerHTML = generateHighlightedHtml(
            rawJsonForDisplay,
            { type: "raw" }
          );

          updateFilledJsonTextarea();
        });
        commandListUL.appendChild(listItem);
      }
      tabContent.appendChild(commandListUL);

      if (!firstTabInitialized && index === 0) {
        tabButton.classList.add("active");
        tabContent.classList.add("active");
        firstTabInitialized = true;
      }

      tabButton.addEventListener("click", () => {
        document
          .querySelectorAll(".tab")
          .forEach((tb) => tb.classList.remove("active"));
        document
          .querySelectorAll(".tab-content")
          .forEach((tc) => tc.classList.remove("active"));
        tabButton.classList.add("active");
        document
          .getElementById(`tab-${key.replace(/\s+/g, "-")}`)
          .classList.add("active");
      });
    });
  }

  // Helper function to append messages to the new messages display area
  function appendMessageToDisplay(messageText, type) {
    if (!messagesDisplayElement) return;

    const messageSpan = document.createElement("span");
    messageSpan.classList.add("message-line");
    if (type === "sent") {
      messageSpan.classList.add("message-sent");
    } else if (type === "received") {
      messageSpan.classList.add("message-received");
    }
    messageSpan.textContent = messageText;

    messagesDisplayElement.appendChild(messageSpan);
    messagesDisplayElement.scrollTop = messagesDisplayElement.scrollHeight; // Auto-scroll
  }

  sendButtonHeader.addEventListener("click", async () => {
    if (!currentFilledCommand) {
      responseDiv.textContent = "No command selected or filled.";
      return;
    }

    const commandToSendString = JSON.stringify(currentFilledCommand); // Single line
    appendMessageToDisplay(`${commandToSendString}`, "sent"); // Append sent message

    responseDiv.textContent = "Sending command...";

    try {
      const res = await fetch("/send-command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ json_command: currentFilledCommand }),
      });
      const text = await res.text();
      if (res.ok) {
        responseDiv.textContent = `Command sent successfully. Server says: ${text}`;
      } else {
        responseDiv.textContent = `Error sending command. Server says: ${text}`;
      }
    } catch (error) {
      console.error("Error sending command:", error);
      responseDiv.textContent = `Error: ${error.message}`;
    }
  });

  if (sendRawTextButtonElement) {
    sendRawTextButtonElement.addEventListener("click", async () => {
        const rawTextToSend = rawTextInputElement.value;
        if (!rawTextToSend) {
            responseDiv.textContent = "Raw text command is empty.";
            return;
        }

        if (!persistentSocket || persistentSocket.readyState !== WebSocket.OPEN) {
            responseDiv.textContent = "Not connected. Please connect first.";
            return;
        }

        appendMessageToDisplay(`Raw TX: ${rawTextToSend}`, "sent");
        responseDiv.textContent = "Sending raw text command...";

        try {
            const res = await fetch("/send-text-command", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text_command: rawTextToSend }),
            });
            const text = await res.text();
            if (res.ok) {
                responseDiv.textContent = `Server: ${text}`;
                // Optionally clear the input after sending
                // rawTextInputElement.value = ''; 
            } else {
                responseDiv.textContent = `Error sending raw text. Server says: ${text}`;
            }
        } catch (error) {
            console.error("Error sending raw text command:", error);
            responseDiv.textContent = `Error: ${error.message}`;
        }
    });
  }

  connectButtonHeader.addEventListener("click", async () => {
    const socketPath = socketPathInputHeader.value;
    if (!socketPath) {
      responseDiv.textContent = "Socket path is empty for connection.";
      return;
    }

    responseDiv.textContent = "Connecting to TCP socket...";
    connectButtonHeader.disabled = true;
    disconnectButtonHeader.disabled = true;
    updateConnectionStatus(false); // Show disconnected initially or while trying

    try {
      const res = await fetch("/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ socket_path: socketPath }),
      });
      const text = await res.text();
      if (res.ok) {
        responseDiv.textContent = `TCP Connection: ${text}. Now establishing WebSocket for incoming messages...`;
        establishWebSocket(socketPath);
        // Status updated in establishWebSocket onopen
        connectButtonHeader.style.display = "none";
        disconnectButtonHeader.style.display = "inline-block";
        disconnectButtonHeader.disabled = false;
        socketPathInputHeader.disabled = true;
      } else {
        responseDiv.textContent = `Error connecting to TCP: ${text}`;
        connectButtonHeader.disabled = false;
        disconnectButtonHeader.disabled = true;
        updateConnectionStatus(false);
      }
    } catch (error) {
      console.error("Error connecting to TCP socket:", error);
      responseDiv.textContent = `Error: ${error.message}`;
      connectButtonHeader.disabled = false;
      disconnectButtonHeader.disabled = true;
      updateConnectionStatus(false);
    }
  });

  disconnectButtonHeader.addEventListener("click", async () => {
    responseDiv.textContent = "Disconnecting...";
    disconnectButtonHeader.disabled = true;
    connectButtonHeader.disabled = true;
    // updateConnectionStatus(false); // Status will be updated in WebSocket onclose

    try {
      const res = await fetch("/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const text = await res.text();
      if (res.ok) {
        responseDiv.textContent = `TCP Disconnection: ${text}. Closing WebSocket.`;
        if (
          persistentSocket &&
          persistentSocket.readyState === WebSocket.OPEN
        ) {
          persistentSocket.close(1000, "User initiated disconnect");
        }
        // updateConnectionStatus(false); // WebSocket onclose will handle this
      } else {
        responseDiv.textContent = `Error disconnecting TCP: ${text}`;
        // If disconnect fails, buttons might need re-enabling or status re-evaluation
        // For now, assume onclose will eventually fire or user retries
        disconnectButtonHeader.disabled = false; // Re-enable if server-side disconnect failed
        connectButtonHeader.disabled = false; // Potentially allow retry or new connection
      }
    } catch (error) {
      console.error("Error disconnecting TCP socket:", error);
      responseDiv.textContent = `Error during TCP disconnect: ${error.message}`;
      // Similar to above, re-enable buttons if the fetch itself failed
      disconnectButtonHeader.disabled = false;
      connectButtonHeader.disabled = false;
      updateConnectionStatus(false); // Explicitly set to disconnected on fetch error
    }
  });

  // Event listener for the upload button
  if (uploadCommandFileButton && commandFileUploadInput) {
    uploadCommandFileButton.addEventListener("click", () => {
      commandFileUploadInput.click(); // Trigger the hidden file input
    });

    commandFileUploadInput.addEventListener("change", async (event) => {
      const file = event.target.files[0];
      if (file) {
        if (file.type === "application/json") {
          await loadCommands(file); // Load commands from the selected file
        } else {
          responseDiv.textContent = "Please upload a valid .json file.";
          console.warn("Invalid file type selected for command palette.");
        }
      }
      // Reset the file input to allow uploading the same file again if needed
      commandFileUploadInput.value = null;
    });
  }

  function establishWebSocket(socketPathForContext) {
    if (
      persistentSocket &&
      (persistentSocket.readyState === WebSocket.OPEN ||
        persistentSocket.readyState === WebSocket.CONNECTING)
    ) {
      console.log("WebSocket already open or connecting.");
      return;
    }

    messagesDisplayElement.innerHTML = ""; // Clear previous messages on new connection

    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.host}/ws`;

    persistentSocket = new WebSocket(wsUrl);
    responseDiv.textContent = "WebSocket connecting...";
    // updateConnectionStatus(false); // Already disconnected or trying

    persistentSocket.onopen = () => {
      responseDiv.textContent = `WebSocket connected. Listening for incoming messages.`;
      disconnectButtonHeader.disabled = false;
      updateConnectionStatus(true);
    };

    persistentSocket.onmessage = (event) => {
      console.log("WS Message:", event.data);
      let messageContent = event.data;
      let messageType = "received"; // Default for actual messages

      if (
        event.data === "TCP_CONNECTION_CLOSED" ||
        event.data === "TCP_CONNECTION_CLOSED_OR_STREAM_ENDED"
      ) {
        messageContent = "--- TCP Connection Closed by Server ---";
        messageType = "system"; // Or some other class for neutral styling
        responseDiv.textContent =
          "TCP Connection was closed by the server. WebSocket also closing.";
        if (
          persistentSocket &&
          persistentSocket.readyState === WebSocket.OPEN
        ) {
          persistentSocket.close(1000, "TCP connection closed by peer");
        }
      } else if (event.data.startsWith("TCP_READ_ERROR:")) {
        messageContent = `--- TCP Read Error: ${event.data.substring(
          "TCP_READ_ERROR:".length
        )} ---`;
        messageType = "system";
        responseDiv.textContent = "TCP Read Error. WebSocket also closing.";
        if (
          persistentSocket &&
          persistentSocket.readyState === WebSocket.OPEN
        ) {
          persistentSocket.close(1000, "TCP read error");
        }
      } else {
        try {
          const jsonData = JSON.parse(event.data);
          messageContent = `${JSON.stringify(jsonData)}`;
        } catch (e) {
          messageContent = `not JSON?: ${event.data}`; // If not JSON, display raw, add prefix
        }
      }
      appendMessageToDisplay(messageContent, messageType);
    };

    persistentSocket.onclose = (event) => {
      let reason = "";
      if (event.code === 1000) {
        reason = "Normal closure";
      } else if (event.code === 1001) {
        reason = "Endpoint going away";
      } else if (event.code === 1006) {
        reason = "Connection closed abnormally";
      } else {
        reason = `Unknown reason (code: ${event.code}, reason: ${
          event.reason || "N/A"
        })`;
      }
      const currentResponse = responseDiv.textContent;
      if (!currentResponse.includes("TCP Disconnection")) {
        responseDiv.textContent = `WebSocket disconnected. Reason: ${reason}`;
      }
      connectButtonHeader.style.display = "inline-block";
      disconnectButtonHeader.style.display = "none";
      socketPathInputHeader.disabled = false;
      connectButtonHeader.disabled = false;
      persistentSocket = null;
      updateConnectionStatus(false);
      console.log("WebSocket connection closed:", reason);
    };

    persistentSocket.onerror = (error) => {
      console.error("WebSocket Error:", error);
      updateConnectionStatus(false); // Assume disconnected on error
    };
  }
});

// Fetch and display project version in the header
window.addEventListener('DOMContentLoaded', () => {
  fetch('/api/version')
    .then(res => res.text())
    .then(version => {
      const versionElem = document.getElementById('projectVersion');
      if (versionElem) {
        versionElem.textContent = `Version: ${version}`;
      }
    });
});
