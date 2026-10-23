// Piso de 12 px (Iniciativa 5 do parecer docs/PARECER_UX_2026-10-21.md): conta os elementos visíveis com texto próprio e corpo
// calculado abaixo de 12 px, o mesmo critério de scripts/ux-medidas.mjs (seção 5 do parecer). Usada por scripts/ux-texto-minimo.mjs
// e por src/tests/ux-texto-minimo.test.ts, para os dois medirem a mesma coisa. Roda dentro da página (page.evaluate).
// Texto de SVG conta pelo font-size calculado, como na medida do parecer; a escala do viewBox fica de fora (um rótulo de 12 unidades
// num gráfico reduzido no celular aparece menor), registrada como pendência da Iniciativa 10.

export const PISO_PX = 12;

export function medirTextoMinimo() {
  const pequenos = [];
  for (const e of document.querySelectorAll("body *")) {
    const temTexto = Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim());
    if (!temTexto) continue;
    const cs = getComputedStyle(e);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const px = parseFloat(cs.fontSize);
    if (px < 12) { // PISO_PX: a função roda serializada na página, sem acesso ao módulo
      pequenos.push({
        tag: e.tagName.toLowerCase(),
        px: Math.round(px * 100) / 100,
        classe: (typeof e.className === "string" ? e.className : e.getAttribute("class") || "").slice(0, 120),
        texto: e.textContent.trim().slice(0, 60),
      });
    }
  }
  return { total: pequenos.length, pequenos };
}
