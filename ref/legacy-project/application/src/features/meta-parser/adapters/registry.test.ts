import { describe, expect, it } from "vitest";
import {
  clearAdapterRegistry,
  getAdapter,
  registerAdapter,
  registeredAdapterKeys,
} from "./registry";
import { dota2Adapter } from "./dota-2/adapter";

describe("adapter registry", () => {
  it("resolves the registered dota-2 adapter", () => {
    clearAdapterRegistry();
    registerAdapter(dota2Adapter);
    expect(getAdapter("dota-2")).toBe(dota2Adapter);
    expect(registeredAdapterKeys()).toEqual(["dota-2"]);
    clearAdapterRegistry();
  });

  it("returns undefined for unregistered games (MLBB stays out)", () => {
    clearAdapterRegistry();
    registerAdapter(dota2Adapter);
    expect(getAdapter("mobile-legends")).toBeUndefined();
    expect(getAdapter("mlbb")).toBeUndefined();
    clearAdapterRegistry();
  });
});
