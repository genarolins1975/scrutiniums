"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSessaoCompleta } from "@/components/acesso/sessao";

/** Também cobre a volta à home pelo cache de navegação do App Router depois do login. */
export function RedirecionarHome() {
  const completa = useSessaoCompleta();
  const router = useRouter();
  useEffect(() => { if (completa) router.replace("/app/observatorios"); }, [completa, router]);
  return null;
}
