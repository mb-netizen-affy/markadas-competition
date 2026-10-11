// Rôles qui ont une page « par jury » : /espace/jury/1, /espace/preparateur/2, /espace/secretariat/1
export type RoleEspace = "jury" | "preparateur" | "secretariat";

export const LIBELLES: Record<RoleEspace, string> = {
  jury: "Jury",
  preparateur: "Préparateur",
  secretariat: "Secrétariat",
};