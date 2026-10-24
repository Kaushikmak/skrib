import path from "node:path";
import fs from "node:fs";
import { defineConfig, env } from "prisma/config";

const envPath = path.resolve(__dirname, ".env");
if (fs.existsSync(envPath) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envPath);
}

export default defineConfig({
  schema: "./prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
});
