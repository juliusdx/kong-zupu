/* Contribution form. Live submit to Supabase if configured, else demo JSON download. */
(function () {
  const cfg = window.APP_CONFIG || {};
  const LIVE = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  const T = k => (window.I18N ? I18N.t(k) : k);

  // When a visitor clicks "Suggest a correction" on a person, the form is rebuilt
  // pre-filled with that person's current values so they correct real data instead of
  // facing a blank slate. Held here so a language-toggle rebuild keeps the prefill.
  let prefillData = null;

  // Country dialling codes, family geography first (Sabah / China / SE-Asia diaspora).
  const COUNTRY_CODES = [
    ["+60","🇲🇾 +60"], ["+86","🇨🇳 +86"], ["+65","🇸🇬 +65"], ["+852","🇭🇰 +852"],
    ["+886","🇹🇼 +886"], ["+62","🇮🇩 +62"], ["+673","🇧🇳 +673"], ["+66","🇹🇭 +66"],
    ["+63","🇵🇭 +63"], ["+84","🇻🇳 +84"], ["+61","🇦🇺 +61"], ["+64","🇳🇿 +64"],
    ["+44","🇬🇧 +44"], ["+1","🇺🇸/🇨🇦 +1"], ["+91","🇮🇳 +91"], ["+81","🇯🇵 +81"],
    ["+82","🇰🇷 +82"], ["+49","🇩🇪 +49"], ["+33","🇫🇷 +33"], ["+971","🇦🇪 +971"]
  ];
  const ccOptions = () => COUNTRY_CODES
    .map(([v, label]) => `<option value="${v}"${v === "+60" ? " selected" : ""}>${label}</option>`).join("");

  function personOptions() {
    return LINEAGE.persons.filter(p => !p.spouseOf)
      .sort((a,b)=>(a.gen||0)-(b.gen||0))
      // a missing generation must not render as "第null世" — drop the prefix when unknown
      .map(p => `<option value="${p.id}">${p.gen != null ? "第" + p.gen + "世 · " : ""}${p.name} ${p.pinyin||""}</option>`).join("");
  }

  // Fill the freshly-built form from a prefill object (field name -> value). Fields the
  // object doesn't mention are left at their defaults. Ensures the edited person is
  // selectable even if they're a married-in spouse (not in the default relatedTo list).
  function applyPrefill(f, d) {
    if (d.relatedTo) {
      const sel = f.elements.relatedTo;
      if (sel && !Array.from(sel.options).some(o => o.value === d.relatedTo)) {
        const who = LINEAGE.persons.find(p => p.id === d.relatedTo);
        if (who) {
          const o = document.createElement("option");
          o.value = who.id;
          o.textContent = `第${who.gen}世 · ${who.name} ${who.pinyin || ""}`;
          sel.appendChild(o);
        }
      }
    }
    // the person's stored phone keeps its dialling code — split it back into select + number
    if (d.personPhone) {
      const m = String(d.personPhone).match(/^(\+\d{1,4})\s+(.*)$/);
      if (m && f.elements.personPhoneCountry) { f.elements.personPhoneCountry.value = m[1]; d = Object.assign({}, d, { personPhone: m[2] }); }
    }
    Object.entries(d).forEach(([k, v]) => {
      const el = f.elements[k];
      if (el && v != null && v !== "") el.value = v;
    });
    // show this person's existing map location, if any, so an edit starts from the real pin
    if (d.lat != null && d.lat !== "" && d.lng != null && d.lng !== "") setPin(f, { lat: d.lat, lng: d.lng });
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
      <div class="full date-field">
        <span class="fd-label">${T("f_birth")}</span>
        <div class="date-toggle" role="group">
          <button type="button" class="dt-btn active" data-mode="text">${T("f_date_text")}</button>
          <button type="button" class="dt-btn" data-mode="cal">${T("f_date_cal")}</button>
        </div>
        <input name="birth" class="date-input dt-text" placeholder="1948 / 民國… / 光緒…" />
        <input name="birthExact" type="date" class="date-input dt-cal" hidden />
        <span class="muted fd-hint">${T("f_date_hint")}</span>
      </div>
      <label class="full">${T("f_place")}<input name="place" placeholder="Kota Kinabalu / 山打根…" /></label>
      <label class="full">${T("f_bio")}<textarea name="bio"></textarea></label>

      <div class="field-section" id="loc-section">${T("f_section_loc")}</div>
      <label class="place-only">${T("f_placetype")}
        <select name="placeType">
          <option value="hall">${T("pt_hall")}</option>
          <option value="grave">${T("pt_grave")}</option>
          <option value="church_grave">${T("pt_church")}</option>
          <option value="residence">${T("pt_residence")}</option>
          <option value="origin">${T("pt_origin")}</option>
          <option value="diaspora">${T("pt_diaspora")}</option>
        </select>
      </label>
      <label class="place-only">${T("f_placename")}<input name="placeName" placeholder="例：起瀾公墓 / 古達聖會" /></label>
      <div class="full pin-field">
        <span class="fd-label" id="pin-label">${T("f_pin")}</span>
        <div class="pin-row">
          <button type="button" class="action pin-pick-btn" id="pin-pick">${T("f_pin_btn")}</button>
          <span class="pin-readout muted" id="pin-readout">${T("f_pin_none")}</span>
          <button type="button" class="pin-clear" id="pin-clear" hidden>${T("f_pin_clear")}</button>
        </div>
        <span class="muted fd-hint" id="pin-hint"></span>
        <input type="hidden" name="lat" />
        <input type="hidden" name="lng" />
      </div>
      <label class="full">${T("f_photo_upload")}
        <input type="file" name="photoFile" accept="image/*" class="photo-file" />
        <span class="muted photo-hint">${T("f_photo_hint")}</span>
        <div class="photo-preview" hidden></div>
      </label>

      <div class="field-section person-contact" id="pcontact-section">${T("f_section_personcontact")}</div>
      <label class="full person-contact">${T("f_phone")}
        <div class="phone-row">
          <select name="personPhoneCountry" class="phone-cc">${ccOptions()}</select>
          <input name="personPhone" class="phone-num" inputmode="tel" placeholder="12-345 6789" />
        </div>
      </label>
      <label class="person-contact">${T("f_messaging")}<input name="personWechat" placeholder="WeChat / WhatsApp" /></label>
      <label class="person-contact">${T("f_email")}<input name="personEmail" type="email" placeholder="name@example.com" /></label>
      <div class="privacy-note person-contact">${T("f_personcontact_hint")}</div>

      <div class="field-section">${T("f_section_contributor")}</div>
      <label>${T("f_contributor")}<input name="contributor" /></label>
      <label>${T("f_yourcontact")}<input name="contributorContact" placeholder="email / phone" /></label>
      <label>${T("f_relationship")}<input name="relationship" placeholder="孫 / grandson…" /></label>
      <label>${T("f_residence")}<input name="contributorLocation" placeholder="Kota Kinabalu, MY" /></label>
      <label class="full checkbox-row"><input type="checkbox" name="contactConsent" value="yes" /> <span>${T("f_consent")}</span></label>

      <div class="privacy-note">${T("f_privacy")}</div>

      <div class="contrib-actions">
        <button type="submit" class="primary">${LIVE ? T("f_submit_live") : T("f_submit_demo")}</button>
        <span class="muted">${LIVE ? T("f_note_live") : T("f_note_demo")}</span>
      </div>
    `;
    // onsubmit (not addEventListener) so repeated builds — language toggle, prefill —
    // don't stack duplicate handlers and double-submit the contribution.
    f.onsubmit = submit;
    wire(f);
    if (prefillData) { applyPrefill(f, prefillData); updateLocationMode(f); }
  }

  // The map pin means different things by action: for a person (add child/spouse/edit)
  // it's THAT family member's own location → a named dot on the map; for "add a location"
  // it's a formal place (祠堂/grave/…). Relabel and show/hide the place-only fields to match.
  function updateLocationMode(f) {
    const isPlace = f.elements.action.value === "add_place";
    f.querySelectorAll(".place-only").forEach(el => { el.hidden = !isPlace; });
    // a person's own contact details make no sense for an add-a-place submission
    f.querySelectorAll(".person-contact").forEach(el => { el.hidden = isPlace; });
    const head = f.querySelector("#loc-section");
    if (head) head.textContent = isPlace ? T("f_section_loc") : T("f_section_personloc");
    const lbl = f.querySelector("#pin-label");
    if (lbl) lbl.textContent = isPlace ? T("f_pin") : T("f_pin_person");
    const hint = f.querySelector("#pin-hint");
    if (hint) hint.textContent = isPlace ? "" : T("f_pin_person_hint");
  }

  // the name shown in the picker banner: the family member for person actions, else the place
  function pinSubjectName(f) {
    if (f.elements.action.value !== "add_place") {
      const sel = f.elements.relatedTo, opt = sel && sel.options[sel.selectedIndex];
      const nm = f.elements.name && f.elements.name.value.trim();
      return nm || (opt && opt.textContent.trim()) || T("f_pin_new");
    }
    const pn = f.elements.placeName;
    return (pn && pn.value.trim()) || T("f_pin_new");
  }

  // Hook up the interactive controls after the form HTML is (re)built.
  function wire(f) {
    // birth-date mode toggle: show the calendar OR the free-text year/era input
    f.querySelectorAll(".dt-btn").forEach(b => b.onclick = () => {
      f.querySelectorAll(".dt-btn").forEach(x => x.classList.toggle("active", x === b));
      const cal = b.dataset.mode === "cal";
      f.querySelector(".dt-text").hidden = cal;
      f.querySelector(".dt-cal").hidden = !cal;
    });
    // action drives whether the location is a person's own dot or a formal place
    f.elements.action.addEventListener("change", () => updateLocationMode(f));
    updateLocationMode(f);
    // map pin: hand off to the shared picker (map view + address search), fill lat/lng
    const pick = f.querySelector("#pin-pick");
    if (pick) pick.onclick = async () => {
      if (!window.contribPickLocation) return;
      const coords = await window.contribPickLocation({ name: pinSubjectName(f) });
      if (coords) setPin(f, coords);
    };
    const clr = f.querySelector("#pin-clear");
    if (clr) clr.onclick = () => setPin(f, null);
    // photo file → quick thumbnail preview
    const file = f.querySelector(".photo-file");
    if (file) file.onchange = () => {
      const prev = f.querySelector(".photo-preview"); if (!prev) return;
      const ff = file.files && file.files[0];
      if (ff) { prev.hidden = false; prev.innerHTML = `<img src="${URL.createObjectURL(ff)}" alt="">`; }
      else { prev.hidden = true; prev.innerHTML = ""; }
    };
  }

  function setPin(f, coords) {
    const ro = f.querySelector("#pin-readout"), clr = f.querySelector("#pin-clear");
    if (coords) {
      f.elements.lat.value = coords.lat; f.elements.lng.value = coords.lng;
      ro.textContent = "📍 " + (+coords.lat).toFixed(5) + ", " + (+coords.lng).toFixed(5);
      ro.classList.remove("muted"); if (clr) clr.hidden = false;
    } else {
      f.elements.lat.value = ""; f.elements.lng.value = "";
      ro.textContent = T("f_pin_none"); ro.classList.add("muted"); if (clr) clr.hidden = true;
    }
  }

  // Open the form pre-filled to correct an existing person, then let the caller show it.
  function startEdit(data) { prefillData = data; build(); }
  // Drop any stale correction prefill so a normal "Contribute" visit starts blank.
  // No-op (preserves in-progress typing) unless a prefill is actually active.
  function reset() { if (prefillData) { prefillData = null; build(); } }

  async function submit(e) {
    e.preventDefault();
    const f = e.target;
    const data = Object.fromEntries(new FormData(f).entries());
    const submitBtn = f.querySelector('button[type="submit"]');

    // Birth date: if the calendar mode is showing and filled, it wins over the text input.
    const cal = f.querySelector(".dt-cal");
    if (cal && !cal.hidden && cal.value) data.birth = cal.value;
    delete data.birthExact;

    // Person's phone: prefix the dialling code only when a number was actually entered.
    if (data.personPhone && data.personPhone.trim()) data.personPhone = (data.personPhoneCountry || "") + " " + data.personPhone.trim();
    else delete data.personPhone;
    delete data.personPhoneCountry;

    // Photo: anyone can attach a file. Signed-in → upload straight to storage (lean);
    // anonymous → embed the downscaled image in the payload (admin-only via RLS, never
    // public), and an editor uploads + links it on approval. Either way payload.photo
    // carries it forward; attachContribPhoto() handles both on approval.
    const fileInput = f.querySelector(".photo-file");
    const file = fileInput && fileInput.files && fileInput.files[0];
    const isSignedIn = !!(window.Auth && Auth.state && Auth.state().user);
    if (file) {
      try {
        if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = T("f_uploading"); }
        if (isSignedIn && window.uploadContributionPhoto) data.photo = await window.uploadContributionPhoto(file);
        else if (window.fileToContribImage) data.photo = await window.fileToContribImage(file);
      } catch (err) {
        alert(T("f_photo_fail") + (err.message || err));
      } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = LIVE ? T("f_submit_live") : T("f_submit_demo"); }
      }
    }
    delete data.photoFile;

    // Drop empties so the stored payload and the reviewer's card stay clean.
    Object.keys(data).forEach(k => { if (data[k] === "" || data[k] == null) delete data[k]; });

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
        prefillData = null;
        build();                 // fresh, fully-reset form (clears pin readout, toggle, preview)
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

  window.Contribute = { build, prefill: startEdit, reset, LIVE };
})();
