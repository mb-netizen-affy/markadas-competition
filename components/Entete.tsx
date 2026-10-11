"use client";

import Link from "next/link";
import { useState } from "react";

// En-tête commun à toutes les pages
// Le logo est lu dans public/logo-markadas.png ; s'il manque, on affiche "MARKADAS" en rouge.
export default function Entete({
  titre,
  sousTitre,
  droite,
  children,
}: {
  titre: string;
  sousTitre?: string;
  droite?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const [logoOk, setLogoOk] = useState(true);

  return (
    <header className="sticky top-0 z-20 border-b border-mk-ligne bg-mk-noir/95 backdrop-blur">
      <div className="mx-auto max-w-5xl space-y-3 p-4">
        <div className="flex items-center gap-3">
          <Link href="/" className="shrink-0" aria-label="Accueil">
            {logoOk ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/logo-markadas.png"
                alt="Markadas"
                className="h-10 w-auto"
                onError={() => setLogoOk(false)}
              />
            ) : (
              <span className="mk-titre text-xl text-mk-rouge">Markadas</span>
            )}
          </Link>
          <div className="min-w-0 flex-1 border-l border-mk-ligne pl-3">
            <h1 className="mk-titre truncate text-xl sm:text-2xl">{titre}</h1>
            {sousTitre && (
              <p className="text-xs font-semibold uppercase tracking-wider text-mk-gris">{sousTitre}</p>
            )}
          </div>
          {droite}
        </div>
        {children}
      </div>
    </header>
  );
}

// Écran de chargement / d'erreur
export function Etat({ texte, erreur = false }: { texte: string; erreur?: boolean }) {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <p className={`font-semibold ${erreur ? "text-mk-rouge" : "text-mk-gris"}`}>{texte}</p>
    </div>
  );
}