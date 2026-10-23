<script setup lang="ts">
import { useI18n } from '@n8n/i18n';
import { N8nIcon } from '@n8n/design-system';

const i18n = useI18n();
</script>

<template>
	<span data-test-id="ndv-masked-value" :class="$style.marker">
		<N8nIcon icon="lock" size="small" />
		<span>{{ i18n.baseText('ndv.output.masked') }}</span>
	</span>
</template>

<style lang="css" module>
.marker {
	display: inline-flex;
	align-items: center;
	gap: var(--spacing--4xs);
	margin-left: var(--spacing--3xs);
	/* N8nTree rows set a negative text-indent that would pull the label over the icon. */
	text-indent: 0;
	font-size: var(--font-size--3xs);
	color: var(--color--text--tint-1);
}
</style>
