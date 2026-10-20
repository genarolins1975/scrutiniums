import Link from 'next/link';
import {
  ANOS, ANO_CORRENTE, ANOS_LIQUIDADO_IGUAL, BASES, ESTAGIOS_AREA, ESTAGIOS_INCOMPLETOS, FONTE_AREAS, NOME_BASE, NOME_ESTAGIO,
  PARCELAS_ENCARGOS, ROTA_AREAS, composicao, exercicio, datasDoExercicio, emCem, encerrado, hrefRecorte, nomeParcela, parcelasEscolhiveis,
  rotulosAlterados, serie, subfuncoesComQuebra, subfuncoesDaParcela, tipoParcela, ultimoEncerrado,
  type Composicao, type EstagioArea, type IdParcela, type Parcela, type Recorte,
} from '@/lib/contas-publicas/areas';
import {moeda, numero} from '@/lib/contas-publicas/formato';
import {Proveniencia} from '../artefatos/Proveniencia';
import {Termo} from '../artefatos/Termo';
import {EnvioAutomatico} from './EnvioAutomatico';
import {BarrasValor, LinhaParcela} from './GraficosArea';

const bi = (v: number | null) => (v === null ? 'Não informado' : numero(v / 1e9, 1));
const verbo: Record<EstagioArea, string> = {inicial: 'autorizados na lei original', atualizada: 'autorizados', empenhado: 'empenhados', liquidado: 'liquidados', pago: 'pagos'};
const classe = (p: {tipo: string; id: string}) => (p.tipo === 'divida' ? 'cp-financial' : p.tipo === 'encargos' ? 'cp-area-encargo' : p.id === 'demais' ? 'cp-area-demais' : '');
const legenda = (p: {tipo: string; id: string}) => (p.tipo === 'divida' ? 'cp-financial-label' : p.tipo === 'encargos' ? 'cp-area-encargo-label' : '');

function origem(ano: number) {
  const d = datasDoExercicio(ano);
  const ex = exercicio(ano);
  return {
    fonte: 'SIOP · dados abertos · classificação funcional',
    url: FONTE_AREAS.documentacao,
    referencia: `${ano}${encerrado(ano) ? '' : ' parcial'} · base atualizada em ${d?.atualizacao ?? 'data não identificada'}`,
    publicacao: null,
    captura: ex?.captura ?? null,
    perimetro: 'Orçamentos Fiscal e da Seguridade Social da União',
    unidade: 'R$ correntes',
    natureza: 'Execução orçamentária nominal por função e subfunção; sem restos a pagar no estágio pago',
  };
}

/** Régua: áreas abaixo de R$ 1 em cada R$ 100 viram "Demais áreas" na régua; a lista completa fica na tabela. */
function agrupar(itens: (Parcela & {cem: number})[]) {
  const grandes = itens.filter((p) => p.tipo !== 'area' || p.cem >= 1);
  const pequenas = itens.filter((p) => p.tipo === 'area' && p.cem < 1);
  if (pequenas.length < 2) return itens;
  return [...grandes, {id: 'demais' as IdParcela, nome: `Demais áreas (${pequenas.length} funções)`, tipo: 'area' as const, valor: pequenas.reduce((s, p) => s + p.valor, 0), financeiro: 0, cem: Number(pequenas.reduce((s, p) => s + p.cem, 0).toFixed(1))}];
}

