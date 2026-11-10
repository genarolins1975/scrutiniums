import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { COLECOES_FUNDIDAS, OBSERVATORIOS, ehDeColecaoFundida, escolhaObservatorio, idDaColecao, nomeDaColecao } from "@/lib/observatorios/lista";
import { buscar, versaoAbertaDoResultado, type GrupoObservatorio } from "@/lib/busca/buscar";
import { indiceDeBusca } from "@/lib/busca/indice";
import { ListaResultados } from "@/components/busca/ListaResultados";
import { ATALHOS, donoDaRota, paineis } from "@/lib/observatorios/registro";
import { idsDasColecoes, navegacaoDaColecao } from "@/lib/observatorios/navegacaoColecao";
import { MAX_A_VISTA } from "@/lib/observatorios/navegacaoPura";
import { colecaoDoCaminho, lerUltimoAcesso, ultimoAcessoDoCaminho } from "@/lib/observatorios/ultimoAcesso";
import { ALCANCE_DA_DATA, FRESCOR_NO_MAPA, diretorioDoMapa } from "@/lib/observatorios/mapaConta";
import { inventario } from "@/lib/observatorios/inventario";
import { APERITIVOS, LEVA_2, ehRotaPublica } from "@/lib/rotasPublicas";
import { SECOES_DO_MAPA, SECOES_DO_MAPA_ANTIGAS, isViewSection, sectionLabel } from "@/lib/telemetry";

/**
 * Fusão das coleções de uma página só (decisão do dono de 10/11/2026): Desastres entra em Fogo e desastres, Combustíveis em
 * Gás e combustíveis, Mobilidade em Mobilidade e conectividade e Cultura em Educação e cultura. De 28 coleções para 24.
 * Coleção é agrupamento de navegação: nenhum endereço muda, nenhuma página sai, nenhuma regra de acesso muda. Este teste confere:
 *  1. os apelidos: o id antigo, onde quer que tenha ficado gravado, resolve para a coleção nova;
 *  2. toda coleção tem porta própria (um painel dela mesma, nunca um atalho nem a porta de outra);
 *  3. as páginas das coleções absorvidas continuam no ar, na navegação e no inventário da coleção nova;
 *  4. a data "dados até" do mapa da conta nunca passa de uma fonte para o conteúdo de outra.
 * Os nomes e a contagem são texto e número decididos pelo dono nessa data; o resto são invariantes.
 */

const COLECOES = OBSERVATORIOS.flatMap((o) => o.colecoes.map((c) => ({ ...c, observatorio: o.id })));
const FUNDIDAS = Object.entries(COLECOES_FUNDIDAS);

