import { InsightsDateFilterDto } from '@n8n/api-types';
import { AuthenticatedRequest } from '@n8n/db';
import { Get, GlobalScope, Query, RestController } from '@n8n/decorators';

import { InsightsAnalystOverviewService } from './insights-analyst-overview.service';

@RestController('/insights')
export class InsightsAnalystController {
	constructor(private readonly overviewService: InsightsAnalystOverviewService) {}

	@Get('/analyst/overview')
	@GlobalScope('insights:list')
	async getOverview(
		_req: AuthenticatedRequest,
		_res: Response,
		@Query query: InsightsDateFilterDto = {},
	) {
		return await this.overviewService.getOverview(query);
	}
}
