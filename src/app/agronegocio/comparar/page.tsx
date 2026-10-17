import type { Metadata } from 'next';
import type { CamadaGeo } from '@/lib/energia/geo';
import { dadosAgro, malhaAgro } from '@/lib/agro/dados';
import { AberturaAgro } from '@/components/agro/Editorial';
import { ExploracaoTerritorialAgro } from '@/components/agro/ExploracaoTerritorial';
export const metadata: Metadata = { title: 'Comparar territórios', alternates: { canonical: '/agronegocio/comparar' } };
export default function CompararAgro() { return <><AberturaAgro rotulo="Agronegócio / Centro de comparações · T5" titulo="Qual é a régua da comparação?" texto="Até três UFs, mesma medida e período. Compare valores absolutos e razões válidas, veja a distribuição dos pares e preserve o recorte na URL."/><ExploracaoTerritorialAgro dados={dadosAgro} geometria={malhaAgro as unknown as CamadaGeo} modo="comparar"/></>; }
