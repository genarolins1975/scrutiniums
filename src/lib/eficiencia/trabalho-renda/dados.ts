import type { ObservacaoTrabalhoRenda, SexoTrabalhoRenda, SnapshotTrabalhoRenda } from './tipos';
export async function carregarTrabalhoRenda(): Promise<SnapshotTrabalhoRenda> {
  const resposta = await fetch('/eficiencia/trabalho-renda/snapshot.json');
  if (!resposta.ok) throw new Error('Os dados de Trabalho e Renda não puderam ser carregados.');
  const dados = await resposta.json() as SnapshotTrabalhoRenda;
  if (dados.versao !== 1 || !Array.isArray(dados.observacoes)) throw new Error('Formato de dados incompatível.');
  return dados;
}
/** No municipal fallback to UF; no null-to-zero conversion; no implicit averaging. */
export function selecionarSerie(dados: SnapshotTrabalhoRenda, indicadorId: string, territorioId: string, sexo: SexoTrabalhoRenda = 'total', grupo = 'Total'): ObservacaoTrabalhoRenda[] {
  return dados.observacoes.filter(o => o.indicadorId === indicadorId && o.territorioId === territorioId && o.sexo === sexo && o.grupo === grupo).sort((a,b) => a.periodo.localeCompare(b.periodo));
}
export function observacoesParaCsv(observacoes: ObservacaoTrabalhoRenda[]): string {
  const campos: (keyof ObservacaoTrabalhoRenda)[] = ['indicadorId','territorioId','periodo','periodoNome','valor','sexo','grupo','status','cv','fonteId'];
  const escapar = (v: unknown) => `"${String(v ?? '').replaceAll('"','""')}"`;
  return '\uFEFF' + [campos.join(';'), ...observacoes.map(o => campos.map(k => escapar(o[k])).join(';'))].join('\r\n');
}
