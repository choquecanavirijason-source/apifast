import json
from typing import Dict, List
from fastapi import WebSocket


class WsManager:
    def __init__(self):
        self._connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, branch_id: int):
        await websocket.accept()
        self._connections.setdefault(branch_id, []).append(websocket)

    def disconnect(self, websocket: WebSocket, branch_id: int):
        conns = self._connections.get(branch_id, [])
        if websocket in conns:
            conns.remove(websocket)

    async def broadcast(self, branch_id: int, data: dict):
        conns = list(self._connections.get(branch_id, []))
        dead: List[WebSocket] = []
        for ws in conns:
            try:
                await ws.send_text(json.dumps(data, default=str))
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, branch_id)


ws_manager = WsManager()
