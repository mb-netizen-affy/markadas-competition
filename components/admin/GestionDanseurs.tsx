"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, type Categorie, type Danseur } from "@/lib/supabase";
import { useCategorie } from "@/lib/useCategorie";
import { fmt } from "@/lib/competition";

// Ajouter, corriger ou supprimer un danseur sans réimporter tout le fichier
export default function GestionDanseurs({
  categories,
  onChange,
}: {
  categories: Categorie[];
  onChange: () => void;
}) {
  const [slug, setSlug] = useState("");
  const [enCours, setEnCours] = useState(false);
  useEffect(() => {
    // Catégorie choisie supprimée entre-temps → on revient à la première
    if ((!slug || !categories.some((c) => c.slug === slug)) && categories.length) setSlug(categories[0].slug);
    if (!categories.length) setSlug("");
  }, [categories, slug]);

  const categorieChoisie = categories.find((c) => c.slug === slug);

  // Double confirmation : on fait taper SUPPRIMER pour éviter un clic malheureux
  const confirmer = (message: string) =>
    confirm(message) && prompt('Pour confirmer, tape SUPPRIMER en majuscules :')?.trim() === "SUPPRIMER";

  async function viderCategorie() {
    if (!categorieChoisie) return;
    if (!confirmer(`Supprimer TOUS les danseurs de « ${categorieChoisie.nom} » ?\n\nLa catégorie et ses réglages sont conservés.`)) return;
    setEnCours(true);
    await supabase.from("danseurs").delete().eq("categorie_id", categorieChoisie.id);
    await supabase.from("categories").update({ demarree: false }).eq("id", categorieChoisie.id);
    setEnCours(false);
    onChange();
  }

  async function toutSupprimer(avecCategories: boolean) {
    const msg = avecCategories
      ? "Tout effacer : TOUS les danseurs ET TOUTES les catégories ?\n\nL'app repart de zéro (il faudra réimporter le fichier)."
      : "Supprimer TOUS les danseurs de TOUTES les catégories ?\n\nLes catégories et leurs réglages sont conservés.";
    if (!confirmer(msg)) return;
    setEnCours(true);
    const { error } = await supabase.from("danseurs").delete().not("id", "is", null);
    const { error: e2 } = avecCategories
      ? await supabase.from("categories").delete().not("id", "is", null)
      : await supabase.from("categories").update({ demarree: false }).not("id", "is", null);
    setEnCours(false);
    alert(error || e2 ? "Erreur : " + (error ?? e2)!.message : "✅ Suppression effectuée");
    onChange();
  }

  return (
    <section className="space-y-3">
      <div className="mk-carte flex flex-wrap items-center gap-3">
        <span className="text-xs font-bold uppercase text-mk-gris">Catégorie</span>
        <select value={slug} onChange={(e) => setSlug(e.target.value)} className="mk-input w-auto min-w-48">
          {categories.map((c) => (
            <option key={c.id} value={c.slug}>{c.nom}</option>
          ))}
        </select>
      </div>
      {slug && <ListeCategorie key={slug} slug={slug} categories={categories} onChange={onChange} />}

      {/* Nettoyage après les tests */}
      <div className="space-y-3 rounded-lg border border-mk-rouge/50 bg-mk-rouge/10 p-4">
        <p className="mk-titre text-mk-rouge">Zone sensible · nettoyage</p>
        <p className="text-sm text-mk-gris">
          Pour repartir propre après les tests. Chaque suppression est définitive et demande de taper « SUPPRIMER ».
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          <button onClick={viderCategorie} disabled={enCours || !categorieChoisie} className="mk-btn mk-btn-sombre border border-mk-rouge/50">
            Vider cette catégorie
          </button>
          <button onClick={() => toutSupprimer(false)} disabled={enCours} className="mk-btn mk-btn-rouge">
            Supprimer tous les danseurs
          </button>
          <button onClick={() => toutSupprimer(true)} disabled={enCours} className="mk-btn mk-btn-rouge">
            Tout effacer (danseurs + catégories)
          </button>
        </div>
      </div>
    </section>
  );
}

