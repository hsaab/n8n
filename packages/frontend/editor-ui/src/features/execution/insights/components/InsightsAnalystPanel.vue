<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue';
import { N8nIcon, N8nIconButton, N8nText, N8nTooltip } from '@n8n/design-system';
import { useI18n } from '@n8n/i18n';
import { useRouter } from 'vue-router';
import type { InsightsAnalystChatResponse, InsightsAnalystCitation } from '@n8n/api-types';

import { VIEWS } from '@/app/constants';
import ChatInputBase from '@/features/ai/shared/components/ChatInputBase.vue';
import ChatTypingIndicator from '@/features/ai/chatHub/components/ChatTypingIndicator.vue';

type AnalystMessage = {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	citations?: InsightsAnalystCitation[];
	mode?: InsightsAnalystChatResponse['mode'];
};

const props = defineProps<{
	suggestedPrompts: string[];
	messages: AnalystMessage[];
	isLoading: boolean;
}>();

const emit = defineEmits<{
	ask: [prompt: string];
}>();

const i18n = useI18n();
const router = useRouter();
const prompt = ref('');
const messageListRef = useTemplateRef<HTMLElement>('messageListRef');

const showSuggestedPrompts = computed(() => prompt.value.trim().length === 0 && !props.isLoading);

const lastMessageIsAssistantWaiting = computed(() => {
	const last = props.messages[props.messages.length - 1];
	return props.isLoading && last?.role === 'user';
});

const hasLlmMessage = computed(() => props.messages.some((message) => message.mode === 'llm'));

function ask(promptText: string) {
	const trimmedPrompt = promptText.trim();
	if (!trimmedPrompt || props.isLoading) return;

	emit('ask', trimmedPrompt);
	prompt.value = '';
}

function askCurrentPrompt() {
	ask(prompt.value);
}

function workflowHref(workflowId?: string) {
	if (!workflowId) return undefined;
	return router.resolve({ name: VIEWS.WORKFLOW, params: { workflowId } }).href;
}

watch(
	() => props.messages.length,
	async () => {
		await nextTick();
		const el = messageListRef.value;
		if (!el) return;
		el.scrollTop = el.scrollHeight;
	},
);
</script>

<template>
	<aside :class="$style.panel" data-test-id="insights-analyst-panel">
		<header :class="$style.header">
			<div :class="$style.headerTitle">
				<N8nIcon icon="sparkles" :class="$style.titleIcon" />
				<N8nText tag="p" bold>{{ i18n.baseText('insights.analyst.panel.title') }}</N8nText>
			</div>
			<N8nText tag="p" color="text-base" size="small">
				{{ i18n.baseText('insights.analyst.panel.description') }}
			</N8nText>
			<span v-if="hasLlmMessage" :class="$style.poweredByBadge">
				<N8nIcon icon="sparkles" size="xsmall" />
				{{ i18n.baseText('insights.analyst.panel.poweredBy') }}
			</span>
		</header>

		<div ref="messageListRef" :class="$style.messages" data-test-id="insights-analyst-messages">
			<div
				v-for="message in messages"
				:key="message.id"
				:class="[$style.messageRow, $style[`role-${message.role}`]]"
			>
				<div v-if="message.role === 'assistant'" :class="$style.assistantBubble">
					<N8nText tag="p" size="medium">{{ message.content }}</N8nText>

					<ul v-if="message.citations?.length" :class="$style.citations">
						<li
							v-for="citation in message.citations"
							:key="`${message.id}-${citation.label}-${citation.value}`"
							:class="$style.citationCard"
						>
							<div :class="$style.citationBody">
								<N8nText tag="span" size="xsmall" color="text-light" bold>
									{{ citation.label }}
								</N8nText>
								<N8nText tag="span" size="small" bold>{{ citation.value }}</N8nText>
								<N8nText v-if="citation.description" tag="span" size="small" color="text-base">
									{{ citation.description }}
								</N8nText>
							</div>
							<N8nTooltip
								v-if="citation.workflowId"
								:content="i18n.baseText('insights.analyst.table.openWorkflow')"
							>
								<N8nIconButton
									:href="workflowHref(citation.workflowId)"
									icon="arrow-up-right"
									type="tertiary"
									size="mini"
								/>
							</N8nTooltip>
						</li>
					</ul>
				</div>
				<div v-else :class="$style.userBubble">
					<N8nText tag="p" size="medium">{{ message.content }}</N8nText>
				</div>
			</div>

			<div
				v-if="lastMessageIsAssistantWaiting"
				:class="[$style.messageRow, $style['role-assistant']]"
			>
				<div :class="[$style.assistantBubble, $style.typingBubble]">
					<ChatTypingIndicator />
				</div>
			</div>
		</div>

		<footer :class="$style.footer">
			<div
				v-if="showSuggestedPrompts && suggestedPrompts.length"
				:class="$style.prompts"
				data-test-id="insights-analyst-prompts"
			>
				<button
					v-for="suggestedPrompt in suggestedPrompts"
					:key="suggestedPrompt"
					type="button"
					:class="$style.promptChip"
					@click="ask(suggestedPrompt)"
				>
					{{ suggestedPrompt }}
				</button>
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
		</footer>
	</aside>
