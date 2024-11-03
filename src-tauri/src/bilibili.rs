use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use tauri::Window;

#[derive(Clone)]
struct MessageQueue {
    messages: Arc<Mutex<Vec<String>>>,
    running: Arc<Mutex<bool>>,
}

impl MessageQueue {
    fn new() -> Self {
        MessageQueue {
            messages: Arc::new(Mutex::new(Vec::new())),
            running: Arc::new(Mutex::new(false)),
        }
    }

    fn start(&self, window: Window, room_id: String, cookie: String, csrf: String, delay: u64) {
        let messages = self.messages.clone();
        let running = self.running.clone();
        
        *running.lock().unwrap() = true;

        thread::spawn(move || {
            while *running.lock().unwrap() {
                // 检查队列中是否有消息
                let message = {
                    let mut queue = messages.lock().unwrap();
                    if queue.is_empty() {
                        None
                    } else {
                        Some(queue.remove(0))
                    }
                };

                if let Some(msg) = message {
                    // 等待指定延迟
                    thread::sleep(Duration::from_secs(delay));

                    // 发送消息
                    match send_message(&room_id, &msg, &cookie, &csrf) {
                        Ok(_) => {
                            window.emit("bilibili://message_sent", json!({
                                "success": true,
                                "message": msg
                            })).unwrap();
                        },
                        Err(e) => {
                            window.emit("bilibili://message_sent", json!({
                                "success": false,
                                "message": msg,
                                "error": e.to_string()
                            })).unwrap();
                        }
                    }
                }

                // 每秒检查一次
                thread::sleep(Duration::from_secs(1));
            }
        });
    }

    fn stop(&self) {
        *self.running.lock().unwrap() = false;
    }

    fn add_message(&self, message: String) {
        let mut queue = self.messages.lock().unwrap();
        queue.push(message);
    }
}

#[tauri::command]
fn start_message_thread(window: Window, room_id: String, cookie: String, csrf: String, delay: u64) {
    QUEUE.start(window, room_id, cookie, csrf, delay);
}

#[tauri::command]
fn stop_message_thread() {
    QUEUE.stop();
}

#[tauri::command]
fn notify_new_message(message: String) {
    QUEUE.add_message(message);
} 