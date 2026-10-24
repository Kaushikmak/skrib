import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "@skrib/db";

export interface AuthJwtPayload {
  userId: string;
  username?: string;
  iat?: number;
  exp?: number;
}

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: AuthJwtPayload;
    }
  }
}

export const authMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const authHeader =
    req.headers.authorization || (req.headers["token"] as string | undefined);

  if (!authHeader) {
    return res.status(401).json({
      message: "Unauthorized: Missing authentication token",
    });
  }

  const token = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : authHeader.trim();

  if (!token) {
    return res.status(401).json({
      message: "Unauthorized: Invalid token format",
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthJwtPayload;
    req.userId = decoded.userId;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({
      message: "Forbidden: Invalid or expired token",
    });
  }
};
