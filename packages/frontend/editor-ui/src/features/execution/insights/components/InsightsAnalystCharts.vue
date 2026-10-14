<script setup lang="ts">
import type { InsightsByTime, InsightsDateRange } from '@n8n/api-types';
import { useI18n } from '@n8n/i18n';
import { defineAsyncComponent } from 'vue';

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

defineProps<{
	data: InsightsByTime[];
	granularity: InsightsDateRange['granularity'];
	startDate: string;
	endDate: string;
}>();

const i18n = useI18n();

const charts = [
	{ type: 'total', titleKey: 'insights.banner.title.total', component: InsightsChartTotal },
	{ type: 'failed', titleKey: 'insights.banner.title.failed', component: InsightsChartFailed },
	{
		type: 'failureRate',
		titleKey: 'insights.banner.title.failureRate',
		component: InsightsChartFailureRate,
	},
	{
		type: 'timeSaved',
		titleKey: 'insights.banner.title.timeSaved',
		component: InsightsChartTimeSaved,
	},
	{
		type: 'averageRunTime',
		titleKey: 'insights.banner.title.averageRunTime',
		component: InsightsChartAverageRuntime,
	},
] as const;
</script>

<template>
	<div :class="$style.grid">
		<section v-for="chart in charts" :key="chart.type" :class="$style.card">
			<h3 :class="$style.title">{{ i18n.baseText(chart.titleKey) }}</h3>
			<div :class="$style.chart">
				<component
					:is="chart.component"
					:data="data"
					:type="chart.type"
					:granularity="granularity"
					:start-date="startDate"
					:end-date="endDate"
				/>
			</div>
		</section>
	</div>
</template>

<style lang="scss" module>
.grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: var(--spacing--sm);
}

.card {
	padding: var(--spacing--sm);
	border: var(--border);
	border-radius: var(--radius--lg);
	background: var(--background--surface);
}

.title {
	margin: 0 0 var(--spacing--xs);
	color: var(--color--text);
	font-size: var(--font-size--2xs);
	font-weight: var(--font-weight--bold);
}

.chart {
	height: var(--spacing--5xl);
}
</style>
