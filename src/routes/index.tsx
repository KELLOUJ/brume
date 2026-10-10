import { createFileRoute } from "@tanstack/react-router";
import { BrumeGame } from "@/components/BrumeGame";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <BrumeGame />;
}
