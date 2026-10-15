import type { Categorie, Danseur } from "./supabase";
import { actifs, fmt, lettre } from "./competition";

// Feuilles de résultats à imprimer (et afficher) pendant la compétition.
// L'Or et l'Argent sont annoncés sur la piste : ils ne sont pas imprimés.
export type TypeImpression = "premier-tour" | "demi-finale";

const echapper = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

type Style = "finale" | "demi" | "bronze";

const ETIQUETTES: Record<Style, string> = {
  finale: "★ FINALE",
  demi: "↻ DEMI-FINALE",
  bronze: "● BRONZE",
};

// Tout tient sur une seule feuille A3 : un bloc par liste (finale / demi-finale / bronze),
// chaque carte porte aussi son statut pour qu'on sache où va le danseur, même de loin.
function bloc(style: Style, titreListe: string, explication: string, liste: Danseur[]) {
  const cartes = liste
    .map(
      (d) => `
      <div class="carte ${style}">
        <div class="statut">${ETIQUETTES[style]}</div>
        <div class="dossard">${fmt(d.dossard)}</div>
        <div class="nom">${echapper(d.nom)}</div>
        <div class="prenom">${echapper(d.prenom)}</div>
      </div>`
    )
    .join("");
  return `
  <section class="${style}">
    <div class="titre-bloc">
      <h2>${titreListe}</h2>
      <p>${explication}</p>
    </div>
    <div class="grille">${cartes || '<p class="vide">Aucun danseur</p>'}</div>
  </section>`;
}

