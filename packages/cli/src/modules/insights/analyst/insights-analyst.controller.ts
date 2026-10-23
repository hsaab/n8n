import { InsightsAnalystChatRequestDto, InsightsAnalystDashboardQueryDto } from '@n8n/api-types';
import { AuthenticatedRequest } from '@n8n/db';
import { Body, Get, GlobalScope, Post, Query, RestController } from '@n8n/decorators';

import { InsightsAnalystService } from './insights-analyst.service';

@RestController('/insights/analyst')
export class InsightsAnalystController {
	constructor(private readonly analystService: InsightsAnalystService) {}

	@Get('/')
	@GlobalScope('insights:list')
	async getDashboard(
		_req: AuthenticatedRequest,
		_res: Response,
		@Query query: InsightsAnalystDashboardQueryDto = {},
	) {
		return await this.analystService.getDashboard(query);
	}

	@Post('/chat')
	@GlobalScope('insights:list')
	async chat(
		_req: AuthenticatedRequest,
		_res: Response,
		@Body body: InsightsAnalystChatRequestDto,
	) {
		return await this.analystService.ask(body.message);
	}
}
