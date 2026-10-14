import type {
	INSIGHTS_UNIT_MAPPING,
	INSIGHTS_DEVIATION_UNIT_MAPPING,
} from '@/features/execution/insights/insights.constants';

type InsightsDisplayUnits = typeof INSIGHTS_UNIT_MAPPING;
type InsightsDisplayDeviationUnits = typeof INSIGHTS_DEVIATION_UNIT_MAPPING;

export type InsightsSummaryDisplay = Array<
	{
		[K in keyof InsightsDisplayUnits]: {
			id: K;
			value: number;
			deviation: number | null;
			deviationUnit: ReturnType<InsightsDisplayDeviationUnits[K]>;
			unit: ReturnType<InsightsDisplayUnits[K]>;
			/** Untransformed source value. For time saved this is minutes. */
			rawValue?: number;
			/** Untransformed deviation. For time saved this is minutes. */
			rawDeviation?: number | null;
		};
	}[keyof InsightsDisplayUnits]
>;
