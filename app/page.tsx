"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase, type Categorie } from "@/lib/supabase";
import Entete from "@/components/Entete";
import { lettre } from "@/lib/competition";

const ROLES = [
  { chemin: "pointeur", label: "Pointeur" },
  { chemin: "jury", label: "Jury" },
  { chemin: "preparateur", label: "Préparateur" },
  { chemin: "secretariat", label: "Secrétariat" },
];

export default function Accueil() {
  const [categories, setCategories] = useState<Categorie[]>([]);

  useEffect(() => {
    supabase.from("categories").select("*").order("ordre")
      .then(({ data }) => data && setCategories(data));
  }, []);

  return (
    <main className="min-h-screen">
      <Entete
        titre="Compétition"
        sousTitre="Écoles de danse Markadas"
        droite={<Link href="/admin" className="mk-btn mk-btn-contour px-3 py-1.5 text-xs">Admin</Link>}
      />

      <section className="mx-auto max-w-5xl px-4 pb-4 pt-10 text-center">
        <h2 className="mk-titre text-4xl text-mk-rouge sm:text-6xl">Compétition</h2>
        <p className="mt-2 text-lg font-bold sm:text-2xl">Bron · Meyzieu · Saint-Priest</p>
      </section>

      <div className="mx-auto grid max-w-5xl gap-3 p-4 sm:grid-cols-2">
        {categories.map((c) => (
          <div key={c.id} className="mk-carte space-y-3">
            <div className="flex items-baseline justify-between">
              <h3 className="mk-titre text-lg">{c.nom}</h3>
              <span className="text-xs font-semibold uppercase text-mk-gris">Jury {lettre(c.jury)}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => (
                <Link key={r.chemin} href={`/${r.chemin}/${c.slug}`} className="mk-btn mk-btn-sombre text-xs">
                  {r.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}