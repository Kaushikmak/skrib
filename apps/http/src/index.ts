import express from "express";
import type { Request, Response } from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma, JWT_SECRET } from "@skrib/db";
import { signUpSchema, signInSchema } from "./schema/auth";
import { createRoomSchema } from "./schema/room";
import { authMiddleware } from "./middleware/auth";

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

const app = express();
app.use(cors());
app.use(express.json());

app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

app.post("/signup", async (req: Request, res: Response) => {
  const result = signUpSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: result.error.issues,
    });
  }

  const { username, password, name } = result.data;

  try {
    const existingUser = await prisma.user.findUnique({
      where: { username },
    });

    if (existingUser) {
      return res.status(409).json({
        message: "Username already exists",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        name: name || null,
      },
    });

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(201).json({
      message: "User created successfully",
      userId: user.id,
      token,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

app.post("/signin", async (req: Request, res: Response) => {
  const result = signInSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: result.error.issues,
    });
  }

  const { username, password } = result.data;

  try {
    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return res.status(401).json({
        message: "Invalid username or password",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: "Invalid username or password",
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
      },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.status(200).json({
      message: "Signed in successfully",
      userId: user.id,
      token,
    });
  } catch (error) {
    console.error("Error signing in:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

const handleCreateRoom = async (req: Request, res: Response) => {
  const result = createRoomSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({
      message: "Validation failed",
      errors: result.error.issues,
    });
  }

  const slug = (result.data.slug || result.data.name)!.trim().toLowerCase();
  const userId = req.userId!;

  try {
    const existingRoom = await prisma.room.findUnique({
      where: { slug },
    });

    if (existingRoom) {
      return res.status(409).json({
        message: "Room with this name/slug already exists",
      });
    }

    const room = await prisma.room.create({
      data: {
        slug,
        adminId: userId,
      },
    });

    return res.status(201).json({
      message: "Room created successfully",
      roomId: room.id,
      slug: room.slug,
    });
  } catch (error) {
    console.error("Error creating room:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

// Allow both /room and /create-room
app.post("/room", authMiddleware, handleCreateRoom);
app.post("/create-room", authMiddleware, handleCreateRoom);

app.get("/rooms", authMiddleware, async (req: Request, res: Response) => {
  try {
    const rooms = await prisma.room.findMany({
      include: {
        admin: {
          select: {
            id: true,
            username: true,
            name: true,
          },
        },
      },
    });
    return res.json({ rooms });
  } catch (error) {
    console.error("Error fetching rooms:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`HTTP server started on http://localhost:${PORT}`);
});
