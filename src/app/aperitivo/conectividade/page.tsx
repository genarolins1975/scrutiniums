import type { Metadata } from "next";
import { ConviteAperitivo } from "@/components/acesso/ConviteAperitivo";
import { BuscaConectividade } from "@/components/conectividade/BuscaConectividade";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { cobertos, consultarMunicipio, goldConectividade } from "@/lib/conectividade/dados";
import { dataCaptura, mesExtenso, milhoes, num, pct, SEM_DADO } from "@/lib/conectividade/formato";
import { comConta } from "@/lib/conectividade/convite";
import { hrefMunicipio, PERGUNTA_APERITIVO, ROTA_CONECTIVIDADE, SECAO_APERITIVO } from "@/lib/conectividade/paginas";
import type { MunicipioGold } from "@/lib/conectividade/tipos";
import { RotuloContexto } from "@/components/layout/RotuloContexto";

/**
 * Versão aperitivo da Conectividade (princípio do aperitivo, decisão do dono de 20/10/2026). Quem acessa /conectividade
 * sem sessão recebe esta página por rewrite (src/middleware.ts); quem tem conta recebe ali o painel completo. Responde
 * a uma pergunta só: como é a internet na minha cidade. Com ?ibge= de um município da gold, mostra os acessos de banda
 * larga fixa por 100 habitantes e a parte por fibra, quantas empresas vendem o serviço e a parte dos moradores dentro
 * da cobertura 4G e 5G, com unidade, mês, fonte, data da captura e a ressalva principal. Sem série, sem operadoras,
 * sem a maior prestadora, sem posição, sem comparação e sem arquivo para baixar: tudo isso fica com a conta, listado
 * no convite do fim.
 *
 * Renderização no servidor a cada requisição (lê searchParams): o HTML leva só os números do município pedido; o
 * navegador baixa apenas o índice de nomes da busca, já aberto (/saneamento/gold/indice.json).
 */
export const dynamic = "force-dynamic";

type Busca = { searchParams: Record<string, string | string[] | undefined> };

export function generateMetadata({ searchParams }: Busca): Metadata {
  const c = consultarMunicipio(searchParams.ibge);
  return {
    title: c.estado === "ok" ? `${c.m.nome} (${c.uf}): como é a internet · Conectividade` : `${PERGUNTA_APERITIVO} · Conectividade`,
    description: "Busque o município e veja quantos acessos de internet fixa ele tem por 100 habitantes, quantos são por fibra, quantas empresas atendem e quem está dentro da cobertura 4G e 5G, com fonte e data.",
    alternates: { canonical: ROTA_CONECTIVIDADE },
  };
}

export default function AperitivoConectividade({ searchParams }: Busca) {
  const g = goldConectividade();
  const c = consultarMunicipio(searchParams.ibge);
  const b = g.brasil;
  return (
    <main id="conteudo" className="cn-wrap cn-main" data-aperitivo="conectividade">
      <MarcaVisita secao={SECAO_APERITIVO} />
      <header className="cn-cabeca">
        <RotuloContexto rota="/conectividade" className="text-mineral" />
        <h1>{PERGUNTA_APERITIVO}</h1>
        <p className="cn-lead">Busque o município e veja quantos acessos de internet fixa ele tem, quantos são por fibra, quantas empresas atendem e quem está dentro da cobertura 4G e 5G.</p>
      </header>

      {c.estado === "ok" ? (
        <>
          <Retrato m={c.m} uf={c.uf} nomeUf={c.arquivo.nome_uf} />
          <div className="cn-busca">
            <BuscaConectividade rotulo="Buscar outro município" />
          </div>
        </>
      ) : (
        <>
          {c.estado === "invalida" && (
            <p role="status" className="cn-aviso">
              {c.codigo ? `Nenhum município da base da Anatel tem o código IBGE ${c.codigo}. Busque pelo nome abaixo.` : "O endereço não traz um código IBGE de município, que tem sete dígitos. Busque pelo nome abaixo."}
            </p>
          )}
          <div className="cn-busca">
            <BuscaConectividade rotulo="Digite o nome do município" />
          </div>
          <p className="cn-achado">
            No Brasil, em {mesExtenso(g.referencia.fixa)}, havia <strong>{milhoes(b.fixa.acessos)} de acessos de banda larga fixa</strong>, {num(b.fixa.densidade, 1)} para cada 100 habitantes,{" "}
            <strong>{pct(b.fixa.fibra_pct)} deles por fibra óptica</strong>. Em {mesExtenso(g.referencia.cobertura)}, <strong>{pct(b.cobertura.tecnologias.g5?.[0])} dos moradores</strong> estavam dentro
            da cobertura 5G e {pct(b.cobertura.tecnologias.g4?.[0])} dentro da 4G.
          </p>
          <ComoLer />
          <p className="cn-fonte">
            Fonte: {g.fontes.fixa.orgao}, {g.fontes.fixa.nome.toLowerCase()} ({mesExtenso(g.referencia.fixa)}) e {g.fontes.cobertura.nome.toLowerCase()} ({mesExtenso(g.referencia.cobertura)}). Dados
            capturados em {dataCaptura(g.fontes, ["fixa", "cobertura"])}.
          </p>
        </>
      )}

      {/* a volta do login leva o município: com sessão, o mesmo endereço com ?ibge= abre o painel completo nele */}
      <ConviteAperitivo rota={c.estado === "ok" ? hrefMunicipio(c.m.id) : ROTA_CONECTIVIDADE} comConta={c.estado === "ok" ? comConta(g, c.uf, c.m) : comConta(g, null)} className="mt-14" />
    </main>
  );
}

