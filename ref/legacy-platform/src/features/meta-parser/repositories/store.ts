/**
 * Supabase-backed MetaParserStore (service-role writes, public reads).
 *
 * Used exclusively by the authenticated ingestion route. Never imported
 * by client components.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MetaParserStore,
  PatchChangeInsert,
  StoredGameRow,
  StoredPatchRow,
} from "@/features/meta-parser/services/ingest";
import {
  META_PARSER_CONFLICT_CODE,
  isUniqueViolationMessage,
} from "@/features/meta-parser/services/conflict";

function toStoredPatch(row: {
  id: string;
  game_slug: string;
  patch_version: string;
  content_hash: string;
  revision: number;
  upstream_id: number | null;
  status: string;
  parser_version: string | null;
}): StoredPatchRow {
  return {
    id: row.id,
    gameSlug: row.game_slug,
    version: row.patch_version,
    contentHash: row.content_hash,
    revision: row.revision,
    upstreamId: row.upstream_id,
    status: row.status,
    parserVersion: row.parser_version,
  };
}

/** Create the store bound to a service-role client. */
export function createSupabaseMetaParserStore(supabase: SupabaseClient): MetaParserStore {
  return {
    async getGame(slug: string): Promise<StoredGameRow | null> {
      const { data, error } = await supabase
        .from("meta_parser_games")
        .select("slug, adapter_key, is_active")
        .eq("slug", slug)
        .maybeSingle();
      // No row is not an error — but a query failure must surface so the
      // pipeline cannot mistake an outage for an inactive game.
      if (error) throw new Error(`Failed to load game: ${error.message}`);
      if (!data) return null;
      const row = data as { slug: string; adapter_key: string; is_active: boolean };
      return { slug: row.slug, adapterKey: row.adapter_key, isActive: row.is_active };
    },

    async getPatchByVersion(gameSlug: string, version: string): Promise<StoredPatchRow | null> {
      const { data, error } = await supabase
        .from("meta_parser_patches")
        .select("id, game_slug, patch_version, content_hash, revision, upstream_id, status, parser_version")
        .eq("game_slug", gameSlug)
        .eq("patch_version", version)
        .maybeSingle();
      if (error) throw new Error(`Failed to load patch: ${error.message}`);
      if (!data) return null;
      return toStoredPatch(
        data as {
          id: string;
          game_slug: string;
          patch_version: string;
          content_hash: string;
          revision: number;
          upstream_id: number | null;
          status: string;
          parser_version: string | null;
        }
      );
    },

    async getMaxUpstreamId(gameSlug: string): Promise<number | null> {
      const { data, error } = await supabase
        .from("meta_parser_patches")
        .select("upstream_id")
        .eq("game_slug", gameSlug)
        .not("upstream_id", "is", null)
        .order("upstream_id", { ascending: false })
        .limit(1);
      if (error) throw new Error(`Failed to load max upstream id: ${error.message}`);
      if (!data || data.length === 0) return null;
      const first = data[0] as { upstream_id: number | null } | undefined;
      return first?.upstream_id ?? null;
    },

    async insertPatch(input): Promise<StoredPatchRow> {
      const { data, error } = await supabase
        .from("meta_parser_patches")
        .insert({
          game_slug: input.gameSlug,
          patch_version: input.version,
          title: input.title,
          source_url: input.sourceUrl,
          source_published_at: input.sourcePublishedAt,
          content_hash: input.contentHash,
          parser_version: input.parserVersion,
          adapter_version: input.adapterVersion,
          upstream_commit: input.upstreamCommit,
          upstream_id: input.upstreamId,
          // Staging by construction: a new patch is never publicly readable
          // before its complete change set is written and verified. Readers
          // only see `status = 'complete'` rows (see repositories/reads.ts).
          status: "ingested",
        })
        .select("id, game_slug, patch_version, content_hash, revision, upstream_id, status, parser_version")
        .single();
      if (error) {
        // Unique-violation races (concurrent double-ingest) are recoverable:
        // tag them so the pipeline converges instead of failing. The
        // original message is preserved verbatim — a conflict with no row
        // on re-read must still read as the real database error.
        if (isUniqueViolationMessage(error.message)) {
          const tagged = new Error(error.message);
          (tagged as { code?: string }).code = META_PARSER_CONFLICT_CODE;
          throw tagged;
        }
        throw new Error(`Failed to insert patch: ${error.message}`);
      }
      if (!data) throw new Error("Failed to insert patch: unknown");
      return toStoredPatch(
        data as {
          id: string;
          game_slug: string;
          patch_version: string;
          content_hash: string;
          revision: number;
          upstream_id: number | null;
          status: string;
          parser_version: string | null;
        }
      );
    },

    /**
     * Publication: the complete change set is verified, so the real hash,
     * the revision, the current parser version, and the publicly readable
     * state become authoritative together. Never call before
     * replaceAndVerify succeeds.
     */
    async bumpPatchRevision(
      patchId: string,
      contentHash: string,
      revision: number,
      parserVersion: string
    ): Promise<void> {
      const { error } = await supabase
        .from("meta_parser_patches")
        .update({
          content_hash: contentHash,
          revision,
          parser_version: parserVersion,
          status: "complete",
          updated_at: new Date().toISOString(),
        })
        .eq("id", patchId);
      if (error) throw new Error(`Failed to bump patch revision: ${error.message}`);
    },

    /**
     * Staging: demote a published patch before a revision replacement so
     * readers (which filter on `complete`) observe unavailable, never
     * partial. Idempotent — safe to call on an already-staged row.
     */
    async markPatchStaging(patchId: string): Promise<void> {
      const { error } = await supabase
        .from("meta_parser_patches")
        .update({ status: "ingested", updated_at: new Date().toISOString() })
        .eq("id", patchId);
      if (error) throw new Error(`Failed to stage patch: ${error.message}`);
    },

    async replacePatchChanges(patchId: string, changes: readonly PatchChangeInsert[]): Promise<number> {
      const { error: deleteError } = await supabase.from("meta_parser_changes").delete().eq("patch_id", patchId);
      if (deleteError) throw new Error(`Failed to replace patch changes: ${deleteError.message}`);
      if (changes.length === 0) return 0;
      const rows = changes.map((change) => ({
        patch_id: patchId,
        game_slug: change.gameSlug,
        patch_version: change.patchVersion,
        stable_key: change.stableKey,
        entity_type: change.entityType,
        entity_name: change.entityName,
        entity_normalized: change.entityNormalized,
        entity_key: change.entityKey,
        category: change.category,
        attribute: change.attribute,
        old_text: change.oldText,
        new_text: change.newText,
        old_numeric: change.oldNumeric,
        new_numeric: change.newNumeric,
        unit: change.unit,
        change_type: change.changeType,
        confidence: change.confidence,
        description: change.description,
        metadata: change.metadata as Record<string, unknown>,
      }));
      // Chunked inserts keep large patches (LoL/CoD-scale) inside payload limits.
      const CHUNK = 200;
      let inserted = 0;
      for (let offset = 0; offset < rows.length; offset += CHUNK) {
        const { error, count } = await supabase
          .from("meta_parser_changes")
          .insert(rows.slice(offset, offset + CHUNK), { count: "exact" });
        if (error && !isUniqueViolationMessage(error.message)) {
          throw new Error(`Failed to insert patch changes: ${error.message}`);
        }
        inserted += count ?? 0;
      }
      return inserted;
    },

    async countPatchChanges(patchId: string): Promise<number> {
      const { count, error } = await supabase
        .from("meta_parser_changes")
        .select("id", { count: "exact", head: true })
        .eq("patch_id", patchId);
      if (error) throw new Error(`Failed to count patch changes: ${error.message}`);
      return count ?? 0;
    },

    async deletePatch(patchId: string): Promise<void> {
      const { error } = await supabase.from("meta_parser_patches").delete().eq("id", patchId);
      if (error) throw new Error(`Failed to delete patch: ${error.message}`);
    },

    async upsertAliases(gameSlug, aliases): Promise<number> {
      if (aliases.length === 0) return 0;
      const rows = aliases.map((alias) => ({
        game_slug: gameSlug,
        canonical_name: alias.canonical,
        entity_normalized: alias.normalized,
      }));
      const { error } = await supabase
        .from("meta_parser_aliases")
        .upsert(rows, { onConflict: "game_slug,entity_normalized" });
      if (error) throw new Error(`Failed to upsert aliases: ${error.message}`);
      return rows.length;
    },
  };
}


