import React from 'react';
import logo from './logo.svg';
import './App.css';

const App: React.FC = () => {
	return (
		<div className="App">
			<header className="App-header">
				<h1>SC Catchers</h1>
				<img src={logo} className="App-logo" alt="logo" />
			</header>
		</div>
	);
}

export default App;
