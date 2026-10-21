'use client';
import {useEffect, useRef, useState} from 'react';

/**
 * Formulário GET do recorte: sem JavaScript, o botão "Aplicar" envia; com JavaScript, a mudança de um campo já
 * envia e o botão some. A URL leva o recorte (ano, estágio, base, área) e pode ser compartilhada.
 */
export function EnvioAutomatico({children, acao, ancora, rotulo}: {children: React.ReactNode; acao: string; ancora: string; rotulo: string}) {
  const form = useRef<HTMLFormElement>(null);
  const [js, setJs] = useState(false);
  useEffect(() => setJs(true), []);
  return (
    <form
      ref={form}
      method="get"
      action={`${acao}#${ancora}`}
      aria-label={rotulo}
      className="cp-area-form"
      onChange={() => {
        const f = form.current;
        if (!f) return;
        // parâmetros no valor padrão saem da URL, como nos links do painel
        const campos = Array.from(f.elements) as (HTMLSelectElement | HTMLInputElement)[];
        const omitidos = campos.filter((el) => el.name && el.dataset.padrao === el.value);
        for (const el of omitidos) el.disabled = true;
        f.requestSubmit();
        for (const el of omitidos) el.disabled = false;
      }}
    >
      {children}
      {!js && <button type="submit" className="cp-button">Aplicar</button>}
    </form>
  );
}
