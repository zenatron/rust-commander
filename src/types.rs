use actix::{Message};
use serde::Deserialize;
use serde_json::Value as JsonValue;

// Message type for WebSocket actor to send text to its client
#[derive(Message)]
#[rtype(result = "()")]
pub struct ClientTextMessage(pub String);

// Payload structs for API endpoints
#[derive(Deserialize)]
pub struct CommandPayload {
    pub json_command: JsonValue,
}

#[derive(Deserialize)]
pub struct ConnectPayload {
    pub socket_path: String,
}

#[derive(Deserialize)]
pub struct TextCommandPayload {
    pub text_command: String,
} 