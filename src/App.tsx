import React from 'react';
import './App.css';
import 'moment/locale/cs';
import Layout from './Pages/Layout';
import { FirebaseProvider } from './Context/FirebaseContext';
import { AuthProvider } from './Context/AuthContext';

const App: React.FC = () => {
	return (
		<div className="App">
			<FirebaseProvider>
				<AuthProvider>
					<Layout/>
				</AuthProvider>
			</FirebaseProvider>
		</div>
	);
}

export default App;
