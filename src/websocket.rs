use actix_web::{web, HttpRequest, HttpResponse, get};
use actix_web_actors::ws;
use actix::{Actor, StreamHandler, Handler, ActorContext, AsyncContext};
use tokio::sync::broadcast;

use crate::types::ClientTextMessage;
use crate::state::AppState;

// WebSocket Actor
pub struct MyWebSocket {
    pub app_state: web::Data<AppState>,
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

#[get("/ws")]
pub async fn ws_route(
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