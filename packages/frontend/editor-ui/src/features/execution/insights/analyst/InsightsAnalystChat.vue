<script setup lang="ts">
import type { InsightsAnalystCitation } from '@n8n/api-types';
import { useI18n } from '@n8n/i18n';
import { computed, ref } from 'vue';

import ChatInputBase from '@/features/ai/shared/components/ChatInputBase.vue';
import ChatTypingIndicator from '@/features/ai/chatHub/components/ChatTypingIndicator.vue';
import { formatAnalystMetric } from '@/features/execution/insights/analyst/insights-analyst.format';
import type { AnalystChatMessage } from '@/features/execution/insights/analyst/insights-analyst.store';

const props = defineProps<{
	messages: AnalystChatMessage[];
	pending: boolean;
}>();

const emit = defineEmits<{
	submit: [message: string];
}>();

const i18n = useI18n();
const draft = ref('');

const prompts = computed(() => [
	i18n.baseText('insights.analyst.chat.prompt.timeSaved'),
	i18n.baseText('insights.analyst.chat.prompt.failures'),
	i18n.baseText('insights.analyst.chat.prompt.review'),
]);

const units = computed(() => ({
	minutes: i18n.baseText('insights.timeSaved.unit.minutes'),
	hours: i18n.baseText('insights.timeSaved.unit.hours'),
}));

const copy = computed(() => ({
	total: (count: string) =>
		i18n.baseText('insights.analyst.metric.total', { interpolate: { count } }),
	failed: (count: string) =>
		i18n.baseText('insights.analyst.metric.failed', { interpolate: { count } }),
	failureRate: (rate: string) =>
		i18n.baseText('insights.analyst.metric.failureRate', { interpolate: { rate } }),
	averageRunTime: (seconds: string) =>
		i18n.baseText('insights.analyst.metric.averageRunTime', { interpolate: { seconds } }),
}));

function send(message = draft.value) {
	const trimmed = message.trim();
	if (!trimmed || props.pending) return;
	draft.value = '';
	emit('submit', trimmed);
}

function citationLabel(citation: InsightsAnalystCitation) {
	return formatAnalystMetric(citation.metric, citation.value, units.value, copy.value);
}
</script>

<template>
	<aside :class="$style.rail" data-test-id="insights-analyst-chat">
		<h3>{{ i18n.baseText('insights.analyst.chat.title') }}</h3>
		<div :class="$style.prompts">
			<button
				v-for="prompt in prompts"
				:key="prompt"
				type="button"
				:class="$style.prompt"
				data-test-id="insights-analyst-prompt"
				@click="send(prompt)"
			>
				{{ prompt }}
			</button>
		</div>
		<div :class="$style.thread">
			<div
				v-for="message in props.messages"
				:key="message.id"
				:class="[$style.message, message.role === 'user' ? $style.user : $style.assistant]"
			>
				<p>{{ message.text }}</p>
				<ul v-if="message.response?.citations.length">
					<li
						v-for="citation in message.response.citations"
						:key="citation.workflowId + citation.metric"
					>
						<strong>{{ citation.workflowName }}</strong>
						<span>{{ citationLabel(citation) }}</span>
					</li>
				</ul>
				<small
					v-if="message.response?.mode === 'llm'"
					:class="$style.badge"
					data-test-id="insights-analyst-claude-badge"
				>
					{{ i18n.baseText('insights.analyst.chat.badge') }}
				</small>
			</div>
			<ChatTypingIndicator v-if="props.pending" />
		</div>
		<div :class="$style.input">
			<ChatInputBase
				v-model="draft"
				:is-streaming="false"
				:can-submit="draft.trim().length > 0 && !props.pending"
				:disabled="props.pending"
				:placeholder="i18n.baseText('insights.analyst.chat.placeholder')"
				@submit="send()"
			/>
		</div>
	</aside>
</template>

<style lang="scss" module>
@use '@/features/ai/shared/styles/prompt-suggestion-buttons' as prompts;

.rail {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--sm);
	min-height: 0;
	padding: var(--spacing--sm);
	border: var(--border);
	border-radius: var(--radius--lg);
	background: var(--background--surface);

	h3 {
		margin: 0;
		color: var(--color--text);
		font-size: var(--font-size--sm);
	}
}

.prompts {
	display: flex;
	flex-wrap: wrap;
	gap: var(--spacing--2xs);
}

.prompt {
	@include prompts.prompt-suggestion-button;
}

.thread {
	display: flex;
	flex: 1;
	flex-direction: column;
	gap: var(--spacing--sm);
	overflow: auto;
}

.message {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--2xs);
	max-width: 100%;
	padding: var(--spacing--xs) var(--spacing--sm);
	border-radius: var(--radius--lg);

	p {
		margin: 0;
	}

	ul {
		display: flex;
		flex-direction: column;
		gap: var(--spacing--4xs);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		justify-content: space-between;
		gap: var(--spacing--xs);
		padding: var(--spacing--2xs) var(--spacing--xs);
		border-radius: var(--radius--lg);
		background: var(--color--background);
	}
}

.user {
	align-self: flex-end;
	background: var(--color--primary);
	color: var(--color--text--tint-3);
}

.assistant {
	align-self: flex-start;
	background: var(--color--background);
	color: var(--color--text);
}

.badge {
	color: var(--color--text--tint-1);
	font-size: var(--font-size--2xs);
}

.input {
	position: sticky;
	bottom: 0;
	background: var(--background--surface);
}
</style>
