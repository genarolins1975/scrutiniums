import Link from "next/link";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { dataBR, mesAno, plural } from "@/lib/energia/formato";
import type { Natureza } from "@/lib/energia/tipos";
import type { IdSociedade, ItemSociedade, SociedadeVisao } from "@/lib/energia/tipos-visao";
import { ROTA_VISAO, URL_GOLD_VISAO, avisoSemBastidor, diasEntre, dominioTempo, faixasTempo, minuscula, periodoCurto, textoComplemento, valorSociedade } from "@/lib/energia/visao";

/**
 * Energia e sociedade (P006): tarifa residencial de referência, continuidade (DEC e FEC),
 * perdas na distribuição e alcance da Tarifa Social, cada um com o valor e a evidência do
 * módulo de origem, o seu período (vigência, ano ou mês), a defasagem até o processamento,
 * a cobertura e a atualidade do conjunto. A linha do tempo mostra o período de cada número
 * contra a data de processamento, para que nenhum seja lido como situação do dia.
 *
 * Componente de servidor (o diálogo de prova é o único pedaço cliente).
 */

const COR_ITEM: Record<string, string> = {
  tarifa: "var(--serie-comp-1)",
  continuidade: "var(--serie-comp-2)",
  perdas: "var(--serie-comp-3)",
  beneficios: "var(--serie-comp-4)",
};

