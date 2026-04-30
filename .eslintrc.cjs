module.exports = {
    root: true,
    env: {
        browser: true,
        es6: true,
        node: true,
    },
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:@typescript-eslint/recommended-requiring-type-checking",
        "plugin:import/errors",
        "plugin:import/typescript",
        "plugin:node/recommended",
        "plugin:compat/recommended"
    ],
    parser: "@typescript-eslint/parser",
    parserOptions: {
        tsconfigRootDir: __dirname,
        project: ["./tsconfig.json"],
        ecmaVersion: 6,
        sourceType: "module",
        warnOnUnsupportedTypeScriptVersion: false,
    },
    plugins: ["@typescript-eslint", "deprecation", "ie11"],
    rules: {
        // does not handle return types being annotated in a type comment
        "@typescript-eslint/explicit-function-return-type": "off",
        "@typescript-eslint/explicit-module-boundary-types": "off",

        // allow import syntax as we compile that away with babel for node
        "node/no-unsupported-features/es-syntax": [
            "error",
            {
                ignores: ["dynamicImport", "modules"],
            },
        ],

        // sometimes we need this with jsdoc typing
        "@typescript-eslint/ban-ts-comment": "off",

        // NOTE: `eslint-plugin-jsdoc` is not installed in this fork, so
        // jsdoc/* rules and inline disable directives previously caused
        // "Definition for rule ... was not found" errors. Rules removed and
        // any dangling `eslint-disable-next-line jsdoc/...` directives in
        // source were cleaned up to keep the lint baseline clean.

        // reports usage of deprecated code
        // <https://github.com/gund/eslint-plugin-deprecation>
        "deprecation/deprecation": "warn",

        // detecting unsupported ES6 features in IE11
        "ie11/no-collection-args": "error",
        "ie11/no-for-in-const": "error",
        "ie11/no-loop-func": "warn",
        "ie11/no-weak-collections": "error"
    },
};
