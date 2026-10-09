import type { ReactNode } from "react";
import Link from "next/link";
import { CabecalhoEnergia } from "@/components/energia/CabecalhoEnergia";
import { NavegacaoLocal } from "@/components/energia/NavegacaoLocal";
import { SeguirPainel } from "@/components/energia/SeguirPainel";
import { Indisponivel } from "@/components/evidencia/Indisponivel";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { conceito } from "@/lib/energia/conteudo/conceitos";
import { PAINEIS_EMPRESAS, ROTA_EMPRESAS, painel, rotaPainel, type PainelEmpresas, type PassoVinculo } from "@/lib/energia/empresas";
import { SIGLAS } from "@/lib/energia/siglas";
import type { Natureza } from "@/lib/energia/tipos";

/**
 * Peças de servidor das páginas do módulo Empresas: a abertura (/setor-eletrico/empresas), um painel por página em /ativos,
 * /distribuidoras, /financas e /controle, e a ficha de cada distribuidora em /[entidade]. Aqui ficam a navegação local (faixa de
 * irmãs nas páginas filhas, capítulos na abertura), o recorte (período, universo e unidade) junto da figura principal, as datas de cada
 * fonte, os avisos de bloqueio, o diagrama dos elos entre empresa, ativo e controle e o rodapé com downloads, link com o recorte e
 * próxima pergunta.
 *
 * Por que um painel por página: cada painel tem tabelas de dezenas de linhas, gráficos com a tabela equivalente e fichas de prova;
 * juntos, os quatro passavam de 650 KB de HTML, acima da meta de cerca de 600 KB por página (contrato, seção 5.1). O mapa das usinas, a
 * árvore societária e as séries financeiras de outras companhias vêm de arquivos lidos no navegador só quando a pessoa pede.
 */

/** A abertura e as quatro páginas de painel como itens da navegação local; a descrição de cada uma é a pergunta que ela responde. */
const ITENS_EMPRESAS = [
  { id: "sintese", href: ROTA_EMPRESAS, rotulo: "Síntese", descricao: "Quem atua no setor elétrico?" },
  ...PAINEIS_EMPRESAS.map((p) => ({ id: p.id, href: rotaPainel(p.id), rotulo: p.rotulo, descricao: p.pergunta })),
];

/**
 * Faixa de páginas irmãs nas páginas filhas, com a atual marcada (na ficha de uma distribuidora, nenhuma). A abertura não leva a faixa:
 * mostra os mesmos destinos como capítulos logo depois da busca (EmpresasCapitulos), e o mesmo rótulo não aparece duas vezes.
 */
export function EmpresasNavegacao({ atual }: { atual: PainelEmpresas | "sintese" | "ficha" }) {
  if (atual === "sintese") return null;
  return <NavegacaoLocal rotulo="Páginas do módulo Empresas" itens={ITENS_EMPRESAS} atual={atual} />;
}

export type CapituloEmpresas = {
  id: PainelEmpresas;
  /** Resposta curta da página (RespostaCurta), com o veredito à vista e os números por trás em Analisar. */
  resposta: ReactNode;
  /** Número de abertura da página com a ficha de prova. */
  numero: ReactNode;
  /** Datas, fontes e universo da resposta. */
  contexto: ReactNode;
  /** O que a resposta não permite concluir, como complemento de "Não permite concluir". */
  limite: ReactNode;
  /** Atalhos para as fichas de entidades que a página reúne. */
  extra?: ReactNode;
};

/**
 * Capítulos da abertura: as quatro páginas do módulo, cada uma com o nome, a pergunta que responde, a resposta curta, um número com a
 * ficha de prova, o limite da leitura e o caminho para a página. Segue o desenho dos capítulos do sistema (nome, pergunta, link; a
 * página atual não entra), com a resposta no meio, porque a abertura responde às quatro perguntas antes de mandar o leitor adiante.
 * Fica logo depois da busca, fora do painel (título de seção em h2 e uma pergunta por h3); dentro de um painel, `nivelTitulo={3}`.
 */
