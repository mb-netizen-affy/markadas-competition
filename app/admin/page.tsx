"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase, REGLAGES_DEFAUT, type Categorie, type Reglages } from "@/lib/supabase";
import Entete from "@/components/Entete";
import ImportExcel from "@/components/admin/ImportExcel";
import GestionCategories from "@/components/admin/GestionCategories";
import Liens from "@/components/admin/Liens";
import ReglagesPassages from "@/components/admin/ReglagesPassages";
import SecretariatGeneral from "@/components/admin/SecretariatGeneral";

type Onglet = "categories" | "import" | "liens" | "secretariat";

export default function AdminPage() {
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [compteurs, setCompteurs] = useState<Record<string, number>>({});
  const [presents, setPresents] = useState<Record<string, number>>({});
  const [reglages, setReglages] = useState<Reglages>(REGLAGES_DEFAUT);
  const [onglet, setOnglet] = useState<Onglet>("categories");

  const charger = useCallback(async () => {
    const { data } = await supabase.from("categories").select("*").order("ordre");
    if (!data) return;
    setCategories(data);
    const { data: reg } = await supabase.from("reglages").select("*").eq("id", 1).maybeSingle();
    if (reg) setReglages(reg);
    // Nombre de danseurs par catégorie
    const res = await Promise.all(
      data.map((c) =>
        supabase.from("danseurs").select("*", { count: "exact", head: true }).eq("categorie_id", c.id)
      )
    );
    setCompteurs(Object.fromEntries(data.map((c, i) => [c.id, res[i].count ?? 0])));
    // Nombre de présents par catégorie (pour le calcul automatique)
    const resP = await Promise.all(
      data.map((c) =>
        supabase.from("danseurs").select("*", { count: "exact", head: true })
          .eq("categorie_id", c.id).eq("present", true)
      )
    );
    setPresents(Object.fromEntries(data.map((c, i) => [c.id, resP[i].count ?? 0])));
  }, []);

  useEffect(() => {
    charger();
  }, [charger]);

  async function remiseAZero() {
    if (!confirm(
      "Remettre la compétition à zéro ?\n\n" +
      "Toutes les présences et sélections du jury seront effacées. La liste des danseurs est conservée."
    )) return;
    const { error } = await supabase
      .from("danseurs")
      .update({ present: null, qualif_t1: false, qualif_rep: false, or_finale: false })
      .not("id", "is", null);
    alert(error ? "Erreur : " + error.message : "✅ Compétition remise à zéro");
  }

  const total = Object.values(compteurs).reduce((a, b) => a + b, 0);
  const onglets: { id: Onglet; label: string }[] = [
    { id: "categories", label: "Catégories" },
    { id: "import", label: "Import" },
    { id: "liens", label: "Liens" },
    { id: "secretariat", label: "Secrétariat" },
  ];

  return (
    <main className="min-h-screen">
      <Entete titre="Administration" sousTitre={`${categories.length} catégories · ${total} danseurs inscrits`}>
        <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {onglets.map((o) => (
            <button
              key={o.id}
              onClick={() => setOnglet(o.id)}
              className={`mk-onglet ${onglet === o.id ? "mk-onglet-actif" : ""}`}
            >
              {o.label}
            </button>
          ))}
        </nav>
      </Entete>

      <div className="mx-auto max-w-5xl space-y-3 p-3">
        {onglet === "categories" && (
          <>
            <ReglagesPassages reglages={reglages} categories={categories} inscrits={compteurs} presents={presents} onChange={charger} />
            <GestionCategories categories={categories} compteurs={compteurs} onChange={charger} />
            <div className="space-y-2 rounded-lg border border-mk-rouge/50 bg-mk-rouge/10 p-4">
              <p className="mk-titre text-mk-rouge">Zone sensible</p>
              <p className="text-sm text-mk-gris">
                Efface les présences et les sélections (après les tests, ou avant le jour J).
              </p>
              <button onClick={remiseAZero} className="mk-btn mk-btn-rouge">
                Remettre la compétition à zéro
              </button>
            </div>
          </>
        )}
        {onglet === "import" && <ImportExcel categories={categories} onImport={charger} />}
        {onglet === "liens" && <Liens categories={categories} />}
        {onglet === "secretariat" && <SecretariatGeneral categories={categories} />}
      </div>
    </main>
  );
}