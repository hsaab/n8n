<script setup lang="ts">
import InsightsAnalystWorkflowLink from '@/features/execution/insights/components/analyst/InsightsAnalystWorkflowLink.vue';
import { formatInsightsTimeSavedLabel } from '@/features/execution/insights/insights.utils';
import type { InsightsAnalystRankingRow } from '@n8n/api-types';
import { N8nHeading, N8nText } from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';
import { computed } from 'vue';

const props = defineProps<{
	ranking: InsightsAnalystRankingRow[];
	days: number;
}>();

const i18n = useI18n();

/**
 * The API returns every demo workflow so the chat rail can resolve a citation to any
 * of them, but the design ranks only the top five and the rest reappear below in the
 * lowest time saved per run grid.
 */
const RANKED_ROWS_SHOWN = 5;

const visibleRanking = computed(() => props.ranking.slice(0, RANKED_ROWS_SHOWN));

const workflowLabel = (row: InsightsAnalystRankingRow) =>
	row.department
		? i18n.baseText('insights.analyst.ranking.workflowInDepartment', {
				interpolate: { name: row.name, department: row.department },
			})
		: row.name;

const timeSavedLabel = (row: InsightsAnalystRankingRow) =>
	i18n.baseText('insights.analyst.ranking.timeSaved', {
		interpolate: { value: formatInsightsTimeSavedLabel(row.timeSavedMinutes) },
	});
</script>

<template>
	<section :class="$style.section" data-test-id="insights-analyst-ranking">
		<N8nHeading tag="h3" size="small" bold>
			{{ i18n.baseText('insights.analyst.ranking.title') }}
		</N8nHeading>

		<ol :class="$style.list">
			<li v-for="row in visibleRanking" :key="row.workflowId" :class="$style.row">
				<span :class="$style.rank">
					<N8nText size="small" bold>{{ row.rank }}</N8nText>
				</span>

				<span :class="$style.name">
					<N8nText size="small" bold>{{ workflowLabel(row) }}</N8nText>
					<N8nText size="xsmall" color="text-light">{{ timeSavedLabel(row) }}</N8nText>
				</span>

				<span :class="$style.trend">
					<N8nText size="xsmall" color="text-light">
						{{
							i18n.baseText('insights.analyst.ranking.trend', {
								interpolate: { days: props.days },
							})
						}}
					</N8nText>
				</span>

				<InsightsAnalystWorkflowLink :workflow-id="row.workflowId" />
			</li>
		</ol>
	</section>
</template>

<style lang="scss" module>
/**
 * One padded panel holding the heading and the rows, which is how the design groups
 * this section. Highlights and low impact deliberately sit bare on the page instead.
 */
.section {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--sm);
	padding: var(--spacing--lg);
	border: var(--border);
	border-radius: var(--radius--xl);
	background: var(--background--surface);
}

.list {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--2xs);
	margin: 0;
	padding: 0;
	list-style: none;
}

.row {
	display: flex;
	align-items: center;
	gap: var(--spacing--sm);
	padding: var(--spacing--sm);
	border: var(--border);
	border-radius: var(--radius--lg);
	background: var(--background--surface);
}

.rank {
	display: flex;
	align-items: center;
	justify-content: center;
	flex-shrink: 0;
	width: var(--spacing--xl);
	height: var(--spacing--xl);
	border-radius: var(--radius--full);
	background: var(--background--subtle);
}

.name {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--5xs);
	flex: 1;
	min-width: 0;
}

.trend {
	flex-shrink: 0;
	padding: var(--spacing--4xs) var(--spacing--2xs);
	border-radius: var(--radius--full);
	background: var(--background--subtle);
}
</style>
