/**
 * Segurança alimentar, "Quem passa fome no Brasil?": recortes sociais nacionais da EBIA (IBGE, tabelas SIDRA 9553 a
 * 9562; follow-up do PR #325). Confere que a gold é do seed com hash fixado, que a página mostra o percentual publicado
 * (não um recálculo) com fonte, número da tabela, período e data de captura, que a orientação de cada percentual é
 * respeitada, que ausência é escrita e não vira zero, que a estimativa com CV alto é marcada, que nenhuma diferença é
 * chamada de significativa e que a seção fica no painel com conta (o aperitivo só a anuncia).
 */
import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { dadosComplementares, type Complementos } from "@/lib/eficiencia/alimentar/complementos";
import { QuemPassaFome } from "@/components/eficiencia/alimentar/QuemPassaFome";
import { ehRotaPublica } from "@/lib/rotasPublicas";
import Necessidades from "@/app/eficiencia-estatal/seguranca-alimentar/necessidades/page";
import Metodos from "@/app/eficiencia-estatal/seguranca-alimentar/metodos/page";

const raiz = process.cwd();
const c = dadosComplementares();
const s = c.ebia_social;
const texto = (h: string) => h.replace(/<!-- -->/g, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;|\s+/g, " ");
const secao = (comp: Complementos) => texto(renderToStaticMarkup(createElement(QuemPassaFome, { c: comp })));
const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const recorte = (id: string) => s.recortes.find((r) => r.id === id)!;
const valor = (id: string, ano: number, grupo: string, classe: string) =>
  recorte(id).linhas.find((l) => l.ano === ano && l.grupo === grupo && l.situacao === "total")!.classes[classe as "grave"]!;

