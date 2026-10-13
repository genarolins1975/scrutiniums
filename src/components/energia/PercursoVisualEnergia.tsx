"use client";

import { useEffect, useRef, useState } from "react";
import { GravuraEnergia } from "./GravuraEnergia";
import Link from "@/components/energia/LinkSemPrefetch";
import { ETAPAS_ENERGIA } from "@/lib/energia/percurso-visual";
import { observarAncoras, guardarAncora } from "./navegacao-ancoras";
import styles from "./PercursoVisualEnergia.module.css";

/** Botões nativos: todos acessíveis por Tab; setas também percorrem as etapas. */
export function PercursoVisualEnergia() {
  const [ativa, setAtiva] = useState(0);
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
    requestAnimationFrame(() => document.getElementById("percurso-energia")?.scrollIntoView({ block: "start" }));
  }), []);
  const selecionar = (i: number) => {
    setAtiva(i);
    guardarAncora(`#etapa-${ETAPAS_ENERGIA[i].id}`);
  };
  const etapa = ETAPAS_ENERGIA[ativa];
  return <section id="percurso-energia" className={styles.percurso} aria-labelledby="percurso-titulo">
    <div className={styles.cabecalho}>
      <p className={styles.sobretitulo}>Explore o caminho da energia</p>
      <h2 id="percurso-titulo">Do reservatório à sua tomada.</h2>
      <p>Escolha uma etapa e descubra o que acontece nela.</p>
    </div>
    <div id="energia-etapas" className={styles.etapas} role="group" aria-label="Etapas do caminho da energia">
      {ETAPAS_ENERGIA.map((e, i) => <button key={e.id} id={`etapa-${e.id}`} type="button"
        ref={el => { botoes.current[i] = el; }} aria-pressed={ativa === i} aria-controls="percurso-detalhe"
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
        <span className={styles.botao}><span>{e.numero}</span>{e.nome}<span className={styles.sinal} aria-hidden="true">{ativa === i ? "✓" : "↓"}</span></span>
        <span className={styles.pergunta}>{e.pergunta}</span>
        <span className={styles.encontra}>{e.encontra}</span>
      </button>)}
    </div>
    <div id="percurso-detalhe" className={styles.detalhe} role="region" aria-labelledby="percurso-etapa-titulo">
      <div className={styles.miniatura}>
        <GravuraEnergia etapa={etapa.id} />
      </div>
      <div className={styles.explicacao}>
        <p className={styles.sobretitulo}>{etapa.numero} · {etapa.nome}</p>
        <h3 id="percurso-etapa-titulo" tabIndex={-1}>{etapa.titulo}</h3>
        <p>{etapa.texto}</p><p className={styles.recorte}><strong>Nos painéis:</strong> {etapa.encontra} {etapa.recorte}</p>
        <div className={styles.links}><Link href={etapa.href}>{etapa.link} ↗</Link><Link href={etapa.detalhe}>{etapa.detalheNome} ↗</Link></div>
      </div>
      <aside className={styles.conceito}><span className={styles.sobretitulo}>Uma distinção importante</span><p>{etapa.conceito}</p></aside>
    </div>
    <a className={styles.voltar} href="#energia-etapas">Escolher outra etapa ↑</a>
    <p className={styles.nota}>Ilustrações conceituais geradas por IA. Percurso didático simplificado: não representa a topologia ou o despacho do SIN. Geração distribuída e sistemas isolados têm outras configurações. <a href="#mapa-conceitual">Ver relações físicas, operacionais e de mercado ↓</a></p>
  </section>;
}

