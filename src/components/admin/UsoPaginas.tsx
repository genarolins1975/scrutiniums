import { fmtNumber } from "@/lib/format";
import type { UsoDoPeriodo } from "@/lib/uso/painel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { EmptyState } from "@/components/ui/States";

/**
 * Seção do painel de administração com a medição de uso agregada
 * (docs/observatorios/MEDICAO_DE_USO.md): período exato, estado da contagem
 * de visitantes sem conta, totais por observatório e tabela por página.
 * Visitante sem conta com a contagem desligada aparece como "não medido",
 * nunca como zero.
 */

/** AAAA-MM-DD → DD/MM/AAAA sem passar por Date (nada de deslocamento de fuso). */
export function diaBr(dia: string): string {
  const [a, m, d] = dia.split("-");
  return `${d}/${m}/${a}`;
}

const NAO_MEDIDO = "não medido";

function ThNum({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="rotulo px-3 py-3 text-right text-mineral">
      {children}
    </th>
  );
}

function ThTexto({ children }: { children: React.ReactNode }) {
  return (
    <th scope="col" className="rotulo px-3 py-3 text-left text-mineral">
      {children}
    </th>
  );
}

function Num({ valor }: { valor: number | null }) {
  return (
    <td className="whitespace-nowrap px-3 py-3 text-right tabular-nums text-carvao">
      {valor === null ? <span className="text-mineral">{NAO_MEDIDO}</span> : fmtNumber(valor)}
    </td>
  );
}

/**
 * O trecho da janela que a coluna sem conta de fato mede. A contagem sem conta pode ser ligada (ou desligada) no meio da
 * janela; os dias fora dela não foram medidos e não somam zero.
 */
function semContaParcial(uso: UsoDoPeriodo): string {
  if (!uso.semContaMedido) return "";
  if (uso.primeiroSemConta === null)
    return " A contagem sem conta está ligada, mas ainda não registrou nenhuma visita: a coluna sem conta não cobre os dias anteriores à ligação.";
  const parcial = uso.primeiroSemConta > uso.inicio
    ? ` A coluna sem conta só mede a partir de ${diaBr(uso.primeiroSemConta)}, primeiro dia com visita sem conta registrada; os dias anteriores do período não foram medidos, o que não equivale a zero visitas.`
    : "";
  const desligada = uso.anonimoAtivo ? "" : " A contagem sem conta está desligada agora; os números sem conta são do trecho em que ela esteve ligada.";
  return parcial + desligada;
}

export function UsoPaginas({ uso }: { uso: UsoDoPeriodo }) {
  const semConta = (n: number) => (uso.semContaMedido ? n : null);
  const comecouDepois = uso.primeiroRegistro !== null && uso.primeiroRegistro > uso.inicio;
  return (
    <section aria-label="Uso por observatório e por página" className="border border-linha bg-papel p-8" data-secao="uso-paginas">
      <SectionHeading label="Uso" title="Uso por observatório e por página, últimos 30 dias" />

      <dl className="grid gap-6 border-b border-linha pb-6 sm:grid-cols-3">
        <div>
          <dt className="rotulo text-mineral">Período</dt>
          <dd className="mt-1 text-sm text-carvao" data-uso="periodo">
            {diaBr(uso.inicio)} a {diaBr(uso.fim)}, {uso.dias} dias no fuso de Brasília, hoje incluído
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Visitas com conta</dt>
          <dd className="mt-1 text-sm text-carvao">
            Contagem ligada. Soma aberturas de página sem associar a visita à conta.
          </dd>
        </div>
        <div>
          <dt className="rotulo text-mineral">Visitas sem conta</dt>
          <dd className="mt-1 text-sm text-carvao" data-uso="anonimo">
            {uso.anonimoAtivo
              ? "Contagem ligada no servidor (USO_ANONIMO_ATIVO=1)."
              : "Contagem desligada, à espera da decisão sobre a base legal na LGPD. Liga com USO_ANONIMO_ATIVO=1."}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-sm text-mineral" data-uso="inicio">
        {uso.primeiroRegistro === null
          ? "Nenhuma visita registrada até agora: a medição por página começa nesta versão."
          : comecouDepois
            ? `A medição começou em ${diaBr(uso.primeiroRegistro)}. Os dias anteriores do período não têm registro, o que não equivale a zero visitas.`
            : "A contagem com conta cobre todos os dias do período."}
        {semContaParcial(uso)}
      </p>

      {uso.porPagina.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Nenhuma visita registrada nos últimos 30 dias"
            description="Assim que alguém abrir uma página, o contador do dia aparece aqui, por observatório e por página."
          />
        </div>
      ) : (
        <>
          <h3 className="mt-10 font-serif text-xl text-carvao">Por observatório</h3>
          <p className="mt-2 text-xs text-mineral md:hidden">No celular, as duas tabelas rolam para o lado.</p>
          <div className="tabela-scroll mt-4 overflow-x-auto">
            <table className="w-full min-w-[32rem] border-collapse text-sm" data-uso="observatorios">
              <thead>
                <tr className="border-b border-linha">
                  <ThTexto>Observatório</ThTexto>
                  <ThNum>Páginas visitadas</ThNum>
                  <ThNum>Visitas com conta</ThNum>
                  <ThNum>Visitas sem conta</ThNum>
                </tr>
              </thead>
              <tbody>
                {uso.porObservatorio.map((o) => (
                  <tr key={o.observatorio} className="border-b border-linha">
                    <td className="px-3 py-3 text-carvao">{o.nome}</td>
                    <Num valor={o.paginas} />
                    <Num valor={o.comConta} />
                    <Num valor={semConta(o.semConta)} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 className="mt-10 font-serif text-xl text-carvao">Por página</h3>
          <p className="mt-2 text-sm text-mineral">
            {fmtNumber(uso.porPagina.length)} páginas com visita no período, da mais para a menos visitada.
            Páginas com identificador no endereço contam pelo modelo da rota, como
            /saneamento/municipio/[id].
          </p>
          <div className="tabela-scroll mt-4 overflow-x-auto">
            <table className="w-full min-w-[40rem] border-collapse text-sm" data-uso="paginas">
              <thead>
                <tr className="border-b border-linha">
                  <ThTexto>Página</ThTexto>
                  <ThTexto>Observatório</ThTexto>
                  <ThNum>Visitas com conta</ThNum>
                  <ThNum>Visitas sem conta</ThNum>
                </tr>
              </thead>
              <tbody>
                {uso.porPagina.map((p) => (
                  <tr key={p.rota} className="border-b border-linha">
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-carvao">{p.rota}</td>
                    <td className="px-3 py-3 text-carvao-muted">{p.nomeObservatorio}</td>
                    <Num valor={p.comConta} />
                    <Num valor={semConta(p.semConta)} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="mt-6 text-xs text-mineral">
        Uma visita é uma abertura de página do site, inclusive navegação interna, contada por dia, rota e
        presença de conta. Não se grava pessoa, conta, IP, navegador nem parâmetro de endereço. Navegadores com
        Do Not Track ou Global Privacy Control não são contados. A aplicação do Crédito em /observatorio fica fora
        desta contagem; suas abas aparecem em Seções mais visitadas. Método e base legal:
        docs/observatorios/MEDICAO_DE_USO.md.
      </p>
    </section>
  );
}
