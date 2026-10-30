const availableDemos = [
	'calc',
	'compiler',
	'test',
]
async function loadDemo(selectedDemo) {
	if (!availableDemos.includes(selectedDemo))
		throw new ReferenceError('Demo not found: ' + selectedDemo);

	// Remove existing CPU variable
	delete globalThis.CPU;

	// Load script tag for demo to load
	const demoScriptTag = document.createElement('script');
	demoScriptTag.src = `demos/demo.${selectedDemo}.js`;
	document.body.append(demoScriptTag);

	// Wait for script tag to load
	await new Promise(r =>
		demoScriptTag.addEventListener('onload', r, { once: true })
	);

	// Try checking it
	if (globalThis.CPU == null);
		throw new ReferenceError('Demo not found: ' + selectedDemo);
}
