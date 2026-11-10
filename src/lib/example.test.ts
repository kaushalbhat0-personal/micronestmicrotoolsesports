import { describe, expect, it } from "vitest";
import { add } from "./example";

describe("example", () => {
  it("adds two numbers", () => {
    expect(add(2, 3)).toBe(5);
  });
});
