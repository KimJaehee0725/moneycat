import { describe, expect, it } from "vitest";

import { getPasswordRuleResults, isPasswordPolicyValid } from "@/lib/password-policy";

describe("password policy", () => {
  it("accepts password that satisfies all rules", () => {
    expect(isPasswordPolicyValid("Moneycat!2026")).toBe(true);
  });

  it("rejects password when one of rules fails", () => {
    expect(isPasswordPolicyValid("moneycat2026")).toBe(false);
    expect(isPasswordPolicyValid("Moneycat!")).toBe(false);
    expect(isPasswordPolicyValid("12345678!")).toBe(false);
  });

  it("returns per-rule results", () => {
    const results = getPasswordRuleResults("Abc!1234");
    expect(results.every((result) => result.passed)).toBe(true);
  });
});
