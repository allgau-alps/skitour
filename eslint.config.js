const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
    js.configs.recommended,
    {
        files: ["tools/**/*.js", "snow-depth/**/*.js", "planning/**/*.js"],
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "commonjs",
            globals: {
                ...globals.node,
                ...globals.browser
            }
        },
        rules: {
            "no-unused-vars": "warn",
            "no-console": "off",
            "no-empty": "warn"
        }
    }
];
