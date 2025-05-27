use std::sync::Mutex;
use tokio::sync::broadcast::Sender;
use tokio::net::tcp::OwnedWriteHalf;
use tokio::task::JoinHandle;
use crate::types::{Palette};
use std::collections::HashMap;

// Application State
pub struct AppState {
    pub tcp_stream: Mutex<Option<OwnedWriteHalf>>,
    pub tcp_reader_handle: Mutex<Option<JoinHandle<()>>>,
    pub tcp_message_tx: Sender<String>,
    pub palettes: Mutex<HashMap<String, Palette>>,
}

impl AppState {
    pub fn new() -> Self {
        let (tx, _rx) = tokio::sync::broadcast::channel(100);
        Self {
            tcp_stream: Mutex::new(None),
            tcp_reader_handle: Mutex::new(None),
            tcp_message_tx: tx,
            palettes: Mutex::new(HashMap::new()),
        }
    }
} 