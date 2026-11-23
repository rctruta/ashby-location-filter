/**
 * Type definitions for ashby-location-filter canonical normalization engine.
 */

export type ScopeType = "global" | "country" | "region" | "metro" | "unspecified";

export interface RawLocationInput {
  rawName?: string | null;
  locality?: string | null;
  region?: string | null;
  country?: string | null;
}

export interface CanonicalNormalizedLocation {
  rawName: string;
  canonicalCountry: string | null;
  canonicalRegion: string | null;
  canonicalCity: string | null;
  scope: ScopeType;
  isRemote: boolean;
  displayName: string;
  compoundKey: string;
}

export interface SubdivisionInfo {
  name: string;
  country: string;
}

export declare const COUNTRY_SYNONYMS: Record<string, string>;
export declare const SUBDIVISIONS: Record<string, SubdivisionInfo>;
export declare const METRO_ALIASES: Record<string, string>;
export declare const GLOBAL_SCOPES: Set<string>;

export declare function stripDecorators(str: string): string;
export declare function normalizeCountry(countryStr?: string | null): string | null;
export declare function classifyScope(cityOrRegion?: string | null, country?: string | null): ScopeType;
export declare function normalizeMetro(
  rawName?: string | null,
  locality?: string | null,
  country?: string | null,
  region?: string | null
): string | null;
export declare function normalizeLocation(input: RawLocationInput): CanonicalNormalizedLocation;
export declare function parseAshbySlug(input?: string | null): string | null;
export declare function extractAshbyCandidates(input?: string | null): string[];
