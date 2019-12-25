import React from 'react';
import './App.css';
import 'moment/locale/cs';
import Layout from './Pages/Layout';
import { FirebaseProvider } from './Context/FirebaseContext';
import { AuthProvider } from './Context/AuthContext';
import { RouterProvider } from './Context/RouterContext';

const App: React.FC = () => {
	return (
		<div className="App">
			<RouterProvider>
				<FirebaseProvider>
					<AuthProvider>
						<Layout/>
					</AuthProvider>
				</FirebaseProvider>
			</RouterProvider>
		</div>
	);
}

export default App;
