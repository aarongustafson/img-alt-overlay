import { ImgAltOverlayElement } from '@aarongustafson/img-alt-overlay';

const element: ImgAltOverlayElement = document.createElement('img-alt-overlay');
const state: 'idle' | 'inactive' | 'ready' | 'error' = element.state;
element.refresh();
element.addEventListener('img-alt-overlay:error', (event) => {
	const error: Error = event.detail.error;
	console.log(error, state);
});
