<script setup lang="ts">
import { getLocalTimeZone, today } from '@internationalized/date';
import type { InsightsSummaryType } from '@n8n/api-types';
import { N8nHeading, N8nSpinner } from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';
import { computed, defineAsyncComponent, onMounted, ref, shallowRef, watch } from 'vue';

import InsightsDataRangePicker from '@/features/execution/insights/components/InsightsDataRangePicker.vue';
import InsightsSummaryCards from '@/features/execution/insights/components/InsightsSummary.vue';
import InsightsAnalystChat from '@/features/execution/insights/analyst/InsightsAnalystChat.vue';
import InsightsAnalystHighlights from '@/features/execution/insights/analyst/InsightsAnalystHighlights.vue';
import InsightsAnalystLowImpact from '@/features/execution/insights/analyst/InsightsAnalystLowImpact.vue';
import InsightsAnalystRankings from '@/features/execution/insights/analyst/InsightsAnalystRankings.vue';
import { useInsightsAnalystStore } from '@/features/execution/insights/analyst/insights-analyst.store';
import {
	getAdjustedDateRange,
	getTimeRangeLabels,
	timeRangeMappings,
	transformInsightsSummary,
} from '@/features/execution/insights/insights.utils';

const InsightsChartTotal = defineAsyncComponent(
	async () =>
		await import('@/features/execution/insights/components/charts/InsightsChartTotal.vue'),
);
const InsightsChartFailed = defineAsyncComponent(
	async () =>
		await import('@/features/execution/insights/components/charts/InsightsChartFailed.vue'),
);
const InsightsChartFailureRate = defineAsyncComponent(
	async () =>
		await import('@/features/execution/insights/components/charts/InsightsChartFailureRate.vue'),
);
const InsightsChartTimeSaved = defineAsyncComponent(
	async () =>
		await import('@/features/execution/insights/components/charts/InsightsChartTimeSaved.vue'),
);
const InsightsChartAverageRuntime = defineAsyncComponent(
	async () =>
		await import('@/features/execution/insights/components/charts/InsightsChartAverageRuntime.vue'),
);

const i18n = useI18n();
const store = useInsightsAnalystStore();
const selectedType = ref<InsightsSummaryType>('total');
const maxDate = today(getLocalTimeZone());
const range = shallowRef({
	start: maxDate.copy().subtract({ days: timeRangeMappings.month }),
	end: maxDate.copy(),
});

const timeRangeLabels = getTimeRangeLabels();
const presets = computed(() => [
	{ value: timeRangeMappings.week, label: timeRangeLabels.week },
	{ value: timeRangeMappings['2weeks'], label: timeRangeLabels['2weeks'] },
	{ value: timeRangeMappings.month, label: timeRangeLabels.month },
]);

const chartComponents = {
	total: InsightsChartTotal,
	failed: InsightsChartFailed,
	failureRate: InsightsChartFailureRate,
	timeSaved: InsightsChartTimeSaved,
	averageRunTime: InsightsChartAverageRuntime,
};

const granularity = computed(() => {
	const comparison = range.value.end.compare(range.value.start);
	if (comparison <= 30) return 'day' as const;
	return 'week' as const;
});

const summaryDisplay = computed(() => {
	const current = store.dashboard;
	if (!current) return [];
	return transformInsightsSummary(current.summary).map((item) => {
		if (item.id !== 'timeSaved') return item;
		return {
			...item,
			value: current.summary.timeSaved.value,
			deviation: current.summary.timeSaved.deviation,
		};
	});
});

function load() {
	const { startDate, endDate } = getAdjustedDateRange(range.value);
	void store.load({ startDate, endDate });
}

watch(range, load, { immediate: true });
onMounted(() => {
	document.title = i18n.baseText('insights.analyst.title');
});
</script>

<template>
	<div :class="$style.page" data-test-id="insights-analyst-page">
		<div :class="$style.main">
			<header :class="$style.header">
				<N8nHeading tag="h2" size="xlarge">
					{{ i18n.baseText('insights.analyst.title') }}
				</N8nHeading>
				<InsightsDataRangePicker
					v-model="range"
					:max-value="maxDate"
					:min-value="maxDate.copy().subtract({ days: 60 })"
					:presets
				/>
			</header>
			<div v-if="store.loading && !store.dashboard" :class="$style.loading">
				<N8nSpinner />
				<span>{{ i18n.baseText('insights.analyst.loading') }}</span>
			</div>
			<template v-else-if="store.dashboard">
				<InsightsAnalystHighlights :highlights="store.dashboard.highlights" />
				<InsightsSummaryCards
					link-variant="static"
					time-saved-as-minutes
					:active-id="selectedType"
					:summary="summaryDisplay"
					:start-date="range.start"
					:end-date="range.end"
					:loading="store.loading"
					@select="selectedType = $event"
				/>
				<div :class="$style.chart">
					<component
						:is="chartComponents[selectedType]"
						:type="selectedType"
						:data="store.dashboard.byTime"
						:granularity
						:start-date="range.start.toString()"
						:end-date="range.end.toString()"
					/>
				</div>
				<InsightsAnalystRankings :rows="store.dashboard.rankings" />
				<InsightsAnalystLowImpact :rows="store.dashboard.lowImpact" />
			</template>
		</div>
		<InsightsAnalystChat
			:messages="store.messages"
			:pending="store.chatPending"
			@submit="store.ask($event)"
		/>
	</div>
</template>

<style lang="scss" module>
.page {
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(
			var(--spacing--5xl),
			calc(var(--spacing--5xl) + var(--spacing--4xl))
		);
	gap: var(--spacing--lg);
	height: 100%;
	padding: var(--spacing--lg) var(--spacing--2xl);
	background: var(--color--background);
	overflow: auto;
}

.main {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--md);
	min-width: 0;
}

.header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: var(--spacing--sm);
}

.loading {
	display: flex;
	align-items: center;
	gap: var(--spacing--xs);
	color: var(--color--text--tint-1);
}

.chart {
	padding: var(--spacing--sm);
	border: var(--border);
	border-radius: var(--radius--lg);
	background: var(--background--surface);
}
</style>