function messageErreur(e: { code?: string; message: string }) {
  return e.code === "23505" ? "Ce numéro de dossard est déjà pris dans cette catégorie." : e.message;
}

function ListeCategorie({
  slug,
  categories,
  onChange,
}: {
  slug: string;
  categories: Categorie[];
  onChange: () => void;
}) {
  const { categorie, danseurs, chargement } = useCategorie(slug);
  const [recherche, setRecherche] = useState("");
  const [enEdition, setEnEdition] = useState<string | null>(null);

  const liste = useMemo(() => {
    const q = recherche.trim().toLowerCase();
    const tri = [...danseurs].sort((a, b) => a.dossard - b.dossard);
    if (!q) return tri;
    return tri.filter(
      (d) => fmt(d.dossard).includes(q) || d.nom.toLowerCase().includes(q) || d.prenom.toLowerCase().includes(q)
    );
  }, [danseurs, recherche]);

  if (chargement || !categorie) return <p className="p-4 text-mk-gris">Chargement…</p>;

  const prochainDossard = Math.max(0, ...danseurs.map((d) => d.dossard)) + 1;

  return (
    <>
      <Ajout categorie={categorie} prochainDossard={prochainDossard} onChange={onChange} />

      <div className="mk-carte space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="mk-titre text-lg">{danseurs.length} danseurs</h2>
          <input
            type="search"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Rechercher…"
            className="mk-input w-auto sm:w-64"
          />
        </div>

        <ul className="divide-y divide-mk-ligne">
          {liste.map((d) =>
            enEdition === d.id ? (
              <Edition
                key={d.id}
                d={d}
                categories={categories}
                onFin={() => {
                  setEnEdition(null);
                  onChange();
                }}
              />
            ) : (
              <li key={d.id} className="flex items-center gap-3 py-2">
                <span className="w-10 text-center text-lg font-extrabold tabular-nums">{fmt(d.dossard)}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold uppercase">{d.nom}</div>
                  <div className="truncate text-sm text-mk-gris">{d.prenom}</div>
                </div>
                <span className="hidden text-xs font-semibold sm:inline">
                  {d.present === true && <span className="text-ok">Présent</span>}
                  {d.present !== true && <span className="text-mk-rouge">Absent</span>}
                </span>
                <button onClick={() => setEnEdition(d.id)} className="mk-btn mk-btn-sombre px-2 py-1 text-[11px]">
                  Modifier
                </button>
              </li>
            )
          )}
          {liste.length === 0 && <li className="py-4 text-center text-mk-gris">Aucun danseur</li>}
        </ul>
      </div>
    </>
  );
}

function Ajout({
  categorie,
  prochainDossard,
  onChange,
}: {
  categorie: Categorie;
  prochainDossard: number;
  onChange: () => void;
}) {
  const [dossard, setDossard] = useState("");
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState("");

  async function ajouter(e: React.FormEvent) {
    e.preventDefault();
    if (!nom.trim()) return;
    setEnCours(true);
    setMessage("");
    const num = parseInt(dossard, 10) || prochainDossard;
    const { error } = await supabase.from("danseurs").insert({
      categorie_id: categorie.id,
      dossard: num,
      nom: nom.trim().toUpperCase(),
      prenom: prenom.trim(),
    });
    setEnCours(false);
    if (error) {
      setMessage("❌ " + messageErreur(error));
      return;
    }
    setMessage(
      `✅ ${fmt(num)} ${nom.trim().toUpperCase()} ajouté` +
        (categorie.demarree ? " · catégorie démarrée : une fois pointé présent, il ira en demi-finale" : "")
    );
    setDossard("");
    setNom("");
    setPrenom("");
    onChange();
  }

  return (
    <form onSubmit={ajouter} className="mk-carte space-y-3">
      <h2 className="mk-titre text-lg">Ajouter un danseur</h2>
      <div className="grid grid-cols-[5rem_1fr] gap-2 sm:grid-cols-[6rem_1fr_1fr_auto]">
        <input
          type="number"
          min={1}
          value={dossard}
          onChange={(e) => setDossard(e.target.value)}
          placeholder={fmt(prochainDossard)}
          className="mk-input text-center"
          aria-label="Dossard"
        />
        <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Nom" className="mk-input" required />
        <input
          value={prenom}
          onChange={(e) => setPrenom(e.target.value)}
          placeholder="Prénom"
          className="mk-input col-span-2 sm:col-span-1"
        />
        <button type="submit" disabled={enCours || !nom.trim()} className="mk-btn mk-btn-rouge col-span-2 sm:col-span-1">
          {enCours ? "Ajout…" : "Ajouter"}
        </button>
      </div>
      <p className="text-xs text-mk-gris">Dossard vide = prochain numéro libre ({fmt(prochainDossard)}).</p>
      {message && <p className="text-sm font-semibold">{message}</p>}
    </form>
  );
}

