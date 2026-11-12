// Tournament publishing form — validation presentation only (P3).
// Fields mirror the strict `tournamentDraftSchema` boundary (identity,
// game, region, format, dates, timezone, fee, prize, organizer, external
// registration, eligibility). The form has NO action and the submit control
// is disabled: no database schema, ownership model, organizer permission,
// or moderation boundary is accepted yet. The notice names the blockers
// instead of faking success. Unrouted foundation: no organizer route ships
// until organizer identity + moderation decisions land (see P3 docs 05/08).

import { BGMI_REGION_VOCABULARY } from "@/features/player-profile/schemas/game";
import { PARTICIPATION_FORMATS } from "@/features/tournaments/domain/tournament";
import { ORGANIZER_KINDS } from "@/features/tournaments/domain/organizer";
import {
  MAX_CONTACT_LENGTH,
  MAX_REGISTRATION_URL_LENGTH,
} from "@/features/tournaments/domain/registration";
import {
  MAX_ELIGIBILITY_NOTE_LENGTH,
  MAX_TOURNAMENT_DESCRIPTION_LENGTH,
  MAX_TOURNAMENT_TITLE_LENGTH,
} from "@/features/tournaments/schemas/tournament";
import { SUPPORTED_GAMES } from "@/lib/game-catalog/catalog";

const fieldClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900";

const labelClass = "text-sm font-medium";

export function TournamentPublishForm() {
  return (
    <div>
      <form aria-label="Publish a tournament" aria-describedby="tournament-publish-boundary" className="grid gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="pub-title" className={labelClass}>
              Tournament title
            </label>
            <input
              id="pub-title"
              name="title"
              type="text"
              autoComplete="off"
              maxLength={MAX_TOURNAMENT_TITLE_LENGTH}
              minLength={2}
              required
              placeholder="e.g. Monsoon Showdown Cup"
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="pub-slug" className={labelClass}>
              Tournament slug
            </label>
            <input
              id="pub-slug"
              name="slug"
              type="text"
              autoComplete="off"
              maxLength={80}
              minLength={2}
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              placeholder="e.g. monsoon-showdown-cup"
              aria-describedby="pub-slug-hint"
              className={fieldClass}
            />
            <p id="pub-slug-hint" className="text-xs text-slate-500">
              Lowercase words joined by hyphens. Permanent after publishing.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="pub-game" className={labelClass}>
              Game
            </label>
            <select id="pub-game" name="gameKey" className={fieldClass} defaultValue="bgmi">
              {SUPPORTED_GAMES.map((game) => (
                <option key={game.key} value={game.key}>
                  {game.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="pub-region" className={labelClass}>
              Region
            </label>
            <select id="pub-region" name="regionCode" className={fieldClass} defaultValue="">
              <option value="" disabled>
                Select a region
              </option>
              {BGMI_REGION_VOCABULARY.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="pub-format" className={labelClass}>
              Participation format
            </label>
            <select id="pub-format" name="format" className={fieldClass} defaultValue="">
              <option value="" disabled>
                Select a format
              </option>
              {PARTICIPATION_FORMATS.map((format) => (
                <option key={format} value={format}>
                  {format}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <label htmlFor="pub-starts" className={labelClass}>
              Starts at
            </label>
            <input id="pub-starts" name="startsAt" type="datetime-local" required className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="pub-ends" className={labelClass}>
              Ends at
            </label>
            <input id="pub-ends" name="endsAt" type="datetime-local" required className={fieldClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="pub-timezone" className={labelClass}>
              Timezone
            </label>
            <input
              id="pub-timezone"
              name="timezone"
              type="text"
              autoComplete="off"
              maxLength={64}
              required
              placeholder="e.g. Asia/Kolkata"
              className={fieldClass}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="pub-description" className={labelClass}>
            Description
          </label>
          <textarea
            id="pub-description"
            name="description"
            rows={4}
            maxLength={MAX_TOURNAMENT_DESCRIPTION_LENGTH}
            placeholder="Rules, structure, schedule highlights…"
            className={fieldClass}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="pub-org-name" className={labelClass}>
              Organizer name
            </label>
            <input
              id="pub-org-name"
              name="organizerName"
              type="text"
              autoComplete="off"
              maxLength={80}
              minLength={2}
              required
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="pub-org-kind" className={labelClass}>
              Organizer kind
            </label>
            <select id="pub-org-kind" name="organizerKind" className={fieldClass} defaultValue="">
              <option value="" disabled>
                Select a kind
              </option>
              {ORGANIZER_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {kind}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              Independent organizers and organizations are both welcome; neither is verified yet.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="pub-reg-url" className={labelClass}>
              Registration URL (https)
            </label>
            <input
              id="pub-reg-url"
              name="registrationUrl"
              type="url"
              autoComplete="off"
              maxLength={MAX_REGISTRATION_URL_LENGTH}
              required
              placeholder="https://…"
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="pub-contact" className={labelClass}>
              Contact instructions <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <input
              id="pub-contact"
              name="contactInstructions"
              type="text"
              autoComplete="off"
              maxLength={MAX_CONTACT_LENGTH}
              className={fieldClass}
            />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="pub-eligibility" className={labelClass}>
            Eligibility note <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <textarea
            id="pub-eligibility"
            name="eligibilityNote"
            rows={2}
            maxLength={MAX_ELIGIBILITY_NOTE_LENGTH}
            className={fieldClass}
          />
        </div>

        <div>
          <button
            type="submit"
            disabled
            aria-disabled="true"
            className="cursor-not-allowed rounded-md bg-slate-300 px-4 py-2 text-sm font-medium text-slate-600"
          >
            Publish tournament (unavailable)
          </button>
        </div>
      </form>

      <p
        id="tournament-publish-boundary"
        role="note"
        className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        Publishing is disabled in this phase: the tournament database schema, organizer
        permissions, and moderation boundary are awaiting decisions. No data is written from
        this form.
      </p>
    </div>
  );
}
