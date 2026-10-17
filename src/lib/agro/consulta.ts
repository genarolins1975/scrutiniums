import type { CadeiaId, SnapshotAgro } from './tipos';
import { medianaAgro, proporcaoAgro } from './modelo';
export const MEDIDAS_TERRITORIAIS_AGRO = [
    { id: 'producao-soja', nome: 'Produção: Soja', unidade: 't', fonte: 'producao', descricao: 'Quantidade produzida no ano, Produção Agrícola Municipal. Produção não é área nem valor, e não mostra para onde o produto vai.' },
    { id: 'producao-milho', nome: 'Produção: Milho', unidade: 't', fonte: 'producao', descricao: 'Quantidade produzida no ano, Produção Agrícola Municipal. Produção não é área nem valor, e não mostra para onde o produto vai.' },
    { id: 'producao-cana', nome: 'Produção: Cana-de-açúcar', unidade: 't', fonte: 'producao', descricao: 'Quantidade produzida no ano, Produção Agrícola Municipal. Produção não é área nem valor, e não mostra para onde o produto vai.' },
    { id: 'producao-cafe', nome: 'Produção: Café', unidade: 't', fonte: 'producao', descricao: 'Quantidade produzida no ano, Produção Agrícola Municipal. Produção não é área nem valor, e não mostra para onde o produto vai.' },
    { id: 'producao-algodao', nome: 'Produção: Algodão em caroço', unidade: 't', fonte: 'producao', descricao: 'Quantidade produzida no ano, Produção Agrícola Municipal. Produção não é área nem valor, e não mostra para onde o produto vai.' },
    { id: 'producao-arroz', nome: 'Produção: Arroz em casca', unidade: 't', fonte: 'producao', descricao: 'Quantidade produzida no ano, Produção Agrícola Municipal. Produção não é área nem valor, e não mostra para onde o produto vai.' },
    { id: 'producao-feijao', nome: 'Produção: Feijão', unidade: 't', fonte: 'producao', descricao: 'Quantidade produzida no ano, Produção Agrícola Municipal. Produção não é área nem valor, e não mostra para onde o produto vai.' },
    { id: 'producao-bovinos', nome: 'Produção: Carne bovina, peso das carcaças', unidade: 't', fonte: 'producao', descricao: 'Peso das carcaças no abate sob inspeção, soma de quatro trimestres. Estados com dado sigiloso ficam sem valor; abate é local do frigorífico, não origem do animal.' },
    { id: 'producao-frango', nome: 'Produção: Frango, peso das carcaças', unidade: 't', fonte: 'producao', descricao: 'Peso das carcaças no abate sob inspeção, soma de quatro trimestres. Estados com dado sigiloso ficam sem valor; abate é local do frigorífico, não origem do animal.' },
    { id: 'producao-suinos', nome: 'Produção: Carne suína, peso das carcaças', unidade: 't', fonte: 'producao', descricao: 'Peso das carcaças no abate sob inspeção, soma de quatro trimestres. Estados com dado sigiloso ficam sem valor; abate é local do frigorífico, não origem do animal.' },
    { id: 'producao-leite', nome: 'Produção: Leite', unidade: 'mil litros', fonte: 'producao', descricao: 'Leite produzido no ano, Pesquisa da Pecuária Municipal. Não é leite industrializado sob inspeção.' },
    { id: 'producao-celulose', nome: 'Produção: Madeira em tora para papel e celulose', unidade: 'm³', fonte: 'producao', descricao: 'Madeira de florestas plantadas destinada a papel e celulose, em metros cúbicos. Não é a celulose produzida.' },
    { id: 'credito', nome: 'Crédito rural contratado', unidade: 'R$ correntes', fonte: 'credito', descricao: 'Valor de contratos, todas as cadeias e finalidades. Não é desembolso, saldo devedor ou gasto fiscal.' },
    { id: 'custeio', nome: 'Crédito para custeio', unidade: 'R$ correntes', fonte: 'credito', descricao: 'Crédito rural contratado para custeio, todas as cadeias. Não é custo de produção ou despesa fiscal.' },
    { id: 'investimento', nome: 'Crédito para investimento', unidade: 'R$ correntes', fonte: 'credito', descricao: 'Crédito rural contratado para investimento, todas as cadeias. Não é custo de produção ou despesa fiscal.' },
    { id: 'comercializacao', nome: 'Crédito para comercialização', unidade: 'R$ correntes', fonte: 'credito', descricao: 'Crédito rural contratado para comercialização, todas as cadeias. Não é custo de produção ou despesa fiscal.' },
    { id: 'industrializacao', nome: 'Crédito para industrialização', unidade: 'R$ correntes', fonte: 'credito', descricao: 'Crédito rural contratado para industrialização, todas as cadeias. Não é custo de produção ou despesa fiscal.' },
    { id: 'contratos', nome: 'Quantidade de contratos rurais', unidade: 'contratos', fonte: 'credito', descricao: 'Cédulas/contratos registrados, não beneficiários únicos. Um mesmo produtor pode ter vários contratos.' },
    { id: 'credito-contrato', nome: 'Valor médio por contrato rural', unidade: 'R$/contrato', fonte: 'credito', descricao: 'Valor dividido pela quantidade compatível de contratos; não mede renda, custo ou acesso do produtor.' },
    { id: 'ocupados', nome: 'Grupo ocupacional qualificado no Censo 2022', unidade: 'pessoas', fonte: 'ocupacoes', descricao: 'Pessoas de 14 anos ou mais ocupadas com rendimento: trabalhadores qualificados da agropecuária, florestais, caça e pesca. Não é todo o trabalho agro.' },
    { id: 'parcela-ocupados', nome: 'Parcela do grupo entre ocupados com renda', unidade: '%', fonte: 'ocupacoes', descricao: 'Grupo ocupacional dividido pelo total de ocupados com rendimento na mesma UF e pesquisa; não é proporção de emprego formal.' },
    { id: 'renda-mediana', nome: 'Rendimento mediano do grupo ocupacional', unidade: 'R$ correntes mensais', fonte: 'ocupacoes', descricao: 'Mediana de todos os trabalhos das pessoas do grupo no Censo 2022; não é salário formal nem margem de produção.' },
] as const;
export type MedidaTerritorialAgro = typeof MEDIDAS_TERRITORIAIS_AGRO[number]['id'];
export type TerritorioAgro = {
    id: string;
    nome: string;
    uf: string;
};
export type ObservacaoTerritorialAgro = TerritorioAgro & {
    valor: number | null;
    denominador: number | null;
    periodo: string;
    fonte: string;
    unidade: string;
    limite: string;
};
export function observacoesTerritoriaisAgro(dados: SnapshotAgro, territorios: TerritorioAgro[], medida: MedidaTerritorialAgro): ObservacaoTerritorialAgro[] {
    const meta = MEDIDAS_TERRITORIAIS_AGRO.find(m => m.id === medida)!;
    return territorios.map(t => {
        const rural = dados.credito.ufs.find(r => r.id === t.id), ocup = dados.trabalho.ocupacoes.find(r => r.id === t.id);
        let valor: number | null = null, denominador: number | null = null;
        if (medida === 'credito')
            valor = rural?.valor ?? null;
        if (['custeio', 'investimento', 'comercializacao', 'industrializacao'].includes(medida))
            valor = rural?.[medida as 'custeio' | 'investimento' | 'comercializacao' | 'industrializacao'] ?? null;
        if (medida === 'contratos')
            valor = rural?.contratos ?? null;
        if (medida === 'credito-contrato') {
            valor = rural && rural.contratos > 0 ? rural.valor / rural.contratos : null;
            denominador = rural?.contratos ?? null;
        }
        if (medida === 'ocupados')
            valor = ocup?.pessoas ?? null;
        if (medida === 'parcela-ocupados') {
            valor = proporcaoAgro(ocup?.pessoas, ocup?.totalOcupadosComRenda);
            denominador = ocup?.totalOcupadosComRenda ?? null;
        }
        if (medida === 'renda-mediana')
            valor = ocup?.rendaMediana ?? null;
        let periodo = meta.fonte === 'credito' ? dados.credito.janela.ini + ' a ' + dados.credito.janela.fim : '2022';
        if (medida.startsWith('producao-')) {
            const p = dados.economia?.cadeias.itens[medida.slice(9) as CadeiaId]?.producao.producao;
            valor = p?.ufs.find(u => u.id === t.id)?.valor ?? null;
            periodo = p?.periodo ?? '';
        }
        return { ...t, valor, denominador, periodo, fonte: meta.fonte, unidade: meta.unidade, limite: meta.descricao };
    });
}
export function compararTerritoriosAgro(rows: ObservacaoTerritorialAgro[], ids: string[]) { const unicos = [...new Set(ids.filter(Boolean))].slice(0, 3), selecionados = rows.filter(r => unicos.includes(r.id)), valores = rows.map(r => r.valor); return { selecionados: unicos.map(id => selecionados.find(r => r.id === id)).filter((r): r is ObservacaoTerritorialAgro => !!r), referencia: { valor: medianaAgro(valores), cobertos: valores.filter(v => v !== null).length, elegiveis: rows.length }, duplicados: ids.filter(Boolean).length !== unicos.length }; }
/** Quantil com interpolação linear na posição (n−1)·p; cada UF tem peso igual. */
export function distribuicaoAgro(values: (number | null)[]) { const v = values.filter((x): x is number => x !== null && Number.isFinite(x)).sort((a, b) => a - b); if (!v.length)
    return null; const q = (p: number) => { const pos = (v.length - 1) * p, lo = Math.floor(pos), hi = Math.ceil(pos); return v[lo] + (v[hi] - v[lo]) * (pos - lo); }; return { min: v[0], q1: q(.25), mediana: q(.5), q3: q(.75), max: v.at(-1)!, n: v.length }; }
