/* Contribution form. Live submit to Supabase if configured, else demo JSON download. */
(function () {
  const cfg = window.APP_CONFIG || {};
  const LIVE = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);

  function personOptions() {
    return LINEAGE.persons.filter(p => !p.spouseOf)
      .sort((a,b)=>a.gen-b.gen)
      .map(p => `<option value="${p.id}">第${p.gen}世 · ${p.name} ${p.pinyin||""}</option>`).join("");
  }

  function build() {
    const f = document.getElementById("contrib-form");
    f.innerHTML = `
      <label>What are you doing?
        <select name="action">
          <option value="add_child">Add a child to someone</option>
          <option value="add_spouse">Add a spouse</option>
          <option value="edit">Correct / enrich an existing person</option>
          <option value="add_place">Add / fix a location (祠堂 / grave)</option>
        </select>
      </label>
      <label>Relative this connects to
        <select name="relatedTo">${personOptions()}</select>
      </label>

      <div class="field-section">Person details</div>
      <label>Name 名 (Chinese)<input name="name" placeholder="例：漢明" /></label>
      <label>Romanization / English<input name="pinyin" placeholder="Han Ming" /></label>
      <label>Ritual / baptism name 禮名<input name="ritualName" placeholder="optional" /></label>
      <label>Gender
        <select name="gender"><option value="m">Male 男</option><option value="f">Female 女</option></select>
      </label>
      <label>Generation 世 (number)<input name="gen" type="number" placeholder="e.g. 27" /></label>
      <label>Living?
        <select name="living"><option value="true">Living</option><option value="false">Deceased</option></select>
      </label>
      <label>Birth date<input name="birth" placeholder="1948 / 民國… / 光緒…" /></label>
      <label>Birth or current place<input name="place" placeholder="Kota Kinabalu / 山打根…" /></label>
      <label class="full">Short write-up / biography 傳記<textarea name="bio" placeholder="A few sentences about their life, work, faith, character…"></textarea></label>

      <div class="field-section">Location (for 祠堂 / grave / residence pins)</div>
      <label>Latitude<input name="lat" placeholder="6.883" /></label>
      <label>Longitude<input name="lng" placeholder="116.848" /></label>
      <label class="full">Photo URL or note<input name="photo" placeholder="link to a photo, or describe what you have" /></label>

      <div class="field-section">Contact (private — never shown publicly)</div>
      <label>Your name<input name="contributor" /></label>
      <label>Your email / phone<input name="contact" /></label>

      <div class="privacy-note">
        <b>Privacy:</b> contact details and info about <i>living</i> people are stored in the private/member tier and are never shown on the public tree.
        Minors are hidden by default. You can request removal at any time.
      </div>

      <div class="contrib-actions">
        <button type="submit" class="primary">${LIVE ? "Submit for review" : "Download submission (demo)"}</button>
        <span class="muted">${LIVE ? "Goes to the moderation queue." : "No database connected yet — saves a JSON file to send to the keeper."}</span>
      </div>
    `;
    f.addEventListener("submit", submit);
  }

  async function submit(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target).entries());
    data.submittedAt = new Date().toISOString();
    data.status = "pending";

    if (LIVE) {
      try {
        const res = await fetch(`${cfg.SUPABASE_URL}/rest/v1/contributions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: cfg.SUPABASE_ANON_KEY, Authorization: `Bearer ${cfg.SUPABASE_ANON_KEY}`, Prefer: "return=minimal" },
          body: JSON.stringify({ payload: data, status: "pending" })
        });
        if (!res.ok) throw new Error(await res.text());
        alert("謝謝!  Thank you — your submission was received and will appear after review.");
        e.target.reset();
      } catch (err) {
        alert("Submission failed: " + err.message + "\nFalling back to file download.");
        download(data);
      }
    } else {
      download(data);
    }
  }

  function download(data) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `zupu-submission-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    alert("謝謝!  Your submission file was downloaded — please send it to the family keeper.");
  }

  window.Contribute = { build, LIVE };
})();
