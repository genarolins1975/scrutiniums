import type { Metadata } from "next";
import { MarcaVisita } from "@/components/telemetria/MarcaVisita";
import { BuscaLugar } from "@/components/lugar/BuscaLugar";
import { CartoesDoLugar } from "@/components/lugar/CartoesDoLugar";
import { fichaDoLugar } from "@/lib/lugar/ficha";
import { PERGUNTA_LUGAR, ROTA_LUGAR, SECAO_LUGAR, TITULO_LUGAR } from "@/lib/lugar/paginas";

/**
 * Ficha do lugar (eixo do lugar, pedido do dono de 10/11/2026): o leitor escolhe o município uma vez e vê, numa página,
 * o que cada coleção publica sobre ele, com fonte e período, e os números do estado. Cada cartão leva à ficha do tema já
 * no mesmo município. Renderização no servidor a cada requisição (lê ?ibge=): o HTML leva só os números do município
 * pedido. O lugar vive só no endereço; nada é gravado na conta (parecer de UX de 23/10/2026, I3).
 */
export const dynamic = "force-dynamic";

type Busca = { searchParams: Record<string, string | string[] | undefined> };

export function generateMetadata({ searchParams }: Busca): Metadata {
  const f = fichaDoLugar(searchParams.ibge);
  return {
    title: f.estado === "ok" ? `${f.nome}, ${f.uf} · ${TITULO_LUGAR}` : TITULO_LUGAR,
    description: "Água, esgoto, escola, internet, INSS e queimadas do seu município numa página só, com os números do estado, cada um com fonte e período.",
    alternates: { canonical: ROTA_LUGAR },
    robots: { index: false },
  };
}

const H1 = "mt-4 max-w-4xl font-serif text-[clamp(2rem,4.4vw,3.2rem)] leading-[1.1] text-carvao [text-wrap:balance]";

export default function MinhaCidadePage({ searchParams }: Busca) {
  const f = fichaDoLugar(searchParams.ibge);
  return (
    <div className="bg-papel" data-lugar={f.estado === "ok" ? f.id : f.estado}>
      <MarcaVisita secao={SECAO_LUGAR} />
      <section aria-labelledby="lugar-titulo" className="border-b border-linha bg-marfim">
        <div className="mx-auto max-w-page px-6 pb-10 pt-8 md:pb-12 md:pt-12">
          <p className="rotulo text-mineral">{TITULO_LUGAR}</p>
          {f.estado === "ok" ? (
            <>
              <h1 id="lugar-titulo" className={H1}>
                {f.nome}, {f.nomeUf}
              </h1>
              <p className="mt-5 max-w-prose2 text-base leading-relaxed text-carvao-muted md:text-lg">
                O que cinco coleções da plataforma publicam sobre o município, cada número com a sua fonte e o seu período. Os números vêm de bases diferentes e não se
                somam nem se comparam entre si.
              </p>
              <div className="mt-8 max-w-2xl">
                <BuscaLugar rotulo="Trocar de município" />
              </div>
            </>
          ) : (
            <>
              <h1 id="lugar-titulo" className={H1}>
                {PERGUNTA_LUGAR}
              </h1>
              <p className="mt-5 max-w-prose2 text-base leading-relaxed text-carvao-muted md:text-lg">
                Digite o nome do município uma vez e veja, numa página só, água e esgoto, escola, internet, INSS e queimadas, com os números do estado. Cada número traz
                fonte e período e leva à ficha completa do tema.
              </p>
              {f.estado === "invalida" && (
                <p role="status" className="mt-5 max-w-prose2 border-l-2 border-carvao pl-4 text-sm leading-relaxed text-carvao">
                  {f.codigo ? `Nenhum município da lista do IBGE tem o código ${f.codigo}. Busque pelo nome abaixo.` : "O endereço não traz um código IBGE de município, que tem sete dígitos. Busque pelo nome abaixo."}
                </p>
              )}
              <div className="mt-8 max-w-2xl">
                <BuscaLugar rotulo="Qual é o seu município?" />
              </div>
              <p className="mt-4 max-w-prose2 text-xs leading-relaxed text-mineral">
                A escolha fica só no endereço da página. A plataforma não usa a sua localização nem grava o município na sua conta.
              </p>
            </>
          )}
        </div>
      </section>

      {f.estado === "ok" && (
        <>
          <CartoesDoLugar
            id="na-cidade"
            titulo={`Em ${f.nome}`}
            descricao="Números do próprio município. Indisponível quer dizer que a fonte não publicou o dado para ele; não é zero."
            cartoes={f.cidade}
          />
          <CartoesDoLugar
            id="no-estado"
            titulo={`No estado: ${f.nomeUf}`}
            descricao="O que as fontes só publicam por estado. Vale para o estado inteiro, não para o município."
            cartoes={f.noEstado}
            acao="Abrir o painel"
          />
          <CartoesDoLugar
            id="consultas"
            titulo="Consultas com outro recorte"
            descricao="Temas que não têm número por município: a consulta pede uma escolha a mais."
            cartoes={f.consultas}
            acao="Abrir a consulta"
          />
          <div className="mx-auto max-w-page px-6 pb-10 pt-6 md:pb-12">
            <details className="border-t border-linha pt-4" data-fatia="metodo">
              <summary className="rotulo flex min-h-[44px] cursor-pointer items-center text-carvao-muted hover:text-carvao">Método e fontes</summary>
              <div className="mt-2 max-w-prose2 space-y-3 text-sm leading-relaxed text-carvao-muted">
                <p>
                  Esta página não calcula nada: cada número é o mesmo da ficha do tema, lido da mesma base, e leva o período que a fonte publica. Por isso os períodos são
                  diferentes entre os cartões.
                </p>
                <p>
                  O município é identificado pelo código de sete dígitos do IBGE ({f.id}). Água e esgoto vêm do SINISA, informados pelos prestadores; o Ideb, do INEP; a
                  internet, da Anatel; os benefícios, do Ministério da Previdência Social; os focos de calor, do INPE. O método de cada um está na página de método da
                  coleção.
                </p>
                <p>Comparar municípios por um número isolado não mostra por que ele é alto ou baixo: porte, renda e geografia mudam cada medida.</p>
              </div>
            </details>
          </div>
        </>
      )}
    </div>
  );
}
