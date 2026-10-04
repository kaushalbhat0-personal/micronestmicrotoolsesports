import { z } from "zod";

export const currencySchema = z.enum(["INR", "USD", "EUR", "GBP"]);

export const placementSchema = z.object({
  label: z.string().min(1).max(40),
  percentage: z.number().finite().min(0).max(100),
});

export const splitInputSchema = z
  .object({
    prizePool: z.number().finite().positive(),
    currency: currencySchema,
    method: z.enum(["percentage", "equal", "ranked", "custom"]),
    placements: z.array(placementSchema).min(1).max(100).optional().default([]),
    equalCount: z.number().int().positive().max(1000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.method === "equal") {
      if (data.equalCount === undefined || data.equalCount === null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["equalCount"], message: "Recipients required for equal split" });
      }
    } else {
      const placements = data.placements ?? [];
      if (placements.length === 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["placements"], message: "At least one placement required" });
        return;
      }
      const total = placements.reduce((a, p) => a + p.percentage, 0);
      if (Math.abs(total - 100) > 0.001) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["placements"], message: `Total must equal 100% (currently ${Number(total.toFixed(2))}%)` });
      }
      const seen = new Set<string>();
      for (let i = 0; i < placements.length; i++) {
        const label = placements[i]?.label.trim().toLowerCase();
        if (label && seen.has(label)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["placements", i, "label"], message: "Duplicate placement label" });
        }
        if (label) seen.add(label);
      }
    }
  });

export type SplitInputValidated = z.infer<typeof splitInputSchema>;
