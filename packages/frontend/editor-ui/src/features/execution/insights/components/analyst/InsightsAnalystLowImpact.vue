<script setup lang="ts">
import type { InsightsAnalystLowImpact } from '@n8n/api-types';
import { N8nHeading, N8nText } from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';

defineProps<{
	lowImpact: InsightsAnalystLowImpact[];
}>();

const i18n = useI18n();
</script>

<template>
	<section :class="$style.section" data-test-id="insights-analyst-low-impact">
		<N8nHeading tag="h3" size="medium" bold>
			{{ i18n.baseText('insights.analyst.lowImpact.title') }}
		</N8nHeading>
		<ul :class="$style.list">
			<li v-for="row in lowImpact" :key="row.workflowId" :class="$style.card">
				<N8nText bold>{{ row.name }}</N8nText>
				<N8nText size="small" color="text-light">{{ row.blurb }}</N8nText>
				<N8nText>{{ row.timeSavedPerRunLabel }}</N8nText>
			</li>
		</ul>
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
	gap: var(--spacing--xs);
	margin: 0;
	padding: 0;
	list-style: none;
}

.card {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--4xs);
	padding: var(--spacing--sm);
	border: var(--border-width) var(--border-style) var(--color--foreground);
	border-radius: var(--radius--lg);
	background: var(--color--background);
}
</style>
