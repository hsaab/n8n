<script setup lang="ts">
import type { InsightsAnalystCitation } from '@n8n/api-types';
import { useI18n } from '@n8n/i18n';
import { computed, ref } from 'vue';

import ChatInputBase from '@/features/ai/shared/components/ChatInputBase.vue';
import ChatTypingIndicator from '@/features/ai/chatHub/components/ChatTypingIndicator.vue';
import {
	emphasizeWorkflowNames,
	formatAnalystMetric,
} from '@/features/execution/insights/analyst/insights-analyst.format';
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

/** Bold cited workflow names inside assistant answers; user messages render as-is. */
function textSegments(message: AnalystChatMessage) {
	if (message.role !== 'assistant') return [{ text: message.text, emphasized: false }];
	const names = message.response?.citations.map((citation) => citation.workflowName) ?? [];
	return emphasizeWorkflowNames(message.text, names);
}
</script>

<template>
	<aside :class="$style.rail" data-test-id="insights-analyst-chat">
		<header>
			<h3>{{ i18n.baseText('insights.analyst.chat.title') }}</h3>
			<p>{{ i18n.baseText('insights.analyst.chat.subtitle') }}</p>
		</header>
		<div :class="$style.thread">
			<p v-if="props.messages.length === 0" :class="$style.welcome">
				{{ i18n.baseText('insights.analyst.chat.welcome') }}
			</p>
			<div
				v-for="message in props.messages"
				:key="message.id"
				:class="[$style.message, message.role === 'user' ? $style.user : $style.assistant]"
			>
				<p :class="$style.text">
					<template v-for="(segment, index) in textSegments(message)" :key="index">
						<strong v-if="segment.emphasized">{{ segment.text }}</strong>
						<template v-else>{{ segment.text }}</template>
					</template>
				</p>
				<div v-if="message.response?.citations.length" :class="$style.citations">
					<p :class="$style.citationsLabel">
						{{ i18n.baseText('insights.analyst.chat.citations') }}
					</p>
					<ul>
						<li
							v-for="citation in message.response.citations"
							:key="citation.workflowId + citation.metric"
						>
							<strong :class="$style.citationName">{{ citation.workflowName }}</strong>
							<strong :class="$style.citationValue">{{ citationLabel(citation) }}</strong>
						</li>
					</ul>
				</div>
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
		<div :class="$style.composer">
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
	min-width: 0;
	border: var(--border);
	border-radius: var(--radius--2xs);
	background: var(--background--surface);

	header {
		display: flex;
		flex-direction: column;
		gap: var(--spacing--4xs);
		padding: var(--spacing--lg);
		border-bottom: var(--border);
	}

	h3,
	header p {
		margin: 0;
	}

	h3 {
		color: var(--color--text);
		font-size: var(--font-size--sm);
		font-weight: var(--font-weight--bold);
	}

	header p {
		color: var(--color--text--tint-1);
		font-size: var(--font-size--sm);
	}
}

.thread {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--sm);
	max-height: calc(var(--spacing--5xl) + var(--spacing--2xl));
	padding: var(--spacing--lg);
	overflow: auto;
}

.welcome {
	margin: 0;
	padding: var(--spacing--sm);
	border-radius: var(--radius--2xs);
	background: var(--color--background--light-2);
	color: var(--color--text--tint-1);
	font-size: var(--font-size--sm);
}

.composer {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--sm);
	padding: var(--spacing--lg);
	border-top: var(--border);
}

.prompts {
	display: flex;
	flex-wrap: wrap;
	gap: var(--spacing--2xs);
}

.prompt {
	@include prompts.prompt-suggestion-button;
}

.message {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--xs);
	max-width: 100%;
	padding: var(--spacing--sm);
	border-radius: var(--radius--2xs);
	font-size: var(--font-size--sm);
	line-height: var(--line-height--xl);
}

.text {
	margin: 0;

	strong {
		color: var(--color--text);
		font-weight: var(--font-weight--bold);
	}
}

.citations {
	display: flex;
	flex-direction: column;
	gap: var(--spacing--3xs);

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
		align-items: baseline;
		justify-content: space-between;
		gap: var(--spacing--xs);
		padding: var(--spacing--2xs) var(--spacing--xs);
		border: var(--border);
		border-radius: var(--radius--2xs);
		background: var(--background--surface);
	}
}

.citationsLabel {
	margin: 0;
	color: var(--color--text--tint-1);
	font-size: var(--font-size--2xs);
	font-weight: var(--font-weight--bold);
	letter-spacing: var(--letter-spacing--wider);
	text-transform: uppercase;
}

.citationName {
	min-width: 0;
	overflow: hidden;
	color: var(--color--text);
	font-weight: var(--font-weight--bold);
	text-overflow: ellipsis;
	white-space: nowrap;
}

.citationValue {
	flex-shrink: 0;
	color: var(--color--primary);
	font-weight: var(--font-weight--bold);
	font-variant-numeric: tabular-nums;
}

.user {
	align-self: flex-end;
	max-width: 85%;
	background: var(--color--background--light-3);
	color: var(--color--text);
	font-weight: var(--font-weight--medium);
}

.assistant {
	align-self: flex-start;
	background: var(--color--background--light-2);
	color: var(--color--text);
}

.badge {
	color: var(--color--text--tint-1);
	font-size: var(--font-size--2xs);
}
</style>
