import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WEBHOOK_URL = Deno.env.get("MAKE_WEBHOOK_URL") ?? "";
const SITE_URL    = Deno.env.get("SITE_URL") ?? "https://juliusdx.github.io/kong-zupu/";

const ACTION_LABEL: Record<string, string> = {
  add_child:         "new family member",
  add_spouse:        "new spouse",
  edit:              "correction",
  add_place:         "new location",
  update_place:      "location update",
  fix_transcription: "transcription correction",
};

// Allow the browser to call this function cross-origin (GitHub Pages → Supabase).
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  // Preflight — the browser sends this before the actual POST
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const { id, status, reason } = await req.json() as {
    id: string; status: "approved" | "rejected"; reason?: string;
  };

  if (!id || !status) {
    return json({ error: "Missing id or status" }, 400);
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data: contrib, error: cErr } = await sb
    .from("contributions")
    .select("payload, submitted_by, created_at")
    .eq("id", id)
    .single();

  if (cErr || !contrib) {
    return json({ error: "Contribution not found" }, 404);
  }

  // Resolve submitter email — auth account first, then free-text contact field
  let email: string | null = null;
  let displayName: string | null = null;

  if (contrib.submitted_by) {
    const { data: { user } } = await sb.auth.admin.getUserById(contrib.submitted_by);
    email       = user?.email ?? null;
    displayName = (user?.user_metadata as Record<string, string> | undefined)?.name ?? null;
  }
  if (!email) {
    const contact = String(contrib.payload?.contributorContact ?? "");
    const match = contact.match(/[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+/);
    if (match) email = match[0];
  }
  if (!email && contrib.payload?.personEmail) {
    email = String(contrib.payload.personEmail);
  }

  if (!email) {
    return json({ sent: false, reason: "no email found" });
  }

  displayName = displayName || contrib.payload?.contributor || "Family member";

  const actionLabel = ACTION_LABEL[contrib.payload?.action ?? ""] ?? "submission";
  const submittedOn = new Date(contrib.created_at).toDateString();
  const approved    = status === "approved";

  const subject = approved
    ? `Your ${actionLabel} has been approved — 江氏族譜`
    : `Update on your ${actionLabel} — 江氏族譜`;

  const reasonBlock = reason
    ? `<p style="margin:.8rem 0;padding:.7rem 1rem;background:#fdf6e3;border-left:3px solid #c47a2c;font-size:.92rem;">
         <strong>Reviewer's note:</strong> ${reason}
       </p>`
    : "";

  const html = approved
    ? `<div style="font-family:Georgia,serif;max-width:520px;color:#2b2117">
         <p>Dear ${displayName},</p>
         <p>Your <strong>${actionLabel}</strong> submitted on ${submittedOn} has been
            <strong style="color:#2a6035">approved</strong> and added to the family tree.</p>
         <p>Thank you for contributing to the Kong Family Zupu.</p>
         <p><a href="${SITE_URL}" style="color:#9e2b25">View the tree →</a></p>
         <p style="font-size:.8rem;color:#9a8a6e;margin-top:2rem;border-top:1px solid #e3d9c2;padding-top:.8rem">
           江氏族譜 · Kong Family Zupu
         </p>
       </div>`
    : `<div style="font-family:Georgia,serif;max-width:520px;color:#2b2117">
         <p>Dear ${displayName},</p>
         <p>Your <strong>${actionLabel}</strong> submitted on ${submittedOn} has been reviewed
            and could <strong style="color:#9e2b25">not be approved</strong> at this time.</p>
         ${reasonBlock}
         <p>If you have questions or would like to resubmit with corrections, please reply to
            this email.</p>
         <p><a href="${SITE_URL}" style="color:#9e2b25">江氏族譜</a></p>
         <p style="font-size:.8rem;color:#9a8a6e;margin-top:2rem;border-top:1px solid #e3d9c2;padding-top:.8rem">
           江氏族譜 · Kong Family Zupu
         </p>
       </div>`;

  if (!WEBHOOK_URL) {
    console.warn("MAKE_WEBHOOK_URL not set — email not sent");
    return json({ sent: false, reason: "webhook not configured" });
  }

  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to: email, subject, html }),
  });

  if (!res.ok) {
    const body = await res.text();
    return json({ sent: false, error: `Webhook error: ${body}` }, 502);
  }

  return json({ sent: true, to: email });
});
