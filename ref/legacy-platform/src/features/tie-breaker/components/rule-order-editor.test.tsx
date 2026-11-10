import * as React from "react";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { RuleOrderEditor } from "./rule-order-editor";

describe("RuleOrderEditor", () => {
  it("renders rules in order with Points first and locked", () => {
    const html = renderToString(<RuleOrderEditor order={["points", "h2h", "map_diff"]} onChange={() => {}} />);
    expect(html).toContain("Points");
    expect(html).toContain("Head-to-head");
    expect(html).toContain("Move Head-to-head up");
    expect(html).toContain("Ranking rules, in order");
    expect(html).toContain("Points always stays first");
  });

  it("explains head-to-head in plain language", () => {
    const html = renderToString(<RuleOrderEditor order={["points", "h2h"]} onChange={() => {}} />);
    expect(html).toContain("still tied");
  });
});
