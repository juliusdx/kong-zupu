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
          <option value="add">${T("f_opt_add")}</option>
          <option value="edit">${T("f_opt_edit")}</option>
          <option value="add_place">${T("f_opt_add_place")}</option>
        </select>
      </label>
      <label><span id="relatedto-label">${T("f_relatedto")}</span>
        <select name="relatedTo">${personOptions()}</select>
        <span class="muted fd-hint" id="relatedto-hint"></span>
      </label>
      <label id="rel-row">${T("f_kinship")}
        <select name="kinship">
          <option value="child">${T("f_rel_child")}</option>
          <option value="spouse">${T("f_rel_spouse")}</option>
          <option value="sibling">${T("f_rel_sibling")}</option>
        </select>
        <span class="muted fd-hint">${T("f_kinship_hint")}</span>
      </label>

      <div id="move-block" hidden>
        <label class="full checkbox-row"><input type="checkbox" name="moveEnable" value="yes" id="move-enable" />
          <span>${T("f_move_toggle")}</span></label>
        <div id="move-fields" hidden>
          <label>${T("f_move_rel")}
            <select name="moveRel">
              <option value="child">${T("f_rel_child")}</option>
              <option value="spouse">${T("f_rel_spouse")}</option>
              <option value="sibling">${T("f_rel_sibling")}</option>
            </select>
          </label>
          <label>${T("f_move_to")}<select name="moveTo">${personOptions()}</select></label>
          <p class="at-preview" id="move-hint"></p>
        </div>
      </div>

      <div class="field-section">${T("f_section_person")}</div>
      <label>${T("f_name")}<input name="name" placeholder="例：漢明" /></label>
      <label>${T("f_pinyin")}<input name="pinyin" placeholder="Han Ming" /></label>
      <label>${T("f_ritual")}<input name="ritualName" /></label>
      <label>${T("f_milk")}<input name="milkName" /></label>
      <label>${T("f_aka")}<input name="aka" placeholder="字 / 號 / 洗禮名 / 綽號…" /></label>
      <label>${T("f_gender")}
        <select name="gender"><option value="m">${T("f_male")}</option><option value="f">${T("f_female")}</option></select>
      </label>
      <label>${T("f_gen")}<input name="gen" type="number" readonly />
        <span class="muted fd-hint" id="gen-hint"></span>
      </label>
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
      <div class="privacy-note" id="contact-notify-hint">${T("f_contact_notify")}</div>
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
    // A prefill sets the action directly, without firing a change event, so the
    // action-dependent presentation has to be re-run by hand. Without this, arriving
    // via "Suggest a correction" — the main way in — left the form wearing its "add a
    // person" clothes: the vague "Related to which family member?" label, and a
    // "How are they related?" selector that does nothing on an edit.
    if (prefillData) { applyPrefill(f, prefillData); updateLocationMode(f); updateRelatedMode(f); }
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
    // "Relative this connects to" means something different per action — say which, and on
    // an edit load that person's current values in, so the reviewer sees a real diff instead
    // of a blank-vs-typed one. (A generic label here is how corrections meant for a child
    // ended up overwriting the parent — e.g. 江萬里's details written onto 江八郎, Aug 2026.)
    f.elements.action.addEventListener("change", () => updateRelatedMode(f));
    f.elements.relatedTo.addEventListener("change", () => {
      if (f.elements.action.value === "edit") loadEditTarget(f);
      updateGen(f);
    });
    if (f.elements.kinship) f.elements.kinship.addEventListener("change", () => updateGen(f));
    const mEn = f.elements.moveEnable;
    if (mEn) mEn.addEventListener("change", () => {
      f.querySelector("#move-fields").hidden = !mEn.checked;
      updateMove(f);
    });
    if (f.elements.moveRel) f.elements.moveRel.addEventListener("change", () => updateMove(f));
    if (f.elements.moveTo) f.elements.moveTo.addEventListener("change", () => updateMove(f));
    updateRelatedMode(f);
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

  // Re-label the relatedTo picker for the action in play: for an edit it names the person
  // being overwritten, for the add actions it names the relative the new person hangs off.
  function updateRelatedMode(f) {
    const a = f.elements.action.value;
    const lbl = f.querySelector("#relatedto-label"), hint = f.querySelector("#relatedto-hint");
    const key = a === "edit" ? "f_relatedto_edit"
              : a === "add_place" ? "f_relatedto_place" : "f_relatedto_add";
    if (lbl) lbl.textContent = T(key);
    if (hint) hint.textContent = a === "edit" ? T("f_relatedto_edit_hint") : "";
    const relRow = f.querySelector("#rel-row");
    if (relRow) relRow.hidden = (a !== "add");
    const moveBlock = f.querySelector("#move-block");
    if (moveBlock) moveBlock.hidden = (a !== "edit");
    updateMove(f);
    updateGen(f);
  }

  // Everyone below a person, so a correction can't propose hanging them under one of
  // their own descendants — the tree would fold into a loop.
  function descendantIds(id) {
    const out = new Set(), queue = [id];
    while (queue.length) {
      const cur = queue.shift();
      LINEAGE.persons.forEach(p => {
        if (p.father === cur && !p.spouseOf && !out.has(p.id)) { out.add(p.id); queue.push(p.id); }
      });
    }
    return out;
  }

  // Spell out where the person would land, or why the move can't be made. Returns the
  // problem string, or "" when the move is fine — submit() re-uses that check.
  function moveProblem(f) {
    if (!f.elements.moveEnable || !f.elements.moveEnable.checked) return "";
    if (f.elements.action.value !== "edit") return "";
    const who = f.elements.relatedTo.value, to = f.elements.moveTo.value;
    if (!to) return T("f_move_err_none");
    if (to === who) return T("f_move_err_self");
    if (descendantIds(who).has(to)) return T("f_move_err_loop");
    return "";
  }
  function updateMove(f) {
    const hint = f.querySelector("#move-hint");
    if (!hint) return;
    const problem = moveProblem(f);
    if (problem) { hint.innerHTML = `<span class="at-warn-inline">${problem}</span>`; return; }
    if (!f.elements.moveEnable || !f.elements.moveEnable.checked) { hint.textContent = ""; return; }
    const me = LINEAGE.persons.find(x => x.id === f.elements.relatedTo.value);
    const to = LINEAGE.persons.find(x => x.id === f.elements.moveTo.value);
    if (!me || !to || to.gen == null) { hint.textContent = ""; return; }
    const rel = f.elements.moveRel.value;
    const g = rel === "child" ? to.gen + 1 : to.gen;
    const kin = descendantIds(me.id).size;
    hint.textContent = T("f_move_hint")
      .replace("{name}", me.name).replace("{gen}", g).replace("{was}", me.gen == null ? "—" : me.gen)
      + (kin && me.gen != null && g !== me.gen ? " " + T("f_move_hint_kin").replace("{n}", kin) : "");
  }

  // The generation is worked out from the relationship, never typed: a child is one
  // below the relative, a spouse or sibling sits level with them. This is what stopped
  // people landing at "generation 2" or "generation 30" by mistyping the box.
  function updateGen(f) {
    const genEl = f.elements.gen, hint = f.querySelector("#gen-hint");
    if (!genEl) return;
    const a = f.elements.action.value;
    if (a === "add_place") { if (hint) hint.textContent = ""; return; }
    const target = LINEAGE.persons.find(x => x.id === f.elements.relatedTo.value);
    if (a === "edit") {
      const cur = target && target.gen != null ? target.gen : "";
      genEl.value = cur;
      if (hint) hint.textContent = cur === "" ? "" : T("f_gen_hint_edit").replace("{name}", target.name);
      return;
    }
    const rel = f.elements.kinship ? f.elements.kinship.value : "child";
    if (!target || target.gen == null) {
      genEl.value = "";
      if (hint) hint.textContent = T("f_gen_hint_unknown");
      return;
    }
    const g = rel === "child" ? target.gen + 1 : target.gen;
    genEl.value = g;
    if (hint) hint.textContent = T("f_gen_hint_" + rel)
      .replace("{gen}", g).replace("{name}", target.name).replace("{tgen}", target.gen);
  }

  // Copy the selected person's current values into the form so an "edit" starts from what
  // is on record. Without this the form keeps whatever was typed for someone else and the
  // approval silently writes it onto the newly-selected person.
  function loadEditTarget(f) {
    const id = f.elements.relatedTo.value;
    const p = LINEAGE.persons.find(x => x.id === id);
    if (!p || typeof window.personPrefill !== "function") return;
    const d = window.personPrefill(p);
    ["name","pinyin","ritualName","milkName","aka","gender","gen","living","birth","place","bio"]
      .forEach(k => { const el = f.elements[k]; if (el) el.value = d[k] != null ? d[k] : ""; });
    setPin(f, (d.lat !== "" && d.lng !== "") ? { lat: d.lat, lng: d.lng } : null);
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

  // Fields a correction may blank out. Name, gender, generation and living status are
  // left off deliberately: the first two must always hold a value, and the last two are
  // derived from the person's place in the tree rather than typed.
  const CLEARABLE = new Set(["pinyin", "ritualName", "milkName", "aka", "birth", "bio"]);

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

    // "Add a person" + a relationship is what the family fills in; the stored payload
    // keeps the older add_child / add_spouse actions the approval path understands.
    // A sibling is stored as a child of the SAME father, which is what the tree needs.
    if (data.action === "add") {
      const rel = data.kinship || "child";
      const target = LINEAGE.persons.find(x => x.id === data.relatedTo);
      if (rel === "spouse") data.action = "add_spouse";
      else {
        data.action = "add_child";
        if (rel === "sibling") {
          if (!target || !target.father) {
            alert(T("f_err_sibling").replace("{name}", target ? target.name : "?"));
            return;
          }
          data.siblingOf = data.relatedTo;      // keep what was meant, for the reviewer
          data.relatedTo = target.father;
        }
      }
    }
    delete data.kinship;

    // Re-parenting: carried as moveTo / moveRel so the approval can reuse the same
    // move logic (and the same loop guard) the admin tool uses. Checked here as well as
    // on the way in, because the picker can be changed after the hint was last drawn.
    if (data.action === "edit" && data.moveEnable) {
      const problem = moveProblem(f);
      if (problem) { alert(problem); return; }
      const me = LINEAGE.persons.find(x => x.id === data.relatedTo);
      const to = LINEAGE.persons.find(x => x.id === data.moveTo);
      if (me && to) {
        const rel = data.moveRel || "child";
        const oldParent = me.father ? LINEAGE.persons.find(x => x.id === me.father) : null;
        data.moveNote = (rel === "child" ? "child of " : rel === "spouse" ? "spouse of " : "sibling of ") + to.name;
        data.changes = (data.changes || []).concat([{
          field: "moveTo", label: "Position in tree",
          from: oldParent ? "child of " + oldParent.name : (me.spouseOf ? "spouse" : "—"),
          to: data.moveNote
        }]);
      }
    } else { delete data.moveTo; delete data.moveRel; }
    delete data.moveEnable;

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

    // Capture the signed-in submitter's identity so approve/reject can email them
    // back. The insert below uses the anon key (auth.uid() is null), so submitted_by
    // never gets set — carry the email in the payload instead.
    const me = isSignedIn && window.Auth ? Auth.state().user : null;
    if (me) {
      if (me.email) data.submitterEmail = me.email;
      if (me.id) data.submitterId = me.id;
    }

    // For an edit, record exactly which fields changed (from → to) by diffing the
    // submitted values against the person snapshot the form was pre-filled with.
    // Stored as data.changes so the review page and notification email can show them.
    if (data.action === "edit" && prefillData) {
      const FIELD_LABELS = {
        name: "Name", pinyin: "Romanization", ritualName: "Ritual name",
        milkName: "Milk name", aka: "Also known as", gender: "Gender",
        gen: "Generation", living: "Living", birth: "Birth", place: "Place",
        bio: "Biography", personPhone: "Phone", personWechat: "WeChat / WhatsApp",
        personEmail: "Email"
      };
      const norm = v => (v == null ? "" : String(v).trim());
      const changes = [];
      Object.keys(FIELD_LABELS).forEach(k => {
        const before = norm(prefillData[k]), after = norm(data[k]);
        if (before !== after) changes.push({ field: k, label: FIELD_LABELS[k], from: before, to: after });
      });
      if (changes.length) data.changes = changes;
      // Emptying a field is a real edit, but the line below strips empty keys, so a
      // deliberate "delete this year" arrived looking identical to "didn't mention it"
      // and the approval quietly did nothing. Record the intent separately.
      const cleared = changes.filter(c => c.to === "" && CLEARABLE.has(c.field)).map(c => c.field);
      if (cleared.length) data.cleared = cleared;
    }

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
        // Show a floating toast (fixed, stays visible across view transition) then go back
        const banner = document.createElement("div");
        banner.className = "contrib-success";
        banner.textContent = T("f_thanks_live");
        document.body.appendChild(banner);
        prefillData = null;
        setTimeout(() => { banner.remove(); window.history.back(); }, 2200);
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
