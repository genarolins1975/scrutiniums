import Link from 'next/link';
import {
  ANOS, ANO_CORRENTE, ANOS_LIQUIDADO_IGUAL, BASES, ESTAGIOS_AREA, ESTAGIOS_INCOMPLETOS, FONTE_AREAS, NOME_BASE, NOME_ESTAGIO,
  PARCELAS_ENCARGOS, PARCELA_RESERVA, ROTA_AREAS, composicao, exercicio, datasDoExercicio, emCem, encerrado, hrefRecorte, nomeParcela, parcelasEscolhiveis,
  rotulosAlterados, serie, conciliacaoGrupos, subfuncoesComQuebra, subfuncoesDaParcela, tipoParcela, grupoParcela, ultimoEncerrado,
  type Composicao, type EstagioArea, type IdParcela, type Parcela, type Recorte,
} from '@/lib/contas-publicas/areas';
import {moeda, numero} from '@/lib/contas-publicas/formato';
import {Recolhido} from '@/components/observatorios/Recolhido';
import {Controles, FiguraAnalitica, GraficoBarras, GraficoLinhas, LeituraGuiada, PaginaPainel, TabelaDados, type NumeroProps} from '@/components/painel';
import {provenienciaMontada} from '@/lib/painel/proveniencia-montada';
import {Proveniencia} from '../artefatos/Proveniencia';
import {Termo} from '../artefatos/Termo';
import {EnvioAutomatico} from './EnvioAutomatico';

/**
 * Painel "Para onde vai o dinheiro federal, por área?" no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026). As
 * fatias, na ordem: a abertura com o recorte da página (base, exercício e estágio) como primeira ação; os três totais na faixa
 * de números; a régua de cada R$ 100, o artefato "Do orçamento ao pagamento" e a série da área escolhida como figuras (a área tem
 * o próprio controle, logo antes da série); as subfunções na tabela à vista; o método no fim. Os textos, números, arredondamentos
 * e o recorte na URL são os de antes; o recorte segue lido no servidor.
 */

const bi = (v: number | null) => (v === null ? 'Não informado' : numero(v / 1e9, 1));
const emBi = (v: number | null) => (v === null ? null : v / 1e9);
const singular: Record<EstagioArea, string> = {inicial: 'autorizado na lei original', atualizada: 'autorizado', empenhado: 'empenhado', liquidado: 'liquidado', pago: 'pago'};
const verbo: Record<EstagioArea, string> = {inicial: 'autorizados na lei original', atualizada: 'autorizados', empenhado: 'empenhados', liquidado: 'liquidados', pago: 'pagos'};
const FONTE_CURTA = 'SIOP, dados abertos, classificação funcional';

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

/** A proveniência da figura, com o que a ficha "Datas e ficha da fonte" mostrava: referência, atualização, captura, perímetro e natureza. */
function prov(indicador: string, inicio: number, fim: number, natureza: 'OBSERVADO' | 'CALCULADO' = 'CALCULADO') {
  const ex = exercicio(fim);
  return provenienciaMontada({
    indicador,
    natureza,
    orgao: 'SIOP',
    dataset: 'dados abertos do orçamento federal, classificação funcional',
    recurso: 'consulta SPARQL pública',
    url: FONTE_AREAS.documentacao,
    urlPrimaria: FONTE_AREAS.url,
    unidade: 'R$ correntes',
    frequencia: 'anual (posição da última atualização da base em cada exercício)',
    inicio: String(inicio),
    fim: String(fim),
    coberturaInicio: String(FONTE_AREAS.primeiroAno),
    coberturaFim: String(ANO_CORRENTE),
    publicadoEm: ex?.atualizacao ?? null,
    capturadoEm: ex?.captura ?? null,
    transformacoes: ['Execução orçamentária nominal por função e subfunção dos Orçamentos Fiscal e da Seguridade Social da União; sem restos a pagar no estágio pago.', 'Cada parcela arredondada por maiores restos para fechar R$ 100,0.'],
    limitacoes: ['Valores nominais, sem correção pela inflação.', 'A área é a função orçamentária, definida pela competência do órgão que gasta, não pelo resultado.'],
    download: null,
  });
}

