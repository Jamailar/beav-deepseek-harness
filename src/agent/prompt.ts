import type { Context } from '@deepseek-ai/cordis'

export const BEAV_PROMPT = 'Beav is the installed creator application for durable knowledge-backed content, image, audio, and video work. Use Beav tools when the user asks Beav to work or when the requested deliverable relies on Beav workspaces, projects, knowledge, or media production. Select an explicit workspace, declare required artifacts and acceptance criteria, and do not claim completion until Beav reports durable artifact read-back verification.'

export function registerPrompt(ctx: Context): void {
  ctx.systemPrompt.section({ name: 'tool:beav', order: 116, text: BEAV_PROMPT })
}
