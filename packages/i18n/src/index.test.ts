import { describe, expect, it } from "vitest";
import { get_package_name } from "./index";

describe("get_package_name", () => {
  it("returns the package name", () => {
    expect(get_package_name()).toBe("i18n");
  });
});