function Segmentos({r}: {r: Recorte}) {
  return (
    <div className="cp-area-controles">
      <nav aria-label="Base da conta" className="cp-area-segmento">
        {BASES.map((b) => (
          <Link key={b} href={hrefRecorte(r, {base: b}, 'cem')} scroll={false} aria-current={r.base === b ? 'true' : undefined}>{NOME_BASE[b]}</Link>
        ))}
      </nav>
      <EnvioAutomatico acao={ROTA_AREAS} ancora="cem" rotulo="Exercício e estágio da régua">
        <label className="cp-select">Exercício
          <select name="ano" defaultValue={r.ano} data-padrao={ultimoEncerrado() ?? ANO_CORRENTE}>
            {[...ANOS].reverse().map((a) => <option key={a} value={a}>{a}{encerrado(a) ? '' : ' · parcial'}</option>)}
          </select>
        </label>
        <label className="cp-select">Estágio
          <select name="estagio" defaultValue={r.estagio} data-padrao="pago">
            {ESTAGIOS_AREA.map((e) => <option key={e} value={e}>{NOME_ESTAGIO[e]}</option>)}
          </select>
        </label>
        <input type="hidden" name="base" value={r.base} data-padrao="total" />
        <input type="hidden" name="area" value={r.area} data-padrao="f10" />
      </EnvioAutomatico>
    </div>
  );
}

