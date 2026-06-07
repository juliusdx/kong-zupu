/* Lineage tree — top-down, generation-banded, collapsible. D3 v7. */
(function () {
  const NODE_W = 132, NODE_H = 50, H_GAP = 26, V_GAP = 110, SPOUSE_DX = 92;
  let svg, g, gLinks, gNodes, gBands, zoom;
  let opts = { daughters: true, pinyin: true };
  let collapsed = new Set();
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
    const root = svg.append("g");
    gBands = root.append("g").attr("class", "bands");
    gLinks = root.append("g");
    gNodes = root.append("g");
    g = root;
    zoom = d3.zoom().scaleExtent([0.25, 2.2]).on("zoom", e => root.attr("transform", e.transform));
    svg.call(zoom);
    update();
    setTimeout(fit, 60);
  }

  function update() {
    const hier = buildHierarchy();
    const layout = d3.tree().nodeSize([NODE_W + H_GAP, V_GAP]);
    layout(hier);
    const nodes = hier.descendants().filter(d => !d.data.__virtual);
    const links = hier.links().filter(d => !d.source.data.__virtual);

    // generation bands
    const gens = Array.from(new Set(nodes.map(d => d.data.gen))).sort((a,b)=>a-b);
    const xs = nodes.map(d => d.x), minX = Math.min(...xs) - 200, maxX = Math.max(...xs) + 200;
    const band = gBands.selectAll("g.gen-band").data(gens, d => d);
    const bandE = band.enter().append("g").attr("class", "gen-band");
    bandE.append("line"); bandE.append("text");
    bandE.merge(band).each(function (gen) {
      const y = nodes.find(d => d.data.gen === gen).y;
      d3.select(this).select("line").attr("x1", minX).attr("x2", maxX).attr("y1", y - NODE_H/2 - 14).attr("y2", y - NODE_H/2 - 14);
      d3.select(this).select("text").attr("x", minX + 6).attr("y", y - NODE_H/2 - 18).text("第 " + gen + " 世  ·  Gen " + gen);
    });
    band.exit().remove();

    // links
    const linkGen = d3.linkVertical().x(d => d.x).y(d => d.y);
    const link = gLinks.selectAll("path.link").data(links, d => d.target.data.id);
    link.enter().append("path").attr("class", "link").merge(link)
      .attr("d", d => linkGen({ source: { x: d.source.x, y: d.source.y + NODE_H/2 }, target: { x: d.target.x, y: d.target.y - NODE_H/2 } }));
    link.exit().remove();

    // nodes
    const node = gNodes.selectAll("g.node-card").data(nodes, d => d.data.id);
    const nE = node.enter().append("g").attr("class", "node-card");
    nE.append("rect").attr("class", "node-rect").attr("width", NODE_W).attr("height", NODE_H).attr("x", -NODE_W/2).attr("y", -NODE_H/2).attr("rx", 7);
    nE.append("text").attr("class", "node-name").attr("text-anchor", "middle").attr("dy", "-1");
    nE.append("text").attr("class", "node-sub").attr("text-anchor", "middle").attr("dy", "13");
    nE.append("text").attr("class", "node-gen").attr("text-anchor", "middle").attr("dy", "-19");

    const all = nE.merge(node);
    all.attr("transform", d => `translate(${d.x},${d.y})`)
      .on("click", (e, d) => { e.stopPropagation(); onSelect(d.data.id); });
    all.select("rect.node-rect")
      .attr("class", d => "node-rect " + (d.data.gender === "f" ? "female" : "male") + (d.data.confidence === "low" ? " low" : ""));
    all.select("text.node-name").text(d => d.data.name);
    all.select("text.node-sub").text(d => {
      const sp = spouseFor(d.data.id);
      let s = opts.pinyin ? (d.data.pinyin || "") : "";
      if (d.data.ritualName) s += (s ? " · " : "") + "禮名 " + d.data.ritualName;
      if (opts.daughters && sp) s += (s ? "  ⚭ " : "⚭ ") + sp.name;
      return s.length > 26 ? s.slice(0, 25) + "…" : s;
    });
    all.select("text.node-gen").text(d => d.data.relation && d.data.relation.length < 14 ? d.data.relation : "");

    // candidate flag (unresolved placeholder generations)
    all.selectAll(".cand-flag").remove();
    all.filter(d => d.data.candidates && d.data.candidates.length && !d.data._confirmed)
      .append("text").attr("class", "cand-flag").attr("x", NODE_W/2 - 13).attr("y", -NODE_H/2 + 17).text("⚑");

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
          .attr("d", `M${d.x + NODE_W/2 - 4},${d.y} L${d.x + SPOUSE_DX - 56},${d.y}`);
        m.append("rect").attr("class", "node-rect spouse").attr("width", 112).attr("height", 38).attr("x", -56).attr("y", -19).attr("rx", 6);
        m.append("text").attr("class", "node-name").attr("text-anchor", "middle").attr("dy", "-1").style("font-size","14px").text(sp.name);
        m.append("text").attr("class", "node-sub").attr("text-anchor", "middle").attr("dy", "12").text(sp.ritualName ? "禮名 " + sp.ritualName : (sp.pinyin || ""));
      });
    }
    node.exit().remove();
  }

  function toggle(id) {
    if (collapsed.has(id)) collapsed.delete(id); else collapsed.add(id);
    update();
  }
  function expandAll() { collapsed.clear(); update(); setTimeout(fit, 60); }

  function fit() {
    if (!svg) return;
    const root = svg.select("g");
    const b = root.node().getBBox();
    const W = svg.node().clientWidth, H = svg.node().clientHeight;
    const scale = Math.min(1.1, 0.92 / Math.max(b.width / W, b.height / H));
    const tx = W/2 - scale * (b.x + b.width/2);
    const ty = H/2 - scale * (b.y + b.height/2);
    svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }

  function focus(id) {
    const node = gNodes.selectAll("g.node-card").filter(d => d.data && d.data.id === id).datum();
    if (!node) return;
    const W = svg.node().clientWidth, H = svg.node().clientHeight, scale = 1.1;
    svg.transition().duration(450).call(zoom.transform,
      d3.zoomIdentity.translate(W/2 - scale*node.x, H/2 - scale*node.y).scale(scale));
  }

  function setOptions(o) { Object.assign(opts, o); update(); }

  window.Tree = { render, focus, setOptions, expandAll, fit, get: id => byId[id], spouseFor, onResize: () => { if (svg) fit(); } };
})();