describe("fusão das coleções de uma página só (decisão do dono de 10/11/2026)", () => {
  it("24 coleções, com os quatro nomes decididos e Contas Estaduais sem fusão", () => {
    expect(COLECOES).toHaveLength(24);
    expect(idsDasColecoes()).toHaveLength(24);
    expect(new Set(COLECOES.map((c) => c.id)).size).toBe(24);
    const porId = new Map(COLECOES.map((c) => [c.id, c]));
    expect(porId.get("fogo")).toMatchObject({ nome: "Fogo e desastres", href: "/territorio/queimadas", observatorio: "territorio-e-clima" });
    expect(porId.get("gas")).toMatchObject({ nome: "Gás e combustíveis", href: "/gas-natural", observatorio: "energia-e-infraestrutura" });
    expect(porId.get("conectividade")).toMatchObject({ nome: "Mobilidade e conectividade", href: "/conectividade", observatorio: "energia-e-infraestrutura" });
    expect(porId.get("educacao")).toMatchObject({ nome: "Educação e cultura", href: "/educacao-municipal", observatorio: "servicos-publicos" });
    // piloto com pipeline próprio: continua coleção
    expect(porId.get("estaduais")).toMatchObject({ nome: "Contas Estaduais", href: "/contas-publicas-estaduais" });
  });

  it("apelidos: os quatro ids antigos, e só eles, levam à coleção que os absorveu", () => {
    expect(Object.fromEntries(FUNDIDAS.map(([antigo, f]) => [antigo, f.para]))).toEqual({ desastres: "fogo", combustiveis: "gas", mobilidade: "conectividade", cultura: "educacao" });
    const ids = new Set(COLECOES.map((c) => c.id));
    for (const [antigo, f] of FUNDIDAS) {
      expect(ids.has(antigo), `${antigo} deixou de ser coleção`).toBe(false);
      expect(ids.has(f.para), `${antigo} → ${f.para}`).toBe(true);
      expect(idDaColecao(antigo)).toBe(f.para);
      // o apelido não encadeia: o destino é uma coleção corrente
      expect(idDaColecao(f.para)).toBe(f.para);
      expect(nomeDaColecao(antigo)).toBe(nomeDaColecao(f.para));
    }
    for (const c of COLECOES) expect(idDaColecao(c.id), c.id).toBe(c.id);
    // id desconhecido não vira coleção por causa do mapa
    expect(idDaColecao("toString")).toBe("toString");
    expect(() => nomeDaColecao("nao-existe")).toThrow();
  });

  it("cookie de último acesso: o id antigo gravado antes da fusão leva à porta da coleção nova", () => {
    for (const [antigo, f] of FUNDIDAS) {
      const nova = COLECOES.find((c) => c.id === f.para)!;
      const lido = lerUltimoAcesso(`c:${antigo}`);
      expect(lido, antigo).toMatchObject({ tipo: "colecao", colecao: nova.id, observatorio: nova.observatorio, nome: nova.nome, href: nova.href });
      // o valor devolvido é o corrente: quem regrava o cookie a partir da leitura não perpetua o id antigo
      expect(lido!.valor).toBe(`c:${nova.id}`);
    }
    expect(lerUltimoAcesso("c:nao-existe")).toBeNull();
  });

  it("último acesso por endereço: a antiga porta e as páginas abaixo dela contam para a coleção nova", () => {
    for (const [antigo, f] of FUNDIDAS) {
      expect(ultimoAcessoDoCaminho(f.porta), antigo).toBe(`c:${f.para}`);
      expect(ultimoAcessoDoCaminho(`${f.porta}/qualquer`), antigo).toBe(`c:${f.para}`);
      const c = colecaoDoCaminho(`${f.porta}?uf=PE`)!;
      const nova = COLECOES.find((x) => x.id === f.para)!;
      expect(c).toMatchObject({ colecao: nova.id, nome: nova.nome, href: nova.href });
    }
    // o casamento mais longo continua valendo: a Síntese das capitais não engole a Cultura nem a Mobilidade
    expect(ultimoAcessoDoCaminho("/eficiencia-estatal")).toBe("c:sintese");
    expect(ultimoAcessoDoCaminho("/eficiencia-estatal/cultura/acervos")).toBe("c:educacao");
    expect(ultimoAcessoDoCaminho("/eficiencia-estatal/mobilidade-transporte")).toBe("c:conectividade");
    // todo valor gravado a partir de um endereço é lido de volta
    for (const c of COLECOES) expect(lerUltimoAcesso(ultimoAcessoDoCaminho(c.href)), c.href).toMatchObject({ colecao: c.id });
  });

  it("escolha pós login: formulário aberto antes da fusão, com o id antigo, leva à porta da coleção nova", () => {
    for (const [antigo, f] of FUNDIDAS) {
      const nova = COLECOES.find((c) => c.id === f.para)!;
      expect(escolhaObservatorio(nova.observatorio, antigo)?.href, antigo).toBe(nova.href);
      // a allowlist continua por observatório: o apelido não abre a coleção a partir de outro observatório
      const outro = OBSERVATORIOS.find((o) => o.id !== nova.observatorio)!;
      expect(escolhaObservatorio(outro.id, antigo), antigo).toBeUndefined();
    }
    expect(escolhaObservatorio("economia", "nao-existe")).toBeUndefined();
  });

  it("navegação: o id antigo devolve a navegação da coleção nova, e a antiga porta está nela", () => {
    for (const [antigo, f] of FUNDIDAS) {
      const nav = navegacaoDaColecao(antigo);
      expect(nav.id, antigo).toBe(f.para);
      expect(nav).toEqual(navegacaoDaColecao(f.para));
      const enderecos = nav.itens.flatMap((i) => [i.href, ...(i.subpaginas ?? []).map((s) => s.href)]);
      expect(enderecos, `${antigo}: ${f.porta}`).toContain(f.porta);
      // até oito destinos à vista na linha 1, sem depender do "Mais", e o primeiro é a porta da coleção nova
      expect(nav.itens.length, antigo).toBeLessThanOrEqual(MAX_A_VISTA);
      expect(nav.itens[0].href).toBe(COLECOES.find((c) => c.id === f.para)!.href);
    }
  });

  it("nenhuma coleção fica sem porta própria: a porta é um painel da própria coleção, e nenhuma porta se repete", () => {
    const todos = paineis();
    const atalhos = new Set(ATALHOS.map((a) => `${a.observatorio}/${a.colecao}:${a.rota}`));
    expect(new Set(COLECOES.map((c) => c.href)).size).toBe(COLECOES.length);
    for (const c of COLECOES) {
      const painel = todos.find((p) => p.rota === c.href);
      expect(painel, `${c.id}: porta ${c.href} sem painel no registro`).toBeDefined();
      expect(painel, c.id).toMatchObject({ observatorio: c.observatorio, colecao: c.id });
      expect(atalhos.has(`${c.observatorio}/${c.id}:${c.href}`), c.id).toBe(false);
    }
    // nenhum painel aponta para uma coleção que não existe mais
    const ids = new Set(COLECOES.map((c) => `${c.observatorio}/${c.id}`));
    for (const p of todos) expect(ids.has(`${p.observatorio}/${p.colecao}`), `${p.rota} → ${p.colecao}`).toBe(true);
    for (const a of ATALHOS) expect(ids.has(`${a.observatorio}/${a.colecao}`), `${a.rota} → ${a.colecao}`).toBe(true);
  });

  it("as páginas das coleções absorvidas continuam no registro e no inventário da coleção nova, com o mesmo endereço", () => {
    const inv = inventario().flatMap((o) => o.colecoes);
    for (const [antigo, f] of FUNDIDAS) {
      const nova = COLECOES.find((c) => c.id === f.para)!;
      expect(donoDaRota(f.porta), antigo).toMatchObject({ rota: f.porta, observatorio: nova.observatorio, colecao: nova.id });
      const pagina = inv.find((c) => c.id === nova.id)!.paginas.find((p) => p.rota === f.porta);
      expect(pagina, `${antigo}: ${f.porta} no inventário de ${nova.id}`).toBeDefined();
      // a página entra na busca: pergunta e termos (regra de busca-cobertura)
      expect(pagina!.resumo, f.porta).toBeTruthy();
      expect(pagina!.termos?.length ?? 0, f.porta).toBeGreaterThanOrEqual(3);
    }
  });

  it("acesso: a fusão não abre nem fecha nenhum endereço", () => {
    // com conta: as antigas portas; aberta desde 20/10/2026: só a consulta por estado dos combustíveis (LEVA_2)
    for (const [, f] of FUNDIDAS) expect(ehRotaPublica(f.porta), f.porta).toBe(false);
    expect(LEVA_2.find((i) => i.id === "quanto-custa-encher-o-tanque")?.rotas).toContain("/combustiveis/no-meu-estado");
    expect(ehRotaPublica("/combustiveis/no-meu-estado")).toBe(true);
    // os aperitivos das coleções que receberam outra continuam no endereço da porta
    for (const rota of ["/conectividade", "/educacao-municipal", "/gas-natural/gas-de-cozinha"]) {
      expect(APERITIVOS.some((a) => a.rota === rota), rota).toBe(true);
      expect(ehRotaPublica(rota), rota).toBe(true);
    }
    expect(ehRotaPublica("/gas-natural")).toBe(false);
    expect(ehRotaPublica("/territorio/queimadas")).toBe(false);
  });

  it("busca: a página vinda de coleção fundida entra na coleção nova e não recebe a versão aberta de outro tema", () => {
    const indice = indiceDeBusca();
    for (const [antigo, f] of FUNDIDAS) {
      // uma entrada por endereço: a página ou a pergunta da camada aberta que leva a ela, sempre na coleção nova
      const doEndereco = indice.entradas.filter((e) => e.href === f.porta);
      expect(doEndereco.length, `${antigo}: ${f.porta} no índice`).toBeGreaterThan(0);
      for (const e of doEndereco) expect(e.colecao, `${antigo}: ${e.tipo} ${f.porta}`).toBe(f.para);
      expect(indice.entradas.some((e) => e.tipo === "colecao" && e.colecao === antigo), antigo).toBe(false);
      expect(ehDeColecaoFundida(f.porta)).toBe(true);
      expect(ehDeColecaoFundida(`${f.porta}/abaixo?uf=PE`)).toBe(true);
    }
    for (const c of COLECOES) expect(ehDeColecaoFundida(c.href), c.href).toBe(false);
    // a Educação e cultura tem página aberta (Educação nos municípios): vale para a Educação, não para a Cultura
    const educacao = indice.colecoes.find((c) => c.id === "educacao")!;
    expect(educacao.aberta?.href).toBe("/educacao-municipal");
    expect(versaoAbertaDoResultado("/eficiencia-estatal/educacao-municipal-capitais", educacao)).toEqual(educacao.aberta);
    expect(versaoAbertaDoResultado("/eficiencia-estatal/cultura/acervos", educacao)).toBeUndefined();
    // na lista de resultados sem sessão: primeiro resultado da Cultura, nenhuma linha de versão aberta
    const cultura = indice.entradas.find((e) => e.href === "/eficiencia-estatal/cultura")!;
    const grupos: GrupoObservatorio[] = [{
      observatorio: { id: "servicos-publicos", nome: "Serviços Públicos" },
      colecoes: [{ colecao: { id: educacao.id, nome: educacao.nome, href: educacao.href, aberta: educacao.aberta }, resultados: [{ ...cultura, nivel: 1 }] }],
    }];
    expect(renderToStaticMarkup(createElement(ListaResultados, { grupos, comSessao: false }))).not.toContain("data-versao-aberta");
    // os termos das coleções absorvidas continuam achando as páginas delas
    for (const [termo, porta] of [["biblioteca", "/eficiencia-estatal/cultura"], ["gasolina", "/combustiveis"], ["ônibus", "/eficiencia-estatal/mobilidade-transporte"], ["defesa civil", "/territorio/desastres"]] as const) {
      const hrefs = buscar(indice, termo).resultados.map((r) => r.href ?? "");
      expect(hrefs.some((h) => h === porta || h.startsWith(`${porta}/`)), `${termo} → ${porta}`).toBe(true);
    }
  });

  it("medição: a chave antiga do mapa segue legível no histórico e não é mais gravada", () => {
    for (const [antigo, f] of FUNDIDAS) {
      const chave = `mapa:${antigo}`;
      expect(SECOES_DO_MAPA[chave], chave).toBeUndefined();
      expect(isViewSection(chave), chave).toBe(false);
      expect(SECOES_DO_MAPA_ANTIGAS[chave], chave).toContain(f.nome);
      expect(sectionLabel(chave), chave).toBe(SECOES_DO_MAPA_ANTIGAS[chave]);
      // a coleção nova tem a sua chave, com o nome novo
      expect(SECOES_DO_MAPA[`mapa:${f.para}`]).toBe(`Mapa da conta · ${nomeDaColecao(f.para)}`);
    }
  });

  it("mapa da conta: a data de uma fonte nunca passa pelo conteúdo da outra", () => {
    const ids = COLECOES.map((c) => c.id);
    expect(Object.keys(FRESCOR_NO_MAPA).sort()).toEqual([...ids].sort());
    for (const id of Object.keys(ALCANCE_DA_DATA)) {
      expect(ids, id).toContain(id);
      expect(FRESCOR_NO_MAPA[id].length, `${id}: alcance sem fonte datada`).toBeGreaterThan(0);
    }
    // três fusões juntam bases diferentes: a linha diz a que parte a data se refere; no Gás e combustíveis a referência do
    // domínio "gas" já cobre os combustíveis (ultimos_meses de public/gas/gold/meta.json), e a linha segue sem ressalva
    expect(Object.keys(ALCANCE_DA_DATA).sort()).toEqual(["conectividade", "educacao", "fogo"]);
    expect(FRESCOR_NO_MAPA.gas).toEqual(["gas"]);
    const linhas = diretorioDoMapa().secoes.flatMap((o) => o.colecoes);
    expect(linhas).toHaveLength(24);
    for (const l of linhas) {
      expect(l.alcance, l.id).toEqual(ALCANCE_DA_DATA[l.id] ?? null);
      if (l.alcance) {
        expect(l.alcance.de).not.toBe(l.alcance.semData);
        expect(l.fontes.length, l.id).toBeGreaterThan(0);
      }
    }
  });
});