export function imprimerResultats(type: TypeImpression, categorie: Categorie, danseurs: Danseur[]) {
  const presents = actifs(danseurs); // déjà triés par dossard
  const heure = new Date().toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
  const jury = lettre(categorie.jury);
  let titre: string;
  let contenu: string;

  if (type === "premier-tour") {
    const finale = presents.filter((d) => d.qualif_t1);
    const demi = presents.filter((d) => !d.qualif_t1);
    titre = "Résultats du 1er tour";
    contenu =
      bloc("finale", "★ Qualifiés pour la finale","", finale) +
      bloc("demi", "↻ Demi-finale","", demi);
  } else {
    const demi = presents.filter((d) => !d.qualif_t1);
    const finale = demi.filter((d) => d.qualif_rep);
    const bronze = demi.filter((d) => !d.qualif_rep);
    titre = "Résultats de la demi-finale";
    contenu =
      bloc("finale", "★ Qualifiés pour la finale", "", finale) +
      bloc("bronze", "● Médaille de bronze", "", bronze);
  }

  // Les couleurs de fond ne sont pas toujours imprimées (option « graphiques d'arrière-plan ») :
  // tout est lisible en noir sur blanc ; la couleur passe surtout par les bordures.
  const html = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<title>${echapper(categorie.nom)} – ${titre}</title>
<style>
  @page { size: A3 landscape; margin: 10mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  html, body { margin: 0; }
  body { font-family: "Open Sans", Arial, sans-serif; color: #111; }
  /* Zone imprimable d'un A3 paysage (400 × 277 mm) : le contenu est réduit pour tenir sur une page */
  #page { width: 400mm; }

  header { display: flex; justify-content: space-between; align-items: center; gap: 24px;
           border-bottom: 8px solid #e53935; padding-bottom: 10px; margin-bottom: 14px; }
  .marque { color: #e53935; font-weight: 800; letter-spacing: .08em; font-size: 16px; }
  h1 { margin: 2px 0 0; font-size: 50px; line-height: 1.05; text-transform: uppercase; font-weight: 900; }
  .tour { text-align: center; border: 6px solid #111; border-radius: 14px; padding: 8px 24px; white-space: nowrap;
          font-size: 36px; font-weight: 900; text-transform: uppercase; }
  .tour small { display: block; font-size: 15px; font-weight: 600; color: #444; text-transform: none; }

  section { border: 4px solid #111; border-radius: 14px; padding: 10px 12px 12px; margin-bottom: 14px; }
  section.finale { border-color: #e53935; }
  section.demi { border-style: dashed; }
  section.bronze { border-color: #b8722c; }
  .titre-bloc { display: flex; align-items: baseline; gap: 18px; margin-bottom: 10px; }
  h2 { margin: 0; font-size: 38px; text-transform: uppercase; font-weight: 900; }
  .finale h2 { color: #c62828; }
  .bronze h2 { color: #8a5320; }
  .titre-bloc p { margin: 0; font-size: 20px; font-weight: 700; color: #333; }

  .grille { display: grid; grid-template-columns: repeat(auto-fill, minmax(138px, 1fr)); gap: 7px; }
  .carte { border: 3px solid #111; border-radius: 10px; overflow: hidden; break-inside: avoid; }
  .carte.demi { border-style: dashed; }
  .carte.finale { border-color: #e53935; }
  .carte.bronze { border-color: #b8722c; }
  .statut { font-size: 12px; font-weight: 900; letter-spacing: .05em; padding: 2px 7px;
            border-bottom: 2px solid currentColor; }
  .finale .statut { background: #fde3e2; color: #b71c1c; }
  .demi .statut { background: #eee; color: #222; }
  .bronze .statut { background: #f6e3cf; color: #7a4a17; }
  .dossard { font-size: 42px; font-weight: 900; line-height: 1; padding: 5px 7px 0; }
  .nom { font-size: 13px; font-weight: 800; text-transform: uppercase; padding: 2px 7px 0;
         white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .prenom { font-size: 12px; color: #444; padding: 0 7px 5px;
            white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .vide { color: #777; font-style: italic; grid-column: 1 / -1; font-size: 20px; margin: 0; }

  .action { position: fixed; top: 10px; right: 10px; z-index: 2; }
  .action button { font-size: 14px; padding: 8px 14px; background: #e53935; color: #fff;
                   border: 0; border-radius: 6px; cursor: pointer; }
  @media print { .action { display: none; } }
</style>
</head>
<body>
  <div class="action"><button onclick="window.print()">🖨 Imprimer</button></div>
  <div id="page">
    <header>
      <div>
        <div class="marque">MARKADAS · COMPÉTITION · JURY ${jury} · PISTE ${jury}</div>
        <h1>${echapper(categorie.nom)}</h1>
      </div>
      <div class="tour">${titre}<small>Cherchez votre dossard</small></div>
    </header>
    ${contenu}
  </div>
  <script>
    // Réduit l'ensemble pour qu'il tienne sur UNE page A3 paysage, quelle que soit la taille de la catégorie
    function ajuster() {
      var page = document.getElementById("page");
      page.style.zoom = "1";
      page.style.width = "400mm";
      var mm = page.offsetWidth / 400;            // pixels par millimètre
      var hauteurMax = 277 * mm - 6;              // hauteur imprimable d'un A3 paysage
      // Hauteur finale pour une échelle donnée : la page est élargie (plus de colonnes) puis réduite
      function hauteur(e) { page.style.width = (400 / e) + "mm"; return page.offsetHeight * e; }
      var echelle = 1;
      if (hauteur(1) > hauteurMax) {
        // Recherche de la plus grande échelle qui tient sur une page
        var bas = 0.15, haut = 1;
        for (var i = 0; i < 14; i++) {
          var milieu = (bas + haut) / 2;
          if (hauteur(milieu) <= hauteurMax) bas = milieu; else haut = milieu;
        }
        echelle = bas;
      }
      page.style.width = (400 / echelle) + "mm";
      page.style.zoom = String(echelle);          // « zoom » réduit vraiment la mise en page (pagination comprise)
    }
    window.onload = function () { ajuster(); setTimeout(function () { window.print(); }, 300); };
  </script>
</body>
</html>`;

  const fenetre = window.open("", "_blank");
  if (!fenetre) {
    alert("Le navigateur a bloqué la fenêtre d'impression. Autorise les fenêtres pop-up pour ce site, puis réessaie.");
    return;
  }
  fenetre.document.open();
  fenetre.document.write(html);
  fenetre.document.close();
}