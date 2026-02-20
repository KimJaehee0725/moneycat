export const PASSWORD_MIN_LENGTH = 8;

const PASSWORD_RULES = [
  {
    id: "length",
    label: `${PASSWORD_MIN_LENGTH}자 이상`,
    test: (value: string) => value.length >= PASSWORD_MIN_LENGTH,
  },
  {
    id: "letter",
    label: "영문 포함",
    test: (value: string) => /[A-Za-z]/.test(value),
  },
  {
    id: "number",
    label: "숫자 포함",
    test: (value: string) => /\d/.test(value),
  },
  {
    id: "special",
    label: "특수문자 포함",
    test: (value: string) => /[^A-Za-z0-9]/.test(value),
  },
] as const;

export function getPasswordRuleResults(password: string) {
  return PASSWORD_RULES.map((rule) => ({
    id: rule.id,
    label: rule.label,
    passed: rule.test(password),
  }));
}

export function isPasswordPolicyValid(password: string) {
  return getPasswordRuleResults(password).every((rule) => rule.passed);
}

export const PASSWORD_POLICY_SUMMARY =
  "비밀번호는 8자 이상이며 영문, 숫자, 특수문자를 각각 1개 이상 포함해야 합니다.";
