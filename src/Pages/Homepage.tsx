import React from 'react';
import logo from '../logo-large.png';
import './Homepage.css';

const Homepage: React.FC = () => {
	return <>
		<h1>SC Catchers</h1>
		<img src={logo} className="App-logo" alt="logo" />
	</>;
};
export default Homepage;
