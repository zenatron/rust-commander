use actix::{Message};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use indexmap::IndexMap;

// Message type for WebSocket actor to send text to its client
#[derive(Message)]
#[rtype(result = "()")]
pub struct ClientTextMessage(pub String);

// Payload structs for API endpoints
#[derive(Deserialize, Serialize)]
pub struct CommandPayload {
    pub json_command: JsonValue,
}

#[derive(Deserialize, Serialize)]
pub struct ConnectPayload {
    pub socket_path: String,
}

#[derive(Deserialize, Serialize)]
pub struct TextCommandPayload {
    pub text_command: String,
}

// New structs for palettes and commands
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Command {
    pub name: String,
    pub command: JsonValue,
}

// Type alias for the nested map structure representing commands
pub type CommandsMap = IndexMap<String, IndexMap<String, JsonValue>>;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Palette {
    pub name: String,
    pub commands: CommandsMap,
}

// Payload for creating/updating a palette via API
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct PalettePayload {
    pub name: String,
    pub commands: CommandsMap,
}

// Payload for adding a command to an existing palette
#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct AddCommandPayload {
    pub command_name: String,
    pub command_data: JsonValue,
} 