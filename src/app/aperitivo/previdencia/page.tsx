import type { Metadata } from "next";
import { ConviteAperitivo } from "@/components/acesso/ConviteAperitivo";
import { BuscaPrevidencia } from "@/components/previdencia/BuscaPrevidencia";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { brasilDezembro, consultarMunicipio, goldPrevidencia, municipioNoAno } from "@/lib/previdencia/dados";
import { dataBr, num, reais, reaisGrandes } from "@/lib/previdencia/formato";
import { PERGUNTA_APERITIVO, ROTA_PREVIDENCIA, SECAO_APERITIVO, hrefMunicipio } from "@/lib/previdencia/paginas";
import { comConta } from "@/lib/previdencia/convite";
import type { MunicipioGold } from "@/lib/previdencia/tipos";
import { RotuloContexto } from "@/components/layout/RotuloContexto";
import { tituloNaColecao } from "@/lib/observatorios/contexto";

/**
 * Versão aperitivo da Previdência e INSS (princípio do aperitivo, decisão do dono de 20/10/2026). Quem acessa
 * /contas-publicas/previdencia sem sessão recebe esta página por rewrite (src/middleware.ts); quem tem conta recebe ali o
 * painel completo. Responde a uma pergunta só: quanto o INSS paga na minha cidade. Com ?ibge= de um município da gold,
 * mostra quantos benefícios foram emitidos em dezembro do último ano do arquivo municipal e o valor médio líquido, com
 * unidade, competência, fonte, data da captura e a ressalva principal (município do órgão pagador, créditos e não
 * pessoas, valor líquido). Sem série, sem comparação, sem tipos detalhados e sem arquivo para baixar: tudo isso fica
 * com a conta, listado no convite do fim.
 *
 * Renderização no servidor a cada requisição (lê searchParams): o HTML leva só os números do município pedido; o
 * navegador baixa apenas o índice de nomes da busca, já aberto (/saneamento/gold/indice.json).
 */
export const dynamic = "force-dynamic";

type Busca = { searchParams: Record<string, string | string[] | undefined> };

export function generateMetadata({ searchParams }: Busca): Metadata {
  const c = consultarMunicipio(searchParams.ibge);
  return {
    title: c.estado === "ok" ? tituloNaColecao(`${c.m.nome} (${c.uf}): quanto o INSS paga · Previdência e INSS`, "/contas-publicas/previdencia") : tituloNaColecao(`${PERGUNTA_APERITIVO} · Previdência e INSS`, "/contas-publicas/previdencia"),
    description: "Busque o município e veja quantos benefícios o INSS emitiu por meio das agências da cidade em dezembro e o valor médio líquido de cada um, com fonte e data.",
    alternates: { canonical: ROTA_PREVIDENCIA },
  };
}

export default function AperitivoPrevidencia({ searchParams }: Busca) {
  const g = goldPrevidencia();
  const c = consultarMunicipio(searchParams.ibge);
  const br = brasilDezembro(g);
  const capturaMunicipios = dataBr(g.fontes.municipios.capturado_em);
  return (
    <main id="conteudo-previdencia" className="cp-wrap cp-main" data-aperitivo="previdencia">
      <MarcaVisita secao={SECAO_APERITIVO} />
      <header className="pv-cabeca">
        <RotuloContexto rota="/contas-publicas/previdencia" className="text-mineral" />
        <h1>{PERGUNTA_APERITIVO}</h1>
        <p className="pv-lead">
          Busque o município e veja quantos benefícios o INSS pagou por meio das agências da cidade em dezembro de {br.ano} e quanto vale, em média, cada um.
        </p>
      </header>

      {c.estado === "ok" ? (
        <>
          <Extrato m={c.m} uf={c.uf} nomeUf={c.arquivo.nome_uf} anos={c.arquivo.anos} />
          <div className="pv-busca">
            <BuscaPrevidencia rotulo="Buscar outro município" />
          </div>
        </>
      ) : (
        <>
          {c.estado === "invalida" && (
            <p role="status" className="pv-aviso">
              {c.codigo ? `Nenhum município da base do INSS tem o código IBGE ${c.codigo}. Busque pelo nome abaixo.` : "O endereço não traz um código IBGE de município, que tem sete dígitos. Busque pelo nome abaixo."}
            </p>
          )}
          <div className="pv-busca">
            <BuscaPrevidencia rotulo="Digite o nome do município" />
          </div>
          <p className="pv-achado">
            No Brasil, em dezembro de {br.ano}, o INSS emitiu <strong>{num(br.q.total)} benefícios</strong>, com valor médio líquido de{" "}
            <strong>{reais(br.v.total / br.q.total)}</strong> por benefício, somados os {num(br.municipios)} municípios.
          </p>
          <ComoLer />
          <p className="pv-fonte">
            Fonte: {g.fontes.municipios.orgao}, {g.fontes.municipios.nome.toLowerCase()}, competência dezembro de {br.ano}. Dados capturados em {capturaMunicipios}. Valores nominais, em reais.
          </p>
        </>
      )}

      {/* a volta do login leva o município: com sessão, o mesmo endereço com ?ibge= abre o painel completo nele */}
      <ConviteAperitivo rota={c.estado === "ok" ? hrefMunicipio(c.m.id) : ROTA_PREVIDENCIA} comConta={c.estado === "ok" ? comConta(g, c.uf, { m: c.m, anos: c.arquivo.anos }) : comConta(g, null)} className="mt-14" />
    </main>
  );
}

