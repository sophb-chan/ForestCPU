const selectedDemo = 'test';
const demoScriptTag = document.createElement('script');
demoScriptTag.src = `demos/demo.${selectedDemo}.js`;
document.body.append(demoScriptTag);
setTimeout(() => {
	try {
		globalThis.CPU = CPU;
	} catch {
		console.log('Demo not found:', selectedDemo);
	}
}, 100);
