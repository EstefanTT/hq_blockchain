// strategies/spread-capture/config.schema.js
// Zod schema for spread-capture strategy configuration.

// import { z } from 'zod';
//
// export const spreadCaptureConfigSchema = z.object({
//   name: z.string(),
//   chain: z.string(),
//   pool: z.string(),
//   tokenIn: z.string(),
//   tokenOut: z.string(),
//   minSpreadPercent: z.number().min(0.01),
//   tradeSize: z.number().positive(),
//   maxSlippagePercent: z.number().min(0).max(10),
//   cooldownMs: z.number().int().positive().default(5000),
// });
