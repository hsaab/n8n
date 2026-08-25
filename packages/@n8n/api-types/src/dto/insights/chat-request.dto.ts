import { z } from 'zod';

import { Z } from '../../zod-class';

export class InsightsAnalystChatRequestDto extends Z.class({
	question: z.string(),
	suggestedPromptId: z.string().optional(),
}) {}