function Edition({ d, categories, onFin }: { d: Danseur; categories: Categorie[]; onFin: () => void }) {
  const [f, setF] = useState({ dossard: String(d.dossard), nom: d.nom, prenom: d.prenom, categorie_id: d.categorie_id });
  const [enCours, setEnCours] = useState(false);

  async function enregistrer() {
    const num = parseInt(f.dossard, 10);
    if (isNaN(num) || !f.nom.trim()) return alert("Dossard et nom obligatoires.");
    const changeCategorie = f.categorie_id !== d.categorie_id;
    if (changeCategorie && !confirm("Changer de catégorie efface son pointage et ses sélections. Continuer ?")) return;
    setEnCours(true);
    const { error } = await supabase
      .from("danseurs")
      .update({
        dossard: num,
        nom: f.nom.trim().toUpperCase(),
        prenom: f.prenom.trim(),
        categorie_id: f.categorie_id,
        ...(changeCategorie
          ? { present: false, qualif_t1: false, qualif_rep: false, or_finale: false, passage: null }
          : {}),
      })
      .eq("id", d.id);
    setEnCours(false);
    if (error) alert(messageErreur(error));
    else onFin();
  }

  async function supprimer() {
    if (!confirm(`Supprimer ${fmt(d.dossard)} ${d.nom} ${d.prenom} ?`)) return;
    const { error } = await supabase.from("danseurs").delete().eq("id", d.id);
    if (error) alert(error.message);
    else onFin();
  }

  return (
    <li className="space-y-2 rounded-md bg-mk-carte2 p-3 my-1">
      <div className="grid grid-cols-[5rem_1fr] gap-2 sm:grid-cols-[6rem_1fr_1fr_12rem]">
        <input type="number" min={1} value={f.dossard} onChange={(e) => setF({ ...f, dossard: e.target.value })} className="mk-input text-center" aria-label="Dossard" />
        <input value={f.nom} onChange={(e) => setF({ ...f, nom: e.target.value })} className="mk-input" aria-label="Nom" />
        <input value={f.prenom} onChange={(e) => setF({ ...f, prenom: e.target.value })} className="mk-input col-span-2 sm:col-span-1" aria-label="Prénom" />
        <select value={f.categorie_id} onChange={(e) => setF({ ...f, categorie_id: e.target.value })} className="mk-input col-span-2 sm:col-span-1" aria-label="Catégorie">
          {categories.map((c) => (
            <option key={c.id} value={c.id}>{c.nom}</option>
          ))}
        </select>
      </div>
      <div className="flex flex-wrap justify-between gap-2">
        <button onClick={supprimer} className="mk-lien text-sm">Supprimer</button>
        <div className="flex gap-2">
          <button onClick={onFin} className="mk-btn mk-btn-sombre">Annuler</button>
          <button onClick={enregistrer} disabled={enCours} className="mk-btn mk-btn-rouge">
            {enCours ? "…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </li>
  );
}