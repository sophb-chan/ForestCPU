const CPU = new Processor();
CPU.createRegisters('A', 'B', 'X', 'Y');
CPU.createInstruction({
	fn: () => {},
	name: 'nop',
	operands: 0,
}, 0x00);
CPU.createInstruction({
	fn: () => { },
	name: 'hlt',
	operands: 0,
	special: Processor.specials.halt,
}, 0x01);
CPU.createInstruction({
	fn: ({
		registers,
		operands,
	}) => {
		registers.A = operands[0];
	},
	name: 'lda',
	operands: 1,
}, 0x02);
CPU.createInstruction({
	fn: ({
		jumpTo,
		operands,
	}) => {
		jumpTo(operands[0] - 1);
	},
	name: 'jmp',
	operands: 1,
}, 0x03);
CPU.createInstruction({
	fn: ({
		PC,
		jumpTo,
		operands,
	}) => {
		jumpTo(PC + operands[0]);
	},
	name: 'skp',
	operands: 1,
}, 0x04);