/** Régua: áreas abaixo de R$ 1 em cada R$ 100 viram "Demais áreas" na régua; a lista completa fica na tabela. */
function agrupar(itens: (Parcela & {cem: number})[]) {
  const grandes = itens.filter((p) => p.tipo !== 'area' || p.cem >= 1);
  const pequenas = itens.filter((p) => p.tipo === 'area' && p.cem < 1);
  if (pequenas.length < 2) return itens;
  return [...grandes, {id: 'demais' as IdParcela, nome: `Demais áreas (${pequenas.length} funções)`, tipo: 'area' as const, valor: pequenas.reduce((s, p) => s + p.valor, 0), financeiro: 0, cem: Number(pequenas.reduce((s, p) => s + p.cem, 0).toFixed(1))}];
}

/** A primeira ação da página: a base da conta, o exercício e o estágio, no formulário GET de sempre (o recorte fica na URL). */
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

/** Os três totais que ficavam sob a régua: total do estágio, dívida (ou transferências, na base primária) e áreas de governo. */
function numerosDaAbertura(r: Recorte, c: Composicao | null): NumeroProps[] {
  const periodo = `${r.ano}${encerrado(r.ano) ? '' : ', parcial'}`;
  const base = {periodo, fonte: FONTE_CURTA, natureza: 'CALCULADO' as const, unidade: 'R$ correntes', tamanho: 'm' as const};
  const motivo = `O SIOP não traz o estágio ${NOME_ESTAGIO[r.estagio].toLowerCase()} completo para ${r.ano}. Ausência não é zero.`;
  const itens = c ? emCem(c) : null;
  if (!c || !itens) {
    return [
      {...base, rotulo: `Total ${singular[r.estagio]} em ${r.ano}`, valor: null, motivoAusencia: motivo},
      {...base, rotulo: r.base === 'total' ? 'Dívida pública' : 'Transferências a estados, DF e municípios', valor: null, motivoAusencia: motivo},
      {...base, rotulo: 'Áreas de governo (funções 01 a 27)', valor: null, motivoAusencia: motivo},
    ];
  }
  const divida = itens.filter((p) => p.tipo === 'divida');
  const areas = itens.filter((p) => p.tipo === 'area');
  const transf = itens.find((p) => p.id === 'transferencias');
  const somaCem = (l: {cem: number}[]) => l.reduce((s, p) => s + p.cem, 0);
  const somaValor = (l: {valor: number}[]) => l.reduce((s, p) => s + p.valor, 0);
  const maior = areas[0];
  return [
    {...base, rotulo: `Total ${singular[r.estagio]} em ${r.ano}`, valor: c.total, valorTexto: moeda(c.total, 'reais'), nota: r.base === 'total' ? 'Orçamentos Fiscal e da Seguridade Social, com a dívida' : 'Despesa primária (identificador de resultado primário diferente de 0)'},
    r.base === 'total'
      ? {...base, rotulo: 'Dívida pública', valor: somaValor(divida), valorTexto: moeda(somaValor(divida), 'reais'), nota: `R$ ${numero(somaCem(divida))} de cada R$ 100. Inclui o refinanciamento: títulos que vencem trocados por títulos novos.`}
      : transf
        ? {...base, rotulo: 'Transferências a estados, DF e municípios', valor: transf.valor, valorTexto: moeda(transf.valor, 'reais'), nota: `R$ ${numero(transf.cem)} de cada R$ 100. Dinheiro que outros governos aplicam.`}
        : {...base, rotulo: 'Transferências a estados, DF e municípios', valor: null, motivoAusencia: 'Não informado: sem transferências registradas nesta base e neste estágio.'},
    {...base, rotulo: 'Áreas de governo (funções 01 a 27)', valor: somaValor(areas), valorTexto: moeda(somaValor(areas), 'reais'), nota: `R$ ${numero(somaCem(areas))} de cada R$ 100${maior ? `. Maior área: ${maior.nome}, R$ ${numero(maior.cem)}.` : '.'}`},
  ];
}

