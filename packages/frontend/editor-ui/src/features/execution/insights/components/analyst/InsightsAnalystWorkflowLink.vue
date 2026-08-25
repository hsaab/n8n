<script setup lang="ts">
import { VIEWS } from '@/app/constants';
import { useI18n } from '@n8n/i18n';
import { computed } from 'vue';

const props = defineProps<{
	workflowId: string;
}>();

const i18n = useI18n();

const to = computed(() => ({
	name: VIEWS.WORKFLOW,
	params: { workflowId: props.workflowId },
}));
</script>

<template>
	<RouterLink :to="to" :class="$style.link" data-test-id="insights-analyst-workflow-link">
		{{ i18n.baseText('insights.analyst.openWorkflow') }}
	</RouterLink>
</template>

<style lang="scss" module>
.link {
	color: var(--color--primary);
	font-size: var(--font-size--sm);
	text-decoration: none;

	&:hover {
		text-decoration: underline;
	}
}
</style>
