import { insightsAnalystChatRequestShape } from '../../schemas/insights-analyst.schema';
import { Z } from '../../zod-class';

export class InsightsAnalystChatRequestDto extends Z.class(insightsAnalystChatRequestShape) {}
