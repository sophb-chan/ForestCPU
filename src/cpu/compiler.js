// helpers
class LeveledConsole {
	#levelNames = {};
	shouldLog(messageLevel) {
		if (this.loggingLevel < 0) return messageLevel === this.loggingLevel;
		else if (this.loggingLevel === 0) return false;
		else return this.loggingLevel >= messageLevel;
	}

	constructor(loggingLevel) {
		if (typeof loggingLevel !== "number")
			throw new TypeError("Logging level must be a number.");

		this.loggingLevel = loggingLevel;

		const consoleFunctions = Object.entries(console).filter(
			(v) => typeof v[1] === "function",
		);
		for (const [functionName, consoleFunction] of consoleFunctions) {
			this[functionName] = function (messageLevel, ...args) {
				if (this.shouldLog(messageLevel)) consoleFunction(...args);
				else return null;
			};
		}
	}
	levelName(loggingLevel) {
		if (typeof loggingLevel !== "number")
			throw new TypeError("Logging level must be a number.");

		return this.#levelNames[loggingLevel];
	}
	setLevelName(loggingLevel, name) {
		if (typeof loggingLevel !== "number")
			throw new TypeError("Logging level must be a number.");

		return (this.#levelNames[loggingLevel] = name);
	}
}

// tokens
const tokenRules = {
	/*
	TOKEN: {
		pattern: RegExp,
		groupTokens: Array,
		required: Boolean,
	},
	*/
	INSTRUCTION: {
		pattern: /^(\b[a-z][a-z0-9]*)((?:[\t ](?:\$[a-z0-9]+|0b[01]+|[1-9]\d*|\d|%[a-z0-9]+))*)?/i,
		groupTokens: ["MNEMONIC", "OPERANDS"],
	},
};
const tokenHandlers = {
	MNEMONIC: {
		handler: (output, {
			architecture,
			value,
		} = {}) => {
			const instruction = architecture.instructions.find(i => i.info.name.toLowerCase() === value.toLowerCase());
			if (instruction == null)
				throw new ReferenceError(`Unknown instruction "${value}"`);
			const opcode = instruction.opcode;
			output.push(parseInt(opcode));
		},
	},
	OPERANDS: {
		handler: (output, {
			processor,
			value,
		} = {}) => {
			if (value == null) return;
			const operands = value.trimStart().split(/[\t ]+/);
			if (operands.length === 0) return;
			for (const operand of operands) {
				if (operand.startsWith('%'))
					output.push(
						1,
						processor.registerNames.map(
							r => r.toLowerCase()
						).indexOf(operand.slice(1).toLowerCase())
					);
				else if (operand.startsWith('$'))
					output.push(
						0,
						parseInt(operand.slice(1), 16)
					);
				else
					output.push(
						0,
						Number(operand)
					);
			}
		},
	},
};

// tokenizer
function tokenizeFile(fileContent, loggingLevel = 0) {
	// init leveled console
	const Lconsole = new LeveledConsole(loggingLevel);
	Lconsole.setLevelName(-1, "debugging");
	Lconsole.setLevelName(0, "none");
	Lconsole.setLevelName(1, "vague");
	Lconsole.setLevelName(2, "informant");
	Lconsole.setLevelName(3, "verbose");

	// do what it says (does what it says)
	const originalFileContent = fileContent;
	Lconsole.log(3, "Trimming code...");
	fileContent = fileContent.trim();

	// commence the tokenization
	Lconsole.log(1, "Tokenizing...");
	Lconsole.log(2, "Removing ignored tokens from code...");
	const ignoredTokens = Object.entries(tokenRules).filter((v) => v.ignore);
	Lconsole.log(-1, "Tokens to ignore:", Object.fromEntries(ignoredTokens));

	for (const [token, def] of ignoredTokens) {
		Lconsole.log(3, "Ignoring token", token);

		let pattern = def.pattern;
		if (!pattern.flags.includes("g")) {
			Lconsole.warn(
				0,
				'Added required "g" flag to regex pattern of ignored token',
				token + ", this may cause unpredictable issues.",
			);
			Lconsole.warn(
				-1,
				'Added required "g" flag to regex pattern of ignored token',
				token + ", this may cause unpredictable issues.",
			);
			pattern = new RegExp(pattern.source, pattern.flags + "g");
		}
		fileContent = fileContent.replaceAll(pattern, "");
	}

	// parse non-ignored tokens
	Lconsole.log(2, "Parsing remaining tokens...");
	const tokens = [];
	while (fileContent) {
		let found = false;
		Object.entries(tokenRules).forEach((entry) => {
			const [ruleName, ruleDef] = entry;
			if (ruleDef.ignore) return;

			Lconsole.log(3, "Matching against", ruleName);
			const match = fileContent.match(ruleDef.pattern);
			Lconsole.log(-1, `Match result against ${ruleName}:`, match);
			if (!match) return;
			found = true;

			Lconsole.log(2, "Parsing token rule", ruleName);
			Lconsole.log(-1, "Token rule definition:", ruleDef);
			const groups = [...match].slice(1);
			for (const [group, value] of groups.entries()) {
				//
				const token = {
					name: ruleDef.groupTokens[group],
					value,
					index: originalFileContent.length - fileContent.length,
					line: 0,
					col: 0,
				};
				// get token location in file
				const lines = originalFileContent.split("\n");
				const index = originalFileContent.length - fileContent.length;
				let lengthSum = 0;
				let previousLengthSum = 0;
				for (const [lineindex, content] of lines.entries()) {
					token.line = lineindex;
					lengthSum += content.length;
					if (lengthSum >= index) break;
					previousLengthSum = lengthSum;
				}
				token.line++;
				token.col =
					index - (lengthSum - (lengthSum - previousLengthSum)) + 2;

				tokens.push(token);
				Lconsole.log(-1, "Parsed token:", token);
			}
			fileContent = fileContent.slice(match[0].length).trim();
			Lconsole.log(-1, "Remaining file content:", fileContent);
		});
		if (!found) {
			const errorIndex = originalFileContent.length - fileContent.length;
			const quote = fileContent[0] === "'" ? '"' : "'";
			throw new SyntaxError(
				`Invalid token ${quote + fileContent[0] + quote} at index ${errorIndex}`,
			);
		}
	}
	const requiredTokens = Object.entries(tokenRules).filter(
		(token) => token.required,
	);
	for (const [requiredToken] of requiredTokens) {
		if (!tokens.includes(requiredToken)) {
			if (tokenHandlers[requiredToken].fallback) {
				tokens.unshift({
					name: requiredToken,
					value: tokenHandlers[requiredToken].fallback,
					index: -1,
					line: 0,
					col: 0,
				});
			} else
				throw new SyntaxError(
					`File is missing the required token ${requiredToken}`,
				);
		}
	}
	return tokens;
}
// parser
function parseTokens(tokens, processor, loggingLevel = 0) {
	// init leveled console
	const Lconsole = new LeveledConsole(loggingLevel);
	Lconsole.setLevelName(-1, "debugging");
	Lconsole.setLevelName(0, "none");
	Lconsole.setLevelName(1, "vague");
	Lconsole.setLevelName(2, "informant");
	Lconsole.setLevelName(3, "verbose");

	// get architecture
	const architecture = processor.exportArchitecture();

	// parse
	const output = [];
	Lconsole.log(1, "Parsing tokens...");
	for (const [index, token] of tokens.entries()) {
		Lconsole.log(3, "Parsing token", token.name);
		const handler = tokenHandlers[token.name];
		if (!handler) {
			Lconsole.log(
				3,
				`Token ${token.name} does not have a handler. Skipping token...`,
			);
			continue;
		}
		const nextTokens = tokens.filter((_, i) => i > index),
			prevTokens = tokens.filter((_, i) => i < index);

		Lconsole.log(-1, "Previous tokens:", prevTokens);
		Lconsole.log(-1, "Next tokens:", nextTokens);

		handler.handler(output, {
			value: token.value,
			nextTokens,
			prevTokens,
			tokens,
			processor,
			architecture,
		});
		Lconsole.log(2, "Parsed token", token.name);
	}
	return new Uint8ClampedArray(output);
}
// compiler
function compileFile(file, processor, loggingLevel = 0) {
	const tokens = tokenizeFile(file, loggingLevel);
	const output = parseTokens(tokens, processor, loggingLevel);
	return output;
}
