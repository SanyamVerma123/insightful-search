import { createFileRoute } from "@tanstack/react-router";
import { Markdown } from "@/components/chat/Markdown";
export const Route = createFileRoute("/__artifact-test")({ component: T });
const md = "Hello **bold test** and a table:\n\n| A | B |\n| - | - |\n| 1 | 2 |\n\n```mermaid\nflowchart LR\n  A[Revenue] --> B[Profit]\n```\n";
function T() { return <div className="p-8"><Markdown content={md} messageId="t" /></div>; }
