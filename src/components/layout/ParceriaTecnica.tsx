import { CERI } from "@/lib/parceiros";
import { tx } from "@/lib/energia/idioma";
import type { Idioma } from "@/lib/idioma";

type Variante = "faixa" | "linha" | "bloco" | "compacto";

/**
 * Crédito da parceria técnica com o FGV CERI, sempre com a marca oficial
 * (src/lib/parceiros.ts, manifesto em public/home/parceiros) e o link para o
 * site do centro. Três lugares, um só componente:
 *
 *  - `faixa`: linha discreta no fim do cabeçalho dos módulos de infraestrutura
 *    (Setor Elétrico, Gás Natural, Saneamento e Combustíveis), alinhada à
 *    direita, presente com e sem sessão;
 *  - `linha`: o mesmo crédito sem faixa própria, para entrar numa faixa que o
 *    cabeçalho já tem (no Setor Elétrico, a das páginas do grupo, em tela
 *    larga): a marca fica no cabeçalho e o cabeçalho perde uma faixa;
 *  - `bloco`: faixa no fim da primeira seção da página inicial, com a frase
 *    que diz o que a parceria é e onde a marca aparece (em português nas duas
 *    homes: a home inglesa só traduz o herói e fixa as seções do <main>);
 *  - `compacto`: rótulo e marca numa linha, para a entrada e o mapa do
 *    Observatório de Energia e Infraestrutura.
 *
 * O lockup é o de endosso (com o nome por extenso do centro): é o único que o
 * kit recebido traz. Abaixo de uns 60 px de altura as três linhas pequenas
 * viram textura, e "FGV CERI" continua legível; na faixa a marca tem 32 px no
 * celular e 36 px em tela larga, e o alt diz o nome completo. Um símbolo
 * isolado, se o CERI o fornecer, substitui a faixa sem mudar o resto.
 */
export function ParceriaTecnica({ variante = "faixa", idioma, escuro = false }: Readonly<{ variante?: Variante; idioma?: Idioma; escuro?: boolean }>) {
  const rotulo = tx("Parceria técnica", "Technical partnership", idioma);
  const alt = tx(`${CERI.nome}, ${CERI.descricao}`, `${CERI.nome}, ${CERI.descricaoEn}`, idioma);
  const nomeDoLink = tx(`${rotulo}: ${CERI.nome} (site do centro, em nova aba)`, `${rotulo}: ${CERI.nome} (the center's website, in a new tab)`, idioma);
  const imagem = (classe: string) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={escuro ? CERI.arquivoEscuro : CERI.arquivo}
      alt={alt}
      width={CERI.largura}
      height={CERI.altura}
      decoding="async"
      className={`w-auto ${classe}`}
    />
  );
  const ligacao = { href: CERI.url, target: "_blank", rel: "noopener noreferrer", "aria-label": nomeDoLink } as const;

  if (variante === "bloco") {
    return (
      <section data-parceria={CERI.id} aria-labelledby="parceria-titulo" className="border-t border-linha bg-papel">
        <div className="mx-auto flex max-w-page flex-col gap-6 px-6 py-10 md:flex-row md:items-center md:justify-between md:gap-12 md:py-12">
          <div className="min-w-0">
            <h2 id="parceria-titulo" className="rotulo text-mineral">{rotulo}</h2>
            <p className="mt-3 max-w-prose2 text-base leading-relaxed text-carvao-muted md:text-lg">
              {tx(
                `O ${CERI.nome}, ${CERI.descricao}, é parceiro técnico da Scrutiniums. A marca do centro acompanha os painéis de energia e infraestrutura: Setor Elétrico, Gás Natural, Saneamento e Combustíveis.`,
                `${CERI.nome}, the ${CERI.descricaoEn}, is Scrutiniums' technical partner. The center's mark accompanies the energy and infrastructure panels: Setor Elétrico, Gás Natural, Saneamento and Combustíveis.`,
                idioma,
              )}
            </p>
          </div>
          <a {...ligacao} className="inline-flex min-h-[44px] shrink-0 items-center self-start py-2 md:self-center">
            {imagem("h-14 md:h-[4.5rem]")}
          </a>
        </div>
      </section>
    );
  }

  if (variante === "compacto") {
    return (
      <p data-parceria={CERI.id} className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="rotulo text-mineral">{rotulo}</span>
        <a {...ligacao} className="inline-flex min-h-[44px] items-center">
          {imagem("h-8")}
        </a>
      </p>
    );
  }

  if (variante === "linha") {
    return (
      <p data-parceria={CERI.id} className="flex shrink-0 items-center gap-3">
        {/* a faixa do Setor Elétrico tem fundo energia-fundo, onde o mineral fica abaixo de 4,5:1: o rótulo usa o cinza dos atalhos vizinhos */}
        <span className="rotulo whitespace-nowrap text-carvao-muted">{rotulo}</span>
        <a {...ligacao} className="inline-flex min-h-[44px] items-center">
          {imagem("h-8")}
        </a>
      </p>
    );
  }

  return (
    <div data-parceria={CERI.id} className="border-t border-linha">
      <div className="ed-pagina flex min-h-[44px] items-center justify-end gap-3 md:min-h-[52px]">
        <span className="rotulo text-mineral">{rotulo}</span>
        <a {...ligacao} className="inline-flex min-h-[44px] items-center">
          {imagem("h-8 md:h-9")}
        </a>
      </div>
    </div>
  );
}
