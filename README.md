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

### Connecting to a Device

Connect to a target device. This will be the device that will receive TCP JSON commands. To connect, enter the device's IP address and port, and click "Connect." The convention is [IP:PORT] _e.g. 192.168.1.85:5555_

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