const execBtn = document.getElementById('exec-btn'),
	codeInput = document.getElementById('code-input'),
	languageSelect = document.getElementById('language-select'),
	PCview = document.getElementById('pc-view'),
	registerView = document.getElementById('register-view'),
	clockSpeedView = document.getElementById('clock-speed-view'),
	clockSpeedSlider = document.getElementById('clock-speed'),
	clockSpeedInput = document.getElementById('clock-speed-typed');


codeInput.focus();
codeInput.addEventListener('keydown', e => {
	const key = e.key.toLowerCase().trim() || 'space';
	if (key === 'enter' && e.ctrlKey)
		execListener();
});


const clockSpeedListener = e => {
	const clockSpeed = parseInt(e.target.value);
	if (clockSpeed === 0)
		CPU.clockSpeed = Infinity
	else
		CPU.clockSpeed = clockSpeed * 1e6; // Convert from MHz to Hz
	clockSpeedSlider.value = clockSpeedInput.value = e.target.value;
	clockSpeedView.textContent = `${clockSpeed} MHz`;
}
clockSpeedSlider.addEventListener('input', clockSpeedListener);
clockSpeedInput.addEventListener('input', clockSpeedListener);

const execListener = () => {
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
};
execBtn.addEventListener('mousedown', execListener);
