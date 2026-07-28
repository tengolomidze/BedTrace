from __future__ import annotations

import asyncio
import json
import subprocess
import sys
import threading
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Optional

import websockets
from websockets.server import WebSocketServerProtocol

ROOT = Path(__file__).resolve().parent
WEB_DIR = ROOT / "web"
EXE_DIR = ROOT / "cpp" / "x64" / "Release"

HOST = "127.0.0.1"
HTTP_PORT = 8000
WS_PORT = 8001

active_process: Optional[subprocess.Popen[str]] = None
process_lock = asyncio.Lock()


def log(message: str) -> None:
    print(f"[server] {message}", flush=True)

class QuietHTTPRequestHandler(SimpleHTTPRequestHandler):
    def log_message(self, format: str, *args) -> None: 
        return

def start_http_server() -> ThreadingHTTPServer:
    handler = partial(QuietHTTPRequestHandler, directory=str(WEB_DIR))
    server = ThreadingHTTPServer((HOST, HTTP_PORT), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    log(f"HTTP server listening on http://{HOST}:{HTTP_PORT}")
    return server

async def send_json(websocket: WebSocketServerProtocol, payload: dict) -> None:
    await websocket.send(json.dumps(payload))

async def stream_process(websocket: WebSocketServerProtocol, process: subprocess.Popen[str]) -> None:
    assert process.stdout is not None
    while True:
        line = await asyncio.to_thread(process.stdout.readline)
        if line == "":
            break
        text = line.rstrip("\r\n")
        log(f"child> {text}")
        await send_json(websocket, {"type": "output", "data": text})
    return_code = await asyncio.to_thread(process.wait)
    log(f"Process exited with code {return_code}")
    await send_json(websocket, {"type": "done", "code": return_code})

async def stop_running_process(websocket: WebSocketServerProtocol) -> None:
    global active_process
    async with process_lock:
        if active_process is None:
            log("Stop requested but no process is running")
            await send_json(websocket, {"type": "stopped", "message": "No active process"})
            return
        log("Stopping active process")
        if active_process.poll() is None:
            active_process.terminate()
            try:
                active_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                log("Process did not stop in time, killing it")
                active_process.kill()
                active_process.wait(timeout=5)
        active_process = None
        await send_json(websocket, {"type": "stopped", "message": "Process stopped"})


async def run_bedtrace(websocket: WebSocketServerProtocol, payload: dict) -> None:
    global active_process

    executable = EXE_DIR / "bedtrace.exe"
    kernel_path = ROOT / "bedtrace.cl"

    seed = payload.get("seed", "0")
    x_min = payload.get("xMin", -10000)
    x_max = payload.get("xMax", 10000)
    z_min = payload.get("zMin", -10000)
    z_max = payload.get("zMax", 10000)
    tile = payload.get("tile", 4096)
    world_type = payload.get("worldType", "overworld_floor")
    patterns = payload.get("patterns") or []

    if not patterns:
        log("Run request received without any patterns")
        await send_json(websocket, {"type": "error", "message": "Pattern list is empty!"})
        return

    log(
        f"Run request received: seed={seed}, x=[{x_min}, {x_max}], z=[{z_min}, {z_max}], tile={tile}, world_type={world_type}, patterns={len(patterns)}"
    )

    command = [
        str(executable),
        str(seed),
        str(x_min),
        str(x_max),
        str(z_min),
        str(z_max),
        str(tile),
        str(world_type),
        str(kernel_path),
    ]

    command.extend([f"{item['dx']},{item['y']},{item['dz']},{item['expected']}" for item in patterns])

    log(f"Launching process: {' '.join(command)}")

    async with process_lock:
        if active_process and active_process.poll() is None:
            active_process.terminate()
            try:
                active_process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                active_process.kill()
                active_process.wait(timeout=5)

        try:
            active_process = subprocess.Popen(
                command,
                cwd=str(ROOT),
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                stdin=subprocess.DEVNULL,
                text=True,
                bufsize=1,
                encoding="utf-8",
                errors="replace",
            )
            log("Process started successfully")
        except OSError as exc:
            await send_json(websocket, {"type": "error", "message": f"Failed to start process: {exc}"})
            active_process = None
            return

        current_process = active_process

    await send_json(websocket, {"type": "started", "command": command})

    try:
        await stream_process(websocket, current_process)
    except Exception as exc:
        log(f"Error while streaming process output: {exc}")
        await send_json(websocket, {"type": "error", "message": f"Error while streaming output: {exc}"})
    finally:
        async with process_lock:
            if active_process is current_process:
                active_process = None


async def handle_client(websocket: WebSocketServerProtocol) -> None:
    log(f"Client connected: {websocket.remote_address}")
    try:
        async for raw_message in websocket:
            try:
                payload = json.loads(raw_message)
            except json.JSONDecodeError:
                await send_json(websocket, {"type": "error", "message": "Expected a JSON payload"})
                continue

            action = payload.get("action")
            log(f"Received action: {action}")
            if action == "run":
                asyncio.create_task(run_bedtrace(websocket, payload))
            elif action == "stop":
                await stop_running_process(websocket)
            else:
                await send_json(websocket, {"type": "error", "message": "Unknown action"})
    except websockets.ConnectionClosed:
        pass
    finally:
        log(f"Client disconnected: {websocket.remote_address}")


async def main() -> None:
    start_http_server()
    log(f"Serving web UI at http://{HOST}:{HTTP_PORT}")
    log(f"WebSocket endpoint at ws://{HOST}:{WS_PORT}")
    async with websockets.serve(handle_client, HOST, WS_PORT):
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Shutting down server")
        sys.exit(0)