import { remote } from 'electron';
import { useMemo, useEffect } from 'react';
import { useSelector } from 'react-redux';

export const useMainWindowTitle = (browserWindow) => {
	const defaultAppTitle = useMemo(() => remote.app.name, []);

	const title = useSelector(({
		servers,
		currentServerUrl,
	}) => {
		const currentServer = servers.find(({ url }) => url === currentServerUrl);
		return (currentServer && currentServer.title) || defaultAppTitle;
	});

	useEffect(() => {
		browserWindow.setTitle(title);
	}, [browserWindow, title]);
};
