import { describe, expect, it } from "vitest";
import { distributePrizePool, PrizePoolError } from "@/features/tools/prize-pool/distribution";
import { prizePoolFormSchema, toParsedPrizePool } from "@/features/tools/prize-pool/schema";

/**
 * Documents the engine throw that the runner must catch inline (P15-M1).
 * Engine semantics remain unchanged — over-allocation still throws.
 */
describe("prize over-allocation contract", () => {
  it("throws PrizePoolError when fixed + percent of full exceed total", () => {
    const parsed = prizePoolFormSchema.parse({
      total: "100",
      currency: "INR",
      rows: [
        { position: "1", mode: "fixed", amount: "80", percent: "" },
        { position: "2", mode: "percent", amount: "", percent: "50" },
      ],
    });
    const model = toParsedPrizePool(parsed);
    expect(model).not.toBeNull();
    expect(() => distributePrizePool(model!)).toThrow(PrizePoolError);
    expect(() => distributePrizePool(model!)).toThrow(/exceeds the total prize pool/i);
  });
});
