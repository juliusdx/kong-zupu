/* Lineage tree — top-down, generation-banded, collapsible. D3 v7. */
(function () {
  const NODE_W = 132, NODE_H = 58, H_GAP = 26, V_GAP = 112;
  const SPOUSE_W = 96, SP_GAP = 10;                 // spouse mini-card width + gap from main card
  const SPOUSE_DX = NODE_W / 2 + SP_GAP + SPOUSE_W / 2;   // spouse centre, fully right of main card
  const AV_R = 17, AV_CX = -NODE_W / 2 + 15;   // avatar radius + local x (left edge of card)
  // label fitting: usable text width with / without an avatar on the left, plus the
  // rightward shift applied to name+sub so they clear the avatar instead of overlapping it.
  const LBL_W = NODE_W - 14;       // full width, no photo
  const LBL_W_PHOTO = 84;          // narrower when an avatar occupies the left of the card
  const LBL_X_PHOTO = 16;          // shift name/sub right, past the avatar
  const HOME_DEPTH = 3;   // first-load view shows generations 1..HOME_DEPTH, deeper branches collapsed

  // Fit an SVG <text> into maxW px: first shrink the font (down to minPx) so the WHOLE
  // name stays readable, and only ellipsis-truncate if it still won't fit at the floor.
  // basePx resets the font each render so a reused element doesn't keep an earlier shrink.
  function fitText(el, full, maxW, basePx, minPx) {
    el.textContent = full || "";
    el.style.fontSize = basePx + "px";
    if (!full) return;
    let w = el.getComputedTextLength();
    if (w <= maxW) return;
    const size = Math.max(minPx, basePx * (maxW / w));   // linear first estimate
    el.style.fontSize = size + "px";
    if (el.getComputedTextLength() <= maxW) return;
    let s = full;                                         // still too wide at the floor → trim
    while (s.length > 1) {
      s = s.slice(0, -1);
      el.textContent = s.replace(/[\s·]+$/, "") + "…";
      if (el.getComputedTextLength() <= maxW) break;
    }
  }
  let svg, g, gLinks, gNodes, gBands, gSwim, zoom, ro;
  let opts = { daughters: true, pinyin: true, swim: true, photos: true };
  let collapsed = new Set();
  let firstRender = true;   // seed the legible "home" view only on the very first paint
  let onSelect = () => {};

  const byId = {};
  function index() {
    LINEAGE.persons.forEach(p => (byId[p.id] = p));
  }

  // spouses are persons with spouseOf; blood members are the rest
  function bloodMembers() {
    return LINEAGE.persons.filter(p => !p.spouseOf);
  }
  function spouseFor(id) {
    return LINEAGE.persons.find(p => p.spouseOf === id);
  }
  // collapse every blood node deeper than HOME_DEPTH so the opening view is a
  // legible 始祖 → Gen 3 tree the user can read and expand downward at will
  function seedHomeCollapse() {
    collapsed.clear();
    bloodMembers().forEach(p => { if ((p.gen | 0) >= HOME_DEPTH) collapsed.add(p.id); });
  }
  // pull a 4-digit year out of a (possibly Chinese-era) date string; "" if none
  function yr(s) { const m = s && String(s).match(/\d{4}/); return m ? m[0] : null; }
  function yearStr(p) {
    const b = yr(p.birthYear), d = yr(p.deathYear);
    if (b && d) return b + "–" + d;
    if (b) return "b." + b;
    if (d) return "d." + d;
    return "";
  }
  // top-of-card label: translate pure generation strings (二十一世 / 二十世祖) to
  // "Gen N" in English; leave birth-order/role relations (五子, 長女, 始祖) as-is.
  const GEN_STR = /^[〇零一二三四五六七八九十廿卅百]+世祖?$/;
  function relLabel(p) {
    const rel = p.relation;
    if (rel && GEN_STR.test(rel.trim())) {
      const en = window.I18N && I18N.getLang && I18N.getLang() === "en";
      return en ? ("Gen " + (p.gen != null ? p.gen : "")) : rel;
    }
    return (rel && rel.length < 14) ? rel : "";
  }

  function buildHierarchy() {
    let members = bloodMembers();
    if (!opts.daughters) {
      // hide blood daughters (and any descendants — none here)
      members = members.filter(p => p.gender !== "f");
    }
    const childrenOf = {};
    members.forEach(p => {
      if (p.father && byId[p.father] && !p.spouseOf) {
        (childrenOf[p.father] = childrenOf[p.father] || []).push(p);
      }
    });
    members.forEach(p => p.__kids = (childrenOf[p.id] || []).sort((a,b)=>a.gen-b.gen));
    const roots = members.filter(p => !p.father || !byId[p.father]);
    const virtual = { id: "__root__", name: "江氏", gen: 20, __kids: roots, __virtual: true };
    return d3.hierarchy(virtual, d => (collapsed.has(d.id) ? null : d.__kids));
  }

  function render(containerSel, selectHandler) {
    onSelect = selectHandler || onSelect;
    index();
    const el = document.querySelector(containerSel);
    el.innerHTML = "";
    const W = el.clientWidth, H = el.clientHeight;
    svg = d3.select(el).append("svg").attr("width", W).attr("height", H);
    // one circular clip reused by every node avatar (all share local node coords)
    svg.append("defs").append("clipPath").attr("id", "avatarClip")
      .append("circle").attr("cx", AV_CX).attr("cy", 0).attr("r", AV_R);
    const root = svg.append("g");
    gSwim = root.append("g").attr("class", "swim");   // behind everything
    gBands = root.append("g").attr("class", "bands");
    gLinks = root.append("g");
    gNodes = root.append("g");
    g = root;
    zoom = d3.zoom().scaleExtent([0.25, 2.2]).on("zoom", e => root.attr("transform", e.transform));
    svg.call(zoom);
    // self-heal: if the canvas was laid out at 0×0 on first paint, fit() bails; refit
    // the moment it gains a real size so the tree always appears
    if (ro) ro.disconnect();
    if (window.ResizeObserver) {
      ro = new ResizeObserver(() => {
        if (el.clientWidth && el.clientHeight && (+svg.attr("width") === 0 || +svg.attr("height") === 0)) fit();
      });
      ro.observe(el);
    }
    if (firstRender) { seedHomeCollapse(); firstRender = false; }
    update();
    setTimeout(fit, 60);
  }

  function update() {
    const hier = buildHierarchy();
    const layout = d3.tree().nodeSize([NODE_W + H_GAP, V_GAP])
      // reserve extra width to the right of a node only when it has a (shown) spouse,
      // so couples don't overlap the next card while childless/spouseless nodes stay tight
      .separation((a, b) => {
        // d3 may pass either node as `a`, so reserve the extra column if EITHER of the
        // adjacent nodes carries a spouse card (which extends into the gap between them).
        const base = a.parent === b.parent ? 1 : 1.4;
        const sp = n => opts.daughters && n && n.data && n.data.id && spouseFor(n.data.id);
        return base + (sp(a) || sp(b) ? 0.6 : 0);
      });
    layout(hier);
    const nodes = hier.descendants().filter(d => !d.data.__virtual);
    const links = hier.links().filter(d => !d.source.data.__virtual);

    // Re-row every node onto its generation band. d3.tree positions by DEPTH, so a
    // separate-root branch (e.g. 永宏's Sabah line at gen 24) would otherwise land in the
    // top row and pile its band label + era lane on top of gen 1's. Snapping y to a compact
    // per-generation index keeps each 世 on its own line and the labels/lanes aligned.
    const gens = Array.from(new Set(nodes.map(d => d.data.gen))).filter(g => g != null).sort((a,b)=>a-b);
    const genY = {}; gens.forEach((g, i) => { genY[g] = i * V_GAP; });
    // nodes with a known gen snap to their row; gen-less nodes keep their depth-based y.
    nodes.forEach(d => { if (genY[d.data.gen] != null) d.y = genY[d.data.gen]; });

    // generation bands
    const xs = nodes.map(d => d.x), minX = Math.min(...xs) - 200, maxX = Math.max(...xs) + 200;
    const band = gBands.selectAll("g.gen-band").data(gens, d => d);
    const bandE = band.enter().append("g").attr("class", "gen-band");
    bandE.append("line"); bandE.append("text");
    bandE.merge(band).each(function (gen) {
      const y = genY[gen];
      d3.select(this).select("line").attr("x1", minX).attr("x2", maxX).attr("y1", y - NODE_H/2 - 14).attr("y2", y - NODE_H/2 - 14);
      d3.select(this).select("text").attr("x", minX + 6).attr("y", y - NODE_H/2 - 18).text("第 " + gen + " 世  ·  Gen " + gen);
    });
    band.exit().remove();

    // swim lanes — location + era bands behind everything
    gSwim.selectAll("*").remove();
    if (opts.swim && Array.isArray(LINEAGE.eras)) {
      const lang = (window.I18N && I18N.getLang) ? I18N.getLang() : "en";
      const laneLeft = minX - 300;
      LINEAGE.eras.forEach(e => {
        const ns = nodes.filter(d => d.data.gen >= e.fromGen && d.data.gen <= e.toGen);
        if (!ns.length) return;
        const ys = ns.map(d => d.y);
        const top = Math.min(...ys) - NODE_H / 2 - 26;
        const bot = Math.max(...ys) + NODE_H / 2 + 16;
        gSwim.append("rect").attr("class", "swim-lane")
          .attr("x", laneLeft).attr("y", top)
          .attr("width", maxX - laneLeft).attr("height", bot - top)
          .attr("fill", e.color || "#00000010");
        const place = lang === "zh" ? (e.place || e.placeEn) : (e.placeEn || e.place);
        const era   = lang === "zh" ? (e.era   || e.eraEn)   : (e.eraEn   || e.era);
        const cy = (top + bot) / 2;
        const label = gSwim.append("text").attr("class", "swim-label").attr("y", cy - 4);
        label.append("tspan").attr("class", "swim-place").attr("x", laneLeft + 14).text(place);
        label.append("tspan").attr("class", "swim-era").attr("x", laneLeft + 14).attr("dy", "1.45em").text(era);
      });
    }

    // links
    const linkGen = d3.linkVertical().x(d => d.x).y(d => d.y);
    const link = gLinks.selectAll("path.link").data(links, d => (d && d.target) ? d.target.data.id : null);
    link.enter().append("path").attr("class", "link").merge(link)
      .attr("d", d => linkGen({ source: { x: d.source.x, y: d.source.y + NODE_H/2 }, target: { x: d.target.x, y: d.target.y - NODE_H/2 } }));
    link.exit().remove();

    // nodes
    const node = gNodes.selectAll("g.node-card").data(nodes, d => d.data.id);
    const nE = node.enter().append("g").attr("class", "node-card");
    nE.append("rect").attr("class", "node-rect").attr("width", NODE_W).attr("height", NODE_H).attr("x", -NODE_W/2).attr("y", -NODE_H/2).attr("rx", 7);
    nE.append("text").attr("class", "node-name").attr("text-anchor", "middle").attr("dy", "-2");
    nE.append("text").attr("class", "node-sub").attr("text-anchor", "middle").attr("dy", "11");
    nE.append("text").attr("class", "node-gen").attr("text-anchor", "middle").attr("dy", "-19");
    nE.append("text").attr("class", "node-years").attr("text-anchor", "middle").attr("dy", "21");

    const all = nE.merge(node);
    all.attr("transform", d => `translate(${d.x},${d.y})`)
      .on("click", (e, d) => { e.stopPropagation(); onSelect(d.data.id); });
    all.select("rect.node-rect")
      .attr("class", d => "node-rect " + (d.data.gender === "f" ? "female" : "male") + (d.data.confidence === "low" ? " low" : ""));
    const fs = fontScale();   // bump label sizes on phones so cards stay legible
    all.select("text.node-name").each(function (d) {
      const photo = opts.photos && d.data.photo;
      d3.select(this).attr("x", photo ? LBL_X_PHOTO : 0);
      fitText(this, d.data.name, photo ? LBL_W_PHOTO : LBL_W, 17 * fs, 9.5);
    });
    all.select("text.node-sub").each(function (d) {
      let s = opts.pinyin ? (d.data.pinyin || "") : "";
      if (d.data.ritualName) s += (s ? " · " : "") + "禮名 " + d.data.ritualName;
      const photo = opts.photos && d.data.photo;   // spouse shown on its own card, not here
      d3.select(this).attr("x", photo ? LBL_X_PHOTO : 0);
      fitText(this, s, photo ? LBL_W_PHOTO : LBL_W, 10 * fs, 8);
    });
    all.select("text.node-gen").each(function (d) { fitText(this, relLabel(d.data), LBL_W, 9 * fs, 7); });
    all.select("text.node-years").each(function (d) { fitText(this, yearStr(d.data), LBL_W, 9 * fs, 7); });

    // candidate flag (unresolved placeholder generations)
    all.selectAll(".cand-flag").remove();
    all.filter(d => d.data.candidates && d.data.candidates.length && !d.data._confirmed)
      .append("text").attr("class", "cand-flag").attr("x", NODE_W/2 - 13).attr("y", -NODE_H/2 + 17).text("⚑");

    // 1825 合譜 generation-numbering seam marker (top-left ※)
    all.selectAll(".seam-flag").remove();
    all.filter(d => d.data.seam).each(function () {
      d3.select(this).append("text").attr("class", "seam-flag")
        .attr("x", -NODE_W / 2 + 11).attr("y", -NODE_H / 2 + 15).text("※")
        .append("title").text(window.I18N ? I18N.t("seam_tip") : "seam");
    });

    // node photo avatars — only nodes that have a main photo
    all.selectAll(".node-photo,.photo-ring,.cam-badge").remove();
    if (opts.photos) {
      const wp = all.filter(d => d.data.photo);
      wp.append("image").attr("class", d => "node-photo " + (d.data.living ? "living" : "deceased"))
        .attr("href", d => d.data.photo).attr("xlink:href", d => d.data.photo)
        .attr("x", AV_CX - AV_R).attr("y", -AV_R).attr("width", AV_R * 2).attr("height", AV_R * 2)
        .attr("clip-path", "url(#avatarClip)").attr("preserveAspectRatio", "xMidYMid slice")
        .on("click", (e, d) => { e.stopPropagation(); onSelect(d.data.id); });
      wp.append("circle").attr("class", d => "photo-ring" + (d.data.living ? " living" : ""))
        .attr("cx", AV_CX).attr("cy", 0).attr("r", AV_R);
      wp.append("text").attr("class", "cam-badge").attr("x", AV_CX + AV_R - 4).attr("y", AV_R - 1).text("📷");
    }

    // collapse badges
    all.selectAll(".collapse-badge,.collapse-badge-txt").remove();
    all.filter(d => (d.data.__kids && d.data.__kids.length)).each(function (d) {
      const grp = d3.select(this);
      grp.append("circle").attr("class", "collapse-badge").attr("r", 9).attr("cx", 0).attr("cy", NODE_H/2 + 2)
        .on("click", (e) => { e.stopPropagation(); toggle(d.data.id); });
      grp.append("text").attr("class", "collapse-badge-txt").attr("x", 0).attr("y", NODE_H/2 + 6)
        .text(collapsed.has(d.data.id) ? "+" + d.data.__kids.length : "–")
        .on("click", (e) => { e.stopPropagation(); toggle(d.data.id); });
    });

    // spouse mini-cards
    gNodes.selectAll("g.spouse-mini").remove();
    if (opts.daughters) {
      nodes.forEach(d => {
        const sp = spouseFor(d.data.id);
        if (!sp) return;
        const m = gNodes.append("g").attr("class", "spouse-mini").attr("transform", `translate(${d.x + SPOUSE_DX},${d.y})`)
          .style("cursor", "pointer").on("click", e => { e.stopPropagation(); onSelect(sp.id); });
        gLinks.append("path").attr("class", "link").attr("style", "stroke-dasharray:4 3")
          .attr("d", `M${d.x + NODE_W/2},${d.y} L${d.x + SPOUSE_DX - SPOUSE_W/2},${d.y}`);
        m.append("rect").attr("class", "node-rect spouse").attr("width", SPOUSE_W).attr("height", 38).attr("x", -SPOUSE_W/2).attr("y", -19).attr("rx", 6);
        const spName = m.append("text").attr("class", "node-name").attr("text-anchor", "middle").attr("dy", "-1");
        fitText(spName.node(), sp.name, SPOUSE_W - 12, 14 * fs, 9);
        const ss = sp.ritualName ? "禮名 " + sp.ritualName : (sp.pinyin || "");
        const spSub = m.append("text").attr("class", "node-sub").attr("text-anchor", "middle").attr("dy", "12");
        fitText(spSub.node(), ss, SPOUSE_W - 12, 10 * fs, 8);
      });
    }
    node.exit().remove();
  }

  function toggle(id) {
    if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
    update();
  }
  function expandAll() { collapsed.clear(); update(); setTimeout(fit, 60); }
  // reset to the legible opening view (始祖 → Gen 3), re-centred
  function home() { seedHomeCollapse(); update(); setTimeout(fit, 60); }

  // live container size — the svg's own width/height attributes can be frozen at 0
  // if the first render happened before #tree-canvas was laid out (slow load / hidden
  // tab); always measure the parent so fit/focus can self-heal once it gains a size.
  function dims() {
    const el = svg && svg.node().parentNode;
    return el ? { W: el.clientWidth, H: el.clientHeight } : { W: 0, H: 0 };
  }
  // enlarge node labels on phone-width canvases so cards stay readable at the zoom floor
  function fontScale() { const W = dims().W; return (W && W < 640) ? 1.22 : 1; }

  function fit() {
    if (!svg) return;
    const { W, H } = dims();
    if (!W || !H) return;                       // container not laid out yet — skip
    svg.attr("width", W).attr("height", H);     // keep svg sized to its container
    const root = svg.select("g");
    const b = root.node().getBBox();
    let scale = Math.min(1.1, 0.92 / Math.max(b.width / W, b.height / H));
    let tx, ty;
    if (W < 640) {
      // Phone: the tree is often very tall (the Sabah branch sits at gen 24), so a true
      // fit-all shrinks the cards to specks. Keep them legible with a readable floor and
      // anchor the top of the tree just under the toolbar — the reader pans to explore.
      scale = Math.max(scale, 0.7);
      tx = W / 2 - scale * (b.x + b.width / 2);
      ty = 26 - scale * b.y;
    } else {
      tx = W / 2 - scale * (b.x + b.width / 2);
      ty = H / 2 - scale * (b.y + b.height / 2);
    }
    svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }

  function focus(id) {
    // A searched person may sit inside a COLLAPSED branch (or be a married-in spouse, which
    // isn't its own tree node). Expand every ancestor so the target is actually rendered,
    // then zoom to it and flash it. Previously this bailed silently when the node was hidden,
    // so search only opened the drawer without moving the tree.
    const p0 = byId[id]; if (!p0) return;
    const targetId = p0.spouseOf || id;          // center the blood partner for a spouse
    let changed = false, cur = byId[targetId]; const guard = new Set();
    while (cur && !guard.has(cur.id)) {
      guard.add(cur.id);
      const par = cur.father ? byId[cur.father] : null;
      if (par && collapsed.has(par.id)) { collapsed.delete(par.id); changed = true; }
      cur = par;
    }
    if (changed) update();
    const sel = gNodes.selectAll("g.node-card").filter(d => d.data && d.data.id === targetId);
    if (sel.empty()) return;
    const node = sel.datum();
    sel.classed("focus-flash", true);                       // highlight even if the zoom is skipped
    setTimeout(() => sel.classed("focus-flash", false), 1800);
    const { W, H } = dims(), scale = 1.3;   // zoom in on the searched node
    if (!W || !H) return;
    svg.attr("width", W).attr("height", H);
    svg.transition().duration(450).call(zoom.transform,
      d3.zoomIdentity.translate(W/2 - scale*node.x, H/2 - scale*node.y).scale(scale));
  }

  function setOptions(o) { Object.assign(opts, o); update(); }

  window.Tree = { render, focus, setOptions, expandAll, home, fit, get: id => byId[id], spouseFor, onResize: () => { if (svg) fit(); } };
})();
