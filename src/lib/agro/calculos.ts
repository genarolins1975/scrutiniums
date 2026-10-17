/** Modelos didáticos determinísticos. Entradas do usuário não viram observações. */
export class ErroCenario extends Error {
}
export function finito(v: number, nome: string, min = -1e12, max = 1e12) { if (!Number.isFinite(v) || v < min || v > max)
    throw new ErroCenario(`${nome}: informe um valor entre ${min} e ${max}.`); return v; }
export function contagem(v: number, nome: string, min = 0) { finito(v, nome, min); if (!Number.isInteger(v)) throw new ErroCenario(`${nome}: informe uma contagem inteira.`); return v; }
export const naoNegativo = (v: number, nome: string) => finito(v, nome, 0);
export const percentual = (v: number, nome: string) => finito(v, nome, 0, 100);
export const dividir = (n: number, d: number) => d > 0 ? n / d : null;
export type CustosCenario = {
    variavel: number;
    operacionalAdicional: number;
    economicoAdicional: number;
};
export type MargemCenario = {
    preco: number;
    rendimento: number;
    area: number;
    custos: CustosCenario;
    escopo: 'contribuicao' | 'operacional' | 'economica';
};
export function margemAgro(p: MargemCenario) {
    for (const [n, v] of Object.entries({ preco: p.preco, rendimento: p.rendimento, area: p.area, ...p.custos }))
        naoNegativo(v, n);
    const variavel = p.custos.variavel, operacional = variavel + p.custos.operacionalAdicional, total = operacional + p.custos.economicoAdicional;
    const custo = p.escopo === 'contribuicao' ? variavel : p.escopo === 'operacional' ? operacional : total;
    const receita = p.preco * p.rendimento, margem = receita - custo;
    return { receitaHa: receita, custoHa: custo, margemHa: margem, receitaTotal: receita * p.area, custoTotal: custo * p.area, margemTotal: margem * p.area, precoEquilibrio: dividir(custo, p.rendimento), rendimentoEquilibrio: dividir(custo, p.preco), custos: { variavel, operacional, total }, exclusoes: p.escopo === 'contribuicao' ? 'Exclui custos operacionais e econômicos adicionais informados.' : p.escopo === 'operacional' ? 'Exclui custos econômicos adicionais informados.' : 'Inclui apenas as categorias informadas; não representa automaticamente todos os custos de uma propriedade.' };
}
export function sensibilidadeMargem(p: MargemCenario, variacoes = [-.2, -.1, 0, .1, .2]) { return variacoes.map(vr => variacoes.map(vp => ({ preco: p.preco * (1 + vp), rendimento: p.rendimento * (1 + vr), variacaoPreco: vp, variacaoRendimento: vr, valor: margemAgro({ ...p, preco: p.preco * (1 + vp), rendimento: p.rendimento * (1 + vr) }).margemHa }))); }
export function decomporProduto(a0: number, y0: number, a1: number, y1: number) { for (const [n, v] of Object.entries({ a0, y0, a1, y1 }))
    naoNegativo(v, n); const area = (a1 - a0) * y0, rendimento = a0 * (y1 - y0), interacao = (a1 - a0) * (y1 - y0); return { inicial: a0 * y0, final: a1 * y1, diferenca: a1 * y1 - a0 * y0, area, rendimento, interacao }; }
export function converterUnidade(valor: number, origem: string, destino: string, kgPorSaca: number | null = null) {
    naoNegativo(valor, 'Quantidade');
    const massa: Record<string, number> = { kg: 1, t: 1000, arroba: 15 }, volume: Record<string, number> = { litro: 1, 'mil-litros': 1000 };
    if (origem === 'saca' || destino === 'saca') {
        if (kgPorSaca === null || kgPorSaca <= 0)
            throw new ErroCenario('Informe a massa da saca deste produto em kg.');
        massa.saca = naoNegativo(kgPorSaca, 'Massa por saca');
    }
    const grupo = origem in massa && destino in massa ? massa : origem in volume && destino in volume ? volume : null;
    if (origem === 'cabeca' && destino === 'cabeca')
        return valor;
    if (!grupo)
        throw new ErroCenario('Conversão sem fator válido: massa, volume e cabeças permanecem separados.');
    return valor * grupo[origem] / grupo[destino];
}
export function relacaoTroca(custoInsumo: number, precoProduto: number) { naoNegativo(custoInsumo, 'Custo do insumo'); naoNegativo(precoProduto, 'Preço por unidade'); return dividir(custoInsumo, precoProduto); }
export function corrigirPoderCompra(valor: number, indiceOrigem: number, indiceDestino: number) { finito(valor, 'Valor'); if (indiceOrigem <= 0 || indiceDestino <= 0)
    throw new ErroCenario('Os dois números-índices devem ser positivos.'); finito(indiceOrigem, 'Índice de origem', 0); finito(indiceDestino, 'Índice de destino', 0); return valor * indiceDestino / indiceOrigem; }
