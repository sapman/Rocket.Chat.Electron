import path from 'path';
import url from 'url';

import { remote } from 'electron';
import { useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import { useSaga } from '../SagaMiddlewareProvider';
import { mainWindowStateSaga } from './sagas';
import { MAIN_WINDOW_WEBCONTENTS_FOCUSED, MAIN_WINDOW_EDIT_FLAGS_CHANGED } from '../../actions';

export function MainWindow({
	browserWindow = remote.getCurrentWindow(),
	children,
}) {
	const dispatch = useDispatch();

	useEffect(() => {
		const fetchAndDispatchFocusedWebContentsId = () => {
			const webContents = document.activeElement.matches('webview')
				? document.activeElement.getWebContents()
				: browserWindow.webContents;

			if (webContents.isDevToolsFocused()) {
				dispatch({ type: MAIN_WINDOW_WEBCONTENTS_FOCUSED, payload: -1 });
				return;
			}

			dispatch({ type: MAIN_WINDOW_WEBCONTENTS_FOCUSED, payload: webContents.id });
		};

		document.addEventListener('focus', fetchAndDispatchFocusedWebContentsId, true);
		document.addEventListener('blur', fetchAndDispatchFocusedWebContentsId, true);

		fetchAndDispatchFocusedWebContentsId();

		return () => {
			document.removeEventListener('focus', fetchAndDispatchFocusedWebContentsId);
			document.removeEventListener('blur', fetchAndDispatchFocusedWebContentsId);
		};
	}, [browserWindow, dispatch]);

	useEffect(() => {
		const fetchAndDispatchEditFlags = () => {
			dispatch({
				type: MAIN_WINDOW_EDIT_FLAGS_CHANGED,
				payload: {
					canUndo: document.queryCommandEnabled('undo'),
					canRedo: document.queryCommandEnabled('redo'),
					canCut: document.queryCommandEnabled('cut'),
					canCopy: document.queryCommandEnabled('copy'),
					canPaste: document.queryCommandEnabled('paste'),
					canSelectAll: document.queryCommandEnabled('selectAll'),
				},
			});
		};

		document.addEventListener('focus', fetchAndDispatchEditFlags, true);
		document.addEventListener('selectionchange', fetchAndDispatchEditFlags, true);

		return () => {
			document.removeEventListener('focus', fetchAndDispatchEditFlags);
			document.removeEventListener('selectionchange', fetchAndDispatchEditFlags);
		};
	}, [dispatch]);

	const badge = useSelector(({ isTrayIconEnabled, servers }) => {
		if (isTrayIconEnabled) {
			return undefined;
		}

		const badges = servers.map(({ badge }) => badge);
		const mentionCount = badges
			.filter((badge) => Number.isInteger(badge))
			.reduce((sum, count) => sum + count, 0);
		return mentionCount || (badges.some((badge) => !!badge) && '•') || null;
	});

	const iconURL = useSelector(({
		servers,
		currentServerUrl,
	}) => {
		const currentServer = servers.find(({ url }) => url === currentServerUrl);
		return (currentServer && currentServer.favicon)
			|| String(url.pathToFileURL(path.join(remote.app.getAppPath(), 'app/public/images/icon.svg')));
	});

	const iconPromiseRef = useRef(Promise.resolve());

	useEffect(() => {
		if (process.platform !== 'linux' && process.platform !== 'win32') {
			return;
		}

		// const image = badge === undefined ? getAppIconPath() : getTrayIconPath({ badge });

		iconPromiseRef.current = iconPromiseRef.current.then(() => new Promise((resolve) => {
			const iconSVG = new Image();
			iconSVG.src = iconURL;
			iconSVG.onload = () => {
				const icon = remote.nativeImage.createEmpty();

				const canvas = document.createElement('canvas');
				for (const size of [16, 20, 24, 32]) {
					canvas.width = size;
					canvas.height = size;
					const ctx = canvas.getContext('2d');

					ctx.drawImage(iconSVG, 0, 0, size, size);

					icon.addRepresentation({
						width: size,
						height: size,
						dataURL: canvas.toDataURL('image/png'),
						scaleFactor: size / 32,
					});
				}
				canvas.remove();

				browserWindow.setIcon(icon);
				resolve();
			};
			iconSVG.onerror = () => {
				resolve();
			};
		}));
	}, [badge, browserWindow, iconURL]);

	useEffect(() => {
		if (process.platform !== 'win32') {
			return;
		}

		const count = Number.isInteger(badge) ? badge : 0;
		browserWindow.flashFrame(!browserWindow.isFocused() && count > 0);
	}, [badge, browserWindow]);

	useSaga(mainWindowStateSaga, [browserWindow]);

	return children;
}
