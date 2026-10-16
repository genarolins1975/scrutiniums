import type { Metadata } from "next";
import Link from "@/components/energia/LinkSemPrefetch";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { Bloco, CabecalhoModulo } from "@/components/energia/CabecalhoModulo";
import { EmpresasDatas, EmpresasIndisponivel, EmpresasNavegacao } from "@/components/energia/EmpresasPagina";
import { FaixaMetricas } from "@/components/energia/FaixaMetricas";
import { GraficoBarras } from "@/components/energia/GraficoBarras";
import { ListadasLabControle, type CompanhiaLabControle } from "@/components/energia/ListadasLabControle";
import { ListadasLabRetorno, type PapelLab } from "@/components/energia/ListadasLabRetorno";
import { ListadasLogo } from "@/components/energia/ListadasLogo";
import { ListadasMatriz } from "@/components/energia/ListadasMatriz";
import { ListadasTabela, type ColunaListadas, type LinhaListadas } from "@/components/energia/ListadasTabela";
import { Numero } from "@/components/energia/Numero";
import { PequenosMultiplos } from "@/components/energia/PequenosMultiplos";
import { RespostaCurta } from "@/components/energia/RespostaCurta";
import { SecaoDoPainel } from "@/components/energia/SecaoDoPainel";
import { ModoProfundidade } from "@/components/evidencia/ModoProfundidade";
import { NotasDoPainel, PainelEvidencia } from "@/components/evidencia/PainelEvidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { carimbo, dataBR, datasLegiveis, num, pct } from "@/lib/energia/formato";
import { integra, lerGold } from "@/lib/energia/gold";
import {
  MOTIVO_TOPO,
  ROTA_LISTADAS,
  contagemAtuacao,
  controladoresFre,
  estreiasDepoisDe2020,
  logoDe,
  matrizAtuacao,
  participacoesCruzadas,
  comPonto,
  textoCruzada,
  nomeCurto,
  porEspecieControle,
  respostaPanorama,
  rotaFicha,
  sinalPct,
  textoControle,
} from "@/lib/energia/listadas";
import { lerManifestoLogos } from "@/lib/energia/logos";
import { SIGLAS } from "@/lib/energia/siglas";
import type { CompanhiaListada, ListadasGold } from "@/lib/energia/tipos-listadas";

export const dynamic = "force-static";
export const metadata: Metadata = {
  title: "Companhias listadas de energia elétrica: ativos, controle, finanças e bolsa",
  description:
    "As companhias da carteira do Índice de Energia Elétrica (IEE) da B3: usinas, linhas e distribuidoras sob controle de cada uma, quem as controla (CVM e ANEEL), indicadores financeiros da CVM, retorno das ações com proventos e fatos relevantes dos últimos 24 meses.",
  alternates: { canonical: ROTA_LISTADAS },
};

const link = "text-energia-dark underline underline-offset-4 hover:text-carvao";

const COLUNAS: ColunaListadas[] = [
  { id: "peso", rotulo: "Peso no IEE", unidade: "%", casas: 2, tipo: "numero", grupo: "Índice" },
  { id: "mw", rotulo: "Usinas sob controle", unidade: "MW", casas: 0, tipo: "numero", grupo: "Ativos sob controle" },
  { id: "km", rotulo: "Transmissão", unidade: "km de circuito", casas: 0, tipo: "numero", grupo: "Ativos sob controle" },
  { id: "ucs", rotulo: "Distribuição", unidade: "mil UCs", casas: 0, tipo: "numero", grupo: "Ativos sob controle" },
  { id: "receita", rotulo: "Receita", unidade: "R$ milhões", casas: 0, tipo: "numero", grupo: "Finanças, consolidado" },
  { id: "lucro", rotulo: "Lucro líquido", unidade: "R$ milhões", casas: 0, tipo: "numero", grupo: "Finanças, consolidado" },
  { id: "margem", rotulo: "Margem EBIT", unidade: "%", casas: 1, tipo: "numero", grupo: "Finanças, consolidado" },
  { id: "divpl", rotulo: "Dívida bruta ÷ PL", unidade: "vezes", casas: 2, tipo: "numero", grupo: "Finanças, consolidado" },
  { id: "r12", rotulo: "Retorno total 12 meses", unidade: "%", casas: 1, tipo: "sinal", grupo: "Bolsa" },
  { id: "r20", rotulo: "Retorno total desde o fim de 2020", unidade: "%", casas: 1, tipo: "sinal", grupo: "Bolsa" },
  { id: "vol", rotulo: "Volume diário", unidade: "R$ milhões, 3 meses", casas: 1, tipo: "numero", grupo: "Bolsa" },
  { id: "fatos", rotulo: "Fatos relevantes", unidade: "24 meses", casas: 0, tipo: "numero", grupo: "Movimentos" },
];

