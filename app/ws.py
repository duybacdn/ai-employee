from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, List
import asyncio


class ConnectionManager:
    def __init__(self):
        # {conversation_id: [websocket, websocket]}
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.global_connections: List[WebSocket] = []
        self.lock = asyncio.Lock()  # 🔥 tránh race condition

    async def connect(self, conversation_id: str, websocket: WebSocket):
        await websocket.accept()

        async with self.lock:
            if conversation_id not in self.active_connections:
                self.active_connections[conversation_id] = []

            self.active_connections[conversation_id].append(websocket)

    async def disconnect(self, conversation_id: str, websocket: WebSocket):
        async with self.lock:
            if conversation_id in self.active_connections:
                if websocket in self.active_connections[conversation_id]:
                    self.active_connections[conversation_id].remove(websocket)

                # 🔥 cleanup nếu rỗng
                if not self.active_connections[conversation_id]:
                    del self.active_connections[conversation_id]

    async def broadcast(self, conversation_id: str, data: dict):
        async with self.lock:
            connections = self.active_connections.get(conversation_id, []).copy()

        if not connections:
            return

        dead = []

        for connection in connections:
            try:
                await connection.send_json(data)
            except Exception:
                dead.append(connection)

        # 🔥 cleanup connection chết (ngoài lock để tránh block)
        for d in dead:
            await self.disconnect(conversation_id, d)

    # ================= GLOBAL =================

async def connect_global(self, websocket: WebSocket):
    await websocket.accept()
    async with self.lock:
        self.global_connections.append(websocket)


async def disconnect_global(self, websocket: WebSocket):
    async with self.lock:
        if websocket in self.global_connections:
            self.global_connections.remove(websocket)


async def broadcast_global(self, data: dict):
    async with self.lock:
        connections = self.global_connections.copy()

    if not connections:
        return

    dead = []

    for conn in connections:
        try:
            await conn.send_json(data)
        except Exception:
            dead.append(conn)

    for d in dead:
        await self.disconnect_global(d)

manager = ConnectionManager()