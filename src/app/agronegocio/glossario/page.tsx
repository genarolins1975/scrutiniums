import { FiguraGlossarioAgro } from '@/components/agro/GlossarioFigura';
import type { Metadata } from 'next';
import { AberturaAgro } from '@/components/agro/Editorial';
import { GlossarioAgro } from '@/components/agro/Aprendizado';
export const metadata: Metadata = { title: 'Glossário do Agronegócio', alternates: { canonical: '/agronegocio/glossario' } };
export default function GlossarioPageAgro() { return <><AberturaAgro rotulo="Agronegócio / Glossário visual · T4" titulo="Palavras parecidas. Medidas diferentes." texto="Busque um conceito, leia sua definição e confira o contraste que muda a interpretação. Os termos são um conjunto de apoio à leitura, não artefatos contados separadamente."/><FiguraGlossarioAgro /><GlossarioAgro /></>; }
