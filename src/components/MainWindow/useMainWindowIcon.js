import path from 'path';
import url from 'url';

import { remote } from 'electron';
import { useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';

const createNativeImage = (iconURL, iconCache) => new Promise((resolve) => {
	if (iconCache.has(iconURL)) {
		resolve(iconCache.get(iconURL));
		return;
	}

	const iconSVG = new Image();
	iconSVG.src = iconURL;
	iconSVG.onload = () => {
		const icon = remote.nativeImage.createEmpty();

		const canvas = document.createElement('canvas');
		for (const size of [64, 48, 40, 32, 24, 20, 16, 256]) {
			canvas.width = size;
			canvas.height = size;
			const ctx = canvas.getContext('2d');

			ctx.drawImage(iconSVG, 0, 0, size, size);

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

	const iconCacheRef = useRef(new Map());

	const promiseChainRef = useRef(Promise.resolve());

	useEffect(() => {
		if (process.platform !== 'linux' && process.platform !== 'win32') {
			return;
		}

		promiseChainRef.current = promiseChainRef.current
			.then(() => createNativeImage(iconURL, iconCacheRef.current))
			.then((icon) => browserWindow.setIcon(icon));
	}, [browserWindow, iconURL]);
};
