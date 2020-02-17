import path from 'path';
import url from 'url';

import { remote } from 'electron';
import { useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';

const createImage = (src) => new Promise((resolve, reject) => {
	const image = new Image();
	image.onload = () => resolve(image);
	image.onerror = () => reject();
	image.src = src;
});

const createNotificationImage = (badge) => new Promise((resolve, reject) => {
	const image = new Image();
	image.onload = () => resolve(image);
	image.onerror = () => reject();

	const svg = `
		<svg xmlns='http://www.w3.org/2000/svg' viewBox='36 33 23 23'>
			<path fill='#f5455c' fill-rule='nonzero' d='M47.5 56C41.14872538 56 36 50.8512746 36 44.5 36 38.14872538 41.14872538 33 47.5 33 53.8512746 33 59 38.14872538 59 44.5 59 50.8512746 53.8512746 56 47.5 56z'/>
			${ (badge === '1' && '<path fill="#FFF" d="M44.4 39h4.4v8.8H51V50h-6.6v-2.2h2.2v-6.6h-2.2z"/>')
				|| (badge === '2' && '<path fill="#FFF" d="M43.1 40.1h1.1V39h6.6v1.1h1.1v4.4h-1.1v1.1h-5.5v2.2h6.6V50h-8.8v-5.5h1.1v-1.1h5.5v-2.2h-4.4v1.1h-2.2z"/>')
				|| (badge === '3' && '<path fill="#FFF" d="M43.1 40.1h1.1V39h6.6v1.1h1.1v3.3h-1.1v2.2h1.1v3.3h-1.1V50h-6.6v-1.1h-1.1v-2.2h2.2v1.1h4.4v-2.2h-4.4v-2.2h4.4v-2.2h-4.4v1.1h-2.2z"/>')
				|| (badge === '4' && '<path fill="#FFF" d="M43.1 39h2.2v4.4h4.4V39h2.2v11h-2.2v-4.4h-6.6z"/>')
				|| (badge === '5' && '<path fill="#FFF" d="M42.9 39h8.8v2.2h-6.6v2.2h5.5v1.1h1.1v4.4h-1.1V50H44v-1.1h-1.1v-2.2h2.2v1.1h4.4v-2.2h-6.6z"/>')
				|| (badge === '6' && '<path fill="#FFF" d="M43.1 40.1h1.1V39h6.6v1.1h1.1v2.2h-2.2v-1.1h-4.4v2.2h5.5v1.1h1.1v4.4h-1.1V50h-6.6v-1.1h-1.1v-8.8zm2.2 7.7h4.4v-2.2h-4.4v2.2z"/>')
				|| (badge === '7' && '<path fill="#FFF" d="M42.8 40.1h1.1V39h6.6v1.1h1.1V50h-2.2v-8.8H45v3.3h-2.2z"/>')
				|| (badge === '8' && '<path fill="#FFF" d="M43.1 40.1h1.1V39h6.6v1.1h1.1v3.3h-1.1v2.2h1.1v3.3h-1.1V50h-6.6v-1.1h-1.1v-3.3h1.1v-2.2h-1.1v-3.3zm2.2 7.7h4.4v-2.2h-4.4v2.2zm0-4.4h4.4v-2.2h-4.4v2.2z"/>')
				|| (badge === '9' && '<path fill="#FFF" d="M43.1 40.1h1.1V39h6.6v1.1h1.1v8.8h-1.1V50h-6.6v-1.1h-1.1v-2.2h2.2v1.1h4.4v-2.2h-5.5v-1.1h-1.1v-4.4zm2.2 1.1v2.2h4.4v-2.2h-4.4z"/>')
				|| (badge === '+9' && '<path fill="#FFF" d="M39.3 43.5h2v-2h2v2h2v2h-2v2h-2v-2h-2v-2zm7.68-3h1v-1h6v1h1v8h-1v1h-6v-1h-1v-2h2v1h4v-2h-5v-1h-1v-4zm2 1v2h4v-2h-4z"/>')
				|| (badge === '•' && '<circle cx="47.5" cy="44.5" r="3.5" fill="#FFF"/>') }
		</svg>
	`;

	image.src = `data:image/svg+xml;base64,${ btoa(svg) }`;
});

const createIconForLinux = async (iconURL, badge, nativeImageCache) => {
	const cacheKey = badge ? `${ iconURL }-${ badge }` : iconURL;

	if (nativeImageCache.has(cacheKey)) {
		return nativeImageCache.get(cacheKey);
	}

	try {
		const iconSVG = await createImage(iconURL);
		const icon = remote.nativeImage.createEmpty();

		const canvas = document.createElement('canvas');
		for (const size of [64, 48, 40, 32, 24, 20, 16]) {
			canvas.width = size;
			canvas.height = size;
			const ctx = canvas.getContext('2d');

			ctx.drawImage(iconSVG, 0, 0, size, size);

			if (badge) {
				ctx.beginPath();
				ctx.arc(size - size / 4, size - size / 4, size / 4, 0, 2 * Math.PI);
				ctx.rect(size - size / 4, size - size / 4, size / 4, size / 4);
				ctx.closePath();
				ctx.clip();
				ctx.clearRect(0, 0, size, size);

				ctx.fillStyle = '#F5455C';

				ctx.beginPath();
				ctx.arc(size - size / 4, size - size / 4, size / 6, 0, 2 * Math.PI);
				ctx.closePath();
				ctx.fill();

				ctx.fillStyle = '#ffffff';
				ctx.textAlign = 'center';
				ctx.textBaseline = 'middle';
				ctx.font = `normal normal 900 normal ${ size / 4 }px / ${ size / 4 }px system-ui`;
				ctx.fillText(badge, size - size / 4, size - size / 4);
			}

			const { scaleFactor } = remote.screen.getPrimaryDisplay();

			icon.addRepresentation({
				width: size,
				height: size,
				dataURL: canvas.toDataURL('image/png'),
				scaleFactor,
			});
		}
		canvas.remove();

		nativeImageCache.set(cacheKey, icon);

		return icon;
	} catch (_) {
		return null;
	}
};

const createIconForWindows = async (iconURL, nativeImageCache) => {
	const cacheKey = iconURL;

	if (nativeImageCache.has(cacheKey)) {
		return nativeImageCache.get(cacheKey);
	}

	try {
		const iconSVG = await createImage(iconURL);
		const icon = remote.nativeImage.createEmpty();

		const canvas = document.createElement('canvas');
		for (const size of [256, 64, 48, 40, 32, 24, 20, 16]) {
			canvas.width = size;
			canvas.height = size;
			const ctx = canvas.getContext('2d');

			ctx.drawImage(iconSVG, 0, 0, size, size);

			const scaleFactor = size / 32;

			icon.addRepresentation({
				width: size,
				height: size,
				dataURL: canvas.toDataURL('image/png'),
				scaleFactor,
			});
		}
		canvas.remove();

		nativeImageCache.set(cacheKey, icon);

		return icon;
	} catch (_) {
		return null;
	}
};

const createOverlayIconForWindows = async (badge, nativeImageCache) => {
	if (!badge) {
		return null;
	}

	const cacheKey = badge;

	if (nativeImageCache.has(cacheKey)) {
		return nativeImageCache.get(cacheKey);
	}

	try {
		const notificationImage = await createNotificationImage(badge);

		const icon = remote.nativeImage.createEmpty();

		const canvas = document.createElement('canvas');
		const size = 32;
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext('2d');

		ctx.drawImage(notificationImage, 0, 0, size, size);

		icon.addRepresentation({
			width: size,
			height: size,
			dataURL: canvas.toDataURL('image/png'),
			scaleFactor: 1,
		});

		canvas.remove();

		nativeImageCache.set(cacheKey, icon);

		return icon;
	} catch (_) {
		return null;
	}
};

export const useMainWindowIcon = (browserWindow) => {
	const defaultAppIcon = useMemo(() =>
		url.pathToFileURL(path.join(remote.app.getAppPath(), 'app/public/images/icon.svg')), []);

	const iconURL = useSelector(({
		servers,
		currentServerUrl,
	}) => {
		const currentServer = servers.find(({ url }) => url === currentServerUrl);
		return (currentServer && currentServer.favicon) || defaultAppIcon;
	});

	const badge = useSelector(({ servers }) => {
		const badges = servers.map(({ badge }) => badge);
		const mentionCount = badges
			.filter((badge) => Number.isInteger(badge))
			.reduce((sum, count) => sum + count, 0);

		if (mentionCount > 9) {
			return '+9';
		}

		if (mentionCount) {
			return mentionCount.toString(10);
		}

		if (badges.some((badge) => !!badge)) {
			return '•';
		}

		return null;
	});

	const nativeImageCacheRef = useRef(new Map());

	const setIconPromiseChainRef = useRef(Promise.resolve());
	const setOverlayIconPromiseChainRef = useRef(Promise.resolve());

	useEffect(() => {
		if (process.platform !== 'linux') {
			return;
		}

		setIconPromiseChainRef.current = setIconPromiseChainRef.current
			.then(() => createIconForLinux(iconURL, badge, nativeImageCacheRef.current))
			.then((icon) => browserWindow.setIcon(icon));
	}, [browserWindow, iconURL, badge]);

	useEffect(() => {
		if (process.platform !== 'win32') {
			return;
		}

		setIconPromiseChainRef.current = setIconPromiseChainRef.current
			.then(() => createIconForWindows(iconURL, nativeImageCacheRef.current))
			.then((icon) => browserWindow.setIcon(icon));
	}, [browserWindow, iconURL]);

	useEffect(() => {
		if (process.platform !== 'win32') {
			return;
		}

		setOverlayIconPromiseChainRef.current = setOverlayIconPromiseChainRef.current
			.then(() => createOverlayIconForWindows(badge, nativeImageCacheRef.current))
			.then((overlayIcon) => browserWindow.setOverlayIcon(overlayIcon, badge || ''));
	}, [browserWindow, badge]);
};
