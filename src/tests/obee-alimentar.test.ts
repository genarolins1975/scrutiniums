import { describe,it,expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { dadosAlimentares } from "@/lib/eficiencia/alimentar/dados";
import { CESTA,normaliza,escoreCapitulo,escoreAgregado } from "@/lib/eficiencia/escores/calculo";
const g=dadosAlimentares();
describe("Segurança alimentar: dados rastreáveis",()=>{
 it("PNADC mantém os valores publicados e não cria estimativas municipais",()=>{expect(g.needs).toHaveLength(12);expect(g.needs.find(r=>r.territory==="Brasil"&&r.year===2024)?.insecure).toBe(24.2);expect(g.needs.find(r=>r.territory==="Nordeste"&&r.year===2024)?.severe).toBe(4.8);expect(new Set(g.needs.map(r=>r.territory)).size).toBe(6)});
 it("todos os 5570 municípios e 55700 registros se conciliam com o CSV completo",()=>{let total=0;for(const uf of g.ufs){const rows=JSON.parse(readFileSync(join(process.cwd(),`public/eficiencia/seguranca-alimentar/uf-${uf}.json`),"utf8")) as {code:string;values:Record<string,{raw:unknown;status:string}>}[];total+=rows.length;for(const r of rows){expect(Object.keys(r.values)).toHaveLength(10);for(const v of Object.values(r.values)){if(v.raw===null||v.raw==="-")expect(v.status).not.toBe("OBSERVADO")}}}expect(total).toBe(5570);expect(readFileSync(join(process.cwd(),"public/eficiencia/seguranca-alimentar/municipios.csv"),"utf8").trim().split("\n")).toHaveLength(55701)});
 it("seed íntegro, quinze fichas completas e nenhuma variável contextual pontua",()=>{const seed=readFileSync(join(process.cwd(),"pipeline/eficiencia_alimentar/seed/recorte_ibge.json.gz"));expect(createHash("sha256").update(seed).digest("hex")).toBe(g.manifest.seed_sha256);expect(g.catalog).toHaveLength(15);for(const f of g.catalog){expect(f.papel_escore).toContain("não pontua");expect(f.peso).toBeNull();expect(f.registro).toBeTruthy();expect(f.universo).toBeTruthy();expect(f.periodo).toBeTruthy()}});
});
describe("Escores: bloqueios e agregação",()=>{
 const contexto={territorio:"2611606",periodo:"2024",edicao:"v3"};
 it("referência não validada e falta de pilar bloqueiam; zero válido continua zero",()=>{expect(normaliza(80,{validada:false,inferior:0,superior:100,sentido:"maior"})).toBeNull();expect(escoreCapitulo({acesso:80,resposta:null,qualidade:80},true).valor).toBeNull();expect(escoreCapitulo({acesso:0,resposta:100,qualidade:100},true).valor).toBe(0);expect(escoreCapitulo({acesso:80,resposta:80,qualidade:80},false).estado).toBe("REFERENCIA_PENDENTE");expect(()=>escoreCapitulo({acesso:101,resposta:80,qualidade:80},true)).toThrow()});
 it("a cesta não redistribui peso e bloqueia território/período incompatíveis",()=>{const cap=Object.fromEntries(CESTA.map(id=>[id,escoreCapitulo({acesso:80,resposta:80,qualidade:80},true,contexto)]));expect(escoreAgregado(cap,"v3",true).valor).toBeCloseTo(80);cap.food={valor:null,estado:"COBERTURA_INSUFICIENTE"};expect(escoreAgregado(cap,"v3",true).valor).toBeNull();cap.food=escoreCapitulo({acesso:80,resposta:80,qualidade:80},true,{...contexto,periodo:"2023"});expect(escoreAgregado(cap,"v3",true).estado).toBe("RECORTE_INCOMPATIVEL")});
});
