/**
 * Entrada da coleção Varejo (com conta), no molde único das entradas (EntradaColecao): a pergunta, os quatro números de escala
 * com a prova e uma microfigura cada, o "Para você", os destinos com a miniatura da figura de cada página, o modelo didático "O cupom
 * de R$ 100" (figuras/Cupom.tsx), as perguntas para começar e o
 * método recolhido no fim. Tudo desenhado no servidor a partir das golds; nenhum número escrito à mão.
 */
import Link from "next/link";
import { FaixaFrescor } from "@/components/frescor/FaixaFrescor";
import { destinosDaColecao } from "@/components/observatorios/DestinosDaColecao";
import { EntradaColecao, type CaminhoEntrada } from "@/components/observatorios/EntradaColecao";
import { ModeloDidatico } from "@/components/observatorios/ModeloDidatico";
import { ParaVoce } from "@/components/observatorios/ParaVoce";
import { FRESCOR_DAS_COLECOES } from "@/lib/frescor/entradas";
import type { NumeroPorta } from "@/lib/perguntas/tipos";
import { contaDoCupom, difusao, formasDeComercializacao, leituraBrasil, linhasUf, pacVarejo, perfisDoModelo, serieBrasil, serieMacro, tesoura, ultimoComPonte, ultimoComValor, varejoNoComercio } from "@/lib/varejo/dados";
import { dataBr, direcao, mesCurto, mesExtenso, milhoesDe, num, pct, pontos, trilhoes, variacao } from "@/lib/varejo/formato";
import { DOWNLOADS, hrefDownload, PERGUNTA_ENTRADA, ROTA_BRASIL, ROTA_METODO, ROTA_SEGMENTOS, ROTA_VAREJO } from "@/lib/varejo/paginas";
import { PARES } from "@/lib/varejo/comparador";
import { amostraDoRanking, exercicioDoRanking, fonteDoRanking, linhasDoRanking, ROTA_COMPARADOR, ROTA_GRUPOS } from "@/lib/varejo/grupos";
import { reaisDeMilhoes } from "@/lib/varejo/formato";
import type { CuradoriaVarejo, GoldEmpresas, GoldSetor } from "@/lib/varejo/tipos";
import type { ReactNode } from "react";
import { Cupom } from "./figuras/Cupom";
import { COR_DA_PARTE, COR_RECEITA, corDoPasso, limiteSimetrico, passoDivergente } from "./figuras/escala";
import { MapaBlocosMini, MicroBarra, MicroBarras, MicroCupons, MicroProporcao, MicroSerie, TesouraMini } from "./figuras/Miniaturas";

const PMC = "IBGE, Pesquisa Mensal de Comércio";
const PAC = "IBGE, Pesquisa Anual de Comércio";
const ou = (texto: string, ok: boolean) => (ok ? texto : null);

/** Os quatro números de escala da abertura, lidos da gold setorial. A versão aperitivo mostra os mesmos (src/app/aperitivo/varejo). */
export function escalaVarejo(g: GoldSetor): NumeroPorta[] {
  const l = leituraBrasil(g, "restrito");
  const v = pacVarejo(g);
  const ano = String(g.pac.ano);
  return [
    {
      rotulo: "Volume de vendas do varejo em 12 meses", valor: ou(variacao(l.volume.m12), l.volume.m12 !== null), unidade: "ante os 12 meses anteriores",
      periodo: `até ${mesExtenso(l.mes)}`, fonte: PMC, nota: `Varejo restrito. No mês, ${variacao(l.volume.mm)} ante o mês anterior, com ajuste sazonal.`, href: ROTA_BRASIL,
    },
    {
      rotulo: "Receita nominal do varejo em 12 meses", valor: ou(variacao(l.receita.m12), l.receita.m12 !== null), unidade: "ante os 12 meses anteriores",
      periodo: `até ${mesExtenso(l.mes)}`, fonte: PMC, nota: "Varejo restrito. Receita em reais correntes: inclui o efeito dos preços.", href: `${ROTA_BRASIL}#diferenca`,
    },
    {
      rotulo: "Receita operacional líquida do comércio varejista", valor: ou(`R$ ${trilhoes(v?.receita_operacional_liquida)}`, v?.receita_operacional_liquida != null), unidade: "trilhões",
      periodo: ano, fonte: PAC, nota: "Reais correntes do ano da pesquisa; sem veículos e sem atacado.", href: `${ROTA_BRASIL}#mercado`,
    },
    {
      rotulo: "Pessoas ocupadas no comércio varejista", valor: ou(milhoesDe(v?.pessoal_ocupado), v?.pessoal_ocupado != null), unidade: "milhões",
      periodo: `31 de dezembro de ${ano}`, fonte: PAC, nota: `Em ${num(v?.empresas)} empresas.`, href: `${ROTA_BRASIL}#mercado`,
    },
  ];
}