function Abertura({r, c}: {r: Recorte; c: Composicao | null}) {
  const itens = c ? emCem(c) : null;
  const d = datasDoExercicio(r.ano);
  const divida = itens?.filter((p) => p.tipo === 'divida') ?? [];
  const areas = itens?.filter((p) => p.tipo === 'area') ?? [];
  const transf = itens?.find((p) => p.id === 'transferencias');
  const outros = itens?.find((p) => p.id === 'outros-encargos');
  const somaCem = (l: {cem: number}[]) => l.reduce((s, p) => s + p.cem, 0);
  const somaValor = (l: {valor: number}[]) => l.reduce((s, p) => s + p.valor, 0);
  const maior = areas[0];
  const plural = verbo[r.estagio];
  return (
    <section className="cp-section cp-data-section" id="cem" aria-labelledby="cem-titulo">
      <div className="cp-section-head">
        <div>
          <p className="cp-eyebrow">01 · Cada R$ 100 · {r.ano}{encerrado(r.ano) ? ' · exercício encerrado' : ' · exercício em andamento'}</p>
          <h2 id="cem-titulo">De cada R$ 100 {plural} em {r.ano}, quanto foi para cada área?</h2>
          <p>{r.base === 'total'
            ? 'Todos os pagamentos do orçamento federal, inclusive a dívida pública, que aparece em bronze e à parte: ela não é uma área de governo.'
            : 'Só a despesa primária: sem juros, amortização e refinanciamento da dívida e sem as demais operações financeiras, como empréstimos do FIES e do FAT.'}</p>
        </div>
      </div>
      <Segmentos r={r} />
      {!c || !itens ? (
        <p className="cp-status" role="status">Não informado: o SIOP não traz o estágio {NOME_ESTAGIO[r.estagio].toLowerCase()} completo para {r.ano}. Escolha outro estágio ou outro exercício. Ausência não é zero.</p>
      ) : (
        <>
          <figure className="cp-area-regua">
            <div className="cp-hundred" aria-hidden="true">
              {agrupar(itens).map((p) => <span key={p.id} className={classe(p)} style={{width: `${p.cem}%`}}>{p.cem >= 4 ? numero(p.cem) : ''}</span>)}
            </div>
            <figcaption className="cp-sr-only">Repartição de cada R$ 100 {plural} em {r.ano}, por área. A lista a seguir traz os mesmos valores.</figcaption>
            <ol className="cp-hundred-labels cp-area-lista" aria-label={`Cada R$ 100 ${plural} em ${r.ano}`}>
              {agrupar(itens).map((p) => (
                <li key={p.id} className={legenda(p)}>
                  <span><i aria-hidden="true" className={`cp-area-chave ${classe(p)}`} />{p.nome}{p.tipo === 'area' && p.id !== 'demais' && p.financeiro > 0 && r.base === 'total' ? <small> · {numero((100 * p.financeiro) / p.valor, 0)}% em operações financeiras</small> : null}</span>
                  <strong>R$ {numero(p.cem)}</strong>
                </li>
              ))}
            </ol>
          </figure>
          <div className="cp-kpis">
            <div><span>Total {plural} em {r.ano}</span><strong>{moeda(c.total, 'reais')}</strong><small>{r.base === 'total' ? 'Orçamentos Fiscal e da Seguridade Social, com a dívida' : 'Despesa primária (identificador de resultado primário diferente de 0)'}</small></div>
            {r.base === 'total'
              ? <div><span>Dívida pública</span><strong>{moeda(somaValor(divida), 'reais')}</strong><small>R$ {numero(somaCem(divida))} de cada R$ 100. Inclui o refinanciamento: títulos que vencem trocados por títulos novos.</small></div>
              : <div><span>Transferências a estados, DF e municípios</span><strong>{transf ? moeda(transf.valor, 'reais') : 'Não informado'}</strong><small>{transf ? `R$ ${numero(transf.cem)} de cada R$ 100. Dinheiro que outros governos aplicam.` : ''}</small></div>}
            <div><span>Áreas de governo (funções 01 a 27)</span><strong>{moeda(somaValor(areas), 'reais')}</strong><small>R$ {numero(somaCem(areas))} de cada R$ 100{maior ? `. Maior área: ${maior.nome}, R$ ${numero(maior.cem)}.` : '.'}</small></div>
          </div>
          <p className="cp-reading">
            {r.base === 'total' && divida.length > 0 && <>Em {r.ano}, de cada R$ 100 {plural} pelo orçamento federal, R$ {numero(somaCem(divida))} foram para a dívida pública: {divida.map((p) => `R$ ${numero(p.cem)} em ${p.id === 'divida-refinanciamento' ? 'refinanciamento' : 'juros e amortização'}`).join(' e ')}. </>}
            {transf && <>R$ {numero(transf.cem)} foram transferidos a estados, DF e municípios{outros ? `, R$ ${numero(outros.cem)} foram outros encargos especiais` : ''} e R$ {numero(somaCem(areas))} ficaram com as áreas de governo. </>}
            {maior && <>A maior área foi {maior.nome}, com R$ {numero(maior.cem)}.</>}
          </p>
          <p className="cp-note">
            Fonte: <a href={FONTE_AREAS.documentacao}>SIOP, dados abertos</a>, consulta SPARQL pública. {NOME_ESTAGIO[r.estagio]} no exercício de {r.ano}{r.estagio === 'pago' ? ', sem restos a pagar de anos anteriores' : ''}, em R$ correntes, sem correção pela inflação. Base atualizada em {d?.atualizacao}; captura em {d?.captura}. Cada parcela é arredondada por maiores restos para fechar R$ 100,0. {encerrado(r.ano) ? '' : `${r.ano} está em andamento: o recorte parcial não se compara com um ano completo.`}
          </p>
          <details className="cp-exact">
            <summary>Por que o painel usa o valor pago, e onde cada área se encaixa</summary>
            <p className="cp-note">O pago é o dinheiro que saiu do caixa no ano para a despesa daquele orçamento; é o mesmo estágio da régua de R$ 100 por grupo de despesa da entrada das Contas Federais. Ele deixa de fora os restos a pagar quitados no ano, que pertencem a orçamentos anteriores, e a despesa empenhada e ainda não paga, que vira restos a pagar. Por isso o seletor de estágio mostra também o autorizado, o empenhado e o liquidado: a <Termo id="funcao">função</Termo> de cada linha é a mesma em todos os estágios.</p>
            <p className="cp-note">A função Encargos Especiais não corresponde a um serviço: o painel a divide em quatro parcelas, sempre fora das áreas. {PARCELAS_ENCARGOS.map((p) => `${p.nome}: ${p.explica}`).join(' ')}</p>
          </details>
          <details className="cp-data-details">
            <summary>Ver todas as parcelas, em reais e em cada R$ 100</summary>
            <div className="cp-table-scroll" tabIndex={0} role="region" aria-label="Tabela de parcelas por área">
              <table className="cp-table">
                <caption>{NOME_ESTAGIO[r.estagio]} em {r.ano} · {NOME_BASE[r.base]} · R$ bilhões correntes</caption>
                <thead><tr><th scope="col">Parcela</th><th scope="col">R$ bilhões</th><th scope="col">De cada R$ 100</th><th scope="col">Operações financeiras (R$ bilhões)</th></tr></thead>
                <tbody>{itens.map((p) => <tr key={p.id}><th scope="row">{p.nome}</th><td>{bi(p.valor)}</td><td>{numero(p.cem)}</td><td>{bi(p.financeiro)}</td></tr>)}</tbody>
              </table>
            </div>
          </details>
        </>
      )}
      <Proveniencia {...origem(r.ano)} />
    </section>
  );
}

