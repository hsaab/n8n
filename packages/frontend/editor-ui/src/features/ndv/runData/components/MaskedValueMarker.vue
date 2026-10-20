<script setup lang="ts">
import { useI18n } from '@n8n/i18n';
import { N8nIcon, N8nText, N8nTooltip } from '@n8n/design-system';

const i18n = useI18n();
</script>

<template>
	<N8nTooltip :content="i18n.baseText('runData.maskedValue.tooltip')" placement="top">
		<span :class="$style.marker" data-test-id="ndv-masked-value">
			<N8nIcon icon="lock" size="small" color="text-light" />
			<N8nText size="small" color="text-light">
				{{ i18n.baseText('runData.maskedValue') }}
			</N8nText>
		</span>
	</N8nTooltip>
</template>

<style lang="scss" module>
.marker {
	display: inline-flex;
	align-items: center;
	gap: var(--spacing--5xs);
	margin-left: var(--spacing--3xs);
	vertical-align: middle;
}
</style>
