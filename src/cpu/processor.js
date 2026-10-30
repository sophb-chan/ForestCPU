class ProcessorArchitecture {
	constructor({
		registerNames = [],
		instructions = [],
		architectureName,
		lock = false,
	} = {}) {
		this.architecture = {
			registerNames,
			instructions,
			architectureName,
			lock,
		};
		Object.freeze(this.architecture);
	}
}
class Processor {
	// =============== Static Methods =============== //
	static get specials() {
		return {
			halt: 'HALT',
		}
	}
	static fromState({
		registers = {},
		instructions = [],
		architectureName,
		lock = false,
	} = {}) {
		const processor = new Processor(new ProcessorArchitecture({
			registerNames: Object.keys(registers),
			instructions,
			architectureName,
			lock,
		}));
		for (const [register, value] of Object.entries(registers)) {
			processor.setRegister(register, value);
		}
		return processor;
	}

	constructor(architecture) {
		architecture ??= new ProcessorArchitecture();
		if (!(architecture instanceof ProcessorArchitecture))
			throw new TypeError(`Architecture must be an instance of the "ProcessorArchitecture" class`);

		const { registerNames, instructions, lock, architectureName } = architecture.architecture;
		this.createRegisters(...registerNames);
		for (const instruction of instructions) {
			this.createInstruction(instruction.info, instruction.opcode);
		}
		if (lock) this.lockArchitecture();
		if (typeof architectureName === 'string')
			this.name = architectureName;
	};



