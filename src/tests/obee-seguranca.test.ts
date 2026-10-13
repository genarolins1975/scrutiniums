import {describe,it,expect} from 'vitest';
import {base,csv,indicadores,seleciona} from '@/lib/eficiencia/seguranca/dados';
describe('Segurança pública: contrato da publicação',()=>{
  it('preserva fonte, período, unidades e unicidade dos registros',()=>{
    expect(base.referencia).toBe(2025);
    expect(base.extraidoEm).toBe('2026-02-25');
    expect(new Set(indicadores.map(i=>i.id)).size).toBe(18);
    expect(indicadores.every(i=>i.valor>0&&i.pagina>=1&&i.pagina<=5)).toBe(true);
    expect(indicadores.find(i=>i.id==='homicidio')?.valor).toBe(31448);
    expect(indicadores.find(i=>i.id==='feminicidio')?.valor).toBe(1548);
  });
  it('mantém a exclusão do RJ no indicador e na exportação',()=>{
    const linhas=seleciona('mulheres','vulneravel');
    expect(linhas).toHaveLength(1);
    expect(linhas[0].ressalva).toContain('Rio de Janeiro');
    expect(csv(linhas)).toContain('Rio de Janeiro');
    expect(csv(linhas)).toContain('50024');
    expect(csv(linhas)).not.toContain('31448');
  });
  it('separa unidades e não transforma localizações em resolução',()=>{
    expect(seleciona('patrimonio').every(i=>i.unidade==='ocorrências')).toBe(true);
    expect(indicadores.find(i=>i.id==='localizados')?.unidade).toBe('registros de localização');
    expect(seleciona('letalidade','sem correspondencia')).toHaveLength(0);
  });
});
