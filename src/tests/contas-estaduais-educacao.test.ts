import { describe, expect, it } from 'vitest';
import { snapshot, primarios } from '../lib/contas-estaduais/dados';
import {
  disponibilidadeEducacao, csvDisponibilidadeEducacao,
  ETAPAS_EDUCACAO, ETAPA_PADRAO, lerEtapa, etapaValida,
} from '../lib/contas-estaduais/educacao';
import { GET as csvRoute } from '../app/contas-publicas-estaduais/educacao.csv/route';
import { GET as jsonRoute } from '../app/contas-publicas-estaduais/educacao.json/route';

describe('Disponibilidade educacional sem observações imputadas', () => {
  it('preserva UF, etapa e ausência nas 81 combinações de 2025', () => {
    for (const uf of snapshot.ufs) for (const etapa of Object.keys(ETAPAS_EDUCACAO)) {
      const d = disponibilidadeEducacao(uf.uf, 2025, etapa)!;
      expect(d.uf).toBe(uf.uf);
      expect(d.etapa).toBe(etapa);
      expect(d.rede).toBe('estadual');
      expect(d.abrangencia).toBe('uf_inteira');
      expect(d.evidencias).toHaveLength(4);
      expect(d.evidencias.every(e => e.valor === null)).toBe(true);
      expect(d.observacoes).toEqual([]);
      expect(d.pareamento_elegivel).toBe(false);
      expect(d.despesa_por_matricula).toBeNull();
      expect(d.ideb).toBeNull();
      expect(d.cumprimento_meta).toBeNull();
    }
    expect(primarios.cobertura.observacoes).toBe(216);
  });
  it('não transporta o levantamento de 2025 para outros anos', () => {
    const d = disponibilidadeEducacao('PE', 2026, ETAPA_PADRAO)!;
    expect(d.tentativa_fontes).toBeNull();
    expect(d.evidencias.every(e => e.status === 'nao_levantado')).toBe(true);
    const anterior = disponibilidadeEducacao('PE', 2023, ETAPA_PADRAO)!;
    expect(anterior.tentativa_fontes).toBeNull();
    expect(anterior.ideb).toBeNull();
    expect(disponibilidadeEducacao('PE', 2025, ETAPA_PADRAO)!.tentativa_fontes!.ano).toBe(2025);
  });
  it('rejeita recorte inválido sem substituí-lo silenciosamente na exportação', () => {
    for (const [uf, ano, etapa] of [['XX', 2025, ETAPA_PADRAO], ['PE', 2014, ETAPA_PADRAO], ['PE', 2025, 'municipal'], ['PE', 2025, '__proto__']] as const) {
      expect(disponibilidadeEducacao(uf, ano, etapa)).toBeNull();
      const url = 'https://exemplo.test?uf=' + uf + '&ano=' + ano + '&etapa=' + etapa;
      expect(csvRoute(new Request(url)).status).toBe(400);
      expect(jsonRoute(new Request(url)).status).toBe(400);
    }
    expect(csvRoute(new Request('https://exemplo.test')) .status).toBe(400);
    expect(etapaValida('toString')).toBe(false);
    expect(lerEtapa(null)).toBe(ETAPA_PADRAO);
  });
  it('exporta situações e requisitos, sem coluna de nota ou valor', async () => {
    const url = 'https://exemplo.test?uf=PE&ano=2025&etapa=' + ETAPA_PADRAO;
    const csv = csvDisponibilidadeEducacao('PE', 2025, ETAPA_PADRAO)!;
    expect(csv.split('\r\n')).toHaveLength(5);
    expect(csv).toContain('disponibilidade_sem_observacoes');
    expect(csv.split('\r\n')[0]).not.toMatch(/"valor"|"nota_ideb"|"despesa_por_matricula"/);
    expect(csv).toContain('mesma UF inteira, ano, rede e etapa');
    const response = jsonRoute(new Request(url));
    expect(response.status).toBe(200);
    const dado = await response.json();
    expect(dado.observacoes).toEqual([]);
    expect(dado.tipo_registro).toBe('disponibilidade_sem_observacoes');
    expect(dado.tentativa_fontes.manifesto).toContain('/blob/c64a31c');
    expect(csvRoute(new Request(url)).headers.get('Content-Disposition')).toContain('disponibilidade-PE-2025');
  });
});
