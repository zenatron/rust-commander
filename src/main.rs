use actix_web::{get, post, web, App, HttpRequest, HttpResponse, HttpServer, Responder};
use serde::Deserialize;
use serde_json::{Value as JsonValue, Deserializer};
use tokio::net::TcpStream;
use tokio::net::tcp::OwnedWriteHalf;
use tokio::io::{AsyncWriteExt, AsyncReadExt, BufReader};
use std::sync::Mutex;
use actix_web_actors::ws;
use actix::{Actor, StreamHandler, Message, Handler, ActorContext, AsyncContext};
use tokio::task::JoinHandle;
use tokio::sync::broadcast;
use rust_embed::RustEmbed;
use mime_guess;
use local_ip_address::local_ip;
use colored::*;

// Message type for WebSocket actor to send text to its client
#[derive(Message)]
#[rtype(result = "()")]
struct ClientTextMessage(String);

// WebSocket Actor
struct MyWebSocket {
    app_state: web::Data<AppState>,
}

impl Actor for MyWebSocket {
    type Context = ws::WebsocketContext<Self>;

    fn started(&mut self, ctx: &mut Self::Context) {
        println!("WebSocket Client Connected");
        let mut broadcast_rx = self.app_state.tcp_message_tx.subscribe();
        let ws_actor_addr = ctx.address();

        // Spawn a task to listen for broadcast messages and forward them to the WebSocket client
        // Changed from tokio::spawn to actix::spawn to ensure it runs on the Actix runtime
        actix::spawn(async move {
            loop {
                match broadcast_rx.recv().await {
                    Ok(msg) => {
                        if ws_actor_addr.try_send(ClientTextMessage(msg)).is_err() {
                            println!("WebSocket actor is no longer available. Stopping broadcast listener.");
                            break;
                        }
                    }
                    Err(broadcast::error::RecvError::Lagged(n)) => {
                        println!("WebSocket broadcast receiver lagged by {} messages.", n);
                    }
                    Err(broadcast::error::RecvError::Closed) => {
                        println!("WebSocket broadcast channel closed. Stopping listener.");
                        break;
                    }
                }
            }
            println!("Task for relaying TCP to WebSocket (via broadcast) finished.");
        });
    }

    fn stopping(&mut self, _ctx: &mut Self::Context) -> actix::Running {
        println!("WebSocket Client Disconnected");
        actix::Running::Stop
    }
}

impl StreamHandler<Result<ws::Message, ws::ProtocolError>> for MyWebSocket {
    fn handle(&mut self, msg: Result<ws::Message, ws::ProtocolError>, ctx: &mut Self::Context) {
        match msg {
            Ok(ws::Message::Ping(msg)) => {
                ctx.pong(&msg);
            }
            Ok(ws::Message::Text(text)) => {
                println!("Received WS message from client: {}", text);
            }
            Ok(ws::Message::Close(reason)) => {
                ctx.close(reason);
                ctx.stop();
            }
            _ => (),
        }
    }
}

// Handler for ClientTextMessage, to send text to the actual WebSocket client
impl Handler<ClientTextMessage> for MyWebSocket {
    type Result = ();

    fn handle(&mut self, msg: ClientTextMessage, ctx: &mut Self::Context) {
        ctx.text(msg.0);
    }
}

// Application State
struct AppState {
    tcp_stream: Mutex<Option<OwnedWriteHalf>>,
    tcp_reader_handle: Mutex<Option<JoinHandle<()>>>,
    tcp_message_tx: broadcast::Sender<String>,
}

impl AppState {
    fn new() -> Self {
        let (tx, _) = broadcast::channel(100);
        AppState {
            tcp_stream: Mutex::new(None),
            tcp_reader_handle: Mutex::new(None),
            tcp_message_tx: tx,
        }
    }
}

#[derive(Deserialize)]
struct CommandPayload {
    json_command: JsonValue,
}

#[derive(Deserialize)]
struct ConnectPayload {
    socket_path: String,
}

#[derive(Deserialize)]
struct TextCommandPayload {
    text_command: String,
}

