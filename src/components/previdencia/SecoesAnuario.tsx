/**
 * Duas seções do painel Previdência e INSS que só o Anuário Estatístico da Previdência Social (AEPS) responde, com os
 * três anos da edição mais recente: o ano inteiro (valor emitido nos doze meses, benefícios concedidos e a divisão entre
 * Regime Geral, assistenciais e encargos previdenciários da União) e o atendimento nas unidades do INSS (mês a mês e
 * por estado, com a rede de agências). Desenhadas no servidor a partir do bloco aeps da gold; nenhum número escrito à
 * mão. O que o BEPS e o arquivo municipal já mostram (benefícios emitidos por estado e mês a mês) não se repete aqui.
 */
import { GraficoColunas } from "./Graficos";
import { especiesAeps } from "@/lib/previdencia/dados";
import { bilhoesDeMil, dataBr, milhoes, num, pct, razao, SEM_DADO, variacao } from "@/lib/previdencia/formato";
import { GRANDES_GRUPOS_AEPS, NOME_ESPECIE_AEPS } from "@/lib/previdencia/paginas";
import type { GoldPrevidencia, IdEspecieAeps, IdRedeAeps, NoveValores } from "@/lib/previdencia/tipos";

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** Total, clientela urbana e clientela rural do ano k nas nove colunas da fonte. */
const total = (v: NoveValores, k: number) => v[k] ?? null;
const rural = (v: NoveValores, k: number) => v[6 + k] ?? null;

/** Parte em %, com duas casas quando é menor que 1% (os encargos da União não viram 0,0%). */
function parte(a: number | null, b: number | null): string {
  const x = razao(a, b);
  if (x === null) return SEM_DADO;
  if (x > 0 && 100 * x < 0.005) return "menos de 0,01%";
  return pct(100 * x, 100 * x < 1 ? 2 : 1);
}

const semFonte = (s: string) => s.replace(/^FONTE:\s*/i, "").replace(/\.$/, "");

/* --------------------------------------------------------------------------------------------- o ano inteiro */

const BARRAS_CONCESSAO: IdEspecieAeps[] = ["aux_doenca", "apo_idade", "salario_maternidade", "bpc_deficiencia", "pensoes", "bpc_idoso", "acidentarios", "apo_tempo", "apo_invalidez", "aux_acidente"];

const ORDEM_CONCESSOES: { id: IdEspecieAeps; nivel: 0 | 1 | 2; forte?: boolean }[] = [
  { id: "rgps", nivel: 0, forte: true },
  { id: "aposentadorias", nivel: 1 },
  { id: "apo_idade", nivel: 2 },
  { id: "apo_tempo", nivel: 2 },
  { id: "apo_invalidez", nivel: 2 },
  { id: "pensoes", nivel: 1 },
  { id: "auxilios", nivel: 1 },
  { id: "aux_doenca", nivel: 2 },
  { id: "aux_acidente", nivel: 2 },
  { id: "aux_reclusao", nivel: 2 },
  { id: "salario_maternidade", nivel: 1 },
  { id: "acidentarios", nivel: 1 },
  { id: "acid_apo_invalidez", nivel: 2 },
  { id: "acid_pensao", nivel: 2 },
  { id: "acid_aux_doenca", nivel: 2 },
  { id: "acid_aux_acidente", nivel: 2 },
  { id: "acid_aux_suplementar", nivel: 2 },
  { id: "assistenciais", nivel: 0, forte: true },
  { id: "bpc", nivel: 1 },
  { id: "bpc_idoso", nivel: 2 },
  { id: "bpc_deficiencia", nivel: 2 },
  { id: "pmv", nivel: 1 },
  { id: "rmv", nivel: 1 },
  { id: "epu", nivel: 0, forte: true },
  { id: "total", nivel: 0, forte: true },
];

/** Benefícios pagos por um período (licença por doença e maternidade): explicam por que o estoque cresce menos que as concessões. */
const TEMPORARIOS: IdEspecieAeps[] = ["aux_doenca", "acid_aux_doenca", "salario_maternidade"];

