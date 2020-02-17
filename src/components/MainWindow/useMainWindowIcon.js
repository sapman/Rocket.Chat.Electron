import path from 'path';
import url from 'url';

import { remote } from 'electron';
import { useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';

const createNativeImage = (iconURL, badge, iconCache) => new Promise((resolve) => {
	const cacheKey = `${ iconURL }-${ badge }`;

	if (iconCache.has(cacheKey)) {
		resolve(iconCache.get(cacheKey));
		return;
	}

	const iconSVG = new Image();
	iconSVG.src = iconURL;
	iconSVG.onload = () => {
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
				ctx.fillText(String(badge), size - size / 4, size - size / 4);
			}

			const scaleFactor = (process.platform === 'win32' && size / 32)
				|| remote.screen.getPrimaryDisplay().scaleFactor;

			icon.addRepresentation({
				width: size,
				height: size,
				dataURL: canvas.toDataURL('image/png'),
				scaleFactor,
			});
		}
		canvas.remove();

		iconCache.set(cacheKey, icon);

		resolve(icon);
	};
	iconSVG.onerror = () => {
		resolve(null);
	};
});

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
		return mentionCount || (badges.some((badge) => !!badge) && '•') || null;
	});

	const iconCacheRef = useRef(new Map());

	const promiseChainRef = useRef(Promise.resolve());

	useEffect(() => {
		if (process.platform !== 'win32' && process.platform !== 'linux') {
			return;
		}

		promiseChainRef.current = promiseChainRef.current
			.then(() => createNativeImage(iconURL, badge, iconCacheRef.current))
			.then((icon) => browserWindow.setIcon(icon));
	}, [browserWindow, iconURL, badge]);
};
