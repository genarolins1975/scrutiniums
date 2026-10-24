import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
it("contornos territoriais são extração exata das 27 UFs do Pix, no mesmo sistema municipal",()=>{
 const geo=JSON.parse(readFileSync("public/obs/data/gold/pix.json","utf8")).geografia.geo;
 const malha=JSON.parse(readFileSync("public/obs/data/gold/penetracao_malha.json","utf8"));
 const arquivo=readFileSync("public/obs/geo/uf.json","utf8");
 expect(arquivo).toBe(JSON.stringify({viewBox:geo.viewBox,transform:geo.transform,paths:geo.paths}));
 expect(Object.keys(geo.paths)).toHaveLength(27);
 expect(geo.transform).toBe(malha.transform);
});
