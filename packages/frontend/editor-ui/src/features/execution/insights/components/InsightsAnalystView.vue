<script setup lang="ts">
import { useDocumentTitle } from '@/app/composables/useDocumentTitle';
import InsightsAnalystChatRail from '@/features/execution/insights/components/analyst/InsightsAnalystChatRail.vue';
import InsightsAnalystHighlights from '@/features/execution/insights/components/analyst/InsightsAnalystHighlights.vue';
import InsightsAnalystLowImpact from '@/features/execution/insights/components/analyst/InsightsAnalystLowImpact.vue';
import InsightsAnalystRanking from '@/features/execution/insights/components/analyst/InsightsAnalystRanking.vue';
import InsightsChartTotal from '@/features/execution/insights/components/charts/InsightsChartTotal.vue';
import InsightsDataRangePicker from '@/features/execution/insights/components/InsightsDataRangePicker.vue';
import InsightsSummary from '@/features/execution/insights/components/InsightsSummary.vue';
import { useInsightsAnalystOverview } from '@/features/execution/insights/composables/useInsightsAnalystOverview';
import {
	getAdjustedDateRange,
	getTimeRangeLabels,
	transformInsightsSummary,
} from '@/features/execution/insights/insights.utils';
import type { DateValue } from '@internationalized/date';
import { getLocalTimeZone, today } from '@internationalized/date';
import { N8nHeading, N8nText } from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';
import { computed, onMounted, shallowRef, watch } from 'vue';

const i18n = useI18n();
const { overview, fetchOverview } = useInsightsAnalystOverview();

const maxDate = today(getLocalTimeZone());
const maximumValue = shallowRef(maxDate.copy());
const minimumValue = shallowRef(maxDate.copy().subtract({ days: 30 }));
const range = shallowRef<{ start: DateValue; end: DateValue }>({
	start: maxDate.copy().subtract({ days: 30 }),
	end: maxDate.copy(),
});

const timeRangeLabels = getTimeRangeLabels();
const presets = [
	{ value: 1, label: timeRangeLabels.day },
	{ value: 7, label: timeRangeLabels.week },
	{ value: 14, label: timeRangeLabels['2weeks'] },
	{ value: 30, label: timeRangeLabels.month },
];

const granularity = computed(() => {
	const comparison = range.value.end.compare(range.value.start);
	if (comparison <= 0) return 'hour';
	if (comparison <= 30) return 'day';
	return 'week';
});

const summaryDisplay = computed(() => transformInsightsSummary(overview.value?.summary ?? null));
const chartData = computed(() => overview.value?.byTime ?? []);
const highlights = computed(() => overview.value?.highlights ?? []);
const ranking = computed(() => overview.value?.ranking ?? []);
const rankingTrendDays = computed(() => Math.max(range.value.end.compare(range.value.start), 1));
const lowImpact = computed(() => overview.value?.lowImpact ?? []);

const loadOverview = async () => {
	const { startDate, endDate } = getAdjustedDateRange(range.value);
	await fetchOverview({ startDate, endDate });
};

watch(
	range,
	() => {
		void loadOverview();
	},
	{ immediate: true },
);

onMounted(() => {
	useDocumentTitle().set(i18n.baseText('insights.analyst.heading'));
});
</script>

<template>
	<div :class="$style.page">
		<div :class="$style.container">
			<header :class="$style.title">
				<div :class="$style.titleBlock">
					<N8nHeading bold tag="h2" size="xlarge">
						{{ i18n.baseText('insights.analyst.heading') }}
					</N8nHeading>
					<N8nText size="small" color="text-light">
						{{ i18n.baseText('insights.analyst.subheading') }}
					</N8nText>
				</div>

				<InsightsDataRangePicker
					v-model="range"
					:max-value="maximumValue"
					:min-value="minimumValue"
					:presets
				/>
			</header>

			<InsightsSummary
				:summary="summaryDisplay"
				:start-date="range.start"
				:end-date="range.end"
				link-variant="static"
			/>

			<div :class="$style.layout" data-test-id="insights-analyst-layout">
				<div :class="$style.dashboard" data-test-id="insights-analyst-dashboard">
					<InsightsAnalystHighlights :highlights />

					<div :class="$style.chart">
						<InsightsChartTotal
							type="total"
							:data="chartData"
							:granularity
							:start-date="range.start.toString()"
							:end-date="range.end.toString()"
						/>
					</div>

					<InsightsAnalystRanking :ranking :days="rankingTrendDays" />
					<InsightsAnalystLowImpact :low-impact />
				</div>

				<div :class="$style.railSlot">
					<InsightsAnalystChatRail :ranking />
				</div>
			</div>
		</div>
	</div>
</template>

<style lang="scss" module>
@use '@/app/css/variables' as vars;

$rail-width: 336px;

.page {
	flex: 1;
	display: flex;
	flex-direction: column;
	overflow: auto;
}

.container {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--xl);
	width: 100%;
	padding: var(--spacing--lg) var(--spacing--2xl);
}

.title {
	display: flex;
	flex-wrap: wrap;
	align-items: flex-start;
	justify-content: space-between;
	gap: var(--spacing--lg);
}

.titleBlock {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--4xs);
	min-width: 0;
}

.layout {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--xl);
	width: 100%;
}

.dashboard {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--lg);
	width: 100%;
	min-width: 0;
}

.railSlot {
	width: 100%;
	min-width: 0;
}

.chart {
	padding: var(--spacing--lg);
	border: var(--border);
	border-radius: var(--radius--xl);
	background: var(--background--surface);
}

@media (min-width: vars.$breakpoint-sm) {
	.layout {
		flex-direction: row;
		align-items: flex-start;
	}

	.dashboard {
		flex: 1;
	}

	/* The rail is a fixed column so the dashboard, not the chat, absorbs extra width. */
	.railSlot {
		position: sticky;
		top: var(--spacing--lg);
		flex: 0 0 $rail-width;
		width: $rail-width;
	}
}
</style>
