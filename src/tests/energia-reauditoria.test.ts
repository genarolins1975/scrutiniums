import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { lerCsvComAspas } from "../lib/energia/dados-servidor";
import type { CapturaEnergia, CapturaHistoricaEnergia, MetaGold } from "../lib/energia/tipos";

/**
 * Regressões apontadas na reauditoria independente: proveniência de cada número
 * citado nos painéis, um único arredondamento, data de publicação da CCEE,
 * relação entre saldos e intercâmbio do SIN descrita a partir do dado e
 * linguagem causal sem rótulo em qualquer flexão.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");

describe("proveniência por painel", () => {
  it("painéis da Visão geral e da Rede trazem a proveniência de cada número que citam", () => {
    const visao = ler("src/app/setor-eletrico/visao-geral/page.tsx");
    const rede = ler("src/app/setor-eletrico/rede/page.tsx");
    // a Visão geral lê só sintese.json: cada frase leva versões (gold, snapshot, sha256), o caminho de
    // cada valor na gold de origem e a evidência "Comprove este número" (ver energia-visao.test.ts)
    expect(visao).toContain('lerGold<SinteseVisaoGold>("sintese.json")');
    // r8: a lista de frases também recebe as notas de ponte entre números (carga e rede), então o teste confere o início do elemento
    expect(visao).toContain("<VisaoFrases frases={g.frases}");
    const tabelas = ler("src/components/energia/VisaoTabelasSobDemanda.tsx");
    expect(visao).toContain('<VisaoTabelasSobDemanda conjunto="sistema-auditoria"');
    expect(tabelas).toContain("linhasVersoes(g.frases)");
    expect(tabelas).toContain("linhasValoresFrases(g.frases)");
    expect(rede).toContain("p: pld.proveniencia.diario");
    expect(ler("src/components/energia/PldPeriodos.tsx")).toContain('<SeloNatureza natureza="CALCULADO" />');
  });

  it("o cabeçalho do painel mostra um selo por natureza presente", () => {
    expect(ler("src/components/evidencia/PainelEvidencia.tsx")).toContain("complementares.map((c) => c.p.natureza)");
  });
});

describe("arredondamento único", () => {
  it("percentis e ENA de 30 dias são exibidos com uma casa, como na gold", () => {
    const arquivos = [
      "src/app/setor-eletrico/visao-geral/page.tsx",
      "src/app/setor-eletrico/agua-e-clima/page.tsx",
      "src/app/setor-eletrico/geracao/page.tsx",
      "src/components/energia/CartoesPld.tsx",
      "src/lib/energia/conteudo/exemplos.ts",
    ];
    for (const f of arquivos) {
      const t = ler(f);
      expect(t, f).not.toMatch(/num\([^)]*percentil[^)]*,\s*0\)/);
      expect(t, f).not.toMatch(/pct\([^)]*pct_mlt_(30d|dia)[^)]*,\s*0\)/);
      expect(t, f).not.toMatch(/Math\.round\([^)]*percentil/);
      expect(t, f).not.toMatch(/percentil[^\n]*maximumFractionDigits: 0/);
    }
    const s = ler("pipeline/energia/gold/sintese.py");
    expect(s).not.toMatch(/nbr\([^)]*percentil[^)]*,\s*0\)/);
    expect(s).not.toMatch(/nbr\(n\['pct_mlt_30d'\],\s*0\)/);
  });
});

describe("datas e textos gerados a partir do dado", () => {
  it("nenhuma proveniência baseada no PLD da CCEE exibe data de publicação da fonte", () => {
    for (const g of ["pld.json", "rede.json"]) {
      const j = JSON.parse(ler(`public/energia/gold/${g}`));
      for (const p of Object.values(j.proveniencia) as { fonte: { orgao: string }; publicado_pela_fonte_em: string | null; indicador: string }[]) {
        if (p.fonte.orgao === "CCEE") expect(p.publicado_pela_fonte_em, `${g}: ${p.indicador}`).toBeNull();
      }
    }
  });

  it("a relação entre saldos e intercâmbio do SIN é descrita a partir do dado, sem afirmação fixa", () => {
    const r = JSON.parse(ler("public/energia/gold/rede.json"));
    expect(r.balanco_sin).toBeTruthy();
    expect(r.balanco_sin.horas_total).toBeGreaterThan(0);
    expect(r.proveniencia.saldos.limitacoes[0]).toMatch(/intercâmbio do SIN/);
    for (const f of ["src/app/setor-eletrico/rede/page.tsx", "src/app/setor-eletrico/visao-geral/page.tsx", "pipeline/energia/gold/rede.py"]) {
      expect(ler(f), f).not.toMatch(/não se compensam|se compensam no SIN|que não é zero/);
    }
  });

  it("limitação do PLD lista as datas de captura por arquivo e a situação da última coleta", () => {
    const p = JSON.parse(ler("public/energia/gold/pld.json"));
    const lim = p.proveniencia.horario.limitacoes.join(" ");
    expect(lim).toMatch(/capturas primárias de \d{2}\/\d{2}\/\d{4} \(arquivo/);
    expect(lim).toMatch(/última tentativa de coleta direta|não foi tentada/);
  });
});

describe("linguagem causal sem rótulo", () => {
  it("não volta, em qualquer flexão", () => {
    const padroes = [/pression(a|am|ar|ando)\b/i, /rep(õe|or|ondo)\s+(o|esse|este)\s+estoque/i, /termômetro/i, /para a época/i];
    const arquivos = [
      "src/app/setor-eletrico/visao-geral/page.tsx",
      "src/app/setor-eletrico/pld/page.tsx",
      "src/app/setor-eletrico/agua-e-clima/page.tsx",
      "src/app/setor-eletrico/geracao/page.tsx",
      "src/app/setor-eletrico/carga/page.tsx",
      "src/app/setor-eletrico/rede/page.tsx",
      "pipeline/energia/gold/sintese.py",
    ];
    for (const f of arquivos) for (const re of padroes) expect(ler(f), `${f}: ${re}`).not.toMatch(re);
    expect(ler("public/energia/gold/sintese.json")).not.toMatch(/para a época/);
  });
});

describe("auditoria final: regressões", () => {
  it("comparação anual da geração não atravessa a quebra de regime de 29/04/2023", () => {
    const g = JSON.parse(ler("public/energia/gold/geracao.json"));
    expect(g.inicio_regime_atual).toBe("2023-04-29");
    for (const a of g.comparacao_anual) {
      for (const j of ["7d", "30d"]) if (a[j]) expect(a[j].inicio >= g.inicio_regime_atual, `${a.ano} ${j}`).toBe(true);
    }
    for (const f of ["src/app/setor-eletrico/geracao/page.tsx", "pipeline/energia/gold/geracao.py"]) {
      expect(ler(f), f).not.toMatch(/não entra nesta conta|não faz parte do balanço|mostra a expansão de eólica e solar/);
    }
  });

  it("exemplo de liquidação não opera regra não conferida com número", () => {
    const t = ler("src/app/setor-eletrico/pld/page.tsx");
    expect(t).not.toMatch(/\d+\s*MWh\s*[×x]\s*R\$/);
    expect(t).toMatch(/não mostra valores de liquidação/);
  });

  it("amplitude entre submercados tem proveniência própria e sai de valores não arredondados", () => {
    const r = JSON.parse(ler("public/energia/gold/rede.json"));
    expect(r.proveniencia.amplitude.natureza).toBe("CALCULADO");
    expect(r.proveniencia.amplitude.formula).toMatch(/max_s .* min_s/);
    const p = JSON.parse(ler("public/energia/gold/pld.json"));
    expect(typeof p.amplitude_dia).toBe("number");
    expect(ler("pipeline/energia/gold/sintese.py")).toContain('pld.get("amplitude_dia")');
    expect(typeof r.limiar_diferenca_dia).toBe("number");
    expect(ler("src/app/setor-eletrico/rede/page.tsx")).not.toMatch(/acima de R\$ 1[ ,]/);
  });

  it("nenhum percentual de ENA ou percentil é rearredondado para zero casas", () => {
    for (const f of ["pipeline/energia/gold/sintese.py"]) {
      expect(ler(f), f).not.toMatch(/nbr\([^)]*(pct_mlt_30d|percentil)[^)]*\]?\)?,\s*0\)/);
    }
  });

  it("revisões distinguem captura única de recaptura idêntica, e a página do conjunto lista todas as vintages", () => {
    const p = JSON.parse(ler("public/energia/gold/pld.json"));
    expect(typeof p.proveniencia.horario.revisoes_conhecidas.recapturas_sem_mudanca).toBe("number");
    const m = JSON.parse(ler("public/energia/gold/meta.json")) as MetaGold;
    const dicionario = JSON.parse(ler("public/energia/gold/arquivos.json")).arquivos;
    const assinatura = (cpt: CapturaEnergia) => JSON.stringify([cpt.familia, cpt.recurso, cpt.sha256, cpt.capturado_em, cpt.publicado_em, cpt.origem]);
    const csvPorFonte = new Map<string, CapturaHistoricaEnergia[]>();
    if (Object.values(m.fontes).some((f) => f.resumo_capturas)) {
      // Ler/parsear uma vez; as fontes compartilham o mesmo arquivo completo.
      const [cols, ...linhas] = lerCsvComAspas(ler("public/energia/series/capturas_fontes.csv"));
      expect(cols).toEqual(["dataset", "familia", "recurso", "sha256", "capturado_em", "publicado_em", "origem", "vigente"]);
      for (const x of linhas) {
        expect(x.length, x[0]).toBe(cols.length);
        expect(["true", "false"], x[0]).toContain(x[7]);
        expect(x[1], x[0]).not.toBe("");
        expect(m.fontes[x[0]]?.resumo_capturas, x[0]).toBeTruthy();
        const lista = csvPorFonte.get(x[0]) ?? [];
        lista.push({ familia: x[1], recurso: x[2], sha256: x[3], capturado_em: x[4], publicado_em: x[5] || null, origem: x[6], vigente: x[7] === "true" });
        csvPorFonte.set(x[0], lista);
      }
      expect(linhas.length).toBe(Object.values(m.fontes).reduce((n, f) => n + (f.resumo_capturas?.total_historico ?? 0), 0));
    }
    for (const [ds, f] of Object.entries(m.fontes)) {
      expect(Array.isArray(f.capturas), ds).toBe(true);
      expect(Array.isArray(f.historico), ds).toBe(true);
      let historico = f.historico ?? [];
      let capturas = f.capturas;
      if (f.resumo_capturas) {
        expect(f.historico_csv, ds).toBe("/energia/series/capturas_fontes.csv");
        expect(dicionario["/energia/series/capturas_fontes.csv"]?.gold, ds).toBe("meta.json");
        historico = csvPorFonte.get(ds) ?? [];
        const familias = new Set((f.snapshots_familias ?? []).map((x) => x.familia));
        expect(familias.size, ds).toBeGreaterThan(0);
        for (const h of historico) expect(familias.has(h.familia!), `${ds}: ${h.familia}`).toBe(true);
        if (familias.size > 1) {
          expect(f.snapshot, ds).toBeNull();
          expect(f.snapshot_sha256, ds).toBeNull();
          expect(f.resumo_capturas.recapturas_sem_mudanca, ds).toBeNull();
        }
        // Vigência conferida contra a captura mais recente de CADA família/recurso,
        // independentemente da flag exportada; não basta contar a amostra JSON.
        const ultimas = new Map<string, CapturaHistoricaEnergia>();
        for (const h of historico) {
          const chave = JSON.stringify([h.familia, h.recurso]);
          const anterior = ultimas.get(chave);
          if (!anterior || h.capturado_em > anterior.capturado_em) ultimas.set(chave, h);
        }
        capturas = [...ultimas.values()].map((h) => ({ familia: h.familia, recurso: h.recurso, sha256: h.sha256, capturado_em: h.capturado_em, publicado_em: h.publicado_em, origem: h.origem }));
        for (const h of historico) expect(h.vigente, `${ds}: ${h.familia}/${h.recurso}`).toBe(h.sha256 === ultimas.get(JSON.stringify([h.familia, h.recurso]))?.sha256);
        expect(historico.length, ds).toBe(f.resumo_capturas.total_historico);
        expect(capturas.length, ds).toBe(f.resumo_capturas.total_capturas);
        const datas = historico.map((x) => x.capturado_em).sort();
        expect(f.resumo_capturas.primeira, ds).toBe(datas[0] ?? null);
        expect(f.resumo_capturas.ultima, ds).toBe(datas.at(-1) ?? null);
        expect(f.resumo_capturas.recapturas_sem_mudanca, ds).toBe(f.recapturas_sem_mudanca);
        expect(f.capturas.length, ds).toBeLessThanOrEqual(f.resumo_capturas.limite_recentes);
        expect(f.historico?.length, ds).toBeLessThanOrEqual(f.resumo_capturas.limite_recentes);
        const atuais = new Set(capturas.map(assinatura));
        const todas = new Set(historico.map((h) => `${assinatura(h)}:${h.vigente}`));
        for (const cpt of f.capturas) expect(atuais.has(assinatura(cpt)), ds).toBe(true);
        for (const h of f.historico ?? []) expect(todas.has(`${assinatura(h)}:${h.vigente}`), ds).toBe(true);
      }
      expect(historico.length, ds).toBeGreaterThanOrEqual(capturas.length);
      expect(historico.filter((x) => x.vigente).length, ds).toBe(capturas.length);
      // Igualdade integral (inclui multiplicidade), sem busca quadrática por linha.
      expect(historico.filter((h) => h.vigente).map(assinatura).sort(), ds).toEqual(capturas.map(assinatura).sort());
    }
    expect(ler("src/app/setor-eletrico/dados/[dataset]/page.tsx")).toContain("capturasDoConjunto(f, d.interno)");
    expect(ler("src/components/evidencia/SobreEsteDado.tsx")).toContain("recapturas_sem_mudanca");
  });

  it("conjuntos usados como entrada de modelo aparecem como UTILIZADO EM MODELO no catálogo", () => {
    const reg = JSON.parse(ler("pipeline/energia/registro_modelos.json"));
    const cat = JSON.parse(ler("public/energia/gold/catalogo.json"));
    const entrada = (id: string) => cat.entradas.find((e: { id: string }) => e.id === id);
    for (const m of reg.modelos) {
      if (/EAR/.test(m.dados_treinamento)) expect(entrada("ons:ear-diario-por-subsistema").modelos, m.codigo).toContain(m.codigo);
      if (/ENA/.test(m.dados_treinamento)) expect(entrada("ons:ena-diario-por-subsistema").modelos, m.codigo).toContain(m.codigo);
    }
  });

  it("documentação não afirma no presente o que ainda não está implementado", () => {
    expect(ler("docs/observatorios/ARQUITETURA_DADOS_ENERGIA.md")).not.toMatch(/Toda feature de modelo e todo backtest usam/);
    expect(ler("docs/observatorios/PLD_GOVERNANCA_PREVISAO.md")).not.toMatch(/\* Features vêm de/);
    expect(ler("src/app/setor-eletrico/metodologia/page.tsx")).not.toMatch(/\(bronze e silver\)/);
    for (const m of JSON.parse(ler("pipeline/energia/registro_modelos.json")).modelos) {
      expect(m.limitacoes.join(" "), m.codigo).not.toMatch(/não é revisado depois de publicado/);
    }
  });

  // A verificação do HTML pré-renderizado (undefined, NaN, data crua) saiu daqui para
  // src/tests/html-gerado.test.ts: lá ela é obrigatória no CI e nunca retorna sucesso sem build.
});

describe("auditoria final B: regressões", () => {
  it("selo da tela de escolha quebra linha em tela estreita", () => {
    // Iniciativa M1 do parecer de UX de 23/10/2026: a faixa "seu lugar" virou a fatia "retomar" do mapa, em grade de uma coluna
    // abaixo de 1024 px; o selo "sua última escolha" não voltou
    const t = ler("src/components/observatorios/MapaDaConta.tsx") + ler("src/app/app/(foco)/observatorios/page.tsx");
    expect(ler("src/components/observatorios/MapaDaConta.module.css")).toMatch(/\.retomar \{ display: grid; grid-template-columns: minmax\(0, 1fr\)/);
    expect(t).not.toMatch(/sua última escolha/);
  });

  it("gavetas da amplitude usam a proveniência da amplitude, sem recuar para a de outra grandeza", () => {
    for (const f of ["src/app/setor-eletrico/pld/page.tsx", "src/app/setor-eletrico/rede/page.tsx"]) {
      expect(ler(f), f).not.toMatch(/proveniencia\.amplitude \?\?/);
      expect(ler(f), f).toContain("textoAmplitude(");
    }
    const r = JSON.parse(ler("public/energia/gold/rede.json"));
    expect(r.resumo_amplitude.media_30d).not.toBeNull();
    expect(r.proveniencia.fluxo.formula).toMatch(/média_30d/);
  });

  it("\"O que mudou\" diz o que mudou nos painéis de amplitude e de fluxos", () => {
    expect(ler("src/app/setor-eletrico/pld/page.tsx")).not.toMatch(/oQueMudou=\{<>Último dia com PLD/);
    expect(ler("src/app/setor-eletrico/rede/page.tsx")).not.toMatch(/oQueMudou=\{<>Série de /);
  });

  it("dica de termo é reposicionada para caber na tela", () => {
    const t = ler("src/components/evidencia/TermoDica.tsx");
    expect(t).toContain("posiciona");
    expect(t).toContain("calc(100vw-2rem)");
  });

  it("sem jargão interno nas páginas e no rodapé", () => {
    expect(ler("src/components/energia/RodapeEnergia.tsx")).not.toMatch(/Gold processada|· pipeline/);
    expect(ler("pipeline/energia/catalogo.py")).not.toMatch(/Coletado pelo pipeline com bronze/);
    expect(ler("src/app/setor-eletrico/pld/page.tsx")).not.toMatch(/pipeline\/energia\/governanca\.py/);
    const reg = JSON.parse(ler("pipeline/energia/registro_modelos.json"));
    expect(reg.publicacao_resultados.motivo).not.toMatch(/G4|G23/);
    for (const c of reg.publicacao_resultados.condicoes) expect(c).not.toMatch(/G4|G23/);
    for (const m of reg.modelos) {
      expect(m.auditoria, m.codigo).not.toMatch(/G0 a G3|contexto separado/);
      expect(m.falhas_conhecidas.join(" "), m.codigo).not.toMatch(/G23-R1/);
    }
    expect(Object.keys(reg.fonte.codigos_internos)).toEqual(expect.arrayContaining(["E2B-C123-v1", "G23-R1"]));
  });

  it("verbete SIN existe com trecho da captura primária da CCEE", () => {
    const t = ler("src/lib/energia/conteudo/conceitos.ts");
    expect(t).toContain('slug: "sin"');
    const cap = ler("pipeline/energia/seed/ccee_documentos/v20260928T110709Z/package_show_pld_horario_submercado.json");
    expect(cap).toContain("Representa os quatro (4) submercados de atuação no SIN  - Sistema Interligado Nacional");
  });

  it("série coincidente no gráfico de períodos do PLD é declarada", () => {
    expect(ler("src/components/energia/PldPeriodos.tsx")).toContain("function sobrepostos(");
  });
});

describe("verificação final: regressões", () => {
  it("a quebra de 29/04/2023 é descrita pelo degrau da solar medido no dado, sem afirmar que a geração iguala a carga", () => {
    const g = JSON.parse(ler("public/energia/gold/geracao.json"));
    expect(g.degrau_solar.depois).toBe("2023-04-29");
    expect(g.degrau_solar.solar_sin_depois / g.degrau_solar.solar_sin_antes).toBeGreaterThan(1.5);
    // A11 fechado com documentação primária do ONS (descrição do conjunto Carga de Energia e
    // grupo "Pequenas Usinas (MMGD)" no conjunto Geração por Usina): o texto cita as duas fontes
    expect(g.regras.regime).toContain("Carga de Energia");
    expect(g.regras.regime).toContain("Pequenas Usinas (MMGD)");
    for (const f of [
      "src/app/setor-eletrico/geracao/page.tsx",
      "pipeline/energia/gold/geracao.py",
      "pipeline/energia/catalogo.py",
      "src/lib/energia/conteudo/conceitos.ts",
      "public/energia/gold/geracao.json",
      "public/energia/gold/catalogo.json",
    ]) {
      expect(ler(f), f).not.toMatch(/iguala(r)? a carga/);
    }
  });

  it("mudança identificada pela plataforma não aparece como declarada pela fonte", () => {
    const c = JSON.parse(ler("public/energia/gold/catalogo.json"));
    for (const e of c.entradas) for (const q of e.quebras) expect(["FONTE", "PLATAFORMA"], `${e.id} ${q.data}`).toContain(q.origem);
    expect(ler("src/app/setor-eletrico/dados/page.tsx")).not.toContain("mudanças metodológicas declaradas pela fonte</span>");
    expect(ler("src/app/setor-eletrico/dados/[dataset]/page.tsx")).toContain("identificada pela Scrutiniums no dado");
  });

  it("colunas de grade com tabela não empurram a página para o lado", () => {
    const t = ler("src/app/setor-eletrico/pld/page.tsx");
    expect(t).toContain('grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]');
    expect(t).toContain('<div className="min-w-0">');
  });

  it("limiar da diferença entre submercados escrito do mesmo jeito em todas as regras", () => {
    for (const g of ["pld.json", "sintese.json"]) expect(ler(`public/energia/gold/${g}`), g).not.toMatch(/R\$ 1\/MWh/);
  });

  it("verbete SIN não atribui ao ONS a publicação de valores do SIN", () => {
    const t = ler("src/lib/energia/conteudo/conceitos.ts");
    expect(t).not.toContain("os valores do SIN aparecem ao lado dos quatro subsistemas");
  });
});