#[post("/connect")]
async fn connect_route(
    payload: web::Json<ConnectPayload>,
    app_state: web::Data<AppState>,
) -> impl Responder {
    let mut tcp_stream_guard = app_state.tcp_stream.lock().unwrap();
    let mut reader_handle_guard = app_state.tcp_reader_handle.lock().unwrap();

    if tcp_stream_guard.is_some() {
        if let Some(stream) = tcp_stream_guard.take() {
            drop(stream);
        }
        if let Some(handle) = reader_handle_guard.take() {
            handle.abort();
        }
        println!("Closed existing TCP connection before establishing a new one.");
    }

    let socket_path = &payload.socket_path;
    println!("Attempting to connect to TCP socket: {}", socket_path);

    match TcpStream::connect(socket_path).await {
        Ok(stream) => {
            println!("Successfully connected to TCP socket: {}", socket_path);
            let broadcast_tx_clone = app_state.tcp_message_tx.clone();

            let (tcp_reader_stream, tcp_writer_stream) = stream.into_split();
            *tcp_stream_guard = Some(tcp_writer_stream);

            let reader_task = tokio::spawn(async move {
                let mut buf_reader = BufReader::new(tcp_reader_stream);
                let mut data_buffer = Vec::new();
                let mut current_read_offset = 0; // Offset for the start of data to process in data_buffer

                loop { // Outer loop: Read more data from socket, then process data_buffer

                    loop { // Inner loop: Process available data
                        // Pre-skip any leading null bytes from the current_read_offset
                        while current_read_offset < data_buffer.len() && data_buffer[current_read_offset] == 0u8 {
                            current_read_offset += 1;
                        }

                        if current_read_offset >= data_buffer.len() {
                            break; 
                        }

                        // Create a deserializer for the current segment of the buffer.
                        let mut stream_deserializer = Deserializer::from_slice(&data_buffer[current_read_offset..]).into_iter::<JsonValue>();

                        match stream_deserializer.next() {
                            Some(Ok(json_value)) => {
                                let message_to_send = match serde_json::to_string(&json_value) {
                                    Ok(s) => s,
                                    Err(e) => {
                                        println!("Error re-serializing JSON from device: {}", e);
                                        format!("{{\"error\": \"Failed to re-serialize device response: {}\"}}", e)
                                    }
                                };
                                println!("TCP In (Streamed JSON): {}", message_to_send);

                                if let Err(e) = broadcast_tx_clone.send(message_to_send.clone()) {
                                    println!("Failed to broadcast TCP message: {}. Msg: {}", e, message_to_send);
                                    // If broadcast fails, we might want to stop, but for now, continue processing.
                                }
                                // Advance current_read_offset by the number of bytes consumed for this JSON object.
                                current_read_offset += stream_deserializer.byte_offset();
                            }
                            Some(Err(ref e)) if e.is_eof() => {
                                // EOF in the current slice means an incomplete JSON object.
                                // We need to read more data from the socket.
                                // current_read_offset is not advanced here, as the data from this point is partial.
                                // The buffer compaction logic later will preserve this partial data.
                                // println!("Incomplete JSON in buffer, waiting for more data...");
                                break; // Break inner loop to read more data.
                            }
                            Some(Err(e)) => {
                                // A syntax error or other non-EOF error occurred.
                                let error_offset_in_slice = stream_deserializer.byte_offset();
                                println!(
                                    "TCP stream: Encountered non-JSON data or syntax error: '{}'. Occurred at offset {} within the current data segment being parsed. Attempting to skip.",
                                    e,
                                    error_offset_in_slice
                                );

                                // We must advance past the problematic data to avoid an infinite loop.
                                // Advance by the offset where the error occurred in the slice + 1 to skip the char causing it.
                                current_read_offset += error_offset_in_slice + 1;
                                // Do NOT broadcast this error to the client.
                                // Do NOT terminate the reader task here; try to recover.
                            }
                            None => {
                                // The deserializer's iterator is exhausted for the current slice.
                                // This means the slice was empty or contained only data that serde_json
                                // considers "trailing" after any valid JSON (e.g., whitespace it skipped).
                                // Advance current_read_offset by the number of bytes consumed from the slice.
                                current_read_offset += stream_deserializer.byte_offset();
                                break; // Break inner loop, as this slice is fully processed or no more JSON can be formed from it.
                            }
                        }
                    } // End inner processing loop

                    // Buffer compaction: Remove processed data from the beginning of data_buffer.
                    if current_read_offset > 0 {
                        if current_read_offset >= data_buffer.len() {
                            data_buffer.clear(); // All data processed
                        } else {
                            data_buffer.drain(..current_read_offset); // Remove processed prefix
                        }
                        current_read_offset = 0; // Reset offset as we've modified the buffer's beginning
                    }

                    // Read more data from the socket.
                    let mut temp_read_buf = [0u8; 4096];
                    match buf_reader.read(&mut temp_read_buf).await {
                        Ok(0) => {
                            println!("TCP connection closed by peer (EOF).");
                            if !data_buffer.is_empty() {
                                println!(
                                    "Warning: {} bytes remaining in buffer on EOF were not processed as complete JSON: {:?}",
                                    data_buffer.len(),
                                    String::from_utf8_lossy(&data_buffer)
                                );
                            }
                            break; // Break outer loop, connection closed.
                        }
                        Ok(n) => {
                            data_buffer.extend_from_slice(&temp_read_buf[..n]);
                            // Loop back to inner processing loop with new data.
                        }
                        Err(e) => {
                            println!("TCP read error: {}", e);
                            // Don't broadcast this error either, just terminate the reader for socket errors.
                            break; // Break outer loop on read error.
                        }
                    }
                } // End outer loop (socket read loop)

                println!("TCP reader task finished.");
                let close_msg = "TCP_CONNECTION_CLOSED_OR_STREAM_ENDED".to_string();
                if let Err(e) = broadcast_tx_clone.send(close_msg.clone()) {
                    println!("Failed to broadcast TCP close/end message: {}. Msg: {}", e, close_msg);
                }
            });

            *reader_handle_guard = Some(reader_task);
            HttpResponse::Ok().body(format!("Connected to {}", socket_path))
        }
        Err(e) => {
            println!("TCP connection error to {}: {}", socket_path, e);
            HttpResponse::InternalServerError().body(format!("TCP connection error: {}", e))
        }
    }
}

