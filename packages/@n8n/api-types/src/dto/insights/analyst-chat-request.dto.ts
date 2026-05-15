import { Z } from '../../zod-class';
import { insightsAnalystChatRequestSchema } from '../../schemas/insights.schema';

export class InsightsAnalystChatRequestDto extends Z.class(insightsAnalystChatRequestSchema) {}
