"use client";

import { useEffect, useState } from "react";
import { supabase, REGLAGES_DEFAUT, type Categorie, type Danseur, type Reglages } from "./supabase";
import { actifs, nbPassagesAuto, repartir } from "./competition";

export function useCategorie(slug: string) {
  const [categorie, setCategorie] = useState<Categorie | null>(null);
  const [danseurs, setDanseurs] = useState<Danseur[]>([]);
  const [reglages, setReglages] = useState<Reglages>(REGLAGES_DEFAUT);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    let annule = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let dejaConnecte = false;

    async function charger() {
      const { data: cat, error } = await supabase
        .from("categories").select("*").eq("slug", slug).single();
      if (annule) return;
      if (error || !cat) {
        setErreur("Catégorie introuvable");
        setChargement(false);
        return;
      }
      setCategorie(cat);

      const { data: reg } = await supabase.from("reglages").select("*").eq("id", 1).maybeSingle();
      if (!annule && reg) setReglages(reg);

      const chargerDanseurs = async () => {
        const { data } = await supabase
          .from("danseurs").select("*")
          .eq("categorie_id", cat.id).order("dossard");
        if (!annule && data) setDanseurs(data);
      };
      await chargerDanseurs();
      if (annule) return;
      setChargement(false);

      channel = supabase
        .channel(`cat-${slug}-${Math.random().toString(36).slice(2)}`)
        // Danseurs : présences et sélections du jury
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "danseurs", filter: `categorie_id=eq.${cat.id}` },
          (payload) => {
            if (payload.eventType === "UPDATE") {
              const maj = payload.new as Danseur;
              setDanseurs((prev) => prev.map((d) => (d.id === maj.id ? maj : d)));
            } else {
              chargerDanseurs();
            }
          }
        )
        // Catégorie modifiée dans l'admin
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "categories", filter: `id=eq.${cat.id}` },
          (payload) => setCategorie(payload.new as Categorie)
        )
        // Réglages des passages modifiés dans l'admin
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "reglages" },
          (payload) => {
            if (payload.new && "lignes" in payload.new) setReglages(payload.new as Reglages);
          }
        )
        .subscribe((status) => {
          if (status !== "SUBSCRIBED") return;
          // Après une coupure réseau : on recharge tout pour rattraper ce qui a changé entre-temps
          if (dejaConnecte) {
            chargerDanseurs();
            supabase.from("categories").select("*").eq("id", cat.id).single()
              .then(({ data }) => { if (!annule && data) setCategorie(data); });
          }
          dejaConnecte = true;
        });
    }

    charger();
    return () => {
      annule = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [slug]);

  // Modifie un danseur (affichage immédiat, puis enregistrement)
  async function modifier(d: Danseur, changements: Partial<Danseur>) {
    setDanseurs((prev) => prev.map((x) => (x.id === d.id ? { ...x, ...changements } : x)));
    const { error } = await supabase.from("danseurs").update(changements).eq("id", d.id);
    if (error) {
      setDanseurs((prev) => prev.map((x) => (x.id === d.id ? d : x)));
      alert("Erreur d'enregistrement, vérifie le réseau et réessaie.");
    }
  }

  // Démarre la catégorie : fige la composition des passages du 1er tour
  async function demarrer() {
    if (!categorie) return false;
    const passages = repartir(actifs(danseurs), nbPassagesAuto(actifs(danseurs).length, reglages));
    for (let i = 0; i < passages.length; i++) {
      const ids = passages[i].map((d) => d.id);
      if (!ids.length) continue;
      const { error } = await supabase.from("danseurs").update({ passage: i + 1 }).in("id", ids);
      if (error) {
        alert("Erreur : " + error.message);
        return false;
      }
    }
    const { error } = await supabase.from("categories").update({ demarree: true }).eq("id", categorie.id);
    if (error) {
      alert("Erreur : " + error.message);
      return false;
    }
    setCategorie({ ...categorie, demarree: true });
    return true;
  }

  return { categorie, danseurs, reglages, chargement, erreur, modifier, demarrer };
}