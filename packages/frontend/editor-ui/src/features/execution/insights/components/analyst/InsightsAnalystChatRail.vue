<script setup lang="ts">
import ChatTypingIndicator from '@/features/ai/chatHub/components/ChatTypingIndicator.vue';
import ChatInputBase from '@/features/ai/shared/components/ChatInputBase.vue';
import { useInsightsAnalystChat } from '@/features/execution/insights/composables/useInsightsAnalystChat';
import type { InsightsAnalystCitation, InsightsAnalystRankingRow } from '@n8n/api-types';
import { N8nHeading, N8nText } from '@n8n/design-system';
import { useI18n, type BaseTextKey } from '@n8n/i18n';
import { computed, ref } from 'vue';

const props = defineProps<{
	ranking: InsightsAnalystRankingRow[];
}>();

const i18n = useI18n();
const { messages, sending, send } = useInsightsAnalystChat();
const draft = ref('');

const suggestedPrompts: Array<{ id: string; labelKey: BaseTextKey }> = [
	{ id: 'time-saved', labelKey: 'insights.analyst.chat.suggestedPrompt.timeSaved' },
	{ id: 'failures', labelKey: 'insights.analyst.chat.suggestedPrompt.failures' },
	{ id: 'ops-review', labelKey: 'insights.analyst.chat.suggestedPrompt.opsReview' },
];

const rankingById = computed(() => new Map(props.ranking.map((row) => [row.workflowId, row])));

const canSubmit = computed(() => draft.value.trim().length > 0 && !sending.value);

function citationName(citation: InsightsAnalystCitation) {
	return rankingById.value.get(citation.workflowId)?.name;
}

function visibleCitations(citations: InsightsAnalystCitation[]) {
	return citations.filter((citation) => rankingById.value.has(citation.workflowId));
}

async function submit(question: string, suggestedPromptId?: string) {
	const nextQuestion = question.trim();
	if (!nextQuestion) {
		return;
	}

	draft.value = '';
	await send(nextQuestion, suggestedPromptId);
}

async function submitDraft() {
	await submit(draft.value);
}

async function submitSuggested(id: string, labelKey: BaseTextKey) {
	await submit(i18n.baseText(labelKey), id);
}
</script>

<template>
	<aside :class="$style.rail" data-test-id="insights-analyst-chat-rail">
		<header :class="$style.header">
			<N8nHeading tag="h3" size="small" bold>
				{{ i18n.baseText('insights.analyst.chat.heading') }}
			</N8nHeading>
			<N8nText size="small" color="text-light">
				{{ i18n.baseText('insights.analyst.chat.description') }}
			</N8nText>
		</header>

		<div :class="$style.messages">
			<div v-if="messages.length === 0" :class="$style.welcome">
				<N8nText size="small">{{ i18n.baseText('insights.analyst.chat.welcome') }}</N8nText>
			</div>

			<template v-for="(message, index) in messages" :key="index">
				<div
					v-if="message.role === 'user'"
					:class="$style.userBubble"
					data-test-id="insights-analyst-chat-user-bubble"
				>
					<N8nText size="small">{{ message.text }}</N8nText>
				</div>
				<div v-else :class="$style.assistant">
					<N8nText>{{ message.answer }}</N8nText>
					<div
						v-for="citation in visibleCitations(message.citations)"
						:key="citation.workflowId"
						:class="$style.citation"
						:data-workflow-id="citation.workflowId"
						data-test-id="insights-analyst-citation"
					>
						<N8nText bold>{{ citationName(citation) }}</N8nText>
						<N8nText size="small" color="text-light">{{ citation.metric }}</N8nText>
					</div>
					<N8nText
						v-if="message.mode === 'llm'"
						size="small"
						color="text-light"
						data-test-id="insights-analyst-powered-by-claude"
					>
						{{ i18n.baseText('insights.analyst.chat.poweredByClaude') }}
					</N8nText>
				</div>
			</template>

			<ChatTypingIndicator v-if="sending" />
		</div>

		<div :class="$style.composer">
			<div :class="$style.pills">
				<button
					v-for="prompt in suggestedPrompts"
					:key="prompt.id"
					type="button"
					:class="$style.pill"
					:disabled="sending"
					:data-test-id="`insights-analyst-suggested-prompt-${prompt.id}`"
					@click="submitSuggested(prompt.id, prompt.labelKey)"
				>
					{{ i18n.baseText(prompt.labelKey) }}
				</button>
			</div>

			<ChatInputBase
				v-model="draft"
				:placeholder="i18n.baseText('insights.analyst.chat.placeholder')"
				:is-streaming="sending"
				:can-submit="canSubmit"
				:disabled="sending"
				:autosize="{ minRows: 2, maxRows: 4 }"
				@submit="submitDraft"
			/>
		</div>
	</aside>
</template>

<style lang="scss" module>
@use '@/app/css/variables' as vars;
@use '@/features/ai/shared/styles/prompt-suggestion-buttons' as suggestions;

$rail-height: 576px;

.rail {
	display: flex;
	flex-direction: column;
	min-height: 0;
	border: var(--border);
	border-radius: var(--radius--xl);
	background: var(--background--surface);
}

.header {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--4xs);
	padding: var(--spacing--lg);
	border-bottom: var(--border);
}

.messages {
	display: flex;
	flex: 1;
	flex-direction: column;
	gap: var(--spacing--sm);
	min-height: 0;
	overflow: auto;
	padding: var(--spacing--lg);
}

.welcome {
	padding: var(--spacing--sm);
	border-radius: var(--radius--xl);
	background: var(--background--subtle);
}

.userBubble {
	align-self: flex-end;
	max-width: 85%;
	padding: var(--spacing--sm);
	border-radius: var(--radius--xl);
	background: var(--background--info);
	text-align: right;
}

.assistant {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--xs);
	align-self: stretch;
}

.citation {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--4xs);
	padding: var(--spacing--sm);
	border: var(--border);
	border-radius: var(--radius--lg);
	background: var(--color--background);
}

.composer {
	position: sticky;
	bottom: 0;
	display: flex;
	flex-direction: column;
	gap: var(--spacing--sm);
	padding: var(--spacing--lg);
	border-top: var(--border);
	background: var(--background--surface);
}

.pills {
	display: flex;
	flex-wrap: wrap;
	gap: var(--spacing--2xs);
}

.pill {
	@include suggestions.prompt-suggestion-button;
}

/**
 * Beside the dashboard the rail is a fixed panel that scrolls its own transcript,
 * so a long conversation cannot stretch the page past the charts. Stacked under the
 * dashboard on a narrow screen it grows with its content instead.
 */
@media (min-width: vars.$breakpoint-sm) {
	.rail {
		height: $rail-height;
		max-height: calc(100vh - var(--spacing--3xl));
	}
}
</style>