function ComoLer() {
  return (
    <div className="cn-ler" aria-label="Como ler estes números">
      <p>
        <strong>Acesso contratado, não pessoa conectada.</strong> A Anatel conta os contratos de banda larga fixa que as prestadoras declaram em cada município. Uma casa com um contrato e
        cinco moradores conta um acesso; uma empresa com cem linhas conta cem.
      </p>
      <p>
        <strong>Cobertura é a mancha declarada pela operadora.</strong> A parte dos moradores coberta sai do cruzamento entre os mapas das operadoras e os setores do Censo 2022. Estar
        dentro da mancha não garante sinal dentro de casa nem velocidade.
      </p>
    </div>
  );
}

function Retrato({ m, uf, nomeUf }: { m: MunicipioGold; uf: string; nomeUf: string }) {
  const g = goldConectividade();
  const f = m.fixa;
  const c = m.cobertura;
  const r = g.referencia;
  return (
    <section className="cn-retrato" aria-labelledby="retrato-titulo" data-resultado-aperitivo="">
      <header>
        <h2 id="retrato-titulo">
          {m.nome} <span className="cn-unidade">{nomeUf} ({uf})</span>
        </h2>
        <span className="cn-competencia">acessos de {mesExtenso(r.fixa)} · cobertura de {mesExtenso(r.cobertura)} · código IBGE {m.id}</span>
      </header>
      <dl>
        <div>
          <dt>Acessos de banda larga fixa por 100 habitantes</dt>
          <dd className="cn-valor cn-valor-acento">{f ? num(f.densidade, 1) : SEM_DADO}</dd>
          <dd className="cn-detalhe">{f ? `${num(f.acessos)} acessos contratados em ${mesExtenso(r.fixa)}; no Brasil, ${num(g.brasil.fixa.densidade, 1)} por 100 habitantes.` : "A Anatel não registra acessos fixos neste município."}</dd>
        </div>
        <div>
          <dt>Acessos por fibra óptica</dt>
          <dd className="cn-valor">{f ? pct(f.fibra_pct) : SEM_DADO}</dd>
          <dd className="cn-detalhe">{f ? `${num(f.prestadoras)} ${f.prestadoras === 1 ? "empresa vende" : "empresas vendem"} banda larga fixa na cidade.` : "Sem dado."}</dd>
        </div>
        <div>
          <dt>Moradores dentro da cobertura 5G</dt>
          <dd className="cn-valor cn-valor-acento">{pct(cobertos(m, "g5"))}</dd>
          <dd className="cn-detalhe">{c ? `${pct(cobertos(m, "g4"))} dentro da cobertura 4G, por qualquer operadora, em ${mesExtenso(r.cobertura)}; ${num(c.moradores)} moradores no Censo 2022.` : "A Anatel não publica a cobertura deste município nesta edição; o motivo não vem na fonte."}</dd>
        </div>
      </dl>
      <ComoLer />
      <p className="cn-fonte">
        Fonte: {g.fontes.fixa.orgao}, {g.fontes.fixa.nome.toLowerCase()} ({mesExtenso(r.fixa)}) e {g.fontes.cobertura.nome.toLowerCase()} ({mesExtenso(r.cobertura)}). Dados capturados em{" "}
        {dataCaptura(g.fontes, ["fixa", "cobertura"])}. Densidade como a Anatel publica (acessos por 100 habitantes); partes em %: cálculo da Scrutiniums.
      </p>
    </section>
  );
}
