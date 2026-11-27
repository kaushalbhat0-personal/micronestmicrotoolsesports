import type { ProfileCompletenessMissing } from "@/features/player-profile/server/completeness";

const MISSING_COPY: Record<ProfileCompletenessMissing, string> = {
  handle: "Add a handle.",
  display_name: "Add a display name.",
  avatar_or_bio: "Add an avatar or a bio.",
  game_profile: "Add at least one game profile.",
};

// Derived completeness (D-G1-08 / P15-M2B.1). Same rule as the SQL helper
// player_profile_is_complete. Not a verification or trust badge. Required
// (with explicit consent) before public directory visibility.
export function CompletenessSection({
  complete,
  missing,
}: {
  complete: boolean;
  missing: ProfileCompletenessMissing[];
}) {
  return (
    <section
      aria-labelledby="completeness-heading"
      className="rounded-lg border border-slate-200 bg-white p-5"
    >
      <h2 id="completeness-heading" className="text-lg font-semibold">
        Profile completeness
      </h2>
      <p className="mt-2 text-sm">
        Status: <strong>{complete ? "Complete" : "Incomplete"}</strong>
      </p>
      {complete ? (
        <p className="mt-1 text-sm text-slate-600">
          Required fields are present (handle, display name, avatar or bio, and at least one game
          profile). Completeness is not verification — enable discoverability separately if you
          want to appear in the public directory.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-slate-600">
            Finish these items before you can enable discoverability:
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            {missing.map((item) => (
              <li key={item}>{MISSING_COPY[item]}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
