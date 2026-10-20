import type { Metadata } from "next";
import Link from "next/link";
import { ConviteAperitivo } from "@/components/acesso/ConviteAperitivo";
import { SeloComConta } from "@/components/acesso/SeloComConta";
import { BuscaEducacao } from "@/components/educacao/BuscaEducacao";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { consultarMunicipio, goldEducacao, idebRecente, manchete } from "@/lib/educacao/dados";
import { comConta } from "@/lib/educacao/convite";
import { dataBr, ideb } from "@/lib/educacao/formato";
import { NOME_ETAPA, PERGUNTA_APERITIVO, ROTA_CAPITAIS, ROTA_EDUCACAO, SECAO_APERITIVO, SERIES_ETAPA, TEXTO_MOTIVO, TITULO_CAPITAIS, hrefMunicipio } from "@/lib/educacao/paginas";
import { prefetchDoLink } from "@/lib/rotasPublicas";
import { ETAPAS, type GoldEducacao, type MunicipioGold } from "@/lib/educacao/tipos";

/**
 * Versão aperitivo da Educação nos municípios (princípio do aperitivo, decisão do dono de 20/10/2026). Quem acessa
 * /educacao-municipal sem sessão recebe esta página por rewrite (src/middleware.ts); quem tem conta recebe ali o painel
 * completo. Responde a uma pergunta só: como está a escola pública da minha cidade. Com ?ibge= de um município da gold,
 * mostra o Ideb mais recente da rede municipal nos anos iniciais e, quando houver, nos finais, com ano, escala, fonte,
 * data da captura e a ressalva principal; sem Ideb, o motivo. Sem série, sem comparação, sem componentes e sem arquivo
 * para baixar: tudo isso fica com a conta, listado no convite do fim.
 *
 * Renderização no servidor a cada requisição (lê searchParams): o HTML leva só os números do município pedido; o
 * navegador baixa apenas o índice de nomes da busca, já aberto (/saneamento/gold/indice.json).
 */
export const dynamic = "force-dynamic";

type Busca = { searchParams: Record<string, string | string[] | undefined> };

export function generateMetadata({ searchParams }: Busca): Metadata {
  const c = consultarMunicipio(searchParams.ibge);
  return {
    title: c.estado === "ok" ? `${c.m.nome} (${c.uf}): a escola pública da cidade · Educação nos municípios` : `${PERGUNTA_APERITIVO} · Educação nos municípios`,
    description: "Busque o município e veja o Ideb mais recente das escolas da prefeitura, nos anos iniciais e finais do ensino fundamental, com fonte e data.",
    alternates: { canonical: ROTA_EDUCACAO },
  };
}

export default function AperitivoEducacao({ searchParams }: Busca) {
  const g = goldEducacao();
  const c = consultarMunicipio(searchParams.ibge);
  const k = manchete(g);
  return (
    <main id="conteudo-educacao" className="ed-pagina edm-main" data-aperitivo="educacao-municipal">
      <MarcaVisita secao={SECAO_APERITIVO} />
      <header className="edm-cabeca">
        <h1>{PERGUNTA_APERITIVO}</h1>
        <p className="edm-lead">
          Busque o município e veja o Ideb {g.ideb.ano} das escolas da prefeitura, o índice do INEP que junta o aprendizado dos alunos e a aprovação, nos anos iniciais e finais do
          ensino fundamental.
        </p>
      </header>

      {c.estado === "ok" ? (
        <>
          <Extrato g={g} m={c.m} uf={c.uf} nomeUf={c.arquivo.nome_uf} />
          <div className="edm-busca">
            <BuscaEducacao rotulo="Buscar outro município" />
          </div>
        </>
      ) : (
        <>
          {c.estado === "invalida" && (
            <p role="status" className="edm-aviso">
              {c.codigo ? `Nenhum município da base tem o código IBGE ${c.codigo}. Busque pelo nome abaixo.` : "O endereço não traz um código IBGE de município, que tem sete dígitos. Busque pelo nome abaixo."}
            </p>
          )}
          <div className="edm-busca">
            <BuscaEducacao rotulo="Digite o nome do município" />
          </div>
          <p className="edm-achado">
            No Brasil, em {k.ano}, o Ideb das redes municipais foi <strong>{ideb(k.ai)}</strong> nos anos iniciais e <strong>{ideb(k.af)}</strong> nos anos finais, numa escala de 0 a 10.
          </p>
          <ComoLer />
          <Fonte g={g} />
        </>
      )}

      {/* a volta do login leva o município: com sessão, o mesmo endereço com ?ibge= abre o painel completo nele */}
      <ConviteAperitivo
        rota={c.estado === "ok" ? hrefMunicipio(c.m.id) : ROTA_EDUCACAO}
        comConta={c.estado === "ok" ? comConta(g, { m: c.m, uf: c.uf }) : comConta(g, null)}
        className="mt-14"
      />
    </main>
  );
}

