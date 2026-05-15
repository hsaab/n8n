<script setup lang="ts">
import { ref } from 'vue';
import { N8nButton, N8nText } from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';
import type { InsightsAnalystCitation } from '@n8n/api-types';

import ChatInputBase from '@/features/ai/shared/components/ChatInputBase.vue';

export type AnalystMessage = {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	citations?: InsightsAnalystCitation[];
};

defineProps<{
	suggestedPrompts: string[];
	messages: AnalystMessage[];
	isLoading: boolean;
}>();

const emit = defineEmits<{
	ask: [prompt: string];
}>();

const i18n = useI18n();
const prompt = ref('');

function ask(promptText: string) {
	const trimmedPrompt = promptText.trim();
	if (!trimmedPrompt) return;

	emit('ask', trimmedPrompt);
	prompt.value = '';
}

function askCurrentPrompt() {
	ask(prompt.value);
}
</script>

<template>
	<aside :class="$style.panel" data-test-id="insights-analyst-panel">
		<header :class="$style.header">
			<N8nText tag="p" bold>{{ i18n.baseText('insights.analyst.panel.title') }}</N8nText>
			<N8nText tag="p" color="text-base" size="small">
				{{ i18n.baseText('insights.analyst.panel.description') }}
			</N8nText>
		</header>

		<div :class="$style.prompts">
			<N8nButton
				v-for="suggestedPrompt in suggestedPrompts"
				:key="suggestedPrompt"
				variant="subtle"
				size="small"
				:disabled="isLoading"
				@click="ask(suggestedPrompt)"
			>
				{{ suggestedPrompt }}
			</N8nButton>
		</div>

		<div :class="$style.messages">
			<div
				v-for="message in messages"
				:key="message.id"
				:class="[$style.message, message.role === 'assistant' ? $style.assistant : $style.user]"
			>
				<N8nText tag="p" size="small" color="text-light" bold>
					{{
						message.role === 'assistant'
							? i18n.baseText('insights.analyst.panel.assistant')
							: i18n.baseText('insights.analyst.panel.you')
					}}
				</N8nText>
				<N8nText tag="p">{{ message.content }}</N8nText>

				<ul v-if="message.citations?.length" :class="$style.citations">
					<li v-for="citation in message.citations" :key="`${message.id}-${citation.label}`">
						<N8nText tag="span" size="small" bold>{{ citation.label }}:</N8nText>
						<N8nText tag="span" size="small">{{ citation.value }}</N8nText>
						<N8nText v-if="citation.description" tag="p" size="small" color="text-base">
							{{ citation.description }}
						</N8nText>
					</li>
				</ul>
			</div>
		</div>

		<ChatInputBase
			v-model="prompt"
			:placeholder="i18n.baseText('insights.analyst.panel.placeholder')"
			:is-streaming="isLoading"
			:can-submit="prompt.trim().length > 0 && !isLoading"
			:disabled="isLoading"
			:show-voice="false"
			:show-attach="false"
			@submit="askCurrentPrompt"
		/>
	</aside>
</template>

<style lang="scss" module>
.panel {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--md);
	padding: var(--spacing--lg);
	border: var(--border);
	border-radius: var(--radius--lg);
	background: var(--background--surface);
	min-height: 100%;
}

.header,
.messages {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--xs);
}

.prompts {
	display: flex;
	flex-wrap: wrap;
	gap: var(--spacing--xs);
}

.messages {
	flex: 1;
	overflow: auto;
	min-height: 0;
}

.message {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--xs);
	padding: var(--spacing--md);
	border-radius: var(--radius);
}

.assistant {
	background: var(--background--base);
}

.user {
	background: var(--color--primary--tint-3);
}

.citations {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--xs);
	padding: var(--spacing--sm);
	margin: 0;
	border-radius: var(--radius);
	background: var(--background--surface);
	list-style: none;
}
</style>