</template>

<style lang="scss" module>
@use '@/features/ai/shared/styles/prompt-suggestion-buttons' as prompts;

.panel {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--md);
	padding: var(--spacing--lg);
	border: var(--border);
	border-radius: var(--radius--lg);
	background: var(--background--surface);
	min-height: 100%;
	max-height: calc(100vh - var(--spacing--3xl) * 2);
	position: relative;
	overflow: hidden;
}

.header {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--3xs);
	padding-bottom: var(--spacing--sm);
	border-bottom: var(--border);
}

.headerTitle {
	display: inline-flex;
	align-items: center;
	gap: var(--spacing--3xs);
}

.titleIcon {
	color: var(--color--primary);
}

.poweredByBadge {
	align-self: flex-start;
	display: inline-flex;
	align-items: center;
	gap: var(--spacing--5xs);
	padding: var(--spacing--5xs) var(--spacing--2xs);
	border-radius: var(--radius--full);
	background: var(--color--primary--tint-3);
	color: var(--color--primary--shade-1);
	font-size: var(--font-size--3xs);
	font-weight: var(--font-weight--regular);
}

.messages {
	flex: 1;
	overflow-y: auto;
	min-height: 0;
	display: flex;
	flex-direction: column;
	gap: var(--spacing--md);
	padding: var(--spacing--xs) 0;
}

.messageRow {
	display: flex;
	width: 100%;
}

.role-user {
	justify-content: flex-end;
}

.role-assistant {
	justify-content: flex-start;
}

.userBubble {
	max-width: 85%;
	padding: var(--spacing--xs) var(--spacing--md);
	border-radius: var(--radius--xl);
	background: var(--background--subtle);
	color: var(--color--text);
	border: var(--border);
}

.assistantBubble {
	max-width: 100%;
	display: flex;
	flex-direction: column;
	gap: var(--spacing--xs);
}

.typingBubble {
	color: var(--color--text--tint-1);
	padding-top: var(--spacing--3xs);
}

.citations {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--3xs);
	padding: 0;
	margin: 0;
	list-style: none;
}

.citationCard {
	display: flex;
	gap: var(--spacing--xs);
	padding: var(--spacing--xs) var(--spacing--sm);
	border: var(--border);
	border-radius: var(--radius);
	background: var(--background--subtle);
	align-items: flex-start;
}

.citationBody {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--5xs);
	flex: 1;
	min-width: 0;
}

.footer {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--xs);
	padding-top: var(--spacing--sm);
	border-top: var(--border);
	background: linear-gradient(
		to top,
		var(--background--surface) 70%,
		color-mix(in srgb, var(--background--surface) 0%, transparent)
	);
}

.prompts {
	display: flex;
	flex-wrap: wrap;
	gap: var(--spacing--3xs);
}

.promptChip {
	@include prompts.prompt-suggestion-button;
}
</style>
