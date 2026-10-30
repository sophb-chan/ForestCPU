const PCview = document.getElementById('pc-view'),
	registerView = document.getElementById('register-view'),
	clockSpeedView = document.getElementById('clock-speed-view'),
	clockSpeedSlider = document.getElementById('clock-speed'),
	clockSpeedInput = document.getElementById('clock-speed-typed');

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
