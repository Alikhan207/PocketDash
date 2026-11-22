// Auto-generated from prisma/schema.prisma — canonical Scenario shape.
// The API serializes these exact field names; UI components read them.
// Do not hand-edit — regenerate from the schema instead.

export const SCENARIOSTATUS_VALUES = ['active', 'reset'] as const;
export type ScenarioStatus = 'active' | 'reset';
export type ScenarioStatusValue = ScenarioStatus;

export interface Scenario {
  id: string;
  createdAt: string;
  updatedAt: string;
  shopId: string;
  invoiceId: string;
  status: ScenarioStatus;
  delayDays: number;
  forecastDays: number;
  scenarioExpectedCollectionDate?: string | null;
  baselineMinCash?: string | null;
  scenarioMinCash?: string | null;
  baselineFirstShortageDate?: string | null;
  scenarioFirstShortageDate?: string | null;
  shortageAmount?: string | null;
  suggestedAction?: string | null;
  isBaseline: boolean;
}
