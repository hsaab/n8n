import type {
	InsightsAnalystChatRequest,
	InsightsAnalystChatResponse,
	InsightsAnalystOverview,
} from '@n8n/api-types';
import {
	InsightsAnalystChatRequestDto,
	insightsAnalystChatResponseSchema,
	insightsAnalystOverviewSchema,
} from '@n8n/api-types';
import type { AuthenticatedRequest } from '@n8n/db';
import { ControllerRegistryMetadata, type Controller } from '@n8n/decorators';
import { Container } from '@n8n/di';
import { mock } from 'jest-mock-extended';
import { DateTime } from 'luxon';

import { InsightsController } from '../insights.controller';
import { InsightsAnalystController } from '../insights-analyst.controller';
import type { InsightsAnalystOverviewService } from '../insights-analyst-overview.service';

type InsightsAnalystChatService = {
	chat: (request: InsightsAnalystChatRequest) => Promise<InsightsAnalystChatResponse>;
};

const chartReadyOverview: InsightsAnalystOverview = {
	summary: {
		total: { deviation: 10, unit: 'count', value: 30 },
		failed: { deviation: 6, unit: 'count', value: 10 },
		failureRate: { deviation: 0.133, unit: 'ratio', value: 0.333 },
		averageRunTime: { deviation: null, unit: 'millisecond', value: 10 },
		timeSaved: { deviation: 5, unit: 'minute', value: 180 },
	},
	byTime: [
		{
			date: '2023-10-01T00:00:00.000Z',
			values: {
				total: 12,
				succeeded: 10,
				failed: 2,
				failureRate: 2 / 12,
				averageRunTime: 10 / 12,
				timeSaved: 18,
			},
		},
		{
			date: '2023-10-02T00:00:00.000Z',
			values: {
				total: 16,
				succeeded: 12,
				failed: 4,
				failureRate: 4 / 16,
				averageRunTime: 10 / 16,
				timeSaved: 24,
			},
		},
	],
	highlights: [
		{
			workflowId: 'insights-demo-ap-invoice-ingestion',
			kind: 'impact',
			workflowName: 'AP invoice ingestion',
			blurb: 'Files invoices from the shared mailbox for approval.',
			metricValue: 8100,
		},
	],
	ranking: [
		{
			rank: 1,
			workflowId: 'insights-demo-ap-invoice-ingestion',
			name: 'AP invoice ingestion',
			department: 'Finance',
			timeSavedMinutes: 8100,
		},
	],
	lowImpact: [
		{
			workflowId: 'insights-demo-standup-digest',
			name: 'Daily standup digest',
			blurb: 'Posts yesterday ticket movement into the team channel.',
			timeSavedPerRunMinutes: 7,
		},
	],
};

const fallbackChatAnswer: InsightsAnalystChatResponse = {
	answer: 'AP invoice ingestion saved the most time this month.',
	citations: [
		{
			workflowId: 'insights-demo-ap-invoice-ingestion',
			label: 'AP invoice ingestion',
			metric: '135 hr',
		},
	],
	mode: 'fallback',
};

function analystRoute(method: 'get' | 'post', path: string) {
	const registry = Container.get(ControllerRegistryMetadata);
	const controllerMeta = registry.getControllerMetadata(InsightsAnalystController as Controller);

	for (const [handlerName, route] of controllerMeta.routes.entries()) {
		const fullPath = `${controllerMeta.basePath}${route.path}`.replaceAll(/\/{2,}/g, '/');
		if (route.method === method && fullPath === path) {
			return { handlerName, route, basePath: controllerMeta.basePath };
		}
	}

	return undefined;
}

function overviewRoute() {
	return analystRoute('get', '/insights/analyst/overview');
}

function chatRoute() {
	return analystRoute('post', '/insights/analyst/chat');
}

function createAnalystController(
	overviewService: InsightsAnalystOverviewService,
	chatService: InsightsAnalystChatService,
) {
	return new (
		InsightsAnalystController as unknown as new (
			overview: InsightsAnalystOverviewService,
			chat: InsightsAnalystChatService,
		) => InsightsAnalystController
	)(overviewService, chatService);
}

