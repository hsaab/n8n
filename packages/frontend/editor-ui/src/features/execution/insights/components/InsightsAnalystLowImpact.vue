<script setup lang="ts">
import type { InsightsAnalystWorkflowRow } from '@n8n/api-types';
import { useI18n } from '@n8n/i18n';
import { computed } from 'vue';

import {
	formatAnalystMetricLabel,
	workflowsByTimeSaved,
} from '@/features/execution/insights/insights-analyst.utils';

const props = defineProps<{
	workflows: InsightsAnalystWorkflowRow[];
}>();

const i18n = useI18n();
const lowImpact = computed(() => workflowsByTimeSaved(props.workflows).slice(-3).reverse());
</script>

<template>
	<section data-test-id="insights-analyst-low-impact">
		<h3 :class="$style.title">{{ i18n.baseText('insights.analyst.lowImpact.title') }}</h3>
		<ul :class="$style.grid">
			<li v-for="workflow in lowImpact" :key="workflow.workflowId ?? workflow.workflowName">
				<strong>{{ workflow.workflowName }}</strong>
				<span>{{ formatAnalystMetricLabel('timeSaved', workflow.timeSaved) }}</span>
			</li>
		</ul>
	</section>
</template>

<style lang="scss" module>
.title {
	margin: 0 0 var(--spacing--xs);
	color: var(--color--text);
	font-size: var(--font-size--sm);
	font-weight: var(--font-weight--bold);
}

.grid {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: var(--spacing--xs);
	margin: 0;
	padding: 0;
	list-style: none;

	li {
		display: flex;
		flex-direction: column;
		gap: var(--spacing--4xs);
		padding: var(--spacing--sm);
		border: var(--border);
		border-radius: var(--radius--md);
		background: var(--background--subtle);
		color: var(--color--text);
	}

	span {
		color: var(--color--text--tint-1);
		font-size: var(--font-size--2xs);
	}
}
</style>
