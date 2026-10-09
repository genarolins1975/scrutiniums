import Link from "@/components/energia/LinkSemPrefetch";
import { ComproveNumero } from "@/components/energia/ComproveNumero";
import { SeloNatureza } from "@/components/evidencia/SeloNatureza";
import { dataBR, mesAno, plural } from "@/lib/energia/formato";
import type { Natureza } from "@/lib/energia/tipos";
import type { IdSociedade, ItemSociedade, SociedadeVisao } from "@/lib/energia/tipos-visao";
import {
  PERGUNTA_SOCIEDADE,
  ROTA_VISAO,
  URL_GOLD_VISAO,
  avisoSemBastidor,
  diasEntre,
  dominioTempo,
  enumLegivel,
  expandeSiglas,
  faixasTempo,
  minuscula,
  periodoCurto,
  textoCoberturaTarifa,
  textoComplemento,
  textoDecApurado,
  textoDenominadorPerdas,
  textoDispersaoDec,
  textoDispersaoPerdas,
  textoLimiteAgregado,
  textoUnidadeTarifa,
  tituloCartaoSociedade,
  valorSociedade,
  type ContextoSociedade,
} from "@/lib/energia/visao";

/**
 * Energia e sociedade (P006): tarifa residencial de referência, continuidade (DEC e FEC), perdas na distribuição e alcance da
 * Tarifa Social, cada um com o valor e a prova do módulo de origem, o seu período (vigência, ano ou mês), a defasagem até o
 * processamento, a cobertura e a atualidade do conjunto. A ressalva que muda a leitura do número fica junto dele: o que o DEC
 * apurado deixa de fora, o denominador da taxa de perdas e quantas distribuidoras a tarifa de referência cobre. A linha do tempo
 * mostra o período de cada número contra a data de processamento, para que nenhum seja lido como situação do dia.
 *
 * Os quatro cartões têm o mesmo tom neutro: a cor não indica melhor nem pior. Componente de servidor (o diálogo de prova é o único
 * pedaço cliente).
 */

const COR_TEMPO = "var(--cor-energia)";

const ROTA_QUALIDADE_EXPURGOS = "/setor-eletrico/qualidade#expurgos";
const ROTA_TERRITORIO = "/setor-eletrico/territorio";

/** A ressalva que fica junto do número, por indicador; vazia quando a gold de origem não está disponível. */
function ressalvasDoItem(it: ItemSociedade, ctx: ContextoSociedade): string[] {
  if (it.id === "tarifa") return [ctx.tarifa ? textoCoberturaTarifa(ctx.tarifa) : "", textoUnidadeTarifa(it.valor)].filter(Boolean);
  if (it.id === "continuidade")
    return [ctx.dec ? expandeSiglas(textoDecApurado(ctx.dec), ["DEC"]) : "O número é o DEC apurado: não conta as interrupções que a regra exclui do apurado."];
  if (it.id === "perdas") return ctx.perdas ? [textoDenominadorPerdas(ctx.perdas), textoDispersaoPerdas(ctx.perdas)].filter(Boolean) : [];
  return [];
}

