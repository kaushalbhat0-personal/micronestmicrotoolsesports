import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Discover the people, teams, organizations and brands shaping esports",
  description:
    "MicroNest Esports is a discovery and opportunity platform for players, teams, organizations, and brands. Player, team, organization, and brand discovery with recruitment and partnership opportunities.",
};

export default function HomePage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        MicroNest Esports
      </h1>
      <p className="mt-4 max-w-2xl text-base text-slate-600">
        Discover the people, teams, organizations and brands shaping esports.
        Player, team, organization, and brand discovery with recruitment and
        partnership opportunities. News, tournaments, and mini games are
        supporting sections.
      </p>
    </div>
  );
}
