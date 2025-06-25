# Rust Commander
Documentation updated for v0.12.1.

## About

Rust Commander is a program that allows sending JSON commands to connected devices through TCP using websockets.
The program creates a web server on the computer running it, allowing access to the web UI on port 8080.
From the UI, the user can connect to target devices [IP:PORT] and send JSON commands from a predefined JSON file.


## Running The Commander

### System Requirements

- **Operating System:** Windows (x86_64), Linux (x86_64), or Raspberry Pi (armv7l 32-bit)
- **Available Port:** Port 8080 must be available on your system
- **Network:** TCP/IP network connectivity to target devices
- **Browser:** Modern web browser with JavaScript enabled
- **Firewall:** Allow inbound connections on port 8080 for network access

### Installation

1. Download the latest version under "Releases." There are executable files provided for Linux x86_64, Windows x86_64, and Raspberry Pi armv7l (32-bit). Other versions can be compiled from the source code.

**NOTE: The browser may have a popup warning about downloading software from the internet. This warning can be safely ignored.**

2. Run the executable. A terminal window will appear with information and show the server startup status.

**NOTE: On Linux, first make the program executable by running `chmod +x /path/to/program`, replacing the path to program with the actual location of the program file.**

**NOTE: On Windows, Microsoft Defender or other Antivirus apps may prevent the program from running, and may even DELETE the program file. Adjust antivirus settings to allow the program to run.**

3. Go to **http://localhost:8080** in a browser on the machine running the Commander. From there, the web UI is accessed. To access the Commander from another device on the same network, use the IP address of the machine running the Commander. It will be displayed in the terminal window.

## Usage - Overview

### Connecting to a Device

This will be the device that will receive TCP JSON commands. To connect, enter the device's IP address and port, and click 
<img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid/link.svg" width="16" height="16" alt="connect icon">
. The convention is [IP:PORT] _e.g. 192.168.1.85:5555_ or _localhost:5555_ for devices running on the same machine. To disconnect, click <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid/link-slash.svg" width="16" height="16" alt="disconnect icon">.

**The indicator on the left of the connection input field will show the device connection status (Connected/Disconnected).**

### Status Messages

Apart from the device connection status, messages will temporarily at the top of the page. They will be color coded and can be dismissed by clicking on them. They will automatically disappear after a few seconds.

