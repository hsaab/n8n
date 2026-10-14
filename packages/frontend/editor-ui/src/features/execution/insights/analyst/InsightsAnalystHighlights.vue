<script setup lang="ts">
import type { InsightsAnalystHighlight } from '@n8n/api-types';
import { useI18n } from '@n8n/i18n';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

import { VIEWS } from '@/app/constants';
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

function title(highlight: InsightsAnalystHighlight) {
	if (highlight.id === 'impact') return i18n.baseText('insights.analyst.highlight.impact');
	if (highlight.id === 'low-per-run') {
		return i18n.baseText('insights.analyst.highlight.lowPerRun');
	}
	if (highlight.id === 'attention') return i18n.baseText('insights.analyst.highlight.attention');
	return highlight.workflowName;
}

function metricLabel(highlight: InsightsAnalystHighlight) {
	const label = formatAnalystMetric(highlight.metric, highlight.value, units.value, copy.value);
	if (highlight.id === 'low-per-run') {
		return i18n.baseText('insights.analyst.perRun', { interpolate: { label } });
	}
	return label;
}
</script>

<template>
	<section :class="$style.section" data-test-id="insights-analyst-highlights">
		<ul>
			<li v-for="highlight in props.highlights" :key="highlight.id">
				<p :class="$style.kicker">{{ title(highlight) }}</p>
				<p :class="$style.description">{{ highlight.description }}</p>
				<div :class="$style.footer">
					<strong>{{ metricLabel(highlight) }}</strong>
					<RouterLink
						:class="$style.link"
						:to="{ name: VIEWS.WORKFLOW, params: { workflowId: highlight.workflowId } }"
						data-test-id="insights-analyst-open-workflow"
					>
						{{ i18n.baseText('insights.analyst.openWorkflow') }}
					</RouterLink>
				</div>
			</li>
		</ul>
	</section>
</template>

<style lang="scss" module>
@use '@n8n/design-system/css/mixins/breakpoints' as bp;

.section ul {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: var(--spacing--sm);
	margin: 0;
	padding: 0;
	list-style: none;

	@include bp.breakpoint('md-and-down') {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	@include bp.breakpoint('xs-only') {
		grid-template-columns: minmax(0, 1fr);
	}
}

.section li {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--sm);
	min-width: 0;
	padding: var(--spacing--lg);
	border: var(--border);
	border-radius: var(--radius--2xs);
	background: var(--background--surface);
}

.kicker {
	margin: 0;
	color: var(--color--text);
	font-size: var(--font-size--lg);
	font-weight: var(--font-weight--bold);
	line-height: var(--line-height--md);
}

.description {
	margin: 0;
	color: var(--color--text--tint-1);
	font-size: var(--font-size--sm);
}

.footer {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--4xs);
	margin-top: auto;

	strong {
		color: var(--color--text);
		font-size: var(--font-size--sm);
	}
}

.link {
	color: var(--color--primary);
	font-size: var(--font-size--sm);
	text-decoration: none;

	&:hover,
	&:focus-visible {
		text-decoration: underline;
	}
}
</style>
