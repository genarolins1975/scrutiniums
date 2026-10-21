import Link from "next/link";
import { Numero } from "@/components/observatorios/EntradaObservatorio";
import type { EstagioServico, TemaServico } from "@/lib/observatorios/entradas/servicos";

const ESTAGIOS = [
  { chave: "recursos", titulo: "Recursos", pergunta: "Quanto se aplica" },
  { chave: "atendimento", titulo: "Atendimento", pergunta: "Quem o serviço alcança" },
  { chave: "resultados", titulo: "Resultados", pergunta: "O que a fonte registra" },
] as const;

function Estagio({ e }: Readonly<{ e: EstagioServico }>) {
  return (
    <>
      <p className="text-sm leading-relaxed text-carvao-muted">{e.texto}</p>
      {e.numero && (
        <div className="mt-3 border-t border-linha pt-3">
          <span className="block text-xs leading-snug text-carvao-muted">{e.numero.rotulo}</span>
          <span className="mt-1 block"><Numero n={e.numero} /></span>
          {e.numero.nota && <span className="mt-1 block text-xs leading-relaxed text-mineral">{e.numero.nota}</span>}
        </div>
      )}
    </>
  );
}

/**
 * Modelo didático "do recurso ao resultado": os três estágios com que a
 * Eficiência Estatal descreve cada serviço, com um número publicado onde
 * existe. Mostra a sequência que a análise percorre, não uma relação causal.
 */
export function RecursoResultado({ temas }: Readonly<{ temas: TemaServico[] }>) {
  return (
    <section aria-labelledby="recurso-titulo" className="border-y border-linha bg-marfim">
      <div className="mx-auto max-w-page px-6 py-14 md:py-16">
        <p className="rotulo text-mineral">Modelo didático</p>
        <h2 id="recurso-titulo" className="mt-3 max-w-3xl font-serif text-[clamp(1.6rem,3vw,2.1rem)] leading-tight text-carvao">
          Do recurso ao resultado
        </h2>
        <p className="mt-4 max-w-prose2 text-sm leading-relaxed text-carvao-muted">
          Cada serviço é lido em três estágios: quanto se aplica, quem o atendimento alcança e o que a fonte registra
          como resultado. A sequência organiza a leitura; ela não prova que um estágio causa o seguinte, e a plataforma
          não calcula nota de eficiência. Onde um estágio ainda não tem número publicado, fica só a descrição.
        </p>
        <div role="table" aria-label="Do recurso ao resultado, por serviço" className="mt-10">
          <div role="rowgroup" className="hidden lg:block">
            <div role="row" className="grid grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,3fr))] gap-px">
              <span role="columnheader" className="rotulo pb-3 text-mineral">Serviço</span>
              {ESTAGIOS.map((e, i) => (
                <span key={e.chave} role="columnheader" className="rotulo flex items-baseline gap-2 pb-3 text-mineral">
                  <span className="tabular-nums text-carvao">{String(i + 1).padStart(2, "0")}</span>
                  {e.titulo}
                  <span className="normal-case tracking-normal text-carvao-muted">· {e.pergunta}</span>
                </span>
              ))}
            </div>
          </div>
          <div role="rowgroup" className="space-y-6 lg:space-y-px lg:bg-linha">
            {temas.map((t) => (
              <div key={t.id} role="row" className="grid gap-px border border-linha bg-linha lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,3fr))] lg:border-0">
                <div role="rowheader" className="bg-papel p-4">
                  <Link href={t.href} prefetch={false} className="font-serif text-xl leading-snug text-carvao underline decoration-linha underline-offset-4 hover:decoration-carvao">
                    {t.titulo}
                  </Link>
                </div>
                {ESTAGIOS.map((e) => (
                  <div key={e.chave} role="cell" className="bg-papel p-4">
                    <span className="rotulo mb-2 block text-mineral lg:hidden">{e.titulo}</span>
                    <Estagio e={t[e.chave]} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Método e fontes da entrada dos Serviços Públicos. */
export function MetodoServicos() {
  return (
    <>
      <p>
        O observatório reúne os painéis da Eficiência Estatal sobre serviços públicos. Educação e saúde cobrem as 26
        capitais, com a rede municipal; Judiciário e segurança pública cobrem o país, nos recortes de cada fonte. As
        medianas das capitais têm peso igual por capital e não equivalem ao valor do Brasil.
      </p>
      <p>
        Fontes: INEP (Ideb), Tesouro Nacional (Siconfi) e IBGE (população), Ministério da Saúde, CNJ (Justiça em
        Números) e Ministério da Justiça (Sinesp). Os números são lidos das mesmas bases na publicação do site; quando
        uma base não pode ser lida, o número aparece como indisponível, nunca como zero.
      </p>
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        <li><Link href="/eficiencia-estatal/educacao-municipal-capitais/metodos" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">Educação: métodos</Link></li>
        <li><Link href="/eficiencia-estatal/saude-capitais/metodos" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">Saúde: métodos</Link></li>
        <li><Link href="/perguntas/servicos-publicos" className="inline-flex min-h-[44px] items-center text-carvao underline decoration-linha underline-offset-4">Resumo aberto do observatório</Link></li>
      </ul>
    </>
  );
}
