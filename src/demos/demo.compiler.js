const CPU = new Processor();
CPU.createRegisters('MA');
CPU.createInstruction({
	fn: ({
		setRegister,
		memory,
		operands,
	}) => {
		const address = operands[0];
		setRegister('MA', memory[address]);
	},
	name: 'mem',
	operands: 1,
});
CPU.createInstruction({
	fn: ({
		setRegister,
		memory,
		operands,
	}) => {
		const address = operands[0], value = operands[1] % 256;
		memory[address] = value;

	},
	name: 'strmem',
	operands: 2,
});
console.log('ASCII table:');
for (let c = 0x20; c < 0x7f; c++) {
	console.log(`0x${c.toString(16).padStart(2, 0)} = ${String.fromCharCode(c)}`);
}