#[post("/disconnect")]
async fn disconnect_route(app_state: web::Data<AppState>) -> impl Responder {
    println!("Received request to disconnect TCP.");
    let mut tcp_stream_guard = app_state.tcp_stream.lock().unwrap();
    let mut reader_handle_guard = app_state.tcp_reader_handle.lock().unwrap();

    if let Some(stream) = tcp_stream_guard.take() {
        drop(stream);
        println!("TCP stream dropped.");
    }

    if let Some(handle) = reader_handle_guard.take() {
        handle.abort();
        println!("TCP reader task aborted.");
    }

    HttpResponse::Ok().body("Disconnected")
}

#[post("/send-command")]
async fn send_command(
    cmd_payload: web::Json<CommandPayload>,
    app_state: web::Data<AppState>,
) -> impl Responder {
    let mut tcp_stream_guard = app_state.tcp_stream.lock().unwrap();

    if let Some(stream) = tcp_stream_guard.as_mut() {
        let command_bytes = match serde_json::to_vec(&cmd_payload.json_command) {
            Ok(bytes) => bytes,
            Err(e) => {
                return HttpResponse::InternalServerError()
                    .body(format!("Failed to serialize command: {}", e));
            }
        };

        if let Err(e) = stream.write_all(&command_bytes).await {
            return HttpResponse::InternalServerError().body(format!("TCP write error: {}", e));
        }
        // if let Err(e) = stream.write_all(b"\n").await {
        //     return HttpResponse::InternalServerError().body(format!("TCP write newline error: {}", e));
        // }
        HttpResponse::Ok().body("TCP command sent")
    } else {
        HttpResponse::InternalServerError().body("Not connected to any TCP socket.")
    }
}