describe("Quem passa fome no Brasil: procedência", () => {
  it("o seed dos recortes sociais tem o hash do manifesto e a gold é desse seed", () => {
    const man = JSON.parse(readFileSync(join(raiz, "pipeline/eficiencia_alimentar/seed/ebia-social-manifesto.json"), "utf8"));
    const seed = readFileSync(join(raiz, "pipeline/eficiencia_alimentar/seed/ebia-social.json.gz"));
    expect(createHash("sha256").update(seed).digest("hex")).toBe(man.seed_sha256);
    expect(s.manifesto.seed_sha256).toBe(man.seed_sha256);
    expect(JSON.parse(gunzipSync(seed).toString()).versao).toBe(s.versao);
  });

  it("nove tabelas SIDRA do Brasil, 2023 e 2024, cada uma com hash; a 9561 é declarada inexistente", () => {
    expect(s.recortes.map((r) => r.tabela).sort()).toEqual(["9553", "9554", "9555", "9556", "9557", "9558", "9559", "9560", "9562"]);
    for (const f of s.manifesto.fontes) {
      expect(f.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(f.url).toMatch(/^https:\/\/apisidra\.ibge\.gov\.br\/values\/t\/\d{4}\/n1\/all\//);
      expect(f.territorio).toBe("Brasil");
    }
    for (const r of s.recortes) expect(new Set(r.linhas.map((l) => l.ano))).toEqual(new Set([2023, 2024]));
    expect(s.tabela_ausente.tabela).toBe("9561");
    expect(s.manifesto.capturado_em).toBe("2026-10-21");
  });

  it("as conferências do pipeline estão registradas e as diferenças com a 9552 são só as declaradas da renda", () => {
    expect(s.conferencias.classes_pct).toBe(18);
    expect(s.conferencias.grupos_pct).toBe(90);
    expect(s.conferencias.totais_9552).toBe(104);
    expect(s.ausencias).toEqual([]);
    expect(new Set(s.diferencas_9552.map((d) => d.tabela))).toEqual(new Set(["9558"]));
    expect(recorte("renda").universo_menor).toBeTruthy();
  });
});

describe("Quem passa fome no Brasil: valores e orientação", () => {
  it("composição: a parcela publicada é dos domicílios da classe; os grupos somam 100% dentro do arredondamento", () => {
    expect(valor("sexo", 2024, "Mulheres", "grave").pct).toBe(57.6);
    expect(valor("sexo", 2024, "Mulheres", "total").pct).toBe(51.8);
    for (const r of s.recortes.filter((x) => x.orientacao === "composicao" && x.particao)) {
      for (const k of r.classes) {
        const soma = r.grupos.reduce((t, g) => t + (r.linhas.find((l) => l.ano === 2024 && l.grupo === g && l.situacao === "total")!.classes[k]!.pct ?? 0), 0);
        expect(Math.abs(soma - 100), `${r.tabela} ${k}`).toBeLessThanOrEqual(s.tolerancias.pct_por_parcela * r.grupos.length + 1e-9);
      }
    }
  });

  it("distribuição: nas casas com crianças, o percentual é do grupo e as classes somam 100%", () => {
    const v = recorte("menores_5").linhas.find((l) => l.ano === 2024 && l.grupo === "Existe")!.classes;
    expect(v.insegura!.pct).toBe(31.1);
    expect(Math.abs(v.segura!.pct! + v.insegura!.pct! - 100)).toBeLessThanOrEqual(0.1 + 1e-9);
  });

  it("a página mostra o publicado e marca o calculado; a parcela no grupo não substitui o percentual do IBGE", () => {
    const t = secao(c);
    expect(t).toContain("Quem são os domicílios em insegurança grave");
    expect(t).toContain(`${fmt(51.8)}% dos domicílios do país e por ${fmt(57.6)}% dos domicílios em insegurança grave`);
    expect(t).toContain(`parda em ${fmt(valor("cor_raca", 2024, "Parda", "grave").pct!)}%`);
    expect(t).toContain("(calculado)");
    expect(t).toContain(fmt(valor("sexo", 2024, "Mulheres", "grave").pct_no_grupo_calculado!) + "%");
    expect(t).toContain("insegurança moderada ou grave, que o IBGE publica juntas nesta tabela");
  });

  it("estimativa com CV a partir do limiar é marcada e explicada; nenhuma diferença é chamada de significativa", () => {
    const t = secao(c);
    const cv = valor("ocupacao", 2024, "Empregador", "grave").cv_pct!;
    expect(cv).toBeGreaterThanOrEqual(s.limiar_cv);
    expect(t).toContain(`coeficiente de variação de ${fmt(cv)}%`);
    expect(t).toContain("limiar do painel e não regra do IBGE");
    const mencoes = [...t.matchAll(/significativ/gi)];
    expect(mencoes.length).toBeGreaterThan(0);
    for (const m of mencoes) expect(t.slice(Math.max(0, m.index! - 60), m.index), "toda menção a significância é negativa").toMatch(/nenhuma diferença/);
  });

  it("ausência publicada pelo IBGE é escrita como ausência, nunca zero", () => {
    const copia = structuredClone(c);
    const r = copia.ebia_social.recortes.find((x) => x.id === "sexo")!;
    const l = r.linhas.find((x) => x.ano === 2024 && x.grupo === "Mulheres" && x.situacao === "total")!;
    l.classes.grave = { ...l.classes.grave!, pct: null, cv_pct: null };
    const t = secao(copia);
    expect(t).toContain("Não publicado");
    expect(t).not.toContain("Mulheres 0,0%");
    expect(t).toContain("valor não publicado dos domicílios em insegurança grave");
  });

  it("a fonte traz número da tabela, período, território, unidade e data de captura", () => {
    const t = secao(c);
    for (const tab of ["9553", "9554", "9555", "9556", "9557", "9558", "9559", "9560", "9562"]) expect(t).toContain(tab);
    expect(t).toContain("capturadas em 21/10/2026 pela API do SIDRA");
    expect(t).toContain("Período: 2023 e 2024");
    expect(t).toContain("Território: Brasil");
    expect(t).toContain("% dos domicílios particulares permanentes e mil domicílios");
    expect(t).toContain("A tabela 9561 não existe");
  });
});

describe("Quem passa fome no Brasil: páginas e acesso", () => {
  it("Necessidades abre a seção pela pergunta e a leva no índice da página", () => {
    const h = renderToStaticMarkup(createElement(Necessidades));
    expect(h).toContain('id="quem-passa-fome"');
    expect(h).toContain('href="#quem-passa-fome"');
    expect(texto(h)).toContain("Quem passa fome no Brasil?");
    // a renda só tem moderada e grave juntas: título e legenda não podem chamar a barra escura dela de grave
    expect(texto(h)).toContain("insegurança alimentar grave (na renda, moderada ou grave, que o IBGE publica juntas)");
    expect(texto(h)).toContain("Parcela entre os domicílios em insegurança grave (na renda, moderada ou grave)");
  });

  it("o método (aberto) traz as nove fontes com hash e as fichas, sem valores dos dados", () => {
    const h = renderToStaticMarkup(createElement(Metodos));
    for (const f of s.manifesto.fontes) expect(h).toContain(f.sha256!);
    for (const id of ["san.ebia.social.composicao", "san.ebia.social.distribuicao", "san.ebia.social.no_grupo"]) expect(h).toContain(`id="${id}"`);
    expect(texto(h)).not.toContain(`${fmt(57.6)}%`);
  });

  it("a seção e o arquivo pedem conta; o aperitivo da Eficiência Estatal só anuncia a seção", () => {
    expect(ehRotaPublica("/eficiencia-estatal/seguranca-alimentar/necessidades")).toBe(false);
    expect(ehRotaPublica("/eficiencia/seguranca-alimentar/ebia-grupos-sociais.csv")).toBe(false);
    const aperitivo = readFileSync(join(raiz, "src/app/aperitivo/minha-capital/page.tsx"), "utf8");
    expect(aperitivo).toContain("quem passa fome no Brasil");
    expect(aperitivo).toContain("os em insegurança moderada ou grave por renda");
    expect(aperitivo).not.toMatch(/ebia_social|QuemPassaFome|57,6/);
  });
});
