import React from 'react';
import './App.css';
import 'moment/locale/cs';
import Layout from './Pages/Layout';
import { FirebaseProvider } from './Context/FirebaseContext';
import { AuthProvider } from './Context/AuthContext';
import { RouterProvider } from './Context/RouterContext';
import { SettleUpProvider } from './Context/SettleUpContext';

const App: React.FC = () => {
	return (
		<div className="App">
			<RouterProvider>
				<FirebaseProvider>
					<SettleUpProvider>
						<AuthProvider>
							<Layout/>
						</AuthProvider>
					</SettleUpProvider>
				</FirebaseProvider>
			</RouterProvider>
		</div>
	);
}

export default App;
