import { Suspense } from "react";
import VuePointeur from "@/components/VuePointeur";
import { Etat } from "@/components/Entete";

// Page serveur : lit le slug dans l'adresse, puis affiche la vue (côté navigateur)
export default function PointeurPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<Etat texte="Chargement…" />}>
      <Contenu params={params} />
    </Suspense>
  );
}

async function Contenu({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <VuePointeur slug={slug} />;
}