const legenda = "mt-1.5 block text-xs leading-snug text-mineral";

/**
 * A microfigura de cada número de escala, na ordem de `escalaVarejo` e lida dos mesmos seletores: a trajetória de 24 meses da
 * variação em 12 meses (volume e receita), a parte do varejo na receita de todo o comércio e quantas em cada dez pessoas ocupadas
 * no comércio estão no varejo. Cada uma traz uma linha dizendo o que mostra.
 */
export function microfigurasDaEscala(g: GoldSetor): ReactNode[] {
  const m12 = serieBrasil(g, "restrito", "m12", "24m");
  const periodo = `Em 12 meses, ${mesCurto(m12[0].mes)} a ${mesCurto(m12[m12.length - 1].mes)}`;
  const [receita, , pessoal] = varejoNoComercio(g);
  const emDez = pessoal.parte === null ? null : Math.round(pessoal.parte / 10);
  return [
    <>
      <MicroSerie valores={m12.map((p) => p.volume)} zero />
      <span className={legenda}>{periodo}; linha cinza: zero</span>
    </>,
    <>
      <MicroSerie valores={m12.map((p) => p.receita)} cor={COR_RECEITA} zero />
      <span className={legenda}>{periodo}; linha cinza: zero</span>
    </>,
    receita.parte === null ? null : (
      <>
        <MicroBarra parte={receita.parte} />
        <span className={legenda}>{pct(receita.parte, 0)} da receita de todo o comércio, que soma atacado e veículos</span>
      </>
    ),
    emDez === null ? null : (
      <>
        <MicroProporcao parte={pessoal.parte} />
        <span className={legenda}>
          {num(emDez)} em cada 10 pessoas ocupadas no comércio ({pct(pessoal.parte, 0)})
        </span>
      </>
    ),
  ];
}

/** A miniatura da figura principal de cada destino, desenhada com o dado que o destino mostra. Decorativas: o número do cartão diz o valor. */
function miniaturasDosDestinos(g: GoldSetor, e: GoldEmpresas, c: CuradoriaVarejo): Record<string, ReactNode> {
  const t = tesoura(g, g.pmc.brasil.restrito, "5a");
  const ufs = linhasUf(g, "restrito", "m12");
  const limite = limiteSimetrico(ufs.map((u) => u.volume));
  const cores = Object.fromEntries(ufs.map((u) => { const p = passoDivergente(u.volume, limite); return [u.uf, p ? corDoPasso(p) : null]; }));
  const vendas = linhasDoRanking(c).map((x) => x.vendas_milhoes).filter((x): x is number => typeof x === "number").slice(0, 6);
  const par = PARES[0]?.slugs.map((slug) => ({ slug, b: ultimoComPonte(e.empresas[slug]?.anuais ?? [])?.ponte_100 ?? null })).filter((x) => x.b) ?? [];
  const altura = "h-16";
  return {
    [ROTA_BRASIL]: <TesouraMini volume={t.map((p) => p.volume)} receita={t.map((p) => p.receita)} altura={64} />,
    [ROTA_SEGMENTOS]: <MapaBlocosMini cores={cores} altura={64} />,
    ...(vendas.length > 1 ? { [ROTA_GRUPOS]: <MicroBarras valores={vendas} className={altura} /> } : {}),
    ...(par.length === 2
      ? {
          [ROTA_COMPARADOR]: (
            <MicroCupons
              className={altura}
              lojas={par.map((x) => ({
                id: x.slug,
                partes: (
                  [
                    ["custo", -x.b!.custo],
                    ["despesas", -x.b!.despesas_operacionais],
                    ["financeiro", -x.b!.resultado_financeiro],
                    ["impostos", -x.b!.ir_csll],
                    ["lucro", x.b!.lucro_liquido],
                  ] as const
                )
                  .filter(([, v]) => v > 0)
                  .map(([id, valor]) => ({ cor: COR_DA_PARTE[id], valor })),
              }))}
            />
          ),
        }
      : {}),
  };
}

