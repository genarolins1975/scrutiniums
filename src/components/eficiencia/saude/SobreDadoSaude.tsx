"use client";

import type { ComponentProps } from "react";
import { SobreEsteDado } from "../SobreEsteDado";

/** "Sobre este dado" do módulo Saúde: a mesma ficha de 16 campos, com o caminho do código e o comando de reconstrução de Saúde. */
export const CODIGO_SAUDE = { pasta: "pipeline/eficiencia_saude", comando: "python3 -m pipeline.eficiencia_saude.run" };

export function SobreDadoSaude(p: Omit<ComponentProps<typeof SobreEsteDado>, "codigo">) {
  return <SobreEsteDado {...p} codigo={CODIGO_SAUDE} />;
}
