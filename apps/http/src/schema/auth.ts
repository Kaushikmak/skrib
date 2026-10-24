import { z } from "zod";

export const signUpSchema = z
  .object({
    username: z
      .string()
      .min(2, "username must be at least 2 characters long")
      .max(30, "maximum characters can be 30"),
    password: z
      .string()
      .min(6, "password must have at least 6 characters")
      .max(50, "password cannot exceed 50 characters"),
    confirm: z.string().optional(),
    name: z.string().optional(),
  })
  .refine(
    (data) =>
      !data.password.toLowerCase().includes(data.username.toLowerCase()),
    {
      message: "Password should not contain your username",
      path: ["password"],
    },
  )
  .refine(
    (data) => data.confirm === undefined || data.password === data.confirm,
    {
      message: "Passwords do not match",
      path: ["confirm"],
    },
  );

export const signInSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});
