<script setup lang="ts">
import type { InsightsAnalystHighlight } from '@n8n/api-types';
import { useI18n } from '@n8n/i18n';
import { computed } from 'vue';

import { formatAnalystMetric } from '@/features/execution/insights/analyst/insights-analyst.format';

const props = defineProps<{
	highlights: InsightsAnalystHighlight[];
}>();

const i18n = useI18n();

const units = computed(() => ({
	minutes: i18n.baseText('insights.timeSaved.unit.minutes'),
	hours: i18n.baseText('insights.timeSaved.unit.hours'),
}));

const copy = computed(() => ({
	total: (count: string) =>
		i18n.baseText('insights.analyst.metric.total', { interpolate: { count } }),
	failed: (count: string) =>
		i18n.baseText('insights.analyst.metric.failed', { interpolate: { count } }),
	failureRate: (rate: string) =>
		i18n.baseText('insights.analyst.metric.failureRate', { interpolate: { rate } }),
	averageRunTime: (seconds: string) =>
		i18n.baseText('insights.analyst.metric.averageRunTime', { interpolate: { seconds } }),
}));

const titleKey = {
	timeSaved: 'insights.analyst.highlight.timeSaved',
	failureRate: 'insights.analyst.highlight.failureRate',
	total: 'insights.analyst.highlight.total',
	failed: 'insights.analyst.highlight.failureRate',
	averageRunTime: 'insights.analyst.highlight.total',
} as const;

function title(highlight: InsightsAnalystHighlight) {
	return i18n.baseText(titleKey[highlight.metric], {
		interpolate: { name: highlight.workflowName },
	});
}
</script>

<template>
	<section :class="$style.section" data-test-id="insights-analyst-highlights">
		<h3>{{ i18n.baseText('insights.analyst.highlights') }}</h3>
		<ul>
			<li v-for="highlight in props.highlights" :key="highlight.id">
				<strong>{{ title(highlight) }}</strong>
				<span>{{ formatAnalystMetric(highlight.metric, highlight.value, units, copy) }}</span>
			</li>
		</ul>
	</section>
</template>

<style lang="scss" module>
.section {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--xs);

	h3 {
		margin: 0;
		color: var(--color--text);
		font-size: var(--font-size--sm);
	}

	ul {
		display: flex;
		gap: var(--spacing--sm);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		flex: 1;
		flex-direction: column;
		gap: var(--spacing--4xs);
		padding: var(--spacing--sm);
		border: var(--border);
		border-radius: var(--radius--lg);
		background: var(--background--surface);
	}

	strong {
		color: var(--color--text);
		font-weight: var(--font-weight--bold);
	}

	span {
		color: var(--color--text--tint-1);
	}
}
</style>
