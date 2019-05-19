import React, { useState } from 'react';
import classNames from 'classnames';
import './App.css';
import Anchor from './Components/Anchor';
import Homepage from './Pages/Homepage';
import Matches from './Pages/Matches';
import logo from './logo.png';
import 'moment/locale/cs';

const pages = [
	{
		name: 'SC Catchers',
		path: '/',
		render: () => <Homepage/>,
		hiddenInMenu: true,
	},
	{
		name: 'Zápasy',
		path: '/zapasy',
		render: () => <Matches/>,
	},
];

const App: React.FC = () => {
	const [menuOpen, setMenuOpen] = useState(false);
	const [currentPath, changePath] = useState(window.location.pathname);
	window.onpopstate = window.history.onpushstate = () => setTimeout(() => changePath(window.location.pathname));
	const currentPage = pages.find((page) => page.path === currentPath);
	return (
		<div className="App">
			<header className="App-header">
				<nav className="navbar navbar-expand-lg navbar-dark bg-dark">
					<Anchor className="navbar-brand" href="/">SC Catchers</Anchor>
					<button className="navbar-toggler" type="button" onClick={() => setMenuOpen(!menuOpen)}>
						<span className="navbar-toggler-icon"></span>
					</button>

					<div className="collapse navbar-collapse" style={{ display: menuOpen ? 'block' : 'none' }}>
						<ul className="navbar-nav mr-auto">
							{pages.filter((page) => !page.hiddenInMenu).map((page) => (
								<li key={page.path} className={classNames("nav-item", {
									'active': page.path === currentPath,
								})}>
									<Anchor
										className="nav-link"
										href={page.path}
									>
										{page.name}
										{page.path === currentPath ? <span className="sr-only">(current)</span> : null}
									</Anchor>
								</li>
							))}
						</ul>
						<a className="nav-link external" target="_blank" rel="noopener noreferrer" href="http://www.psmf.cz">
							PSMF <i className="fa fa-external-link"/>
						</a>
					</div>
				</nav>
			</header>
			<section className="container App-content">
				{currentPage ? (
					currentPage.render && currentPage.render()
				) : (
					<>
						<h1>SC Catchers - Stránka nenalezena</h1>
						<p>Tato stránka nebyla nalezena. Prosím pokračuj na <Anchor href="/">stránce týmu</Anchor></p>
						<img src={logo} className="App-logo" alt="logo" />
					</>
				)}
			</section>
			<footer className="App-footer"></footer>
		</div>
	);
}

export default App;
