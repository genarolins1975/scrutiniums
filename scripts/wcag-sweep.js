/* Varredura WCAG 2.1 AA com axe-core sobre todas as páginas do Observatório. Cole no console do navegador com a SPA aberta.
   Preparação e servidor: node scripts/auditoria-wcag.mjs

   Por que no navegador e não no CI: contraste depende de layout renderizado,
   de color-mix resolvido e do tema aplicado. Um DOM simulado devolve "não sei"
   justamente no critério que mais reprova. O guarda determinístico que roda a
   cada commit está em src/tests/wcag-contraste.test.ts; esta varredura é a
   auditoria completa, feita sob demanda e registrada em docs/AUDITORIA_WCAG.md. */
(async () => {
  const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];
  const ESPERA_MS = 1100; // tempo de render por página

  if (!window.axe) {
    await new Promise((ok, err) => {
      const s = document.createElement("script");
      s.src = "/_axe.js"; s.onload = ok; s.onerror = () => err(new Error("axe-core não encontrado em /_axe.js — rode node scripts/auditoria-wcag.mjs"));
      document.head.appendChild(s);
    });
  }

  // as páginas dos grupos do Crédito (o índice que o servidor embute desde a Iniciativa 2 do parecer de UX de 23/10/2026, que
  // tirou a barra lateral); só o tema claro, desde que o tema escuro saiu da aplicação (decisão do dono de 23/10/2026)
  const porRota = Object.fromEntries(Object.entries(ROUTES).map(([v, r]) => [BASE + r, v]));
  const views = JSON.parse(document.getElementById("navColecaoIndice").textContent).grupos.flatMap((g) => g.paginas.map((h) => porRota[h]).filter(Boolean));
  const R = { axe: axe.version, quando: new Date().toISOString(), paginas: views.length, temas: {}, achados: [] };

  for (const tema of ["claro"]) {
    R.temas[tema] = {};
    for (const v of views) {
      nav(v);
      await new Promise((r) => setTimeout(r, ESPERA_MS));
      const res = await axe.run(document.getElementById("view-" + v) || document, { runOnly: { type: "tag", values: TAGS } });
      R.temas[tema][v] = res.violations.map((x) => `${x.id}:${x.nodes.length}`).join(" ") || "limpo";
      for (const x of res.violations) {
        for (const n of x.nodes) {
          const d = n.any?.[0]?.data;
          R.achados.push({
            tema, pagina: v, regra: x.id, impacto: x.impact,
            cor: d ? `${d.fgColor} sobre ${d.bgColor} = ${d.contrastRatio}:1 (mínimo ${d.expectedContrastRatio})` : "",
            alvo: n.target.join(" "),
          });
        }
      }
    }
  }

  const sujas = Object.entries(R.temas).flatMap(([t, p]) =>
    Object.entries(p).filter(([, v]) => v !== "limpo").map(([k, v]) => `${t}/${k}: ${v}`));
  R.resumo = sujas.length ? sujas : "nenhuma violação nas páginas varridas";
  console.log(`axe ${R.axe} · ${views.length} páginas · ${R.achados.length} nós reprovados`);
  console.table(R.achados.slice(0, 50));
  window.__wcagResultado = R;
  console.log("resultado completo em window.__wcagResultado — copy(JSON.stringify(__wcagResultado, null, 1)) para exportar");
  return R.resumo;
})();