export function orcamentoAlimentar(itens: {
    gasto: number;
    variacao: number;
}[]) { if (!itens.length || itens.length > 30)
    throw new ErroCenario('Informe entre uma e trinta categorias.'); for (const i of itens) {
    naoNegativo(i.gasto, 'Gasto');
    finito(i.variacao, 'Variação percentual', -100, 1000);
} const antes = itens.reduce((s, i) => s + i.gasto, 0), depois = itens.reduce((s, i) => s + i.gasto * (1 + i.variacao / 100), 0); return { antes, depois, diferenca: depois - antes, variacaoPonderada: antes > 0 ? (depois / antes - 1) * 100 : null }; }
export function pesoAlimentacao(renda: number, gasto: number, alta: number) { naoNegativo(renda, 'Orçamento total'); naoNegativo(gasto, 'Gasto alimentar'); finito(alta, 'Variação', -100, 1000); if (gasto > renda)
    throw new ErroCenario('Neste modelo, o gasto alimentar deve caber no orçamento total informado.'); const novo = gasto * (1 + alta / 100); return { antes: gasto, depois: novo, acrescimo: novo - gasto, pesoAntes: dividir(gasto * 100, renda), pesoDepois: dividir(novo * 100, renda), saldoDepois: renda - novo }; }
export function financiamentoAgro(principal: number, taxaMensalPct: number, meses: number, sistema: 'price' | 'sac') {
    naoNegativo(principal, 'Principal');
    finito(taxaMensalPct, 'Taxa mensal', 0, 100);
    finito(meses, 'Prazo', 1, 240);
    if (!Number.isInteger(meses))
        throw new ErroCenario('O prazo precisa ser um número inteiro de meses.');
    const taxa = taxaMensalPct / 100, pmt = taxa === 0 ? principal / meses : principal * taxa / (-Math.expm1(-meses * Math.log1p(taxa)));
    const rows = [];
    let saldo = principal;
    for (let mes = 1; mes <= meses; mes++) {
        const juros = saldo * taxa, amortizacao = mes === meses ? saldo : sistema === 'sac' ? principal / meses : pmt - juros, prestacao = amortizacao + juros;
        saldo = Math.max(0, saldo - amortizacao);
        rows.push({ mes, juros, amortizacao, prestacao, saldo });
    }
    return { linhas: rows, totalPago: rows.reduce((s, r) => s + r.prestacao, 0), jurosTotal: rows.reduce((s, r) => s + r.juros, 0), taxaEfetivaAnualPct: 100 * (Math.pow(1 + taxa, 12) - 1) };
}
export function protecaoHipotetica(valorExposto: number, perdaPct: number, franquiaReais: number, limite: number, participacaoPct: number) {
    naoNegativo(valorExposto, 'Valor exposto');
    percentual(perdaPct, 'Perda');
    naoNegativo(franquiaReais, 'Franquia');
    naoNegativo(limite, 'Limite');
    percentual(participacaoPct, 'Participação da proteção');
    const perda = valorExposto * perdaPct / 100, pagamento = Math.min(limite, Math.max(0, perda - franquiaReais) * participacaoPct / 100);
    return { perda, pagamento, perdaRetida: perda - pagamento };
}
export function armazenagemCenario(capacidade: number, inicial: number, meses: {
    entrada: number;
    saida: number;
}[]) {
    naoNegativo(capacidade, 'Capacidade');
    naoNegativo(inicial, 'Estoque inicial');
    if (meses.length < 1 || meses.length > 36)
        throw new ErroCenario('Informe de um a 36 meses.');
    let estoque = inicial;
    const linhas = meses.map((m, i) => { naoNegativo(m.entrada, 'Entrada'); naoNegativo(m.saida, 'Saída'); const disponivel = estoque + m.entrada; if (m.saida > disponivel)
        throw new ErroCenario(`Mês ${i + 1}: a saída excede o estoque disponível.`); const pico = disponivel, excedente = Math.max(0, pico - capacidade); estoque = disponivel - m.saida; return { mes: i + 1, ...m, pico, excedente, estoque }; });
    return { linhas, pico: Math.max(inicial, ...linhas.map(l => l.pico)), excedenteMaximo: Math.max(0, inicial - capacidade, ...linhas.map(l => l.excedente)), entradaTotal: meses.reduce((s, m) => s + m.entrada, 0), saidaTotal: meses.reduce((s, m) => s + m.saida, 0), final: estoque };
}
export function concentracaoCenario(receita: number, participacaoDestino: number, reducaoDestino: number) { naoNegativo(receita, 'Receita'); percentual(participacaoDestino, 'Participação do destino'); percentual(reducaoDestino, 'Redução das vendas ao destino'); const diferenca = -receita * participacaoDestino / 100 * reducaoDestino / 100; return { inicial: receita, final: receita + diferenca, diferenca }; }
export function decomporComercio(q0: number, v0: number, q1: number, v1: number) { for (const [n, v] of Object.entries({ q0, v0, q1, v1 }))
    naoNegativo(v, n); if (q0 <= 0 || q1 <= 0)
    throw new ErroCenario('As quantidades dos dois períodos devem ser positivas.'); const p0 = v0 / q0, p1 = v1 / q1; return { ...decomporProduto(q0, p0, q1, p1), quantidade: (q1 - q0) * p0, valorUnitario: q0 * (p1 - p0), p0, p1 }; }
