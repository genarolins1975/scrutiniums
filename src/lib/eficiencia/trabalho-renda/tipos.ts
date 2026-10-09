export type SexoTrabalhoRenda = 'total' | 'homens' | 'mulheres';
export interface TerritorioTrabalhoRenda { id: string; nome: string; nivel: 'brasil' | 'uf' | 'municipio'; uf?: string; }
export interface FonteTrabalhoRenda { id: string; nome: string; url: string; consulta: string; periodo: { frequencia: string; inicio: number; fim: number }; universo: string; limitacoes: string[]; capturadoEm: string; sha256: string; bruto: string; documentacao?: string[]; }
export interface IndicadorTrabalhoRenda { id: string; nome: string; unidade: string; fonteId: string; universo: string; limitacao: string; }
export interface ObservacaoTrabalhoRenda { indicadorId: string; territorioId: string; periodo: string; periodoNome: string; valor: number | null; sexo: SexoTrabalhoRenda; grupo: string; status: 'observado' | 'ausente'; cv: number | null; fonteId: string; }
export interface SnapshotTrabalhoRenda { versao: number; capturadoEm: string; fontes: FonteTrabalhoRenda[]; territorios: TerritorioTrabalhoRenda[]; indicadores: IndicadorTrabalhoRenda[]; observacoes: ObservacaoTrabalhoRenda[]; notas: string[]; }
