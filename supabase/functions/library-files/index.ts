import { createClient } from "npm:@supabase/supabase-js@2";

const BUCKET = "library-files2";
const MAX_BYTES = 20 * 1024 * 1024;
const FIREBASE_WEB_API_KEY = Deno.env.get("FIREBASE_WEB_API_KEY") || "";
const ADMIN_EMAILS = new Set(
  (Deno.env.get("ADMIN_EMAILS") || "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);
const ALLOWED_ORIGINS = new Set(
  (Deno.env.get("ALLOWED_ORIGINS") || "https://damanhour-library3.vercel.app")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function json(req: Request, data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function getSupabaseSecretKey(): string {
  const oldKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SUPABASE_SECRET_KEY");
  if (oldKey) return oldKey;
  try {
    const keys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") || "{}");
    return keys.default || Object.values(keys)[0] || "";
  } catch {
    return "";
  }
}

async function verifyFirebaseAdmin(req: Request): Promise<{ email: string } | Response> {
  const authorization = req.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return json(req, { error: "firebase-token-invalid" }, 401);
  if (!FIREBASE_WEB_API_KEY || ADMIN_EMAILS.size === 0) {
    return json(req, { error: "admin-not-configured" }, 503);
  }

  // Firebase validates the ID token; never trust an email sent by the browser.
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(FIREBASE_WEB_API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: match[1] }),
    },
  );
  const body = await response.json().catch(() => ({}));
  const account = body?.users?.[0];
  if (!response.ok || !account || account.disabled === true || !account.email) {
    return json(req, { error: "firebase-token-invalid" }, 401);
  }
  const email = String(account.email).trim().toLowerCase();
  if (!ADMIN_EMAILS.has(email)) return json(req, { error: "admin-not-authorized" }, 403);
  return { email };
}

function cleanSegment(value: unknown, max = 100): string {
  return String(value ?? "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, max);
}

function validStoragePath(path: unknown): path is string {
  if (typeof path !== "string" || !path.endsWith(".pdf")) return false;
  const parts = path.split("/");
  return parts.length === 3 && parts.every((p) => p.length > 0 && p !== "." && p !== "..") &&
    /^[a-zA-Z0-9_-]+$/.test(parts[0]) && /^[0-9]+$/.test(parts[1]) &&
    /^[a-zA-Z0-9_.-]+\.pdf$/.test(parts[2]);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin") || "";
    if (origin && !ALLOWED_ORIGINS.has(origin)) return new Response("Origin not allowed", { status: 403 });
    return new Response("ok", { headers: corsHeaders(req) });
  }
  if (req.method !== "POST") return json(req, { error: "method-not-allowed" }, 405);
  const origin = req.headers.get("origin") || "";
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json(req, { error: "origin-not-allowed" }, 403);

  try {
    const identity = await verifyFirebaseAdmin(req);
    if (identity instanceof Response) return identity;

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = getSupabaseSecretKey();
    if (!supabaseUrl || !serviceKey) return json(req, { error: "supabase-server-not-configured" }, 503);
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    });

    if (!req.headers.get("content-type")?.includes("application/json")) {
      return json(req, { error: "unsupported-content-type" }, 415);
    }
    const body = await req.json().catch(() => ({}));

    if (body?.action === "create-upload") {
      const courseId = cleanSegment(body.courseId);
      const sectionIndex = Number(body.sectionIndex);
      const title = String(body.title || "").trim().slice(0, 120);
      const fileName = String(body.fileName || "");
      const fileSize = Number(body.fileSize);
      const fileType = String(body.fileType || "");
      if (!courseId || !Number.isInteger(sectionIndex) || sectionIndex < 0 || !title) {
        return json(req, { error: "invalid-file-metadata" }, 400);
      }
      if (!/\.pdf$/i.test(fileName) || (fileType && fileType !== "application/pdf")) {
        return json(req, { error: "pdf-only" }, 415);
      }
      if (!Number.isFinite(fileSize) || fileSize < 5 || fileSize > MAX_BYTES) {
        return json(req, { error: "file-too-large-max-20mb" }, 413);
      }

      const path = `${courseId}/${sectionIndex}/${Date.now()}-${crypto.randomUUID()}.pdf`;
      const { data: signed, error: signedError } = await supabase.storage.from(BUCKET)
        .createSignedUploadUrl(path, { upsert: false });
      if (signedError || !signed?.token) {
        console.error("Signed upload URL failed for admin", identity.email, signedError?.message);
        return json(req, { error: "storage-upload-failed" }, 500);
      }
      const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return json(req, { ok: true, path, token: signed.token, publicUrl: publicData.publicUrl, title, size: fileSize });
    }

    if (body?.action === "delete") {
      if (!validStoragePath(body.path)) return json(req, { error: "invalid-storage-path" }, 400);
      const { error } = await supabase.storage.from(BUCKET).remove([body.path]);
      if (error) {
        console.error("Storage delete failed for admin", identity.email, error.message);
        return json(req, { error: "storage-delete-failed" }, 500);
      }
      return json(req, { ok: true });
    }

    return json(req, { error: "invalid-action" }, 400);
  } catch (error) {
    console.error("library-files function error", error);
    return json(req, { error: "server-error" }, 500);
  }
});
