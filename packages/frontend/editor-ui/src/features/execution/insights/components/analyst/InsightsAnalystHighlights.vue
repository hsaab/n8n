<script setup lang="ts">
import InsightsAnalystWorkflowLink from '@/features/execution/insights/components/analyst/InsightsAnalystWorkflowLink.vue';
import { formatInsightsTimeSavedLabel } from '@/features/execution/insights/insights.utils';
import type { InsightsAnalystHighlight, InsightsAnalystHighlightKind } from '@n8n/api-types';
import { N8nHeading, N8nText } from '@n8n/design-system';
import { useI18n, type BaseTextKey } from '@n8n/i18n';

defineProps<{
	highlights: InsightsAnalystHighlight[];
}>();

const i18n = useI18n();

const TITLE_KEYS: Record<InsightsAnalystHighlightKind, BaseTextKey> = {
	impact: 'insights.analyst.highlights.impact',
	efficiency: 'insights.analyst.highlights.efficiency',
	attention: 'insights.analyst.highlights.attention',
};

/**
 * `metricValue` carries a different unit per card kind, so each one needs its own
 * wording: total minutes saved, minutes saved per run, or a failed execution count.
 */
const metricLabel = (highlight: InsightsAnalystHighlight) => {
	if (highlight.kind === 'attention') {
		return i18n.baseText('insights.analyst.highlights.attentionMetric', {
			interpolate: { count: String(Math.round(highlight.metricValue)) },
		});
	}

	const timeSaved = formatInsightsTimeSavedLabel(highlight.metricValue);

	return highlight.kind === 'efficiency'
		? i18n.baseText('insights.analyst.perRun', { interpolate: { value: timeSaved } })
		: timeSaved;
};
</script>

<template>
	<section :class="$style.grid" data-test-id="insights-analyst-highlights">
		<article
			v-for="highlight in highlights"
			:key="highlight.kind"
			:class="$style.card"
			:data-test-id="`insights-analyst-highlight-${highlight.kind}`"
		>
			<div :class="$style.header">
				<span :class="[$style.marker, $style[highlight.kind]]" aria-hidden="true">✻</span>
				<N8nHeading tag="h3" size="small" bold>
					{{ i18n.baseText(TITLE_KEYS[highlight.kind]) }}
				</N8nHeading>
			</div>

			<N8nText size="small" color="text-light">{{ highlight.blurb }}</N8nText>

			<div :class="$style.footer">
				<N8nText size="small" bold>{{ metricLabel(highlight) }}</N8nText>
				<InsightsAnalystWorkflowLink :workflow-id="highlight.workflowId" />
			</div>
		</article>
	</section>
</template>

<style lang="scss" module>
/**
 * Three across when the column is wide enough, folding to fewer as the chat rail
 * squeezes it, without needing a viewport breakpoint that ignores the rail.
 */
.grid {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
	gap: var(--spacing--sm);
}

.card {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--sm);
	padding: var(--spacing--lg);
	border: var(--border);
	border-radius: var(--radius--xl);
	background: var(--background--surface);
}

.header {
	display: flex;
	align-items: flex-start;
	gap: var(--spacing--sm);
}

.marker {
	line-height: 1;
}

.impact {
	color: var(--color--primary);
}

.efficiency {
	color: var(--text-color--subtler);
}

.attention {
	color: var(--color--danger);
}

.footer {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--4xs);
	margin-top: auto;
}
</style>
