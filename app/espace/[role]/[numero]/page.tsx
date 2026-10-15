import { Suspense } from "react";
import { notFound } from "next/navigation";
import VueEspace from "@/components/VueEspace";
import { LIBELLES, type RoleEspace } from "@/lib/espace";
import { Etat } from "@/components/Entete";

// Liens du type /espace/jury/a, /espace/preparateur/b, /espace/secretariat/a
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
  // Lien du type /espace/jury/a ou /espace/jury/b (les anciens liens /1 et /2 marchent aussi)
  const code = numero.toLowerCase();
  const n = code === "a" || code === "1" ? 1 : code === "b" || code === "2" ? 2 : 0;
  if (!(role in LIBELLES) || !n) notFound();
  return <VueEspace role={role as RoleEspace} numero={n as 1 | 2} />;
}