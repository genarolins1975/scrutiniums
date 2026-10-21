import { registrarUsoAgro } from './uso';
/** Download iniciado pelo usuário; não transmite dados nem parâmetros. */
export function baixarAgro(nome: string, conteudo: string, tipo = 'text/csv;charset=utf-8') { const url = URL.createObjectURL(new Blob([conteudo], { type: tipo })); const a = document.createElement('a'); a.href = url; a.download = nome; a.click(); registrarUsoAgro('download'); setTimeout(() => URL.revokeObjectURL(url), 1000); }
