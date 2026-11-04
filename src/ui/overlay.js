const overlayMenu = document.getElementById('overlay-menu');

function toggleOverlayMenu() {
	if (overlayMenu.classList.contains('hidden'))
		overlayMenu.classList.remove('hidden');
	else
		overlayMenu.classList.add('hidden');
}