describe('InsightsAnalystController', () => {
	const overviewService = mock<InsightsAnalystOverviewService>();
	const chatService = mock<InsightsAnalystChatService>();
	let controller: InsightsAnalystController;

	beforeEach(() => {
		jest.resetAllMocks();
		overviewService.getOverview.mockResolvedValue(chartReadyOverview);
		chatService.chat.mockResolvedValue(fallbackChatAnswer);
		controller = createAnalystController(overviewService, chatService);
	});

	it('exposes GET /insights/analyst/overview on InsightsAnalystController', () => {
		const found = overviewRoute();

		expect(found).toBeDefined();
		expect(found?.route.method).toBe('get');
	});

	it('does not add the analyst overview onto InsightsController', () => {
		const registry = Container.get(ControllerRegistryMetadata);
		const production = registry.getControllerMetadata(InsightsController as Controller);
		const analystPaths = [...production.routes.values()].filter((route) =>
			`${production.basePath}${route.path}`.includes('analyst'),
		);

		expect(analystPaths).toEqual([]);
	});

	it('rejects anonymous callers and users without insights:list', () => {
		// Auth and GlobalScope run as HTTP middleware. Direct method calls do not 401.
		const found = overviewRoute();

		expect(found?.route.skipAuth).toBe(false);
		expect(found?.route.allowUnauthenticated).toBeFalsy();
		expect(found?.route.accessScope).toEqual({ scope: 'insights:list', globalOnly: true });
	});

	it('lets an insights:list user load a 30-day chart-ready overview without a dashboard license', async () => {
		const found = overviewRoute();
		const startDate = DateTime.now().minus({ days: 30 }).toJSDate();
		const endDate = DateTime.now().toJSDate();

		const response = await controller.getOverview(mock<AuthenticatedRequest>(), mock<Response>(), {
			startDate,
			endDate,
		});

		expect(found?.route.licenseFeature).toBeUndefined();
		expect(overviewService.getOverview).toHaveBeenCalled();

		const parsed = insightsAnalystOverviewSchema.safeParse(response);
		// Report the offending field rather than a bare `false`.
		expect(parsed.error?.issues ?? []).toEqual([]);
		expect(parsed.success).toBe(true);
		expect(response.byTime.length).toBeGreaterThan(0);
		expect(response.byTime[0]).toEqual(
			expect.objectContaining({
				date: expect.any(String),
				values: expect.objectContaining({
					total: expect.any(Number),
					succeeded: expect.any(Number),
					failed: expect.any(Number),
					timeSaved: expect.any(Number),
				}),
			}),
		);
		expect(response).toEqual(chartReadyOverview);
	});

	it('exposes POST /insights/analyst/chat even when no Anthropic key is set', () => {
		const found = chatRoute();

		expect(found).toBeDefined();
		expect(found?.route.method).toBe('post');
	});

	it('declares the chat body as a DTO class, so the registry forwards it to the service', () => {
		const found = chatRoute();
		expect(found).toBeDefined();

		const bodyIndex = found!.route.args.findIndex((arg) => arg?.type === 'body');
		expect(bodyIndex).toBeGreaterThan(-1);

		const paramTypes = Reflect.getMetadata(
			'design:paramtypes',
			InsightsAnalystController.prototype,
			found!.handlerName,
		) as Array<{ safeParse?: unknown } | undefined>;

		/**
		 * `controller.registry.ts` pushes a body argument only when its declared type
		 * has `safeParse`. A plain inferred type resolves to Object at runtime, the
		 * argument is skipped, and the handler is called with an undefined body.
		 */
		expect(typeof paramTypes[bodyIndex]?.safeParse).toBe('function');
	});

	it('rejects a chat body with no question rather than passing it through', () => {
		const parsed = InsightsAnalystChatRequestDto.safeParse({ suggestedPromptId: 'time-saved' });

		expect(parsed.success).toBe(false);
	});

	it('does not add the analyst chat route onto InsightsController', () => {
		const registry = Container.get(ControllerRegistryMetadata);
		const production = registry.getControllerMetadata(InsightsController as Controller);
		const chatPaths = [...production.routes.values()].filter((route) =>
			`${production.basePath}${route.path}`.includes('analyst/chat'),
		);

		expect(chatPaths).toEqual([]);
	});

	it('rejects anonymous callers and users without insights:list on chat', () => {
		const found = chatRoute();
		expect(found).toBeDefined();

		expect(found?.route.skipAuth).toBe(false);
		expect(found?.route.allowUnauthenticated).toBeFalsy();
		expect(found?.route.accessScope).toEqual({ scope: 'insights:list', globalOnly: true });
	});

	it('returns a fallback chat answer to an insights:list user without a dashboard license', async () => {
		const found = chatRoute();
		expect(found).toBeDefined();

		const handler = (
			controller as unknown as Record<
				string,
				(
					req: AuthenticatedRequest,
					res: Response,
					body: InsightsAnalystChatRequest,
				) => Promise<InsightsAnalystChatResponse>
			>
		)[found!.handlerName];

		const response = await handler.call(
			controller,
			mock<AuthenticatedRequest>(),
			mock<Response>(),
			{ question: 'Which workflow saved the most time?' },
		);

		expect(found?.route.licenseFeature).toBeUndefined();
		expect(chatService.chat).toHaveBeenCalledWith({
			question: 'Which workflow saved the most time?',
		});
		expect(insightsAnalystChatResponseSchema.safeParse(response).success).toBe(true);
		expect(response.mode).toBe('fallback');
		expect(response).toEqual(fallbackChatAnswer);
	});

	it('returns an llm chat answer that only cites real workflow ids', async () => {
		const found = chatRoute();
		expect(found).toBeDefined();

		const llmAnswer: InsightsAnalystChatResponse = {
			answer: 'AP invoice ingestion saved the most time this month.',
			citations: [
				{
					workflowId: 'insights-demo-ap-invoice-ingestion',
					label: 'AP invoice ingestion',
					metric: '135 hr',
				},
			],
			mode: 'llm',
		};
		chatService.chat.mockResolvedValue(llmAnswer);

		const handler = (
			controller as unknown as Record<
				string,
				(
					req: AuthenticatedRequest,
					res: Response,
					body: InsightsAnalystChatRequest,
				) => Promise<InsightsAnalystChatResponse>
			>
		)[found!.handlerName];

		const response = await handler.call(
			controller,
			mock<AuthenticatedRequest>(),
			mock<Response>(),
			{ question: 'Which workflow saved the most time?' },
		);

		expect(response.mode).toBe('llm');
		expect(response.citations.map((citation) => citation.workflowId)).toEqual([
			'insights-demo-ap-invoice-ingestion',
		]);
		expect(
			response.citations.some(
				(citation) => citation.workflowId === 'invented-workflow-from-the-model',
			),
		).toBe(false);
	});
});
