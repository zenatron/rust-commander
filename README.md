# Rust Commander

## About

Rust Commander is a program that allows sending JSON commands to connected devices through TCP using websockets.
The program creates a web server on the computer running it, allowing access to the web UI on port 8080.
From the UI, the user can connect to target devices [IP:PORT] and send JSON commands from a predefined JSON file.

## Running The Commander

1. Download the latest version under "Releases." There are executable files provided for Linux x86_64, Windows x86_64, and Raspberry Pi armv7l (32-bit). Other versions can be compiled from the source code.

**NOTE: The browser may have a popup warning about downloading software from the internet. This warning can be safely ignored.**

2. Run the executable. A terminal window will appear with information and show the server startup status.

**NOTE: On Linux, first make the program executable by running `chmod +x /path/to/program`, replacing the path to program with the actual location of the program file.**

**NOTE: On Windows, Microsoft Defender or other Antivirus apps may prevent the program from running, and may even DELETE the program file. Adjust antivirus settings to allow the program to run.**

3. Go to **http://localhost:8080** in a browser on the machine running the Commander. From there, the web UI is accessed. To access the Commander from another device on the same network, use the IP address of the machine running the Commander. It will be displayed in the terminal window.

## Usage

### Connecting to a Device

This will be the device that will receive TCP JSON commands. To connect, enter the device's IP address and port, and click <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" height=16px><!--!Font Awesome Free 6.7.2 by @fontawesome - https://fontawesome.com License - https://fontawesome.com/license/free Copyright 2025 Fonticons, Inc.--><path d="M579.8 267.7c56.5-56.5 56.5-148 0-204.5c-50-50-128.8-56.5-186.3-15.4l-1.6 1.1c-14.4 10.3-17.7 30.3-7.4 44.6s30.3 17.7 44.6 7.4l1.6-1.1c32.1-22.9 76-19.3 103.8 8.6c31.5 31.5 31.5 82.5 0 114L422.3 334.8c-31.5 31.5-82.5 31.5-114 0c-27.9-27.9-31.5-71.8-8.6-103.8l1.1-1.6c10.3-14.4 6.9-34.4-7.4-44.6s-34.4-6.9-44.6 7.4l-1.1 1.6C206.5 251.2 213 330 263 380c56.5 56.5 148 56.5 204.5 0L579.8 267.7zM60.2 244.3c-56.5 56.5-56.5 148 0 204.5c50 50 128.8 56.5 186.3 15.4l1.6-1.1c14.4-10.3 17.7-30.3 7.4-44.6s-30.3-17.7-44.6-7.4l-1.6 1.1c-32.1 22.9-76 19.3-103.8-8.6C74 372 74 321 105.5 289.5L217.7 177.2c31.5-31.5 82.5-31.5 114 0c27.9 27.9 31.5 71.8 8.6 103.9l-1.1 1.6c-10.3 14.4-6.9 34.4 7.4 44.6s34.4 6.9 44.6-7.4l1.1-1.6C433.5 260.8 427 182 377 132c-56.5-56.5-148-56.5-204.5 0L60.2 244.3z"/></svg>. The convention is [IP:PORT] _e.g. 192.168.1.85:5555_

**The indicator on the left of the connection input field will show the device connection status (Connected/Disconnected).**

### Status Messages

Apart from the device connection status, messages will temporarily appear below the connection field. All program and device status messages are also logged in the [Messages Pane](#messages-pane).

### What is a Command Palette?

Commands are organized in a JSON format on a master file known as a "Command Palette," or palette for short. Each palette has "Categories," which represent "tabs" on the web UI. Clicking on each tab will display all the commands under that category. See [Writing Commands](#writing-commands) for more information about how commands are laid out.

### Palette Selection

After loading palettes, they are available for quick access/switching in the "Palette Selection" drop down. Palettes are stored in the following directories:

- Linux: `~/.local/share/rustcommander/palettes`
- Windows: `C:\Users\USERNAME\AppData\Roaming\RustCommander\RustCommander\data\palettes`

### Palette Options

The following options are available for working with palettes:  

- **Create New Palette:** Will create a new palette with specified name in the local palette directory, see above.
- **Import Palette from File:** Will import a palette from file (e.g. Downloads), placing it in the palette directory.
- **Save Palette:** Saves the palette
- **Edit Palette:** Opens up a dialog box for editing a palette. When editing palettes this way, ensure appropriate JSON convention is followed, otherwise the palette may not load.
- **Delete Palette:** Deletes the palette from the local directory.

### Navigating Commands

After clicking on a command, it will appear on the right, both under "Raw JSON (Template)" and "Filled JSON (to Send)." Clicking the plus icon for each of those sections will toggle between compact and expanded JSON view.

Some commands will have variable fields that will need to be filled in before the command may be sent. Input fields automatically get created for such variables. If there are no variables, it will state "No variables to fill for this command."

**For example:**

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

### Saving Commands

Commands can be saved to be used later. This is especially useful when handling commands with variables. To save a command, click "Save Command." A modal will appear, with options to save the command to an existing palette or create a new palette. Enter the command name, and select a palette to save to, or click "Create New Palette" and specify the new name of the palette.

Commands will save under a "Saved Commands" category/tab in the target palette.

If creating a new palette, it will be created in the palettes directory [mentioned previously](#palette-selection).

### Deleting Commands

To delete commands, click on the "Edit Palette" option and remove any unneeded commands. Make sure JSON convention is followed and there are no trailing commas. Click "Save Changes". The palettes will reload and the command(s) will be deleted.

### Messages Pane

The messages pane is a key component of the Commander. This is where all system actions and logs are located, as well as a log of sent commands and received responses. Messages are informative, include a timestamp, and are color coded.

Messages can be sorted _Newest First_, which will display newest messages at the top. The default sort is _Oldest First_. Messages are classifed as follows:

- **SENT:** JSON payload that is sent ***_to_*** the device, light blue colored
- **RECEIVED:** JSON payload received ***from*** the device, light green colored
- **SYSTEM_INFO:** Lowest tier of system messages, informative, light gray colored
- **SYSTEM_WARN:** System warnings, requiring action, yellow colored
- **SYSTEM_ERROR:** Critical system errors, mostly related to device or websocket connection, red colored

## Stopping The Commander

To elegantly stop the Commander, first _DISCONNECT_ from the target device, then close the terminal window running the Commander (or press CTRL+C).

## Writing Commands

Command palettes are simply `.json` files.

A palette is made up of one or more categories, which are each made up of one or more individual commands. The following code displays the convention for organizing and grouping commands in a palette. Commands can be written in both compact and expanded form, as long as they are [valid JSON](https://developer.mozilla.org/en-US/docs/Learn_web_development/Core/Scripting/JSON).

Variable values should should include a `%` symbol to be picked up by the Commander. See example below.

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