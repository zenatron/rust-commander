use actix_web::{web, App, HttpServer};
use local_ip_address::local_ip;
use colored::*;

mod types;
mod state;
mod websocket;
mod handlers;

use state::AppState;
use handlers::{connect_route, disconnect_route, send_command, send_text_command_route, version_route, embedded_file_handler};
use websocket::ws_route;

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