#[post("/send-text-command")]
async fn send_text_command_route(
    payload: web::Json<TextCommandPayload>,
    app_state: web::Data<AppState>,
) -> impl Responder {
    let mut tcp_stream_guard = app_state.tcp_stream.lock().unwrap();

    if let Some(stream) = tcp_stream_guard.as_mut() {
        let command_to_send = payload.text_command.clone();
        let mut command_bytes = payload.text_command.as_bytes().to_vec();
        command_bytes.push(b'\r'); // Append carriage return

        println!("Sending raw text command: {}", command_to_send);

        if let Err(e) = stream.write_all(&command_bytes).await {
            println!("TCP write error (text command): {}", e);
            return HttpResponse::InternalServerError().body(format!("TCP write error (text command): {}", e));
        }
        // Also broadcast this raw command as sent?
        // For now, the response to the HTTP request is enough.
        // The client-side will add it to its local message log.

        HttpResponse::Ok().body(format!("Text command sent: {}", command_to_send))
    } else {
        HttpResponse::InternalServerError().body("Not connected to any TCP socket.")
    }
}

#[get("/ws")]
async fn ws_route(
    req: HttpRequest,
    stream: web::Payload,
    app_state: web::Data<AppState>,
) -> Result<HttpResponse, actix_web::Error> {
    println!("WebSocket handshake request");

    let resp = ws::WsResponseBuilder::new(
            MyWebSocket { app_state: app_state.clone() },
            &req,
            stream
        )
        .start()?;
    
    Ok(resp)
}

#[get("/api/version")]
async fn version_route() -> impl Responder {
    env!("CARGO_PKG_VERSION")
}

#[derive(RustEmbed)]
#[folder = "static/"]
struct Asset;

async fn embedded_file_handler(req: HttpRequest) -> impl Responder {
    let path = req.path().trim_start_matches('/');
    let file = if path.is_empty() { "index.html" } else { path };

    match Asset::get(file) {
        Some(content) => {
            let body = actix_web::body::BoxBody::new(content.data.into_owned());
            let mime = mime_guess::from_path(file).first_or_octet_stream();
            println!("Serving file: {} with MIME type: {}", file, mime);
            HttpResponse::Ok()
                .content_type(mime.as_ref())
                .body(body)
        }
        None => HttpResponse::NotFound().body("404 Not Found"),
    }
}

#[actix_web::main]
async fn main() -> std::io::Result<()> {
    let app_state = web::Data::new(AppState::new());

    let server_port: u16 = 8080;
    let server_address: &str = "0.0.0.0";

    print_setup_message(server_address, server_port);

    HttpServer::new(move || {
        App::new()
            .app_data(app_state.clone())
            .service(connect_route)
            .service(disconnect_route)
            .service(send_command)
            .service(send_text_command_route)
            .service(ws_route)
            .service(version_route)
            .default_service(web::route().to(embedded_file_handler))
    })
    .bind(format!("{}:{}", server_address, server_port))?
    .run()
    .await
}

fn print_setup_message(server_address: &str, server_port: u16) {
    println!("{}", "Commander starting...".bright_blue());
    println!(
        "{}",
        format!(
            "Commander started on {}:{}.",
            server_address,
            server_port
        ).green()
    );
    println!(
        "To access Commander locally, visit {}{}{} (Ctrl+click to open)",
        format!("\x1B]8;;http://localhost:{}\x1B\\", server_port).blue(),
        format!("http://localhost:{}", server_port).bright_cyan().underline(),
        "\x1B]8;;\x1B\\".blue()
    );

    if let Ok(my_local_ip) = local_ip() {
        println!(
            "To access Commander on the network, visit {}{}{} (Ctrl+click to open)",
            format!("\x1B]8;;http://{}:{}\x1B\\", my_local_ip, server_port).blue(),
            format!("http://{}:{}", my_local_ip, server_port).bright_cyan().underline(),
            "\x1B]8;;\x1B\\".blue()
        );
    } else {
        println!("{}", "Could not determine local IP address for network access link.".red());
    }
    println!("{}", "Press Ctrl+C or close the terminal window to stop the Commander.".yellow());
    println!("{}", "------------------------------------------------------".dimmed());
}