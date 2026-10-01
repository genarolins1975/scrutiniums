import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import PaginaNivel from "@/app/setor-eletrico/carga/page";
import PaginaPerfil from "@/app/setor-eletrico/carga/perfil-horario/page";
import PaginaClima from "@/app/setor-eletrico/carga/clima-e-calendario/page";

const S = "/tmp/claude-0/-home-user-scrutiniums/6fdae433-d74d-5746-adf7-de211726c886/scratchpad/";
describe("smoke", () => {
  it("renderiza", () => {
    for (const [n, P] of [["p025", PaginaNivel], ["p026", PaginaPerfil], ["p027", PaginaClima]] as const) {
      const h = renderToStaticMarkup(createElement(P));
      writeFileSync(`${S}${n}.html`, h);
      console.log(n, h.length);
      expect(h).toContain(`id="${n}"`);
    }
  });
});