function ultimaFin(c: CompanhiaListada) {
  return c.financas?.serie.at(-1) ?? null;
}

export default function ListadasPage() {
  const g = lerGold<ListadasGold>("listadas.json");
  if (!integra(g)) return <EmpresasIndisponivel motivo={(g as { motivo?: string } | null)?.motivo ?? "O painel de companhias listadas não foi gerado nesta publicação."} />;
  const logos = lerManifestoLogos();
  const cs = g.companhias;
  const n = contagemAtuacao(g);
  const dataCart = dataBR(g.datas.carteira_iee);
  const exercicio = g.datas.financas_ultimo_exercicio;
  const ultimoPregao = dataBR(g.datas.ultimo_pregao);
  const prov = g.proveniencia;
  const nome = (c: CompanhiaListada) => nomeCurto(c, logos);
  const semLogo = (logos?.logos ?? []).filter((l) => !l.arquivo);

  const linhas: LinhaListadas[] = cs.map((c) => {
    const f = ultimaFin(c);
    return {
      id: c.papel,
      href: rotaFicha(c),
      nome: nome(c),
      papel: c.papel,
      logo: logoDe(logos, c.papel),
      valores: {
        peso: c.iee.peso_pct,
        mw: c.atuacao.geracao ? c.geracao.mw_controle : null,
        km: c.transmissao?.km_circuito_operacao ?? null,
        ucs: c.distribuicao?.unidades_consumidoras != null ? c.distribuicao.unidades_consumidoras / 1000 : null,
        receita: f?.receita ?? null,
        lucro: f?.lucro_liquido ?? null,
        margem: f?.margem_ebit_pct ?? null,
        divpl: f?.divida_bruta_sobre_pl ?? null,
        r12: c.bolsa?.retorno_12m?.total_pct ?? null,
        r20: c.bolsa?.retorno_desde_2020?.total_pct ?? null,
        vol: c.bolsa?.volume_medio_diario_3m != null ? c.bolsa.volume_medio_diario_3m / 1e6 : null,
        fatos: c.movimentos.fatos_relevantes_24m,
      },
    };
  });

  const matriz = matrizAtuacao(g).map((m) => {
    const c = cs.find((x) => x.papel === m.papel)!;
    return { ...m, nome: nome(c), href: rotaFicha(c), logo: logoDe(logos, c.papel) };
  });

  // participações cruzadas declaradas no FRE entre companhias da carteira (ex.: Cemig na Taesa)
  const cruzadas = participacoesCruzadas(g);
  const textoCruzadas = (c: CompanhiaListada) => cruzadas.filter((x) => x.de.papel === c.papel).map((x) => textoCruzada(x, nome));
  const labControle: CompanhiaLabControle[] = cs
    .filter((c) => c.atuacao.geracao)
    .map((c) => ({
      papel: c.papel,
      nome: nome(c),
      mwControle: c.geracao.mw_controle,
      mwProporcional: c.geracao.mw_proporcional,
      porNivel: (c.geracao.por_nivel ?? []).map((x) => ({ nivel: x.nivel, mw: x.mw_controle, usinas: x.usinas })),
      cruzadas: textoCruzadas(c),
    }));
  // começa por uma companhia que é controladora de outra da carteira em controle compartilhado (o caso que mais confunde)
  const inicialControle =
    cruzadas.find((x) => x.controlador && labControle.some((l) => l.papel === x.de.papel))?.de.papel ?? labControle.find((x) => x.cruzadas.length)?.papel ?? labControle[0]?.papel ?? "";

  const labRetorno: PapelLab[] = cs
    .filter((c) => c.bolsa && !c.bolsa.motivo && c.bolsa.mensal.length)
    .map((c) => ({
      papel: c.papel,
      nome: nome(c),
      mensal: c.bolsa!.mensal,
      eventos: [
        ...c.bolsa!.eventos_acoes.map((e) => ({
          data_ex: e.data_ex,
          texto: `${dataBR(e.data_ex)}: evento em ações (multiplicador ${num(e.multiplicador, 2)}): o fechamento de tela cai na data ex e o preço ajustado não.`,
        })),
        ...c.bolsa!.bonificacoes_outra_classe.map((e) => ({
          data_ex: e.data_fechamento,
          texto: `${dataBR(e.data_fechamento)}: bonificação em ações de outra classe, valorizada em R$ ${num(e.valor, 2)} por ação pelo primeiro fechamento da classe recebida (estimativa do observatório).`,
        })),
      ],
    }));
  // começa por um papel com bonificação publicada pela B3 e proventos no período: as três linhas se separam
  const inicialRetorno =
    cs.find((c) => c.bolsa && !c.bolsa.motivo && c.bolsa.eventos_acoes.some((e) => e.data_ex >= "2021-01-01") && (c.bolsa.proventos_12m ?? 0) > 0)?.papel ??
    labRetorno.find((x) => x.eventos.length)?.papel ??
    labRetorno[0]?.papel ??
    "";

  // índice de retorno total mensal em base 100 no fim de 2020 (papel que estreou depois parte do primeiro mês)
  const meses = Array.from(new Set(cs.flatMap((c) => (c.bolsa?.mensal ?? []).map((x) => x[0])))).sort();
  const base100 = Object.fromEntries(
    cs.map((c) => {
      const m = c.bolsa?.mensal ?? [];
      const ini = m.find((x) => x[0] >= "2020-12") ?? null;
      return [c.papel, { ini, mapa: new Map(m.map((x) => [x[0], x[3]])) }];
    }),
  );
  const dadosMultiplos = meses
    .filter((m) => m >= "2020-12")
    .map((m) => {
      const linha: Record<string, string | number | null> = { m };
      for (const c of cs) {
        const b = base100[c.papel];
        const v = b.mapa.get(m);
        linha[c.papel] = b.ini && v !== undefined ? (100 * v) / b.ini[3] : null;
      }
      return linha;
    });
  const estreias = estreiasDepoisDe2020(g);
  const barras12 = cs.map((c) => ({ papel: c.papel, nome: `${nome(c)} (${c.papel})`, preco: c.bolsa?.retorno_12m?.preco_pct ?? null, total: c.bolsa?.retorno_12m?.total_pct ?? null }));
  const r12 = cs.find((c) => c.bolsa?.retorno_12m)?.bolsa?.retorno_12m ?? null;

  const fatos = cs
    .flatMap((c) => c.movimentos.recentes.map((f) => ({ ...f, c })))
    .sort((a, b) => b.data_entrega.localeCompare(a.data_entrega))
    .slice(0, 18);
  const barrasFatos = cs.map((c) => ({ papel: c.papel, nome: `${nome(c)} (${c.papel})`, fatos: c.movimentos.fatos_relevantes_24m }));
  const mudancas = cs.flatMap((c) => c.controle.mudancas.map((m) => ({ ...m, c })));
  const especies = porEspecieControle(g);

  const notasPainel = {
    oQueMudou: (
      <>
        A carteira do IEE é a de {dataCart}; a B3 revisa o índice a cada quatro meses e o painel acompanha a carteira do dia da coleta. Cotações até {ultimoPregao}; demonstrações até o exercício de{" "}
        {exercicio ?? "sem dado"}.
      </>
    ),
    comoInterpretar: (
      <>
        Cada companhia é medida pela própria cadeia de controle: usinas, linhas e distribuidoras cuja dona está abaixo dela entre controladores únicos declarados à ANEEL. Unidades diferentes não se
        somam, e companhias diferentes também não: uma pode ter participação na outra.
      </>
    ),
    naoConcluir: (
      <>
        Quem é melhor investimento ou empresa mais eficiente: retorno passado não indica retorno futuro, o tamanho dos ativos não mede rentabilidade e as margens dependem da composição dos negócios
        (distribuição registra receita de construção). Participações minoritárias e em controle compartilhado não entram nas medidas de ativos.
      </>
    ),
  };

  return (
    <>
      <CabecalhoEnergia atual="empresas" />
      <MarcaVisita secao="energia:empresas-listadas" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina">
        <EmpresasNavegacao atual="listadas" />
        <CabecalhoModulo
          rotulo="Empresas"
          siglas={["IEE", "B3", "CVM", "FRE", "FCA", "IPE", "SIGA", "SIGET", "ANEEL", "EBIT"]}
          titulo="Quem são as companhias listadas de energia elétrica?"
          lead={`As ${g.universo.companhias} companhias da carteira do Índice de Energia Elétrica (IEE) da B3: os ativos que cada uma controla, quem a controla, os números que publica e como as ações se comportaram.`}
          recorte={`Carteira do IEE de ${dataCart} · ativos do SIGA de ${dataBR(g.datas.siga)} · cotações até ${ultimoPregao} · DFP até ${exercicio ?? "sem dado"}`}
          fonte="B3 (índice, cotações e proventos); CVM (FCA, FRE, DFP e IPE); ANEEL (SIGA, SIGET e Composição Societária)"
          limite="Não ordena companhias por mérito: a ordem padrão é o peso no índice, e cada medida tem a sua unidade e a sua data."
          referencia={
            <>
              {g.universo.regra} {g.universo.nota} Processado em {carimbo(g.gerado_em)}.
            </>
          }
          datas={
            <EmpresasDatas
              itens={[
                { rotulo: "Carteira do IEE", texto: `de ${dataCart}`, natureza: "OBSERVADO" },
                { rotulo: "Usinas (SIGA)", texto: `até ${dataBR(g.datas.siga)}`, natureza: "OBSERVADO" },
                { rotulo: "Transmissão (SIGET)", texto: `até ${dataBR(g.datas.siget)}`, natureza: "OBSERVADO" },
                { rotulo: "Composição societária (ANEEL)", texto: `referência ${g.datas.polimero_trimestre ?? "sem dado"}`, natureza: "OBSERVADO" },
                { rotulo: "Formulário de Referência (CVM)", texto: `formulários de ${g.datas.fre_anos.join(", ")}`, natureza: "OBSERVADO" },
                { rotulo: "Demonstrações (CVM, DFP)", texto: `até o exercício de ${exercicio ?? "sem dado"}`, natureza: "OBSERVADO" },
                { rotulo: "Cotações (B3)", texto: `até ${ultimoPregao}`, natureza: "OBSERVADO" },
                { rotulo: "Fatos relevantes (CVM, IPE)", texto: `de ${dataBR(g.datas.ipe_desde)} em diante`, natureza: "OBSERVADO" },
              ]}
            />
          }
          metricas={
            <FaixaMetricas colunas={4} rotulo="Atuação das companhias da carteira" nota="Contagens de companhias, não de ativos; uma companhia pode atuar em mais de um segmento.">
              <Numero variante="faixa" rotulo="Companhias na carteira do IEE" natureza="OBSERVADO" valor={g.universo.companhias} formato="num" casas={0} unidade="companhias" periodo={`carteira de ${dataCart}`} />
              <Numero variante="faixa" rotulo="Controlam usinas em operação" natureza="CALCULADO" valor={n.geracao} formato="num" casas={0} unidade="companhias" periodo={`SIGA de ${dataBR(g.datas.siga)}`} />
              <Numero variante="faixa" rotulo="Controlam linhas de transmissão" natureza="CALCULADO" valor={n.transmissao} formato="num" casas={0} unidade="companhias" periodo={`SIGET de ${dataBR(g.datas.siget)}`} />
              <Numero variante="faixa" rotulo="Controlam distribuidoras" natureza="CALCULADO" valor={n.distribuicao} formato="num" casas={0} unidade="companhias" periodo="índice de distribuidoras" />
            </FaixaMetricas>
          }
        >
          O painel começa pelas companhias que a própria B3 reúne no índice setorial de energia elétrica. Cada papel é ligado à companhia pelo código CVM publicado pela B3 e conferido no código de
          negociação que a companhia declara no Formulário Cadastral ({SIGLAS.FCA}). Os ativos vêm dos cadastros da ANEEL já usados no módulo Empresas, pelo CNPJ; nada é ligado por semelhança de nome.
        </CabecalhoModulo>

        <ModoProfundidade>
          <Bloco id="listadas">
            <section aria-labelledby="quem-titulo" className="space-y-4 pb-8" id="quem">
              <h2 id="quem-titulo" className="ed-h2 font-serif text-carvao">
                As companhias da carteira
              </h2>
              <RespostaCurta id="quem" tamanho="sm" veredito={respostaPanorama(g)}>
                {g.universo.regra} Soma dos pesos lidos: {num(g.universo.soma_pesos_pct, 3)}%. {g.universo.nota}
              </RespostaCurta>
              <ul className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3" data-cartoes-listadas="">
                {cs.map((c) => {
                  const ctrl = controladoresFre(c);
                  const r = c.bolsa?.retorno_12m;
                  return (
                    <li key={c.papel} className="flex min-w-0 flex-col gap-2 border-t border-linha pt-4">
                      <div className="flex items-center gap-3">
                        <ListadasLogo logo={logoDe(logos, c.papel)} nome={nome(c)} decorativo={!!logoDe(logos, c.papel)?.arquivo} />
                        <div className="min-w-0 leading-tight">
                          <Link href={rotaFicha(c)} className={`${link} font-serif text-lg`}>
                            {nome(c)}
                          </Link>
                          <p className="text-xs text-mineral">
                            {c.papel} · {c.iee.segmento_nome ?? c.iee.segmento ?? "segmento sem dado"} · {pct(c.iee.peso_pct, 2)} do IEE
                          </p>
                        </div>
                      </div>
                      <p className="flex flex-wrap gap-1.5" aria-label="Segmentos com ativos sob controle">
                        {(["geracao", "transmissao", "distribuicao"] as const).map((s) => (
                          <span
                            key={s}
                            className={`rounded-sm border px-1.5 py-0.5 text-xs ${c.atuacao[s] ? "border-energia text-energia-dark" : "border-linha text-mineral line-through"}`}
                          >
                            {s === "geracao" ? "Geração" : s === "transmissao" ? "Transmissão" : "Distribuição"}
                            <span className="sr-only">{c.atuacao[s] ? ": atua" : ": não atua"}</span>
                          </span>
                        ))}
                      </p>
                      <p className="text-sm leading-relaxed text-carvao-muted">
                        {ctrl.length || c.controle.fre?.pessoas_fisicas?.controladores
                          ? comPonto(`Controle declarado: ${[...ctrl.map((a) => a.nome), ...(c.controle.fre?.pessoas_fisicas?.controladores ? ["pessoas físicas"] : [])].join(", ")}`)
                          : "Sem acionista controlador declarado no Formulário de Referência."}
                      </p>
                      <p className="text-xs text-mineral">
                        Retorno total em 12 meses: <span className="tabular-nums text-carvao">{sinalPct(r?.total_pct)}</span>
                        {r ? ` (até ${dataBR(r.ate)})` : ""}
                      </p>
                    </li>
                  );
                })}
              </ul>
              {semLogo.length > 0 && (
                <p className="max-w-prose2 text-xs leading-relaxed text-carvao-muted">
                  Símbolos: arquivos oficiais publicados pelas próprias companhias, sem alteração. Sem arquivo oficial obtido: {semLogo.map((l) => `${l.nome_exibicao} (${l.ausencia?.motivo ?? "motivo não registrado"})`).join("; ")}. O nome aparece em texto.
                </p>
              )}
            </section>

            <PainelEvidencia
              id="ativos"
              pergunta="Quais ativos cada companhia controla?"
              subtitulo="Geração em MW, transmissão em km de circuito, distribuição em unidades consumidoras · cada coluna na sua escala"
              natureza="CALCULADO"
              porQueImporta={<>Saber em que segmento cada companhia atua e com que escala é o ponto de partida para ler o resultado, o risco regulatório e a exposição a cada mercado.</>}
              oQueMudou={notasPainel.oQueMudou}
              comoInterpretar={<>A barra de cada coluna é a fração do maior valor da mesma coluna. Uma companhia pode ter a maior barra numa coluna e nenhuma em outra; as colunas não se somam.</>}
              naoConcluir={notasPainel.naoConcluir}
              proveniencia={prov.ativos}
              complementares={[{ rotulo: "Carteira do IEE", p: prov.carteira }]}
            >
              <ListadasMatriz linhas={matriz} legenda={`Ativos sob controle de cada companhia da carteira do IEE de ${dataCart}`} />
              <p className="mt-3 max-w-prose2 text-xs leading-relaxed text-carvao-muted">
                {g.definicoes.sob_controle} {g.definicoes.mw_controle}
              </p>
            </PainelEvidencia>

            <PainelEvidencia
              id="controle"
              pergunta="Quem controla cada companhia?"
              subtitulo="Controladores declarados no Formulário de Referência da CVM e espécie de controle declarada no Formulário Cadastral"
              natureza="OBSERVADO"
              porQueImporta={<>O controlador define estratégia, dividendos e investimento. Estado, grupos estrangeiros, famílias e companhias sem controlador definido respondem a incentivos diferentes.</>}
              oQueMudou={
                <>
                  Posições declaradas nos Formulários de Referência de {g.datas.fre_anos.join(", ")}; cada acionista traz a data da última alteração que a companhia informou. {mudancas.length} mudanças de pelo menos 0,5 ponto
                  percentual entre o formulário anterior e o atual.
                </>
              }
              comoInterpretar={<>Controlador é o acionista que a companhia marca como tal. Pessoas físicas aparecem somadas, sem nome. A espécie de controle é a que a própria companhia declara à CVM.</>}
              naoConcluir={<>A posição no formulário pode estar desatualizada entre uma entrega e outra; para mudança recente, confira os fatos relevantes da companhia.</>}
              proveniencia={prov.controle}
              complementares={[{ rotulo: "Cadeia de controle (ANEEL)", p: prov.ativos }]}
            >
              <div className="space-y-6">
                <div className="tabela-scroll overflow-x-auto" role="region" aria-label="Controle de cada companhia" tabIndex={0}>
                  <table className="w-full min-w-[760px] border-collapse text-sm">
                    <caption className="sr-only">Controle declarado de cada companhia da carteira</caption>
                    <thead>
                      <tr className="text-left text-xs text-carvao-muted">
                        <th scope="col" className="pb-2 pr-3 font-medium">Companhia</th>
                        <th scope="col" className="pb-2 pr-3 font-medium">Espécie de controle (FCA)</th>
                        <th scope="col" className="pb-2 pr-3 font-medium">Controladores e acionistas de referência (FRE)</th>
                        <th scope="col" className="pb-2 font-medium">Topo da cadeia declarada à ANEEL</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cs.map((c) => (
                        <tr key={c.papel} className="border-t border-linha align-top">
                          <th scope="row" className="py-2 pr-3 text-left font-normal">
                            <Link href={`${rotaFicha(c)}#controle`} className={link}>
                              {nome(c)}
                            </Link>
                            <span className="block text-xs text-mineral">{c.papel}</span>
                          </th>
                          <td className="py-2 pr-3 text-carvao">{c.controle.especie_fca ?? "sem dado"}</td>
                          <td className="py-2 pr-3 text-carvao-muted">{textoControle(c)}</td>
                          <td className="py-2 text-carvao-muted">
                            {c.controle.topo_cnpj === c.cnpj ? "A própria companhia" : (c.controle.topo_nome ?? c.controle.topo_cnpj)}
                            <span className="block text-xs text-mineral">{MOTIVO_TOPO[c.controle.motivo_parada] ?? c.controle.motivo_parada}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <SecaoDoPainel id="especies" titulo="Como as companhias declaram o próprio controle?" lead="Agrupamento pela espécie de controle que cada companhia declara à CVM no Formulário Cadastral.">
                  <ul className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                    {especies.map((e) => (
                      <li key={e.especie} className="border-l-2 border-linha pl-3">
                        <p className="rotulo text-mineral">{e.especie}</p>
                        <p className="text-sm text-carvao">{e.papeis.map((p) => nome(cs.find((c) => c.papel === p)!)).join(", ")}</p>
                      </li>
                    ))}
                  </ul>
                </SecaoDoPainel>
                <SecaoDoPainel
                  id="lab-controle"
                  titulo="Laboratório: como ler uma cadeia de controle"
                  lead="Os ativos de um grupo listado raramente estão na própria companhia: ficam em controladas e em controladas das controladas. Mova os degraus para ver quanto da potência sob controle está em cada nível, e compare comando (sob controle) com propriedade direta (proporcional)."
                >
                  {labControle.length > 0 ? (
                    <ListadasLabControle companhias={labControle} inicial={inicialControle} />
                  ) : (
                    <p className="text-sm text-carvao-muted">Nenhuma companhia com usinas sob controle nesta publicação.</p>
                  )}
                </SecaoDoPainel>
                {mudancas.length > 0 && (
                  <SecaoDoPainel id="mudancas" titulo="Que posições acionárias mudaram entre os dois últimos formulários?" lead="Entradas, saídas e variações de pelo menos 0,5 ponto percentual no total de ações, como declaradas.">
                    <ul className="space-y-1 text-sm text-carvao-muted">
                      {mudancas.map((m) => (
                        <li key={`${m.c.papel}-${m.acionista}-${m.tipo}`}>
                          <span className="text-carvao">{nome(m.c)}</span>: {m.acionista}{" "}
                          {m.tipo === "entrada" ? `passa a constar com ${pct(m.depois, 2)}` : m.tipo === "saida" ? `deixa de constar (tinha ${pct(m.antes, 2)})` : `de ${pct(m.antes, 2)} para ${pct(m.depois, 2)}`}
                        </li>
                      ))}
                    </ul>
                  </SecaoDoPainel>
                )}
              </div>
            </PainelEvidencia>

            <PainelEvidencia
              id="desempenho"
              pergunta="Como as ações das companhias se comportaram?"
              subtitulo="Retorno total (proventos reinvestidos) e retorno de preço ajustado, em % · índice mensal em base 100 no fim de 2020"
              natureza="CALCULADO"
              porQueImporta={<>O retorno total é o que o acionista obteve com a ação e os proventos; o preço sozinho subestima companhias que distribuem muito do lucro, como as transmissoras.</>}
              oQueMudou={<>Cotações da série histórica da B3 até {ultimoPregao}; proventos e eventos em ações publicados pela B3 por emissor.</>}
              comoInterpretar={<>{g.definicoes.retorno_total} {g.definicoes.retorno_preco}</>}
              naoConcluir={<>Retorno passado não indica retorno futuro, e janelas diferentes contam histórias diferentes. Não é recomendação de investimento.</>}
              proveniencia={prov.bolsa}
            >
              <div className="space-y-6">
                <GraficoBarras
                  titulo={r12 ? `Retorno em 12 meses, até ${dataBR(r12.ate)}` : "Retorno em 12 meses"}
                  dados={barras12}
                  chaveCategoria="papel"
                  chaveRotulo="nome"
                  series={[
                    { id: "preco", rotulo: "Preço ajustado", cor: "var(--serie-comp-4)" },
                    { id: "total", rotulo: "Retorno total", cor: "var(--cor-energia)" },
                  ]}
                  unidade="%"
                  casas={1}
                  orientacao="horizontal"
                  rotulosValor
                  alturaMaxima={760}
                />
                <PequenosMultiplos
                  titulo="Retorno total acumulado desde o fim de 2020 (base 100 em dez/2020)"
                  dados={dadosMultiplos}
                  chaveX="m"
                  formatoX="mes"
                  unidade="base 100"
                  casas={0}
                  colunas={4}
                  escala="compartilhada"
                  paineis={cs.map((c) => ({
                    id: c.papel,
                    titulo: `${nome(c)} (${c.papel})`,
                    nota: estreias.some((e) => e.papel === c.papel) ? `série começa em ${dataBR(c.bolsa!.primeiro_pregao)}` : undefined,
                  }))}
                  sincronizarCursor={false}
                />
                <SecaoDoPainel
                  id="lab-retorno"
                  titulo="Laboratório: fechamento de tela, preço ajustado e retorno total"
                  lead="Escolha um papel. O fechamento de tela é o que a bolsa mostra no dia; ele cai na data de uma bonificação sem que o acionista perca nada. O preço ajustado corrige isso, e o retorno total soma os proventos."
                >
                  {labRetorno.length > 0 ? <ListadasLabRetorno papeis={labRetorno} inicial={inicialRetorno} /> : <p className="text-sm text-carvao-muted">Sem séries de cotações nesta publicação.</p>}
                </SecaoDoPainel>
                {cs.some((c) => c.bolsa?.notas.length || c.bolsa?.emendas.length) && (
                  <SecaoDoPainel id="notas-bolsa" titulo="O que muda a leitura das séries?" nivel="analisar">
                    <ul className="space-y-1.5 text-sm leading-relaxed text-carvao-muted">
                      {cs.flatMap((c) => [
                        ...(c.bolsa?.emendas ?? []).map((e) => (
                          <li key={`${c.papel}-em-${e.codigo_anterior}`}>
                            {c.papel}: a série emenda {e.codigo_anterior} (até {dataBR(e.ultimo_pregao_anterior)}) e {e.codigo} (desde {dataBR(e.primeiro_pregao)}), mesma companhia e mesma classe no Formulário
                            Cadastral.
                          </li>
                        )),
                        ...(c.bolsa?.notas ?? []).map((t) => (
                          <li key={`${c.papel}-${t}`}>
                            {c.papel}: {datasLegiveis(t)}
                          </li>
                        )),
                      ])}
                    </ul>
                  </SecaoDoPainel>
                )}
              </div>
            </PainelEvidencia>

            <PainelEvidencia
              id="comparacao"
              pergunta="Como se comparam os indicadores financeiros e de mercado?"
              subtitulo={`Ativos sob controle, demonstrações consolidadas do exercício de ${exercicio ?? "sem dado"} e bolsa até ${ultimoPregao} · clique no cabeçalho para ordenar`}
              natureza="CALCULADO"
              porQueImporta={<>Receita, lucro, alavancagem e retorno na mesma linha permitem localizar cada companhia; a ficha de cada uma mostra a série e o contexto.</>}
              oQueMudou={notasPainel.oQueMudou}
              comoInterpretar={<>{g.definicoes.margem_ebit} {g.definicoes.divida_bruta_sobre_pl}</>}
              naoConcluir={notasPainel.naoConcluir}
              proveniencia={prov.financas ?? prov.bolsa}
              complementares={[{ rotulo: "Bolsa", p: prov.bolsa }, { rotulo: "Ativos", p: prov.ativos }]}
            >
              <ListadasTabela colunas={COLUNAS} linhas={linhas} legenda="Companhias da carteira do IEE: ativos, finanças e bolsa" />
              <p className="mt-2 text-xs text-carvao-muted">
                Ausência é &quot;sem dado&quot; e fica no fim de qualquer ordenação.{" "}
                {cs.filter((c) => c.bolsa && !c.bolsa.motivo && !c.bolsa.retorno_desde_2020).length > 0 &&
                  `Retorno desde o fim de 2020 sem dado para ${cs
                    .filter((c) => c.bolsa && !c.bolsa.motivo && !c.bolsa.retorno_desde_2020)
                    .map((c) => `${c.papel} (série desde ${dataBR(c.bolsa!.primeiro_pregao)}${c.bolsa!.serie_reiniciada_em ? ", recomeçada depois de evento em ações sem fator publicado pela B3" : ", estreia na bolsa"})`)
                    .join("; ")}: a ficha de cada uma mostra o retorno desde o início da série. `}
                Arquivo completo:{" "}
                <a className={link} href="/energia/series/listadas_companhias.csv">
                  listadas_companhias.csv
                </a>
                .
              </p>
            </PainelEvidencia>

            <PainelEvidencia
              id="movimentos"
              pergunta="Como as companhias têm se movimentado?"
              subtitulo={`Fatos relevantes entregues à CVM de ${dataBR(g.datas.ipe_desde)} em diante · contagem e os mais recentes`}
              natureza="OBSERVADO"
              porQueImporta={<>Aquisições, vendas de ativos, emissões, mudanças de controle e decisões regulatórias aparecem primeiro nos fatos relevantes.</>}
              oQueMudou={<>Documentos do IPE da CVM capturados diariamente.</>}
              comoInterpretar={<>O assunto é o título que a própria companhia deu ao documento; o link leva ao arquivo no sistema da CVM.</>}
              naoConcluir={<>Mais fatos relevantes não significa mais risco nem mais atividade: cada companhia decide o que comunica como fato relevante.</>}
              naoConcluirNoCorpo
              proveniencia={prov.movimentos}
            >
              <div className="space-y-6">
                <GraficoBarras
                  titulo={`Fatos relevantes por companhia, desde ${dataBR(g.datas.ipe_desde)}`}
                  dados={barrasFatos}
                  chaveCategoria="papel"
                  chaveRotulo="nome"
                  series={[{ id: "fatos", rotulo: "Fatos relevantes", cor: "var(--cor-energia)" }]}
                  unidade="documentos"
                  casas={0}
                  orientacao="horizontal"
                  rotulosValor
                  alturaMaxima={640}
                />
                <NotasDoPainel
                  oQueMudou={<>Documentos do IPE da CVM capturados diariamente.</>}
                  comoInterpretar={<>O assunto é o título que a própria companhia deu ao documento; o link leva ao arquivo no sistema da CVM.</>}
                  naoConcluir={<>Mais fatos relevantes não significa mais risco nem mais atividade: cada companhia decide o que comunica como fato relevante.</>}
                />
                <SecaoDoPainel id="recentes" titulo="Os fatos relevantes mais recentes">
                  <ol className="space-y-2">
                    {fatos.map((f) => (
                      <li key={`${f.c.papel}-${f.protocolo ?? f.data_entrega}-${f.assunto}`} className="grid gap-x-4 text-sm sm:grid-cols-[6.5rem_9rem_1fr]">
                        <time dateTime={f.data_entrega} className="tabular-nums text-mineral">
                          {dataBR(f.data_entrega)}
                        </time>
                        <Link href={`${rotaFicha(f.c)}#movimentos`} className={link}>
                          {nome(f.c)}
                        </Link>
                        <span className="text-carvao">
                          {f.link ? (
                            <a href={f.link} className={link} rel="noopener noreferrer">
                              {f.assunto ?? "Fato relevante sem assunto informado"}
                              <span className="sr-only"> (documento na CVM)</span>
                            </a>
                          ) : (
                            (f.assunto ?? "Fato relevante sem assunto informado")
                          )}
                        </span>
                      </li>
                    ))}
                  </ol>
                </SecaoDoPainel>
              </div>
            </PainelEvidencia>

            <section aria-labelledby="dados-titulo" className="space-y-3 border-t border-linha pt-6" id="dados-do-painel">
              <h2 id="dados-titulo" className="ed-h3 font-serif text-carvao">
                Dados para baixar
              </h2>
              <ul className="grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                {g.downloads.map((d) => (
                  <li key={d.url}>
                    <a className={link} href={d.url}>
                      {d.rotulo}
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          </Bloco>
        </ModoProfundidade>
      </main>
    </>
  );
}
