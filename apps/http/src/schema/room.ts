import { z } from "zod";

export const createRoomSchema = z
  .object({
    name: z
      .string()
      .min(2, "Room name must be at least 2 characters")
      .max(50, "Room name cannot exceed 50 characters")
      .optional(),
    slug: z
      .string()
      .min(2, "Room slug must be at least 2 characters")
      .max(50, "Room slug cannot exceed 50 characters")
      .optional(),
  })
  .refine((data) => Boolean(data.name || data.slug), {
    message: "Either 'name' or 'slug' is required to create a room",
  });
