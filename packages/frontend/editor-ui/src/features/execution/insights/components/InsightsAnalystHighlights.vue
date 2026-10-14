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
const highlights = computed(() => workflowsByTimeSaved(props.workflows).slice(0, 3));
</script>

<template>
	<section :class="$style.highlights" data-test-id="insights-analyst-highlights">
		<h3 :class="$style.title">{{ i18n.baseText('insights.analyst.highlights.title') }}</h3>
		<ul :class="$style.list">
			<li v-for="workflow in highlights" :key="workflow.workflowId ?? workflow.workflowName">
				<strong>{{ workflow.workflowName }}</strong>
				<span>{{ formatAnalystMetricLabel('timeSaved', workflow.timeSaved) }}</span>
			</li>
		</ul>
	</section>
</template>

<style lang="scss" module>
.highlights {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--xs);
}

.title {
	margin: 0;
	color: var(--color--text);
	font-size: var(--font-size--sm);
	font-weight: var(--font-weight--bold);
}

.list {
	display: flex;
	flex-wrap: wrap;
	gap: var(--spacing--xs);
	margin: 0;
	padding: 0;
	list-style: none;

	li {
		display: flex;
		flex-direction: column;
		gap: var(--spacing--4xs);
		min-width: var(--spacing--5xl);
		padding: var(--spacing--xs) var(--spacing--sm);
		border: var(--border);
		border-radius: var(--radius--lg);
		background: var(--background--surface);
		color: var(--color--text);
	}

	span {
		color: var(--color--text--tint-1);
		font-size: var(--font-size--2xs);
	}
}
</style>
