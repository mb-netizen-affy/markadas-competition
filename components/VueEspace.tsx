"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase, REGLAGES_DEFAUT, type Categorie, type Danseur, type Reglages } from "@/lib/supabase";
import { estFinaliste, nbPassagesAuto } from "@/lib/competition";
import Entete, { Etat } from "@/components/Entete";
import { LIBELLES, type RoleEspace } from "@/lib/espace";


// Page d'accueil d'un jury (ou de ses préparateurs / de son secrétariat) :
// uniquement les catégories de ce jury, avec leur avancement en direct.
export default function VueEspace({ role, numero }: { role: RoleEspace; numero: 1 | 2 }) {
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [danseurs, setDanseurs] = useState<Danseur[]>([]);
  const [reglages, setReglages] = useState<Reglages>(REGLAGES_DEFAUT);
  const [chargement, setChargement] = useState(true);

  useEffect(() => {
    let annule = false;

    async function charger() {
      const { data: cats } = await supabase
        .from("categories").select("*").eq("jury", numero).order("ordre");
      if (annule) return;
      setCategories(cats ?? []);

      const { data: reg } = await supabase.from("reglages").select("*").eq("id", 1).maybeSingle();
      if (!annule && reg) setReglages(reg);

      // Danseurs de ces catégories (par paquets de 1000, limite de Supabase)
      const ids = (cats ?? []).map((c) => c.id);
      const tous: Danseur[] = [];
      if (ids.length) {
        for (let debut = 0; ; debut += 1000) {
          const { data } = await supabase
            .from("danseurs").select("*").in("categorie_id", ids)
            .order("id").range(debut, debut + 999);
          tous.push(...(data ?? []));
          if (!data || data.length < 1000) break;
        }
      }
      if (!annule) {
        setDanseurs(tous);
        setChargement(false);
      }
    }

    charger();

    const channel = supabase
      .channel(`espace-${role}-${numero}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "danseurs" }, (payload) => {
        if (payload.eventType === "UPDATE") {
          const maj = payload.new as Danseur;
          setDanseurs((prev) => prev.map((d) => (d.id === maj.id ? maj : d)));
        } else {
          charger();
        }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () => charger())
      .on("postgres_changes", { event: "*", schema: "public", table: "reglages" }, (payload) => {
        if (payload.new && "lignes" in payload.new) setReglages(payload.new as Reglages);
      })
      .subscribe();

    return () => {
      annule = true;
      supabase.removeChannel(channel);
    };
  }, [role, numero]);

  const lignes = useMemo(
    () =>
      categories.map((c) => {
        const ds = danseurs.filter((d) => d.categorie_id === c.id);
        const presents = ds.filter((d) => d.present === true).length;
        const pointes = ds.filter((d) => d.present !== null).length;
        return {
          c,
          inscrits: ds.length,
          presents,
          aPointer: ds.length - pointes,
          pct: ds.length ? Math.round((pointes / ds.length) * 100) : 0,
          passages: nbPassagesAuto(presents, reglages),
          finalistes: ds.filter(estFinaliste).length,
          or: ds.filter((d) => estFinaliste(d) && d.or_finale).length,
        };
      }),
    [categories, danseurs, reglages]
  );

  if (chargement) return <Etat texte="Chargement…" />;

  return (
    <main className="min-h-screen">
      <Entete titre={`${LIBELLES[role]} ${numero}`} sousTitre={`${categories.length} catégories`} />

      <div className="mx-auto grid max-w-5xl gap-3 p-3 sm:grid-cols-2">
        {lignes.map((l) => (
          <Link
            key={l.c.id}
            href={`/${role}/${l.c.slug}`}
            className="mk-carte block space-y-3 transition hover:border-mk-rouge active:scale-[0.99]"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="mk-titre text-xl">{l.c.nom}</h2>
              <span className="text-2xl text-mk-rouge">→</span>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold uppercase tracking-wider text-mk-gris">
                <span>Pointage</span>
                <span>{l.aPointer > 0 ? `${l.aPointer} à pointer` : "Terminé ✔"}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-mk-carte2">
                <div className="h-full bg-ok transition-all" style={{ width: `${l.pct}%` }} />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 text-center">
              <Chiffre valeur={l.presents} label="Présents" />
              <Chiffre valeur={l.passages} label="Passages" />
              <Chiffre valeur={l.finalistes} label="Finalistes" />
              <Chiffre valeur={l.or} label="Or" couleur="text-or" />
            </div>
          </Link>
        ))}
        {lignes.length === 0 && (
          <p className="p-4 text-center text-mk-gris sm:col-span-2">Aucune catégorie pour ce jury.</p>
        )}
      </div>
    </main>
  );
}

function Chiffre({ valeur, label, couleur = "text-mk-texte" }: { valeur: number; label: string; couleur?: string }) {
  return (
    <div className="rounded-md bg-mk-carte2 py-1.5">
      <div className={`text-lg font-extrabold ${couleur}`}>{valeur}</div>
      <div className="text-[10px] font-bold uppercase tracking-wider text-mk-gris">{label}</div>
    </div>
  );
}