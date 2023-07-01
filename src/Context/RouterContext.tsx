import React from 'react';

interface IProps {
	children: React.ReactNode;
}

interface IRouter {
	goPath(path: string): void;
	refresh(): void;
	refreshKey: number;
}

export interface IRouterValue {
	router: IRouter;
}

export const RouterContext = React.createContext<IRouterValue>({} as IRouterValue);

export class RouterProvider extends React.Component<IProps> {

	public state = {
		refreshKey: 0,
	};

	public render() {
		return (
			<RouterContext.Provider value={{
				router: {
					goPath: this.goPath,
					refresh: () => this.setState({ refreshKey: this.state.refreshKey + 1 }),
					refreshKey: this.state.refreshKey,
				},
			}}>
				{this.props.children}
			</RouterContext.Provider>
		);
	}

	private goPath = (path: string) => {
		window.history.pushState(undefined, '', path);
	}
}

export const withRouter = <TOwnProps extends {}>(WrappedComponent: React.ComponentType<TOwnProps & IRouterValue>) => (
	(props: TOwnProps) => (
		<RouterContext.Consumer>
			{(value: IRouterValue) => <WrappedComponent {...props} {...value} />}
		</RouterContext.Consumer>
	)
);
