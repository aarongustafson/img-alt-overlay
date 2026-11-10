import { defineImgAltOverlay } from '@aarongustafson/img-alt-overlay/define.js';

const registered: boolean = defineImgAltOverlay();
document.createElement('img-alt-overlay').refresh();
document.body.addEventListener('img-alt-overlay:error', (event) => {
	const error: Error = event.detail.error;
	console.log(registered, error.message);
});
