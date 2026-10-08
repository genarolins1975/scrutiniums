import type { FichaIndicador } from "@/lib/eficiencia/tipos";

/**
 * Conteúdo do passaporte de um indicador: os dezesseis campos, na ordem, para
 * a mesma ficha aparecer no diálogo (a partir do valor, do gráfico e da tabela)
 * e na seção Métodos e fontes. Sem estado: serve ao servidor e ao cliente.
 */

export type ContextoFicha = {
  cobertura: string[];
  coletas: { fonte: string; capturado_em: string; pagina: string }[];
  validacoes: { id: string; titulo: string; resultado: string }[];
};

const NATUREZA: Record<FichaIndicador["natureza"], string> = {
  OBSERVADO: "Observado: valor publicado pela fonte oficial e reproduzido sem recálculo.",
  CALCULADO: "Calculado: transformação determinística feita pelo OBEE sobre registros oficiais, com fórmula publicada.",
};

export const ESTADO_PUBLICACAO: Record<FichaIndicador["estado"], string> = {
  PUBLICAVEL: "Publicável",
  PUBLICAVEL_COM_RESSALVAS: "Publicável com ressalvas",
  NAO_PUBLICAVEL: "Não publicável nesta etapa",
};

const RESULTADO: Record<string, string> = {
  aprovada: "aprovada",
  aprovada_com_divergencias_documentadas: "aprovada, com divergências documentadas",
  reprovada: "reprovada",
  medicao: "medição",
};

function Campo({ n, rotulo, children }: { n: number; rotulo: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-linha py-3 sm:grid-cols-[12rem_1fr] sm:gap-5">
      <dt className="rotulo text-mineral">
        <span className="mr-1.5 tabular-nums text-carvao-muted">{String(n).padStart(2, "0")}</span>
        {rotulo}
      </dt>
      <dd className="text-sm leading-relaxed text-obee-tinta">{children}</dd>
    </div>
  );
}

function Lista({ itens }: { itens: string[] }) {
  if (!itens.length) return <>Nenhum.</>;
  if (itens.length === 1) return <>{itens[0]}</>;
  return (
    <ul className="list-disc space-y-1 pl-5">
      {itens.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

export function FichaConteudo({ f, ctx }: { f: FichaIndicador; ctx: ContextoFicha }) {
  const publicado = f.estado !== "NAO_PUBLICAVEL";
  return (
    <dl>
      <Campo n={1} rotulo="Nome e identificador">
        <strong className="font-semibold">{f.nome}</strong>
        <br />
        <code className="font-mono text-[0.8rem] text-carvao-muted">{f.id}</code>
        <span className="ml-2 text-carvao-muted">· {ESTADO_PUBLICACAO[f.estado]}</span>
      </Campo>
      <Campo n={2} rotulo="O que mede">
        <p>{f.pergunta}</p>
        <p className="mt-1.5">{f.o_que_mede}</p>
      </Campo>
      <Campo n={3} rotulo="O que não mede">
        <Lista itens={f.o_que_nao_mede} />
      </Campo>
      <Campo n={4} rotulo="Fórmula">
        <code className="block whitespace-pre-wrap break-words bg-papel px-2 py-1.5 font-mono text-[0.8rem]">{f.formula}</code>
        {(f.numerador || f.denominador) && (
          <p className="mt-2">
            {f.numerador && <>Numerador: {f.numerador} </>}
            {f.denominador && <>Denominador: {f.denominador}</>}
          </p>
        )}
      </Campo>
      <Campo n={5} rotulo="Unidade e escala">
        {f.unidade}. {f.escala}
      </Campo>
      <Campo n={6} rotulo="Fonte e registro">
        {f.localizacao_registro}
      </Campo>
      <Campo n={7} rotulo="Período e coleta">
        <p>{f.periodo}</p>
        {ctx.coletas.length > 0 && (
          <ul className="mt-1.5 space-y-1">
            {ctx.coletas.map((c) => (
              <li key={c.fonte}>
                {c.fonte}: coletado em {c.capturado_em}.{" "}
                <a href={c.pagina} target="_blank" rel="noopener noreferrer" className="text-obee-dark underline underline-offset-2">
                  Página oficial<span className="sr-only"> de {c.fonte} (abre em nova aba)</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </Campo>
      <Campo n={8} rotulo="Perímetro">
        <ul className="space-y-1">
          <li>
            <span className="text-carvao-muted">Territorial:</span> {f.perimetro.territorial}
          </li>
          <li>
            <span className="text-carvao-muted">Institucional:</span> {f.perimetro.institucional}
          </li>
          <li>
            <span className="text-carvao-muted">Serviço:</span> {f.perimetro.servico}
          </li>
        </ul>
      </Campo>
      <Campo n={9} rotulo="Cobertura e exclusões">
        {publicado ? <Lista itens={ctx.cobertura} /> : "Não se aplica: o indicador não é publicado."}
      </Campo>
      <Campo n={10} rotulo="Ausências">
        {f.ausencias}
      </Campo>
      <Campo n={11} rotulo="Transformações e correção monetária">
        <Lista itens={f.transformacoes} />
        <p className="mt-1.5">{f.correcao_monetaria}</p>
      </Campo>
      <Campo n={12} rotulo="Condições de comparação">
        {f.comparacao}
        {f.ressalvas.length > 0 && (
          <div className="mt-1.5">
            <span className="text-carvao-muted">Ressalvas:</span> <Lista itens={f.ressalvas} />
          </div>
        )}
        {f.motivo_nao_publicacao && (
          <div className="mt-1.5">
            <span className="text-carvao-muted">Motivos da não publicação:</span> <Lista itens={f.motivo_nao_publicacao} />
          </div>
        )}
      </Campo>
      <Campo n={13} rotulo="Natureza">
        {NATUREZA[f.natureza]}
      </Campo>
      <Campo n={14} rotulo="Versão metodológica">
        {f.versao_metodologica}
      </Campo>
      <Campo n={15} rotulo="Dados e código">
        {f.download ? (
          <>
            <a href={f.download} download className="text-obee-dark underline underline-offset-2">
              Série completa em CSV
            </a>
            , com estado, nota e registro de cada valor. Código: <code className="font-mono text-[0.8rem]">pipeline/eficiencia</code> no
            repositório; reconstrução com <code className="font-mono text-[0.8rem]">python3 -m pipeline.eficiencia.run</code>.
          </>
        ) : (
          "Sem série publicada."
        )}
      </Campo>
      <Campo n={16} rotulo="Validações realizadas">
        {ctx.validacoes.length ? (
          <ul className="space-y-1">
            {ctx.validacoes.map((v) => (
              <li key={v.id}>
                <span className="font-mono text-[0.8rem]">{v.id}</span> {v.titulo}: {RESULTADO[v.resultado] ?? v.resultado}.
              </li>
            ))}
          </ul>
        ) : (
          "Nenhuma."
        )}
        <p className="mt-1.5 text-carvao-muted">
          Testes automatizados no pipeline e revisão interna da equipe. Nenhuma revisão externa foi realizada até esta versão.
        </p>
      </Campo>
    </dl>
  );
}