	// =============== Architecture Lock =============== //
	#locked = false;
	get locked() {
		return this.#locked;
	}
	#checkLock() {
		if (this.#locked)
			throw new LockError('Processor architecture is locked.');
		return this.#locked;
	}
	lockArchitecture() {
		this.#checkLock();
		this.#updateRegisters();
		Object.freeze(this.#instructionSet);
		Object.freeze(this.#registerNames);
		this.#locked = true;
		return this.#locked;
	}

	// =============== Cloning =============== //
	clone() {
		return new Processor(this.exportArchitecture());
	}
	statefulClone() {
		return Processor.fromState({
			architectureName: this.name,
			registers: this.registers,
			instructions: Object.entries(this.instructionSet).map(([k, v]) => ({
				opcode: parseInt(k),
				info: v,
			})),
			lock: this.#locked,
		});
	}
	exportArchitecture() {
		return new ProcessorArchitecture({
			architectureName: this.name,
			registerNames: this.registerNames,
			instructions: Object.entries(this.instructionSet).map(([k, v]) => ({
				opcode: parseInt(k),
				info: v,
			})),
			lock: this.#locked,
		});
	}

	// =============== Registers =============== //
	#registerNames = [];
	get registerNames() {
		return this.#registerNames;
	}
	#registers = {};
	get registers() {
		return this.#registers;
	}
	#updateRegisters() {
		for (const registerName of this.#registerNames) {
			this.#registers[registerName] ??= 0x00;
		}
	}

	createRegisters(...registerNames) {
		this.#checkLock();

		for (const registerName of registerNames) {
			this.#registerNames.push(registerName);
			this.#updateRegisters();
		}
	}
	setRegister = (name, value) => {
		if (!this.registerNames.includes(name))
			throw new ReferenceError(`Unknown register "${name}"`);
		this.registers[name] = value & 0xFF; // Keep register values 8-bit
	}

	// =============== Memory =============== //
	#memory = new Uint8ClampedArray(6711e5); // 640 KiB
	get memory() {
		return this.#memory;
	}
	#knowsSettingMemoryChangesSize = false;
	set memory(size) {
		if (!this.#knowsSettingMemoryChangesSize) {
			console.warn("(i) INFO: Setting '.memory' changes the size of memory, not the value of it.");
			this.#knowsSettingMemoryChangesSize = true;
			setTimeout(() => {
				this.#knowsSettingMemoryChangesSize = false;
			}, 60e3 * 60);
		}

		if (!Number.isInteger(size)) {
			const typeofSize = Object.typeOf(size);
			throw new TypeError(`Size must be an integer, not a${/^[aeiou]/.test(typeofSize) ? 'n' : ''} ${typeofSize}.`);
		}

		const sizeIsNegative = Math.sign(size) < 0 || Object.is(size, -0);
		if (this.#memory.length > size && !sizeIsNegative)
			throw new TypeError(`The amount of memory in the CPU (${this.#memory.length} bytes) is larger than the size you have provided (${size} bytes).\nTo override this, use a negative size value instead (-0 is respected).`);

		this.#memory = new Uint8ClampedArray(Math.abs(size));
		return Math.abs(size);
	}


	// =============== Instruction Set =============== //
	#instructionSet = {};
	get instructionSet() {
		return this.#instructionSet;
	}

	createInstruction(instructionInfo = {}, opcode) {
		this.#checkLock();

		opcode ??= Object.keys(this.#instructionSet).length ?? 0;
		if (this.#instructionSet[opcode] != null)
			throw new Error(`The opcode ${opcode} is already being used by the instruction "${this.#instructionSet[opcode].name}".`);

		// Check required options
		const requiredInfo = {
			name: 'string',
			operands(number, errors) {
				if (typeof number !== 'number')
					throw errors.type;

				if (!Number.isFinite(number))
					throw new TypeError('The option "operands" must be finite.');

				if (!Number.isInteger(number))
					throw new TypeError('The option "operands" must be an integer.');

				if (number < 0)
					throw new RangeError(`The number of operands must be a finite integer greater than or equal to (>=) 0, and ${number} is not.`);
			},
		};
		for (const [name, type] of Object.entries(requiredInfo)) {
			const info = instructionInfo[name];

			// Existence validation
			if (info == null)
				throw new SyntaxError(`Missing required instruction info: ${name}`);

			// Type validation
			if (Object.typeOf(type) === 'function') {
				const validationResult = type(
					info,
					{
						type: new TypeError(`The option "${name}" must be of the type '${type}', not '${Object.typeOf(info)}'`),
					},
				);
				if (validationResult != null && validationResult !== true)
					throw validationResult;
			} else if (Object.typeOf(type) === 'string') {
				if (Object.typeOf(info) !== type)
					throw new TypeError(`The option "${name}" must be of the type '${type}', not '${Object.typeOf(info)}'`);
			}
		}
		// EXCEPTION: fn OR operations
		if (instructionInfo.fn == instructionInfo.operations == null)
			throw new SyntaxError(`Missing required instruction info: 'fn()' OR 'operations[]'`);
		// Use operations size as ticks fallback
		if (instructionInfo.operations)
			instructionInfo.ticks ??= instructionInfo.operations.length;
		else instructionInfo.ticks ??= 1;


		// Add instruction to instruction set
		this.#instructionSet[opcode] ??= {};
		Object.assign(
			this.#instructionSet[opcode],
			instructionInfo,
		);
	}

	// =============== Clock =============== //
	#clockSpeed = Infinity; // In Hertz
	get clockSpeed() {
		return this.#clockSpeed;
	}
	set clockSpeed(Hz) {
		if (typeof Hz !== 'number')
			throw new TypeError(`Clock speed hertz must be of the type 'number', not '${Object.typeOf(Hz)}'.`);
		if (Hz <= 0)
			throw new RangeError(`Clock speed hertz must be above 0, and ${Hz} is not.`);

		this.#clockSpeed = Hz;
	}

	// =============== Processing =============== //
	#PC = 0; #loadedProgram = new Uint8ClampedArray(0);

	loadProgram(...bytes) {
		const clampedArray = new Uint8ClampedArray(bytes.length);
		for (const [index, byte] of bytes.entries()) {
			switch (typeof byte) {
				case 'number':
					clampedArray[index] = byte;
					break;

				case 'string':
					if (byte.length < 1) break;
					clampedArray[index] = byte.charCodeAt(0) % 0xFF;
					break;

				default:
					console.error(byte);
					throw new Error(`Unhandled byte type '${Object.typeOf(byte)}'`);
			}
		}
		this.#loadedProgram = clampedArray;
	}
	#getInstructionInput(operands, $InstructionShared) {
		return {
			processor: this,
			registers: this.registers,
			setRegister: this.setRegister,
			CPU: this,
			operands,
			memory: this.memory,
			PC: this.#PC,
			$InstructionShared,
			jumpTo: (addr) => this.#PC = addr,
		};
	}
	#instructionShared = {}
	runInstruction(opcode, operands) {
		const instruction = this.instructionSet[opcode];
		if (instruction == null)
			throw new ExecutionError(`Invalid instruction opcode ${opcode}`);

		return instruction.fn(this.#getInstructionInput(operands, this.#instructionShared));
	}
	async runProgram(callbacks = {}, debug) {
		if (this.#loadedProgram.length === 0) return;

		function createWaitWorker() {
			const waitWorkerCode = `
				self.onmessage = function(e) {
					const delay = e.data;
					const start = performance.now();

					while (performance.now() - start < delay) {};

					self.postMessage("done");
				};
			`,
				waitWorkerBlob = new Blob([waitWorkerCode], { type: 'application/javascript' }),
				waitWorkerURL = URL.createObjectURL(waitWorkerBlob),
				waitWorker = new Worker(waitWorkerURL);
			return waitWorker;
		};
		function waitFor(ms) {
			if (ms === 0) return new Promise(r => r());

			// Allows for precise sub-millisecond waits
			const waitWorker = createWaitWorker();

			return new Promise((resolve) => {
				waitWorker.onmessage = () => resolve();
				waitWorker.postMessage(ms);
			});
		}

		// Fill in missing callbacks
		const requiredCallbacks = [
			'instructionStart',
			'instructionExecEnd',
			'instructionClockEnd',
		];
		for (const callback of requiredCallbacks) callbacks[callback] ??= () => { };

		let lastInstructionOutput;
		for (this.#PC = 0; this.#PC < this.#loadedProgram.length;) {
			const opcode = this.#loadedProgram[this.#PC];
			const instruction = this.#instructionSet[opcode];
			if (instruction == null)
				throw new ExecutionError(`Missing instruction (@PC:${this.#PC})`);

			const operands = (() => {
				const operandsArray = this.#loadedProgram.slice(this.#PC + 1, this.#PC + 1 + instruction.operands * 2);
				if (operandsArray.some(v => v == null)) {
					const existingOperands = operandsArray.filter(v => v != null).length;

					throw new ExecutionError(`Insufficient bytes to fulfill operands for opcode ${opcode} (@PC:${this.#PC})`, {
						cause: `Program only had ${existingOperands} byte${existingOperands === 1 ? '' : 's'}, meanwhile instruction needs ${instruction.operands}.`
					});
				}

				const v = [];
				for (let i = 0; i < operandsArray.length; i += 2) {
					const operandType = operandsArray[i],
						value = operandsArray[i + 1];

					switch (operandType) {
						case 0:
							v.push(value);
							break;

						case 1:
							v.push(this.#registers[this.#registerNames[value]]);
							break;

						default:
							throw new ExecutionError(`Unhandled operand type 0x${operandType.toString(16).padStart(2, 0)}`);
					}
				}
				return v;
			})();

			if (debug) {
				console.debug(`Running instruction 0x${opcode.toString(16).padStart(2, 0)} (@PC:${this.#PC})\n`, instruction);
				console.debug('Operands:', operands);
			}

			// 𝐒𝐩𝐞𝐜𝐢𝐚𝐥 𝐈𝐧𝐬𝐭𝐫𝐮𝐜𝐭𝐢𝐨𝐧: Halt
			if (instruction.special === Processor.specials.halt) {
				if (debug) console.debug('Special instruction reached: halt');
				break;
			}

			const instructionObject = this.#getInstructionInput(operands, this.#instructionShared);
			callbacks.instructionStart(instructionObject);
			lastInstructionOutput = this.runInstruction(opcode, operands);
			callbacks.instructionExecEnd(instructionObject);

			const waitTime = (1e3 / this.#clockSpeed) * (instruction.ticks ?? 1);
			if (debug) console.debug('Waiting for', waitTime, 'ms');
			await waitFor(waitTime); // Wait for next clock tick(s)
			this.#PC += 1 + instruction.operands * 2;
			callbacks.instructionClockEnd(instructionObject);
		}
		return lastInstructionOutput;
	}
}
