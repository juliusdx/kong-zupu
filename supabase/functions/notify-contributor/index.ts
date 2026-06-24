import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const WEBHOOK_URL = Deno.env.get("MAKE_WEBHOOK_URL") ?? "";
const SITE_URL    = Deno.env.get("SITE_URL") ?? "https://juliusdx.github.io/kong-zupu/";

const ACTION_LABEL: Record<string, { en: string; zh: string }> = {
  add_child:         { en: "new family member",          zh: "新增家族成員" },
  add_spouse:        { en: "new spouse",                 zh: "新增配偶" },
  edit:              { en: "correction",                 zh: "資料修正" },
  add_place:         { en: "new location",               zh: "新增地點" },
  update_place:      { en: "location update",            zh: "地點更新" },
  fix_transcription: { en: "transcription correction",   zh: "釋文校正" },
};

// Chinese labels for the edit diff, keyed by the form field name (the captured
// `changes` array stores the English label; we map field → 中文 here).
const FIELD_LABEL_ZH: Record<string, string> = {
  name: "姓名", pinyin: "拼音", ritualName: "字／號", milkName: "乳名",
  aka: "別名", gender: "性別", gen: "世代", living: "在世", birth: "生年",
  place: "地點", bio: "生平", personPhone: "電話", personWechat: "微信／WhatsApp",
  personEmail: "電郵",
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

  // 1) email captured in the payload when a signed-in member submitted
  if (contrib.payload?.submitterEmail) {
    email = String(contrib.payload.submitterEmail);
  }
  // 2) auth account, if the row recorded who submitted
  if (!email && contrib.submitted_by) {
    const { data: { user } } = await sb.auth.admin.getUserById(contrib.submitted_by);
    email       = user?.email ?? null;
    displayName = (user?.user_metadata as Record<string, string> | undefined)?.name ?? null;
  }
  // 3) free-text "your contact" field (anonymous submitters)
  if (!email) {
    const contact = String(contrib.payload?.contributorContact ?? "");
    const match = contact.match(/[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+/);
    if (match) email = match[0];
  }
  // 4) the person's own email (last resort)
  if (!email && contrib.payload?.personEmail) {
    email = String(contrib.payload.personEmail);
  }

  if (!email) {
    return json({ sent: false, reason: "no email found" });
  }

  displayName = displayName || contrib.payload?.contributor || "Family member";

  const action     = contrib.payload?.action ?? "";
  const labelEn    = ACTION_LABEL[action]?.en ?? "submission";
  const labelZh    = ACTION_LABEL[action]?.zh ?? "提交";
  const submittedOn = new Date(contrib.created_at).toDateString();
  const approved    = status === "approved";

  // Bilingual subject — Chinese first, then English.
  const subject = approved
    ? `您的${labelZh}已通過審核 · Your ${labelEn} has been approved — 江氏族譜`
    : `關於您的${labelZh}的審核結果 · Update on your ${labelEn} — 江氏族譜`;

  const esc = (s: unknown) =>
    String(s ?? "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));

  // Field-level changes captured for an edit. The table is language-neutral data, so we
  // build it once with a bilingual "field" cell (中文 / English) shared by both sections.
  const changes = Array.isArray(contrib.payload?.changes) ? contrib.payload.changes : [];
  const changesTable = (fieldHdr: string, fromHdr: string, toHdr: string) => changes.length
    ? `<table style="border-collapse:collapse;margin:.6rem 0;font-size:.9rem;width:100%">
         <thead><tr>
           <th style="text-align:left;padding:.3rem .6rem;border-bottom:2px solid #e3d9c2;color:#b08833">${fieldHdr}</th>
           <th style="text-align:left;padding:.3rem .6rem;border-bottom:2px solid #e3d9c2;color:#b08833">${fromHdr}</th>
           <th style="text-align:left;padding:.3rem .6rem;border-bottom:2px solid #e3d9c2;color:#b08833">${toHdr}</th>
         </tr></thead><tbody>` +
      changes.map((c: { label?: string; field?: string; from?: string; to?: string }) => {
        const zh = FIELD_LABEL_ZH[c.field ?? ""] || "";
        const fieldCell = zh ? `${zh} / ${esc(c.label || c.field)}` : esc(c.label || c.field);
        return `<tr>
           <td style="padding:.3rem .6rem;border-bottom:1px solid #efe6d2"><strong>${fieldCell}</strong></td>
           <td style="padding:.3rem .6rem;border-bottom:1px solid #efe6d2;color:#9a8a6e">${esc(c.from) || "—"}</td>
           <td style="padding:.3rem .6rem;border-bottom:1px solid #efe6d2;color:#2a6035">${esc(c.to) || "—"}</td>
         </tr>`;
      }).join("") +
      `</tbody></table>`
    : "";

  const reasonZh = reason
    ? `<p style="margin:.8rem 0;padding:.7rem 1rem;background:#fdf6e3;border-left:3px solid #c47a2c;font-size:.92rem;">
         <strong>審核備註：</strong>${esc(reason)}</p>`
    : "";
  const reasonEn = reason
    ? `<p style="margin:.8rem 0;padding:.7rem 1rem;background:#fdf6e3;border-left:3px solid #c47a2c;font-size:.92rem;">
         <strong>Reviewer's note:</strong> ${esc(reason)}</p>`
    : "";

  const divider = `<hr style="border:none;border-top:1px solid #e3d9c2;margin:1.4rem 0">`;
  const footer = `<p style="font-size:.8rem;color:#9a8a6e;margin-top:2rem;border-top:1px solid #e3d9c2;padding-top:.8rem">
           江氏族譜 · Kong Family Zupu</p>`;

  // Chinese section, then English section, in one email.
  const zhSection = approved
    ? `<p>${esc(displayName)} 您好：</p>
       <p>您於 ${submittedOn} 提交的<strong>${labelZh}</strong>已通過審核，
          並已<strong style="color:#2a6035">加入族譜</strong>。</p>
       ${changesTable("項目", "原", "新") ? `<p style="margin:.6rem 0 .2rem;font-weight:600">修改內容：</p>${changesTable("項目", "原", "新")}` : ""}
       <p>感謝您為江氏族譜貢獻一份心力。</p>
       <p><a href="${SITE_URL}" style="color:#9e2b25">查看族譜 →</a></p>`
    : `<p>${esc(displayName)} 您好：</p>
       <p>您於 ${submittedOn} 提交的<strong>${labelZh}</strong>經審核後，
          <strong style="color:#9e2b25">暫未通過</strong>。</p>
       ${changesTable("項目", "原", "新") ? `<p style="margin:.6rem 0 .2rem;font-weight:600">您提交的內容：</p>${changesTable("項目", "原", "新")}` : ""}
       ${reasonZh}
       <p>如有疑問或希望修改後重新提交，歡迎直接回覆此郵件。</p>`;

  const enSection = approved
    ? `<p>Dear ${esc(displayName)},</p>
       <p>Your <strong>${labelEn}</strong> submitted on ${submittedOn} has been
          <strong style="color:#2a6035">approved</strong> and added to the family tree.</p>
       ${changesTable("Field", "From", "To") ? `<p style="margin:.6rem 0 .2rem;font-weight:600">Details of the change:</p>${changesTable("Field", "From", "To")}` : ""}
       <p>Thank you for contributing to the Kong Family Zupu.</p>
       <p><a href="${SITE_URL}" style="color:#9e2b25">View the tree →</a></p>`
    : `<p>Dear ${esc(displayName)},</p>
       <p>Your <strong>${labelEn}</strong> submitted on ${submittedOn} has been reviewed
          and could <strong style="color:#9e2b25">not be approved</strong> at this time.</p>
       ${changesTable("Field", "From", "To") ? `<p style="margin:.6rem 0 .2rem;font-weight:600">What you submitted:</p>${changesTable("Field", "From", "To")}` : ""}
       ${reasonEn}
       <p>If you have questions or would like to resubmit with corrections, please reply to this email.</p>`;

  const html = `<div style="font-family:Georgia,'Songti SC','STSong',serif;max-width:520px;color:#2b2117">
       ${zhSection}
       ${divider}
       ${enSection}
       ${footer}
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