function Cem({r, c}: {r: Recorte; c: Composicao | null}) {
  const itens = c ? emCem(c) : null;
  const d = datasDoExercicio(r.ano);
  const plural = verbo[r.estagio];
  const titulo = `De cada R$ 100 ${plural} em ${r.ano}, quanto foi para cada área?`;
  const resumo = `Cada R$ 100 · ${r.ano}${encerrado(r.ano) ? ' · exercício encerrado' : ' · exercício em andamento'}`;
  const lead = r.base === 'total'
    ? 'Todos os pagamentos do orçamento federal, inclusive a dívida pública, que aparece em bronze e à parte: ela não é uma área de governo.'
    : 'Só a despesa primária: sem juros, amortização e refinanciamento da dívida e sem as demais operações financeiras, como empréstimos do FIES e do FAT.';
  if (!c || !itens) {
    return (
      <Recolhido id="cem" aberto nivelTitulo={2} titulo={titulo} resumo={resumo}>
        <p className="t-corpo max-w-prose2 text-carvao-muted">{lead}</p>
        <p className="cp-status" role="status">Não informado: o SIOP não traz o estágio {NOME_ESTAGIO[r.estagio].toLowerCase()} completo para {r.ano}. Escolha outro estágio ou outro exercício. Ausência não é zero.</p>
        <Proveniencia {...origem(r.ano)} />
      </Recolhido>
    );
  }
  const divida = itens.filter((p) => p.tipo === 'divida');
  const areas = itens.filter((p) => p.tipo === 'area');
  const transf = itens.find((p) => p.id === 'transferencias');
  const outros = itens.find((p) => p.id === 'outros-encargos');
  const reserva = itens.find((p) => p.id === 'reserva');
  const somaCem = (l: {cem: number}[]) => l.reduce((s, p) => s + p.cem, 0);
  const maior = areas[0];
  const grupos = agrupar(itens);
  const k = r.base === 'total' && r.estagio === 'pago' ? conciliacaoGrupos(r.ano) : null;
  return (
    <FiguraAnalitica
      id="cem"
      pergunta={titulo}
      subtitulo={`${resumo} · ${NOME_BASE[r.base]} · R$ em cada R$ 100 ${plural}`}
      natureza="CALCULADO"
      proveniencia={prov(`Cada R$ 100 ${plural} pelo orçamento federal, por área (${NOME_BASE[r.base].toLowerCase()})`, r.ano, r.ano)}
      leitura={
        <LeituraGuiada>
          {r.base === 'total' && divida.length > 0 && <>Em {r.ano}, de cada R$ 100 {plural} pelo orçamento federal, R$ {numero(somaCem(divida))} foram para a dívida pública: {divida.map((p) => `R$ ${numero(p.cem)} em ${p.id === 'divida-refinanciamento' ? 'refinanciamento' : 'juros e amortização'}`).join(' e ')}. </>}
          {transf && <>R$ {numero(transf.cem)} foram para estados, DF e municípios{outros ? `, R$ ${numero(outros.cem)} para outros encargos especiais` : ''}{reserva ? `, R$ ${numero(reserva.cem)} para a reserva de contingência` : ''} e R$ {numero(somaCem(areas))} para as áreas de governo. </>}
          {maior && <>A maior área foi {maior.nome}, com R$ {numero(maior.cem)}.</>}
        </LeituraGuiada>
      }
      complemento={
        <>
          <p className="t-meta max-w-prose2 text-carvao-muted">{lead}</p>
          <p className="t-meta max-w-prose2 text-carvao-muted">
            Fonte: <a href={FONTE_AREAS.documentacao} className="underline">SIOP, dados abertos</a>, consulta SPARQL pública. {NOME_ESTAGIO[r.estagio]} no exercício de {r.ano}{r.estagio === 'pago' ? ', sem restos a pagar de anos anteriores' : ''}, em R$ correntes, sem correção pela inflação. Base atualizada em {d?.atualizacao}; captura em {d?.captura}. Cada parcela é arredondada por maiores restos para fechar R$ 100,0. {encerrado(r.ano) ? '' : `${r.ano} está em andamento: o recorte parcial não se compara com um ano completo.`}
          </p>
          {k && Math.abs(k.diferenca) >= 5e8 ? <p className="t-meta max-w-prose2 text-carvao-muted">A régua por grupo de despesa da <Link href="/contas-publicas" className="underline">entrada das Contas Federais</Link> mostra R$ {numero((100 * k.grupos) / c.total)} de cada R$ 100 em juros e amortização; aqui a dívida soma R$ {numero(somaCem(divida))}. A diferença, R$ {bi(k.diferenca)} bilhões, são juros e amortização classificados fora das subfunções da dívida; em 2025, conferido no SIOP, todos em Outros encargos especiais, sobretudo a cobertura do resultado negativo do Banco Central.</p> : null}
          <details className="cp-exact">
            <summary>Por que o painel usa o valor pago, e onde cada área se encaixa</summary>
            <p className="cp-note">O pago é o dinheiro que saiu do caixa no ano para a despesa daquele orçamento; é o mesmo estágio da régua de R$ 100 por grupo de despesa da entrada das Contas Federais. Ele deixa de fora os restos a pagar quitados no ano, que pertencem a orçamentos anteriores, e a despesa empenhada e ainda não paga, que vira restos a pagar. Por isso o seletor de estágio mostra também o autorizado, o empenhado e o liquidado: a <Termo id="funcao">função</Termo> de cada linha é a mesma em todos os estágios.</p>
            <p className="cp-note">A função Encargos Especiais não corresponde a um serviço: o painel a divide em quatro parcelas, sempre fora das áreas. {PARCELAS_ENCARGOS.map((p) => `${p.nome}: ${p.explica}`).join(' ')} {PARCELA_RESERVA.nome}: {PARCELA_RESERVA.explica}</p>
          </details>
        </>
      }
      naoConcluir="que uma área recebe demais ou de menos: a régua mostra para onde o dinheiro foi no ano, não o que ele entregou, e a área é a função do órgão que gasta, não o resultado."
      tabela={{
        titulo: `${NOME_ESTAGIO[r.estagio]} em ${r.ano} · ${NOME_BASE[r.base]} · R$ bilhões correntes`,
        colunas: ['Parcela', 'R$ bilhões', 'De cada R$ 100', 'Operações financeiras (R$ bilhões)'],
        linhas: itens.map((p) => [p.nome, emBi(p.valor), p.cem, emBi(p.financeiro)]),
        casas: [null, 1, 1, 1],
        limite: itens.length,
      }}
    >
      <GraficoBarras
        semTabela
        titulo={`Cada R$ 100 ${plural} em ${r.ano}, por área`}
        dados={grupos.map((p) => ({id: p.id, nome: p.nome, area: p.tipo === 'area' ? p.cem : null, divida: p.tipo === 'divida' ? p.cem : null, fora: p.tipo === 'encargos' || p.tipo === 'reserva' ? p.cem : null}))}
        chaveCategoria="id"
        chaveRotulo="nome"
        series={[
          {id: 'area', rotulo: 'Áreas de governo', cor: 'var(--cor-obee)', opcional: true},
          {id: 'divida', rotulo: 'Dívida pública, à parte', cor: 'var(--cor-bronze)', opcional: true},
          {id: 'fora', rotulo: 'Encargos especiais e reserva, fora das áreas', cor: 'var(--serie-referencia)', opcional: true},
        ]}
        unidade="R$ em cada R$ 100"
        casas={1}
        orientacao="horizontal"
        // a régua inteira à vista: sem a caixa de rolagem de 480 px, que escondia as últimas parcelas
        alturaMaxima={grupos.length * 48 + 48}
        empilhado
        rotulosValor
      />
    </FiguraAnalitica>
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
  const linhas: IdParcela[] = [...PARCELAS_ENCARGOS.map((p) => p.id), ...areas, PARCELA_RESERVA.id];
  const passos = [
    {e: 'atualizada' as const, verbo: 'Autorizar', texto: 'A lei do orçamento e os créditos aprovados no ano fixam quanto pode ser gasto em cada área.'},
    {e: 'empenhado' as const, verbo: 'Empenhar', texto: 'O órgão reserva o dinheiro e assume o compromisso com quem vai receber.'},
    {e: 'liquidado' as const, verbo: 'Liquidar', texto: 'O governo confere que o bem, o serviço ou o direito foi entregue.'},
    {e: 'pago' as const, verbo: 'Pagar', texto: 'O dinheiro sai do caixa. O que não foi pago até dezembro vira restos a pagar.'},
  ];
  const igual = ANOS_LIQUIDADO_IGUAL.includes(r.ano);
  return (
    <Recolhido id="estagios" aberto nivelTitulo={2} titulo="Do orçamento ao pagamento: quanto do autorizado chegou a ser pago em cada área?" resumo={`Modelo didático · dados reais do SIOP · ${r.ano}`}>
      <p className="t-corpo max-w-prose2 text-carvao-muted">Modelo didático do caminho de cada real, com os valores registrados no SIOP. Deixa de fora os restos a pagar, os bloqueios e os remanejamentos dentro do ano; mostra só a posição do fim do exercício{encerrado(r.ano) ? '' : ' (ou da última atualização, no ano em curso)'}.</p>
      {/* os quatro passos são uma lista ordenada: a ordem vem da posição, sem numeração escrita no rótulo */}
      <ol className="cp-area-passos">
        {passos.map((p) => (
          <li key={p.e}>
            <span className="cp-index">{p.verbo}</span>
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
                <h3>{nomeParcela(id)}{grupoParcela(id) ? <small> · {grupoParcela(id)}</small> : null}</h3>
                <dl>
                  {estagios.map((e, i) => (
                    <div key={e}>
                      <dt>{NOME_ESTAGIO[e]}</dt>
                      <dd>
                        <span className={`cp-bar-track ${tipoParcela(id) === 'divida' ? 'cp-debt' : tipoParcela(id) === 'area' ? '' : 'cp-area-encargo-trilho'}`} aria-hidden="true"><span style={{width: `${vals[i] === null ? 0 : (100 * vals[i]!) / escala}%`}} /></span>
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
    </Recolhido>
  );
}

/** O controle da área: vale para a série e para o detalhe por subfunção, logo abaixo dele. */
function ControleArea({r}: {r: Recorte}) {
  const escolhas = parcelasEscolhiveis();
  return (
    <Controles rotulo="Área da série e do detalhe" resumo={<>Mostrando {nomeParcela(r.area)} · {NOME_ESTAGIO[r.estagio].toLowerCase()} · {NOME_BASE[r.base].toLowerCase()}</>} limpar={r.area !== 'f10' ? {href: hrefRecorte(r, {area: 'f10'}, 'serie')} : undefined}>
      <EnvioAutomatico acao={ROTA_AREAS} ancora="serie" rotulo="Área da série e do detalhe">
        <label className="cp-select">Área
          <select name="area" defaultValue={r.area} data-padrao="f10">
            <optgroup label="Fora das áreas de governo">{escolhas.filter((p) => p.tipo !== 'area').map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</optgroup>
            <optgroup label="Áreas de governo">{escolhas.filter((p) => p.tipo === 'area').map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</optgroup>
          </select>
        </label>
        <input type="hidden" name="ano" value={r.ano} data-padrao={ultimoEncerrado() ?? ANO_CORRENTE} />
        <input type="hidden" name="estagio" value={r.estagio} data-padrao="pago" />
        <input type="hidden" name="base" value={r.base} data-padrao="total" />
      </EnvioAutomatico>
    </Controles>
  );
}

function Serie({r}: {r: Recorte}) {
  const pontos = serie(r.area, r.estagio, r.base);
  const nome = nomeParcela(r.area);
  const indisponivel = r.base === 'primaria' && tipoParcela(r.area) === 'divida';
  const fechados = pontos.filter((p) => !p.parcial && p.parcela !== null);
  const primeiro = fechados[0], ultimo = fechados.at(-1);
  const titulo = `Como mudou a parte de ${nome} desde ${FONTE_AREAS.primeiroAno}?`;
  const lead = `${NOME_ESTAGIO[r.estagio]} em cada exercício, ${r.base === 'total' ? 'sobre todos os pagamentos, com a dívida' : 'sobre a despesa primária'}. A parte de cada R$ 100 compara anos sem depender da inflação; o valor em reais está em R$ correntes da época.`;
  const quebras = (
    <>Quebras da série: as 28 funções são as mesmas desde 2000 (Portaria nº 42/1999); subfunções foram criadas e extintas, o que muda o detalhe abaixo, não o total da função. {ANOS_LIQUIDADO_IGUAL.length ? `De ${Math.min(...ANOS_LIQUIDADO_IGUAL)} a ${Math.max(...ANOS_LIQUIDADO_IGUAL)}, o liquidado registrado é igual ao empenhado.` : ''} {ESTAGIOS_INCOMPLETOS.map((x) => `${x.ano}: ${NOME_ESTAGIO[x.estagio].toLowerCase()} incompleto na fonte, sem ponto.`).join(' ')} A lista completa está no método, no fim da página.</>
  );
  if (indisponivel) {
    return (
      <Recolhido id="serie" aberto nivelTitulo={2} titulo={titulo} resumo={`Série · ${FONTE_AREAS.primeiroAno} a ${ANO_CORRENTE}`}>
        <p className="t-corpo max-w-prose2 text-carvao-muted">{lead}</p>
        <p className="cp-status">A dívida não faz parte da despesa primária. Escolha a base com todos os pagamentos para ver a série dela.</p>
        <p className="t-meta max-w-prose2 text-carvao-muted">{quebras}</p>
      </Recolhido>
    );
  }
  // o ano em curso fica numa série à parte, tracejada a partir do último ano fechado, e rotulada como parcial
  const parcial = pontos.find((p) => p.parcial && p.parcela !== null);
  const anterior = parcial ? pontos.find((q) => q.ano === parcial.ano - 1 && !q.parcial && q.parcela !== null) : undefined;
  const dadosLinha = pontos.map((p) => ({ano: String(p.ano), parte: p.parcial ? null : p.parcela, parcial: p.parcial ? p.parcela : anterior && p.ano === anterior.ano ? p.parcela : null}));
  return (
    <FiguraAnalitica
      id="serie"
      pergunta={titulo}
      subtitulo={`Série · ${FONTE_AREAS.primeiroAno} a ${ANO_CORRENTE} · ${NOME_ESTAGIO[r.estagio]} · ${NOME_BASE[r.base]}`}
      natureza="CALCULADO"
      proveniencia={prov(`${nome}: parte de cada R$ 100 e valor no ano (${NOME_ESTAGIO[r.estagio].toLowerCase()}, ${NOME_BASE[r.base].toLowerCase()})`, FONTE_AREAS.primeiroAno, ANO_CORRENTE)}
      leitura={
        primeiro && ultimo ? (
          <LeituraGuiada>
            {nome}: R$ {numero(primeiro.parcela)} de cada R$ 100 em {primeiro.ano} e R$ {numero(ultimo.parcela)} em {ultimo.ano}; em valores correntes, de R$ {bi(primeiro.valor)} bilhões para R$ {bi(ultimo.valor)} bilhões. A comparação em reais mistura preços de épocas diferentes.
          </LeituraGuiada>
        ) : undefined
      }
      complemento={
        <>
          <p className="t-meta max-w-prose2 text-carvao-muted">{lead}</p>
          {r.area === 'reserva' && r.estagio !== 'inicial' && r.estagio !== 'atualizada' && <p className="cp-status">A reserva de contingência não é executada: o que dela se usa vira crédito de outra área. Por isso o valor é zero em {NOME_ESTAGIO[r.estagio].toLowerCase()}; escolha o estágio autorizado para ver quanto foi reservado.</p>}
        </>
      }
      ressalva={quebras}
      naoConcluir="que a área ganhou ou perdeu prioridade por decisão de alguém: a parte de cada R$ 100 também muda quando outras parcelas crescem, e o valor em reais é nominal, sem correção pela inflação."
      tabela={{
        titulo: `${nome} · ${NOME_ESTAGIO[r.estagio]} · ${NOME_BASE[r.base]}`,
        colunas: ['Exercício', 'R$ bilhões correntes', 'De cada R$ 100', 'Total da base (R$ bilhões)'],
        linhas: pontos.map((p) => [`${p.ano}${p.parcial ? ' (parcial)' : ''}`, emBi(p.valor), p.parcela, emBi(p.total)]),
        casas: [null, 1, 1, 1],
        limite: pontos.length,
      }}
    >
      <div className="grid gap-10 lg:grid-cols-2">
        <div className="min-w-0">
          <h3 className="t-h3 text-carvao">Parte de cada R$ 100</h3>
          <p className="t-meta mt-1 text-carvao-muted">R$ em cada R$ 100 {verbo[r.estagio]} · trecho tracejado: {ANO_CORRENTE} parcial</p>
          <div className="mt-3">
            <GraficoLinhas
              semTabela
              titulo={`${nome}: parte de cada R$ 100 ${verbo[r.estagio]}, ${FONTE_AREAS.primeiroAno} a ${ANO_CORRENTE}`}
              dados={dadosLinha}
              chaveX="ano"
              formatoX="texto"
              series={[
                {id: 'parte', rotulo: nome, cor: 'var(--cor-obee)'},
                ...(parcial ? [{id: 'parcial', rotulo: `${parcial.ano}, parcial`, cor: 'var(--cor-obee)', tracejada: true}] : []),
              ]}
              unidade="R$ em cada R$ 100"
              casas={1}
              zeroNoEixo
            />
          </div>
        </div>
        <div className="min-w-0">
          <h3 className="t-h3 text-carvao">Valor no ano</h3>
          <p className="t-meta mt-1 text-carvao-muted">R$ bilhões correntes, sem correção pela inflação · barra à parte: {ANO_CORRENTE} parcial</p>
          <div className="mt-3">
            <GraficoBarras
              semTabela
              titulo={`${nome}: valor ${singular[r.estagio]} no ano, R$ bilhões correntes`}
              dados={pontos.map((p) => ({ano: String(p.ano), fechado: p.parcial ? null : emBi(p.valor), parcial: p.parcial ? emBi(p.valor) : null}))}
              chaveCategoria="ano"
              series={[
                {id: 'fechado', rotulo: 'Exercícios encerrados', cor: 'var(--cor-obee)', opcional: true},
                {id: 'parcial', rotulo: `${ANO_CORRENTE}, parcial`, cor: 'var(--serie-referencia)', opcional: true},
              ]}
              unidade="R$ bilhões"
              casas={1}
              empilhado
            />
          </div>
        </div>
      </div>
    </FiguraAnalitica>
  );
}

function Subfuncoes({r}: {r: Recorte}) {
  const linhas = subfuncoesDaParcela(r.area, r.ano);
  const nome = nomeParcela(r.area);
  const totalPago = linhas.reduce((s, l) => s + (l.valores.pago ?? 0), 0);
  const titulo = `Dentro de ${nome}: em que o dinheiro foi aplicado?`;
  const lead = <>Cada <Termo id="subfuncao">subfunção</Termo> detalha a natureza da atuação dentro da área. Uma subfunção pode aparecer em outra área (por exemplo, Administração Geral em quase todas): o valor é o da combinação com {nome}.</>;
  const nota = 'Valores abaixo de R$ 50 milhões aparecem como 0,0. Zero calculado não é ausência: a subfunção existe no orçamento do ano e não teve valor no estágio.';
  if (linhas.length === 0) {
    return (
      <Recolhido id="subfuncoes" aberto nivelTitulo={3} titulo={titulo} resumo={`Detalhe · ${r.ano}${encerrado(r.ano) ? '' : ' parcial'}`}>
        <p className="t-meta max-w-prose2 text-carvao-muted">{lead}</p>
        <p className="cp-status">Sem execução registrada em {nome} em {r.ano}.</p>
        <p className="t-meta max-w-prose2 text-carvao-muted">{nota}</p>
      </Recolhido>
    );
  }
  const estagios = ESTAGIOS_AREA.filter((e) => e !== 'inicial');
  return (
    <TabelaDados
      id="subfuncoes"
      recolhida={false}
      tituloVisivel={titulo}
      lead={<><span className="rotulo mr-2 text-mineral">Detalhe · {r.ano}{encerrado(r.ano) ? '' : ' parcial'}</span>{lead}</>}
      titulo={`${nome} · ${r.ano} · R$ bilhões correntes · todos os estágios, inclusive operações financeiras`}
      colunas={['Subfunção', ...estagios.map((e) => NOME_ESTAGIO[e]), 'Parte do pago da área', 'Pago em operações financeiras']}
      linhas={linhas.map((l) => [
        <span key={l.codigo}>{l.codigo} · {l.nome}{l.anos[0] > FONTE_AREAS.primeiroAno || l.anos.at(-1)! < ANO_CORRENTE ? <small> · nesta área de {l.anos[0]} a {l.anos.at(-1)}{l.anos.length < l.anos.at(-1)! - l.anos[0] + 1 ? ', com intervalos' : ''}</small> : null}</span>,
        ...estagios.map((e) => emBi(l.valores[e])),
        totalPago > 0 && l.valores.pago !== null ? `${numero((100 * l.valores.pago) / totalPago)}%` : 'Não calculável',
        emBi(l.financeiroPago),
      ])}
      casas={[null, ...estagios.map(() => 1), null, 1]}
      limite={linhas.length}
      ausencia={Object.fromEntries([...estagios.map((e) => NOME_ESTAGIO[e]), 'Pago em operações financeiras'].map((c) => [c, 'Não informado']))}
      fixarPrimeiraColuna
      nota={nota}
    />
  );
}

function Metodo() {
  const quebras = subfuncoesComQuebra();
  const rotulos = rotulosAlterados();
  return (
    <div className="cp-area-metodo" id="metodo">
      <p>Este painel complementa o capítulo <Link href="/contas-publicas/panorama" className="underline">Panorama das contas</Link>: responde à metade &quot;para onde vão&quot; da pergunta com a classificação funcional do SIOP. Método, fontes, notas e downloads: SIOP · {FONTE_AREAS.primeiroAno} a {ANO_CORRENTE} · R$ correntes.</p>
      <h3>O que é a área</h3>
      <p>A área é a <Termo id="funcao">função</Termo> da classificação funcional ({FONTE_AREAS.classificacao}). Ela é atribuída pela competência do órgão que executa a ação, não pelo resultado: um hospital universitário pode estar em Educação, e o pagamento de pessoal de um ministério fica na função dele.</p>
      <h3>Dívida e despesa primária</h3>
      <p>A dívida pública são as subfunções 841 a 844 da função Encargos Especiais: refinanciamento (títulos novos que pagam títulos vencidos) e serviço (juros e amortização com outros recursos). A base &quot;só a despesa primária&quot; usa o <Termo id="despesa-financeira">identificador de resultado primário</Termo>: exclui as linhas com código 0, que além da dívida incluem empréstimos e financiamentos registrados em outras áreas (FIES, repasses do FAT ao BNDES, fundos constitucionais de financiamento).</p>
      <h3>Estágio e período</h3>
      <p>Cinco estágios por exercício, na posição da última atualização da base do SIOP. Os totais incluem as operações intraorçamentárias, como no SIOP: a contribuição da União ao regime de previdência dos próprios servidores aparece em cada área que paga pessoal. Pago no exercício não inclui o pagamento de restos a pagar. Valores nominais: a Scrutiniums não corrige pela inflação a execução anual do SIOP; o IPCA usado no Panorama vale só para o resultado mensal do Tesouro desde 2023. Para comparar anos, use a parte de cada R$ 100.</p>
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
      <p>Que uma área recebe demais ou de menos, que gastar mais produz mais serviço ou que um ano foi melhor que outro. Parte relevante do gasto federal com saúde e educação é transferida a estados e municípios: os repasses do SUS e a complementação da União ao Fundeb aparecem na própria área; a parte dos impostos repassada ao Fundeb e o salário-educação ficam em Encargos Especiais. Pensões militares também estão em Encargos Especiais, fora de Previdência Social.</p>
      <h3>Fontes</h3>
      <p><a href={FONTE_AREAS.documentacao}>SIOP, dados abertos do orçamento federal</a>; consulta SPARQL pública em <a href={FONTE_AREAS.url}>{FONTE_AREAS.url}</a>. Classificação: Manual Técnico de Orçamento 2026, seção 4.4 (função e subfunção) e 4.6.2.4 (resultado primário).</p>
      <h3>Downloads</h3>
      <ul>
        <li><a href="/contas-publicas/por-area/funcoes.csv">Execução por função, subfunção e resultado primário, {FONTE_AREAS.primeiroAno} a {ANO_CORRENTE} · CSV</a></li>
        <li><a href="/contas-publicas/funcoes.json">Snapshot completo com datas, hashes e conferências · JSON</a></li>
      </ul>
    </div>
  );
}

export function PainelAreas({r}: {r: Recorte}) {
  const c = composicao(r.ano, r.estagio, r.base);
  return (
    <PaginaPainel
      rota={ROTA_AREAS}
      principal={false}
      abertura={{
        acento: 'obee',
        titulo: 'Para onde vai o dinheiro federal, por área?',
        lead: 'Cada R$ 100 que o orçamento da União pagou, repartidos pelas áreas de governo: previdência, assistência social, saúde, educação e as demais. A dívida pública aparece à parte, porque não é uma área.',
        acao: <Segmentos r={r} />,
        recorte: {
          periodo: `${r.ano}${encerrado(r.ano) ? '' : ', parcial'}`,
          universo: `${NOME_BASE[r.base]} · ${NOME_ESTAGIO[r.estagio].toLowerCase()} · Orçamentos Fiscal e da Seguridade Social da União`,
          unidade: 'R$ correntes',
          fonte: FONTE_CURTA,
        },
        limite: 'o que o dinheiro entregou. O valor mostra para onde ele foi; a área é a função orçamentária, definida pela competência do órgão que gasta.',
      }}
      rotuloNumeros={`Totais ${verbo[r.estagio]} em ${r.ano}`}
      numeros={numerosDaAbertura(r, c)}
      figuras={
        <>
          <Cem r={r} c={c} />
          <DoOrcamentoAoPagamento r={r} />
          <ControleArea r={r} />
          <Serie r={r} />
        </>
      }
      tabelas={<Subfuncoes r={r} />}
      metodo={<Metodo />}
    />
  );
}
