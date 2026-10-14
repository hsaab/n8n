<script setup lang="ts">
import type { InsightsAnalystWorkflowRow } from '@n8n/api-types';
import { useI18n } from '@n8n/i18n';
import { computed } from 'vue';

import { formatInsightsTimeSavedLabel } from '@/features/execution/insights/insights.utils';

const props = defineProps<{
	rows: InsightsAnalystWorkflowRow[];
}>();

const i18n = useI18n();
const units = computed(() => ({
	minutes: i18n.baseText('insights.timeSaved.unit.minutes'),
	hours: i18n.baseText('insights.timeSaved.unit.hours'),
}));

function perRun(minutes: number) {
	return i18n.baseText('insights.analyst.perRun', {
		interpolate: { label: formatInsightsTimeSavedLabel(minutes, units.value) },
	});
}
</script>

<template>
	<section :class="$style.section" data-test-id="insights-analyst-low-impact">
		<h3>{{ i18n.baseText('insights.analyst.lowImpact') }}</h3>
		<ul>
			<li v-for="row in props.rows" :key="row.workflowId">
				<strong>{{ row.workflowName }}</strong>
				<p>{{ row.description }}</p>
				<span>{{ perRun(row.timeSavedPerExecution) }}</span>
			</li>
		</ul>
	</section>
</template>

<style lang="scss" module>
@use '@n8n/design-system/css/mixins/breakpoints' as bp;

.section {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--sm);

	h3 {
		margin: 0;
		color: var(--color--text);
		font-size: var(--font-size--sm);
		font-weight: var(--font-weight--bold);
	}

	ul {
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

	li {
		display: flex;
		flex-direction: column;
		gap: var(--spacing--sm);
		min-width: 0;
		padding: var(--spacing--lg);
		border: var(--border);
		border-radius: var(--radius--2xs);
		background: var(--background--surface);
	}

	strong {
		color: var(--color--text);
		font-size: var(--font-size--sm);
	}

	p,
	span {
		margin: 0;
		color: var(--color--text--tint-1);
		font-size: var(--font-size--sm);
	}

	span {
		margin-top: auto;
		color: var(--color--text);
		font-weight: var(--font-weight--bold);
	}
}
</style>