export function fluxoCaixa(inicial: number, meses: {
    entrada: number;
    saida: number;
}[]) { finito(inicial, 'Caixa inicial'); if (!meses.length || meses.length > 36)
    throw new ErroCenario('Informe de um a 36 meses.'); let saldo = inicial; const linhas = meses.map((m, i) => { naoNegativo(m.entrada, 'Entrada'); naoNegativo(m.saida, 'Desembolso'); saldo += m.entrada - m.saida; return { mes: i + 1, ...m, saldo, fluxo: m.entrada - m.saida }; }); const minimo = Math.min(inicial, ...linhas.map(r => r.saldo)); return { linhas, menorSaldo: minimo, capitalAdicional: Math.max(0, -minimo), primeiroMesMinimo: linhas.find(r => r.saldo === minimo)?.mes ?? 0, saldoFinal: saldo }; }
export function investimentoAgro(investimento: number, fluxos: number[], residual: number, taxaPct: number) { naoNegativo(investimento, 'Investimento inicial'); naoNegativo(residual, 'Valor residual'); finito(taxaPct, 'Taxa anual de desconto', 0, 100); if (!fluxos.length || fluxos.length > 40)
    throw new ErroCenario('Informe de um a quarenta anos.'); fluxos.forEach(v => finito(v, 'Fluxo anual')); let acumulado = -investimento, payback: number | null = investimento === 0 ? 0 : null; const linhas = fluxos.map((valor, i) => { const total = valor + (i === fluxos.length - 1 ? residual : 0), descontado = total / Math.pow(1 + taxaPct / 100, i + 1); acumulado += descontado; if (payback === null && acumulado >= 0)
    payback = i + 1; return { ano: i + 1, operacional: valor, residual: i === fluxos.length - 1 ? residual : 0, descontado, acumulado }; }); return { vpl: acumulado, primeiroPaybackDescontado: payback, linhas }; }
export function perdasPosColheita(quantidade: number, perdaAntes: number, perdaDepois: number, preco: number, qualidadePct: number, custo: number) { naoNegativo(quantidade, 'Quantidade'); percentual(perdaAntes, 'Perda antes'); percentual(perdaDepois, 'Perda depois'); naoNegativo(preco, 'Preço por unidade'); percentual(qualidadePct, 'Valor comercial preservado'); naoNegativo(custo, 'Custo da medida'); const recuperavel = quantidade * (perdaAntes - perdaDepois) / 100, valor = recuperavel * preco * qualidadePct / 100; return { recuperavel, valorRecuperavel: valor, custo, diferencaLiquida: valor - custo }; }
export function custoLogistico(quantidade: number, distancia: number, precoTkm: number, armazenagemPorTonelada: number, outros: number) { for (const [n, v] of Object.entries({ quantidade, distancia, precoTkm, armazenagemPorTonelada, outros }))
    naoNegativo(v, n); const transporte = quantidade * distancia * precoTkm, armazenagem = quantidade * armazenagemPorTonelada, total = transporte + armazenagem + outros; return { transporte, armazenagem, outros, total, porTonelada: dividir(total, quantidade) }; }
