from fastapi import WebSocket
from typing import Dict, List


class ConnectionManager:
    def __init__(self):
        # {conversation_id: [websocket, websocket]}
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, conversation_id: str, websocket: WebSocket):
        await websocket.accept()

        if conversation_id not in self.active_connections:
            self.active_connections[conversation_id] = []

        self.active_connections[conversation_id].append(websocket)

    def disconnect(self, conversation_id: str, websocket: WebSocket):
        if conversation_id in self.active_connections:
            self.active_connections[conversation_id].remove(websocket)

            if not self.active_connections[conversation_id]:
                del self.active_connections[conversation_id]

    async def broadcast(self, conversation_id: str, data: dict):
        if conversation_id not in self.active_connections:
            return

        dead = []

        for connection in self.active_connections[conversation_id]:
            try:
                await connection.send_json(data)
            except:
                dead.append(connection)

        # cleanup connection chết
        for d in dead:
            self.disconnect(conversation_id, d)


manager = ConnectionManager()