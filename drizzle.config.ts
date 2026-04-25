import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

// این خط باعث می‌شود Drizzle هنگام اجرای دستورات ترمینال، حتماً فایل .env را بخواند
// اگر نام فایل شما چیز دیگری است (مثلاً .env.local)، آن را در خط زیر تغییر دهید
dotenv.config({ path: ".env" });

const databaseUrl =
  process.env.DATABASE_URL?.trim() || "postgresql://postgres:postgres@localhost:5432/uro_omega";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});