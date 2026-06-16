/* Ancestral + diaspora map. MapLibre GL + free OSM raster tiles. */
(function () {
  let map, built = false, ready = false, markers = [];
  const layerVisible = {};   // group -> bool; undefined means visible. Persists across redraws.
  const COLORS = { origin:"#9e2b25", grave:"#5b3a1a", church_grave:"#b08833", diaspora:"#2d6b4f", residence:"#3d6b8e", hall:"#7a4fa3" };

  function init() {
    if (built) { map.resize(); return; }
    built = true;
    map = new maplibregl.Map({
      container: "map-canvas",
      style: {
        version: 8,
        sources: { osm: { type:"raster", tiles:["https://a.tile.openstreetmap.org/{z}/{x}/{y}.png","https://b.tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize:256, attribution:"© OpenStreetMap contributors" } },
        layers: [{ id:"osm", type:"raster", source:"osm" }]
      },
      center: [113, 15], zoom: 3.2
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    // Draw on first ready. Listen to BOTH load and idle so a slow/blocked tile
    // server (e.g. behind the Great Firewall) can't stop pins from appearing —
    // the inline style loads regardless of tiles.
    const onReady = () => { if (ready) return; ready = true; drawMigration(); drawPins(); fit(); };
    map.on("load", onReady);
    map.once("idle", onReady);
  }

  function drawMigration() {
    const P = id => LINEAGE.places.find(p => p.id === id);
    const feats = [];
    const seg = (a, b) => { const x = P(a), y = P(b); if (x && y) feats.push({ type:"Feature", geometry:{ type:"LineString", coordinates: arc([x.lng,x.lat],[y.lng,y.lat]) } }); };
    // historical mainland migration, in order
    ["p_ninghua","p_shanghang","p_yongding","p_yongan","p_changle","p_lilang"]
      .forEach((id, i, arr) => { if (i) seg(arr[i-1], id); });
    // 長樂 → Sabah diaspora
    ["p_kudat","p_sandakan","p_papar"].forEach(d => seg("p_changle", d));
    map.addSource("mig", { type:"geojson", data:{ type:"FeatureCollection", features:feats } });
    map.addLayer({ id:"mig", type:"line", source:"mig",
      paint:{ "line-color":"#9e2b25", "line-width":1.6, "line-dasharray":[2,2], "line-opacity":0.5 } });
  }
  // simple great-circle-ish arc
  function arc(p1, p2, n=48) {
    const out=[]; for(let i=0;i<=n;i++){ const t=i/n;
      const lng=p1[0]+(p2[0]-p1[0])*t, lat=p1[1]+(p2[1]-p1[1])*t;
      const lift=Math.sin(Math.PI*t)*6; out.push([lng,lat+lift]); }
    return out;
  }

  function drawPins() {
    LINEAGE.places.forEach(pl => {
      if (typeof pl.lng !== "number" || typeof pl.lat !== "number" || isNaN(pl.lng) || isNaN(pl.lat)) return;
      const elc = document.createElement("div");
      elc.style.cssText = `width:16px;height:16px;border-radius:50%;border:2px solid #fff;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.4);background:${COLORS[pl.type]||"#555"}`;
      elc.dataset.group = pl.type;
      if (layerVisible[pl.type] === false) elc.style.display = "none";   // keep filter state across redraws
      const who = LINEAGE.persons.filter(pp => [pp.birthPlace,pp.burialPlace,pp.residencePlace].includes(pl.id));
      const T = k => (window.I18N ? I18N.t(k) : k);
      const html = `<div class="map-pin"><h4>${pl.name}</h4>
        <div>${pl.nameEn||""}</div>
        ${pl.modern?`<div style="font-size:.72rem;color:#7a6a4e">${T("pl_modern")}: ${pl.modern}</div>`:""}
        ${pl.approximate?`<div class="approx">⚠ ${T("pl_approx_warn")}</div>`:""}
        ${who.length?`<div style="margin-top:.4rem;font-size:.72rem">${T("pl_linked")}: ${who.map(w=>w.name).join("、")}</div>`:""}
        <div style="margin-top:.5rem"><a class="pin-details" data-place="${pl.id}" style="color:#3d6b8e;cursor:pointer;font-size:.78rem">${T("m_details")}</a></div>
      </div>`;
      const popup = new maplibregl.Popup({ offset: 14 }).setHTML(html);
      // The "Details & photos" link carries data-place; app.js's global handler
      // opens the place drawer. We just dismiss the popup behind it.
      popup.on("open", () => {
        const a = popup.getElement().querySelector(".pin-details");
        if (a) a.addEventListener("click", () => popup.remove());
      });
      const m = new maplibregl.Marker({ element: elc })
        .setLngLat([pl.lng, pl.lat])
        .setPopup(popup)
        .addTo(map);
      markers.push({ marker: m, group: pl.type, el: elc });
    });
  }

  function setLayer(group, visible) {
    layerVisible[group] = visible;
    markers.filter(m => m.group === group).forEach(m => m.el.style.display = visible ? "" : "none");
  }
  function clearPins() { markers.forEach(m => m.marker.remove()); markers = []; }
  function refresh() {            // redraw pins after live data merges new places
    if (!built) return;
    clearPins(); drawPins(); fit();
  }
  function relabel() {            // rebuild popups in the current language (no refit)
    if (!built || !markers.length) return;
    clearPins(); drawPins();
  }
  function fit() {
    const b = new maplibregl.LngLatBounds();
    LINEAGE.places.forEach(p => {
      if (typeof p.lng === "number" && typeof p.lat === "number" && !isNaN(p.lng) && !isNaN(p.lat)) {
        b.extend([p.lng, p.lat]);
      }
    });
    if (!b.isEmpty()) map.fitBounds(b, { padding: 60, duration: 0 });
  }

  // Free OSM (Nominatim) forward-geocoding for the picker's address search. Light use
  // only; the browser sends a Referer which satisfies the usage policy for this volume.
  async function geocode(q) {
    const lang = (window.I18N && I18N.getLang) ? I18N.getLang() : "en";
    const url = "https://nominatim.openstreetmap.org/search?format=json&limit=6&q=" + encodeURIComponent(q);
    const res = await fetch(url, { headers: { "Accept-Language": lang === "zh" ? "zh,en" : "en" } });
    if (!res.ok) return [];
    return res.json();   // [{ lat, lon, display_name }, …]
  }

  /* Interactive pin picker: search an address, then click/drag a marker to set an exact
     GPS for `place`. Resolves to {lat,lng} on save, or null on cancel. Shared by the
     place-correction flow and the contribution form's "Pick on map". */
  function pickLocation(place) {
    const T = k => (window.I18N ? I18N.t(k) : k);
    return new Promise(resolve => {
      init();
      const start = () => {
        // clear any stray banner from a prior, abandoned pick
        document.querySelectorAll(".pick-banner").forEach(b => b.remove());
        if (typeof place.lng === "number" && typeof place.lat === "number" && !isNaN(place.lng)) {
          map.flyTo({ center: [place.lng, place.lat], zoom: Math.max(map.getZoom(), 11) });
        }
        map.getCanvas().style.cursor = "crosshair";
        let marker = null;

        const banner = document.createElement("div");
        banner.className = "pick-banner";
        banner.innerHTML =
          `<div class="pick-msg"><span>${T("pick_hint")} <b>${place.name}</b></span>` +
          `<span class="pick-sub">${T("pick_drag")}</span></div>` +
          `<div class="pick-search">` +
          `<input class="pick-search-input" type="search" placeholder="${T("pick_search")}" />` +
          `<div class="pick-results" hidden></div></div>` +
          `<div class="pick-btns">` +
          `<button class="pick-save" disabled>${T("pick_save")}</button>` +
          `<button class="pick-cancel">${T("pick_cancel")}</button></div>`;
        document.getElementById("map-canvas").appendChild(banner);
        const saveBtn = banner.querySelector(".pick-save");

        // drop (or move) the draggable marker and enable Save
        const placeMarker = (lng, lat, fly) => {
          if (!marker) {
            const el = document.createElement("div");
            el.className = "pick-marker";
            marker = new maplibregl.Marker({ element: el, draggable: true, anchor: "bottom" })
              .setLngLat([lng, lat]).addTo(map);
          } else marker.setLngLat([lng, lat]);
          saveBtn.disabled = false;
          if (fly) map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 13) });
        };

        const onClick = e => placeMarker(e.lngLat.lng, e.lngLat.lat, false);
        map.on("click", onClick);

        // address search → results dropdown → pick one to fly + drop the marker
        const input = banner.querySelector(".pick-search-input");
        const results = banner.querySelector(".pick-results");
        let seq = 0, timer = null;
        const runSearch = async () => {
          const q = input.value.trim();
          if (q.length < 3) { results.hidden = true; results.innerHTML = ""; return; }
          const mine = ++seq;
          results.hidden = false;
          results.innerHTML = `<div class="pick-result muted">${T("pick_searching")}</div>`;
          let hits = [];
          try { hits = await geocode(q); } catch (_) { /* offline / blocked → no results */ }
          if (mine !== seq) return;   // a newer keystroke superseded this one
          if (!hits.length) { results.innerHTML = `<div class="pick-result muted">${T("pick_noresults")}</div>`; return; }
          results.innerHTML = hits.map((h, i) =>
            `<button type="button" class="pick-result" data-i="${i}">${h.display_name}</button>`).join("");
          results.querySelectorAll(".pick-result[data-i]").forEach(b => b.onclick = () => {
            const h = hits[+b.dataset.i];
            placeMarker(parseFloat(h.lon), parseFloat(h.lat), true);
            results.hidden = true; input.value = h.display_name.split(",")[0];
          });
        };
        input.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(runSearch, 450); });
        input.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); clearTimeout(timer); runSearch(); } });

        const cleanup = () => {
          map.off("click", onClick);
          clearTimeout(timer);
          map.getCanvas().style.cursor = "";
          if (marker) marker.remove();
          banner.remove();
        };
        saveBtn.onclick = () => { const ll = marker.getLngLat(); cleanup(); resolve({ lat: ll.lat, lng: ll.lng }); };
        banner.querySelector(".pick-cancel").onclick = () => { cleanup(); resolve(null); };
      };
      // start() only flies/drops a marker/listens for clicks — none of which need
      // the style fully loaded — so run it as soon as the map object exists.
      start();
    });
  }

  window.MapView = { init, setLayer, refresh, relabel, pickLocation };
})();
