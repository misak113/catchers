import React from 'react';

interface IProps {
	children: React.ReactNode;
}

interface IRouter {
	goPath(path: string): void;
}

export interface IRouterValue {
	router: IRouter;
}

export const RouterContext = React.createContext<IRouterValue>({} as IRouterValue);

export class RouterProvider extends React.Component<IProps> {

	public render() {
		return (
			<RouterContext.Provider value={{
				router: {
					goPath: this.goPath,
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