function Cartao({ it, i, nota }: { it: ItemSociedade; i: number; nota?: string | null }) {
  const atrasado = it.atualidade?.situacao === "ATRASADO";
  return (
    <article id={`sociedade-${it.id}`} aria-labelledby={`sociedade-${it.id}-titulo`} className="relative flex min-w-0 flex-col border border-linha bg-superficie p-4">
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px]" style={{ background: COR_ITEM[it.id] ?? "var(--cor-energia)" }} />
      <h3 id={`sociedade-${it.id}-titulo`} className="rotulo text-mineral">
        {it.titulo}
      </h3>
      <p className="mt-1 text-xs text-carvao-muted">{it.pergunta}</p>
      <p className="mt-2 font-serif text-2xl leading-tight tabular-nums text-carvao" data-valor-sociedade={it.id}>
        {valorSociedade(it)}
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-mineral">
        <span className="border border-linha px-1.5 text-carvao-muted">{periodoCurto(it)}</span>
        <span>não é a situação do dia</span>
        <SeloNatureza natureza={it.natureza as Natureza} />
      </p>
      <p className={`mt-2 text-xs leading-relaxed ${atrasado ? "text-aviso" : "text-carvao-muted"}`}>{it.defasagem.texto}</p>
      {nota && (
        <p className="mt-2 text-xs leading-relaxed text-carvao" data-nota-sociedade={it.id}>
          <span className="rotulo mr-2 text-mineral">Para ler junto</span>
          {nota}
        </p>
      )}
      {it.complementos.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-linha pt-2 text-xs leading-relaxed text-carvao-muted">
          {it.complementos.map((c) => {
            const aviso = c.aviso ? avisoSemBastidor(c.aviso) : null;
            return (
              <li key={c.rotulo}>
                <span className="text-carvao">{c.rotulo}</span>
                {c.mes ? ` (${c.mes.length === 7 ? mesAno(c.mes) : c.mes})` : ""}: {textoComplemento(c)}
                {aviso ? `. ${aviso.leitor}` : ""}
                {aviso?.detalhe && <span data-nivel="analisar"> Detalhe da exclusão: {aviso.detalhe}.</span>}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-xs leading-relaxed text-carvao-muted">{it.aviso}</p>
      <p data-nivel="analisar" className="mt-2 text-xs leading-relaxed text-carvao-muted [overflow-wrap:anywhere]">
        Cobertura: {it.cobertura}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-2">
        <ComproveNumero sobDemanda={{ url: URL_GOLD_VISAO, caminho: `sociedade.itens[${i}].evidencia`, indicador: it.titulo, valorExibido: it.evidencia.valor_exibido }} endereco={`${ROTA_VISAO}#sociedade-${it.id}`} />
        {(it.evidencias_complementares ?? []).map((c, k) => (
          <ComproveNumero
            key={c.caminho}
            sobDemanda={{ url: URL_GOLD_VISAO, caminho: `sociedade.itens[${i}].evidencias_complementares[${k}].evidencia`, indicador: `${it.titulo}, ${minuscula(it.complementos.find((x) => x.valor_exibido === c.evidencia.valor_exibido)?.rotulo ?? c.evidencia.indicador)}`, valorExibido: c.evidencia.valor_exibido }}
            rotulo={`Comprove: ${c.evidencia.valor_exibido}`}
            endereco={`${ROTA_VISAO}#sociedade-${it.id}`}
          />
        ))}
        <Link href={it.href} className="inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4">
          Ver no módulo
        </Link>
      </div>
    </article>
  );
}

export function VisaoSociedadeCartoes({ s, notas = {} }: { s: SociedadeVisao; notas?: Partial<Record<IdSociedade, string | null>> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {s.itens.map((it, i) => (
        <Cartao key={it.id} it={it} i={i} nota={notas[it.id]} />
      ))}
    </div>
  );
}

/**
 * Linha do tempo de referência: um trecho por indicador (o período a que o número se
 * refere) sobre o mesmo eixo, e a linha vertical da data de processamento. A distância
 * entre o fim do trecho e a linha é a defasagem, escrita ao lado em dias. Desenho em HTML
 * puro (posições em %, sem script); a tabela equivalente está logo abaixo na página.
 */
export function VisaoLinhaTempo({ s, dataProcessamento }: { s: SociedadeVisao; dataProcessamento: string }) {
  const faixas = faixasTempo(s, dataProcessamento);
  if (!faixas.length) return null;
  const dom = dominioTempo(faixas, dataProcessamento);
  const x = (iso: string) => (100 * diasEntre(dom.inicio, iso)) / dom.dias;
  const anos: string[] = [];
  for (let a = Number(dom.inicio.slice(0, 4)) + 1; a <= Number(dom.fim.slice(0, 4)); a++) anos.push(`${a}-01-01`);
  return (
    <figure className="space-y-2" aria-labelledby="linha-tempo-sociedade-titulo">
      <figcaption id="linha-tempo-sociedade-titulo" className="text-sm text-carvao">
        Período de referência de cada número contra a data de processamento ({dataBR(dataProcessamento)})
      </figcaption>
      <div className="relative" role="img" aria-label={faixas.map((f) => `${f.rotulo}: ${f.texto}, ${plural(f.defasagemDias, "dia", "dias")} antes do processamento`).join("; ")}>
        <div className="relative h-5 border-b border-linha text-xs text-mineral" aria-hidden="true">
          <span className="absolute left-0">{dataBR(dom.inicio)}</span>
          {anos.map((a) => (
            <span key={a} className="absolute -translate-x-1/2" style={{ left: `${x(a)}%` }}>
              {a.slice(0, 4)}
            </span>
          ))}
        </div>
        <ul className="relative space-y-3 pt-2" aria-hidden="true">
          {faixas.map((f) => {
            const x0 = x(f.inicio);
            const x1 = Math.max(x(f.fim), x0 + 0.6);
            return (
              <li key={f.id} className="relative">
                <p className="text-xs text-carvao">
                  {f.rotulo} <span className="text-mineral">· {f.texto} · {plural(f.defasagemDias, "dia", "dias")} até o processamento</span>
                </p>
                <div className="relative mt-1 h-3">
                  <span className="absolute inset-y-0 rounded-sm" style={{ left: `${x0}%`, width: `${x1 - x0}%`, background: COR_ITEM[f.id] ?? "var(--cor-energia)" }} />
                  <span className="absolute top-1/2 border-t border-dashed border-mineral" style={{ left: `${x1}%`, width: `${Math.max(0, 100 - x1)}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
        <span aria-hidden="true" className="absolute bottom-0 top-0 border-l-2 border-carvao" style={{ left: "calc(100% - 1px)" }} />
      </div>
      <p className="text-xs text-carvao-muted">
        Barra: período a que o número se refere. Tracejado: tempo até a data de processamento (linha vertical à direita). Anos completos e meses não descrevem o dia.
      </p>
    </figure>
  );
}
