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
const ranked = computed(() => workflowsByTimeSaved(props.workflows));
</script>

<template>
	<section data-test-id="insights-analyst-ranking">
		<h3 :class="$style.title">{{ i18n.baseText('insights.analyst.ranking.title') }}</h3>
		<ol :class="$style.list">
			<li v-for="workflow in ranked" :key="workflow.workflowId ?? workflow.workflowName">
				<span>{{ workflow.workflowName }}</span>
				<span>{{ formatAnalystMetricLabel('timeSaved', workflow.timeSaved) }}</span>
				<span>{{ formatAnalystMetricLabel('failureRate', workflow.failureRate) }}</span>
			</li>
		</ol>
	</section>
</template>

<style lang="scss" module>
.title {
	margin: 0 0 var(--spacing--xs);
	color: var(--color--text);
	font-size: var(--font-size--sm);
	font-weight: var(--font-weight--bold);
}

.list {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--4xs);
	margin: 0;
	padding: 0;
	list-style: none;

	li {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto;
		gap: var(--spacing--sm);
		align-items: center;
		padding: var(--spacing--2xs) var(--spacing--xs);
		border-radius: var(--radius--sm);
		background: var(--background--surface);
		color: var(--color--text);
	}
}
</style>
