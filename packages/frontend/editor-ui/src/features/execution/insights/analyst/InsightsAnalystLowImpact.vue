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
</script>

<template>
	<section :class="$style.section" data-test-id="insights-analyst-low-impact">
		<h3>{{ i18n.baseText('insights.analyst.lowImpact') }}</h3>
		<ul>
			<li v-for="row in props.rows" :key="row.workflowId">
				<span>{{ row.workflowName }}</span>
				<strong>{{ formatInsightsTimeSavedLabel(row.timeSaved, units) }}</strong>
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
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: var(--spacing--sm);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		flex-direction: column;
		gap: var(--spacing--4xs);
		padding: var(--spacing--sm);
		border: var(--border);
		border-radius: var(--radius--lg);
		background: var(--background--surface);
		color: var(--color--text);
	}
}
</style>
