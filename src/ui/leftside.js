const execBtn = document.getElementById('exec-btn'),
	codeInput = document.getElementById('code-input'),
	languageSelect = document.getElementById('language-select');

codeInput.focus();
codeInput.addEventListener('keydown', e => {
	const key = e.key.toLowerCase().trim() || 'space';

	if (key === 'enter' && e.ctrlKey)
		execBtn.dispatchEvent(new MouseEvent('mousedown'));
});

execBtn.addEventListener('mousedown', () => {
	if (globalThis.CPU == null)
		return alert('CPU is undefined!');

	try {
		switch (languageSelect.value) {
			case 'assembly':
				const compiled = compileFile(codeInput.value, CPU);
				console.log('Compiled output:', compiled);
				CPU.loadProgram(...compiled);

				registerView.innerHTML = '';
				for (const [registerName, value] of Object.entries(CPU.registers)) {
					const registerElement = document.createElement('p');
					registerElement.innerHTML = `<b>${registerName}</b>: ${value}`;
					registerElement.id = `register-${registerName}-view`;
					registerView.append(registerElement);
				}

				CPU.runProgram({
					instructionClockEnd({
						PC,
						registers,
					}) {
						PCview.innerHTML = `<b>PC</b>: ${PC}`;
						for (const [registerName, value] of Object.entries(registers))
							document.getElementById(`register-${registerName}-view`).innerHTML =
								`<b>${registerName}</b>: ${value}`;
					}
				});
				break;

			default:
				return alert(`Unsupported language: "${languageSelect.value}"`);
		}
	} catch (err) {
		if (err.name && err.message)
			alert(`Exception!\n${err.name}: ${err.message}`);
		else
			alert(`Exception!\nRawThrow: ${JSON.stringify(err)}`);
	}
});
