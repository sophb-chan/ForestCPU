const loadDemoBtn = document.getElementById('load-demo');

loadDemoBtn.addEventListener('mouseup', () => {
	const demo = prompt(`Select a demo to load:\n"${availableDemos.join('", "')}"`)
	if (!demo) {
		console.log('Interaction cancelled');
		return;
	}

	loadDemo(demo);
	alert(`Loaded demo "${demo}"`);
});