export function SecaoAnuario({ g }: { g: GoldPrevidencia }) {
  const a = g.aeps;
  const e = especiesAeps(g);
  const f = g.fontes.aeps;
  const anos = a.anos;
  const k = anos.length - 1;
  const ano = anos[k];
  const ano0 = anos[0];
  const conc = total(e.total.concedidos, k) as number;
  const conc0 = total(e.total.concedidos, 0);
  const pago = total(e.total.valor_ano, k);
  const estoqueAntes = total(e.total.emitidos, k - 1) as number;
  const estoque = total(e.total.emitidos, k) as number;
  const temporarios = TEMPORARIOS.reduce((s, id) => s + (total(e[id].concedidos, k) ?? 0), 0);
  const maxPago = Math.max(...anos.map((_a, i) => total(e.total.valor_ano, i) ?? 0));
  const barras = BARRAS_CONCESSAO.map((id) => e[id]).sort((x, y) => (total(y.concedidos, k) ?? 0) - (total(x.concedidos, k) ?? 0));
  const maxBarra = Math.max(...barras.flatMap((x) => [total(x.concedidos, k) ?? 0, total(x.concedidos, 0) ?? 0])) * 1.04;
  const linhasTipo = ORDEM_CONCESSOES.filter(({ id }) => anos.some((_a, i) => total(e[id].concedidos, i) !== null));
  // linhas com traço nos três anos: as de nível mais alto, com as partes entre parênteses
  const semConcessao = (id: IdEspecieAeps) => anos.every((_a, i) => total(e[id].concedidos, i) === null);
  const foraDaTabela = a.especies
    .filter((x) => semConcessao(x.id) && !(x.pai && semConcessao(x.pai)))
    .map((x) => {
      const partes = a.especies.filter((y) => y.pai === x.id).map((y) => NOME_ESPECIE_AEPS[y.id].toLowerCase());
      return `${NOME_ESPECIE_AEPS[x.id].toLowerCase()}${partes.length ? ` (${partes.join(", ")})` : ""}`;
    });
  const ufs = [...a.concessoes_uf.ufs].sort((x, y) => (total(y.v, k) ?? 0) - (total(x.v, k) ?? 0));
  const maxEstoque = Math.max(estoqueAntes, estoque);
  return (
    <section className="pv-secao" id="anuario" aria-labelledby="anuario-titulo">
      <h2 id="anuario-titulo">Quanto o INSS paga e concede em um ano?</h2>
      <p className="pv-intro">
        O Anuário Estatístico da Previdência Social fecha o ano: quanto o INSS emitiu em benefícios nos doze meses, quantos benefícios novos concedeu e como isso se divide entre o Regime Geral, a
        assistência e os encargos da União. Em {ano}, foram <strong>{bilhoesDeMil(pago)}</strong> emitidos no ano e <strong>{milhoes(conc)}</strong> de benefícios concedidos,{" "}
        {conc0 !== null && conc >= conc0 ? `${variacao(conc, conc0).replace("+", "")} a mais` : `${variacao(conc, conc0).replace("−", "")} a menos`} que em {ano0}.
      </p>

      <h3 className="pv-subtitulo">O ano inteiro, por grande grupo</h3>
      <p className="pv-legenda" aria-hidden="true">
        <span><i className="pv-pilha-rgps" />Regime Geral</span>
        <span><i className="pv-pilha-assist" />Assistenciais</span>
        <span><i className="pv-pilha-epu" />Encargos da União</span>
      </p>
      <div className="pv-pilhas" role="list" aria-label={`Valor emitido no ano pelo INSS, por grande grupo, de ${ano0} a ${ano}`}>
        {anos.map((x, i) => {
          const r = total(e.rgps.valor_ano, i) ?? 0;
          const s = total(e.assistenciais.valor_ano, i) ?? 0;
          const u = total(e.epu.valor_ano, i) ?? 0;
          return (
            <div key={x} className="pv-pilha" role="listitem">
              <span>{x}</span>
              <span className="pv-pilha-trilho" aria-hidden="true">
                <span className="pv-pilha-rgps" style={{ width: `${(100 * r) / maxPago}%` }} />
                <span className="pv-pilha-assist" style={{ width: `${(100 * s) / maxPago}%` }} />
                <span className="pv-pilha-epu" style={{ width: `${(100 * u) / maxPago}%` }} />
              </span>
              <span>
                {bilhoesDeMil(total(e.total.valor_ano, i))}
                <span className="cp-sr-only">
                  : Regime Geral {bilhoesDeMil(r)}, assistenciais {bilhoesDeMil(s)}, encargos da União {bilhoesDeMil(u)}
                </span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="pv-fonte">
        Valor emitido nos doze meses, em valores nominais de cada ano. Os encargos previdenciários da União, {bilhoesDeMil(total(e.epu.valor_ano, k))} em {ano}, não aparecem na escala.
      </p>

      <p className="pv-legenda-tabela" aria-hidden="true">Regime Geral, assistenciais e encargos da União, de {ano0} a {ano}: valor emitido no ano, benefícios concedidos no ano e benefícios em pagamento em dezembro.</p>
      <div className="pv-tabela-rolagem" tabIndex={0} role="region" aria-label="Tabela; no celular, deslize para o lado">
        <table className="pv-tabela pv-tabela-media">
          <caption className="cp-sr-only">Regime Geral, assistenciais e encargos da União, de {ano0} a {ano}: valor emitido no ano, benefícios concedidos no ano e benefícios em pagamento em dezembro.</caption>
          <thead>
            <tr>
              <th scope="col">Grande grupo</th>
              {anos.map((x) => (
                <th key={x} scope="col">{x}</th>
              ))}
              <th scope="col">Parte em {ano}</th>
            </tr>
          </thead>
          {(
            [
              ["Valor emitido no ano, R$ bilhões", "valor_ano"],
              ["Benefícios concedidos no ano", "concedidos"],
              ["Benefícios em pagamento em dezembro", "emitidos"],
            ] as const
          ).map(([titulo, medida]) => (
            <tbody key={medida}>
              <tr className="pv-grupo">
                <th scope="colgroup" colSpan={anos.length + 2}>{titulo}</th>
              </tr>
              {[...GRANDES_GRUPOS_AEPS, "total" as const].map((id) => (
                <tr key={id} className={id === "total" ? "pv-forte" : "pv-nivel-1"}>
                  <th scope="row">{NOME_ESPECIE_AEPS[id]}</th>
                  {anos.map((x, i) => {
                    const v = total(e[id][medida], i);
                    return <td key={x}>{medida === "valor_ano" ? num(v === null ? null : v / 1e6, id === "epu" ? 2 : 1) : num(v)}</td>;
                  })}
                  <td>{parte(total(e[id][medida], k), total(e.total[medida], k))}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
      <p className="pv-fonte">
        O Anuário separa a pensão mensal vitalícia (dentro dos assistenciais) dos encargos previdenciários da União; o BEPS, nas seções acima, soma as duas como legislação específica. O valor
        emitido no ano não é a despesa do Regime Geral do Resultado do Tesouro, mais abaixo: o Tesouro registra a despesa do ano, que inclui sentenças judiciais; o Anuário soma os benefícios
        emitidos mês a mês e informa que considera os descontos de empréstimos consignados.
      </p>

      <h3 className="pv-subtitulo">Benefícios novos e benefícios em pagamento</h3>
      <p className="pv-intro">
        Conceder é começar a pagar um benefício novo; cada um entra uma vez, no ano em que começou. Os benefícios em pagamento são todos os que o INSS emite no mês. Em {ano}, o INSS concedeu{" "}
        {milhoes(conc)}, e os benefícios em pagamento cresceram {milhoes(estoque - estoqueAntes)} de dezembro a dezembro: benefícios também terminam. Auxílio doença e salário maternidade, pagos
        por um período, foram {parte(temporarios, conc)} das concessões do ano. As cessações não estão nas tabelas do Anuário usadas aqui.
      </p>
      <div className="pv-barras pv-estoque" role="list" aria-label={`Benefícios em pagamento e concedidos, ${ano - 1} e ${ano}, na mesma escala`}>
        <div className="pv-barra" role="listitem">
          <span>Em pagamento em dezembro de {ano - 1}</span>
          <span className="pv-barra-trilho" aria-hidden="true"><i style={{ width: `${(100 * estoqueAntes) / maxEstoque}%` }} /></span>
          <span>{milhoes(estoqueAntes)}</span>
        </div>
        <div className="pv-barra pv-referencia" role="listitem">
          <span>Concedidos ao longo de {ano}</span>
          <span className="pv-barra-trilho" aria-hidden="true"><i style={{ width: `${(100 * conc) / maxEstoque}%` }} /></span>
          <span>{milhoes(conc)}</span>
        </div>
        <div className="pv-barra" role="listitem">
          <span>Em pagamento em dezembro de {ano}</span>
          <span className="pv-barra-trilho" aria-hidden="true"><i style={{ width: `${(100 * estoque) / maxEstoque}%` }} /></span>
          <span>{milhoes(estoque)}</span>
        </div>
      </div>
      <p className="pv-fonte">Proporções reais, na mesma escala. Em pagamento: benefícios emitidos em dezembro (tabela B.1). Concedidos: tabela A.1.</p>

      <h3 className="pv-subtitulo">Que benefícios o INSS concedeu</h3>
      <div className="pv-barras" role="list" aria-label={`Benefícios concedidos por tipo em ${ano}, com ${ano0} como referência`}>
        {barras.map((x) => {
          const v = total(x.concedidos, k) ?? 0;
          const v0 = total(x.concedidos, 0);
          return (
            <div key={x.id} className="pv-barra" role="listitem">
              <span>
                {NOME_ESPECIE_AEPS[x.id]}
                <br />
                <span className="text-carvao-muted">em {ano0}: {num(v0)}</span>
              </span>
              <span className="pv-barra-trilho" aria-hidden="true">
                <i style={{ width: `${(100 * v) / maxBarra}%` }} />
                {v0 !== null && <b style={{ left: `${(100 * v0) / maxBarra}%` }} />}
              </span>
              <span>{num(v)}</span>
            </div>
          );
        })}
      </div>
      <p className="pv-fonte">
        Benefícios concedidos em {ano}; o traço escuro marca {ano0}. Os benefícios por acidente de trabalho aparecem somados; o detalhe está na tabela.
      </p>

      <p className="pv-legenda-tabela" aria-hidden="true">Benefícios concedidos por tipo, de {ano0} a {ano}, com a variação no período e a parte da clientela rural no último ano.</p>
      <div className="pv-tabela-rolagem" tabIndex={0} role="region" aria-label="Tabela; no celular, deslize para o lado">
        <table className="pv-tabela pv-tabela-larga">
          <caption className="cp-sr-only">Benefícios concedidos por tipo, de {ano0} a {ano}, com a variação no período e a parte da clientela rural no último ano.</caption>
          <thead>
            <tr>
              <th scope="col">Tipo de benefício</th>
              {anos.map((x) => (
                <th key={x} scope="col">{x}</th>
              ))}
              <th scope="col">Variação de {ano0} a {ano}</th>
              <th scope="col">Clientela rural em {ano}</th>
            </tr>
          </thead>
          <tbody>
            {linhasTipo.map(({ id, nivel, forte }) => {
              const x = e[id];
              return (
                <tr key={id} className={`${nivel === 1 ? "pv-nivel-1" : nivel === 2 ? "pv-nivel-2" : ""} ${forte ? "pv-forte" : ""}`}>
                  <th scope="row">{NOME_ESPECIE_AEPS[id].replace(" (acidente de trabalho)", "")}</th>
                  {anos.map((a2, i) => (
                    <td key={a2} className={total(x.concedidos, i) === null ? "pv-sem" : ""}>{num(total(x.concedidos, i))}</td>
                  ))}
                  <td>{variacao(total(x.concedidos, k), total(x.concedidos, 0))}</td>
                  <td className={rural(x.concedidos, k) === null ? "pv-sem" : ""}>{parte(rural(x.concedidos, k), total(x.concedidos, k))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="pv-fonte">
        Sem dado: a tabela publica um traço, que o Anuário não define como zero. Ficam fora da tabela as linhas com traço nos três anos ({foraDaTabela.join(", ")}); estão no arquivo para baixar.
        Clientela rural é a do benefício (trabalhador rural), não o lugar onde a pessoa mora.
      </p>

      <details className="pv-metodo mt-10">
        <summary>As concessões em cada estado, de {ano0} a {ano}</summary>
        <p className="pv-legenda-tabela" aria-hidden="true">Benefícios concedidos por estado, de {ano0} a {ano}. Ordem: mais concessões em {ano} primeiro.</p>
        <div className="pv-tabela-rolagem" tabIndex={0} role="region" aria-label="Tabela; no celular, deslize para o lado">
          <table className="pv-tabela pv-tabela-larga">
            <caption className="cp-sr-only">Benefícios concedidos por estado, de {ano0} a {ano}. Ordem: mais concessões em {ano} primeiro.</caption>
            <thead>
              <tr>
                <th scope="col">Estado</th>
                {anos.map((x) => (
                  <th key={x} scope="col">{x}</th>
                ))}
                <th scope="col">Variação de {ano0} a {ano}</th>
                <th scope="col">Clientela rural em {ano}</th>
              </tr>
            </thead>
            <tbody>
              {ufs.map((u) => (
                <tr key={u.uf}>
                  <th scope="row">{u.nome}</th>
                  {anos.map((x, i) => (
                    <td key={x}>{num(total(u.v, i))}</td>
                  ))}
                  <td>{variacao(total(u.v, k), total(u.v, 0))}</td>
                  <td>{parte(rural(u.v, k), total(u.v, k))}</td>
                </tr>
              ))}
              <tr className="pv-forte">
                <th scope="row">Brasil</th>
                {anos.map((x, i) => (
                  <td key={x}>{num(total(a.concessoes_uf.brasil, i))}</td>
                ))}
                <td>{variacao(total(a.concessoes_uf.brasil, k), total(a.concessoes_uf.brasil, 0))}</td>
                <td>{parte(rural(a.concessoes_uf.brasil, k), total(a.concessoes_uf.brasil, k))}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="pv-fonte">Tabela A.14 do Anuário. Os estados somam o Brasil em todos os anos, e o Brasil é igual ao total da tabela A.1.</p>
      </details>

      <p className="pv-fonte">
        Fonte: {f.orgao}, {f.nome}, edição {f.edicao}, tabelas A.1, A.14, B.1, B.2 e B.3 ({semFonte(f.tabelas["a.1"].fonte)}); tabelas atualizadas no portal em {dataBr(f.atualizado_em)}, capturadas em{" "}
        {dataBr(f.capturado_em)}. Valores em reais correntes, publicados em R$ mil. Não inclui o Auxílio da União (espécie 16), benefício temporário de 2020, como diz a nota da fonte. Em cada dezembro, o
        Regime Geral do Anuário é igual ao do BEPS.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------------------------------------- atendimento */

const REDE: { id: IdRedeAeps; rotulo: string }[] = [
  { id: "aps_fixas", rotulo: "Agências da Previdência Social de atendimento presencial" },
  { id: "gerencias", rotulo: "Gerências executivas, às quais as agências se vinculam" },
  { id: "aps_moveis", rotulo: "Agências móveis flutuantes, os PrevBarcos" },
  { id: "aps_tel", rotulo: "Agências de teleatendimento, a Central 135" },
];

export function SecaoAtendimento({ g }: { g: GoldPrevidencia }) {
  const a = g.aeps;
  const f = g.fontes.aeps;
  const t = a.atendimento;
  const ano = t.ano;
  const iMax = t.brasil.indexOf(Math.max(...t.brasil));
  const rede = Object.fromEntries(a.rede.colunas.map((c, i) => [c, a.rede.brasil[i]])) as Record<IdRedeAeps, number | null>;
  const redeUf = (uf: string, c: IdRedeAeps) => a.rede.ufs.find((u) => u.uf === uf)?.v[a.rede.colunas.indexOf(c)] ?? null;
  const ufs = [...t.ufs].sort((x, y) => y.total - x.total);
  const pontos = t.brasil.map((v, i) => ({ x: i + 1, y: v / 1e6, destaque: i === iMax }));
  return (
    <section className="pv-secao" id="atendimento" aria-labelledby="atendimento-titulo">
      <h2 id="atendimento-titulo">Quanto o INSS atende nas suas unidades?</h2>
      <p className="pv-intro">
        Em {ano}, as unidades do INSS registraram <strong>{milhoes(t.total)} de atendimentos</strong>, entre serviços administrativos, perícias médicas, serviços sociais e de reabilitação. O mês de
        maior movimento foi {MESES[iMax]}, com {milhoes(t.brasil[iMax])}. Em dezembro de {ano}, a rede tinha {num(rede.aps_fixas)} agências fixas, distribuídas pelos {num(a.rede.ufs.length)} estados.
      </p>

      <dl className="pv-rede" aria-label={`A rede do INSS em dezembro de ${ano}`}>
        {REDE.map((r) => (
          <div key={r.id}>
            <dt>{r.rotulo}</dt>
            <dd className="pv-valor">{num(rede[r.id])}</dd>
          </div>
        ))}
      </dl>

      <figure className="pv-figura pv-figura-media">
        <GraficoColunas
          pontos={pontos}
          marcasX={pontos.map((p) => ({ x: p.x, rotulo: MESES_CURTOS[p.x - 1] }))}
          unidade="milhões de atendimentos no mês"
          casas={2}
          descricao={`Atendimentos nas unidades do INSS em ${ano}: ${milhoes(t.brasil[0])} em janeiro e ${milhoes(t.brasil[11])} em dezembro; o maior mês foi ${MESES[iMax]}, com ${milhoes(t.brasil[iMax])}.`}
        />
        <figcaption>Atendimentos registrados nas unidades do INSS a cada mês de {ano}; a coluna escura é o mês de maior movimento.</figcaption>
      </figure>

      <div className="pv-ler" aria-label="Como ler os atendimentos">
        <p>
          <strong>Atendimentos, não pessoas.</strong> A mesma pessoa pode ser atendida várias vezes no ano, por pedidos diferentes ou pelo mesmo pedido.
        </p>
        <p>
          <strong>O que a tabela não diz.</strong> Ela conta o que foi registrado nas unidades, sem separar o canal, e não informa o tempo de espera nem o prazo de análise dos pedidos.
        </p>
      </div>

      <p className="pv-legenda-tabela" aria-hidden="true">Atendimentos em cada estado em {ano} e a rede em dezembro. Ordem: mais atendimentos primeiro.</p>
      <div className="pv-tabela-rolagem" tabIndex={0} role="region" aria-label="Tabela; no celular, deslize para o lado">
        <table className="pv-tabela pv-tabela-larga">
          <caption className="cp-sr-only">Atendimentos em cada estado em {ano} e a rede em dezembro. Ordem: mais atendimentos primeiro.</caption>
          <thead>
            <tr>
              <th scope="col">Estado</th>
              <th scope="col">Atendimentos no ano</th>
              <th scope="col">Média por mês</th>
              <th scope="col">Mês de maior movimento</th>
              <th scope="col">Agências fixas</th>
              <th scope="col">Gerências executivas</th>
            </tr>
          </thead>
          <tbody>
            {ufs.map((u) => {
              const m = u.v.indexOf(Math.max(...(u.v as number[])));
              return (
                <tr key={u.uf}>
                  <th scope="row">{u.nome}</th>
                  <td>{num(u.total)}</td>
                  <td>{num(u.total / 12)}</td>
                  <td>{MESES[m]}</td>
                  <td>{num(redeUf(u.uf, "aps_fixas"))}</td>
                  <td>{num(redeUf(u.uf, "gerencias"))}</td>
                </tr>
              );
            })}
            <tr className="pv-forte">
              <th scope="row">Brasil</th>
              <td>{num(t.total)}</td>
              <td>{num(t.total / 12)}</td>
              <td>{MESES[iMax]}</td>
              <td>{num(rede.aps_fixas)}</td>
              <td>{num(rede.gerencias)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="pv-fonte">
        Fonte: {f.orgao}, {f.nome}, edição {f.edicao}. Atendimentos: tabela 43.2 ({semFonte(f.tabelas["43.2"].fonte)}); a soma do ano e a média por mês são cálculo da Scrutiniums. Rede: tabela
        43.1, posição de dezembro de {ano} ({semFonte(f.tabelas["43.1"].fonte)}). A fonte conta no Paraná uma agência ligada à gerência de Joinville (SC) e em Goiás doze ligadas à do Distrito Federal.
        Tabelas atualizadas no portal em {dataBr(f.atualizado_em)}, capturadas em {dataBr(f.capturado_em)}.
      </p>
    </section>
  );
}