function ComoLer() {
  return (
    <div className="edm-ler" aria-label="Como ler o Ideb">
      <p>
        <strong>O Ideb junta aprendizagem e aprovação.</strong> É a nota dos alunos na prova do Saeb, em português e matemática, multiplicada por um indicador de aprovação. Vai de 0
        a 10 e sai a cada dois anos.
      </p>
      <p>
        <strong>Rede municipal é a escola da prefeitura.</strong> O número não é o de cada escola nem o da rede estadual: o INEP calcula o resultado com todos os alunos da rede.
      </p>
    </div>
  );
}

function Fonte({ g }: { g: GoldEducacao }) {
  const f = g.fontes.ideb;
  return (
    <p className="edm-fonte">
      Fonte: INEP, Ideb {f.edicao}, resultados por município, divulgados em {dataBr(f.publicado_em)}. Dados capturados em {dataBr(f.capturado_em)}. Escala de 0 a 10, com uma casa
      decimal, como o INEP publica.
    </p>
  );
}

function Extrato({ g, m, uf, nomeUf }: { g: GoldEducacao; m: MunicipioGold; uf: string; nomeUf: string }) {
  return (
    <section className="edm-extrato" aria-labelledby="extrato-titulo" data-resultado-aperitivo="">
      <header>
        <h2 id="extrato-titulo">
          {m.nome} <span className="edm-unidade">{nomeUf} ({uf})</span>
        </h2>
        <span className="edm-competencia">Ideb {g.ideb.ano} · rede municipal · código IBGE {m.id}</span>
      </header>
      <dl>
        {ETAPAS.map((e) => {
          const b = m[e];
          const v = idebRecente(b.municipal);
          const pub = idebRecente(b.publica);
          return (
            <div key={e}>
              <dt>
                {NOME_ETAPA[e]}
                <small>{SERIES_ETAPA[e]} · escolas da prefeitura</small>
              </dt>
              {v !== null ? (
                <dd className="edm-valor">{ideb(v)}<span className="edm-unidade">de 0 a 10</span></dd>
              ) : (
                <dd className="edm-sem">
                  <strong>Sem Ideb {g.ideb.ano}</strong>
                  {b.motivo_municipal ? TEXTO_MOTIVO[b.motivo_municipal] : null}
                  {b.motivo_municipal === "sem_matricula" && pub !== null ? ` A rede pública da cidade, que atende essa etapa, teve Ideb ${ideb(pub)}.` : null}
                </dd>
              )}
            </div>
          );
        })}
      </dl>
      {m.capital && (
        <p className="edm-capital">
          <span>{m.nome} é capital: o gasto da prefeitura com educação e a comparação com as outras capitais estão no painel</span>
          <Link href={ROTA_CAPITAIS} prefetch={prefetchDoLink(ROTA_CAPITAIS)} className="edm-toque">
            {TITULO_CAPITAIS}
            <SeloComConta href={ROTA_CAPITAIS} />
          </Link>
        </p>
      )}
      <ComoLer />
      <Fonte g={g} />
    </section>
  );
}
