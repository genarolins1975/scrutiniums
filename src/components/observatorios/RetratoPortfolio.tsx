import { Fragment } from "react";
import { SeloProntidao } from "@/components/observatorios/SeloProntidao";
import type { RessalvaColecao, RetratoColecao, RetratoObservatorio } from "@/lib/observatorios/mapaConta";

/**
 * Tamanho e prontidão de um observatório e das suas coleções nas páginas abertas (home e /perguntas/[porta]; recomendação 6 do
 * parecer estrutural, "portfólio honesto"). Só apresenta: os números vêm de `retratoDoPortfolio` (src/lib/observatorios/mapaConta.ts),
 * a mesma conta do mapa da área logada, e o estado usa a forma única `SeloProntidao`. Nenhuma contagem é escrita aqui;
 * `src/tests/portfolio-honesto.test.ts` confere cada número exibido com o registro.
 */
const plural = (n: number, um: string, varios: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;

/** "5 coleções · 17 páginas": as páginas no ar cujo dono é o observatório, sem cópias e sem as de outros observatórios. */
export function TamanhoObservatorio({ retrato, className = "" }: Readonly<{ retrato: RetratoObservatorio; className?: string }>) {
  return (
    <span data-retrato-observatorio={retrato.id} data-colecoes={retrato.colecoes.length} data-paginas={retrato.proprias} className={`tabular-nums ${className}`}>
      {plural(retrato.colecoes.length, "coleção", "coleções")} · {plural(retrato.proprias, "página", "páginas")}
    </span>
  );
}

/**
 * A frase inteira do observatório, para a página aberta dele: coleções, páginas próprias, páginas de outros observatórios que as
 * coleções também apresentam (a soma das duas é a soma das contagens das coleções) e o que não é "publicado".
 */
export function FraseObservatorio({ retrato, className = "" }: Readonly<{ retrato: RetratoObservatorio; className?: string }>) {
  const r = retrato;
  return (
    <p data-retrato-observatorio={r.id} data-colecoes={r.colecoes.length} data-paginas={r.proprias} data-de-outros={r.deOutros} className={className}>
      <span className="tabular-nums text-carvao">
        {plural(r.colecoes.length, "coleção", "coleções")} e {plural(r.proprias, "página", "páginas")}
      </span>{" "}
      deste observatório.
      {r.deOutros > 0 && <> As coleções também apresentam {plural(r.deOutros, "página de outro observatório", "páginas de outros observatórios")}.</>}
      {r.parciais > 0 && (
        <>
          {" "}
          {plural(r.parciais, "página com", "páginas com")} <SeloProntidao valor="parcial" />.
        </>
      )}
      {r.previstas > 0 && (
        <>
          {" "}
          {plural(r.previstas, "prevista no catálogo e ainda sem página", "previstas no catálogo e ainda sem página")}: <SeloProntidao valor="preparacao" />.
        </>
      )}
    </p>
  );
}

function Ressalva({ r }: Readonly<{ r: RessalvaColecao }>) {
  const selo = <SeloProntidao valor={r.valor} />;
  // coleção inteira: só o selo; parcial contada: páginas dentro da contagem; em preparação: fora dela
  if (r.paginas === null) return selo;
  return (
    <span className="whitespace-nowrap tabular-nums">
      {r.valor === "preparacao" ? `mais ${r.paginas.toLocaleString("pt-BR")}` : `${r.paginas.toLocaleString("pt-BR")} com`} {selo}
    </span>
  );
}

/** "10 páginas" e, quando a coleção não é "publicado" em tudo, o selo: "20 páginas · 13 com ◐ cobertura parcial". */
export function EstadoColecao({ colecao }: Readonly<{ colecao: RetratoColecao }>) {
  return (
    <span data-retrato-colecao={colecao.id} data-paginas={colecao.paginas} className="tabular-nums">
      {plural(colecao.paginas, "página", "páginas")}
      {colecao.ressalvas.map((r) => (
        <Fragment key={r.valor}>
          {" · "}
          <Ressalva r={r} />
        </Fragment>
      ))}
    </span>
  );
}

/** Só as ressalvas, para a linha que já nomeia a coleção ("Saneamento: 13 com ◐ cobertura parcial"). */
export function RessalvasColecao({ colecao }: Readonly<{ colecao: RetratoColecao }>) {
  return (
    <span data-ressalvas-colecao={colecao.id}>
      {colecao.ressalvas.map((r, i) => (
        <Fragment key={r.valor}>
          {i > 0 && ", "}
          <Ressalva r={r} />
        </Fragment>
      ))}
    </span>
  );
}
