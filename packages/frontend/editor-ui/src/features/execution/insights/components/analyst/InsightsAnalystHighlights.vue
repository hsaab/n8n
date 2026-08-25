<script setup lang="ts">
import type { InsightsAnalystHighlight } from '@n8n/api-types';
import { N8nHeading, N8nText } from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';

defineProps<{
	highlights: InsightsAnalystHighlight[];
}>();

const i18n = useI18n();
</script>

<template>
	<section :class="$style.section" data-test-id="insights-analyst-highlights">
		<N8nHeading tag="h3" size="medium" bold>
			{{ i18n.baseText('insights.analyst.highlights.title') }}
		</N8nHeading>
		<ul :class="$style.list">
			<li v-for="highlight in highlights" :key="highlight.workflowId" :class="$style.card">
				<N8nText bold>{{ highlight.title }}</N8nText>
				<N8nText size="small" color="text-light">{{ highlight.blurb }}</N8nText>
				<N8nText>{{ highlight.metric }}</N8nText>
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
