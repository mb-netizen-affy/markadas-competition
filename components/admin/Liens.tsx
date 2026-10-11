"use client";

import { useEffect, useState } from "react";
import type { Categorie } from "@/lib/supabase";

const ROLES = [
  { chemin: "pointeur", label: "Pointeur" },
  { chemin: "jury", label: "Jury" },
  { chemin: "preparateur", label: "Préparateur" },
  { chemin: "secretariat", label: "Secrétariat" },
];

function copier(texte: string) {
  // Le presse-papier n'est pas toujours disponible (ex. adresse 192.168… en http)
  if (navigator.clipboard) {
    navigator.clipboard.writeText(texte).catch(() => window.prompt("Copie ce lien :", texte));
  } else {
    window.prompt("Copie ce lien :", texte);
  }
}

export default function Liens({ categories }: { categories: Categorie[] }) {
  const [origine, setOrigine] = useState("");
  const [copie, setCopie] = useState("");
  useEffect(() => setOrigine(window.location.origin), []);

  function clicCopier(url: string) {
    copier(url);
    setCopie(url);
    setTimeout(() => setCopie(""), 1500);
  }

  return (
    <section className="space-y-4">
      {[1, 2].map((jury) => {
        const cats = categories.filter((c) => c.jury === jury);
        return (
          <div key={jury} className="mk-carte space-y-3">
            <h2 className="mk-titre text-lg text-mk-rouge">Jury {jury}</h2>
            {cats.length === 0 && <p className="text-sm text-mk-gris">Aucune catégorie</p>}
            {cats.map((c) => (
              <div key={c.id} className="space-y-1">
                <p className="mk-titre">{c.nom}</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {ROLES.map((r) => {
                    const url = `${origine}/${r.chemin}/${c.slug}`;
                    return (
                      <div key={r.chemin} className="flex items-center gap-2 rounded-md bg-mk-carte2 px-3 py-2 text-sm">
                        <span className="w-24 shrink-0 text-xs font-bold uppercase text-mk-gris">{r.label}</span>
                        <a href={url} target="_blank" className="mk-lien flex-1 truncate">
                          {url}
                        </a>
                        <button
                          onClick={() => clicCopier(url)}
                          className="mk-btn mk-btn-rouge shrink-0 px-2 py-1 text-[11px]"
                        >
                          {copie === url ? "Copié ✓" : "Copier"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </section>
  );
}