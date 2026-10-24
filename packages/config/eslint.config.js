import eslint_js from "@eslint/js";
import eslint_config_prettier from "eslint-config-prettier";
import react_hooks from "eslint-plugin-react-hooks";
import globals from "globals";
import typescript_eslint from "typescript-eslint";

// Enforces the naming rules in CLAUDE.md: snake_case for values, PascalCase for types.
// Object and type properties are not checked, because libraries use camelCase options.
const naming_convention_rule = [
  "error",
  { selector: "default", format: ["snake_case"], leadingUnderscore: "allow" },
  { selector: "variable", format: ["snake_case", "UPPER_CASE"], leadingUnderscore: "allow" },
  { selector: "variable", modifiers: ["destructured"], format: null },
  { selector: "typeLike", format: ["PascalCase"] },
  { selector: "enumMember", format: ["PascalCase", "UPPER_CASE"] },
  { selector: "import", format: null },
  { selector: ["objectLiteralProperty", "typeProperty", "objectLiteralMethod"], format: null },
];

const ignored_paths = { ignores: ["**/dist/**", "**/coverage/**"] };

const shared_rules = {
  "@typescript-eslint/consistent-type-imports": "error",
  // A leading underscore marks a parameter that must exist but is unused (e.g. Express `_next`).
  "@typescript-eslint/no-unused-vars": [
    "error",
    { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
  ],
};

export const node_config = typescript_eslint.config(
  ignored_paths,
  eslint_js.configs.recommended,
  typescript_eslint.configs.strict,
  {
    languageOptions: { globals: globals.node },
    rules: {
      ...shared_rules,
      "@typescript-eslint/naming-convention": naming_convention_rule,
    },
  },
  eslint_config_prettier,
);

// React components are PascalCase and custom hooks must be camelCase (useSomething),
// because React and the react-hooks rules depend on those names.
export const react_config = typescript_eslint.config(
  ignored_paths,
  eslint_js.configs.recommended,
  typescript_eslint.configs.strict,
  react_hooks.configs.flat.recommended,
  {
    languageOptions: { globals: globals.browser },
    rules: {
      ...shared_rules,
      "@typescript-eslint/naming-convention": [
        ...naming_convention_rule,
        { selector: "function", format: ["snake_case", "PascalCase"] },
        {
          selector: "function",
          filter: { regex: "^use[A-Z]", match: true },
          format: ["camelCase"],
        },
        {
          selector: "variable",
          modifiers: ["const"],
          format: ["snake_case", "UPPER_CASE", "PascalCase"],
        },
        { selector: "variable", modifiers: ["destructured"], format: null },
      ],
    },
  },
  eslint_config_prettier,
);
