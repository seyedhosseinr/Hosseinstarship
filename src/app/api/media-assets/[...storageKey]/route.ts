import path from "node:path";
import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";

import { getDb } from "@/db";
import { getMediaAssetPayload } from "@/lib/starship-media/db";
import {
  inferContentTypeFromPath,
  normalizeBundledMediaStorageKey,
} from "@/lib/starship-media/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ storageKey: string[] }>;
}

const PUBLIC_MEDIA_ROOT = path.join(process.cwd(), "public", "media");

export async function GET(_request: Request, context: RouteContext) {
  const params = await context.params;
  const storageKey = normalizeBundledMediaStorageKey(params.storageKey);

  if (!storageKey) {
    return NextResponse.json({ ok: false, error: "invalid-storage-key" }, { status: 400 });
  }

  const dbResponse = await tryReadBundledDbPayload(storageKey);
  if (dbResponse) return dbResponse;

  const fileResponse = await tryReadBundledPublicFile(storageKey);
  if (fileResponse) return fileResponse;

  return NextResponse.json({ ok: false, error: "not-found" }, { status: 404 });
}

async function tryReadBundledDbPayload(storageKey: string): Promise<Response | null> {
  try {
    const db = await getDb();
    const payload = await getMediaAssetPayload(db, storageKey);
    if (!payload) return null;
    return new Response(Buffer.from(payload.bytes), {
      status: 200,
      headers: {
        "content-type": payload.contentType || inferContentTypeFromPath(storageKey),
        "content-length": String(payload.byteLength),
        "cache-control": "public, max-age=3600",
      },
    });
  } catch {
    return null;
  }
}

async function tryReadBundledPublicFile(storageKey: string): Promise<Response | null> {
  const candidate = path.join(PUBLIC_MEDIA_ROOT, storageKey);
  const sandboxRoot = path.resolve(PUBLIC_MEDIA_ROOT);
  const resolved = path.resolve(candidate);

  if (!resolved.startsWith(sandboxRoot + path.sep) && resolved !== sandboxRoot) {
    return null;
  }

  try {
    const bytes = await readFile(resolved);
    return new Response(bytes, {
      status: 200,
      headers: {
        "content-type": inferContentTypeFromPath(storageKey),
        "content-length": String(bytes.byteLength),
        "cache-control": "public, max-age=3600",
      },
    });
  } catch {
    return null;
  }
}
