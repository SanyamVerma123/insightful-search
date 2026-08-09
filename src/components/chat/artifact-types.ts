export type Artifact = {
  id: string;
  kind: "mermaid" | "code" | "html" | "table";
  title: string;
  language: string;
  content: string;
};

export function artifactTitle(kind: Artifact["kind"], language: string) {
  if (kind === "mermaid") return "Diagram";
  if (kind === "html") return "HTML preview";
  if (kind === "table") return "Table";
  return language ? `${language.toUpperCase()} snippet` : "Snippet";
}
