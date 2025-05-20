# Rust Commander
## About
Rust Commander is a program that allows sending JSON commands to connected devices through TCP using websockets. 
The program creates a web server on the computer running it, allowing access to the web UI on port 8080.
From the UI, the user can connect to target devices [IP:PORT] and send JSON commands from a predefined JSON file.

## Running The Commander
1. Download the latest version under "Releases." There are executable files provided for Linux x86_64 and Windows x86_64. Other versions can be compiled from the source code.
2. Run the executable. A terminal window will appear with information and show the server startup status.
3. Go to **http://localhost:8080** in a browser on the machine running the Commander. From there, the web UI is accessed.

## Usage
1. Connect to a target device. This will be the device that will receive commands. To connect, enter the IP address and port, and click "Connect." The convention [IP:PORT] is followed (_e.g. 192.168.1.1:5555_).
2. Load a command palette (Optional).
3. Click on a tab to see commands for that tab.
4. Select a command. It will appear on the right, both under "Raw JSON (Template)" and "Filled JSON (to Send)."
5. Enter any required command variables, if needed. The command will not send without the required variables. They will be highlighted on the "Template" and "To Send" sections mentioned above.
6. Press Send. This will send the filled in JSON command "To Send" to the target device.
7. Observe the "Messages" panel. It will include messages related to the commands sent, including JSON sent **to** the device and received **from** the device. Messages can be sorted _Newest First_. Default sorting is Oldest First.
8. **Any status messages related to the Commander or the system will be displayed on the top right in the orange box.**
9. Stop the Commander. Close the terminal window (that opened when the program was run).