function ComoLer() {
  return (
    <div className="pv-ler" aria-label="Como ler estes números">
      <p>
        <strong>Agência que paga, não endereço de quem recebe.</strong> O Ministério da Previdência classifica cada benefício pelo município do órgão pagador, a agência bancária
        onde ele é pago. Quem mora numa cidade e recebe na agência da cidade vizinha entra na conta da vizinha.
      </p>
      <p>
        <strong>Benefícios, não pessoas.</strong> A quantidade conta créditos emitidos no mês: quem recebe aposentadoria e pensão conta duas vezes. O valor é líquido, depois de descontos como o
        empréstimo consignado.
      </p>
    </div>
  );
}

function Extrato({ m, uf, nomeUf, anos }: { m: MunicipioGold; uf: string; nomeUf: string; anos: number[] }) {
  const g = goldPrevidencia();
  // o ano mais recente em que o município aparece no arquivo (o último, salvo município ausente nele)
  let i = anos.length - 1;
  while (i > 0 && !m.q[i]) i--;
  const d = municipioNoAno(m, i);
  const ano = anos[i];
  return (
    <section className="pv-extrato" aria-labelledby="extrato-titulo" data-resultado-aperitivo="">
      <header>
        <h2 id="extrato-titulo">
          {m.nome} <span className="pv-unidade">{nomeUf} ({uf})</span>
        </h2>
        <span className="pv-competencia">Competência dezembro de {ano} · código IBGE {m.id}</span>
      </header>
      {d ? (
        <dl>
          <div>
            <dt>Benefícios pagos pelo INSS no mês</dt>
            <dd className="pv-valor">
              {num(d.q.total)}
              <span className="pv-unidade">benefícios</span>
            </dd>
            <dd className="pv-detalhe">Aposentadorias, pensões, auxílios e benefícios assistenciais, como o BPC, pagos por agências da cidade.</dd>
          </div>
          <div>
            <dt>Valor médio de cada benefício</dt>
            <dd className="pv-valor pv-valor-acento">
              {reais(d.q.total ? d.v.total / d.q.total : null)}
              <span className="pv-unidade">líquido, no mês</span>
            </dd>
            <dd className="pv-detalhe">Somados, {reaisGrandes(d.v.total)} líquidos em dezembro de {ano}, em valores da época.</dd>
          </div>
        </dl>
      ) : (
        <p className="pv-aviso">O arquivo do Ministério da Previdência não traz este município em dezembro de {ano}. Ausência de dado, não zero.</p>
      )}
      <ComoLer />
      <p className="pv-fonte">
        Fonte: {g.fontes.municipios.orgao}, {g.fontes.municipios.nome.toLowerCase()}, competência dezembro de {ano}. Dados capturados em {dataBr(g.fontes.municipios.capturado_em)}. Valor médio
        calculado pela Scrutiniums: valor líquido do mês dividido pela quantidade.
      </p>
    </section>
  );
}
