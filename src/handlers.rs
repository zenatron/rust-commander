use actix_web::{post, get, delete, web, HttpRequest, HttpResponse, Responder, put};
use serde_json::{Value as JsonValue, Deserializer};
use tokio::net::TcpStream;
use tokio::io::{AsyncWriteExt, AsyncReadExt, BufReader};
use rust_embed::RustEmbed;
use mime_guess;

use crate::types::{CommandPayload, ConnectPayload, TextCommandPayload, PalettePayload, Palette};
use crate::state::AppState;
use crate::palette_manager::{save_palette, load_palette, list_palettes as list_palettes_fs, delete_palette as delete_palette_fs, import_palette as import_palette_fs};

// Needed for file uploads
use actix_multipart::Multipart;
use futures_util::TryStreamExt as _;
use std::fs::File;
use std::io::Write;
use std::path::PathBuf;
use uuid::Uuid; // For generating unique temp file names

#[post("/connect")]
pub async fn connect_route(
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
pub async fn disconnect_route(app_state: web::Data<AppState>) -> impl Responder {
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
pub async fn send_command(
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
pub async fn send_text_command_route(
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

#[get("/api/version")]
pub async fn version_route() -> impl Responder {
    env!("CARGO_PKG_VERSION")
}

#[derive(RustEmbed)]
#[folder = "static/"]
struct Asset;

pub async fn embedded_file_handler(req: HttpRequest) -> impl Responder {
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

// --- Palette Handlers ---

#[get("/api/palettes")]
pub async fn list_palettes_handler() -> impl Responder {
    match list_palettes_fs() {
        Ok(palettes) => HttpResponse::Ok().json(palettes),
        Err(e) => HttpResponse::InternalServerError().body(e),
    }
}

#[post("/api/palettes")]
pub async fn create_palette(
    palette_payload: web::Json<PalettePayload>,
    app_state: web::Data<AppState>,
) -> impl Responder {
    let new_palette = Palette {
        name: palette_payload.name.clone(),
        commands: palette_payload.commands.clone(),
    };

    match save_palette(&new_palette) {
        Ok(_) => {
            app_state.palettes.lock().unwrap().insert(new_palette.name.clone(), new_palette.clone());
            HttpResponse::Ok().json(new_palette)
        }
        Err(e) => HttpResponse::InternalServerError().body(format!("Failed to save palette: {}", e)),
    }
}

#[put("/api/palettes/{name}")]
async fn update_palette(
    path: web::Path<String>,
    palette_payload: web::Json<PalettePayload>,
    app_state: web::Data<AppState>,
) -> impl Responder {
    let palette_name_from_path = path.into_inner();
    let incoming_palette_data = palette_payload.into_inner();

    if palette_name_from_path != incoming_palette_data.name {
        return HttpResponse::BadRequest().body(
            format!(
                "Palette name in URL ('{}') does not match name in payload ('{}'). Renaming not supported via this update method.",
                palette_name_from_path, incoming_palette_data.name
            )
        );
    }

    let mut palettes_locked = app_state.palettes.lock().unwrap();

    if let Some(palette_in_memory) = palettes_locked.get_mut(&palette_name_from_path) {
        // Palette found in memory, proceed to update
        palette_in_memory.commands = incoming_palette_data.commands.clone();
        let palette_to_save_to_disk = palette_in_memory.clone();
        drop(palettes_locked); // Release lock before file I/O

        match save_palette(&palette_to_save_to_disk) {
            Ok(_) => {
                HttpResponse::Ok().json(palette_to_save_to_disk)
            }
            Err(e) => {
                eprintln!("Failed to save updated palette '{}' to disk: {}", palette_name_from_path, e);
                // Attempt to revert in-memory state by reloading the original palette from disk
                let mut palettes_re_locked = app_state.palettes.lock().unwrap();
                match load_palette(&palette_name_from_path) {
                    Ok(original_palette_from_disk) => {
                        palettes_re_locked.insert(palette_name_from_path.clone(), original_palette_from_disk);
                        eprintln!("Successfully reloaded palette '{}' from disk into memory after save failure.", palette_name_from_path);
                    }
                    Err(load_err) => {
                        eprintln!("Failed to reload original palette '{}' from disk after save failure: {}. Removing from memory.", palette_name_from_path, load_err);
                        palettes_re_locked.remove(&palette_name_from_path);
                    }
                }
                HttpResponse::InternalServerError().body(format!("Failed to save updated palette to disk: {}. In-memory state was attempted to be reverted.", e))
            }
        }
    } else {
        // Palette not in memory, try loading from disk
        drop(palettes_locked); // Release current lock before disk I/O

        match load_palette(&palette_name_from_path) {
            Ok(mut palette_from_disk) => {
                // Palette loaded successfully from disk.
                // Update its commands with the incoming data.
                palette_from_disk.commands = incoming_palette_data.commands; // .clone() not needed as incoming_palette_data is consumed here or its field is.

                // Save the modified palette back to disk.
                match save_palette(&palette_from_disk) {
                    Ok(_) => {
                        // Successfully saved to disk. Now, update the in-memory cache.
                        let mut palettes_locked_again = app_state.palettes.lock().unwrap();
                        palettes_locked_again.insert(palette_name_from_path.clone(), palette_from_disk.clone());
                        HttpResponse::Ok().json(palette_from_disk)
                    }
                    Err(e) => {
                        eprintln!("Failed to save updated palette ('{}') (after loading from disk): {}", palette_name_from_path, e);
                        HttpResponse::InternalServerError().body(format!("Failed to save updated palette: {}", e))
                    }
                }
            }
            Err(load_error) => {
                // Failed to load from disk (e.g., truly not found, or other FS error).
                eprintln!("Update failed: Palette '{}' not found in memory and also failed to load from disk: {}", palette_name_from_path, load_error);
                HttpResponse::NotFound().body(format!("Palette '{}' not found on disk. Cannot update.", palette_name_from_path))
            }
        }
    }
}

#[get("/api/palettes/{name}")]
pub async fn get_palette_handler(name: web::Path<String>) -> impl Responder {
    let palette_name = name.into_inner(); // name is moved here
    match load_palette(&palette_name) {
        Ok(palette) => HttpResponse::Ok().json(palette),
        Err(e) => {
            if e.contains("not found") {
                HttpResponse::NotFound().body(format!("Palette '{}' not found: {}", palette_name, e))
            } else {
                HttpResponse::InternalServerError().body(format!("Error loading palette '{}': {}", palette_name, e))
            }
        }
    }
}

#[delete("/api/palettes/{name}")]
pub async fn delete_palette_handler(name: web::Path<String>) -> impl Responder {
    let palette_name_for_response = name.as_str().to_string(); // Clone the name for the response *before* it's moved.
    match delete_palette_fs(&name.into_inner()) { // name is moved here
        Ok(_) => HttpResponse::Ok().body(format!("Palette '{}' deleted successfully.", palette_name_for_response)),
        Err(e) => {
            if e.contains("not found") {
                HttpResponse::NotFound().body(format!("Palette '{}' not found for deletion: {}", palette_name_for_response, e))
            } else {
                HttpResponse::InternalServerError().body(format!("Error deleting palette '{}': {}", palette_name_for_response, e))
            }
        }
    }
}

#[post("/api/palettes/import")]
pub async fn import_palette_handler(mut payload: Multipart) -> impl Responder {
    let mut temp_file_path: Option<PathBuf> = None;

    // Iterate over multipart items
    while let Some(item) = payload.try_next().await.ok().flatten() {
        let mut field = item;
        let content_disposition = field.content_disposition();
        let field_name = content_disposition.get_name().unwrap_or_default();

        if field_name == "palette_file" {
            let filename = content_disposition.get_filename().unwrap_or_else(|| "upload.json");
            let unique_filename = format!("{}-{}", Uuid::new_v4(), filename);
            
            // Create a temporary path
            let mut path = std::env::temp_dir();
            path.push(unique_filename);
            temp_file_path = Some(path.clone());

            let mut f = match File::create(&path) {
                Ok(f) => f,
                Err(e) => return HttpResponse::InternalServerError().body(format!("Failed to create temp file: {}", e)),
            };

            // Field in turn is stream of *Bytes* object
            while let Some(chunk) = field.try_next().await.ok().flatten() {
                if let Err(e) = f.write_all(&chunk) {
                    // Cleanup temp file on error
                    if let Some(p) = &temp_file_path {
                        let _ = std::fs::remove_file(p);
                    }
                    return HttpResponse::InternalServerError().body(format!("Failed to write to temp file: {}", e));
                }
            }
            break; // Assuming one file upload for now
        }
    }

    if let Some(path) = temp_file_path {
        match import_palette_fs(&path) {
            Ok(palette) => {
                let _ = std::fs::remove_file(&path); // Clean up temp file
                HttpResponse::Ok().json(palette)
            }
            Err(e) => {
                let _ = std::fs::remove_file(&path); // Clean up temp file
                HttpResponse::BadRequest().body(e) // Bad request if import fails (e.g., bad JSON)
            }
        }
    } else {
        HttpResponse::BadRequest().body("No palette file uploaded or field name is not 'palette_file'.")
    }
}

#[get("/api/palettes/{name}/export")]
pub async fn export_palette_handler(name: web::Path<String>) -> impl Responder {
    let palette_name = name.into_inner(); // name is moved here
    match load_palette(&palette_name) {
        Ok(palette) => {
            match serde_json::to_string_pretty(&palette) {
                Ok(json_string) => {
                    HttpResponse::Ok()
                        .content_type("application/json")
                        .insert_header(("Content-Disposition", format!("attachment; filename=\"{}.json\"", palette_name)))
                        .body(json_string)
                }
                Err(e) => HttpResponse::InternalServerError().body(format!("Failed to serialize palette '{}': {}", palette_name, e)),
            }
        }
        Err(e) => {
            if e.contains("not found") {
                HttpResponse::NotFound().body(format!("Palette '{}' not found for export: {}", palette_name, e))
            } else {
                HttpResponse::InternalServerError().body(format!("Error exporting palette '{}': {}", palette_name, e))
            }
        }
    }
} 