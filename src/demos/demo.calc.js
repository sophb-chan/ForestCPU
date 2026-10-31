globalThis.CPU = (() => {
	const CPU = new Processor();
	CPU.createRegisters('A', 'B', 'C', 'X');
	CPU.createInstruction({
		fn({
			setRegister,
			operands,
		} = {}) {
			setRegister('A', operands[0]);
		},
		name: 'lda',
		operands: 1,
	}, 0x00);
	CPU.createInstruction({
		fn({
			setRegister,
			operands,
		} = {}) {
			setRegister('B', operands[0]);
		},
		name: 'ldb',
		operands: 1,
	}, 0x01);
	CPU.createInstruction({
		fn({
			setRegister,
			operands,
		} = {}) {
			setRegister('C', operands[0]);
		},
		name: 'ldc',
		operands: 1,
	}, 0x02);
	CPU.createInstruction({
		fn({
			operands,
			setRegister,
			CPU,
		} = {}) {
			const sum = operands[0] + operands[1];
			setRegister('X', sum);
		},
		name: 'add',
		operands: 2,
		ticks: 2,
	}, 0x04);
	CPU.createInstruction({
		operations: [
			({
				operands,
				CPU,
				$InstructionShared,
			} = {}) => {
				const diff = operands[0] - operands[1];
				$InstructionShared.diff = diff;
			},
			({
				setRegister,
				$InstructionShared,
			} = {}) => {
				setRegister('X', $InstructionShared.diff);
			}
		],
		name: 'sub',
		operands: 2,
	}, 0x05);

	return CPU;
})();
