/* Ancestral + diaspora map. MapLibre GL + free OSM raster tiles. */
(function () {
  let map, built = false, markers = [];
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
    map.on("load", () => { drawMigration(); drawPins(); fit(); });
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
      const elc = document.createElement("div");
      elc.style.cssText = `width:16px;height:16px;border-radius:50%;border:2px solid #fff;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.4);background:${COLORS[pl.type]||"#555"}`;
      elc.dataset.group = pl.type;
      const who = LINEAGE.persons.filter(pp => [pp.birthPlace,pp.burialPlace,pp.residencePlace].includes(pl.id));
      const html = `<div class="map-pin"><h4>${pl.name}</h4>
        <div>${pl.nameEn||""}</div>
        ${pl.approximate?'<div class="approx">⚠ approx. location — needs exact GPS</div>':""}
        ${pl.note?`<div style="margin-top:.4rem">${pl.note}</div>`:""}
        ${who.length?`<div style="margin-top:.4rem;font-size:.72rem">Linked: ${who.map(w=>w.name).join("、")}</div>`:""}
      </div>`;
      const m = new maplibregl.Marker({ element: elc })
        .setLngLat([pl.lng, pl.lat])
        .setPopup(new maplibregl.Popup({ offset: 14 }).setHTML(html))
        .addTo(map);
      markers.push({ marker: m, group: pl.type, el: elc });
    });
  }

  function setLayer(group, visible) {
    markers.filter(m => m.group === group).forEach(m => m.el.style.display = visible ? "" : "none");
  }
  function fit() {
    const b = new maplibregl.LngLatBounds();
    LINEAGE.places.forEach(p => b.extend([p.lng, p.lat]));
    map.fitBounds(b, { padding: 60, duration: 0 });
  }

  window.MapView = { init, setLayer };
})();
