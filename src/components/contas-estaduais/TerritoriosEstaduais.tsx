"use client";
import Image from 'next/image';
import { snapshot } from '@/lib/contas-estaduais/dados';

export function BandeiraEstadual({ uf, destaque = false }: { uf: string; destaque?: boolean }) {
  return <Image className={destaque ? 'ce-flag ce-flag-large' : 'ce-flag'} src={`/contas-estaduais/bandeiras/${uf.toLowerCase()}.svg`} alt={`Bandeira de ${snapshot.ufs.find(u => u.uf === uf)?.nome ?? uf}`} width={destaque ? 96 : 36} height={destaque ? 64 : 24} unoptimized />;
}

export default function TerritoriosEstaduais({ uf, ano, selecionar }: { uf: string; ano: number; selecionar: (uf: string, ano: number) => void }) {
  const estado = snapshot.ufs.find(u => u.uf === uf)!;
  return <div className="ce-territories">
    <div className="ce-territory-heading"><div><p className="ce-kicker">Escolha um território</p><p>27 contextos. Uma leitura comparável.</p></div><span>Selecione uma bandeira para atualizar a ficha.</span></div>
    <div className="ce-flag-list" role="group" aria-label="Selecionar estado pela bandeira">
      {snapshot.ufs.map(u => <button type="button" key={u.uf} aria-label={`${u.nome} (${u.uf})`} aria-pressed={uf === u.uf} onClick={() => selecionar(u.uf, ano)}><BandeiraEstadual uf={u.uf}/><span>{u.uf}</span><span className="ce-territory-name">{u.nome}</span></button>)}
    </div>
    <div className="ce-territory-identity"><BandeiraEstadual uf={uf} destaque/><div><p className="ce-kicker">{estado.regiao} / {uf}</p><h3>{estado.nome}</h3><p>{ano} · {ano === 2026 ? 'exercício parcial' : 'encerramento anual'} · Executivo estadual</p></div></div>
  </div>;
}
