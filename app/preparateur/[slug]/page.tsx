import { Suspense } from "react";
import VueCompetition from "@/components/VueCompetition";
import { Etat } from "@/components/Entete";

// Page serveur : lit le slug dans l'adresse, puis affiche la vue (côté navigateur)
export default function PreparateurPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<Etat texte="Chargement…" />}>
      <Contenu params={params} />
    </Suspense>
  );
}

async function Contenu({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <VueCompetition slug={slug} lectureSeule />;
}