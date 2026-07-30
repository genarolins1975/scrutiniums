"use client";

import { Component, type ReactNode } from "react";
import { ErrorState } from "@/components/ui/States";

/**
 * Error boundary simples por painel: uma falha de renderização do
 * gráfico não derruba a página — exibe ErrorState com nova tentativa.
 */
export class ChartErrorBoundary extends Component<{ children: ReactNode }, { erro: boolean }> {
  state = { erro: false };

  static getDerivedStateFromError() {
    return { erro: true };
  }

  render() {
    if (this.state.erro) {
      return (
        <ErrorState
          title="Não foi possível exibir o gráfico"
          description="Ocorreu um erro ao desenhar a visualização. Os demais elementos do painel continuam disponíveis."
          onRetry={() => this.setState({ erro: false })}
        />
      );
    }
    return this.props.children;
  }
}
