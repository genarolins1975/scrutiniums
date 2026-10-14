import Link from "next/link";

/**
 * Como o sistema funciona, em duas camadas que não se misturam:
 *  1. fluxo físico da água e do esgoto (setas cheias), do manancial ao corpo receptor;
 *  2. relações institucionais e financeiras (setas tracejadas), entre titular,
 *     prestador, regulador, ANA, usuário e financiadores.
 * Cada etapa indica o capítulo que a mede. HTML semântico (listas ordenadas),
 * horizontal em tela larga e vertical no celular; nada de ilustração decorativa.
 */

type Etapa = { nome: string; mede: string; capitulos: number[] };

const AGUA: Etapa[] = [
  { nome: "Manancial", mede: "Rio, represa ou aquífero; secas e interrupções por baixa disponibilidade", capitulos: [14] },
  { nome: "Captação e tratamento", mede: "Estações de tratamento de água e volumes produzidos", capitulos: [3] },
  { nome: "Reservação e distribuição", mede: "Rede, perdas na distribuição, paralisações e racionamento", capitulos: [3, 8] },
  { nome: "Domicílio", mede: "Ligação, uso como fonte principal, consumo e conta", capitulos: [1, 5, 6] },
];
const ESGOTO: Etapa[] = [
  { nome: "Coleta", mede: "Rede coletora e ligações possíveis ainda não feitas", capitulos: [1, 4] },
  { nome: "Transporte", mede: "Coletores, interceptores e estações elevatórias", capitulos: [4] },
  { nome: "Tratamento", mede: "Estações de tratamento de esgoto, capacidade e volume tratado", capitulos: [4] },
  { nome: "Destino", mede: "Corpo receptor e qualidade da água após o lançamento", capitulos: [13] },
];

const RELACOES: { de: string; para: string; o_que: string; capitulos: number[] }[] = [
  { de: "Titular (município ou estrutura regional)", para: "Prestador", o_que: "presta diretamente ou delega por contrato, com metas", capitulos: [7, 12] },
  { de: "Entidade reguladora", para: "Prestador", o_que: "autoriza a tarifa, verifica metas e fiscaliza", capitulos: [5, 12] },
  { de: "ANA", para: "Entidade reguladora", o_que: "edita normas de referência; não fixa tarifas locais", capitulos: [5, 11] },
  { de: "Usuário", para: "Prestador", o_que: "paga a conta segundo a estrutura tarifária autorizada", capitulos: [5, 6] },
  { de: "Orçamento e financiadores", para: "Prestador", o_que: "transferem ou emprestam recursos para investimento", capitulos: [9, 10] },
  { de: "Plano de saneamento", para: "Contrato e regulação", o_que: "fixa diagnóstico, metas e prioridades do território", capitulos: [11] },
];

function Capitulos({ ns }: { ns: number[] }) {
  return (
    <span className="mt-2 block text-xs text-carvao-muted">
      Capítulo{ns.length > 1 ? "s" : ""}{" "}
      {ns.map((n, i) => (
        <span key={n}>
          {i > 0 && (i === ns.length - 1 ? " e " : ", ")}
          <span className="tabular-nums text-obee-dark">{n}</span>
        </span>
      ))}
    </span>
  );
}

function Fluxo({ titulo, etapas, inicio }: { titulo: string; etapas: Etapa[]; inicio: number }) {
  return (
    <div>
      <p className="rotulo text-mineral">{titulo}</p>
      <ol className="mt-3 grid grid-cols-1 gap-0 lg:grid-cols-4" start={inicio}>
        {etapas.map((e, i) => (
          <li key={e.nome} className="relative flex lg:block">
            <div className="flex-1 border-l-2 border-obee py-3 pl-4 lg:border-l-0 lg:border-t-2 lg:pl-0 lg:pr-6 lg:pt-4">
              <span className="font-label text-xs tabular-nums text-mineral">{String(inicio + i).padStart(2, "0")}</span>
              <span className="mt-1 block font-serif text-lg leading-snug text-carvao">{e.nome}</span>
              <span className="mt-1 block text-sm leading-snug text-carvao-muted">{e.mede}</span>
              <Capitulos ns={e.capitulos} />
            </div>
            {i < etapas.length - 1 && (
              <span aria-hidden="true" className="absolute -bottom-2 left-[-7px] text-obee lg:-top-[0.85rem] lg:bottom-auto lg:left-auto lg:right-2">
                <span className="lg:hidden">▾</span>
                <span className="hidden lg:inline">▸</span>
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function DiagramaSistema() {
  return (
    <div>
      <div className="grid gap-8">
        <Fluxo titulo="Fluxo físico da água · seta cheia" etapas={AGUA} inicio={1} />
        <Fluxo titulo="Fluxo físico do esgoto · seta cheia" etapas={ESGOTO} inicio={5} />
      </div>
      <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
        Fora da rede, há soluções individuais: poço, cisterna, fossa séptica. Elas contam como atendimento adequado só quando a entidade
        reguladora as prevê (NR ANA 8/2024) e aparecem separadas no capítulo 1.
      </p>
      <div className="mt-10">
        <p className="rotulo text-mineral">Relações institucionais e financeiras · seta tracejada</p>
        <ul className="mt-3 grid grid-cols-1 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {RELACOES.map((r) => (
            <li key={r.de + r.para} className="border-t border-dashed border-mineral py-3">
              <span className="block text-sm text-carvao">
                <span className="font-medium">{r.de}</span> <span aria-hidden="true" className="text-mineral">⇢</span>
                <span className="sr-only"> para </span> <span className="font-medium">{r.para}</span>
              </span>
              <span className="mt-1 block text-sm leading-snug text-carvao-muted">{r.o_que}</span>
              <Capitulos ns={r.capitulos} />
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-6 text-sm text-carvao-muted">
        Saneamento básico também inclui manejo de resíduos sólidos e drenagem urbana. Este observatório trata água e esgoto; os dois outros
        componentes têm indicadores regionais do SINISA no{" "}
        <Link href="/eficiencia-estatal/saneamento/residuos" className="text-obee-dark underline underline-offset-2">
          Observatório de Eficiência Estatal
        </Link>
        .
      </p>
    </div>
  );
}
