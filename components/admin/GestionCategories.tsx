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
      nom: nom.trim(), slug, jury: 1, nb_passages: 0, passages_rep: 0, passages_finale: 0,
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
        nb_passages: f.nb_passages,
        passages_rep: f.passages_rep,
        passages_finale: f.passages_finale,
      })
      .eq("id", f.id);
    setEnCours(false);
    if (error) alert("Erreur : " + error.message);
    else onChange();
  }

  async function annulerDemarrage() {
    if (!confirm(
      `Annuler le démarrage de « ${cat.nom} » ?\n\n` +
      "Les passages redeviennent provisoires (recalculés avec les présents). " +
      "Les sélections du jury sont conservées."
    )) return;
    await supabase.from("danseurs").update({ passage: null }).eq("categorie_id", cat.id);
    const { error } = await supabase.from("categories").update({ demarree: false }).eq("id", cat.id);
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
        {cat.demarree && (
          <span className="flex items-center gap-2 rounded bg-mk-rouge/20 px-2 py-1 text-xs font-bold text-red-300">
            🔒 DÉMARRÉE
            <button onClick={annulerDemarrage} className="underline">annuler</button>
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
        <label className="space-y-1">
          <span className="block text-xs font-semibold uppercase text-mk-gris">Jury / Piste</span>
          <select
            value={f.jury}
            onChange={(e) => setF({ ...f, jury: Number(e.target.value) as 1 | 2 })}
            className={`${champ} w-full`}
          >
            <option value={1}>Jury A · Piste A</option>
            <option value={2}>Jury B · Piste B</option>
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

      {/* Nombre de passages fixé (playlist du DJ) : vide = automatique */}
      <div className="space-y-2 rounded-md bg-mk-carte2 p-3 text-sm">
        <p className="text-xs font-semibold uppercase text-mk-gris">
          Nombre de passages <span className="normal-case">(vide = automatique)</span>
        </p>
        <div className="grid grid-cols-3 gap-2">
          {([
            ["nb_passages", "1er tour"],
            ["passages_rep", "Demi-finale"],
            ["passages_finale", "Finale"],
          ] as const).map(([cle, label]) => (
            <label key={cle} className="space-y-1">
              <span className="block text-xs text-mk-gris">{label}</span>
              <input
                type="number"
                min={0}
                max={20}
                value={f[cle] || ""}
                placeholder="auto"
                onChange={(e) => setF({ ...f, [cle]: Math.min(20, nombre(e.target.value)) })}
                className={`${champ} w-full text-center`}
              />
            </label>
          ))}
        </div>
        {cat.demarree && f.nb_passages !== cat.nb_passages && (
          <p className="text-xs text-amber-300">
            ⚠️ Catégorie déjà démarrée : le 1er tour reste figé. Annule le démarrage pour appliquer ce changement.
          </p>
        )}
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