/** Perguntas para começar: cada uma com o número lido do mesmo seletor que a página de destino usa. */
function caminhosVarejo(g: GoldSetor, e: GoldEmpresas, c: CuradoriaVarejo): CaminhoEntrada[] {
  const l = leituraBrasil(g, "restrito");
  const mes = mesExtenso(l.mes);
  const dif = l.receita.aa !== null && l.volume.aa !== null ? l.receita.aa - l.volume.aa : null;
  const d = difusao(g, "restrito", "aa", "volume");
  const ufs = linhasUf(g, "restrito", "m12");
  const ufsEmAlta = ufs.filter((u) => direcao(u.volume) === "alta").length;
  const ufsComDado = ufs.filter((u) => u.volume !== null).length;
  const internet = formasDeComercializacao(g).find((f) => f.forma === "Internet");
  const juros = ultimoComValor(serieMacro(g, g.macro.juros_credito_livre_pf.valores, "24m"));
  const v = pacVarejo(g);
  const primeiro = linhasDoRanking(c)[0] ?? null;
  const cvm = "CVM, Demonstrações Financeiras Padronizadas";
  const ultimoAno = String(e.fontes.dfp.exercicios[e.fontes.dfp.exercicios.length - 1]);
  const doRanking: CaminhoEntrada[] = primeiro
    ? [
        {
          pergunta: "De quem é a marca em que eu compro?", resumo: "A busca que devolve o grupo dono de cada marca, e a ficha dele com lojas, canais e eventos.", href: `${ROTA_GRUPOS}#ranking`,
          numero: { rotulo: `Maior grupo em vendas: ${primeiro.grupo}`, valor: ou(reaisDeMilhoes(primeiro.vendas_milhoes), typeof primeiro.vendas_milhoes === "number"), unidade: "venda bruta ao consumidor", periodo: exercicioDoRanking(c), fonte: fonteDoRanking(c), href: `${ROTA_GRUPOS}#ranking` },
        },
      ]
    : [];
  return [
    ...doRanking,
    {
      pergunta: "Por que duas redes do mesmo ramo lucram diferente?", resumo: "De R$ 100 de receita ao lucro e ao caixa, empresa ao lado de empresa, no mesmo ano.", href: ROTA_COMPARADOR,
      numero: { rotulo: "Companhias abertas que podem ser comparadas", valor: num(Object.keys(e.empresas).length), unidade: "companhias", periodo: `exercícios até ${ultimoAno}`, fonte: cvm, href: ROTA_COMPARADOR },
    },
    {
      pergunta: "A alta em reais veio com mais mercadoria vendida?", resumo: "A diferença entre a receita nominal e o volume, que aproxima o efeito dos preços.", href: `${ROTA_BRASIL}#diferenca`,
      numero: { rotulo: "Receita menos volume, contra o mesmo mês do ano anterior", valor: ou(pontos(dif), dif !== null), unidade: "", periodo: mes, fonte: PMC, href: `${ROTA_BRASIL}#diferenca` },
    },
    {
      pergunta: "Quantas atividades venderam mais?", resumo: "A contagem das atividades do varejo em alta e em queda, mês a mês.", href: `${ROTA_BRASIL}#difusao`,
      numero: { rotulo: "Atividades com volume acima do mesmo mês do ano anterior", valor: `${num(d.alta)} de ${num(d.total)}`, unidade: "atividades", periodo: mes, fonte: PMC, href: `${ROTA_BRASIL}#difusao` },
    },
    {
      pergunta: "Qual é o tamanho do mercado em reais?", resumo: "Receita, empresas e pessoas ocupadas por tipo de comércio, na pesquisa anual.", href: `${ROTA_BRASIL}#mercado`,
      numero: { rotulo: "Empresas do comércio varejista", valor: ou(num(v?.empresas), v?.empresas != null), unidade: "empresas", periodo: String(g.pac.ano), fonte: PAC, href: `${ROTA_BRASIL}#mercado` },
    },
    {
      pergunta: "Em que estados o varejo cresceu?", resumo: "O mapa e a lista dos estados, e a trajetória de cada um contra a do Brasil.", href: `${ROTA_SEGMENTOS}#estados`,
      numero: { rotulo: "Estados com volume em alta em 12 meses", valor: `${num(ufsEmAlta)} de ${num(ufsComDado)}`, unidade: "estados", periodo: `até ${mes}`, fonte: PMC, href: `${ROTA_SEGMENTOS}#estados` },
    },
    {
      pergunta: "Quanto das vendas passa pela internet?", resumo: "O comércio eletrônico como canal, entre as formas de venda das empresas maiores.", href: `${ROTA_SEGMENTOS}#ecommerce`,
      numero: { rotulo: "Receita de revenda pela internet, empresas com 20 ou mais pessoas", valor: ou(pct(internet?.parte), internet?.parte != null), unidade: "da receita bruta de revenda", periodo: String(g.pac.ano), fonte: PAC, href: `${ROTA_SEGMENTOS}#ecommerce` },
    },
    {
      pergunta: "O que renda, preços e juros dizem?", resumo: "Três variáveis de contexto ao lado das vendas, cada uma no seu gráfico.", href: `${ROTA_BRASIL}#contexto`,
      numero: { rotulo: "Juros médios do crédito livre às famílias", valor: ou(pct(juros?.valor), juros != null), unidade: "ao ano", periodo: juros ? mesExtenso(juros.mes) : "indisponível nesta publicação", fonte: "Banco Central, SGS 20740", href: `${ROTA_BRASIL}#contexto` },
    },
  ];
}

