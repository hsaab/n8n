<script setup lang="ts">
import { useDocumentTitle } from '@/app/composables/useDocumentTitle';
import InsightsAnalystCharts from '@/features/execution/insights/components/InsightsAnalystCharts.vue';
import InsightsAnalystChat from '@/features/execution/insights/components/InsightsAnalystChat.vue';
import InsightsAnalystHighlights from '@/features/execution/insights/components/InsightsAnalystHighlights.vue';
import InsightsAnalystLowImpact from '@/features/execution/insights/components/InsightsAnalystLowImpact.vue';
import InsightsAnalystRanking from '@/features/execution/insights/components/InsightsAnalystRanking.vue';
import InsightsDataRangePicker from '@/features/execution/insights/components/InsightsDataRangePicker.vue';
import InsightsSummary from '@/features/execution/insights/components/InsightsSummary.vue';
import { useInsightsAnalystStore } from '@/features/execution/insights/insights-analyst.store';
import {
	getAdjustedDateRange,
	transformInsightsSummary,
} from '@/features/execution/insights/insights.utils';
import type { DateValue } from '@internationalized/date';
import { getLocalTimeZone, today } from '@internationalized/date';
import type { InsightsDateRange } from '@n8n/api-types';
import { N8nHeading, N8nSpinner } from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';
import { computed, onMounted, shallowRef, watch } from 'vue';

const i18n = useI18n();
const store = useInsightsAnalystStore();

const maxDate = today(getLocalTimeZone());
const range = shallowRef<{ start: DateValue; end: DateValue }>({
	start: maxDate.copy().subtract({ days: 30 }),
	end: maxDate.copy(),
});
const minimumValue = shallowRef(maxDate.copy().subtract({ days: 30 }));
const maximumValue = shallowRef(maxDate.copy());

const presets = computed(() => [
	{
		value: 1,
		label: i18n.baseText('insights.lastNHours', { interpolate: { count: 24 } }),
	},
	{
		value: 7,
		label: i18n.baseText('insights.lastNDays', { interpolate: { count: 7 } }),
	},
	{
		value: 30,
		label: i18n.baseText('insights.lastNDays', { interpolate: { count: 30 } }),
	},
]);

const filteredRange = computed(() => getAdjustedDateRange(range.value));

const granularity = computed<InsightsDateRange['granularity']>(() => {
	const comparison = range.value.end.compare(range.value.start);
	if (comparison <= 1) return 'hour';
	if (comparison <= 30) return 'day';
	return 'week';
});

const summary = computed(() => transformInsightsSummary(store.dashboard?.summary ?? null));
const workflows = computed(() => store.dashboard?.workflows ?? []);
const chartData = computed(() => store.dashboard?.byTime ?? []);

watch(
	range,
	() => {
		void store.loadDashboard(filteredRange.value);
	},
	{ immediate: true },
);

function onSend(message: string) {
	void store.sendMessage(message, filteredRange.value);
}

onMounted(() => {
	useDocumentTitle().set(i18n.baseText('insights.analyst.title'));
});
</script>

<template>
	<div :class="$style.page" data-test-id="insights-analyst">
		<div :class="$style.main">
			<div :class="$style.toolbar">
				<N8nHeading bold tag="h2" size="xlarge">
					{{ i18n.baseText('insights.analyst.title') }}
				</N8nHeading>
				<InsightsDataRangePicker
					v-model="range"
					:max-value="maximumValue"
					:min-value="minimumValue"
					:presets="presets"
				/>
			</div>
			<N8nSpinner v-if="store.loading && !store.dashboard" />
			<template v-else>
				<InsightsSummary
					link-variant="static"
					:summary="summary"
					:start-date="range.start"
					:end-date="range.end"
					:loading="store.loading"
				/>
				<InsightsAnalystHighlights :workflows="workflows" />
				<InsightsAnalystCharts
					:data="chartData"
					:granularity="granularity"
					:start-date="filteredRange.startDate.toISOString()"
					:end-date="filteredRange.endDate.toISOString()"
				/>
				<InsightsAnalystRanking :workflows="workflows" />
				<InsightsAnalystLowImpact :workflows="workflows" />
			</template>
		</div>
		<InsightsAnalystChat :messages="store.messages" :pending="store.chatPending" @send="onSend" />
	</div>
</template>

<style lang="scss" module>
.page {
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(
			var(--spacing--5xl),
			calc(var(--spacing--5xl) + var(--spacing--4xl))
		);
	gap: var(--spacing--md);
	align-items: start;
	padding: var(--spacing--lg) var(--spacing--2xl);
}

.main {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--md);
	min-width: 0;
}

.toolbar {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: var(--spacing--sm);
}
</style>
