import { WebSocketServer, WebSocket } from "ws";
import jwt from "jsonwebtoken";
import { prisma, JWT_SECRET } from "@skrib/db";

const PORT = process.env.WS_PORT ? parseInt(process.env.WS_PORT, 10) : 3002;

interface AuthJwtPayload {
  userId: string;
  username?: string;
}

interface UserConnection {
  ws: WebSocket;
  rooms: Set<number>;
  userId: string;
  username?: string;
}

const users = new Map<WebSocket, UserConnection>();

const wss = new WebSocketServer({ port: PORT });

console.log(`WebSocket server listening on ws://localhost:${PORT}`);

wss.on("connection", async (ws, req) => {
  // Extract token from query parameters
  const host = req.headers.host || "localhost";
  const url = new URL(req.url || "", `http://${host}`);
  const token = url.searchParams.get("token");

  if (!token) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Authentication failed: Missing token query parameter",
      })
    );
    ws.close(1008, "Token query parameter required");
    return;
  }

  let decoded: AuthJwtPayload;
  try {
    decoded = jwt.verify(token, JWT_SECRET) as AuthJwtPayload;
  } catch (err) {
    ws.send(
      JSON.stringify({
        type: "error",
        message: "Authentication failed: Invalid or expired token",
      })
    );
    ws.close(1008, "Invalid token");
    return;
  }

  const userConnection: UserConnection = {
    ws,
    rooms: new Set(),
    userId: decoded.userId,
    username: decoded.username,
  };

  users.set(ws, userConnection);

  ws.send(
    JSON.stringify({
      type: "authenticated",
      message: "Connected and authenticated successfully",
      userId: decoded.userId,
      username: decoded.username,
    })
  );

  ws.on("message", async (rawData) => {
    let parsedData: any;
    try {
      parsedData = JSON.parse(rawData.toString());
    } catch {
      ws.send(
        JSON.stringify({
          type: "error",
          message: "Invalid JSON format",
        })
      );
      return;
    }

    const { type, roomId, message } = parsedData;

    if (type === "join_room" || type === "join-room") {
      const parsedRoomId = parseInt(roomId, 10);
      if (isNaN(parsedRoomId)) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Invalid roomId, must be a number",
          })
        );
        return;
      }
      userConnection.rooms.add(parsedRoomId);
      ws.send(
        JSON.stringify({
          type: "room_joined",
          roomId: parsedRoomId,
        })
      );
      return;
    }

    if (type === "leave_room" || type === "leave-room") {
      const parsedRoomId = parseInt(roomId, 10);
      if (!isNaN(parsedRoomId)) {
        userConnection.rooms.delete(parsedRoomId);
        ws.send(
          JSON.stringify({
            type: "room_left",
            roomId: parsedRoomId,
          })
        );
      }
      return;
    }

    if (type === "chat") {
      const parsedRoomId = parseInt(roomId, 10);
      if (isNaN(parsedRoomId) || !message) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "roomId and message are required for chat",
          })
        );
        return;
      }

      try {
        // Persist message in database
        const chatRecord = await prisma.chat.create({
          data: {
            roomId: parsedRoomId,
            message: String(message),
            userId: userConnection.userId,
          },
        });

        // Broadcast to everyone in this room
        const broadcastPayload = JSON.stringify({
          type: "chat",
          id: chatRecord.id,
          roomId: parsedRoomId,
          message: chatRecord.message,
          userId: userConnection.userId,
          createdAt: chatRecord.createdAt,
        });

        for (const [clientWs, clientUser] of users.entries()) {
          if (
            clientUser.rooms.has(parsedRoomId) &&
            clientWs.readyState === WebSocket.OPEN
          ) {
            clientWs.send(broadcastPayload);
          }
        }
      } catch (error) {
        console.error("Error saving chat message:", error);
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Failed to persist chat message",
          })
        );
      }
      return;
    }
  });

  ws.on("error", (err) => {
    console.error(`WebSocket error for user ${userConnection.userId}:`, err);
  });

  ws.on("close", () => {
    users.delete(ws);
  });
});
