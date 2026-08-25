import type { InsightsAnalystOverview } from '@n8n/api-types';
import { InsightsAnalystChatRequestDto, InsightsDateFilterDto } from '@n8n/api-types';
import { AuthenticatedRequest } from '@n8n/db';
import { Body, Get, GlobalScope, Post, Query, RestController } from '@n8n/decorators';

import { InsightsAnalystChatService } from './insights-analyst-chat.service';
import { InsightsAnalystOverviewService } from './insights-analyst-overview.service';

@RestController('/insights/analyst')
export class InsightsAnalystController {
	constructor(
		private readonly overviewService: InsightsAnalystOverviewService,
		private readonly chatService: InsightsAnalystChatService,
	) {}

	@Get('/overview')
	@GlobalScope('insights:list')
	async getOverview(
		_req: AuthenticatedRequest,
		_res: Response,
		@Query query: InsightsDateFilterDto = {},
	): Promise<InsightsAnalystOverview> {
		return await this.overviewService.getOverview(query);
	}

	@Post('/chat')
	@GlobalScope('insights:list')
	async chat(
		_req: AuthenticatedRequest,
		_res: Response,
		@Body body: InsightsAnalystChatRequestDto,
	) {
		return await this.chatService.chat(body);
	}
}
