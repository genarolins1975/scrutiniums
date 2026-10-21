import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ConceitoPage from "@/app/setor-eletrico/aprenda/[conceito]/page";
import AprendaPage from "@/app/setor-eletrico/aprenda/page";
import TrilhasPage from "@/app/setor-eletrico/aprenda/trilhas/page";
import TrilhaPage from "@/app/setor-eletrico/aprenda/trilhas/[trilha]/page";
import PaginaMreGsf from "@/app/setor-eletrico/mercado/mre-e-gsf/page";
import { RodapeEnergia } from "@/components/energia/RodapeEnergia";
import { CONCEITOS, GRUPOS, conceito } from "@/lib/energia/conteudo/conceitos";
import { CONTRASTES, contrastesDe } from "@/lib/energia/conteudo/complementos";
import { exemploDe } from "@/lib/energia/conteudo/exemplos";
import { perguntaPratica } from "@/lib/energia/conteudo/perguntas-praticas";
import { provaDoVerbete } from "@/lib/energia/conteudo/provas";
import { TRILHAS_APRENDA } from "@/lib/energia/conteudo/trilhas";
import { TIPOS_LIGACAO } from "@/lib/energia/mapa";

/**
 * Fechamento dos achados abertos da revisão adversarial do Aprenda (07/10/2026), rodada r7. Cada bloco cita os achados
 * (L = leitor, F = auditor de fonte ou interface) que ele protege; o estado de cada um está em avaliacao/revisao_aprenda.json.
 */
const raiz = process.cwd();
const ler = (p: string) => readFileSync(join(raiz, p), "utf-8");
const css = ler("src/app/globals.css");
const pagina = (slug: string) => renderToStaticMarkup(createElement(ConceitoPage, { params: { conceito: slug } }));
const texto = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