All program and device status messages are also logged in the [Messages Pane](#messages-pane).

### App Information & Settings

To see more information about the Commander, click the ℹ️ button in the top left corner. This will open a modal with information about the Commander, including the version number, build info, and links to **getting help and reporting issues**.

## Usage - Commands & Palettes

### What is a Command Palette?

Commands are organized in a JSON format on a master file known as a "Command Palette," or "palette" for short. Each palette has "Categories," which represent "tabs" on the web UI. Clicking on each tab will display all the commands under that category. See [Writing Commands](#writing-commands) for more information about how commands are laid out in the JSON file.

### Palette Selection

After loading palettes, they are available for quick access/switching in the "Palette Selection" drop down. Palettes are stored in the following directories:

- Linux: `~/.local/share/rustcommander/palettes`
- Windows: `C:\Users\USERNAME\AppData\Roaming\RustCommander\RustCommander\data\palettes`

### Palette Options

The following options are available for working with palettes:  

- **➕ Create New Palette:** Will create a new palette with specified name in the local palette directory, see above.
- **📂 Import Palette from File:** Will import a palette from file (e.g. /Downloads/my_palette.json), placing it in the palette directory.
- **✏️ Edit Palette:** Opens up a dialog box for editing a palette. This menu allows for editing the palette name, as well as adding/removing, and renaming categories and commands. Be sure to follow the JSON convention when editing palettes, otherwise a warning will be displayed. After editing, click "Save Changes" to save the palette.
- **🗑️ Delete Palette:** Deletes the palette from the palettes directory.

### Navigating Commands

After clicking on a command, it will appear on the right. Its name will be displayed in blue. The command's JSON will appear in both "Raw JSON (Template)" light yellow box and "Filled JSON (to Send)" light green box. Clicking the plus icon for each of those sections will toggle between compact and expanded JSON view.

Some commands will have variable fields that will need to be filled in before the command may be sent. Input fields automatically get created for such variables. If there are no variables, it will state "No variables to fill for this command." The Commander will automatically fill in the variables with the values specified in the "Filled JSON (to Send)" section.

**Example:**

`// THIS COMMAND WILL HAVE TWO INPUT FIELDS CREATED (var1 and var2)`

`// COMPACT VIEW`

```json
{"cmd":"CMD_AA","vars":{"var1":"%01","var2":"%02"}}
```

`// EXPANDED VIEW`

```json
{
  "cmd": "CMD_AA",
  "vars": {
    "var1": "%01",
    "var2": "%02"
  }
}
```

### Sending a Command

Before sending, ensure any variables are filled in, if applicable. Additionally, a command delimiter may be specified, with an input field to the left of the send button. By default, the Commander sends NO delimiter. Certain applications may require delimiters such as (`\0, \r, \n, or |*|`). Technically, anything can be written in the delimiter input field; it is up to the receiving device to correctly parse it. Enter common delimiters without any quotes, parentheses, braces, etc. e.g. `\r` NOT `"\r"`.

Press Send. This will send the filled in JSON command and the appended delimiter to the target device.

### Command Options

In addition to editing palettes, individual commands can be edited. Click on the ⚙️ near the "Send" button. This will open a menu with the following options:

- **💾 Save Command:** Saves the command to a palette. This is especially useful when handling commands with variables. There are options to save the command to an existing palette or create a new palette. Saved commands are automatically added to a "Saved Commands" category/tab in the target palette.

If creating a new palette, it will be created in the palettes directory [mentioned previously](#palette-selection).

- **✏️ Edit Command:** Opens up a dialog box for editing a command. This menu allows adding/removing, and renaming variables. Be sure to follow the JSON convention when editing commands, otherwise a warning will be displayed. After editing, click "Save Changes" to save the command. The command can also be deleted from the palette by erasing all of its contents.

- **🗑️ Delete Command:** Deletes the command from the palette.

### Messages Pane

The messages pane is a key component of the Commander. This is where all system actions and logs are located, as well as a log of sent commands and received responses. Messages are informative, include a timestamp, and are color coded.

Messages can be sorted _Newest First_, which will display newest messages at the top. The default sort is _Oldest First_.
Click the <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid/sort-up.svg" width="16" height="16" alt="sort icon"> or <img src="https://raw.githubusercontent.com/FortAwesome/Font-Awesome/6.x/svgs/solid/sort-down.svg" width="16" height="16" alt="sort icon"> button to change the sort order.

 Messages are classified as follows:

- **SENT:** JSON payload that is sent ***_to_*** the device, _light blue colored_
- **RECV:** JSON payload received ***from*** the device, _light green colored_
- **INFO:** Lowest tier of system messages, informative, _light gray colored_
- **WARN:** System warnings, requiring action, _yellow colored_
- **ERRO:** Critical system errors, mostly related to device or websocket connection, _red colored_

## Stopping The Commander

To elegantly stop the Commander, first [_DISCONNECT_](#connecting-to-a-device) from the target device, then close the terminal window running the Commander (or press CTRL+C).

## Writing Commands

Command palettes are simply `.json` files.

A palette is made up of one or more categories, which are each made up of one or more individual commands. The following code displays the convention for organizing and grouping commands in a palette. Commands can be written in both compact and expanded form, as long as they are [valid JSON](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/JSON).

Variable values should include a `%` symbol to be picked up by the Commander. See examples below.

`// CORRECT - COMMANDS NESTED UNDER CATEGORY KEY`

```json
{
	"Category 1 Title": {
		"Get Version": {"cmd": "ver"},
		"Command 2 Title": {"foo": "bar"}
	},
	"Category 2 Title": {
		"Command 3 Title": {"foo": "bar", "vars": {"foo": "bar"}}
	}
}
```

`// INCORRECT - COMMANDS WILL NOT DISPLAY PROPERLY`

```json
{
	"Get Version": {"cmd": "ver"}
}
```

`// VARIABLES EXAMPLE (%01 will be replaced by user-specified value)`

```json
{
	"Category": {
		"Command": {"ch":0,"cmd":"cc","line":"%01"}
	}
}
```

## Troubleshooting

### Common Issues

**Commander won't start:**
- Check if port 8080 is already in use by another application
- On Windows: Check antivirus settings and add an exception
- On Linux: Ensure the file has execute permissions (`chmod +x`)

**Can't connect to target device:**
- Verify the device IP address and port are correct
- Check network connectivity with `ping` or `telnet`
- Ensure the target device is accepting TCP connections
- Check firewall settings on both machines

**WebSocket connection fails:**
- Refresh the web page
- Check browser console for error messages
- Ensure no proxy or firewall is blocking WebSocket connections
- Try accessing via `http://localhost:8080` instead of the network IP

**Palette import/export issues:**
- Ensure JSON files are valid using a JSON validator
- Check file permissions in the palette directories
- Verify the JSON structure follows the [Writing Commands](#writing-commands) format

**Performance issues:**
- Large palettes (>100 commands) may load slower
- Close unused browser tabs to free memory
- Consider splitting large palettes into smaller, focused ones

### Reporting Issues

If you encounter any issues, please report them on the [GitHub Issues](https://github.com/zenatron/rust-commander/issues) page.