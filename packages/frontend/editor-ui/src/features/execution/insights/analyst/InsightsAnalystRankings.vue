<script setup lang="ts">
import type { InsightsAnalystWorkflowRow } from '@n8n/api-types';
import { useI18n } from '@n8n/i18n';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';

import { VIEWS } from '@/app/constants';
import { formatInsightsTimeSavedLabel } from '@/features/execution/insights/insights.utils';

const props = defineProps<{
	rows: InsightsAnalystWorkflowRow[];
}>();

const i18n = useI18n();
const units = computed(() => ({
	minutes: i18n.baseText('insights.timeSaved.unit.minutes'),
	hours: i18n.baseText('insights.timeSaved.unit.hours'),
}));

function savedLabel(minutes: number) {
	return i18n.baseText('insights.analyst.saved', {
		interpolate: { label: formatInsightsTimeSavedLabel(minutes, units.value) },
	});
}
</script>

<template>
	<section :class="$style.section" data-test-id="insights-analyst-rankings">
		<h3>{{ i18n.baseText('insights.analyst.rankings') }}</h3>
		<ol>
			<li v-for="(row, index) in props.rows" :key="row.workflowId">
				<span :class="$style.rank">{{ index + 1 }}</span>
				<div :class="$style.name">
					<strong>{{ row.workflowName }}</strong>
					<span>{{ savedLabel(row.timeSaved) }}</span>
				</div>
				<span :class="$style.trend">{{ i18n.baseText('insights.analyst.trend') }}</span>
				<RouterLink
					:class="$style.link"
					:to="{ name: VIEWS.WORKFLOW, params: { workflowId: row.workflowId } }"
				>
					{{ i18n.baseText('insights.analyst.openWorkflow') }}
				</RouterLink>
			</li>
		</ol>
	</section>
</template>

<style lang="scss" module>
@use '@n8n/design-system/css/mixins/breakpoints' as bp;

.section {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--sm);
	padding: var(--spacing--lg);
	border: var(--border);
	border-radius: var(--radius--2xs);
	background: var(--background--surface);

	h3 {
		margin: 0;
		color: var(--color--text);
		font-size: var(--font-size--sm);
		font-weight: var(--font-weight--bold);
	}

	ol {
		display: flex;
		flex-direction: column;
		gap: var(--spacing--xs);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		align-items: center;
		gap: var(--spacing--sm);
		padding: var(--spacing--sm);
		border: var(--border);
		border-radius: var(--radius--2xs);
	}
}

.rank {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex: 0 0 var(--spacing--xl);
	width: var(--spacing--xl);
	height: var(--spacing--xl);
	border-radius: var(--radius--full);
	background: var(--color--background--light-2);
	color: var(--color--text);
	font-size: var(--font-size--sm);
}

.name {
	display: flex;
	flex: 1;
	flex-direction: column;
	gap: var(--spacing--5xs);
	min-width: 0;

	strong {
		color: var(--color--text);
		font-size: var(--font-size--sm);
	}

	span {
		color: var(--color--text--tint-1);
		font-size: var(--font-size--2xs);
	}
}

.trend {
	padding: var(--spacing--5xs) var(--spacing--2xs);
	border-radius: var(--radius--full);
	background: var(--color--background--light-2);
	color: var(--color--text--tint-1);
	font-size: var(--font-size--2xs);
	white-space: nowrap;

	@include bp.breakpoint('md-and-down') {
		display: none;
	}
}

.link {
	flex: 0 0 auto;
	color: var(--color--primary);
	font-size: var(--font-size--sm);
	text-decoration: none;
	white-space: nowrap;

	&:hover,
	&:focus-visible {
		text-decoration: underline;
	}
}
</style>
