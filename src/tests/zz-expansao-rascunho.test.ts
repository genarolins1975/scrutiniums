import { it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { writeFileSync } from "node:fs";
import Carteira from "@/app/setor-eletrico/expansao/carteira/page";

it("rascunho", () => {
  const h = renderToStaticMarkup(createElement(Carteira));
  writeFileSync("/tmp/claude-0/-home-user-scrutiniums/6fdae433-d74d-5746-adf7-de211726c886/scratchpad/carteira.html", h);
  console.log("tamanho", h.length);
});
