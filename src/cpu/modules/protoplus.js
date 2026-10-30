(async ({
	preexpand = false,
	silent = false,
	override = true,
	skipProtos = false,
	skipGlobals = false,
	skipClasses = false,
} = {}) => {
	// innards
	const now =
		typeof globalThis.performance?.now === 'function'
			? () => Math.trunc(performance.now()) // use performance.now when available
			: Date.now;
	const snapshots = {};

	const protoplus = {
		global: {
			JSON: {
				isJSON: function (obj) {
					return (
						obj !== null &&
						typeof obj === 'object' &&
						!Array.isArray(obj)
					);
				},
				iterate: function (obj, callback) {
					if (!JSON.isJSON(obj))
						throw new TypeError(
							'Argument "obj" must be a plain object.'
						);
					if (typeof callback !== 'function')
						throw new TypeError(
							'Argument "callback" must be of type "function".'
						);
					for (let i = 0; i < Object.keys(obj).length; i++) {
						callback(Object.keys(obj)[i], Object.values(obj)[i], i);
					}
				},
			},

			RegExp: {
				escape: str =>
					String(str).replace(
						/([.*+?^${}()|[\]\\])/g,
						$0 => '\\' + $0
					),
			},

			Array: {
				shuffle: arr => {
					if (!Array.isArray(arr)) return;
					// Durstenfield shuffle script not made by me
					// Code from https://stackoverflow.com/a/12646864
					// Credit where it's due!
					// Thanks @Laurens Holst and @mwsundberg

					for (let i = arr.length - 1; i > 0; i--) {
						const j = Math.floor(Math.random() * (i + 1));
						[arr[i], arr[j]] = [arr[j], arr[i]];
					}
					return arr;
				},
				genericType: array => {
					if (array.length === 0) return undefined;

					const baseType = Object.typeOf(array[0]);
					for (let i = 1; i < array.length; i++) {
						if (Object.typeOf(array[i]) !== baseType)
							return undefined;
					}

					return baseType;
				},
			},

			Math: {
				clamp: (num, min, max) => Math.max(min, Math.min(max, num)),
				TAU: 2 * Math.PI,
				angle: {
					clampDeg: deg => deg % 360,
					clampRad: rad => rad % Math.TAU,
					radToDeg: rad => (rad * 180) / Math.PI,
					degToRad: deg => (deg * Math.PI) / 180,
				},
				root: (radicand, index = 2) => radicand ** (1 / index),
				randomMinMax: (min, max) => Math.random() * (max - min) + min,
			},

			Number: {
				testFloatPrecision: () => {
					for (let i = 0; i < 5e2; i++) {
						const baseNumber = 1;
						const testNumber = parseFloat(`0.${'9'.repeat(i)}`);
						if (testNumber === baseNumber) {
							Number.floatPrecision = i;
							return i;
						}
					}
				},
				testIntPrecision: () =>
					(Number.intPrecision = Number.MAX_SAFE_INTEGER),
			},

			Object: {
				isPlain: function (input) {
					return (
						input !== null &&
						typeof input === 'object' &&
						!Array.isArray(input)
					);
				},

				typeOf: thing => {
					if (typeof thing === 'object')
						if (thing === null) return 'null';
						else if (Array.isArray(thing)) return 'array';
						else return 'object';
					else if (typeof thing === 'number') {
						if (Number.isNaN(thing)) return 'nan';
						else if (!Number.isFinite(thing)) return 'infinity';
					} else if (typeof thing === 'function') {
						function isClass(value) {
							if (typeof value !== 'function') return;

							// do many tests to prove class status
							const tests = [
								Function.prototype.toString
									.call(value)
									.startsWith('class '),
								(() => {
									try {
										Reflect.construct(String, [], value);
										return false;
									} catch (err) {
										return /class constructor/i.test(
											err?.message ?? err
										);
									}
								})(),
								(() => {
									if (!value.prototype) return false;
									return !Object.prototype.propertyIsEnumerable.call(
										value,
										'prototype'
									);
								})(),
								(() => {
									if (!value.prototype) return false;
									return Object.prototype.hasOwnProperty.call(
										value.prototype,
										'constructor'
									);
								})(),
								(() => {
									return (
										value[Symbol.toStringTag] === 'Function'
									);
								})(),
							];

							return tests.some(Boolean);
						}
						if (isClass(thing)) return 'class';
						else return 'function';
					} else return typeof thing;
				},
				types: Object.freeze(
					// made it a string so it's easier to add more
					'number,string,boolean,function,class,symbol,bigint,undefined,null,array,object,nan,infinity'.split(
						','
					)
				),
			},

			Boolean: {
				formatTypes: {
					affirm: ['no', 'yes'],
					binary: ['0', '1'],
					onoff: ['off', 'on'],
					enable: ['disabled', 'enabled'],
					literal: ['false', 'true'],
				},
			},
		},

		proto: {
			Audio: {
				stop: function () {
					this.pause();
					this.currentTime = 0;
				},
			},

			Array: {
				last: function () {
					return this[this.length - 1];
				},
				shuffle: function () {
					const shuffled = Array.shuffle(this);
					shuffled.forEach((item, i) => {
						this[i] = item;
					});
					return shuffled;
				},
				toShuffled: function () {
					return Array.shuffle([...this]);
				},
				random: function () {
					return this[
						Math.floor(Math.random() * this.valueOf().length)
					];
				},
				genericType: function () {
					return Array.genericType(this);
				},
				advSort: function (compareFn) {
					const arrType = this.genericType();

					if (compareFn !== undefined) {
						if (typeof compareFn === 'function') {
							this.sort(compareFn);
						} else {
							throw new TypeError(
								`The comparison function should not be of type '${typeof compareFn}', only 'function' or 'undefined'`
							);
						}
					} else {
						if (arrType === 'number') this.sort((a, b) => a - b);
						else this.sort();
					}
					return this;
				},
				stride: function (start = 0, end, step = 1) {
					end ??= array.length;
					if (start < 0)
						throw new RangeError(
							'Start index must be greater than or equal to zero.'
						);
					if (end >= array.length)
						throw new RangeError(
							"Start index must be lesser than the target array's length."
						);
					if (Number.isInteger(step))
						throw new RangeError('Step size must be an integer');
					if (step < 1)
						throw new RangeError(
							'Step size must be greater than or equal to 1.'
						);

					const array = this.valueOf();
					const stridedArray = [];
					for (let i = start; i <= end; i += step) {
						stridedArray.push(array[i]);
					}
					return stridedArray;
				},
				dedup: function () {
					return this.filter((v, i) => this.indexOf(v) === i);
				},
			},

			HTMLCollection: {
				last: function () {
					return this[this.length - 1];
				},
			},

			Boolean: {
				format: function ({ type = 'literal' }) {
					const bool = this.valueOf();
					const types = Boolean.formatTypes;

					const pair = types[type] ?? ['false', 'true'];
					return pair[+bool]; // transform bool to num by adding to 0
				},
			},
			String: {
				last: function () {
					return this[this.length - 1];
				},
				escapeRegex: function () {
					return RegExp.escape(String(this));
				},
				trimLeft: function (...strings) {
					if (strings.length < 1) {
						strings = [' ', '\t', '\n', '\r'];
					}
					let finalStr = '';
					let skipping = true;
					for (const char of this) {
						if (strings.includes(char) && skipping) continue;
						finalStr += char;
						skipping = false;
					}
					return finalStr;
				},
				trimStart: function (...strings) {
					if (strings.length < 1) {
						strings = [' ', '\t', '\n', '\r'];
					}
					let finalStr = '';
					let skipping = true;
					for (const char of String(this)) {
						if (strings.includes(char) && skipping) continue;
						finalStr += char;
						skipping = false;
					}
					return finalStr;
				},
				trimRight: function (...strings) {
					if (strings.length < 1) {
						strings = [' ', '\t', '\n', '\r'];
					}
					let finalStr = '';
					let skipping = true;
					for (const char of Array.from(this).reverse().join('')) {
						if (strings.includes(char) && skipping) continue;
						finalStr = char + finalStr;
						skipping = false;
					}
					return finalStr;
				},
				trimEnd: function (...strings) {
					if (strings.length < 1) {
						strings = [' ', '\t', '\n', '\r'];
					}
					let finalStr = '';
					let skipping = true;
					for (const char of Array.from(this).reverse().join('')) {
						if (strings.includes(char) && skipping) continue;
						finalStr = char + finalStr;
						skipping = false;
					}
					return finalStr;
				},
				trim: function (...strings) {
					return this.trimStart(...strings).trimEnd(...strings);
				},
				reverse: function () {
					return this.split('').reverse().join('');
				},
				erase: function (...strings) {
					return strings.reduce(
						(finalStr, str) => finalStr.replace(str, ''),
						this.valueOf()
					);
				},
				eraseAll: function (...strings) {
					return strings.reduce(
						(finalStr, str) => finalStr.replaceAll(str, ''),
						this.valueOf()
					);
				},
				chars: function () {
					return this.split('');
				},
				words: function () {
					return this.split(' ');
				},
				getLineEnding: function () {
					if (/\r\n/.test(this.valueOf())) return '\r\n';
					else if (/[^\r]\n/.test(this.valueOf)) return '\n';
					else return undefined; // unknown
				},
				lines: function () {
					const lineEnding = String(this).getLineEnding();
					if (lineEnding) return this.split(lineEnding);
					else return this; // no lines
				},
				compactPunct: function () {
					const puncts = {
						'...': '…',
						'---': '—',
						'--': '–',
						'-': '‑',
						'<<': '«',
						'>>': '»',
						'!!': '‼',
						'⁇': '⁇',
						'!?': '⁉',
						'?!': '⁉',
						// "fi": "ﬁ", // not punctuation but maybe someday
					};
					return Object.keys(puncts).reduce(
						(finalStr, punct) =>
							finalStr.replace(
								new RegExp(
									`(${punct.map(RegExp.escape).join('|')})`,
									'g'
								),
								punct => puncts[punct]
							),
						this.valueOf()
					);
				},
				forEach: function (callback, separator = '') {
					const separated = this.split(separator);
					for (let i = 0; i < separated.length; i++) {
						callback(separated[i], i, this.valueOf());
					}
					return;
				},
				toTitleCase: function (separator = ' ') {
					const str = String(this),
						finalStr = [];

					str.split(separator).forEach(arg => {
						finalStr.push(arg[0].toUpperCase() + arg.substring(1));
					});

					return finalStr.join(separator);
				},
				startsWithAmount: function (char) {
					for (let i = 0; i < this.length; i++) {
						if (this[i] !== char) return i;
					}
					return this.length;
				},
				endsWithAmount: function (char) {
					const reversed = this.reverse();
					for (let i = 0; i < this.length - 1; i++) {
						if (reversed[i] !== char) return i;

						iterations++;
					}
					return this.length;
				},
				amountOf: function (substring) {
					let matches = 0;
					for (let i = 0; i < this.length; i++) {
						const searchStr = this.substring(
							i,
							i + substring.length
						);
						if (searchStr === substring) matches++;
					}
					return matches;
				},
				cleanup: function () {
					return this.valueOf()
						.normalize('NFKD')
						.replace(/\p{M}/gu, '');
				},
				escapeHTML: function () {
					const entities = {
						'&': '&amp;',
						'<': '&lt;',
						'>': '&gt;',
						'"': '&quot;',
						"'": '&apos;',
					};
					let escapedText = this.valueOf();
					for (const [raw, entity] of Object.entries(entities)) {
						escapedText = escapedText.replaceAll(raw, entity);
					}
					return escapedText;
				},
			},

			Number: {
				evenize: function () {
					// snaps to nearest even number
					return Math.round(this / 2) * 2;
				},
				oddize: function () {
					// snaps to nearest odd number
					return Math.round((this - 1) / 2) * 2 + 1;
				},
				fix: function (digits) {
					return parseFloat(this.toFixed(digits));
				},
				floor: function () {
					return Math.floor(this.valueOf());
				},
				ceil: function () {
					return Math.ceil(this.valueOf());
				},
				round: function () {
					return Math.round(this.valueOf());
				},
				clamp: function (min, max) {
					return Math.max(min, Math.min(max, this));
				},
				inRange: function (
					min,
					max = min,
					minInclusive = true,
					maxInclusive = true
				) {
					const num = this.valueOf();
					const insideMin = minInclusive ? num >= min : num > min;
					const insideMax = maxInclusive ? num <= max : num < max;
					return insideMin && insideMax;
				},
			},
		},
		classes: {
			AdvDate: class {
				constructor({
					timestampFn = Date.now,
					is24hour = null,
					am = 'AM',
					pm = 'PM',
				} = {}) {
					this.weekNames = [
						'Sunday',
						'Monday',
						'Tuesday',
						'Wednesday',
						'Thursday',
						'Friday',
						'Saturday',
					];

					const getTimestamp = timestampFn ? timestampFn : Date.now;
					const getHour = () => {
						switch (is24hour) {
							case true:
								return parseInt(
									new Date(getTimestamp()).toLocaleTimeString(
										'en-US',
										{
											hour12: false,
											hour: '2-digit',
										}
									)
								);

							case false:
								return parseInt(
									new Date(getTimestamp()).toLocaleTimeString(
										'en-US',
										{
											hour12: true,
											hour: '2-digit',
										}
									)
								);

							default:
								return parseInt(
									new Date(getTimestamp()).toLocaleTimeString(
										undefined,
										{
											hour: '2-digit',
										}
									)
								);
						}
					};
					this.times = {
						timestamp: getTimestamp,
						weekDay: () => new Date(getTimestamp()).getDay() + 1,
						day: () => new Date(getTimestamp()).getDate(),
						dayOfWeek: () => new Date(getTimestamp()).getDay(),
						daysInMonth: () =>
							new Date(
								new Date(getTimestamp()).getFullYear(),
								new Date(getTimestamp()).getMonth() + 1,
								0
							).getDate(),
						weekName: () =>
							this.weekNames[new Date(getTimestamp()).getDay()],
						month: () => new Date(getTimestamp()).getMonth() + 1,
						year: () => new Date(getTimestamp()).getFullYear(),
						hours: getHour,
						minutes: () => new Date(getTimestamp()).getMinutes(),
						seconds: () => new Date(getTimestamp()).getSeconds(),
						milliseconds: () =>
							new Date(getTimestamp()).getMilliseconds(),
						meridiem: () => {
							if (isDefined(is24hour) && !is24hour) {
								return new Date()
									.toLocaleTimeString('en-US', {
										hour: 'numeric',
										minute: 'numeric',
										hour12: true,
									})
									.split(' ')[1] === 'AM'
									? am
									: pm;
							} else return '';
						},
					};

					Object.keys(this.times).forEach(
						k => (this[k] = this.times[k])
					);
				}

				getDateString({
					trimWeek = false,
					showWeek = true,
					monthFirst = true,
					timeFirst = false,
					showMs = false,
					dateSeparator = '/',
					timeSeparator = ':',
					msSeparator = '.',
					dateOnly = false,
					timeOnly = false,
				} = {}) {
					const week = showWeek
						? `${trimWeek
							? this.times.weekName().substring(0, 3)
							: this.times.weekName()
						} `
						: '';
					const time =
						[
							this.times.hours().toString().padStart(2, '0'),
							this.times.minutes().toString().padStart(2, '0'),
							this.times.seconds().toString().padStart(2, '0'),
						].join(timeSeparator) +
						(showMs
							? `${msSeparator}${this.times.milliseconds().toString().padStart(3, '0')}`
							: '');

					const date = [
						(monthFirst ? this.times.month() : this.times.day())
							.toString()
							.padStart(2, '0'),
						(monthFirst ? this.times.day() : this.times.month())
							.toString()
							.padStart(2, '0'),
						this.times.year().toString().padStart(4, '0'),
					].join(dateSeparator);

					if (timeOnly && dateOnly)
						throw new Error(
							'You cannot only get the time while also only getting the date. Pick one!'
						);

					if (timeOnly) return time;
					if (dateOnly) return date;

					if (timeFirst) return time + ' ' + week + date;
					else return week + date + ' ' + time;
				}
			},
		},
		expand: ({
			override = true,
			skipProtos = false,
			skipGlobals = false,
			skipClasses = false,
		} = {}) => {
			const globals = protoplus.global;
			const prototypes = protoplus.proto;
			const classes = protoplus.classes;

			const startTime = now();

			// iter globals
			for (const [key, defs] of Object.entries(globals)) {
				if (skipGlobals) break; // skip expansion if told to
				if (!globalThis[key]) continue; // skip if the parent doesn't exist in this environment

				// define functions
				for (const [name, def] of Object.entries(defs)) {
					if (globalThis[key][name] === def) continue; // skip definition if it's the same

					// store snapshot if definition already exists
					if (name in globalThis[key]) {
						snapshots[`global.${key}.${name}`] =
							globalThis[key][name];
						if (!override) continue; // skip definition if overrides are disabled
					}
					Object.defineProperty(globalThis[key], name, {
						value: def,
						writable: true,
						configurable: true,
						enumerable: false,
					});
				}
			}

			// iterate thru protos
			for (const [key, defs] of Object.entries(prototypes)) {
				if (skipProtos) break; // skip expansion if told to
				if (!globalThis[key]) continue; // skip if the parent doesn't exist in this environment

				// define functions
				for (const [name, def] of Object.entries(defs)) {
					if (globalThis[key].prototype[name] === def) continue; // skip definition if it's the same

					// store snapshot if definition already exists
					if (name in globalThis[key].prototype) {
						snapshots[`prototype.${key}.${name}`] =
							globalThis[key].prototype[name];
						if (!override) continue; // skip definition if overrides are disabled
					}

					Object.defineProperty(globalThis[key].prototype, name, {
						value: def,
						writable: true,
						configurable: true,
						enumerable: false,
					});
				}
			}

			// define classes
			for (const [className, classDef] of Object.entries(classes)) {
				if (skipClasses) break; // skip expansion if told to

				if (className in globalThis) {
					// add to snapshots and skip definition if it already exists,
					// regardless of override
					snapshots[`value.${className}`] = true; // use true for existence
					continue;
				}
				globalThis[className] = classDef;
			}
			const endTime = now();
			console.log(`expanded methods in ${endTime - startTime}ms`);
		},
		contract: ({
			forceErase = false,
			skipProtos = false,
			skipGlobals = false,
			skipClasses = false,
		} = {}) => {
			const globals = protoplus.global;
			const prototypes = protoplus.proto;
			const classes = protoplus.classes;

			const startTime = now();

			// iterate thru globals
			for (const [key, defs] of Object.entries(globals)) {
				if (skipGlobals) break; // skip contraction if told to
				if (!globalThis[key]) continue; // skip if the parent doesn't exist in this environment

				// define functions
				for (const [name, def] of Object.entries(defs)) {
					if (forceErase || !snapshots[`global.${key}.${name}`])
						// delete definition if erasing is forced or there is no snapshot
						delete globalThis[key][name];
					else {
						Object.defineProperty(globalThis[key], name, {
							value: snapshots[`global.${key}.${name}`],
							writable: true,
							configurable: true,
							enumerable: false,
						});
					}
				}
			}

			// iterate thru prototypes
			for (const [key, defs] of Object.entries(prototypes)) {
				if (skipProtos) break; // skip contraction if told to
				if (!globalThis[key]) continue; // skip if the parent doesn't exist in this environment

				// define functions
				for (const [name, def] of Object.entries(defs)) {
					// delete definition if erasing is forced or there is no snapshot
					if (forceErase || !snapshots[`prototype.${key}.${name}`])
						delete globalThis[key].prototype[name];
					else {
						Object.defineProperty(globalThis[key].prototype, name, {
							value: snapshots[`prototype.${key}.${name}`],
							writable: true,
							configurable: true,
							enumerable: false,
						});
					}
				}
			}

			// define classes
			for (const className of Object.keys(classes)) {
				if (skipClasses) break; // skip contraction if told to

				// skip deletion if there's a snapshot of it set to `true`,
				// regardless if deletion is forced
				if (
					`value.${className}` in snapshots &&
					snapshots[`value.${className}`] === true
				)
					continue;

				delete globalThis[className];
			}
			const endTime = now();
			console.log(`contracted methods in ${endTime - startTime}ms`);
		},
		version: '1.10.1',
	};

	if (preexpand)
		protoplus.expand({
			override,
			skipProtos,
			skipGlobals,
			skipClasses,
		});

	globalThis.protoplus = protoplus;

	if (!silent) console.log(`proto+ v${protoplus.version} loaded!`);
	return protoplus;
})({
	preexpand: true,
	silent: true,
});
