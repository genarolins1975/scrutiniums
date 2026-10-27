"use client";

import { useEffect, useState } from "react";
import { buscarMunicipios, prepararBuscaMunicipios, type MunicipioEncontrado } from "@/lib/energia/conta";
import { carregarIndiceMunicipios } from "@/lib/energia/indiceMunicipiosCliente";

/** Recupera o contexto e as ressalvas da fonte; não infere lugar a partir de perfil ou distribuidora. */
export function useMunicipioDaConta(lugar: string) {
  const [recuperado, definir] = useState<{ lugar: string; municipio: MunicipioEncontrado | null; erro: boolean } | null>(null);
  useEffect(() => {
    if (!lugar) return;
    let ativo = true;
    carregarIndiceMunicipios().then((indice) => {
      // O índice oficial não traz código IBGE: nome e UF precisam coincidir.
      const [uf, ...partes] = lugar.split("|");
      const nome = partes.join("|");
      const municipio = buscarMunicipios(indice, prepararBuscaMunicipios(indice), nome, indice.m.length).find((m) => m.uf === uf && m.nome === nome) ?? null;
      if (ativo) definir({ lugar, municipio, erro: !municipio });
    }).catch(() => { if (ativo) definir({ lugar, municipio: null, erro: true }); });
    return () => { ativo = false; };
  }, [lugar]);
  const atual = recuperado?.lugar === lugar ? recuperado : null;
  return { municipio: atual?.municipio ?? null, erro: atual?.erro ?? false, carregando: !!lugar && !atual };
}
