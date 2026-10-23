"use client";

import { useEffect, useRef, useState } from "react";
import { GravuraEnergia } from "./GravuraEnergia";
import Link from "@/components/energia/LinkSemPrefetch";
import { ETAPAS_ENERGIA_IDIOMAS } from "@/lib/energia/percurso-visual";
import { useIdioma, useTx } from "@/lib/energia/useIdioma";
import { observarAncoras, guardarAncora } from "./navegacao-ancoras";
import styles from "./PercursoVisualEnergia.module.css";

/**
 * Botões nativos: todos acessíveis por Tab; setas também percorrem as etapas. O detalhe abre quando o leitor escolhe uma etapa
 * (ou chega por #etapa-…): até lá, os quatro cartões trazem a pergunta e o que se encontra, e o detalhe da primeira etapa fica no
 * HTML, recolhido (orçamento de comprimento da entrada, Iniciativa 4, 22/10/2026).
 */
export function PercursoVisualEnergia() {
  const idioma = useIdioma();
  const tx = useTx();
  const ETAPAS_ENERGIA = ETAPAS_ENERGIA_IDIOMAS[idioma];
  const [ativa, setAtiva] = useState(0);
  const [escolhida, setEscolhida] = useState(false);
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => observarAncoras(hash => {
    if (hash === "#mapa-conceitual") {
      const mapa = document.querySelector<HTMLDetailsElement>(".energia-mapa-completo");
      if (mapa) mapa.open = true;
      return;
    }
    const i = ETAPAS_ENERGIA.findIndex(e => hash === `#etapa-${e.id}`);
    if (i < 0) return;
    setAtiva(i);
    setEscolhida(true);
    requestAnimationFrame(() => document.getElementById("percurso-energia")?.scrollIntoView({ block: "start" }));
  }), [ETAPAS_ENERGIA]);
  const selecionar = (i: number) => {
    setAtiva(i);
    setEscolhida(true);
    guardarAncora(`#etapa-${ETAPAS_ENERGIA[i].id}`);
  };
  const etapa = ETAPAS_ENERGIA[ativa];
  return <section id="percurso-energia" className={styles.percurso} aria-labelledby="percurso-titulo">
    <div className={styles.cabecalho}>
      <p className={styles.sobretitulo}>{tx("Explore o caminho da energia", "Explore the path of energy")}</p>
      <h2 id="percurso-titulo">{tx("Do reservatório à sua tomada.", "From the reservoir to your socket.")}</h2>
      <p>{tx("Escolha uma etapa e descubra o que acontece nela.", "Choose a stage and discover what happens in it.")}</p>
    </div>
    <div id="energia-etapas" className={styles.etapas} role="group" aria-label={tx("Etapas do caminho da energia", "Stages of the path of energy")}>
      {ETAPAS_ENERGIA.map((e, i) => <button key={e.id} id={`etapa-${e.id}`} type="button"
        ref={el => { botoes.current[i] = el; }} aria-pressed={escolhida && ativa === i} aria-controls="percurso-detalhe"
        onClick={() => {
          selecionar(i);
          if (window.matchMedia("(max-width: 760px)").matches) requestAnimationFrame(() => {
            document.getElementById("percurso-etapa-titulo")?.focus({ preventScroll: true });
            document.getElementById("percurso-detalhe")?.scrollIntoView({ block: "start" });
          });
        }} onKeyDown={event => {
          const n = ETAPAS_ENERGIA.length;
          const seguinte = event.key === "ArrowRight" ? (i + 1) % n : event.key === "ArrowLeft" ? (i + n - 1) % n : event.key === "Home" ? 0 : event.key === "End" ? n - 1 : null;
          if (seguinte === null) return;
          event.preventDefault(); selecionar(seguinte); botoes.current[seguinte]?.focus();
        }}>
        <GravuraEnergia etapa={e.id} />
        <span className={styles.botao}><span>{e.numero}</span>{e.nome}<span className={styles.sinal} aria-hidden="true">{escolhida && ativa === i ? "✓" : "↓"}</span></span>
        <span className={styles.pergunta}>{e.pergunta}</span>
        <span className={styles.encontra}>{e.encontra}</span>
      </button>)}
    </div>
    <div id="percurso-detalhe" className={styles.detalhe} role="region" aria-labelledby="percurso-etapa-titulo" hidden={!escolhida}>
      <div className={styles.miniatura}>
        <GravuraEnergia etapa={etapa.id} />
      </div>
      <div className={styles.explicacao}>
        <p className={styles.sobretitulo}>{etapa.numero} · {etapa.nome}</p>
        <h3 id="percurso-etapa-titulo" tabIndex={-1}>{etapa.titulo}</h3>
        <p>{etapa.texto}</p><p className={styles.recorte}><strong>{tx("Nos painéis:", "In the panels:")}</strong> {etapa.encontra} {etapa.recorte}</p>
        <div className={styles.links}><Link href={etapa.href}>{etapa.link} ↗</Link><Link href={etapa.detalhe}>{etapa.detalheNome} ↗</Link></div>
      </div>
      <aside className={styles.conceito}><span className={styles.sobretitulo}>{tx("Uma distinção importante", "An important distinction")}</span><p>{etapa.conceito}</p></aside>
    </div>
    <a className={styles.voltar} href="#energia-etapas" hidden={!escolhida}>{tx("Escolher outra etapa ↑", "Choose another stage ↑")}</a>
    <p className={styles.nota}>
      {tx(
        "Ilustrações conceituais geradas por IA. Percurso didático simplificado: não representa a topologia ou o despacho do SIN. Geração distribuída e sistemas isolados têm outras configurações.",
        "AI-generated conceptual illustrations. Simplified teaching path: it does not represent the topology or the dispatch of the SIN. Distributed generation and isolated systems have other configurations.",
      )}{" "}
      <a href="#mapa-conceitual">{tx("Ver relações físicas, operacionais e de mercado ↓", "See physical, operational and market relations ↓")}</a>
    </p>
  </section>;
}

