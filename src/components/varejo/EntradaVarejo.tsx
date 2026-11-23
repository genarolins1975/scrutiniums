/**
 * Entrada da coleção Varejo (com conta), no molde único das entradas (EntradaColecao): a pergunta, os quatro números de escala
 * com a prova, o "Para você", os destinos, o modelo didático "Do preço da prateleira ao lucro", as perguntas para começar e o
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
import { difusao, formasDeComercializacao, leituraBrasil, linhasUf, pacVarejo, perfisDoModelo, serieMacro, ultimoComValor } from "@/lib/varejo/dados";
import { dataBr, direcao, mesExtenso, milhoesDe, num, pct, pontos, trilhoes, variacao } from "@/lib/varejo/formato";
import { DOWNLOADS, hrefDownload, PERGUNTA_ENTRADA, ROTA_BRASIL, ROTA_METODO, ROTA_SEGMENTOS, ROTA_VAREJO } from "@/lib/varejo/paginas";
import type { GoldEmpresas, GoldSetor } from "@/lib/varejo/tipos";
import { PonteCemReais } from "./PonteCemReais";

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

/** Perguntas para começar: cada uma com o número lido do mesmo seletor que a página de destino usa. */
function caminhosVarejo(g: GoldSetor): CaminhoEntrada[] {
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
  return [
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

export function EntradaVarejo({ g, e }: Readonly<{ g: GoldSetor; e: GoldEmpresas }>) {
  const perfis = perfisDoModelo(e);
  const l = leituraBrasil(g, "restrito");
  const d12 = difusao(g, "ampliado", "m12", "volume");
  return (
    <EntradaColecao
      tipo="colecao"
      rota={ROTA_VAREJO}
      acento="gas"
      titulo={PERGUNTA_ENTRADA}
      frase="As vendas do comércio mês a mês, em volume e em reais, o tamanho do mercado, as diferenças entre atividades e estados e o caminho de R$ 100 de venda até o lucro nas companhias abertas."
      frescor={<FaixaFrescor dominios={FRESCOR_DAS_COLECOES["/varejo"]} conteiner="mx-auto max-w-page px-6" />}
      escala={escalaVarejo(g)}
      paraVoce={<ParaVoce entrada={ROTA_VAREJO} />}
      destinos={destinosDaColecao("varejo", {
        numeros: {
          [ROTA_BRASIL]: { rotulo: "Volume de vendas no mês, com ajuste sazonal", valor: ou(variacao(l.volume.mm), l.volume.mm !== null), unidade: "ante o mês anterior", periodo: mesExtenso(l.mes), fonte: PMC, href: ROTA_BRASIL },
          [ROTA_SEGMENTOS]: { rotulo: "Atividades com volume em alta em 12 meses", valor: `${num(d12.alta)} de ${num(d12.total)}`, unidade: "atividades", periodo: `até ${mesExtenso(d12.mes)}`, fonte: PMC, href: ROTA_SEGMENTOS },
        },
      })}
      artefato={
        <ModeloDidatico
          id="mecanismo"
          titulo="Do preço da prateleira ao lucro"
          descricao={
            <>
              Como R$ 100 de venda se dividem dentro de uma varejista: a mercadoria, a operação, os juros, o imposto e o que sobra. Três companhias abertas ilustram três tipos de negócio, com os números que
              elas mesmas entregaram à CVM. Escolha uma para abrir a conta.
            </>
          }
          deixaDeFora={[
            "Os impostos sobre a venda (ICMS, PIS e Cofins): a conta começa na receita líquida, depois deles",
            "O que cada companhia tem de particular: uma empresa não representa o seu segmento, e os anos não são iguais",
            "A diferença entre lucro e dinheiro em caixa: estoques, prazos de fornecedores e investimentos em lojas não aparecem",
            "Receitas que não são venda de mercadoria (crédito ao consumidor, comissões de vendedores parceiros), somadas à receita",
            "As varejistas de capital fechado, que não publicam demonstrações na CVM",
          ]}
        >
          <PonteCemReais perfis={perfis} />
        </ModeloDidatico>
      }
      caminhos={caminhosVarejo(g)}
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