describe("verbete: texto e estrutura (L-06, L-09, L-10, L-12, L-19, L-22, L-23, L-25, F06, F10, F26)", () => {
  it("L-06 e L-10: constrained-off e REE abrem em palavras simples, com o texto da fonte logo abaixo e rotulado", () => {
    for (const s of ["constrained-off", "ree"]) {
      const h = pagina(s);
      expect(h, s).toContain('data-palavras-simples="true"');
      expect(h.indexOf("Em palavras simples"), s).toBeLessThan(h.indexOf("Texto da fonte"));
      expect(h, s).toContain(conceito(s)!.emUmaFrase!.slice(0, 60));
    }
    expect(pagina("constrained-off")).toContain("indisponibilidade de uma instalação externa");
    expect(pagina("ree")).toContain("12 REE");
  });

  it("L-09: o Como é medido de constrained-off e de GSF tem resumo aberto e detalhe técnico recolhido, com método do observatório separado", () => {
    for (const s of ["constrained-off", "gsf"]) {
      const h = pagina(s);
      const campo = h.slice(h.indexOf(">Como é medido<"));
      expect(campo, s).toContain("Detalhe técnico");
      expect(campo.indexOf(conceito(s)!.comoEMedidoResumo!.slice(0, 40)), s).toBeLessThan(campo.indexOf("Detalhe técnico"));
    }
    expect(texto(pagina("gsf"))).toContain("No observatório. O denominador é a garantia física modulada");
    expect(texto(pagina("constrained-off"))).toContain("Método do observatório sobre os dados do ONS");
  });

  it("F06: a fórmula do constrained-off no verbete traz o piso em zero e a meia hora, como a ficha publicada, e não confunde unidade do observatório com a da fonte", () => {
    const c = conceito("constrained-off")!;
    expect(c.comoEMedido).toContain("o maior valor entre zero e a referência menos a geração verificada, vezes 0,5 hora");
    expect(c.comoEMedido).not.toMatch(/^Em energia \(MWh ou GWh\) e em potência \(MW\), por usina/);
  });

  it("F26: a frase do GSF qualifica a garantia física do boletim e o rótulo do centro de gravidade deixa de ser 'referenciada'", () => {
    const c = conceito("gsf")!;
    expect(c.emUmaFrase).toContain("(no boletim do MME, a garantia física sazonalizada)");
    expect(c.comoEMedido).not.toContain("referenciada ao centro de gravidade");
    expect(c.comoEMedido).toContain('rotulada \\"(centro de gravidade)\\"'.replace(/\\"/g, '"'));
  });

  it("L-12: o exemplo do MRE é o do próprio mecanismo (geração conjunta e garantia física), não o cartão do GSF", () => {
    const h = pagina("mre");
    expect(provaDoVerbete("mre")!.tipo).toBe("texto");
    expect(h).not.toContain("Fator de ajuste do MRE (GSF)");
    expect(texto(h)).toMatch(/as usinas do MRE geraram, juntas, [\d.]+ MWmed/);
    expect(provaDoVerbete("gsf")!.tipo).toBe("evidencia");
  });

  it("L-19: a unidade vem dentro de Como é medido, sem campo próprio", () => {
    const h = pagina("gsf");
    expect(h).not.toContain(">Unidade<");
    expect(h.indexOf('data-unidade="true"')).toBeGreaterThan(h.indexOf(">Como é medido<"));
    expect(h.indexOf('data-unidade="true"')).toBeLessThan(h.indexOf(">Não confundir com<"));
  });

  it("L-22: todo exemplo traz a legenda visível do selo de natureza, com as mesmas palavras do selo", () => {
    for (const c of CONCEITOS.filter((x) => x.estado === "CONFERIDO")) {
      const h = pagina(c.slug);
      if (h.includes('data-sintetico="true"')) continue;
      expect(h, c.slug).toContain('data-legenda-natureza="true"');
    }
    expect(texto(pagina("gsf"))).toContain("Calculado: Transformação determinística feita pela Scrutiniums, com fórmula publicada.");
  });

  it("L-23: relações de GSF, constrained-off e REE trazem uma frase por relação, sem inventar além dos trechos", () => {
    for (const s of ["gsf", "constrained-off", "ree"]) {
      const c = conceito(s)!;
      expect(Object.keys(c.relacoesNotas ?? {}).length, s).toBeGreaterThanOrEqual(2);
      for (const k of Object.keys(c.relacoesNotas!)) expect(c.relacoes, `${s} → ${k}`).toContain(k);
    }
    expect(texto(pagina("ree"))).toContain("12 REE junto com a versão 24 do modelo NEWAVE".replace("junto com", "junto com"));
  });

  it("L-25 e F10: o texto de Não confundir tem 16 px e coluna de leitura; o termo sem verbete tem a mesma caixa e inicial maiúscula", () => {
    const h = pagina("ree");
    expect(h).toContain('<p class="text-base leading-relaxed">');
    expect(h).toContain("max-w-prose2");
    expect(h).toContain('<span class="inline-flex min-h-[44px] items-center">Subsistema</span>');
  });
});

describe("verbete: exemplo em cartão (L-11, F08) e achados de fonte (F22, L-24, L-38)", () => {
  it("L-11 e F08: PLD e EAR passam a ter a ficha Comprove; o exemplo sem ficha usa o mesmo cartão, com o aviso de que não há ficha", () => {
    expect(provaDoVerbete("pld")!.tipo).toBe("evidencia");
    expect(provaDoVerbete("ear")!.tipo).toBe("evidencia");
    expect(exemploDe("pld")).toBeNull();
    expect(exemploDe("ear")).toBeNull();
    const h = pagina("ree");
    expect(h).toContain('<figure data-prova="texto"');
    expect(h).toContain("Sem ficha Comprove própria neste exemplo");
    expect(h).toContain("Ver no painel");
    expect(h).not.toContain('<p data-prova="texto">');
  });

  it("o PLD do verbete e o do passo 5 da trilha de água são a mesma semana operativa do CMO do passo 4 (L-30 e L-31)", () => {
    const pld = provaDoVerbete("pld");
    const cmo = provaDoVerbete("dessem");
    if (!pld || !cmo || pld.tipo !== "evidencia" || cmo.tipo !== "evidencia") throw new Error("PLD e DESSEM precisam de ficha publicada");
    const semana = (t: string) => /de (\d{2}\/\d{2}\/\d{4}) a (\d{2}\/\d{2}\/\d{4})/.exec(t)?.slice(1).join(" a ");
    expect(semana(pld.dado.evidencia.indicador)).toBeTruthy();
    expect(semana(pld.dado.evidencia.indicador)).toBe(semana(cmo.dado.evidencia.indicador));
    const t = TRILHAS_APRENDA.find((x) => x.id === "agua-operacao-preco")!;
    expect(t.passos.find((p) => p.id === "pld")!.prova).toEqual({ tipo: "verbete", slug: "pld" });
    expect(t.passos.find((p) => p.id === "pld")!.texto).toContain("na mesma semana operativa do CMO do passo anterior");
  });

  it("F22: as páginas citadas trazem a numeração do documento e a do PDF", () => {
    const gsf = JSON.stringify(conceito("gsf")!.fontes.map((f) => f.documento));
    expect(gsf).toContain("p. 28 do documento (p. 33 do PDF)");
    expect(gsf).toContain("lista de siglas, p. 40 do documento (p. 45 do PDF)");
    expect(gsf).toContain("p. 22 do documento e do PDF");
    const ree = JSON.stringify(conceito("ree")!.fontes.map((f) => f.documento));
    expect(ree).toContain("p. 4 do documento (p. 7 do PDF)");
    expect(ree).toContain("p. 38 do documento (p. 41 do PDF)");
    expect(ree).toContain("p. 9 do documento (p. 12 do PDF)");
  });

  it("L-24: o contraste entre vizinhos não repete o mesmo parágrafo nos dois verbetes", () => {
    const comVariante = CONTRASTES.filter((c) => c.textoB);
    expect(comVariante.length).toBeGreaterThanOrEqual(4);
    for (const c of comVariante) {
      expect(c.textoB, `${c.a}/${String(c.b)}`).not.toBe(c.texto);
      const doA = contrastesDe(c.a).find((x) => x.com === c.b)!.texto;
      const doB = contrastesDe(c.b as string).find((x) => x.com === c.a)!.texto;
      expect(doA, `${c.a}/${String(c.b)}`).not.toBe(doB);
    }
    const texts = ["mre", "gsf", "garantia-fisica"].flatMap((s) => contrastesDe(s).map((x) => x.texto));
    expect(new Set(texts).size).toBe(texts.length);
  });

  it("L-38: um só termo (painel) e um só link por destino: o fim da página não repete o do exemplo", () => {
    for (const s of ["gsf", "constrained-off"]) {
      const h = pagina(s);
      expect(h, s).not.toContain("Veja no portal");
      expect(h, s).not.toContain(">Veja no painel<");
      expect(h, s).toContain("Ver no painel: ");
    }
    expect(pagina("pld")).toContain(">Veja no painel<");
  });
});

describe("índice (L-26, L-28)", () => {
  const h = renderToStaticMarkup(createElement(AprendaPage));

  // redesenho: no celular um tema por vez, recolhido, com a contagem e a prévia; a partir de 768 px a lista aparece aberta (as duas
  // apresentações estão no HTML e o CSS escolhe uma); a busca vem primeiro, depois as trilhas, depois os verbetes
  it("L-26: temas recolhidos com a contagem no celular, lista aberta em tela larga, busca por termo, todos os verbetes no HTML e abertura curta", () => {
    expect((h.match(/<details id="g-/g) ?? []).length).toBe(GRUPOS.length);
    expect((h.match(/data-lista="aberta"/g) ?? []).length).toBe(1);
    expect(h.indexOf('id="aprenda-busca"')).toBeLessThan(h.indexOf('id="aprenda-trilhas"'));
    expect(h.indexOf('id="aprenda-trilhas"')).toBeLessThan(h.indexOf('id="aprenda-todos"'));
    expect(h).not.toMatch(/<details id="g-[^>]* open/);
    expect(h).toContain('type="search"');
    expect(h).toContain('id="aprenda-busca"');
    for (const c of CONCEITOS) expect(h, c.slug).toContain(`href="/setor-eletrico/aprenda/${c.slug}"`);
    expect(h).not.toContain("Ir para o grupo");
    const abertura = texto(h.slice(h.indexOf("<h1"), h.indexOf("</header>", h.indexOf("<h1"))));
    expect(abertura.length).toBeLessThan(700);
    expect(abertura).toContain("Procure um termo ou comece por uma trilha");
  });

  it("L-26: a linha do verbete abre pela pergunta prática; a definição (em palavras simples ou da fonte) fica no verbete, não no índice", () => {
    expect(h).toContain(perguntaPratica("constrained-off")!);
    expect(h).not.toContain(conceito("constrained-off")!.emPalavrasSimples!.slice(0, 50));
    expect(h).not.toContain(conceito("constrained-off")!.emUmaFrase!.slice(0, 60));
  });

  it("L-28: IMERG e MERRA-2 formam o grupo Fontes de dados, fora de Água", () => {
    expect(GRUPOS).toContain("Fontes de dados");
    expect(conceito("imerg")!.grupo).toBe("Fontes de dados");
    expect(conceito("merra-2")!.grupo).toBe("Fontes de dados");
    const grupo = h.slice(h.indexOf('<details id="g-fontes-de-dados"'));
    expect(grupo.slice(0, grupo.indexOf("</details>"))).toContain("IMERG");
  });

  it("a busca vai para a URL (?q=) e o link com #g-<grupo> abre o grupo", () => {
    const t = ler("src/components/energia/AprendaIndice.tsx");
    expect(t).toContain('campo(tiposUrl.texto({ max: 80 }), "", { param: "q", historico: "replace" })');
    expect(t).toContain("el.open = true");
    expect(t).toContain('window.addEventListener("hashchange", abre)');
  });
});

describe("trilhas (L-30 a L-36, F04, F20)", () => {
  const agua = renderToStaticMarkup(createElement(TrilhaPage, { params: { trilha: "agua-operacao-preco" } }));
  const custo = renderToStaticMarkup(createElement(TrilhaPage, { params: { trilha: "custo-tarifa-orcamento" } }));

  it("L-34: o exemplo de liquidação vem logo depois do passo do PLD e antes do passo 6, com o enunciado e a dica", () => {
    expect(agua.indexOf('data-simulacao-apos="pld"')).toBeGreaterThan(agua.indexOf('id="passo-pld"'));
    expect(agua.indexOf('data-simulacao-apos="pld"')).toBeLessThan(agua.indexOf('id="passo-mercado"'));
    expect(texto(agua)).toContain("Um agente contratou 100 MWh para uma hora e consumiu 110 MWh. A diferença, 10 MWh, é liquidada ao preço da hora");
    expect(texto(agua)).toContain("Mova o CMO acima de R$ 1.600/MWh ou abaixo de R$ 60/MWh");
    expect(agua).toContain('aria-label="Passos 6 a 6: Água, operação e preço"');
  });

  it("L-35: os rótulos de bandeira dizem que são hipotéticos e a conta não convida a comparar com a POF", () => {
    expect(custo).toContain("Amarela hipotética: +R$ 0,02/kWh");
    expect(custo).toContain("Vermelha hipotética: +R$ 0,05/kWh");
    expect(custo).toContain("Tarifa (TE + TUSD)");
    expect(texto(custo)).toContain("Não compare com o peso medido pela POF");
  });

  it("L-36: o índice das trilhas não traz a legenda dos cinco tipos de ligação; cada trilha define os tipos que usa, onde cada um aparece pela primeira vez", () => {
    const h = renderToStaticMarkup(createElement(TrilhasPage));
    expect(h).not.toContain(">Tipos de ligação<");
    expect(h).toContain("vem explicado na página de cada trilha");
    // a definição do tipo fica ao lado do primeiro traço que o representa (uma só vez), e só os tipos da trilha são definidos
    for (const [html, trilha] of [[agua, TRILHAS_APRENDA[0]], [custo, TRILHAS_APRENDA[1]]] as const) {
      const usados = Array.from(new Set(trilha.passos.flatMap((p) => (p.ligacao ? [p.ligacao.tipo] : []))));
      for (const tipo of Object.keys(TIPOS_LIGACAO) as (keyof typeof TIPOS_LIGACAO)[]) {
        const n = html.split(TIPOS_LIGACAO[tipo].definicao).length - 1;
        expect(n, `${trilha.id}: ${tipo}`).toBe(usados.indexOf(tipo) >= 0 ? 1 : 0);
      }
    }
  });

  it("F20: os títulos das seções da trilha seguem a hierarquia dos títulos dos passos", () => {
    for (const h of [agua, custo]) {
      // redesenho: os títulos dos passos e das duas seções usam a mesma escala editorial (ed-h2)
      expect(h).toContain('<h2 id="sintetico" class="ed-h2 font-serif text-carvao">');
      expect(h).toContain('<h2 id="nao-conclua" class="ed-h2 font-serif text-carvao">');
      expect(h).toMatch(/<h2 id="t-[a-z-]+" class="ed-h2 mt-1 font-serif text-carvao">/);
    }
  });

  it("F04: sem JavaScript os controles do exemplo ficam desligados, com aviso, e o botão Comprove some", () => {
    for (const h of [agua, custo]) {
      expect(h).toContain("<noscript>");
      expect(h).toMatch(/<input id="[^"]+" type="range"[^>]* disabled/);
    }
    expect(css).toMatch(/@media \(scripting: none\) \{\s*main button\[data-comprove\] \{ display: none; \}/);
  });

  it("L-32: a MLT vem com 100% como a própria média e o número de térmica diz que é média de potência", () => {
    const t = TRILHAS_APRENDA.find((x) => x.id === "agua-operacao-preco")!;
    expect(t.passos[0].texto).toContain("100% é o valor da própria MLT");
    expect(t.passos[2].texto).toContain("média de potência em 12 meses, em MWmed, e não o total de energia");
  });
});

describe("cromo global (L-20, L-37, F15, F17, F18, F21) e painel de Mercado (F19)", () => {
  it("L-20 e F17: as fontes do observatório ficam recolhidas e os links do rodapé do observatório têm alvo de 44 px", () => {
    const h = renderToStaticMarkup(createElement(RodapeEnergia));
    expect(h).toContain("<details");
    expect(h).not.toMatch(/<details[^>]* open/);
    expect(h).toContain("Fontes deste observatório");
    expect((h.match(/min-h-\[44px\]/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });

  it("a data de publicação do rodapé fica fora do bloco recolhido (jornada J9 da r7 não a achava)", () => {
    const h = renderToStaticMarkup(createElement(RodapeEnergia));
    const fim = h.indexOf("</details>");
    expect(fim).toBeGreaterThan(0);
    const dentro = h.slice(0, fim);
    const fora = h.slice(fim);
    expect(dentro).not.toContain("Catálogo e saúde processados em");
    expect(fora).toMatch(/Catálogo e saúde processados em .*\(Brasília\)/);
    expect(fora).toContain("/setor-eletrico/dados/reproducao");
  });

  it("L-37: a faixa de módulos fica rente à borda, com esmaecimento estreito daquele lado; F18: sem prefetch dos módulos do grupo", () => {
    const av = ler("src/components/energia/AtivoVisivel.tsx");
    expect(av).toContain("if (a.left >= l.left && a.right <= l.right - 8) return;");
    expect(av).toContain("acompanhaFaixa(lista, 0)");
    expect(av).toContain("if (alvo > maximo) lista.style.paddingRight");
    expect(css).toMatch(/#modulos-energia \{\s*-webkit-mask-image: [^;]*calc\(var\(--fade-esq\) \* 0\.5rem\)/);
    const cab = ler("src/components/energia/CabecalhoEnergia.tsx");
    expect(cab).toMatch(/<Link\s+href=\{d\.href\}\s+prefetch=\{false\}/);
  });

  it("F15: rótulos de campo e selo de natureza com corpo maior; a ficha explica o +alterado (F21)", () => {
    expect(ler("src/components/energia/AprendaVerbete.tsx")).toContain('<h2 className="rotulo !text-[0.8rem] text-mineral">{rotulo}</h2>');
    expect(ler("src/components/evidencia/SeloNatureza.tsx")).toContain("!text-xs");
    expect(ler("src/components/energia/ComproveNumero.tsx")).toContain("ainda não confirmadas em commit (sufixo +alterado)");
  });

  it("F19: o painel de Mercado não afirma o repasse do risco ao consumidor cativo como fato, e diz que as definições operacionais não foram conferidas em norma", () => {
    const h = texto(renderToStaticMarkup(createElement(PaginaMreGsf)));
    expect(h).not.toContain("é repassado ao consumidor cativo pela tarifa");
    expect(h).not.toContain("Parte desse risco recai sobre o consumidor cativo e aparece na Conta Bandeira");
    expect(h).not.toContain("Submercados e risco hidrológico do consumidor cativo");
    // o limite segue declarado, agora só em "Por que importa" (o lede deixou de descrever o processo do observatório)
    expect(h).not.toContain("a norma que define esse repasse não foi lida");
    expect(h).toContain("o painel não verificou em norma como esse custo chega à tarifa");
    expect(h).toContain("As três definições abaixo são operacionais: o observatório as escreveu para ler este painel. Não são a definição regulatória nem foram conferidas em norma");
  });
});
