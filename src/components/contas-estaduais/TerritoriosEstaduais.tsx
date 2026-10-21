"use client";
import Image from 'next/image';
import { snapshot } from '@/lib/contas-estaduais/dados';

export function BandeiraEstadual({ uf, destaque = false }: { uf: string; destaque?: boolean }) {
  return <Image className={destaque ? 'ce-flag ce-flag-large' : 'ce-flag'} src={`/contas-estaduais/bandeiras/${uf.toLowerCase()}.svg`} alt={`Bandeira de ${snapshot.ufs.find(u => u.uf === uf)?.nome ?? uf}`} width={destaque ? 96 : 36} height={destaque ? 64 : 24} unoptimized />;
}

/* Diagnóstico de layout de 20/10/2026, item 5: a grade de 27 bandeiras repetia a da abertura; a ficha mantém só a identidade
   do estado escolhido, e a troca de estado fica com a abertura e com o seletor da própria ficha. */
export default function TerritoriosEstaduais({ uf, ano }: { uf: string; ano: number; selecionar?: (uf: string, ano: number) => void }) {
  const estado = snapshot.ufs.find(u => u.uf === uf)!;
  return <div className="ce-territories">
    <div className="ce-territory-identity"><BandeiraEstadual uf={uf} destaque/><div><p className="ce-kicker">{estado.regiao} / {uf}</p><h3>{estado.nome}</h3><p>{ano} · {ano === 2026 ? 'exercício parcial' : 'encerramento anual'} · Executivo estadual</p></div></div>
  </div>;
}
