const { FlatCompat } = require('@eslint/eslintrc');
const path = require('path');
const fs = require('fs');

// Load the legacy .eslintrc.js config and convert it to the flat config format
// required by ESLint v9+ (the legacy format is unsupported starting ESLint v10).
const legacyConfig = require('./.eslintrc.js');

const compat = new FlatCompat({
	baseDirectory: __dirname,
});

module.exports = [
	...compat.config(legacyConfig),
	{
		ignores: ['.eslintrc.js', 'eslint.config.js', '**/node_modules/**', '**/dist/**'],
	},
];
