<script setup lang="ts">
import { formatInsightsTimeSavedLabel } from '@/features/execution/insights/insights.utils';
import type { InsightsAnalystLowImpact } from '@n8n/api-types';
import { N8nHeading, N8nText } from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';

defineProps<{
	lowImpact: InsightsAnalystLowImpact[];
}>();

const i18n = useI18n();

const perRunLabel = (row: InsightsAnalystLowImpact) =>
	i18n.baseText('insights.analyst.perRun', {
		interpolate: { value: formatInsightsTimeSavedLabel(row.timeSavedPerRunMinutes) },
	});
</script>

<template>
	<section :class="$style.section" data-test-id="insights-analyst-low-impact">
		<N8nHeading tag="h3" size="small" bold>
			{{ i18n.baseText('insights.analyst.lowImpact.title') }}
		</N8nHeading>

		<div :class="$style.grid">
			<article v-for="row in lowImpact" :key="row.workflowId" :class="$style.card">
				<N8nHeading tag="h4" size="small" bold>{{ row.name }}</N8nHeading>
				<N8nText size="small" color="text-light">{{ row.blurb }}</N8nText>
				<N8nText size="small" bold>{{ perRunLabel(row) }}</N8nText>
			</article>
		</div>
	</section>
</template>

<style lang="scss" module>
.section {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--sm);
}

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
</style>
