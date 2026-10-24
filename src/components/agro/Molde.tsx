import type { EconomiaAgro, SnapshotAgro } from '@/lib/agro/tipos';
import type { Natureza, NumeroProps } from '@/lib/painel/tipos';
import { provenienciaMontada } from '@/lib/painel/proveniencia-montada';
import { PerguntasAgro } from './Economia';
import { SecaoAgro } from './Editorial';

/**
 * Peças comuns das páginas do Agronegócio no molde de painel (Iniciativa 1 do parecer de UX de 23/10/2026). Nada aqui calcula
 * número: a proveniência de cada figura sai do registro de fontes do snapshot (nome, endereço, licença, captura, sha256 e o
 * limite que a fonte declara), e o número ausente vira ausência com motivo no NumeroIndicador, nunca "Não disponível" no lugar
 * do valor.
 */

/** Órgão e conjunto a partir do nome registrado ("IBGE, Contas Nacionais Trimestrais ..."); sem vírgula, a primeira palavra é o órgão. */
function orgaoEConjunto(nome: string): [string, string] {
    const i = nome.indexOf(', ');
    if (i > 0) return [nome.slice(0, i), nome.slice(i + 2)];
    const j = nome.indexOf(' ');
    return j > 0 ? [nome.slice(0, j), nome.slice(j + 1)] : [nome, nome];
}

export function provAgro(dados: SnapshotAgro, id: string, o: { indicador: string; natureza: Natureza; unidade: string; frequencia: string; inicio: string; fim: string; limitacoes?: string[] }) {
    const f = dados.fontes.find(x => x.id === id);
    const [orgao, dataset] = orgaoEConjunto(f?.nome ?? id);
    return provenienciaMontada({
        indicador: o.indicador,
        natureza: o.natureza,
        orgao,
        dataset,
        url: f?.url ?? '/agronegocio/metodologia#fonte-' + id,
        licenca: f?.licenca,
        unidade: o.unidade,
        frequencia: o.frequencia,
        inicio: o.inicio,
        fim: o.fim,
        capturadoEm: f?.capturadoEm ?? null,
        sha256: f?.sha256Original ?? null,
        limitacoes: [...(f?.limite ? [f.limite] : []), ...(o.limitacoes ?? [])],
    });
}

/** "2026-T2" → "2026-06" (o último mês do trimestre), a forma que a figura e o "Sobre este dado" escrevem como mês e ano. */
export const fimTrimestre = (p: string) => `${p.slice(0, 4)}-${String(Number(p.slice(-1)) * 3).padStart(2, '0')}`;
/** "2025-T3" → "2025-07" (o primeiro mês do trimestre). */
export const inicioTrimestre = (p: string) => `${p.slice(0, 4)}-${String(Number(p.slice(-1)) * 3 - 2).padStart(2, '0')}`;

/** A frase "Coletado na fonte em ..." que acompanhava cada fonte das páginas, para a linha de fonte da figura. */
export function capturadoAgro(dados: SnapshotAgro, id: string) {
    const f = dados.fontes.find(x => x.id === id);
    return f?.capturadoEm ? 'Coletado na fonte em ' + new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(f.capturadoEm)) + '; a fonte pode revisar valores.' : '';
}

type BaseNumero = Omit<NumeroProps, 'valor' | 'valorTexto' | 'motivoAusencia' | 'formato'>;

/** Número com o valor já escrito como antes ("R$ 712,7 bi", "+6,2%"); valor ausente é ausência com o motivo, nunca o texto no lugar. */
export function numeroAgroIndicador(base: BaseNumero, valor: number | null | undefined, texto: string, motivo = 'A fonte não publicou este valor no período do snapshot.'): NumeroProps {
    return valor == null || !Number.isFinite(valor) ? ({ ...base, valor: null, motivoAusencia: motivo } as NumeroProps) : ({ ...base, valor, valorTexto: texto } as NumeroProps);
}

/** A navegação entre as perguntas do setor, no fim da última figura (era a última seção das páginas). */
export function OutrasPerguntasAgro({ e, atual }: { e: EconomiaAgro; atual: string }) {
    return <SecaoAgro titulo="As outras perguntas sobre o setor."><PerguntasAgro e={e} atual={atual}/></SecaoAgro>;
}