export function EntradaVarejo({ g, e, c }: Readonly<{ g: GoldSetor; e: GoldEmpresas; c: CuradoriaVarejo }>) {
  const amostra = amostraDoRanking(c);
  const perfis = perfisDoModelo(e).map((p) => ({ ...p, conta: contaDoCupom(p) }));
  const l = leituraBrasil(g, "restrito");
  const d12 = difusao(g, "ampliado", "m12", "volume");
  return (
    <EntradaColecao
      tipo="colecao"
      rota={ROTA_VAREJO}
      acento="gas"
      titulo={PERGUNTA_ENTRADA}
      frase="As vendas do comércio mês a mês, em volume e em reais, as diferenças entre atividades e estados, os maiores grupos com as marcas de cada um e o caminho de R$ 100 de venda até o lucro nas companhias abertas."
      frescor={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/varejo"]} conteiner="mx-auto max-w-page px-6" />}
      escala={escalaVarejo(g)}
      microfiguras={microfigurasDaEscala(g)}
      paraVoce={<ParaVoce entrada={ROTA_VAREJO} />}
      destinos={destinosDaColecao("varejo", {
        miniaturas: miniaturasDosDestinos(g, e, c),
        numeros: {
          [ROTA_BRASIL]: { rotulo: "Volume de vendas no mês, com ajuste sazonal", valor: ou(variacao(l.volume.mm), l.volume.mm !== null), unidade: "ante o mês anterior", periodo: mesExtenso(l.mes), fonte: PMC, href: ROTA_BRASIL },
          [ROTA_SEGMENTOS]: { rotulo: "Atividades com volume em alta em 12 meses", valor: `${num(d12.alta)} de ${num(d12.total)}`, unidade: "atividades", periodo: `até ${mesExtenso(d12.mes)}`, fonte: PMC, href: ROTA_SEGMENTOS },
          ...(amostra.n > 0
            ? { [ROTA_GRUPOS]: { rotulo: `Vendas somadas dos ${num(amostra.n)} maiores grupos`, valor: reaisDeMilhoes(amostra.total_milhoes), unidade: amostra.estimados > 0 ? `venda bruta, com ${num(amostra.estimados)} estimativas da fonte` : "venda bruta ao consumidor", periodo: exercicioDoRanking(c), fonte: fonteDoRanking(c), href: ROTA_GRUPOS } }
            : {}),
          [ROTA_COMPARADOR]: { rotulo: "Pares preparados para comparar", valor: num(PARES.length), unidade: `pares, entre ${num(Object.keys(e.empresas).length)} companhias abertas`, periodo: `exercícios de ${e.fontes.dfp.exercicios[0]} a ${e.fontes.dfp.exercicios[e.fontes.dfp.exercicios.length - 1]}`, fonte: "CVM, Demonstrações Financeiras Padronizadas", href: ROTA_COMPARADOR },
        },
      })}
      artefato={
        <ModeloDidatico
          id="mecanismo"
          titulo="O cupom de R$ 100: da prateleira ao lucro"
          descricao={
            <>
              De cada R$ 100 que entram no caixa de uma varejista, quanto vai para a mercadoria, para manter a loja aberta, para os juros e para o imposto, e quanto sobra. {num(perfis.length)} companhias abertas, uma
              de cada tipo de negócio, com os números que elas mesmas entregaram à CVM. Troque a loja e o cupom se reimprime.
            </>
          }
          deixaDeFora={[
            "Os impostos sobre a venda (ICMS, PIS e Cofins): a conta começa na receita líquida, depois deles",
            "O que cada companhia tem de particular: uma empresa não representa o seu tipo de negócio, e os anos não são iguais",
            "A diferença entre lucro e dinheiro em caixa: estoques, prazos de fornecedores e investimentos em lojas não aparecem",
            "Receitas que não são venda de mercadoria (crédito ao consumidor, comissões de vendedores parceiros), somadas à receita",
            "As varejistas de capital fechado, que não publicam demonstrações na CVM",
          ]}
        >
          <Cupom perfis={perfis} />
        </ModeloDidatico>
      }
      caminhos={caminhosVarejo(g, e, c)}
      caminhosAVista={4}
      metodo={<MetodoDaEntrada g={g} e={e} />}
      frescorMetodo={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/varejo"]} variante="metodo" />}
    />
  );
}

const link = "underline decoration-linha underline-offset-4 hover:decoration-carvao";

export function MetodoDaEntrada({ g, e, aberta = false }: Readonly<{ g: GoldSetor; e: GoldEmpresas; aberta?: boolean }>) {
  const f = g.fontes;
  return (
    <>
      <p>
        As vendas mensais vêm da Pesquisa Mensal de Comércio do IBGE (índices com base 2022 = 100, {f.pmc_restrito.tabela} e {f.pmc_ampliado.tabela}; atividades em {f.pmc_atividades.tabela}), com mês mais recente em{" "}
        {mesExtenso(g.referencia.pmc)}. O tamanho do mercado vem da Pesquisa Anual de Comércio de {g.pac.ano} ({f.pac_geral.tabela}), em reais correntes daquele ano. Volume é a venda descontada a variação dos preços;
        receita nominal é a venda em reais correntes.
      </p>
      <p>
        O modelo dos R$ 100 usa as demonstrações que as companhias entregam à CVM, consolidadas ou, sem controladas, individuais ({e.fontes.dfp.nome}). Dados setoriais capturados em {dataBr(g.capturado_em)}; demonstrações, em {dataBr(e.capturado_em)}. A fonte pode
        revisar valores já publicados.
      </p>
      <p>
        <Link href={ROTA_METODO} prefetch={false} className={link}>
          Fontes, fórmulas, correspondência com o IBGE e lacunas
        </Link>
      </p>
      {!aberta && (
        <ul className="space-y-1">
          {DOWNLOADS.map((d) => (
            <li key={d.arquivo}>
              <a href={hrefDownload(d.arquivo)} download className={`inline-flex min-h-[44px] items-center ${link}`}>
                {d.rotulo} (CSV)
              </a>
              <span className="block text-xs text-mineral">{d.descricao}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
