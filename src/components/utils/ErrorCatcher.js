import { remote } from 'electron';
import { Component } from 'react';

export class ErrorCatcher extends Component {
	componentDidCatch(error, errorInfo) {
		console.error(error);
		console.error(errorInfo.componentStack);
		remote.dialog.showErrorBox(error.message, error.stack);
		process.abort();
	}

	render() {
		return this.props.children;
	}
}
