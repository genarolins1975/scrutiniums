import type { Dominio } from "@/lib/dominios";

/** Classes de acento por observatório, sempre a partir dos tokens do tema. */
export const ACENTO: Record<Dominio["acento"], { filete: string; texto: string; hover: string; decoracao: string }> = {
  bronze: { filete: "bg-bronze", texto: "text-bronze-dark", hover: "group-hover:text-bronze-dark", decoracao: "hover:decoration-bronze" },
  energia: { filete: "bg-energia", texto: "text-energia-dark", hover: "group-hover:text-energia-dark", decoracao: "hover:decoration-energia" },
  obee: { filete: "bg-obee", texto: "text-obee-dark", hover: "group-hover:text-obee-dark", decoracao: "hover:decoration-obee" },
  gas: { filete: "bg-gas", texto: "text-gas-dark", hover: "group-hover:text-gas-dark", decoracao: "hover:decoration-gas" },
};
