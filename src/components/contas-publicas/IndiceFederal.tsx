import Link from 'next/link';
import {CAPITULOS_PUBLICADOS,PAINEL_AREAS,PAINEL_PREVIDENCIA} from '@/lib/contas-publicas/catalogo';
import {BuscaPlataforma} from '@/components/busca/BuscaPlataforma';
import styles from './IndiceFederal.module.css';

/**
 * Índice dos capítulos das Contas Federais. Só os capítulos com dados (Onda 3): os em preparação ficam fora da
 * navegação, sem cartão nem filtro que os anuncie; o desenho deles segue registrado no catálogo. A busca é a da plataforma
 * (Iniciativa 3 do parecer de UX de 21/10/2026), só nesta coleção, com a busca em toda a plataforma ao lado; os capítulos e os
 * dois painéis complementares ficam sempre à vista.
 */
export function IndiceFederal(){
 return <><div className={styles.tools}><div className={styles.busca}><p className={styles.rotulo}>Encontre uma pergunta</p><BuscaPlataforma variante="pagina" exemplo="dívida, renúncias, metas, INSS…" filtro={{colecao:'federais',nome:'Contas Federais'}} rotulo="Buscar nas Contas Federais"/><p className={styles.todas}><Link href="/buscar" prefetch={false}>Buscar em toda a plataforma</Link></p></div></div><p className={styles.count}>{CAPITULOS_PUBLICADOS.length} capítulos com dados e os painéis complementares de previdência e de despesa por área · cobertura e limitações próprias.</p>
 <div className={styles.grid}><article><div className={styles.meta}><span>Complemento do Panorama</span><span className={styles.available}>Dados disponíveis</span></div><h3>{PAINEL_PREVIDENCIA.titulo}</h3><p>{PAINEL_PREVIDENCIA.pergunta}</p><p className={styles.detail}>Benefícios do INSS por tipo, por estado e no seu município, e o resultado do Regime Geral ano a ano.</p><Link href={PAINEL_PREVIDENCIA.href}>Explorar o painel <span aria-hidden="true">→</span></Link></article><article><div className={styles.meta}><span>Complemento do Panorama</span><span className={styles.available}>Dados disponíveis</span></div><h3>{PAINEL_AREAS.titulo}</h3><p>{PAINEL_AREAS.pergunta}</p><p className={styles.detail}>Cada R$ 100 pagos por área de governo desde 2000, com a dívida à parte e o detalhe por subfunção.</p><Link href={PAINEL_AREAS.href}>Explorar o painel <span aria-hidden="true">→</span></Link></article>{CAPITULOS_PUBLICADOS.map((c,i)=><article key={c.id}><div className={styles.meta}><span>{String(i+1).padStart(2,'0')} / {c.etapa}</span><span className={styles.available}>Dados disponíveis</span></div><h3>{c.titulo}</h3><p>{c.pergunta}</p><p className={styles.detail}>{c.entrega}</p><Link href={`/contas-publicas/${c.id}`}>Explorar o painel <span aria-hidden="true">→</span></Link></article>)}</div></>;
}
