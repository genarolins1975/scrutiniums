import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {parseFragment, type DefaultTreeAdapterMap} from 'parse5';
import {AtlasCidadao} from '@/components/eficiencia/AtlasCidadao';
import {CompararCidades, ValorComparavel} from '@/components/eficiencia/CompararCidades';
import {diferencaBMC, formataBMC, grupoBMC, selecaoBMC, urlBMC, validarBaseComparavel, RESSALVA_AMOSTRA_BMC,
  type BaseComparavel} from '@/lib/eficiencia/base_comparavel';

const data = validarBaseComparavel(JSON.parse(readFileSync('public/eficiencia/base_comparavel_2022/base.json', 'utf8')) as BaseComparavel);
type Node = DefaultTreeAdapterMap['node'];
function nodes(node: Node): DefaultTreeAdapterMap['element'][] {
  return ('tagName' in node ? [node] : []).concat('childNodes' in node ? node.childNodes.flatMap(nodes) : []);
}
function text(node: Node): string {return 'value' in node ? node.value : 'childNodes' in node ? node.childNodes.map(text).join(' ') : '';}
const attr = (node: DefaultTreeAdapterMap['element'], name: string) => node.attrs.find(a => a.name === name)?.value;

describe('ContratoBMC', () => {
  it('reconcilia as 208 observações com os valores congelados e os hashes do pacote', () => {
    const pilot = JSON.parse(readFileSync('docs/obee/resultados/piloto-2022-v2.json', 'utf8'));
    const map: Record<string, string> = {educacao: 'educacao', renda: 'trabalho', mobilidade: 'mobilidade', saneamento: 'saneamento', homicidios: 'seguranca'};
    expect(data.capitais).toHaveLength(208);
    for (const row of data.capitais.filter(o => o.medida in map)) {
      expect(row.valor).toBe(pilot.rows.find((c: {id: string}) => c.id === row.municipio).raw_values[map[row.medida]]);
    }
    const packet = JSON.parse(readFileSync('docs/obee/resultados/revisao-v3-pacote.json', 'utf8'));
    expect(packet.files).toHaveLength(54);
    for (const file of packet.files) expect(createHash('sha256').update(readFileSync(file.path)).digest('hex')).toBe(file.sha256);
  });
  it('recusa C, B sem marca e períodos incompatíveis', () => {
    const aps = data.medidas.find(m => m.id === 'aps')!;
    expect(() => diferencaBMC(data.capacidade_servicos[0], data.capacidade_servicos[1], aps)).toThrow(/não pode ser justaposto/);
    const measure = data.medidas.find(m => m.id === 'homicidios')!;
    const rows = data.capitais.filter(r => r.medida === measure.id);
    expect(() => diferencaBMC(rows[0], rows[1], measure, false)).toThrow(/marca/);
    expect(() => diferencaBMC({...rows[0], marca_alinhamento: ''}, rows[1], measure)).toThrow(/sem marca/);
    expect(() => diferencaBMC({...rows[0], ano_referencia: 2023}, rows[1], measure)).toThrow(/Período/);
  });
  it('cada valor fica associado à ressalva visível e à precisão da sua medida', () => {
    const html = renderToStaticMarkup(createElement(CompararCidades, {data}));
    const dom = nodes(parseFragment(html));
    const values = dom.filter(n => attr(n, 'aria-describedby')?.startsWith('bmc-precisao-'));
    expect(values).toHaveLength(16);
    for (const value of values) {
      const warning = dom.find(n => attr(n, 'id') === attr(value, 'aria-describedby'))!;
      const measure = data.medidas.find(m => `bmc-precisao-${m.id}` === attr(warning, 'id'))!;
      expect(text(warning)).toBe(measure.ressalva_precisao);
      if (measure.amostra_censo) expect(text(warning)).toBe(RESSALVA_AMOSTRA_BMC);
    }
    expect(html).toContain('Classe B');
    expect(html).toContain('Componente de homicídios ocultos modelado pela fonte');
    expect(html).toContain('Janela de três anos, de 2021 a 2023');
    expect(html).toContain('Capacidade dos serviços');
    const capacity = dom.find(n => attr(n, 'aria-labelledby') === 'bmc-capacity-title')!;
    expect(text(capacity).toLocaleLowerCase('pt-BR')).toContain('dezembro de 2025');
    expect(nodes(capacity).filter(n => attr(n, 'data-alinhamento') === 'C')).toHaveLength(2);
  });
  it('zero é exibido e ausência nunca recebe diferença numérica', () => {
    const measure = data.medidas.find(m => m.id === 'educacao')!;
    const row = data.capitais.find(o => o.medida === measure.id)!;
    expect(formataBMC(0, measure)).toBe('0,00 %');
    expect(diferencaBMC({...row, valor: null, estado: 'NAO_DISPONIVEL'}, row, measure)).toBeNull();
    const html = renderToStaticMarkup(createElement(ValorComparavel, {observation: {...row, valor: null, estado: 'NAO_DISPONIVEL', motivo_ausencia: 'Dado não publicado'}, measure, warningId: 'aviso'}));
    expect(html).toContain('Não disponível'); expect(html).toContain('Dado não publicado');
    expect(html).not.toContain('0,00 %');
  });
  it('URL preserva as duas cidades, a medida, os pares e a ordem escolhida', () => {
    const query = new URLSearchParams('territorio=2611606&comparador=4106902&bmc_medida=internet&bmc_pares=a_regiao&bmc_ordem=valor');
    const selected = selecaoBMC(query, data);
    expect(selected).toEqual({cidade: '2611606', comparador: '4106902', medida: 'internet', grupo: 'a_regiao', ordem: 'valor'});
    const shared = urlBMC(new URL('https://example.test/eficiencia-estatal'), selected);
    expect(selecaoBMC(shared.searchParams, data)).toEqual(selected);
    expect(grupoBMC(data, selected)).toBe('regiao:Nordeste');
    expect(selecaoBMC(new URLSearchParams('bmc_pares=renda&bmc_medida=aps&territorio=5300108'), data).grupo).toBe('universo');
    expect(selecaoBMC(new URLSearchParams(), data).ordem).toBe('nome');
  });
  it('variável de resultado não pode formar pares', () => {
    const invalid = structuredClone(data);
    invalid.grupos_de_pares = ['renda', 'grande_regiao'];
    expect(() => validarBaseComparavel(invalid)).toThrow(/variável de resultado/);
  });
  it('fichas e novos componentes preservam neutralidade editorial e cor de seleção', () => {
    const prose = data.medidas.flatMap(m => [m.titulo, m.universo, m.limites, m.ressalva_precisao]).join(' ');
    expect(prose).not.toMatch(/\b(melhor|pior|ruim|ótimo|desperdício|ineficiente|vencedor)\b/i);
    const css = readFileSync('src/components/eficiencia/CompararCidades.module.css', 'utf8');
    expect(css).not.toMatch(/(?:color|background|stroke|fill)[^;{}]*(?:\b(?:red|green|lime|emerald|yellow)\b|#ff0000|#00ff00|#f00\b|#0f0\b)/i);
    expect(css).toContain('min-height:44px');
    expect(css).toContain('var(--cor-obee)');
  });
  it('Atlas usa a BMC sem justapor a APS à referência de 2022', () => {
    const html = renderToStaticMarkup(createElement(AtlasCidadao, {base: data}));
    expect(html).toContain('Comparar cidades');
    expect(html).not.toContain('Retrato em quatro perspectivas');
    expect(html).not.toContain('Uma medida. Diferentes contextos.');
    expect(html).toContain('Capacidade dos serviços');
    expect(html).not.toContain('NaN'); expect(html).not.toContain('undefined');
  });
});

describe('UniversoBMC', () => {
  it('a referência contém os 318 municípios e mantém as capitais congeladas', () => {
    expect(data.estado).toBe('UNIVERSO_ADQUIRIDO_E_RECONCILIADO');
    expect(data.municipios).toHaveLength(318);
    expect(data.municipios.filter(c => c.capital)).toHaveLength(26);
    expect(data.municipios.some(c => c.id === '5300108')).toBe(false);
    for (const row of data.capitais) expect(data.observacoes.find(o => o.municipio === row.municipio && o.medida === row.medida)!.valor).toBe(row.valor);
  });
});
