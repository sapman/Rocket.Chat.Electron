import path from 'path';
import url from 'url';

import { remote } from 'electron';
import { useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';

const createImage = (src) => new Promise((resolve, reject) => {
	const image = new Image();
	image.src = src;
	image.onload = () => {
		resolve(image);
	};
	image.onerror = () => {
		reject();
	};
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
	const cacheKey = badge;

	if (nativeImageCache.has(cacheKey)) {
		return nativeImageCache.get(cacheKey);
	}

	const icon = remote.nativeImage.createEmpty();

	const canvas = document.createElement('canvas');
	const size = 16;
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext('2d');

	if (badge) {
		ctx.fillStyle = '#F5455C';

		ctx.beginPath();
		ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
		ctx.closePath();
		ctx.fill();

		ctx.fillStyle = '#ffffff';
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.font = `normal normal 900 normal ${ size / 2 }px / ${ size / 2 }px system-ui`;
		ctx.fillText(badge, size / 2, size / 2);
	}

	icon.addRepresentation({
		width: size,
		height: size,
		dataURL: canvas.toDataURL('image/png'),
		scaleFactor: 1,
	});

	canvas.remove();

	nativeImageCache.set(cacheKey, icon);

	return icon;
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

	const promiseChainRef = useRef(Promise.resolve());

	useEffect(() => {
		if (process.platform !== 'linux') {
			return;
		}

		promiseChainRef.current = promiseChainRef.current
			.then(() => createIconForLinux(iconURL, badge, nativeImageCacheRef.current))
			.then((icon) => browserWindow.setIcon(icon));
	}, [browserWindow, iconURL, badge]);

	useEffect(() => {
		if (process.platform !== 'win32') {
			return;
		}

		promiseChainRef.current = promiseChainRef.current
			.then(() => Promise.all([
				createIconForWindows(iconURL, nativeImageCacheRef.current),
				createOverlayIconForWindows(badge, nativeImageCacheRef.current),
			]))
			.then(([icon, overlay]) => {
				browserWindow.setIcon(icon);
				browserWindow.setOverlayIcon(overlay, badge || '');
			});
	}, [browserWindow, iconURL, badge]);
};
