<script setup lang="ts">
import type { InsightsAnalystRankingRow } from '@n8n/api-types';
import { N8nHeading, N8nText } from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';

defineProps<{
	ranking: InsightsAnalystRankingRow[];
}>();

const i18n = useI18n();
</script>

<template>
	<section :class="$style.section" data-test-id="insights-analyst-ranking">
		<N8nHeading tag="h3" size="medium" bold>
			{{ i18n.baseText('insights.analyst.ranking.title') }}
		</N8nHeading>
		<ol :class="$style.list">
			<li v-for="row in ranking" :key="row.workflowId" :class="$style.row">
				<N8nText bold>{{ row.rank }}</N8nText>
				<N8nText>{{ row.name }}</N8nText>
				<N8nText :class="$style.metric">{{ row.timeSavedLabel }}</N8nText>
			</li>
		</ol>
	</section>
</template>

<style lang="scss" module>
.section {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--sm);
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
	padding: var(--spacing--xs) 0;
	border-bottom: var(--border-width) var(--border-style) var(--color--foreground);
}

.metric {
	margin-left: auto;
}
</style>
