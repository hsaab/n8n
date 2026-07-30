import type { AuthenticatedRequest } from '@n8n/db';
import { mock } from 'jest-mock-extended';

import type { FlushableResponse } from '@/controllers/ai.controller';
import { STREAM_SEPARATOR } from '@/constants';
import { BadRequestError } from '@/errors/response-errors/bad-request.error';

import { InsightsAnalystChatService } from '../insights-analyst-chat.service';
import { InsightsController } from '../insights.controller';
import type { InsightsDemoService } from '../insights-demo.service';
import type { InsightsService } from '../insights.service';

describe('InsightsController analyst chat', () => {
	const insightsService = mock<InsightsService>();
	const insightsDemoService = mock<InsightsDemoService>();
	// Runtime reference via typeof keeps the value import (ts-jest isolatedModules
	// would otherwise erase a type-only InsightsAnalystChatService import).
	const insightsAnalystChatService = mock<InstanceType<typeof InsightsAnalystChatService>>();
	const controller = new InsightsController(
		insightsService,
		insightsDemoService,
		insightsAnalystChatService,
	);

	beforeAll(() => {
		expect(InsightsAnalystChatService).toBeDefined();
	});

	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('askInsightsAnalyst', () => {
		test('rejects empty question at validation boundary', async () => {
			await expect(
				controller.askInsightsAnalyst(
					mock<AuthenticatedRequest>({ body: { question: '' } }),
					mock<Response>(),
				),
			).rejects.toThrow(BadRequestError);

			expect(insightsAnalystChatService.ask).not.toHaveBeenCalled();
		});

		test('rejects whitespace-only question at validation boundary', async () => {
			await expect(
				controller.askInsightsAnalyst(
					mock<AuthenticatedRequest>({ body: { question: '   ' } }),
					mock<Response>(),
				),
			).rejects.toThrow(BadRequestError);

			expect(insightsAnalystChatService.ask).not.toHaveBeenCalled();
		});

		test('returns chat service response for a valid question', async () => {
			const response = {
				mode: 'fallback' as const,
				answer: 'Invoice intake triage saved the most time.',
				citations: [
					{
						workflowId: 'workflow-1',
						workflowName: 'Invoice intake triage',
						metric: 'time saved',
						value: 150,
						unit: 'minute' as const,
					},
				],
			};
			insightsAnalystChatService.ask.mockResolvedValue(response);

			await expect(
				controller.askInsightsAnalyst(
					mock<AuthenticatedRequest>({
						body: { question: 'Which workflows saved us the most time?' },
					}),
					mock<Response>(),
				),
			).resolves.toEqual(response);

			expect(insightsAnalystChatService.ask).toHaveBeenCalledWith(
				'Which workflows saved us the most time?',
			);
		});
	});

	describe('streamInsightsAnalyst', () => {
		test('rejects empty question at validation boundary', async () => {
			const res = mock<FlushableResponse>();

			await expect(
				controller.streamInsightsAnalyst(
					mock<AuthenticatedRequest>({ body: { question: '' } }),
					res,
				),
			).rejects.toThrow(BadRequestError);

			expect(insightsAnalystChatService.askStream).not.toHaveBeenCalled();
		});

		test('writes delta then complete as JSON-lines InsightsAnalystChatStreamChunk events', async () => {
			const completeResponse = {
				mode: 'llm' as const,
				answer: 'Invoice intake triage saved the most time.',
				citations: [
					{
						workflowId: 'workflow-1',
						workflowName: 'Invoice intake triage',
						metric: 'time saved',
						value: 150,
						unit: 'minute' as const,
					},
				],
			};
			const chunks = [
				{ type: 'delta' as const, text: 'Invoice' },
				{ type: 'complete' as const, response: completeResponse },
			];
			insightsAnalystChatService.askStream.mockImplementation(async function* () {
				for (const chunk of chunks) {
					yield chunk;
				}
			});

			const res = mock<FlushableResponse>();
			res.header.mockReturnThis();

			await controller.streamInsightsAnalyst(
				mock<AuthenticatedRequest>({
					body: { question: 'Which workflows saved us the most time?' },
				}),
				res,
			);

			expect(res.header).toHaveBeenCalledWith('Content-type', 'application/json-lines');
			expect(res.write).toHaveBeenCalledWith(JSON.stringify(chunks[0]) + STREAM_SEPARATOR);
			expect(res.write).toHaveBeenCalledWith(JSON.stringify(chunks[1]) + STREAM_SEPARATOR);
			expect(res.end).toHaveBeenCalled();
		});
	});
});
