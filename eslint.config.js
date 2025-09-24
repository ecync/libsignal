export default [
  {
    files: ["src/**/*.js"],
    ignores: ["src/WhisperTextProtocol.js"], // Generated file, skip linting
    languageOptions: {
      ecmaVersion: 2018,
      sourceType: "commonjs",
      globals: {
        Buffer: "readonly",
        console: "readonly",
        process: "readonly",
        require: "readonly",
        module: "readonly",
        exports: "readonly",
        __dirname: "readonly",
        __filename: "readonly",
        global: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly"
      }
    },
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
      "semi": ["error", "always"],
      "quotes": ["error", "single", { "allowTemplateLiterals": true }]
    }
  }
];