export function cambioCenario(receitaReais: number, receitaDolares: number, custoReais: number, custoDolares: number, cambioBase: number, cambioNovo: number, repasseReceita: number, repasseCusto: number) {
    for (const [n, v] of Object.entries({ receitaReais, receitaDolares, custoReais, custoDolares, cambioBase, cambioNovo }))
        naoNegativo(v, n);
    percentual(repasseReceita, 'Repasse na receita');
    percentual(repasseCusto, 'Repasse no custo');
    if (cambioBase <= 0 || cambioNovo <= 0)
        throw new ErroCenario('As taxas de câmbio precisam ser positivas.');
    const receitaBase = receitaReais + receitaDolares * cambioBase, custoBase = custoReais + custoDolares * cambioBase, receitaNova = receitaReais + receitaDolares * (cambioBase + (cambioNovo - cambioBase) * repasseReceita / 100), custoNovo = custoReais + custoDolares * (cambioBase + (cambioNovo - cambioBase) * repasseCusto / 100);
    return { receitaBase, custoBase, margemBase: receitaBase - custoBase, receitaNova, custoNovo, margemNova: receitaNova - custoNovo, diferenca: (receitaNova - custoNovo) - (receitaBase - custoBase) };
}
export function diversificacao(valores: number[]) { if (!valores.length || valores.length > 50)
    throw new ErroCenario('Informe de uma a cinquenta categorias.'); valores.forEach(v => naoNegativo(v, 'Valor')); const total = valores.reduce((s, v) => s + v, 0); return { total, participacoes: valores.map(v => dividir(100 * v, total)), hhi: total > 0 ? valores.reduce((s, v) => s + Math.pow(v / total, 2), 0) : null }; }
export function volatilidadeHistorica(valores: number[]) { if (valores.length < 2 || valores.length > 240)
    throw new ErroCenario('Informe de dois a 240 períodos comparáveis.'); valores.forEach(v => finito(v, 'Valor do período')); const media = valores.reduce((s, v) => s + v, 0) / valores.length, dp = Math.sqrt(valores.reduce((s, v) => s + Math.pow(v - media, 2), 0) / (valores.length - 1)); return { media, desvioAmostral: dp, cvPct: media > 0 ? 100 * dp / media : null, periodos: valores.length }; }
export function valorAdicionado(producaoBruta: number, consumoIntermediario: number) { naoNegativo(producaoBruta, 'Produção bruta'); naoNegativo(consumoIntermediario, 'Consumo intermediário'); return { producaoBruta, consumoIntermediario, valorAdicionado: producaoBruta - consumoIntermediario }; }
export function energiaCenario(energiaKwh: number, precoKwh: number, receita: number, outrosCustos: number) { for (const [n, v] of Object.entries({ energiaKwh, precoKwh, receita, outrosCustos }))
    naoNegativo(v, n); const custoEnergia = energiaKwh * precoKwh; return { custoEnergia, custoTotal: custoEnergia + outrosCustos, margem: receita - custoEnergia - outrosCustos }; }
export function custoPorEntrega(custo: number, entregas: number, comparaveis: boolean) { naoNegativo(custo, 'Custo fiscal'); naoNegativo(entregas, 'Entregas'); if (!comparaveis)
    throw new ErroCenario('Antes de comparar, confirme mesmo serviço, unidade, período e perímetro do custo.'); return dividir(custo, entregas); }
export function especializacao(localParte: number, localTotal: number, referenciaParte: number, referenciaTotal: number) { for (const [n, v] of Object.entries({ localParte, localTotal, referenciaParte, referenciaTotal }))
    naoNegativo(v, n); if (localParte > localTotal || referenciaParte > referenciaTotal)
    throw new ErroCenario('A parcela não pode exceder o respectivo total.'); const local = dividir(localParte, localTotal), referencia = dividir(referenciaParte, referenciaTotal); return { participacaoLocal: local, participacaoReferencia: referencia, quociente: local !== null && referencia !== null && referencia > 0 ? local / referencia : null }; }
export function balancoAgua(retirada: number, retorno: number, variacaoEstoque: number) { naoNegativo(retirada, 'Retirada'); naoNegativo(retorno, 'Retorno'); finito(variacaoEstoque, 'Variação de estoque'); const consumo = retirada - retorno - variacaoEstoque; if (consumo < 0)
    throw new ErroCenario('O balanço não fecha neste modelo: revise retirada, retorno e armazenamento.'); return { retirada, retorno, variacaoEstoque, consumo }; }
export function estoqueTrabalho(inicial: number, admissoes: number, desligamentos: number, ajuste: number) { contagem(inicial, 'Estoque inicial'); contagem(admissoes, 'Admissões'); contagem(desligamentos, 'Desligamentos'); contagem(ajuste, 'Ajuste de estoque', -1e12); const saldo = admissoes - desligamentos, final = inicial + saldo + ajuste; if (final < 0)
    throw new ErroCenario('Os parâmetros geram estoque negativo.'); return { saldo, ajuste, final }; }