export function EmpresasCapitulos({ itens, nivelTitulo = 2 }: { itens: CapituloEmpresas[]; nivelTitulo?: 2 | 3 }) {
  const Titulo = nivelTitulo === 2 ? "h2" : "h3";
  const TituloItem = nivelTitulo === 2 ? "h3" : "h4";
  return (
    <nav aria-label="Capítulos de Empresas" data-navegacao-local="capitulos" className="scroll-mt-28 pb-6" id="caminhos">
      <Titulo className={`${nivelTitulo === 2 ? "ed-h2" : "ed-h3"} font-serif text-carvao`}>Quatro caminhos, uma página para cada pergunta</Titulo>
      <ol className="mt-4 grid gap-x-10 gap-y-10 md:grid-cols-2">
        {itens.map((c) => {
          const p = painel(c.id);
          return (
            <li key={c.id} id={`sintese-${c.id}`} aria-labelledby={`sintese-${c.id}-titulo`} className="flex min-w-0 scroll-mt-28 flex-col gap-2.5">
              <p className="rotulo text-mineral">{p.rotulo}</p>
              <TituloItem id={`sintese-${c.id}-titulo`} className="ed-h3 font-serif text-carvao">
                {p.pergunta}
              </TituloItem>
              {c.resposta}
              {c.numero}
              <p className="text-xs leading-relaxed text-carvao-muted">{c.contexto}</p>
              <p className="text-sm leading-relaxed text-carvao-muted">
                <span className="rotulo mr-2 text-mineral">Não permite concluir</span>
                {c.limite}
              </p>
              {c.extra}
              <Link href={rotaPainel(c.id)} className="inline-flex min-h-[44px] items-center self-start text-sm text-energia-dark underline underline-offset-4 hover:text-carvao">
                Abrir {p.rotulo}
                <span className="sr-only">: gráficos, tabelas, dados e evidências</span>
                <span aria-hidden="true" className="ml-1.5">
                  →
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/**
 * Os quatro elos entre empresa, participação, ativo e controle: o identificador que documenta cada um e a contagem que a base publica.
 * Nenhum elo é feito por semelhança de nome. Lista ordenada (a ordem é a do vínculo), com a seta só como marca visual.
 */
export function EmpresasPassosVinculo({ passos }: { passos: PassoVinculo[] }) {
  return (
    <figure data-vinculo="" className="space-y-2">
      <ol className="grid gap-x-0 gap-y-5 md:grid-cols-4">
        {passos.map((p, i) => (
          <li key={p.id} className={`min-w-0 md:pr-5 ${i > 0 ? "md:border-l md:border-linha md:pl-5" : ""}`}>
            <p className="rotulo text-mineral">Elo {i + 1}</p>
            <p className="ed-h3 mt-1 font-serif text-carvao">
              {p.titulo}
              {i < passos.length - 1 && (
                <span aria-hidden="true" className="ml-2 hidden text-energia-soft md:inline">
                  →
                </span>
              )}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-carvao-muted">Documentado {p.liga}.</p>
            <p className="mt-1.5 text-sm leading-relaxed text-carvao">{p.contagem}.</p>
          </li>
        ))}
      </ol>
      <figcaption className="max-w-prose2 pt-1 text-xs leading-relaxed text-carvao-muted">
        Cada elo usa o identificador que a própria fonte publica no mesmo registro; nenhum é feito por semelhança de nome. As contagens são de universos
        diferentes e não se somam.
      </figcaption>
    </figure>
  );
}

/** Estado de ausência da gold inteira: a página diz o que falta, nunca mostra número de reserva. */
export function EmpresasIndisponivel({ motivo }: { motivo?: string | null }) {
  return (
    <>
      <CabecalhoEnergia atual="empresas" />
      <main id="conteudo" tabIndex={-1} className="ed-pagina py-14">
        <Indisponivel
          titulo="Empresas indisponível nesta publicação"
          motivo={
            motivo ??
            "Os dados do módulo Empresas não foram gerados ou não passaram na validação desta publicação. A última publicação válida é mantida quando existe, e nenhum número de reserva é exibido."
          }
        />
      </main>
    </>
  );
}

/** Período, universo e unidade do painel, logo abaixo da figura principal: o recorte que o leitor precisa para ler a medida. */
export function EmpresasRecorte({ periodo, universo, unidade }: { periodo: ReactNode; universo: ReactNode; unidade: ReactNode }) {
  return (
    <dl data-recorte-painel="" className="grid gap-x-6 gap-y-2 border-t border-linha pt-3 text-xs text-carvao-muted sm:grid-cols-3">
      <div>
        <dt className="rotulo text-mineral">Período</dt>
        <dd className="mt-0.5">{periodo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Universo</dt>
        <dd className="mt-0.5">{universo}</dd>
      </div>
      <div>
        <dt className="rotulo text-mineral">Unidade</dt>
        <dd className="mt-0.5">{unidade}</dd>
      </div>
    </dl>
  );
}

/** Datas de referência de cada fonte: cada número diz o seu dia, sem sugerir simultaneidade (bloco "Fontes, datas e siglas"). */
export function EmpresasDatas({ itens }: { itens: { rotulo: string; texto: string; natureza: Natureza }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-carvao-muted" aria-label="Datas de referência de cada fonte">
      {itens.map((x) => (
        <li key={x.rotulo} className="inline-flex flex-wrap items-center gap-1.5">
          <span>
            {x.rotulo}: {x.texto}
          </span>
          <SeloNatureza natureza={x.natureza} compacto />
        </li>
      ))}
    </ul>
  );
}

/** Rodapé do painel: downloads, link compartilhável com o recorte e a próxima pergunta, numa linha (SeguirPainel). */
export function EmpresasSeguir({
  ancora,
  proximo,
  downloads,
  extra,
}: {
  ancora: string;
  proximo: { href: string; pergunta: string };
  downloads: { rotulo: string; url: string }[];
  extra?: ReactNode;
}) {
  return <SeguirPainel ancora={ancora} proximo={proximo} downloads={downloads} extra={extra} />;
}

/** Aviso de limitação que muda a leitura (bloqueio de fonte, fonte defasada, medida não publicada). */
export function EmpresasAviso({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div role="note" className="border-l-2 border-mineral pl-3 text-sm leading-relaxed text-carvao-muted">
      <p className="rotulo text-mineral">{rotulo}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

/** Nota curta de leitura junto de uma figura, sem caixa: a visualização domina. */
export function EmpresasNota({ children }: { children: ReactNode }) {
  return <p className="max-w-prose2 text-sm leading-relaxed text-carvao-muted">{children}</p>;
}

/**
 * Como ler os números de continuidade e a tarifa, junto dos números: DEC e FEC com a frase que os verbetes publicam, o sentido da
 * diferença diante do limite e o que é a tarifa B1. Nenhuma definição é escrita aqui: as frases vêm dos verbetes (conferidos) e das
 * siglas do observatório.
 */
export function EmpresasComoLer() {
  const perdas = conceito("perdas-de-energia")?.emUmaFrase;
  const dec = conceito("dec")?.emUmaFrase;
  const fec = conceito("fec")?.emUmaFrase;
  // conversão de centésimos de hora em minutos, como o verbete do DEC a publica (sem número escrito aqui)
  const horas = conceito("dec")?.limitacoes?.find((x) => x.startsWith("Centésimos de hora"));
  return (
    <div className="space-y-1.5 border-l-2 border-linha pl-3 text-sm leading-relaxed text-carvao-muted" data-como-ler="continuidade-e-tarifa">
      <p className="rotulo text-mineral">Como ler perdas, continuidade e tarifa</p>
      {perdas && (
        <p>
          <span className="text-carvao">Perdas totais (SAMP, {SIGLAS.SAMP}).</span> {perdas} A taxa é a perda total medida, em % da energia injetada na rede da própria distribuidora.
        </p>
      )}
      {dec && (
        <p>
          <span className="text-carvao">DEC ({SIGLAS.DEC}).</span> {dec}
          {horas ? ` ${horas}` : ""}
        </p>
      )}
      {fec && (
        <p>
          <span className="text-carvao">FEC ({SIGLAS.FEC}).</span> {fec}
        </p>
      )}
      <p>
        O limite de DEC e de FEC é o que a ANEEL fixa para cada distribuidora. Nos gráficos de pontos, a diferença é o valor apurado menos o limite: diferença negativa quer dizer abaixo do limite, ou seja,
        dentro dele; diferença positiva, acima do limite.
      </p>
      <p>
        <span className="text-carvao">Tarifa B1.</span> A tarifa residencial é, no conjunto de dados da ANEEL, a do subgrupo B1. O valor é a soma da {SIGLAS.TE} (TE) e da {SIGLAS.TUSD} (TUSD), em R$/MWh, sem tributos e
        sem bandeira. O ato é a resolução homologatória em que a ANEEL a publica ({SIGLAS.REH}, REH).
      </p>
    </div>
  );
}