/** Artefato didático "Do orçamento ao pagamento": os quatro estágios de cada parcela, em proporção do autorizado. */
function DoOrcamentoAoPagamento({r}: {r: Recorte}) {
  const estagios: EstagioArea[] = ['atualizada', 'empenhado', 'liquidado', 'pago'];
  const comp = Object.fromEntries(estagios.map((e) => [e, composicao(r.ano, e, 'total')])) as Record<EstagioArea, Composicao | null>;
  const pago = comp.pago;
  const valor = (e: EstagioArea, id: IdParcela) => (comp[e] ? (comp[e]!.parcelas.find((p) => p.id === id)?.valor ?? 0) : null);
  const total = (e: EstagioArea) => comp[e]?.total ?? null;
  const areas = pago ? pago.parcelas.filter((p) => p.tipo === 'area').slice(0, 6).map((p) => p.id) : [];
  if (pago && tipoParcela(r.area) === 'area' && !areas.includes(r.area)) areas.push(r.area);
  const linhas: IdParcela[] = [...PARCELAS_ENCARGOS.map((p) => p.id), ...areas];
  const passos = [
    {e: 'atualizada' as const, verbo: 'Autorizar', texto: 'A lei do orçamento e os créditos aprovados no ano fixam quanto pode ser gasto em cada área.'},
    {e: 'empenhado' as const, verbo: 'Empenhar', texto: 'O órgão reserva o dinheiro e assume o compromisso com quem vai receber.'},
    {e: 'liquidado' as const, verbo: 'Liquidar', texto: 'O governo confere que o bem, o serviço ou o direito foi entregue.'},
    {e: 'pago' as const, verbo: 'Pagar', texto: 'O dinheiro sai do caixa. O que não foi pago até dezembro vira restos a pagar.'},
  ];
  const igual = ANOS_LIQUIDADO_IGUAL.includes(r.ano);
  return (
    <section className="cp-section cp-data-section" id="estagios" aria-labelledby="estagios-titulo">
      <div className="cp-section-head">
        <div>
          <p className="cp-eyebrow">02 · Artefato didático · dados reais do SIOP · {r.ano}</p>
          <h2 id="estagios-titulo">Do orçamento ao pagamento: quanto do autorizado chegou a ser pago em cada área?</h2>
          <p>Modelo didático do caminho de cada real, com os valores registrados no SIOP. Deixa de fora os restos a pagar, os bloqueios e os remanejamentos dentro do ano; mostra só a posição do fim do exercício{encerrado(r.ano) ? '' : ' (ou da última atualização, no ano em curso)'}.</p>
        </div>
      </div>
      <ol className="cp-area-passos">
        {passos.map((p, i) => (
          <li key={p.e}>
            <span className="cp-index">{String(i + 1).padStart(2, '0')} · {p.verbo}</span>
            <strong>{total(p.e) === null ? 'Não informado' : moeda(total(p.e), 'reais')}</strong>
            <span>{p.texto}</span>
          </li>
        ))}
      </ol>
      {!pago ? <p className="cp-status">Sem valores pagos completos para {r.ano}.</p> : (
        <div className="cp-area-estagios">
          {linhas.map((id) => {
            const aut = valor('atualizada', id);
            const vals = estagios.map((e) => valor(e, id));
            const escala = Math.max(...vals.map((v) => v ?? 0));
            if (!(escala > 0)) return null;
            return (
              <article key={id} className={id === r.area ? 'cp-area-escolhida' : undefined}>
                <h3>{nomeParcela(id)}{tipoParcela(id) !== 'area' ? <small> · Encargos Especiais</small> : null}</h3>
                <dl>
                  {estagios.map((e, i) => (
                    <div key={e}>
                      <dt>{NOME_ESTAGIO[e]}</dt>
                      <dd>
                        <span className={`cp-bar-track ${tipoParcela(id) === 'divida' ? 'cp-debt' : ''}`} aria-hidden="true"><span style={{width: `${vals[i] === null ? 0 : (100 * vals[i]!) / escala}%`}} /></span>
                        <strong>{vals[i] === null ? 'Não informado' : `R$ ${bi(vals[i])} bi`}</strong>
                        {e !== 'atualizada' && aut !== null && aut > 0 && vals[i] !== null ? <small>{numero((100 * vals[i]!) / aut, 0)}% do autorizado</small> : null}
                      </dd>
                    </div>
                  ))}
                </dl>
              </article>
            );
          })}
        </div>
      )}
      <p className="cp-status">A distância entre autorizado e pago não mede eficiência nem desperdício: há reservas que não se destinam a gasto, despesas que dependem de demanda (benefícios, juros) e pagamentos que ficam para o ano seguinte como restos a pagar.{igual ? ` Em ${r.ano}, a base do SIOP registra o liquidado igual ao empenhado; os dois estágios só se separam na série a partir de ${Math.max(...ANOS_LIQUIDADO_IGUAL) + 1}.` : ''}{ESTAGIOS_INCOMPLETOS.some((x) => x.ano === r.ano) ? ` Em ${r.ano}, o autorizado não está completo na fonte e aparece como não informado.` : ''}</p>
      <Proveniencia {...origem(r.ano)} />
    </section>
  );
}

