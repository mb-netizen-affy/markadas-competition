import { Suspense } from "react";
import { notFound } from "next/navigation";
import VueEspace from "@/components/VueEspace";
import { LIBELLES, type RoleEspace } from "@/lib/espace";
import { Etat } from "@/components/Entete";

// Liens du type /espace/jury/1, /espace/preparateur/2, /espace/secretariat/1
type Params = Promise<{ role: string; numero: string }>;

export default function EspacePage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<Etat texte="Chargement…" />}>
      <Contenu params={params} />
    </Suspense>
  );
}

async function Contenu({ params }: { params: Params }) {
  const { role, numero } = await params;
  const n = Number(numero);
  if (!(role in LIBELLES) || (n !== 1 && n !== 2)) notFound();
  return <VueEspace role={role as RoleEspace} numero={n as 1 | 2} />;
}