function Cartao({ it, i, ctx, nota }: { it: ItemSociedade; i: number; ctx: ContextoSociedade; nota?: string | null }) {
  const atrasado = it.atualidade?.situacao === "ATRASADO";
  const ressalvas = ressalvasDoItem(it, ctx);
  const defasagem = expandeSiglas(enumLegivel(it.defasagem.texto), ["SCS"]);
  const dec = it.id === "continuidade" ? ctx.dec : null;
  const limite = dec ? textoLimiteAgregado(dec) : "";
  const dispersaoDec = dec ? textoDispersaoDec(dec) : "";
  return (
    <article id={`sociedade-${it.id}`} aria-labelledby={`sociedade-${it.id}-titulo`} className="flex min-w-0 flex-col border border-linha bg-superficie p-4">
      <h3 id={`sociedade-${it.id}-titulo`} className="ed-h3 font-serif text-carvao">
        {tituloCartaoSociedade(it)}
      </h3>
      <p className="mt-0.5 text-sm text-carvao-muted">{PERGUNTA_SOCIEDADE[it.id] ?? it.pergunta}</p>
      <p className="mt-3 font-serif text-[1.625rem] leading-tight tabular-nums text-carvao" data-valor-sociedade={it.id}>
        {valorSociedade(it)}
      </p>
      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-carvao-muted">
        <span className="border border-linha px-1.5 text-carvao">{periodoCurto(it)}</span>
        <span>não é a situação do dia</span>
        <SeloNatureza natureza={it.natureza as Natureza} />
      </p>
      {ressalvas.length > 0 && (
        <div className="mt-3 space-y-1.5 border-l-2 border-energia-soft pl-3 text-sm leading-relaxed text-carvao" data-ressalva-sociedade={it.id}>
          {ressalvas.map((r) => (
            <p key={r}>{r}</p>
          ))}
        </div>
      )}
      <p className={`mt-2 text-xs leading-relaxed ${atrasado ? "text-aviso" : "text-carvao-muted"}`}>{defasagem}</p>
      {nota && (
        <p className="mt-2 text-xs leading-relaxed text-carvao" data-nota-sociedade={it.id}>
          <span className="rotulo mr-2 text-mineral">Para ler junto</span>
          {expandeSiglas(enumLegivel(nota), ["SCS"])}
        </p>
      )}
      {it.complementos.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-linha pt-2 text-xs leading-relaxed text-carvao-muted">
          {it.complementos.map((c) => {
            const aviso = c.aviso ? avisoSemBastidor(c.aviso) : null;
            return (
              <li key={c.rotulo}>
                <span className="text-carvao">{expandeSiglas(c.rotulo, ["CDE"])}</span>
                {c.mes ? ` (${c.mes.length === 7 ? mesAno(c.mes) : c.mes})` : ""}: {textoComplemento(c)}
                {aviso ? `. ${aviso.leitor}` : ""}
                {aviso?.detalhe && <span data-nivel="analisar"> Detalhe da exclusão: {aviso.detalhe}.</span>}
              </li>
            );
          })}
        </ul>
      )}
      {limite && (
        <p className="mt-2 text-xs leading-relaxed text-carvao-muted" data-limite-agregado="">
          <span className="rotulo mr-2 text-mineral">Sobre o limite agregado</span>
          {limite}
        </p>
      )}
      {dispersaoDec && (
        <p className="mt-2 text-xs leading-relaxed text-carvao-muted" data-dispersao="continuidade">
          <span className="rotulo mr-2 text-mineral">Entre os conjuntos</span>
          {dispersaoDec}
        </p>
      )}
      <p className="mt-2 text-xs leading-relaxed text-carvao-muted">{it.aviso}</p>
      <p data-nivel="analisar" className="mt-2 text-xs leading-relaxed text-carvao-muted [overflow-wrap:anywhere]">
        Cobertura: {it.cobertura}
      </p>
      <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-0 pt-2">
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
        {it.id === "continuidade" && (
          <Link href={ROTA_QUALIDADE_EXPURGOS} className="inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4">
            Ver o que fica fora do apurado
          </Link>
        )}
        {(it.id === "continuidade" || it.id === "perdas") && (
          <Link href={ROTA_TERRITORIO} className="inline-flex min-h-[44px] items-center text-sm text-energia-dark underline underline-offset-4">
            Ver a distribuidora do seu município
          </Link>
        )}
      </div>
    </article>
  );
}

export function VisaoSociedadeCartoes({ s, ctx = {}, notas = {} }: { s: SociedadeVisao; ctx?: ContextoSociedade; notas?: Partial<Record<IdSociedade, string | null>> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {s.itens.map((it, i) => (
        <Cartao key={it.id} it={it} i={i} ctx={ctx} nota={notas[it.id]} />
      ))}
    </div>
  );
}

/**
 * Linha do tempo de referência: um trecho por indicador (o período a que o número se refere) sobre o mesmo eixo, e a linha vertical
 * da data de processamento. A distância entre o fim do trecho e a linha é a defasagem, escrita ao lado em dias. Desenho em HTML
 * puro (posições em %, sem script); a tabela equivalente está em Analisar.
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
                  <span className="absolute inset-y-0 rounded-sm" style={{ left: `${x0}%`, width: `${x1 - x0}%`, background: COR_TEMPO }} />
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