function Serie({r}: {r: Recorte}) {
  const pontos = serie(r.area, r.estagio, r.base);
  const nome = nomeParcela(r.area);
  const indisponivel = r.base === 'primaria' && tipoParcela(r.area) === 'divida';
  const escolhas = parcelasEscolhiveis();
  const fechados = pontos.filter((p) => !p.parcial && p.parcela !== null);
  const primeiro = fechados[0], ultimo = fechados.at(-1);
  return (
    <section className="cp-section cp-data-section" id="serie" aria-labelledby="serie-titulo">
      <div className="cp-section-head">
        <div>
          <p className="cp-eyebrow">03 · Série · {FONTE_AREAS.primeiroAno} a {ANO_CORRENTE}</p>
          <h2 id="serie-titulo">Como mudou a parte de {nome} desde {FONTE_AREAS.primeiroAno}?</h2>
          <p>{NOME_ESTAGIO[r.estagio]} em cada exercício, {r.base === 'total' ? 'sobre todos os pagamentos, com a dívida' : 'sobre a despesa primária'}. A parte de cada R$ 100 compara anos sem depender da inflação; o valor em reais está em R$ correntes da época.</p>
        </div>
      </div>
      <EnvioAutomatico acao={ROTA_AREAS} ancora="serie" rotulo="Área da série e do detalhe">
        <label className="cp-select">Área
          <select name="area" defaultValue={r.area} data-padrao="f10">
            <optgroup label="Encargos Especiais (não são áreas)">{escolhas.filter((p) => p.tipo !== 'area').map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</optgroup>
            <optgroup label="Áreas de governo">{escolhas.filter((p) => p.tipo === 'area').map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</optgroup>
          </select>
        </label>
        <input type="hidden" name="ano" value={r.ano} data-padrao={ultimoEncerrado() ?? ANO_CORRENTE} />
        <input type="hidden" name="estagio" value={r.estagio} data-padrao="pago" />
        <input type="hidden" name="base" value={r.base} data-padrao="total" />
      </EnvioAutomatico>
      {indisponivel ? <p className="cp-status">A dívida não faz parte da despesa primária. Escolha a base com todos os pagamentos para ver a série dela.</p> : (
        <>
          {primeiro && ultimo && <p className="cp-reading">{nome}: R$ {numero(primeiro.parcela)} de cada R$ 100 em {primeiro.ano} e R$ {numero(ultimo.parcela)} em {ultimo.ano}; em valores correntes, de R$ {bi(primeiro.valor)} bilhões para R$ {bi(ultimo.valor)} bilhões. A comparação em reais mistura preços de épocas diferentes.</p>}
          <div className="cp-data-grid">
            <figure>
              <figcaption><h3>Parte de cada R$ 100</h3><p className="cp-note">R$ em cada R$ 100 {verbo[r.estagio]} · ponto vazado: {ANO_CORRENTE} parcial</p></figcaption>
              <LinhaParcela pontos={pontos} nome={nome} unidade="R$ em cada R$ 100" />
            </figure>
            <figure>
              <figcaption><h3>Valor no ano</h3><p className="cp-note">R$ bilhões correntes, sem correção pela inflação · barra clara: {ANO_CORRENTE} parcial</p></figcaption>
              <BarrasValor pontos={pontos} nome={nome} />
            </figure>
          </div>
          <details className="cp-data-details">
            <summary>Ver a série em tabela</summary>
            <div className="cp-table-scroll" tabIndex={0} role="region" aria-label="Série da área em tabela">
              <table className="cp-table">
                <caption>{nome} · {NOME_ESTAGIO[r.estagio]} · {NOME_BASE[r.base]}</caption>
                <thead><tr><th scope="col">Exercício</th><th scope="col">R$ bilhões correntes</th><th scope="col">De cada R$ 100</th><th scope="col">Total da base (R$ bilhões)</th></tr></thead>
                <tbody>{pontos.map((p) => <tr key={p.ano}><th scope="row">{p.ano}{p.parcial ? ' (parcial)' : ''}</th><td>{bi(p.valor)}</td><td>{p.parcela === null ? 'Não informado' : numero(p.parcela)}</td><td>{bi(p.total)}</td></tr>)}</tbody>
              </table>
            </div>
          </details>
        </>
      )}
      <p className="cp-note">Quebras da série: as 28 funções são as mesmas desde 2000 (Portaria nº 42/1999); subfunções foram criadas e extintas, o que muda o detalhe abaixo, não o total da função. {ANOS_LIQUIDADO_IGUAL.length ? `De ${Math.min(...ANOS_LIQUIDADO_IGUAL)} a ${Math.max(...ANOS_LIQUIDADO_IGUAL)}, o liquidado registrado é igual ao empenhado.` : ''} {ESTAGIOS_INCOMPLETOS.map((x) => `${x.ano}: ${NOME_ESTAGIO[x.estagio].toLowerCase()} incompleto na fonte, sem ponto.`).join(' ')} A lista completa está no método, no fim da página.</p>
    </section>
  );
}

function Subfuncoes({r}: {r: Recorte}) {
  const linhas = subfuncoesDaParcela(r.area, r.ano);
  const nome = nomeParcela(r.area);
  const totalPago = linhas.reduce((s, l) => s + (l.valores.pago ?? 0), 0);
  return (
    <section className="cp-section cp-data-section" id="subfuncoes" aria-labelledby="sub-titulo">
      <div className="cp-section-head">
        <div>
          <p className="cp-eyebrow">04 · Detalhe · {r.ano}{encerrado(r.ano) ? '' : ' parcial'}</p>
          <h2 id="sub-titulo">Dentro de {nome}: em que o dinheiro foi aplicado?</h2>
          <p>Cada <Termo id="subfuncao">subfunção</Termo> detalha a natureza da atuação dentro da área. Uma subfunção pode aparecer em outra área (por exemplo, Administração Geral em quase todas): o valor é o da combinação com {nome}.</p>
        </div>
      </div>
      {linhas.length === 0 ? <p className="cp-status">Sem execução registrada em {nome} em {r.ano}.</p> : (
        <div className="cp-table-scroll" tabIndex={0} role="region" aria-label={`Subfunções de ${nome} em ${r.ano}`}>
          <table className="cp-table cp-area-subtabela">
            <caption>{nome} · {r.ano} · R$ bilhões correntes · todos os estágios, inclusive operações financeiras</caption>
            <thead><tr><th scope="col">Subfunção</th>{ESTAGIOS_AREA.filter((e) => e !== 'inicial').map((e) => <th scope="col" key={e}>{NOME_ESTAGIO[e]}</th>)}<th scope="col">Parte do pago da área</th><th scope="col">Pago em operações financeiras</th></tr></thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.codigo}>
                  <th scope="row">{l.codigo} · {l.nome}{l.anos[0] > FONTE_AREAS.primeiroAno || l.anos.at(-1)! < ANO_CORRENTE ? <small> · nesta área de {l.anos[0]} a {l.anos.at(-1)}{l.anos.length < l.anos.at(-1)! - l.anos[0] + 1 ? ', com intervalos' : ''}</small> : null}</th>
                  {ESTAGIOS_AREA.filter((e) => e !== 'inicial').map((e) => <td key={e}>{bi(l.valores[e])}</td>)}
                  <td>{totalPago > 0 && l.valores.pago !== null ? `${numero((100 * l.valores.pago) / totalPago)}%` : 'Não calculável'}</td>
                  <td>{bi(l.financeiroPago)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="cp-note">Valores abaixo de R$ 50 milhões aparecem como 0,0. Zero calculado não é ausência: a subfunção existe no orçamento do ano e não teve valor no estágio.</p>
    </section>
  );
}

function Metodo() {
  const quebras = subfuncoesComQuebra();
  const rotulos = rotulosAlterados();
  return (
    <section className="cp-section" id="metodo" aria-labelledby="metodo-titulo">
      <details className="cp-method-fold">
        <summary><span id="metodo-titulo">Método, fontes, notas e downloads</span> <span>SIOP · {FONTE_AREAS.primeiroAno} a {ANO_CORRENTE} · R$ correntes</span></summary>
        <div className="cp-area-metodo">
          <h3>O que é a área</h3>
          <p>A área é a <Termo id="funcao">função</Termo> da classificação funcional ({FONTE_AREAS.classificacao}). Ela é atribuída pela competência do órgão que executa a ação, não pelo resultado: um hospital universitário pode estar em Educação, e o pagamento de pessoal de um ministério fica na função dele.</p>
          <h3>Dívida e despesa primária</h3>
          <p>A dívida pública são as subfunções 841 a 844 da função Encargos Especiais: refinanciamento (títulos novos que pagam títulos vencidos) e serviço (juros e amortização com outros recursos). A base &quot;só a despesa primária&quot; usa o <Termo id="despesa-financeira">identificador de resultado primário</Termo>: exclui as linhas com código 0, que além da dívida incluem empréstimos e financiamentos registrados em outras áreas (FIES, repasses do FAT ao BNDES, fundos constitucionais de financiamento).</p>
          <h3>Estágio e período</h3>
          <p>Cinco estágios por exercício, na posição da última atualização da base do SIOP. Pago no exercício não inclui o pagamento de restos a pagar. Valores nominais: a Scrutiniums não corrige pela inflação a execução anual do SIOP; o IPCA usado no Panorama vale só para o resultado mensal do Tesouro desde 2023. Para comparar anos, use a parte de cada R$ 100.</p>
          <h3>Conferências que retêm a publicação</h3>
          <p>Para cada exercício, a soma por função e subfunção é conferida contra uma consulta independente por esfera (tolerância de R$ 5 ou um décimo de bilionésimo do total, porque a fonte soma em ponto flutuante). Estágio com item sem valor na fonte fica não informado. A coleta roda toda terça, no mesmo ciclo do SIOP das Contas Federais; teste que falha retém a publicação e abre issue.</p>
          <h3>Quebras e notas da série</h3>
          <ul>
            {ANOS_LIQUIDADO_IGUAL.length > 0 && <li>De {Math.min(...ANOS_LIQUIDADO_IGUAL)} a {Math.max(...ANOS_LIQUIDADO_IGUAL)}, o SIOP registra o liquidado igual (ou quase igual, abaixo de 0,05%) ao empenhado; empenho e liquidação só se separam a partir de {Math.max(...ANOS_LIQUIDADO_IGUAL) + 1}.</li>}
            {ESTAGIOS_INCOMPLETOS.map((x) => <li key={`${x.ano}${x.estagio}`}>{x.ano}: {NOME_ESTAGIO[x.estagio].toLowerCase()} sem valor em parte dos itens na fonte; aparece como não informado.</li>)}
            <li>Classificação funcional atualizada pela Portaria SOF/ME nº 2.520, de 21/03/2022. As funções não mudaram; subfunções que não atravessam a série inteira:{' '}
              {quebras.map((q, i) => <span key={q.codigo}>{i ? '; ' : ''}{q.codigo} {q.nome} ({q.de === q.ate ? q.de : `${q.de} a ${q.ate}`})</span>)}.</li>
            {rotulos.length > 0 && <li>Nomes que mudaram: {rotulos.map((x, i) => <span key={`${x.tipo}${x.codigo}`}>{i ? '; ' : ''}{x.codigo} &quot;{x.antes}&quot; passou a &quot;{x.depois}&quot; em {x.desde}</span>)}. O painel usa o nome mais recente.</li>}
            <li>Bases de {FONTE_AREAS.primeiroAno} a 2013 foram atualizadas pela última vez em 2014; cada exercício traz a própria data de atualização e de captura.</li>
          </ul>
          <h3>O que esta página não permite concluir</h3>
          <p>Que uma área recebe demais ou de menos, que gastar mais produz mais serviço ou que um ano foi melhor que outro. Parte relevante do gasto federal com saúde e educação é transferida a estados e municípios e aparece na própria área (transferências fundo a fundo) ou em Encargos Especiais (Fundeb).</p>
          <h3>Fontes</h3>
          <p><a href={FONTE_AREAS.documentacao}>SIOP, dados abertos do orçamento federal</a>; consulta SPARQL pública em <a href={FONTE_AREAS.url}>{FONTE_AREAS.url}</a>. Classificação: Manual Técnico de Orçamento 2026, seção 4.4 (função e subfunção) e 4.6.2.4 (resultado primário).</p>
          <h3>Downloads</h3>
          <ul>
            <li><a href="/contas-publicas/por-area/funcoes.csv">Execução por função, subfunção e resultado primário, {FONTE_AREAS.primeiroAno} a {ANO_CORRENTE} · CSV</a></li>
            <li><a href="/contas-publicas/funcoes.json">Snapshot completo com datas, hashes e conferências · JSON</a></li>
          </ul>
        </div>
      </details>
    </section>
  );
}

export function PainelAreas({r}: {r: Recorte}) {
  const c = composicao(r.ano, r.estagio, r.base);
  return (
    <>
      <Abertura r={r} c={c} />
      <DoOrcamentoAoPagamento r={r} />
      <Serie r={r} />
      <Subfuncoes r={r} />
      <Metodo />
    </>
  );
}
