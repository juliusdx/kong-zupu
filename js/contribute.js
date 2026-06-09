/* Contribution form. Live submit to Supabase if configured, else demo JSON download. */
(function () {
  const cfg = window.APP_CONFIG || {};
  const LIVE = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  const T = k => (window.I18N ? I18N.t(k) : k);

  function personOptions() {
    return LINEAGE.persons.filter(p => !p.spouseOf)
      .sort((a,b)=>a.gen-b.gen)
      .map(p => `<option value="${p.id}">第${p.gen}世 · ${p.name} ${p.pinyin||""}</option>`).join("");
  }

  function build() {
    const T = window.I18N ? I18N.t : (k => k);
    const intro = document.getElementById("contrib-intro");
    if (intro) intro.textContent = LIVE ? T("c_intro_live") : T("c_intro_demo");
    const f = document.getElementById("contrib-form");
    f.innerHTML = `
      <label>${T("f_action")}
        <select name="action">
          <option value="add_child">${T("f_opt_add_child")}</option>
          <option value="add_spouse">${T("f_opt_add_spouse")}</option>
          <option value="edit">${T("f_opt_edit")}</option>
          <option value="add_place">${T("f_opt_add_place")}</option>
        </select>
      </label>
      <label>${T("f_relatedto")}
        <select name="relatedTo">${personOptions()}</select>
      </label>

      <div class="field-section">${T("f_section_person")}</div>
      <label>${T("f_name")}<input name="name" placeholder="例：漢明" /></label>
      <label>${T("f_pinyin")}<input name="pinyin" placeholder="Han Ming" /></label>
      <label>${T("f_ritual")}<input name="ritualName" /></label>
      <label>${T("f_milk")}<input name="milkName" /></label>
      <label>${T("f_aka")}<input name="aka" placeholder="字 / 號 / 洗禮名 / 綽號…" /></label>
      <label>${T("f_gender")}
        <select name="gender"><option value="m">${T("f_male")}</option><option value="f">${T("f_female")}</option></select>
      </label>
      <label>${T("f_gen")}<input name="gen" type="number" placeholder="27" /></label>
      <label>${T("f_living")}
        <select name="living"><option value="true">${T("f_living_yes")}</option><option value="false">${T("f_living_no")}</option></select>
      </label>
      <label>${T("f_birth")}<input name="birth" placeholder="1948 / 民國… / 光緒…" /></label>
      <label>${T("f_place")}<input name="place" placeholder="Kota Kinabalu / 山打根…" /></label>
      <label class="full">${T("f_bio")}<textarea name="bio"></textarea></label>

      <div class="field-section">${T("f_section_loc")}</div>
      <label>${T("f_placetype")}
        <select name="placeType">
          <option value="hall">${T("pt_hall")}</option>
          <option value="grave">${T("pt_grave")}</option>
          <option value="church_grave">${T("pt_church")}</option>
          <option value="residence">${T("pt_residence")}</option>
          <option value="origin">${T("pt_origin")}</option>
          <option value="diaspora">${T("pt_diaspora")}</option>
        </select>
      </label>
      <label>${T("f_placename")}<input name="placeName" placeholder="例：起瀾公墓 / 古達聖會" /></label>
      <label>${T("f_lat")}<input name="lat" placeholder="6.883" /></label>
      <label>${T("f_lng")}<input name="lng" placeholder="116.848" /></label>
      <label class="full">${T("f_photo")}<input name="photo" /></label>

      <div class="field-section">${T("f_section_contact")}</div>
      <label>${T("f_contributor")}<input name="contributor" /></label>
      <label>${T("f_contact")}<input name="contact" /></label>

      <div class="privacy-note">${T("f_privacy")}</div>

      <div class="contrib-actions">
        <button type="submit" class="primary">${LIVE ? T("f_submit_live") : T("f_submit_demo")}</button>
        <span class="muted">${LIVE ? T("f_note_live") : T("f_note_demo")}</span>
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
        alert(T("f_thanks_live"));
        e.target.reset();
      } catch (err) {
        alert(T("f_fail") + err.message);
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
    alert(T("f_thanks_demo"));
  }

  window.Contribute = { build, LIVE };
})();
