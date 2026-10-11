"use client";

import { useEffect, useState } from "react";
import { supabase, type Categorie } from "@/lib/supabase";
import { normaliser } from "@/lib/texte";

export default function GestionCategories({
  categories,
  compteurs,
  onChange,
}: {
  categories: Categorie[];
  compteurs: Record<string, number>;
  onChange: () => void;
}) {
  async function ajouter() {
    const nom = prompt("Nom de la nouvelle catégorie :");
    if (!nom?.trim()) return;
    const slug = normaliser(nom);
    if (categories.some((c) => c.slug === slug)) return alert("Cette catégorie existe déjà.");
    const ordre = Math.max(0, ...categories.map((c) => c.ordre)) + 1;
    const { error } = await supabase.from("categories").insert({
      nom: nom.trim(), slug, jury: 1, nb_passages: 1,
      retenus_par_passage: [0], retenus_repechage: 0, ordre,
    });
    if (error) alert("Erreur : " + error.message);
    else onChange();
  }

  return (
    <section className="space-y-3">
      {categories.map((c) => (
        <CarteCategorie key={c.id} cat={c} nbDanseurs={compteurs[c.id] ?? 0} onChange={onChange} />
      ))}
      <button
        onClick={ajouter}
        className="w-full rounded-lg border-2 border-dashed border-mk-ligne py-4 font-bold uppercase tracking-wide text-mk-gris hover:border-mk-rouge hover:text-white"
      >
        + Ajouter une catégorie
      </button>
    </section>
  );
}

function CarteCategorie({
  cat,
  nbDanseurs,
  onChange,
}: {
  cat: Categorie;
  nbDanseurs: number;
  onChange: () => void;
}) {
  const [f, setF] = useState<Categorie>(cat);
  const [enCours, setEnCours] = useState(false);
  useEffect(() => setF(cat), [cat]);

  const modifie = JSON.stringify(f) !== JSON.stringify(cat);
  const nombre = (v: string) => Math.max(0, parseInt(v, 10) || 0);

  async function enregistrer() {
    setEnCours(true);
    const { error } = await supabase
      .from("categories")
      .update({
        nom: f.nom,
        slug: normaliser(f.slug),
        jury: f.jury,
        ordre: f.ordre,
      })
      .eq("id", f.id);
    setEnCours(false);
    if (error) alert("Erreur : " + error.message);
    else onChange();
  }

  async function supprimer() {
    if (!confirm(`Supprimer « ${cat.nom} » et ses ${nbDanseurs} danseurs ?`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", cat.id);
    if (error) alert("Erreur : " + error.message);
    else onChange();
  }

  const champ = "rounded-md border border-mk-ligne bg-mk-noir px-2 py-1 text-white focus:border-mk-rouge focus:outline-none";

  return (
    <div className="mk-carte space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={f.nom}
          onChange={(e) => setF({ ...f, nom: e.target.value })}
          className={`${champ} min-w-40 flex-1 text-lg font-extrabold uppercase`}
        />
        <span className="text-xs font-semibold uppercase text-mk-gris">{nbDanseurs} danseurs inscrits</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase text-mk-gris">Jury</span>
          <select
            value={f.jury}
            onChange={(e) => setF({ ...f, jury: Number(e.target.value) as 1 | 2 })}
            className={`${champ} w-full`}
          >
            <option value={1}>Jury 1</option>
            <option value={2}>Jury 2</option>
          </select>
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase text-mk-gris">Lien (slug)</span>
          <input value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value })} className={`${champ} w-full`} />
        </label>
        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase text-mk-gris">Ordre d&apos;affichage</span>
          <input type="number" value={f.ordre} onChange={(e) => setF({ ...f, ordre: nombre(e.target.value) })} className={`${champ} w-full`} />
        </label>
      </div>

      <div className="flex flex-wrap justify-between gap-2 pt-1">
        <button onClick={supprimer} className="mk-lien text-sm">Supprimer</button>
        <button
          onClick={enregistrer}
          disabled={!modifie || enCours}
          className="mk-btn mk-btn-rouge"
        >
          {enCours ? "Enregistrement…" : modifie ? "Enregistrer" : "Enregistré"}
        </button>
      </div>
    </div>
  );
}