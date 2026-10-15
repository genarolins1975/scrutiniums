import type { Metadata, ResolvingMetadata } from "next";
import { ACESSO, listaObservatorios } from "@/lib/acesso";
import { metadadosPortuguesComAlternativas } from "@/lib/i18n-metadata";
import { Home } from "@/components/home/Home";

const metadadosOriginais: Metadata = {
  description:
    `Da informação dispersa ao conhecimento verificável. Uma plataforma, observatórios de ${listaObservatorios()}, com bases públicas, registros oficiais e método declarado. Gratuita. ${ACESSO.curto}`,
};

export async function generateMetadata(_props: { params?: Record<string, string> }, parent: ResolvingMetadata): Promise<Metadata> {
  return metadadosPortuguesComAlternativas("/", metadadosOriginais, await parent);
}

export default async function HomePage() {
  return Home({ idioma: "pt" });
}
