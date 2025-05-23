use std::sync::Mutex;
use tokio::net::tcp::OwnedWriteHalf;
use tokio::task::JoinHandle;
use tokio::sync::broadcast;

// Application State
pub struct AppState {
    pub tcp_stream: Mutex<Option<OwnedWriteHalf>>,
    pub tcp_reader_handle: Mutex<Option<JoinHandle<()>>>,
    pub tcp_message_tx: broadcast::Sender<String>,
}

impl AppState {
    pub fn new() -> Self {
        let (tx, _) = broadcast::channel(100);
        AppState {
            tcp_stream: Mutex::new(None),
            tcp_reader_handle: Mutex::new(None),
            tcp_message_tx: tx,
        }
    }
} 